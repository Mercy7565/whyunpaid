'use client';

/**
 * Shared pdf.js configuration.
 *
 * pdf.js itself is imported normally, as a lazy `import('pdfjs-dist')` inside
 * the two components that need it, so it lands in its own chunk and never
 * touches the first load. What lives here is the configuration both call sites
 * must agree on, and the one piece of knowledge that is easy to get wrong.
 */

/**
 * An ABSOLUTE url for the standard font data.
 *
 * The specimen PDFs are typeset in the standard PDF fonts, which by definition
 * are never embedded in the file, so pdf.js has to fetch its own copies. It
 * resolves this url inside its worker, where a root-relative path has no
 * reliable base, so it is made absolute here rather than hoped about.
 */
export function standardFontDataUrl(): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/standard_fonts/`;
}

export const PDF_WORKER_SRC = '/pdf.worker.min.mjs';

/**
 * Resolves once the document is visible.
 *
 * pdf.js renders in chunks and continues each chunk from
 * `requestAnimationFrame`, which a browser does not fire for a hidden tab. A
 * render started against a hidden page therefore stalls indefinitely through
 * no fault of its own, so the caller waits rather than starting a deadline it
 * is guaranteed to lose.
 */
export function whenVisible(signal: { cancelled: boolean }): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState === 'visible' || signal.cancelled) {
        document.removeEventListener('visibilitychange', onChange);
        resolve();
      }
    };
    document.addEventListener('visibilitychange', onChange);
  });
}
