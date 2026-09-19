'use client';

import { Quote } from '@/components/waterfall/ClauseCard';
import type { Contestability } from '@/vm/types';

/**
 * The moratorium, shown next to the waterfall and never inside it.
 *
 * This panel exists to make a distinction the wording makes and almost nobody
 * repeats: sixty months of continuous cover stops the insurer contesting a
 * claim for non-disclosure, and does nothing else. It does not unlock cover, it
 * does not lift an exclusion, and it does not move a single figure in the
 * waterfall. Putting it in its own frame is the honest way to say so.
 */
export function ContestabilityPanel({ contestability }: { contestability: Contestability }) {
  const { moratoriumComplete, monthsOfContinuousCover, moratoriumMonths } = contestability;
  const progress = Math.min(100, (monthsOfContinuousCover / Math.max(moratoriumMonths, 1)) * 100);

  return (
    <section className="panel px-2 py-2" aria-labelledby="contestability-title">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <h2 id="contestability-title" className="text-[15px] font-medium ink-strong">
          Contestability
        </h2>
        <span className="eyebrow">not part of the waterfall</span>
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span
          className="display text-[30px] leading-none"
          style={{ color: moratoriumComplete ? 'var(--paid-full)' : 'var(--paid-part)' }}
          data-figure
        >
          {monthsOfContinuousCover}
        </span>
        <span className="text-[13px] ink-muted">
          of {moratoriumMonths} months of continuous cover
        </span>
      </div>

      <div
        className="mt-1 h-[6px] w-full"
        role="img"
        aria-label={`${monthsOfContinuousCover} of ${moratoriumMonths} months of continuous cover completed`}
        style={{ border: 'var(--hair) solid color-mix(in srgb, var(--line) 55%, transparent)' }}
      >
        <div
          className="h-full transition-[width] duration-300"
          style={{
            width: `${progress}%`,
            background: moratoriumComplete ? 'var(--paid-full)' : 'var(--paid-part)',
          }}
        />
      </div>

      <p className="mt-2 text-[14px] font-medium leading-[1.55] ink-strong measure">
        {moratoriumComplete
          ? 'The moratorium is complete. The insurer may no longer contest this claim for non-disclosure or misrepresentation, except on grounds of established fraud.'
          : 'The moratorium is not complete. The insurer may still contest this claim for non-disclosure or misrepresentation.'}
      </p>

      <p className="mt-1 text-[13px] leading-[1.6] ink-muted measure">{contestability.note}</p>

      <div className="mt-2">
        <Quote text={contestability.sourceQuote} cite={contestability.clauseRef} />
      </div>
    </section>
  );
}
