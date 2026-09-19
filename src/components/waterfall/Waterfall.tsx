'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useId, useRef, useState } from 'react';
import { Figure, reserveFor } from '@/components/money/Figure';
import { ClauseCard } from '@/components/waterfall/ClauseCard';
import { DISCLAIMER_ESTIMATE } from '@/lib/copy';
import { formatDeduction, formatPaise } from '@/vm/format';
import { STAGE_LABELS } from '@/vm/labels';
import type { CompiledPolicy, Deduction, Verdict } from '@/vm/types';

type Band = {
  deduction: Deduction;
  /** Percentages of the claimed total. */
  left: number;
  width: number;
};

function bandsOf(verdict: Verdict): Band[] {
  const claimed = Number(verdict.claimedPaise);
  if (claimed <= 0) {
    return verdict.deductions.map((deduction) => ({ deduction, left: 0, width: 0 }));
  }

  let remaining = claimed;
  return verdict.deductions.map((deduction) => {
    const amount = Number(deduction.amountPaise);
    const after = remaining - amount;
    const band: Band = {
      deduction,
      left: (after / claimed) * 100,
      width: (amount / claimed) * 100,
    };
    remaining = after;
    return band;
  });
}

function exemptionQuoteFor(policy: CompiledPolicy, clauseId: string): string | undefined {
  const clause = policy.clauses.find((c) => c.id === clauseId);
  if (clause?.kind !== 'RoomRentCap') return undefined;
  return clause.exemptionProvenance?.sourceQuote;
}

/**
 * The waterfall.
 *
 * Read top to bottom: the bill arrives whole, each clause takes a slice off the
 * right-hand end, and what is left at the bottom is what the policy pays. The
 * The only emphasised element on the screen is that last bar, because it is
 * the only number anyone actually came for. Deductions recede into the band
 * fill, with hairline edges, a minus sign and a clause reference on every one,
 * so nothing here depends on being able to tell two colours apart. A claim
 * that pays nothing says so in words as well as in colour.
 */
export function Waterfall({
  verdict,
  policy,
  maxBillPaise,
}: {
  verdict: Verdict;
  policy: CompiledPolicy;
  maxBillPaise: bigint;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const baseId = useId();
  const reduceMotion = useReducedMotion();

  const bands = bandsOf(verdict);
  const claimed = Number(verdict.claimedPaise);
  const paidPercent = claimed > 0 ? (Number(verdict.paidPaise) / claimed) * 100 : 0;
  const nothingPayable = verdict.paidPaise === 0n;
  const reserve = reserveFor(maxBillPaise);

  const ease = reduceMotion ? undefined : ([0.16, 1, 0.3, 1] as const);
  const barTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const };

  /* Up and down move between bands; the buttons handle Enter and Space themselves. */
  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLOListElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[data-band]') ?? [],
    );
    if (buttons.length === 0) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === 'ArrowDown'
        ? Math.min(index + 1, buttons.length - 1)
        : event.key === 'ArrowUp'
          ? Math.max(index - 1, 0)
          : event.key === 'Home'
            ? 0
            : buttons.length - 1;
    buttons[next]?.focus();
  }, []);

  return (
    <section aria-labelledby={`${baseId}-title`} className="flex w-full flex-col">
      <h2 id={`${baseId}-title`} className="sr-only">
        What the policy pays, and which clause took the rest
      </h2>

      {/* The bill, whole. */}
      <div className="flex flex-col gap-1 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="eyebrow">Hospital bill</span>
          <Figure
            paise={verdict.claimedPaise}
            className="display text-[24px] leading-none ink-strong sm:text-[28px]"
            reserve={reserve}
          />
        </div>
        <div className="h-[10px] w-full" style={{ background: 'var(--band)' }} />
      </div>

      {/* One row per clause that took something. */}
      <ol ref={listRef} onKeyDown={onKeyDown} className="m-0 flex list-none flex-col p-0">
        <AnimatePresence initial={false}>
          {bands.map((band) => {
            const { deduction } = band;
            const open = openId === deduction.clauseId;
            const panelId = `${baseId}-panel-${deduction.clauseId}`;
            const buttonId = `${baseId}-button-${deduction.clauseId}`;

            return (
              <motion.li
                key={deduction.clauseId}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                transition={{ duration: reduceMotion ? 0 : 0.32, ease }}
                className="hair-t"
              >
                <h3 className="m-0">
                  <button
                    type="button"
                    id={buttonId}
                    data-band
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenId(open ? null : deduction.clauseId)}
                    className="group flex w-full flex-col gap-1 px-0 py-1 text-left"
                  >
                    <span className="flex w-full items-baseline justify-between gap-1">
                      <span className="flex min-w-0 items-baseline gap-1">
                        <span
                          className="shrink-0 px-[5px] py-[1px] text-[11px] font-semibold leading-[1.4]"
                          style={{
                            border: 'var(--hair) solid color-mix(in srgb, var(--line) 75%, transparent)',
                            color: 'color-mix(in srgb, var(--ink) 84%, transparent)',
                          }}
                        >
                          {deduction.clauseRef}
                        </span>
                        <span className="truncate text-[14px] font-medium ink-body group-hover:underline group-hover:underline-offset-4">
                          {STAGE_LABELS[deduction.stage]}
                        </span>
                      </span>
                      <span className="label-line shrink-0 tabular-nums" data-figure>
                        {formatDeduction(deduction.amountPaise)}
                      </span>
                    </span>

                    {/* The slice this clause took, falling off the right-hand end. */}
                    <span className="relative block h-[10px] w-full">
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0"
                        style={{
                          width: `${Math.max(band.left, 0)}%`,
                          borderBottom: 'var(--hair) solid color-mix(in srgb, var(--line) 50%, transparent)',
                        }}
                      />
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-y-0"
                        animate={{ left: `${Math.max(band.left, 0)}%`, width: `${band.width}%` }}
                        transition={barTransition}
                        style={{
                          minWidth: '3px',
                          background: 'var(--band)',
                          borderLeft: 'var(--hair) solid color-mix(in srgb, var(--line) 70%, transparent)',
                        }}
                      />
                    </span>
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      key="panel"
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.3, ease }}
                      className="overflow-hidden"
                    >
                      <ClauseCard
                        deduction={deduction}
                        policyId={policy.id}
                        exemptionQuote={exemptionQuoteFor(policy, deduction.clauseId)}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>

        {verdict.deductions.length === 0 ? (
          <li className="hair-t py-2">
            <p className="text-[14px] leading-[1.6] ink-body measure">
              Not one clause in {policy.name} reduces this claim. The bill is admissible in full.
            </p>
          </li>
        ) : null}
      </ol>

      {/* What survives. */}
      <div className="hair-t mt-1 pt-2">
        <div className="flex items-baseline justify-between gap-1">
          <span className="eyebrow">{nothingPayable ? 'Payable' : 'Payable by the policy'}</span>
          <span className="text-[12px] ink-muted">
            {claimed > 0 ? `${Math.round(paidPercent)}% of the bill` : 'no bill entered'}
          </span>
        </div>

        {/*
          Three-step money scale. A full or partial figure is amber, the colour
          of everything that survives. A nil figure is paprika, with an outlined
          rule where the bar would be. The colour is never the message: a nil
          claim also names the clause that blocked it, immediately below.
        */}
        <div className="mt-1">
          <Figure
            paise={verdict.paidPaise}
            className="display block text-[clamp(44px,13vw,84px)] leading-[0.95]"
            reserve={reserve}
            duration={0.55}
            style={{ color: nothingPayable ? 'var(--alert)' : 'var(--paid-full)' }}
          />
        </div>

        <div className="mt-1 h-[16px] w-full" style={{ background: 'transparent' }}>
          {nothingPayable ? (
            <div
              className="h-full w-full"
              style={{
                border: 'var(--hair) solid var(--alert-fill)',
                background: 'var(--ground)',
              }}
            />
          ) : (
            <motion.div
              className="h-full"
              animate={{ width: `${Math.max(paidPercent, 0.5)}%` }}
              transition={barTransition}
              style={{ background: 'var(--paid-fill)' }}
            />
          )}
        </div>

        {verdict.block ? (
          <div
            className="mt-2 pl-2"
            style={{ borderLeft: '2px solid var(--alert)' }}
          >
            <p className="flex flex-wrap items-baseline gap-1">
              <span
                className="px-[5px] py-[1px] text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.08em]"
                style={{ background: 'var(--alert-fill)', color: 'var(--ground)' }}
              >
                Not admissible
              </span>
              <span className="text-[12px] ink-muted">clause {verdict.block.clauseRef}</span>
            </p>
            <p className="mt-1 text-[14px] leading-[1.65] ink-body measure">
              {verdict.block.humanReason}
            </p>
          </div>
        ) : null}

        <p className="mt-2 text-[12px] leading-[1.6] ink-muted measure">{DISCLAIMER_ESTIMATE}</p>
      </div>

      {/* The same figures, for anyone reading this with sound rather than eyes. */}
      <p className="sr-only" aria-live="polite">
        {formatPaise(verdict.claimedPaise)} claimed. {verdict.deductions.length} deductions.{' '}
        {formatPaise(verdict.paidPaise)} payable.
      </p>
    </section>
  );
}
