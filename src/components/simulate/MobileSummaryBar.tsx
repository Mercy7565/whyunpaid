'use client';

import { Figure, reserveFor } from '@/components/money/Figure';
import { formatPaise } from '@/vm/format';
import type { Verdict } from '@/vm/types';

/**
 * The payable figure, pinned to the bottom of a phone.
 *
 * On a narrow screen the controls sit above the waterfall, which would mean
 * dragging a slider while the only number that matters is off the screen. This
 * bar keeps it in view for the whole drag, and doubles as the way down to the
 * clauses that explain it.
 */
export function MobileSummaryBar({
  verdict,
  maxBillPaise,
  onJump,
}: {
  verdict: Verdict;
  maxBillPaise: bigint;
  onJump: () => void;
}) {
  const claimed = Number(verdict.claimedPaise);
  const paidPercent = claimed > 0 ? (Number(verdict.paidPaise) / claimed) * 100 : 0;
  const nothingPayable = verdict.paidPaise === 0n;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
      style={{ background: 'var(--ground)' }}
      data-print="hide"
    >
      <div
        className="h-[3px] w-full"
        aria-hidden="true"
        style={{ background: 'color-mix(in srgb, var(--line) 40%, transparent)' }}
      >
        <div
          className="h-full transition-[width] duration-300"
          style={{
            width: `${Math.max(paidPercent, nothingPayable ? 0 : 0.5)}%`,
            background: 'var(--paid-full)',
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-1 px-2 py-1 pb-[max(8px,env(safe-area-inset-bottom))]">
        <div className="min-w-0">
          <p className="eyebrow">Payable</p>
          <Figure
            paise={verdict.paidPaise}
            className="display block text-[26px] leading-[1.05] ink-strong"
            reserve={reserveFor(maxBillPaise)}
          />
        </div>
        <button
          type="button"
          onClick={onJump}
          className="hair shrink-0 px-1 py-[6px] text-[13px] font-medium ink-body"
        >
          {verdict.deductions.length === 0
            ? 'Nothing deducted'
            : `${verdict.deductions.length} ${verdict.deductions.length === 1 ? 'clause' : 'clauses'}`}
          <span className="ml-1 ink-muted" aria-hidden="true">
            &darr;
          </span>
          <span className="sr-only">
            took {formatPaise(verdict.claimedPaise - verdict.paidPaise)}. Jump to the waterfall.
          </span>
        </button>
      </div>
    </div>
  );
}
