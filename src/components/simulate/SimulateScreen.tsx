'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CommandPalette } from '@/components/CommandPalette';
import { ContestabilityPanel } from '@/components/ContestabilityPanel';
import { BillBreakdown } from '@/components/simulate/BillBreakdown';
import { HowItWorks } from '@/components/simulate/HowItWorks';
import { MobileSummaryBar } from '@/components/simulate/MobileSummaryBar';
import { Segmented } from '@/components/controls/Segmented';
import { Select } from '@/components/controls/Select';
import { Slider } from '@/components/controls/Slider';
import { Switch } from '@/components/controls/Switch';
import { Waterfall } from '@/components/waterfall/Waterfall';
import { TAGLINE } from '@/lib/copy';
import {
  BILL_MAX,
  BILL_MIN,
  BILL_STEP,
  DEFAULT_SCENARIO,
  MONTHS_MAX,
  MONTHS_MIN,
  POLICY_OPTIONS,
  type Scenario,
  clampBill,
  clampMonths,
  scenarioFromParams,
  scenarioToQuery,
} from '@/lib/scenario';
import { buildClaim } from '@/claims/buildClaim';
import { getPolicy } from '@/policies';
import { evaluate } from '@/vm/evaluate';
import { formatPaise } from '@/vm/format';
import { PROCEDURE_LABELS } from '@/vm/labels';
import { PROCEDURE_CODES, type ProcedureCode } from '@/vm/types';

const PROCEDURE_OPTIONS = PROCEDURE_CODES.map((code) => ({
  value: code,
  label: PROCEDURE_LABELS[code],
}));

const BILL_TICKS = [
  { value: BILL_MIN, label: '10k' },
  { value: 500_000, label: '5L' },
  { value: 1_000_000, label: '10L' },
  { value: 2_000_000, label: '20L' },
] as const;

const MONTH_TICKS = [
  { value: 0, label: 'day one' },
  { value: 24, label: '2 yr' },
  { value: 48, label: '4 yr' },
  { value: 60, label: '5 yr' },
  { value: 84, label: '7 yr' },
] as const;

export function SimulateScreen() {
  const searchParams = useSearchParams();
  const [scenario, setScenario] = useState<Scenario>(() => scenarioFromParams(searchParams));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const verdictRef = useRef<HTMLDivElement>(null);

  /*
   * The URL is written with the History API rather than the router: a slider
   * drag would otherwise push a navigation per frame. The address bar stays
   * shareable; nothing re-renders that did not have to.
   */
  const apply = useCallback((next: Scenario) => {
    setScenario(next);
    if (typeof window !== 'undefined') {
      const query = scenarioToQuery(next);
      window.history.replaceState(null, '', `${window.location.pathname}${query}`);
    }
  }, []);

  const patch = useCallback(
    (fields: Partial<Scenario>) => apply({ ...scenario, ...fields }),
    [apply, scenario],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const policy = useMemo(() => getPolicy(scenario.policyId), [scenario.policyId]);

  const { verdict, claim, days } = useMemo(() => {
    const built = buildClaim({
      procedure: scenario.procedure,
      billPaise: BigInt(scenario.billRupees) * 100n,
      monthsSinceInception: scenario.months,
      preExisting: scenario.preExisting,
    });
    return {
      verdict: evaluate(policy, built.claim, built.claim.admissionDate),
      claim: built.claim,
      days: built.days,
    };
  }, [policy, scenario.procedure, scenario.billRupees, scenario.months, scenario.preExisting]);

  const copyLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}${scenarioToQuery(scenario)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      /* Clipboard refused; the address bar already holds the same link. */
      setCopied(false);
    }
  }, [scenario]);

  const years = Math.floor(scenario.months / 12);
  const monthsPart = scenario.months % 12;
  const coverPhrase =
    scenario.months === 0
      ? 'the day cover began'
      : `${years > 0 ? `${years} ${years === 1 ? 'year' : 'years'}` : ''}${years > 0 && monthsPart > 0 ? ' ' : ''}${monthsPart > 0 ? `${monthsPart} ${monthsPart === 1 ? 'month' : 'months'}` : ''} into the cover`;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 pb-[104px] pt-3 sm:px-4 md:pb-6">
      <header className="mb-3 flex flex-col gap-2 sm:mb-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="eyebrow">Simulate</p>
            <h1 className="display mt-1 text-[clamp(26px,5.6vw,44px)] leading-[1.02] ink-strong">
              Run a hospitalisation
              <br />
              through a policy.
            </h1>
            <p className="mt-1 text-[15px] leading-[1.6] ink-body measure">{TAGLINE}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hair pressable px-1 py-[6px] text-[13px] font-medium ink-body transition-colors hover:ink-strong"
            >
              Scenarios
              <kbd
                className="ml-1 text-[11px] font-normal ink-muted"
                aria-label="keyboard shortcut Command or Control K"
              >
                &#8984;K
              </kbd>
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="hair pressable px-1 py-[6px] text-[13px] font-medium ink-body transition-colors hover:ink-strong"
            >
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-[298px_minmax(0,1fr)] md:gap-4 lg:grid-cols-[336px_minmax(0,1fr)] lg:gap-6">
        {/* Controls */}
        <aside className="flex flex-col gap-3 md:sticky md:top-[64px] md:self-start">
          <Segmented
            legend="Specimen policy"
            value={scenario.policyId}
            onChange={(policyId) => patch({ policyId })}
            options={POLICY_OPTIONS.map((option) => ({
              value: option.id,
              label: option.short,
              description: `${option.name}: ${option.summary}`,
            }))}
          />

          <p className="text-[13px] leading-[1.6] ink-muted measure">
            <span className="ink-body">{policy.name}.</span> {policy.summary}
          </p>

          <Select
            label="Procedure"
            value={scenario.procedure}
            options={PROCEDURE_OPTIONS}
            onChange={(procedure: ProcedureCode) => patch({ procedure })}
            hint={`Modelled as a ${days}-${days === 1 ? 'day' : 'day'} admission.`}
          />

          <div className="flex flex-col gap-1">
            <Slider
              label="Hospital bill"
              value={scenario.billRupees}
              display={formatPaise(BigInt(scenario.billRupees) * 100n)}
              valueText={`${formatPaise(BigInt(scenario.billRupees) * 100n)} hospital bill`}
              min={BILL_MIN}
              max={BILL_MAX}
              step={BILL_STEP}
              ticks={BILL_TICKS}
              onChange={(billRupees) => patch({ billRupees: clampBill(billRupees) })}
            />
            <label className="flex items-center gap-1 text-[12px] ink-muted">
              <span>Or type it</span>
              <input
                type="number"
                inputMode="numeric"
                min={BILL_MIN}
                max={BILL_MAX}
                step={1_000}
                value={scenario.billRupees}
                aria-label="Hospital bill in rupees"
                onChange={(event) => patch({ billRupees: clampBill(Number(event.target.value)) })}
                className="w-[120px] hair bg-transparent px-1 py-[4px] text-[13px] ink-strong"
              />
            </label>
          </div>

          <Slider
            label="Months since inception"
            value={scenario.months}
            display={`${scenario.months} mo`}
            valueText={`${scenario.months} months of continuous cover, ${coverPhrase}`}
            min={MONTHS_MIN}
            max={MONTHS_MAX}
            step={1}
            ticks={MONTH_TICKS}
            onChange={(months) => patch({ months: clampMonths(months) })}
            hint={`Admission ${coverPhrase}, on ${claim.admissionDate}.`}
          />

          <Switch
            label="Arises from a pre-existing condition"
            checked={scenario.preExisting}
            onChange={(preExisting) => patch({ preExisting })}
            hint="Brings the pre-existing disease waiting period into play."
          />

          <div className="flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={() => apply(DEFAULT_SCENARIO)}
              className="text-[13px] underline underline-offset-4 ink-muted transition-colors hover:ink-body"
            >
              Reset to the opening scenario
            </button>
            <Link
              href="/compile"
              className="text-[13px] underline underline-offset-4"
              style={{ color: 'var(--accent)' }}
            >
              Or compile a policy you actually hold
            </Link>
          </div>
        </aside>

        {/* The verdict */}
        <div ref={verdictRef} className="flex flex-col gap-4 scroll-mt-[72px]">
          <Waterfall
            verdict={verdict}
            policy={policy}
            maxBillPaise={BigInt(BILL_MAX) * 100n}
          />
          <BillBreakdown claim={claim} days={days} />
          <ContestabilityPanel contestability={verdict.contestability} />
        </div>
      </div>

      <HowItWorks />

      <MobileSummaryBar
        verdict={verdict}
        maxBillPaise={BigInt(BILL_MAX) * 100n}
        onJump={() => verdictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onPick={(picked) => {
          apply(picked);
          setPaletteOpen(false);
        }}
      />
    </div>
  );
}
