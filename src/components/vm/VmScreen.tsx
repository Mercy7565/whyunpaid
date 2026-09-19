'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Segmented } from '@/components/controls/Segmented';
import { ClauseTree } from '@/components/vm/ClauseTree';
import { PolicyPdfViewer } from '@/components/vm/PolicyPdfViewer';
import { TestSummary } from '@/components/vm/TestSummary';
import { MORATORIUM_NOTE } from '@/lib/copy';
import { POLICY_OPTIONS } from '@/lib/scenario';
import { getPolicy } from '@/policies';
import { STAGE_LABELS } from '@/vm/labels';
import { ORDER_TABLE, OUT_OF_PIPELINE } from '@/vm/orderTable';
import { clausesInReadingOrder } from '@/vm/selectors';

/**
 * The inspector.
 *
 * Three claims are made elsewhere in this product: that the policy is compiled
 * rather than paraphrased, that the order of evaluation is fixed, and that the
 * whole thing is tested. This page is where each of those is put where it can
 * be checked. The engine has a name here and nowhere else: PolicyVM.
 */
export function VmScreen() {
  const searchParams = useSearchParams();
  const [policyId, setPolicyId] = useState(
    () => getPolicy(searchParams.get('policy')).id,
  );
  const [clauseId, setClauseId] = useState<string | null>(() => searchParams.get('clause'));

  const policy = useMemo(() => getPolicy(policyId), [policyId]);

  const selected = useMemo(() => {
    const clauses = clausesInReadingOrder(policy);
    return clauses.find((clause) => clause.id === clauseId) ?? clauses[0] ?? null;
  }, [clauseId, policy]);

  const pick = useCallback((id: string) => {
    setClauseId(id);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('clause', id);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, []);

  const changePolicy = useCallback((id: string) => {
    setPolicyId(id);
    setClauseId(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${window.location.pathname}?policy=${id}`);
    }
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 pb-6 pt-3 sm:px-4">
      <header className="mb-4 flex flex-col gap-1">
        <p className="eyebrow">PolicyVM &middot; inspector</p>
        <h1 className="display text-[clamp(26px,5.6vw,44px)] leading-[1.02] ink-strong">
          The thing that
          <br />
          is actually running.
        </h1>
        <p className="mt-1 text-[15px] leading-[1.6] ink-body measure">
          A compiled policy, the fixed order it is evaluated in, and the test run that holds both in
          place. Every clause below carries the words it was compiled from; select one to see them
          highlighted in the specimen wording.
        </p>
      </header>

      <div className="mb-3 max-w-[420px]">
        <Segmented
          legend="Specimen policy"
          value={policyId}
          onChange={changePolicy}
          options={POLICY_OPTIONS.map((option) => ({
            value: option.id,
            label: option.short,
            description: `${option.name}: ${option.summary}`,
          }))}
        />
      </div>
      <p className="mb-2 text-[13px] leading-[1.6] ink-muted measure">
        <span className="ink-body">{policy.name}.</span> {policy.shape}
      </p>
      <p className="mb-4 text-[13px]">
        <Link
          href="/compile"
          className="underline underline-offset-4"
          style={{ color: 'var(--paid-full)' }}
        >
          Compile a policy of your own
        </Link>
        <span className="ml-1 ink-muted">
          &mdash; read in your browser, confirmed clause by clause, no key required.
        </span>
      </p>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-4 lg:gap-6">
        <ClauseTree policy={policy} selectedId={selected?.id ?? null} onSelect={pick} />

        <div className="md:sticky md:top-[64px] md:self-start">
          {selected ? (
            <PolicyPdfViewer
              key={`${policy.slug}-${selected.id}`}
              slug={policy.slug}
              charStart={selected.provenance.charStart}
              charEnd={selected.provenance.charEnd}
              quote={selected.provenance.sourceQuote}
              clauseRef={selected.ref}
            />
          ) : (
            <p className="text-[14px] ink-muted">Select a clause to see it in the wording.</p>
          )}
        </div>
      </div>

      {/* The order */}
      <section aria-labelledby="order-title" className="mt-6 hair-t pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h2 id="order-title" className="text-[15px] font-medium ink-strong">
            The evaluation order
          </h2>
          <span className="eyebrow">fixed, documented and tested</span>
        </div>
        <p className="mt-1 text-[14px] leading-[1.65] ink-body measure">
          A claim enters as bill lines and leaves as one payable figure. Every rupee that disappears
          between the two is attributed to exactly one clause, and the attributions sum, exactly, to
          the gap.
        </p>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <caption className="sr-only">
              The eight stages of evaluation, in the order they run
            </caption>
            <thead>
              <tr>
                <th scope="col" className="eyebrow pb-1 pr-1 text-left font-semibold">
                  #
                </th>
                <th scope="col" className="eyebrow pb-1 pr-1 text-left font-semibold">
                  Stage
                </th>
                <th scope="col" className="eyebrow pb-1 pr-1 text-left font-semibold">
                  Clause kind
                </th>
                <th scope="col" className="eyebrow pb-1 pr-1 text-left font-semibold">
                  Operates on
                </th>
                <th scope="col" className="eyebrow pb-1 text-left font-semibold">
                  Effect
                </th>
              </tr>
            </thead>
            <tbody>
              {ORDER_TABLE.map((row) => (
                <tr key={row.stage} className="hair-t align-top">
                  <td className="py-1 pr-1 ink-muted" data-figure>
                    {row.order}
                  </td>
                  <th scope="row" className="py-1 pr-1 text-left font-medium ink-strong">
                    {STAGE_LABELS[row.stage]}
                    {row.shortCircuits ? (
                      <span className="ml-1 text-[11px] font-normal ink-muted">
                        short-circuits
                      </span>
                    ) : null}
                  </th>
                  <td className="py-1 pr-1">
                    <code className="text-[12px] ink-body">{row.clauseKind}</code>
                  </td>
                  <td className="py-1 pr-1 ink-muted">{row.operatesOn}</td>
                  <td className="py-1 ink-body">{row.effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* The clause that is deliberately not a stage */}
      <section aria-labelledby="moratorium-title" className="mt-4 panel px-2 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h2 id="moratorium-title" className="text-[15px] font-medium ink-strong">
            {OUT_OF_PIPELINE.title}, and why it is not stage nine
          </h2>
          <span className="eyebrow">
            <code className="text-[11px]">{OUT_OF_PIPELINE.clauseKind}</code> &middot; reported as{' '}
            {OUT_OF_PIPELINE.reportedAs}
          </span>
        </div>
        <p className="mt-1 text-[14px] leading-[1.65] ink-body measure">{MORATORIUM_NOTE}</p>
        <p className="mt-1 text-[14px] leading-[1.65] ink-muted measure">
          {OUT_OF_PIPELINE.because}
        </p>
        <p className="mt-1 text-[13px] leading-[1.6] ink-muted measure">
          Two tests hold this boundary: one asserts that crossing month sixty changes
          contestability, and one asserts that it changes nothing in the waterfall, deduction for
          deduction.
        </p>
      </section>

      <div className="mt-6 hair-t pt-3">
        <TestSummary />
      </div>
    </div>
  );
}
