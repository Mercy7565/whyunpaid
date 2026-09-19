/**
 * Turning three slider positions into a hospital bill.
 *
 * This is claim *construction*, not evaluation, so it lives outside `src/vm/`.
 * It is still pure: no clock, no randomness, no network. The same inputs give
 * the same bill on every device, which is what makes a shared URL show the
 * reader exactly what the sender saw.
 *
 * The split between heads is a fixed profile per procedure. A real bill is
 * never this tidy, and the interface says so, but a demonstrable, reproducible
 * split is worth more here than a plausible random one: the reader can check
 * the arithmetic against the clause card line by line.
 */

import { addDays, addMonths } from '@/vm/dates';
import { mulDivRound, sumPaise } from '@/vm/money';
import type { Claim, ClaimLine, LineCategory, ProcedureCode } from '@/vm/types';
import { CATEGORY_LABELS } from '@/vm/labels';

/** Cover is taken to have incepted here, so the months slider has a fixed origin. */
export const SIMULATION_INCEPTION = '2019-04-01';

export type BillProfile = {
  /** Nights the procedure typically occupies. Drives the room rate per day. */
  days: number;
  /** Share of the bill by head, in basis points. Must total 10000. */
  weights: Partial<Record<LineCategory, number>>;
};

export const BILL_PROFILES: Readonly<Record<ProcedureCode, BillProfile>> = {
  kneeReplacement: {
    days: 5,
    weights: {
      room: 1_125,
      nursing: 500,
      surgeon: 2_250,
      anaesthetist: 700,
      operationTheatre: 900,
      pharmacy: 1_400,
      consumables: 600,
      implants: 1_900,
      diagnostics: 500,
      nonMedical: 125,
    },
  },
  cataract: {
    days: 1,
    weights: {
      room: 800,
      nursing: 300,
      surgeon: 3_000,
      anaesthetist: 600,
      operationTheatre: 1_200,
      pharmacy: 600,
      consumables: 500,
      implants: 2_400,
      diagnostics: 500,
      nonMedical: 100,
    },
  },
  angioplasty: {
    days: 3,
    weights: {
      room: 900,
      nursing: 400,
      surgeon: 1_800,
      anaesthetist: 400,
      operationTheatre: 1_000,
      pharmacy: 1_200,
      consumables: 600,
      implants: 2_700,
      diagnostics: 900,
      nonMedical: 100,
    },
  },
  cabg: {
    days: 7,
    weights: {
      room: 1_400,
      nursing: 800,
      surgeon: 2_000,
      anaesthetist: 700,
      operationTheatre: 1_200,
      pharmacy: 1_600,
      consumables: 800,
      implants: 600,
      diagnostics: 800,
      nonMedical: 100,
    },
  },
  herniaRepair: {
    days: 2,
    weights: {
      room: 1_200,
      nursing: 500,
      surgeon: 2_800,
      anaesthetist: 800,
      operationTheatre: 1_200,
      pharmacy: 1_200,
      consumables: 600,
      implants: 1_000,
      diagnostics: 600,
      nonMedical: 100,
    },
  },
  appendectomy: {
    days: 2,
    weights: {
      room: 1_300,
      nursing: 600,
      surgeon: 2_700,
      anaesthetist: 800,
      operationTheatre: 1_300,
      pharmacy: 1_400,
      consumables: 800,
      diagnostics: 1_000,
      nonMedical: 100,
    },
  },
  maternityDelivery: {
    days: 3,
    weights: {
      room: 2_000,
      nursing: 900,
      surgeon: 2_200,
      anaesthetist: 700,
      operationTheatre: 1_200,
      pharmacy: 1_400,
      consumables: 800,
      diagnostics: 700,
      nonMedical: 100,
    },
  },
  cosmeticSurgery: {
    days: 2,
    weights: {
      room: 1_200,
      nursing: 500,
      surgeon: 3_500,
      anaesthetist: 900,
      operationTheatre: 1_400,
      pharmacy: 1_000,
      consumables: 700,
      diagnostics: 700,
      nonMedical: 100,
    },
  },
  bariatricSurgery: {
    days: 3,
    weights: {
      room: 1_200,
      nursing: 600,
      surgeon: 2_400,
      anaesthetist: 700,
      operationTheatre: 1_200,
      pharmacy: 1_200,
      consumables: 900,
      implants: 1_200,
      diagnostics: 500,
      nonMedical: 100,
    },
  },
  dialysis: {
    days: 1,
    weights: {
      room: 1_000,
      nursing: 800,
      pharmacy: 3_000,
      consumables: 3_400,
      diagnostics: 1_700,
      nonMedical: 100,
    },
  },
};

/** The order heads appear on a bill, so two bills are always comparable. */
const CATEGORY_ORDER: readonly LineCategory[] = [
  'room',
  'nursing',
  'surgeon',
  'anaesthetist',
  'operationTheatre',
  'pharmacy',
  'consumables',
  'implants',
  'diagnostics',
  'ambulance',
  'nonMedical',
];

export type ScenarioInput = {
  procedure: ProcedureCode;
  billPaise: bigint;
  monthsSinceInception: number;
  preExisting: boolean;
};

export type BuiltClaim = {
  claim: Claim;
  days: number;
  roomPerDayPaise: bigint;
};

function lineLabel(category: LineCategory, days: number, perDayPaise: bigint): string {
  if (category !== 'room') return CATEGORY_LABELS[category];
  const rupees = perDayPaise / 100n;
  return `Room rent, ${days} ${days === 1 ? 'day' : 'days'} at ${rupees.toString()} a day`;
}

/**
 * Splits the bill across heads so the parts sum to the whole, exactly.
 *
 * Each head is rounded independently and the few paise the rounding leaves over
 * are settled on the largest head. A bill whose lines did not add up to the
 * total would break the one identity the verdict rests on before the evaluator
 * ever saw it.
 */
export function buildClaim(input: ScenarioInput): BuiltClaim {
  const profile = BILL_PROFILES[input.procedure];
  const total = input.billPaise;

  const heads = CATEGORY_ORDER.map((category) => ({
    category,
    weight: profile.weights[category] ?? 0,
  })).filter((head) => head.weight > 0);

  const amounts = heads.map((head) => mulDivRound(total, BigInt(head.weight), 10_000n));
  const allocated = sumPaise(amounts.map((a) => (a < 0n ? 0n : a)));
  const remainder = total - allocated;

  if (remainder !== 0n && amounts.length > 0) {
    let largest = 0;
    for (let i = 1; i < amounts.length; i += 1) {
      if ((amounts[i] ?? 0n) > (amounts[largest] ?? 0n)) largest = i;
    }
    const current = amounts[largest] ?? 0n;
    const adjusted = current + remainder;
    amounts[largest] = adjusted < 0n ? 0n : adjusted;
  }

  const admissionDate = addMonths(SIMULATION_INCEPTION, input.monthsSinceInception);
  const dischargeDate = addDays(admissionDate, Math.max(profile.days - 1, 0));

  const roomIndex = heads.findIndex((head) => head.category === 'room');
  const roomTotal = roomIndex >= 0 ? (amounts[roomIndex] ?? 0n) : 0n;
  const roomPerDayPaise = profile.days > 0 ? roomTotal / BigInt(profile.days) : 0n;

  const lines: ClaimLine[] = heads.map((head, index) => ({
    id: `line-${String(index).padStart(2, '0')}-${head.category}`,
    label: lineLabel(head.category, profile.days, roomPerDayPaise),
    category: head.category,
    amountPaise: amounts[index] ?? 0n,
  }));

  const claim: Claim = {
    id: `sim-${input.procedure}-${input.monthsSinceInception}`,
    policyInceptionDate: SIMULATION_INCEPTION,
    admissionDate,
    dischargeDate,
    procedure: input.procedure,
    arisesFromPreExistingCondition: input.preExisting,
    roomActualPerDayPaise: roomPerDayPaise,
    lines,
  };

  return { claim, days: profile.days, roomPerDayPaise };
}

/** A sanity check the tests use: every profile must allocate the whole bill. */
export function profileWeightTotal(procedure: ProcedureCode): number {
  const weights = BILL_PROFILES[procedure].weights;
  return Object.values(weights).reduce((total, weight) => total + (weight ?? 0), 0);
}
