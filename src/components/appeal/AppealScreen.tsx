'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { AppealLetter } from '@/components/appeal/AppealLetter';
import { ContradictionList } from '@/components/appeal/ContradictionList';
import { GroundCard } from '@/components/appeal/GroundCard';
import { LetterInput } from '@/components/appeal/LetterInput';
import { ContestabilityPanel } from '@/components/ContestabilityPanel';
import { Segmented } from '@/components/controls/Segmented';
import { Select } from '@/components/controls/Select';
import { Slider } from '@/components/controls/Slider';
import { Switch } from '@/components/controls/Switch';
import { Waterfall } from '@/components/waterfall/Waterfall';
import { DISCLAIMER_ESTIMATE } from '@/lib/copy';
import { BILL_MAX, BILL_MIN, BILL_STEP, MONTHS_MAX, MONTHS_MIN, POLICY_OPTIONS, clampBill, clampMonths } from '@/lib/scenario';
import { DEFAULT_SAMPLE_ID, LETTER_SAMPLES, findSample, type LetterSample } from '@/letter/samples';
import { review } from '@/letter';
import type { GroundKind } from '@/letter/grounds';
import { formatPaise } from '@/vm/format';
import { PROCEDURE_LABELS } from '@/vm/labels';
import { PROCEDURE_CODES, type ProcedureCode } from '@/vm/types';

const PROCEDURE_OPTIONS = PROCEDURE_CODES.map((code) => ({
  value: code,
  label: PROCEDURE_LABELS[code],
}));

type Context = {
  policyId: string;
  procedure: ProcedureCode;
  billRupees: number;
  months: number;
  preExisting: boolean;
  insurerPaidRupees: number;
};

function contextOf(sample: LetterSample): Context {
  return { ...sample.context };
}

export function AppealScreen() {
  const searchParams = useSearchParams();
  const initialSample = findSample(searchParams.get('sample')) ?? findSample(DEFAULT_SAMPLE_ID);

  const [letterText, setLetterText] = useState(initialSample?.text ?? '');
  const [sampleId, setSampleId] = useState<string | null>(initialSample?.id ?? null);
  const [context, setContext] = useState<Context>(
    initialSample
      ? contextOf(initialSample)
      : {
          policyId: 'specimen-a',
          procedure: 'kneeReplacement',
          billRupees: 400_000,
          months: 42,
          preExisting: false,
          insurerPaidRupees: 0,
        },
  );
  const [override, setOverride] = useState<GroundKind | null | undefined>(undefined);

  const result = useMemo(
    () =>
      review({
        letterText,
        ...context,
        ...(override !== undefined ? { groundOverride: override } : {}),
      }),
    [letterText, context, override],
  );

  const applySample = useCallback((sample: LetterSample) => {
    setLetterText(sample.text);
    setSampleId(sample.id);
    setContext(contextOf(sample));
    setOverride(undefined);
  }, []);

  const patch = useCallback((fields: Partial<Context>) => {
    setContext((current) => ({ ...current, ...fields }));
  }, []);

  const empty = letterText.trim().length === 0;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 pb-6 pt-3 sm:px-4">
      <header className="mb-4 flex flex-col gap-1" data-print="hide">
        <p className="eyebrow">Appeal</p>
        <h1 className="display text-[clamp(26px,5.6vw,44px)] leading-[1.02] ink-strong">
          Run the letter
          <br />
          against the policy.
        </h1>
        <p className="mt-1 text-[15px] leading-[1.6] ink-body measure">
          Paste the reason the insurer gave. The same claim is run through the compiled clause tree,
          and where the two disagree, that disagreement is the appeal.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-6">
        {/* Input */}
        <aside className="flex flex-col gap-3" data-print="hide">
          <LetterInput
            value={letterText}
            onChange={(value) => {
              setLetterText(value);
              setSampleId(null);
              setOverride(undefined);
            }}
            onSample={applySample}
            activeSampleId={sampleId}
          />

          <div className="hair-t pt-2">
            <p className="eyebrow mb-1">The claim behind the letter</p>

            <div className="flex flex-col gap-2">
              <Segmented
                legend="Specimen policy"
                value={context.policyId}
                onChange={(policyId) => patch({ policyId })}
                options={POLICY_OPTIONS.map((option) => ({
                  value: option.id,
                  label: option.short,
                  description: `${option.name}: ${option.summary}`,
                }))}
              />

              <Select
                label="Procedure"
                value={context.procedure}
                options={PROCEDURE_OPTIONS}
                onChange={(procedure: ProcedureCode) => patch({ procedure })}
              />

              <Slider
                label="Hospital bill"
                value={context.billRupees}
                display={formatPaise(BigInt(context.billRupees) * 100n)}
                min={BILL_MIN}
                max={BILL_MAX}
                step={BILL_STEP}
                onChange={(billRupees) => patch({ billRupees: clampBill(billRupees) })}
              />

              <Slider
                label="Months since inception"
                value={context.months}
                display={`${context.months} mo`}
                min={MONTHS_MIN}
                max={MONTHS_MAX}
                step={1}
                onChange={(months) => patch({ months: clampMonths(months) })}
                hint={`Admission on ${result.claim.admissionDate}.`}
              />

              <Slider
                label="Settled by the insurer"
                value={context.insurerPaidRupees}
                display={formatPaise(BigInt(context.insurerPaidRupees) * 100n)}
                min={0}
                max={BILL_MAX}
                step={BILL_STEP}
                onChange={(insurerPaidRupees) =>
                  patch({ insurerPaidRupees: Math.max(0, Math.round(insurerPaidRupees)) })
                }
                hint="Nil for a claim refused outright. Any shortfall against the wording is raised in the appeal."
              />

              <Switch
                label="Arises from a pre-existing condition"
                checked={context.preExisting}
                onChange={(preExisting) => patch({ preExisting })}
              />
            </div>
          </div>
        </aside>

        {/* Output */}
        <div className="flex flex-col gap-4">
          {empty ? (
            <section className="hair px-2 py-4" data-print="hide">
              <h2 className="display text-[22px] leading-[1.2] ink-strong">
                Nothing to run yet.
              </h2>
              <p className="mt-1 text-[14px] leading-[1.65] ink-body measure">
                Paste the reason from a rejection letter, or pick one of the {LETTER_SAMPLES.length}{' '}
                samples on the left. Each sample brings the claim it belongs to, so the comparison is
                complete without filling in a single field.
              </p>
              <p className="mt-2 text-[12px] leading-[1.6] ink-muted measure">
                {DISCLAIMER_ESTIMATE}
              </p>
            </section>
          ) : (
            <>
              <div data-print="hide">
                <GroundCard
                  detection={result.detection}
                  letterText={letterText}
                  ground={result.ground}
                  onOverride={(ground) => setOverride(ground)}
                  modelUnavailable
                />
              </div>

              <div className="hair-t pt-3" data-print="hide">
                <p className="eyebrow mb-2">The same claim, run through the wording</p>
                <Waterfall
                  verdict={result.verdict}
                  policy={result.policy}
                  maxBillPaise={BigInt(BILL_MAX) * 100n}
                />
              </div>

              <div className="hair-t pt-3" data-print="hide">
                <ContradictionList contradictions={result.contradictions} />
              </div>

              <div className="hair-t pt-3">
                <AppealLetter appeal={result.appeal} />
              </div>

              <div data-print="hide">
                <ContestabilityPanel contestability={result.verdict.contestability} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
