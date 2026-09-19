'use client';

import { useMemo } from 'react';
import {
  GROUND_KINDS,
  GROUND_LABELS,
  GROUND_NOTES,
  type GroundDetection,
  type GroundKind,
  mergeMatches,
} from '@/letter/grounds';

/**
 * What the letter was read as, and on which words.
 *
 * The detected ground is shown with the reader's own text marked up, because a
 * classifier that will not say what it keyed on is asking to be trusted rather
 * than checked. The ground is also overridable: the rules are good, not
 * infallible, and the person holding the letter knows better than they do.
 */
export function GroundCard({
  detection,
  letterText,
  ground,
  onOverride,
  modelUnavailable,
}: {
  detection: GroundDetection;
  letterText: string;
  ground: GroundKind | null;
  onOverride: (ground: GroundKind | null) => void;
  modelUnavailable: boolean;
}) {
  const overridden = ground !== detection.ground;

  const marked = useMemo(() => {
    if (detection.matches.length === 0 || letterText.length === 0) return null;
    const spans = mergeMatches(detection.matches);
    const pieces: { text: string; hit: boolean }[] = [];
    let cursor = 0;
    for (const span of spans) {
      const start = Math.max(0, Math.min(span.start, letterText.length));
      const end = Math.max(start, Math.min(span.end, letterText.length));
      if (start > cursor) pieces.push({ text: letterText.slice(cursor, start), hit: false });
      pieces.push({ text: letterText.slice(start, end), hit: true });
      cursor = end;
    }
    if (cursor < letterText.length) pieces.push({ text: letterText.slice(cursor), hit: false });
    return pieces;
  }, [detection.matches, letterText]);

  return (
    <section className="panel px-2 py-2" aria-labelledby="ground-title">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <h2 id="ground-title" className="text-[15px] font-medium ink-strong">
          The ground stated
        </h2>
        <span className="eyebrow">
          {overridden
            ? 'set by hand'
            : detection.method === 'keyword'
              ? `read from the text · ${detection.confidence} confidence`
              : 'not detected'}
        </span>
      </div>

      <p className="mt-1 display text-[clamp(20px,3.4vw,26px)] leading-[1.15] ink-strong">
        {ground ? GROUND_LABELS[ground] : 'No ground could be read'}
      </p>

      <p className="mt-1 text-[13px] leading-[1.6] ink-muted measure">
        {ground ? GROUND_NOTES[ground] : detection.rationale}
      </p>

      {!overridden && detection.matches.length > 0 ? (
        <p className="mt-1 text-[12px] leading-[1.6] ink-muted measure">{detection.rationale}</p>
      ) : null}

      {marked ? (
        <div className="mt-2">
          <p className="eyebrow mb-1">What it keyed on, in your text</p>
          <p
            className="whitespace-pre-wrap text-[13px] leading-[1.7] ink-body"
            style={{ maxWidth: '68ch' }}
          >
            {marked.map((piece, index) =>
              piece.hit ? (
                <mark
                  key={index}
                  style={{
                    background: 'color-mix(in srgb, var(--paid-full) 26%, transparent)',
                    color: 'inherit',
                    padding: '0 1px',
                  }}
                >
                  {piece.text}
                </mark>
              ) : (
                <span key={index}>{piece.text}</span>
              ),
            )}
          </p>
        </div>
      ) : null}

      <div className="mt-2">
        <label htmlFor="ground-override" className="text-[13px] font-medium ink-body">
          Not what the letter says? Set it by hand
        </label>
        <select
          id="ground-override"
          value={ground ?? ''}
          onChange={(event) =>
            onOverride(event.target.value === '' ? null : (event.target.value as GroundKind))
          }
          className="mt-1 w-full appearance-none hair bg-transparent px-1 py-1 text-[14px] ink-strong"
          style={{ background: 'color-mix(in srgb, var(--surface) 40%, transparent)' }}
        >
          <option value="" style={{ color: 'var(--on-accent)' }}>
            No ground stated
          </option>
          {GROUND_KINDS.map((kind) => (
            <option key={kind} value={kind} style={{ color: 'var(--on-accent)' }}>
              {GROUND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>

      {modelUnavailable ? (
        <p className="mt-2 text-[12px] leading-[1.6] ink-muted measure">
          The keyword rules did this on their own, in your browser. A model can be added to place
          letters the rules cannot, but the product never requires one and nothing on this page has
          gone anywhere.
        </p>
      ) : null}
    </section>
  );
}
