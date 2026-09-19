/**
 * Purpose-built policies for the golden scenarios.
 *
 * These are deliberately small and deliberately not the shipped specimens: a
 * golden scenario should fail for one reason, and a fixture that exercises one
 * clause kind at a time makes that true. The shipped specimen policies are
 * tested separately, as a matrix, in `src/policies/__tests__`.
 *
 * The provenance on these fixtures points at a fixture text file that does not
 * exist, which is fine: the provenance *shape* is what the evaluator and the
 * interface depend on, and the char-offset correctness of the shipped policies
 * is asserted against their real wording in the compiler tests.
 */

import type {
  Claim,
  ClaimLine,
  Clause,
  CompiledPolicy,
  LineCategory,
  ProcedureCode,
  Provenance,
} from '../types';

let quoteCounter = 0;

function provenance(sourceQuote: string): Provenance {
  quoteCounter += 1;
  return {
    sourceQuote,
    page: 1,
    charStart: quoteCounter * 100,
    charEnd: quoteCounter * 100 + sourceQuote.length,
    confidence: 'high',
  };
}

/** Room rent proportion reaches these heads. */
export const ASSOCIATED: readonly LineCategory[] = [
  'room',
  'nursing',
  'surgeon',
  'anaesthetist',
  'operationTheatre',
];

/** And is forbidden from reaching these. */
export const EXEMPT: readonly LineCategory[] = [
  'pharmacy',
  'consumables',
  'implants',
  'diagnostics',
];

export const CLAUSES = {
  sumInsured(amountPaise: bigint): Clause {
    return {
      kind: 'SumInsured',
      id: 'fx.sumInsured',
      ref: '2.1',
      title: 'Sum insured',
      amountPaise,
      provenance: provenance(
        'The Sum Insured stated in the Schedule is the maximum amount payable in respect of all claims in the Policy Year.',
      ),
    };
  },
  moratorium(months: number): Clause {
    return {
      kind: 'Moratorium',
      id: 'fx.moratorium',
      ref: '6.1',
      title: 'Moratorium period',
      months,
      provenance: provenance(
        'After sixty months of continuous cover this Policy shall not be contestable for non-disclosure or misrepresentation, save for established fraud.',
      ),
    };
  },
  permanentExclusion(procedures: readonly ProcedureCode[]): Clause {
    return {
      kind: 'PermanentExclusion',
      id: 'fx.exclusion',
      ref: '5.1',
      title: 'Permanent exclusions',
      procedures,
      provenance: provenance(
        'The Company shall not be liable for any expense in respect of the treatments listed in this Clause, at any time during the currency of this Policy.',
      ),
    };
  },
  waiting(
    id: string,
    ref: string,
    months: number,
    waitingKind: 'initial' | 'specificDisease' | 'preExistingDisease',
    appliesTo: Extract<Clause, { kind: 'WaitingPeriod' }>['appliesTo'],
  ): Clause {
    return {
      kind: 'WaitingPeriod',
      id,
      ref,
      title: 'Waiting period',
      months,
      waitingKind,
      appliesTo,
      provenance: provenance(
        'No claim shall be admissible in respect of this Clause until the waiting period stated against it has been completed in full.',
      ),
    };
  },
  ineligible(categories: readonly LineCategory[]): Clause {
    return {
      kind: 'LineItemIneligibility',
      id: 'fx.ineligible',
      ref: '3.9',
      title: 'Non-payable items',
      categories,
      provenance: provenance(
        'Items of personal comfort and convenience and other non-medical items are not payable under this Policy.',
      ),
    };
  },
  roomCapPerDay(perDayPaise: bigint): Clause {
    return {
      kind: 'RoomRentCap',
      id: 'fx.roomCap',
      ref: '4.2',
      title: 'Room rent limit and proportionate deduction',
      limit: { basis: 'perDayAmount', perDayPaise },
      associatedCategories: ASSOCIATED,
      exemptCategories: EXEMPT,
      provenance: provenance(
        'Where the room occupied exceeds the eligible room rent, associated medical expenses shall be payable in the same proportion as the eligible room rent bears to the room rent actually incurred.',
      ),
    };
  },
  roomCapPercentOfSi(percentBps: number): Clause {
    return {
      kind: 'RoomRentCap',
      id: 'fx.roomCap',
      ref: '4.2',
      title: 'Room rent limit and proportionate deduction',
      limit: { basis: 'percentOfSumInsuredPerDay', percentBps },
      associatedCategories: ASSOCIATED,
      exemptCategories: EXEMPT,
      provenance: provenance(
        'The eligible room rent per day shall be one per cent of the Sum Insured, and associated expenses shall abate in the same proportion.',
      ),
    };
  },
  subLimit(procedures: readonly ProcedureCode[], capPaise: bigint): Clause {
    return {
      kind: 'SubLimit',
      id: 'fx.subLimit',
      ref: '4.6',
      title: 'Procedure sub-limit',
      procedures,
      capPaise,
      provenance: provenance(
        'The Company shall not be liable to pay more than the amount stated against the procedure in the table of sub-limits.',
      ),
    };
  },
  deductible(amountPaise: bigint): Clause {
    return {
      kind: 'Deductible',
      id: 'fx.deductible',
      ref: '4.8',
      title: 'Deductible',
      amountPaise,
      provenance: provenance(
        'The deductible stated in the Schedule shall be borne by the Insured Person in respect of each and every claim.',
      ),
    };
  },
  coPay(percentBps: number): Clause {
    return {
      kind: 'CoPay',
      id: 'fx.coPay',
      ref: '4.9',
      title: 'Co-payment',
      percentBps,
      provenance: provenance(
        'Every admissible claim shall be subject to the co-payment percentage stated in the Schedule, applied to the admissible amount.',
      ),
    };
  },
} as const;

export function policy(id: string, clauses: readonly Clause[]): CompiledPolicy {
  return {
    id,
    name: `Fixture ${id}`,
    synthetic: true,
    slug: `fixture-${id}`,
    summary: 'A purpose-built fixture, not a shipped specimen.',
    shape: 'Fixture',
    clauses,
  };
}

/* -------------------------------------------------------------------------- */
/* Bills                                                                      */
/* -------------------------------------------------------------------------- */

export function line(
  id: string,
  category: LineCategory,
  rupees: number,
  label = id,
): ClaimLine {
  return { id, label, category, amountPaise: BigInt(Math.round(rupees * 100)) };
}

/**
 * The bill behind the headline scenario: five days of a knee replacement
 * totalling four lakh, in a room costing nine thousand a day.
 */
export function kneeBill(): ClaimLine[] {
  return [
    line('l1', 'room', 45_000, 'Room rent, 5 days at 9,000'),
    line('l2', 'nursing', 20_000, 'Nursing charges'),
    line('l3', 'surgeon', 90_000, 'Surgeon fee'),
    line('l4', 'anaesthetist', 28_000, 'Anaesthetist fee'),
    line('l5', 'operationTheatre', 36_000, 'Operation theatre'),
    line('l6', 'pharmacy', 56_000, 'Pharmacy'),
    line('l7', 'consumables', 24_000, 'Consumables'),
    line('l8', 'implants', 76_000, 'Knee implant'),
    line('l9', 'diagnostics', 20_000, 'Diagnostics'),
    line('l10', 'nonMedical', 5_000, 'Non-medical items'),
  ];
}

export function claim(overrides: Partial<Claim> = {}): Claim {
  const base: Claim = {
    id: 'fixture-claim',
    policyInceptionDate: '2021-04-01',
    admissionDate: '2024-10-01',
    dischargeDate: '2024-10-05',
    procedure: 'kneeReplacement',
    arisesFromPreExistingCondition: false,
    roomActualPerDayPaise: 900_000n,
    lines: kneeBill(),
  };
  return { ...base, ...overrides };
}
