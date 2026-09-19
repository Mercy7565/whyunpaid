'use client';

import { formatBps, formatMonths, formatPaise } from '@/vm/format';
import { CATEGORY_LABELS, PROCEDURE_LABELS, listPhrase } from '@/vm/labels';
import { clausesInReadingOrder } from '@/vm/selectors';
import type { Clause, CompiledPolicy } from '@/vm/types';

/**
 * The compiled policy, rendered as what it is: data.
 *
 * Each clause shows the parameters the evaluator will read, in the units it
 * will read them in. There is no prose summary here on purpose. The point of
 * the inspector is that the thing being executed can be looked at directly.
 */

function parameters(clause: Clause): { label: string; value: string }[] {
  switch (clause.kind) {
    case 'SumInsured':
      return [{ label: 'amountPaise', value: `${clause.amountPaise} (${formatPaise(clause.amountPaise)})` }];
    case 'Moratorium':
      return [{ label: 'months', value: `${clause.months} (${formatMonths(clause.months)})` }];
    case 'PermanentExclusion':
      return [
        {
          label: 'procedures',
          value: listPhrase(clause.procedures.map((p) => PROCEDURE_LABELS[p])),
        },
      ];
    case 'WaitingPeriod':
      return [
        { label: 'waitingKind', value: clause.waitingKind },
        { label: 'months', value: `${clause.months}` },
        {
          label: 'appliesTo',
          value:
            clause.appliesTo.scope === 'procedures'
              ? `procedures: ${listPhrase(clause.appliesTo.procedures.map((p) => PROCEDURE_LABELS[p]))}`
              : clause.appliesTo.scope,
        },
      ];
    case 'LineItemIneligibility':
      return [
        {
          label: 'categories',
          value: listPhrase(clause.categories.map((c) => CATEGORY_LABELS[c])),
        },
      ];
    case 'RoomRentCap':
      return [
        {
          label: 'limit',
          value:
            clause.limit.basis === 'perDayAmount'
              ? `${formatPaise(clause.limit.perDayPaise)} per day`
              : `${formatBps(clause.limit.percentBps)} of the sum insured, per day`,
        },
        {
          label: 'associatedCategories',
          value: listPhrase(clause.associatedCategories.map((c) => CATEGORY_LABELS[c])),
        },
        {
          label: 'exemptCategories',
          value: listPhrase(clause.exemptCategories.map((c) => CATEGORY_LABELS[c])),
        },
      ];
    case 'SubLimit':
      return [
        {
          label: 'procedures',
          value: listPhrase(clause.procedures.map((p) => PROCEDURE_LABELS[p])),
        },
        { label: 'capPaise', value: `${clause.capPaise} (${formatPaise(clause.capPaise)})` },
      ];
    case 'Deductible':
      return [{ label: 'amountPaise', value: `${clause.amountPaise} (${formatPaise(clause.amountPaise)})` }];
    case 'CoPay':
      return [{ label: 'percentBps', value: `${clause.percentBps} (${formatBps(clause.percentBps)})` }];
  }
}

export function ClauseTree({
  policy,
  selectedId,
  onSelect,
}: {
  policy: CompiledPolicy;
  selectedId: string | null;
  onSelect: (clauseId: string) => void;
}) {
  const clauses = clausesInReadingOrder(policy);

  return (
    <section aria-labelledby="clause-tree-title" className="flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-1 pb-1">
        <h2 id="clause-tree-title" className="text-[15px] font-medium ink-strong">
          The compiled clause tree
        </h2>
        <span className="eyebrow">
          {clauses.length} clauses &middot; all with provenance
        </span>
      </div>

      <ol className="m-0 flex list-none flex-col p-0">
        {clauses.map((clause) => {
          const selected = clause.id === selectedId;
          return (
            <li key={clause.id} className="hair-t">
              <button
                type="button"
                onClick={() => onSelect(clause.id)}
                aria-pressed={selected}
                className="w-full px-1 py-1 text-left transition-colors"
                style={{
                  background: selected
                    ? 'color-mix(in srgb, var(--surface) 90%, transparent)'
                    : 'transparent',
                  borderLeft: selected
                    ? '2px solid var(--paid-full)'
                    : '2px solid transparent',
                }}
              >
                <span className="flex flex-wrap items-baseline gap-1">
                  <span
                    className="shrink-0 px-[5px] py-[1px] text-[11px] font-semibold leading-[1.4]"
                    style={{
                      border: 'var(--hair) solid color-mix(in srgb, var(--line) 75%, transparent)',
                      color: 'color-mix(in srgb, var(--paid-full) 84%, transparent)',
                    }}
                  >
                    {clause.ref}
                  </span>
                  <span className="text-[14px] font-medium ink-strong">{clause.title}</span>
                  <code className="text-[11px] ink-muted">{clause.kind}</code>
                </span>

                <dl className="m-0 mt-1 flex flex-col gap-[2px]">
                  {parameters(clause).map((parameter) => (
                    <div key={parameter.label} className="flex flex-wrap gap-1">
                      <dt className="text-[12px] ink-muted">
                        <code className="text-[12px]">{parameter.label}</code>
                      </dt>
                      <dd className="m-0 text-[12px] ink-body" data-figure>
                        {parameter.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-1 text-[12px] leading-[1.55] ink-muted italic">
                  &ldquo;{clause.provenance.sourceQuote}&rdquo;
                </p>
                <p className="mt-[2px] text-[11px] ink-muted">
                  page {clause.provenance.page} &middot; characters {clause.provenance.charStart}
                  &ndash;{clause.provenance.charEnd} &middot; {clause.provenance.confidence}{' '}
                  confidence
                </p>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
