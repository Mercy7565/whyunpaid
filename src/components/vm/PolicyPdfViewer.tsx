'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SkeletonBar } from '@/components/Skeleton';

/**
 * The specimen wording, with the clause highlighted.
 *
 * The policy compiler both typeset these pages and recorded a box for every
 * word, so a character range from a clause maps to rectangles exactly. There
 * is no text-layer matching, no fuzzy search and nothing to drift: the
 * highlight lands on the words the clause was compiled from because the same
 * script put them there.
 *
 * pdf.js is imported lazily and only in the browser. If it cannot load, the
 * component falls back to the canonical plain text with the same quote marked
 * up, which is the part that actually matters.
 */

type Span = [number, number, number, number, number, number, number];
type SpansFile = { pageWidth: number; pageHeight: number; pages: number; spans: Span[] };

type Rect = { left: number; top: number; width: number; height: number };

type Status = 'idle' | 'loading' | 'ready' | 'fallback';

/**
 * An ABSOLUTE url for the standard font data.
 *
 * pdf.js resolves this inside its worker, and a root-relative path does not
 * reliably resolve against a worker's base url. On a local server the request
 * happened to succeed; on the CDN it did not, and pdf.js WAITS on a font it
 * cannot fetch rather than failing, so the render never settled. An absolute
 * origin removes the ambiguity in every context.
 */
function standardFontDataUrl(): string {
  return typeof window === 'undefined'
    ? '/standard_fonts/'
    : `${window.location.origin}/standard_fonts/`;
}


const spansCache = new Map<string, Promise<SpansFile>>();
const textCache = new Map<string, Promise<string>>();

function loadSpans(url: string): Promise<SpansFile> {
  const existing = spansCache.get(url);
  if (existing) return existing;
  const request = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`spans ${response.status}`);
    return response.json() as Promise<SpansFile>;
  });
  spansCache.set(url, request);
  return request;
}

function loadText(url: string): Promise<string> {
  const existing = textCache.get(url);
  if (existing) return existing;
  const request = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`text ${response.status}`);
    return response.text();
  });
  textCache.set(url, request);
  return request;
}

export function PolicyPdfViewer({
  slug,
  charStart,
  charEnd,
  quote,
  clauseRef,
}: {
  slug: string;
  charStart: number;
  charEnd: number;
  quote: string;
  clauseRef: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [rects, setRects] = useState<Rect[]>([]);
  const [excerpt, setExcerpt] = useState<{ before: string; hit: string; after: string } | null>(
    null,
  );
  const [reason, setReason] = useState<string | null>(null);

  const pdfUrl = `/policies/${slug}.pdf`;
  const spansUrl = `/policies/${slug}.spans.json`;
  const textUrl = `/policies/${slug}.txt`;

  /* The plain-text fallback is prepared regardless: it is also the excerpt. */
  const prepareFallback = useCallback(
    async (message: string) => {
      setReason(message);
      try {
        const text = await loadText(textUrl);
        const pad = 260;
        setExcerpt({
          before: text.slice(Math.max(0, charStart - pad), charStart),
          hit: text.slice(charStart, charEnd),
          after: text.slice(charEnd, Math.min(text.length, charEnd + pad)),
        });
      } catch {
        setExcerpt({ before: '', hit: quote, after: '' });
      }
      setStatus('fallback');
    },
    [charEnd, charStart, quote, textUrl],
  );

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    async function run() {
      setStatus('loading');
      setRects([]);

      let spans: SpansFile;
      try {
        spans = await loadSpans(spansUrl);
      } catch {
        await prepareFallback('The word map for this specimen could not be loaded.');
        return;
      }
      if (cancelled) return;

      const covering = spans.spans.filter(([start, end]) => end > charStart && start < charEnd);
      const targetPage = covering[0]?.[2] ?? 1;
      setPageCount(spans.pages);
      setPageNumber(targetPage);

      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const document_ = await pdfjs.getDocument({
          url: pdfUrl,
          /* The specimens use the standard PDF fonts, which are never embedded. */
          standardFontDataUrl: standardFontDataUrl(),
        }).promise;
        if (cancelled) return;
        setPageCount(document_.numPages);

        const page = await document_.getPage(Math.min(targetPage, document_.numPages));
        if (cancelled) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !container || !context) throw new Error('no canvas');

        const base = page.getViewport({ scale: 1 });
        /* 8px of --ground padding on each side frames the sheet. */
        const width = Math.max((container.clientWidth || 536) - 16, 200);
        const scale = width / base.width;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * ratio });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${base.height * scale}px`;

        const task = page.render({ canvas, canvasContext: context, viewport });
        renderTask = task;
        /*
         * A missing font file makes pdf.js wait rather than reject, so the
         * render is raced against a deadline. Falling back to the text view is
         * always better than a skeleton that never resolves.
         */
        await Promise.race([
          task.promise,
          new Promise((_, reject) =>
            window.setTimeout(() => reject(new Error('render timed out after 15s')), 15_000),
          ),
        ]);
        if (cancelled) return;

        setRects(
          covering
            .filter(([, , p]) => p === targetPage)
            .map(([, , , x, y, w, h]) => ({
              left: x * scale,
              /* PDF user space has its origin at the bottom left; the DOM does not. */
              top: (base.height - (y + h)) * scale,
              width: w * scale,
              height: h * scale,
            })),
        );
        setStatus('ready');
        void prepareFallbackQuietly();
      } catch (caught) {
        /* Say what actually went wrong; a generic message is not diagnosable. */
        const detail = caught instanceof Error ? caught.message : String(caught);
        if (!cancelled) {
          await prepareFallback(`The PDF could not be drawn in this browser (${detail}).`);
        }
      }
    }

    /* Keep the excerpt ready so the text view is instant if the reader asks for it. */
    async function prepareFallbackQuietly() {
      try {
        const text = await loadText(textUrl);
        if (cancelled) return;
        const pad = 260;
        setExcerpt({
          before: text.slice(Math.max(0, charStart - pad), charStart),
          hit: text.slice(charStart, charEnd),
          after: text.slice(charEnd, Math.min(text.length, charEnd + pad)),
        });
      } catch {
        /* The PDF is already on screen; the excerpt is a convenience. */
      }
    }

    void run();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [charEnd, charStart, pdfUrl, prepareFallback, slug, spansUrl, textUrl]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <p className="eyebrow">Specimen wording, clause {clauseRef}</p>
        <p className="text-[12px] ink-muted">
          {status === 'ready'
            ? `page ${pageNumber} of ${pageCount} · characters ${charStart}–${charEnd}`
            : status === 'fallback'
              ? 'text view'
              : 'loading'}
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden hair"
        style={{ background: 'var(--ground)' }}
      >
        {status === 'loading' || status === 'idle' ? (
          <div className="flex flex-col gap-1 p-2" aria-busy="true">
            <SkeletonBar height={14} width="60%" />
            <SkeletonBar height={10} />
            <SkeletonBar height={10} />
            <SkeletonBar height={10} width="88%" />
            <SkeletonBar height={10} width="94%" />
            <SkeletonBar height={10} width="70%" />
          </div>
        ) : null}

        {/* The sheet sits on --ground, the way a page sits on a desk. */}
        <div className="relative p-1" style={{ display: status === 'ready' ? 'block' : 'none' }}>
          <canvas ref={canvasRef} className="block w-full" aria-label={`Specimen wording, page ${pageNumber}`} />
          {rects.map((rect, index) => (
            <span
              key={index}
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                left: `calc(${rect.left}px + 8px)`,
                top: `calc(${rect.top}px + 8px)`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                background: 'color-mix(in srgb, var(--blue) 40%, transparent)',
                mixBlendMode: 'multiply',
              }}
            />
          ))}
        </div>

        {status === 'fallback' && excerpt ? (
          <div className="p-2">
            {reason ? (
              <p className="mb-1 text-[12px] leading-[1.6] ink-muted">
                {reason} The wording is shown as text instead, with the same words marked.
              </p>
            ) : null}
            <p className="whitespace-pre-wrap text-[13px] leading-[1.75] ink-body">
              <span className="opacity-70">{excerpt.before}</span>
              <mark
                style={{
                  background: 'color-mix(in srgb, var(--accent) 38%, transparent)',
                  color: 'inherit',
                }}
              >
                {excerpt.hit}
              </mark>
              <span className="opacity-70">{excerpt.after}</span>
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1">
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[12px] underline underline-offset-4 ink-muted"
        >
          Open the specimen PDF
        </a>
        {status === 'ready' && excerpt ? (
          <button
            type="button"
            onClick={() => setStatus('fallback')}
            className="text-[12px] underline underline-offset-4 ink-muted"
          >
            Read it as text
          </button>
        ) : null}
      </div>
    </div>
  );
}
