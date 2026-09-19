'use client';

import { useId, useState } from 'react';
import { formatPaise } from '@/vm/format';
import { CATEGORY_LABELS } from '@/vm/labels';
import { sumPaise } from '@/vm/money';
import type { Claim } from '@/vm/types';

/**
 * The bill the simulator built, head by head.
 *
 * Shown because the waterfall makes claims about a room at nine thousand a
 * night and about which heads a proportion may touch, and a reader should be
 * able to check both against the bill rather than take them on trust.
 */
export function BillBreakdown({ claim, days }: { claim: Claim; days: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const total = sumPaise(claim.lines.map((line) => line.amountPaise));

  return (
    <section className="hair-t pt-2">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-baseline justify-between gap-1 py-[6px] text-left"
        >
          <span className="text-[14px] font-medium ink-body">
            The bill, head by head
            <span className="ml-1 text-[12px] ink-muted">
              {claim.lines.length} lines &middot; {days} {days === 1 ? 'day' : 'days'}
            </span>
          </span>
          <span className="text-[12px] ink-muted" aria-hidden="true">
            {open ? 'Hide' : 'Show'}
          </span>
        </button>
      </h2>

      {open ? (
        <div id={id}>
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">
              The simulated hospital bill, by head of expense
            </caption>
            <tbody>
              {claim.lines.map((line) => (
                <tr key={line.id} className="hair-t">
                  <th scope="row" className="py-[6px] pr-1 text-left font-normal ink-body">
                    {line.label === CATEGORY_LABELS[line.category]
                      ? line.label
                      : `${CATEGORY_LABELS[line.category]} · ${line.label}`}
                  </th>
                  <td className="py-[6px] pl-1 text-right ink-strong" data-figure>
                    {formatPaise(line.amountPaise)}
                  </td>
                </tr>
              ))}
              <tr className="hair-t">
                <th scope="row" className="py-[6px] pr-1 text-left text-[13px] font-medium ink-strong">
                  Total
                </th>
                <td className="py-[6px] pl-1 text-right font-medium ink-strong" data-figure>
                  {formatPaise(total)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-[12px] leading-[1.6] ink-muted measure">
            A real bill is never this tidy. The split between heads is a fixed profile for the
            procedure, so that the arithmetic on every clause card can be checked line by line.
          </p>
        </div>
      ) : null}
    </section>
  );
}
