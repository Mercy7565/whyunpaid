'use client';

import { Quote } from '@/components/waterfall/ClauseCard';
import type { Contradiction } from '@/letter/contradictions';

/**
 * The points on which the letter and the wording do not sit together.
 *
 * Direct contradictions first, then the supporting points. A direct one says
 * the wording does not do what the letter says it does. A supporting one says
 * the wording agrees, and names the factual question worth putting instead:
 * this tool is more useful when it is willing to say the insurer is right.
 */
export function ContradictionList({ contradictions }: { contradictions: readonly Contradiction[] }) {
  const direct = contradictions.filter((c) => c.strength === 'direct');

  return (
    <section aria-labelledby="contradictions-title" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <h2 id="contradictions-title" className="text-[15px] font-medium ink-strong">
          Where the two diverge
        </h2>
        <span className="eyebrow">
          {direct.length} direct {direct.length === 1 ? 'point' : 'points'} &middot;{' '}
          {contradictions.length - direct.length} supporting
        </span>
      </div>

      {contradictions.length === 0 ? (
        <p className="text-[14px] leading-[1.65] ink-body measure">
          Nothing here diverges. On this policy and these figures, the wording and the stated ground
          reach the same place.
        </p>
      ) : null}

      <ol className="m-0 flex list-none flex-col p-0">
        {contradictions.map((contradiction, index) => (
          <li key={contradiction.id} className="hair-t py-2 first:border-t-0 first:pt-0">
            <div className="flex items-baseline gap-1">
              <span
                className="slab display flex h-[26px] w-[26px] shrink-0 items-center justify-center text-[13px] leading-none"
                style={{
                  background:
                    contradiction.strength === 'direct' ? 'var(--paprika)' : 'var(--olive)',
                  boxShadow: 'var(--shadow-hard-sm)',
                }}
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                className="shrink-0 px-[6px] py-[1px] text-[11px] font-bold uppercase leading-[1.4] tracking-[0.08em]"
                style={{
                  border: 'var(--hair) solid var(--line)',
                  borderRadius: '4px',
                  color: 'var(--ink)',
                }}
              >
                {contradiction.strength === 'direct' ? 'Direct' : 'Supporting'}
              </span>
              {contradiction.clauseRef ? (
                <span className="text-[12px] ink-muted">clause {contradiction.clauseRef}</span>
              ) : null}
            </div>

            <p className="mt-1 text-[15px] leading-[1.6] ink-strong measure">
              {contradiction.summary}
            </p>
            <p className="mt-1 text-[14px] leading-[1.65] ink-body measure">
              {contradiction.vmFinding}
            </p>

            {contradiction.sourceQuote && contradiction.clauseRef ? (
              <div className="mt-1">
                <Quote text={contradiction.sourceQuote} cite={contradiction.clauseRef} />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
