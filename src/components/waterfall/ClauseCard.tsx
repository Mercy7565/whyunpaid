'use client';

import Link from 'next/link';
import { CATEGORY_LABELS } from '@/vm/labels';
import { formatBps, formatDeduction, formatPaise } from '@/vm/format';
import type { Deduction, DeductionLine } from '@/vm/types';

/** A quoted fragment of the wording, with the reference it came from. */
export function Quote({ text, cite }: { text: string; cite: string }) {
  return (
    <figure className="m-0">
      <blockquote
        className="m-0 pl-2 text-[14px] leading-[1.6] ink-body italic"
        style={{ borderLeft: '2px solid color-mix(in srgb, var(--line) 85%, transparent)' }}
      >
        {text}
      </blockquote>
      <figcaption className="mt-1 pl-2 text-[12px] ink-muted not-italic">
        Specimen wording, clause {cite}
      </figcaption>
    </figure>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[6px] hair-t first:border-t-0">
      <dt className="text-[13px] ink-muted">{term}</dt>
      <dd className="m-0 text-[13px] ink-strong text-right" data-figure>
        {children}
      </dd>
    </div>
  );
}

function LineTable({
  lines,
  showAfter,
}: {
  lines: readonly DeductionLine[];
  showAfter: boolean;
}) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th scope="col" className="eyebrow pb-[6px] text-left font-semibold">
            Head
          </th>
          <th scope="col" className="eyebrow pb-[6px] text-right font-semibold">
            Billed
          </th>
          {showAfter ? (
            <th scope="col" className="eyebrow pb-[6px] text-right font-semibold">
              Payable
            </th>
          ) : null}
          <th scope="col" className="eyebrow pb-[6px] text-right font-semibold">
            Taken
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id} className="hair-t">
            <th scope="row" className="py-[6px] pr-1 text-left font-normal ink-body">
              {CATEGORY_LABELS[line.category]}
            </th>
            <td className="py-[6px] pl-1 text-right ink-muted" data-figure>
              {formatPaise(line.beforePaise)}
            </td>
            {showAfter ? (
              <td className="py-[6px] pl-1 text-right ink-strong" data-figure>
                {formatPaise(line.afterPaise)}
              </td>
            ) : null}
            <td className="py-[6px] pl-1 text-right" data-figure style={{ color: 'var(--line)' }}>
              <span className="text-[13px]">{formatDeduction(line.removedPaise)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The arithmetic behind one band, rendered from the basis the evaluator
 * recorded rather than recomputed here. Two places doing the same sum is two
 * places that can disagree about someone's money.
 */
function Arithmetic({ deduction }: { deduction: Deduction }) {
  const basis = deduction.basis;

  switch (basis.kind) {
    case 'wholeClaim':
      return (
        <dl className="m-0">
          <Row term="Claimed">{formatPaise(basis.claimedPaise)}</Row>
          {basis.monthsOfCover !== undefined && basis.monthsRequired !== undefined ? (
            <>
              <Row term="Cover at the date tested">{basis.monthsOfCover} months</Row>
              <Row term="Required by the clause">{basis.monthsRequired} months</Row>
            </>
          ) : null}
          <Row term="Admissible">{formatPaise(0n)}</Row>
        </dl>
      );

    case 'lines':
      return <LineTable lines={basis.lines} showAfter={false} />;

    case 'proportionate':
      return (
        <div className="flex flex-col gap-2">
          <dl className="m-0">
            <Row term="Eligible room rent">{formatPaise(basis.eligiblePerDayPaise)} a day</Row>
            <Row term="Room occupied">{formatPaise(basis.actualPerDayPaise)} a day</Row>
            <Row term="Payable share">
              {formatPaise(basis.eligiblePerDayPaise, { symbol: false })} &divide;{' '}
              {formatPaise(basis.actualPerDayPaise, { symbol: false })} ={' '}
              {formatBps(basis.payableBps)}
            </Row>
          </dl>
          <LineTable lines={basis.lines} showAfter />
          <dl className="m-0">
            <Row term="Associated heads before">{formatPaise(basis.associatedBeforePaise)}</Row>
            <Row term="Associated heads after">{formatPaise(basis.associatedAfterPaise)}</Row>
            <Row term="Exempt heads, untouched">{formatPaise(basis.exemptedPaise)}</Row>
          </dl>
          <p className="text-[13px] leading-[1.6] ink-body">
            The proportion was not applied to{' '}
            {basis.exemptCategories.map((c) => CATEGORY_LABELS[c].toLowerCase()).join(', ')}. The
            cost of those heads does not change with the category of room occupied, so{' '}
            <span data-figure>{formatPaise(basis.exemptedPaise)}</span> was left where it was.
          </p>
        </div>
      );

    case 'cap':
      return (
        <dl className="m-0">
          <Row term="Admissible before this clause">{formatPaise(basis.beforePaise)}</Row>
          <Row term="Ceiling">{formatPaise(basis.capPaise)}</Row>
          <Row term="Difference">{formatDeduction(deduction.amountPaise)}</Row>
        </dl>
      );

    case 'flat':
      return (
        <dl className="m-0">
          <Row term="Admissible before this clause">{formatPaise(basis.beforePaise)}</Row>
          <Row term="Stated in the schedule">{formatPaise(basis.statedPaise)}</Row>
          <Row term="Taken">{formatDeduction(deduction.amountPaise)}</Row>
        </dl>
      );

    case 'percent':
      return (
        <dl className="m-0">
          <Row term="Admissible before this clause">{formatPaise(basis.beforePaise)}</Row>
          <Row term="Share">{formatBps(basis.percentBps)}</Row>
          <Row term="Taken">{formatDeduction(deduction.amountPaise)}</Row>
        </dl>
      );
  }
}

export function ClauseCard({
  deduction,
  policyId,
  exemptionQuote,
}: {
  deduction: Deduction;
  policyId: string;
  exemptionQuote?: string;
}) {
  return (
    <div className="flex flex-col gap-2 px-1 pb-2 pt-1 sm:px-2">
      <p className="text-[14px] leading-[1.65] ink-body measure">{deduction.humanReason}</p>

      <Quote text={deduction.sourceQuote} cite={deduction.clauseRef} />
      {exemptionQuote ? <Quote text={exemptionQuote} cite={`${deduction.clauseRef}, exemption`} /> : null}

      <div className="panel px-1 py-1 sm:px-2">
        <p className="eyebrow mb-1">The arithmetic</p>
        <Arithmetic deduction={deduction} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/vm?policy=${policyId}&clause=${deduction.clauseId}`}
          className="text-[13px] font-medium underline underline-offset-4"
          style={{ color: 'var(--paid-full)' }}
        >
          Find this clause in the wording
        </Link>
        <span className="text-[12px] ink-muted">
          rule <code className="text-[12px]">{deduction.ruleId}</code>
        </span>
      </div>
    </div>
  );
}
