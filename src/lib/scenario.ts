/**
 * A scenario is five numbers, and the URL holds all five.
 *
 * Every state the simulator can be in is addressable, so a scenario can be
 * sent to someone and arrive looking exactly as it left. Parsing is total: a
 * malformed or hostile query string produces the default scenario rather than
 * an error page, because a broken link should still show someone the product.
 */

import { DEFAULT_POLICY_ID, POLICIES, findPolicy } from '@/policies';
import { PROCEDURE_CODES } from '@/vm/types';
import type { ProcedureCode } from '@/vm/types';

export type Scenario = {
  policyId: string;
  procedure: ProcedureCode;
  billRupees: number;
  months: number;
  preExisting: boolean;
};

export const BILL_MIN = 10_000;
export const BILL_MAX = 2_500_000;
export const BILL_STEP = 5_000;

export const MONTHS_MIN = 0;
export const MONTHS_MAX = 84;

export const DEFAULT_SCENARIO: Scenario = {
  policyId: DEFAULT_POLICY_ID,
  procedure: 'kneeReplacement',
  billRupees: 400_000,
  months: 42,
  preExisting: false,
};

export function clampBill(rupees: number): number {
  if (!Number.isFinite(rupees)) return DEFAULT_SCENARIO.billRupees;
  const rounded = Math.round(rupees);
  return Math.min(BILL_MAX, Math.max(BILL_MIN, rounded));
}

export function clampMonths(months: number): number {
  if (!Number.isFinite(months)) return DEFAULT_SCENARIO.months;
  return Math.min(MONTHS_MAX, Math.max(MONTHS_MIN, Math.round(months)));
}

function isProcedure(value: string | null): value is ProcedureCode {
  return value !== null && (PROCEDURE_CODES as readonly string[]).includes(value);
}

type ParamsLike = { get(key: string): string | null };

export function scenarioFromParams(params: ParamsLike): Scenario {
  const policyId = findPolicy(params.get('p'))?.id ?? DEFAULT_SCENARIO.policyId;
  const rawProcedure = params.get('proc');
  const procedure = isProcedure(rawProcedure) ? rawProcedure : DEFAULT_SCENARIO.procedure;
  const billRaw = Number(params.get('bill'));
  const monthsRaw = Number(params.get('m'));
  const ped = params.get('ped');

  return {
    policyId,
    procedure,
    billRupees: params.get('bill') === null ? DEFAULT_SCENARIO.billRupees : clampBill(billRaw),
    months: params.get('m') === null ? DEFAULT_SCENARIO.months : clampMonths(monthsRaw),
    preExisting: ped === '1' || ped === 'true',
  };
}

/** Only the fields that differ from the default are written, so links stay short. */
export function scenarioToQuery(scenario: Scenario): string {
  const params = new URLSearchParams();
  if (scenario.policyId !== DEFAULT_SCENARIO.policyId) params.set('p', scenario.policyId);
  if (scenario.procedure !== DEFAULT_SCENARIO.procedure) params.set('proc', scenario.procedure);
  if (scenario.billRupees !== DEFAULT_SCENARIO.billRupees) {
    params.set('bill', String(scenario.billRupees));
  }
  if (scenario.months !== DEFAULT_SCENARIO.months) params.set('m', String(scenario.months));
  if (scenario.preExisting) params.set('ped', '1');
  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
}

export function scenariosEqual(a: Scenario, b: Scenario): boolean {
  return (
    a.policyId === b.policyId &&
    a.procedure === b.procedure &&
    a.billRupees === b.billRupees &&
    a.months === b.months &&
    a.preExisting === b.preExisting
  );
}

/* -------------------------------------------------------------------------- */
/* Presets                                                                    */
/* -------------------------------------------------------------------------- */

export type Preset = {
  id: string;
  title: string;
  note: string;
  scenario: Scenario;
};

/**
 * The scenarios worth showing someone who has never seen a policy run.
 * Each one exists to make a different clause visible.
 */
export const PRESETS: readonly Preset[] = [
  {
    id: 'room-you-did-not-choose',
    title: 'The room you did not choose',
    note: 'Four lakh, a room at nine thousand a night, four clauses in the gap.',
    scenario: { ...DEFAULT_SCENARIO },
  },
  {
    id: 'eleven-months-early',
    title: 'Eleven months too early',
    note: 'The same admission, inside the twenty-four month wait for the procedure.',
    scenario: { ...DEFAULT_SCENARIO, months: 18 },
  },
  {
    id: 'ped-just-short',
    title: 'Pre-existing, one month short',
    note: 'Thirty-five months of cover against a thirty-six month wait.',
    scenario: {
      policyId: 'specimen-a',
      procedure: 'angioplasty',
      billRupees: 350_000,
      months: 35,
      preExisting: true,
    },
  },
  {
    id: 'ped-just-past',
    title: 'Pre-existing, one month past',
    note: 'The same claim, one month later. The whole waterfall runs.',
    scenario: {
      policyId: 'specimen-a',
      procedure: 'angioplasty',
      billRupees: 350_000,
      months: 37,
      preExisting: true,
    },
  },
  {
    id: 'excluded-outright',
    title: 'Excluded outright',
    note: 'A permanent exclusion does not expire, however long the cover has run.',
    scenario: {
      policyId: 'specimen-a',
      procedure: 'cosmeticSurgery',
      billRupees: 200_000,
      months: 72,
      preExisting: false,
    },
  },
  {
    id: 'cataract-capped',
    title: 'Cataract, met by its ceiling',
    note: 'A sub-limit doing almost all of the work on a small bill.',
    scenario: {
      policyId: 'specimen-a',
      procedure: 'cataract',
      billRupees: 110_000,
      months: 30,
      preExisting: false,
    },
  },
  {
    id: 'deductible-instead',
    title: 'A deductible instead of a share',
    note: 'The same admission on Specimen B, which takes a flat amount rather than a percentage.',
    scenario: {
      policyId: 'specimen-b',
      procedure: 'kneeReplacement',
      billRupees: 400_000,
      months: 42,
      preExisting: false,
    },
  },
  {
    id: 'senior-share',
    title: 'Senior plan, thirty per cent share',
    note: 'A bypass on Specimen C, where the co-payment is the largest single deduction.',
    scenario: {
      policyId: 'specimen-c',
      procedure: 'cabg',
      billRupees: 600_000,
      months: 60,
      preExisting: false,
    },
  },
  {
    id: 'sum-insured-reached',
    title: 'Past the sum insured',
    note: 'A twelve lakh bill against three lakh of cover.',
    scenario: {
      policyId: 'specimen-c',
      procedure: 'cabg',
      billRupees: 1_200_000,
      months: 60,
      preExisting: false,
    },
  },
  {
    id: 'no-caps-at-all',
    title: 'No caps at all',
    note: 'Specimen D has no room limit and no sub-limit, so only the deductible bites.',
    scenario: {
      policyId: 'specimen-d',
      procedure: 'kneeReplacement',
      billRupees: 400_000,
      months: 42,
      preExisting: false,
    },
  },
  {
    id: 'past-the-moratorium',
    title: 'Past the moratorium',
    note: 'Sixty-one months in. Contestability changes; not one rupee does.',
    scenario: { ...DEFAULT_SCENARIO, months: 61 },
  },
  {
    id: 'dialysis-consumables',
    title: 'Dialysis, mostly consumables',
    note: 'A bill made of the heads a room rent proportion may not touch.',
    scenario: {
      policyId: 'specimen-a',
      procedure: 'dialysis',
      billRupees: 85_000,
      months: 48,
      preExisting: false,
    },
  },
];

export const POLICY_OPTIONS = POLICIES.map((policy) => ({
  id: policy.id,
  /** "Specimen Floater A" abbreviates to "A" on the segmented control. */
  short: policy.name.replace('Specimen Floater ', ''),
  name: policy.name,
  summary: policy.summary,
}));
