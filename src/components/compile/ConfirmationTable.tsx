'use client';

import { useId } from 'react';
import { locateQuote, wordsIn, type DraftClause, type DraftPolicy } from '@/compiler/draft';
import { CATEGORY_LABELS, PROCEDURE_LABELS } from '@/vm/labels';
import { LINE_CATEGORIES, PROCEDURE_CODES, type LineCategory, type ProcedureCode } from '@/vm/types';

/**
 * The confirmation table.
 *
 * This is the part of Path B that matters. An extractor - regular expressions
 * or a model, it makes no difference - produces candidates, and a person has to
 * agree to each one before it becomes a clause that can take money off someone.
 * A row marked low confidence cannot compile until it has been touched, and a
 * row whose quotation is not in the document cannot compile at all.
 *
 * Everything here is an ordinary form control with a real label. There is no
 * cleverness in this component on purpose: it is the audit step.
 */

type Props = {
  draft: DraftPolicy;
  onChange: (clauses: DraftClause[]) => void;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-[2px]">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full hair bg-transparent px-1 py-[5px] text-[13px] ink-strong';
const inputStyle = { background: 'color-mix(in srgb, var(--surface) 34%, transparent)' };

function ChipToggles<T extends string>({
  values,
  selected,
  labels,
  onToggle,
  legend,
}: {
  values: readonly T[];
  selected: readonly T[];
  labels: Readonly<Record<T, string>>;
  onToggle: (value: T) => void;
  legend: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="eyebrow mb-[2px]">{legend}</legend>
      <div className="flex flex-wrap gap-[4px]">
        {values.map((value) => {
          const on = selected.includes(value);
          return (
            <label
              key={value}
              className="cursor-pointer px-[6px] py-[2px] text-[12px]"
              style={{
                border: 'var(--hair) solid color-mix(in srgb, var(--line) 70%, transparent)',
                background: on ? 'var(--paid-full)' : 'transparent',
                color: on ? 'var(--on-accent)' : 'color-mix(in srgb, var(--paid-full) 76%, transparent)',
              }}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => onToggle(value)}
              />
              {labels[value]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ConfirmationTable({ draft, onChange }: Props) {
  const baseId = useId();

  const update = (id: string, patch: Partial<DraftClause>) => {
    onChange(
      draft.clauses.map((clause) =>
        clause.id === id ? { ...clause, ...patch, touched: true } : clause,
      ),
    );
  };

  const remove = (id: string) => {
    onChange(draft.clauses.filter((clause) => clause.id !== id));
  };

  const toggleIn = <T extends string>(list: readonly T[] | undefined, value: T): T[] => {
    const current = list ?? [];
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  };

  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {draft.clauses.map((clause) => {
        const located = locateQuote(clause.quote, draft.documentText, draft.pageStarts);
        const needsAttention = clause.confidence === 'low' && !clause.touched;
        const quoteWords = wordsIn(clause.quote);
        const rowId = `${baseId}-${clause.id}`;

        return (
          <li
            key={clause.id}
            className="hair-t py-2"
            style={{
              borderLeft: needsAttention
                ? '2px solid color-mix(in srgb, var(--line) 95%, transparent)'
                : '2px solid var(--paid-full)',
              paddingLeft: '10px',
            }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <div className="flex flex-wrap items-baseline gap-1">
                <code className="text-[12px] ink-body">{clause.kind}</code>
                <span className="text-[11px] ink-muted">
                  read by {clause.source === 'model' ? 'the model' : clause.source === 'hand' ? 'hand' : 'the clause reader'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {needsAttention ? (
                  <button
                    type="button"
                    onClick={() => update(clause.id, {})}
                    className="px-1 py-[3px] text-[12px] font-medium"
                    style={{ background: 'var(--paid-full)', color: 'var(--on-accent)' }}
                  >
                    Confirm this row
                  </button>
                ) : (
                  <span className="text-[11px] ink-muted">confirmed</span>
                )}
                <button
                  type="button"
                  onClick={() => remove(clause.id)}
                  className="px-1 py-[3px] text-[12px] underline underline-offset-4 ink-muted"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-1 grid gap-1 sm:grid-cols-[100px_minmax(0,1fr)]">
              <Field label="Reference">
                <input
                  className={inputClass}
                  style={inputStyle}
                  value={clause.ref}
                  onChange={(event) => update(clause.id, { ref: event.target.value })}
                />
              </Field>
              <Field label="Title">
                <input
                  className={inputClass}
                  style={inputStyle}
                  value={clause.title}
                  onChange={(event) => update(clause.id, { title: event.target.value })}
                />
              </Field>
            </div>

            <div className="mt-1">
              <Field label={`Quotation from the document (${quoteWords} of 25 words)`}>
                <textarea
                  id={rowId}
                  rows={2}
                  className={`${inputClass} resize-y`}
                  style={inputStyle}
                  value={clause.quote}
                  onChange={(event) => update(clause.id, { quote: event.target.value })}
                />
              </Field>
              <p className="mt-[2px] text-[12px] leading-[1.5] ink-muted">
                {located.found
                  ? located.exact
                    ? `Found at characters ${located.charStart}–${located.charEnd}, page ${located.page}.`
                    : `Found on page ${located.page}, matching ignoring line breaks.`
                  : `Not usable: ${located.reason}.`}
              </p>
            </div>

            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {(clause.kind === 'SumInsured' ||
                clause.kind === 'Deductible' ||
                clause.kind === 'SubLimit') && (
                <Field label="Amount in rupees">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    className={inputClass}
                    style={inputStyle}
                    value={clause.amountRupees ?? 0}
                    onChange={(event) =>
                      update(clause.id, { amountRupees: Number(event.target.value) })
                    }
                  />
                </Field>
              )}

              {(clause.kind === 'Moratorium' || clause.kind === 'WaitingPeriod') && (
                <Field label="Months">
                  <input
                    type="number"
                    min={0}
                    max={240}
                    className={inputClass}
                    style={inputStyle}
                    value={clause.months ?? 0}
                    onChange={(event) => update(clause.id, { months: Number(event.target.value) })}
                  />
                </Field>
              )}

              {clause.kind === 'CoPay' && (
                <Field label="Share, per cent">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    className={inputClass}
                    style={inputStyle}
                    value={(clause.percentBps ?? 0) / 100}
                    onChange={(event) =>
                      update(clause.id, { percentBps: Math.round(Number(event.target.value) * 100) })
                    }
                  />
                </Field>
              )}

              {clause.kind === 'WaitingPeriod' && (
                <>
                  <Field label="Kind">
                    <select
                      className={inputClass}
                      style={inputStyle}
                      value={clause.waitingKind ?? 'initial'}
                      onChange={(event) =>
                        update(clause.id, {
                          waitingKind: event.target.value as DraftClause['waitingKind'],
                        })
                      }
                    >
                      <option value="initial" style={{ color: 'var(--on-accent)' }}>
                        Initial
                      </option>
                      <option value="specificDisease" style={{ color: 'var(--on-accent)' }}>
                        Specified condition
                      </option>
                      <option value="preExistingDisease" style={{ color: 'var(--on-accent)' }}>
                        Pre-existing disease
                      </option>
                    </select>
                  </Field>
                  <Field label="Applies to">
                    <select
                      className={inputClass}
                      style={inputStyle}
                      value={clause.scope ?? 'all'}
                      onChange={(event) =>
                        update(clause.id, { scope: event.target.value as DraftClause['scope'] })
                      }
                    >
                      <option value="all" style={{ color: 'var(--on-accent)' }}>
                        Every claim
                      </option>
                      <option value="procedures" style={{ color: 'var(--on-accent)' }}>
                        Named procedures
                      </option>
                      <option value="preExisting" style={{ color: 'var(--on-accent)' }}>
                        Pre-existing conditions
                      </option>
                    </select>
                  </Field>
                </>
              )}

              {clause.kind === 'RoomRentCap' && (
                <>
                  <Field label="Limit basis">
                    <select
                      className={inputClass}
                      style={inputStyle}
                      value={clause.limitBasis ?? 'perDayAmount'}
                      onChange={(event) =>
                        update(clause.id, {
                          limitBasis: event.target.value as DraftClause['limitBasis'],
                        })
                      }
                    >
                      <option value="perDayAmount" style={{ color: 'var(--on-accent)' }}>
                        Rupees per day
                      </option>
                      <option value="percentOfSumInsuredPerDay" style={{ color: 'var(--on-accent)' }}>
                        Per cent of the sum insured, per day
                      </option>
                    </select>
                  </Field>
                  {clause.limitBasis === 'percentOfSumInsuredPerDay' ? (
                    <Field label="Per cent of sum insured">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        className={inputClass}
                        style={inputStyle}
                        value={(clause.percentBps ?? 0) / 100}
                        onChange={(event) =>
                          update(clause.id, {
                            percentBps: Math.round(Number(event.target.value) * 100),
                          })
                        }
                      />
                    </Field>
                  ) : (
                    <Field label="Rupees per day">
                      <input
                        type="number"
                        min={0}
                        step={500}
                        className={inputClass}
                        style={inputStyle}
                        value={clause.perDayRupees ?? 0}
                        onChange={(event) =>
                          update(clause.id, { perDayRupees: Number(event.target.value) })
                        }
                      />
                    </Field>
                  )}
                </>
              )}
            </div>

            {(clause.kind === 'PermanentExclusion' ||
              clause.kind === 'SubLimit' ||
              (clause.kind === 'WaitingPeriod' && clause.scope === 'procedures')) && (
              <div className="mt-1">
                <ChipToggles<ProcedureCode>
                  legend="Procedures"
                  values={PROCEDURE_CODES}
                  selected={clause.procedures ?? []}
                  labels={PROCEDURE_LABELS}
                  onToggle={(value) =>
                    update(clause.id, { procedures: toggleIn(clause.procedures, value) })
                  }
                />
              </div>
            )}

            {clause.kind === 'LineItemIneligibility' && (
              <div className="mt-1">
                <ChipToggles<LineCategory>
                  legend="Heads that are not payable"
                  values={LINE_CATEGORIES}
                  selected={clause.categories ?? []}
                  labels={CATEGORY_LABELS}
                  onToggle={(value) =>
                    update(clause.id, { categories: toggleIn(clause.categories, value) })
                  }
                />
              </div>
            )}

            {clause.kind === 'RoomRentCap' && (
              <div className="mt-1 grid gap-1">
                <ChipToggles<LineCategory>
                  legend="Reduced in proportion"
                  values={LINE_CATEGORIES}
                  selected={clause.associatedCategories ?? []}
                  labels={CATEGORY_LABELS}
                  onToggle={(value) =>
                    update(clause.id, {
                      associatedCategories: toggleIn(clause.associatedCategories, value),
                    })
                  }
                />
                <ChipToggles<LineCategory>
                  legend="Never reduced"
                  values={LINE_CATEGORIES}
                  selected={clause.exemptCategories ?? []}
                  labels={CATEGORY_LABELS}
                  onToggle={(value) =>
                    update(clause.id, {
                      exemptCategories: toggleIn(clause.exemptCategories, value),
                    })
                  }
                />
              </div>
            )}

            {needsAttention ? (
              <p className="mt-1 text-[12px] leading-[1.5] ink-muted">
                Read low confidence. Check it against the document and confirm, or change it. Nothing
                compiles until every row here has been looked at.
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
