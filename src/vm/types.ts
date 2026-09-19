/**
 * The vocabulary of the machine.
 *
 * Everything here is data. No function in this file, no I/O, no `Date`. The
 * evaluator consumes a `CompiledPolicy` and a `Claim` and returns a `Verdict`;
 * these three types are the whole contract between the compiler, the VM and the
 * user interface.
 */

import type { ISODate } from './dates';
import type { VMRuleId } from './rules';

export type { ISODate };

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The heads a hospital bill is broken into. The set is closed on purpose: the
 * room rent exemption list is expressed in these terms and data, not code,
 * decides which heads a proportionate reduction may touch.
 */
export const LINE_CATEGORIES = [
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
] as const;

export type LineCategory = (typeof LINE_CATEGORIES)[number];

export const PROCEDURE_CODES = [
  'cataract',
  'kneeReplacement',
  'angioplasty',
  'cabg',
  'herniaRepair',
  'appendectomy',
  'maternityDelivery',
  'cosmeticSurgery',
  'bariatricSurgery',
  'dialysis',
] as const;

export type ProcedureCode = (typeof PROCEDURE_CODES)[number];

/** The eight stages, in the order they run. The array order is the contract. */
export const STAGES = [
  'exclusion',
  'waitingPeriod',
  'lineItemIneligible',
  'roomRentProportionate',
  'subLimit',
  'deductible',
  'coPay',
  'sumInsured',
] as const;

export type Stage = (typeof STAGES)[number];

/* -------------------------------------------------------------------------- */
/* Clauses                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Where a clause came from. A clause without provenance is a bug, not a
 * degraded case: the whole product is the claim that every rupee can be traced
 * to wording, and a clause that cannot be traced breaks that claim. A test
 * asserts every clause in every shipped policy carries this.
 *
 * `charStart` and `charEnd` index into the policy's canonical plain text, which
 * is the same text the specimen PDF was typeset from. The generator records a
 * box for every word, so a character range maps to highlight rectangles.
 */
export type Provenance = {
  /** At most 25 words, quoted verbatim from the wording. */
  sourceQuote: string;
  /** 1-based page in the specimen PDF. */
  page: number;
  charStart: number;
  charEnd: number;
  confidence: 'high' | 'low';
};

type ClauseCommon = {
  id: string;
  /** The reference a reader would cite, e.g. "4.2(c)". */
  ref: string;
  title: string;
  provenance: Provenance;
};

export type PermanentExclusionClause = ClauseCommon & {
  kind: 'PermanentExclusion';
  procedures: readonly ProcedureCode[];
};

/**
 * `scope` decides when the clause is in play:
 *  - `all`         the initial waiting period, applied to every claim
 *  - `procedures`  a named-condition wait, applied when the procedure matches
 *  - `preExisting` the PED wait, applied when the claim arises from a declared
 *                  pre-existing condition
 */
export type WaitingPeriodScope =
  | { scope: 'all' }
  | { scope: 'procedures'; procedures: readonly ProcedureCode[] }
  | { scope: 'preExisting' };

export type WaitingPeriodClause = ClauseCommon & {
  kind: 'WaitingPeriod';
  waitingKind: 'initial' | 'specificDisease' | 'preExistingDisease';
  months: number;
  appliesTo: WaitingPeriodScope;
};

export type LineItemIneligibilityClause = ClauseCommon & {
  kind: 'LineItemIneligibility';
  categories: readonly LineCategory[];
};

export type RoomRentLimit =
  | { basis: 'perDayAmount'; perDayPaise: bigint }
  | { basis: 'percentOfSumInsuredPerDay'; percentBps: number };

/**
 * The room rent cap and, crucially, the two lists that decide its reach.
 *
 * `associatedCategories` are reduced in proportion. `exemptCategories` are not,
 * and the exemption is data rather than a condition in the evaluator so that a
 * different policy can ship a different exemption list without a code change.
 */
export type RoomRentCapClause = ClauseCommon & {
  kind: 'RoomRentCap';
  limit: RoomRentLimit;
  associatedCategories: readonly LineCategory[];
  exemptCategories: readonly LineCategory[];
};

export type SubLimitClause = ClauseCommon & {
  kind: 'SubLimit';
  procedures: readonly ProcedureCode[];
  capPaise: bigint;
};

export type DeductibleClause = ClauseCommon & {
  kind: 'Deductible';
  amountPaise: bigint;
};

export type CoPayClause = ClauseCommon & {
  kind: 'CoPay';
  percentBps: number;
};

export type SumInsuredClause = ClauseCommon & {
  kind: 'SumInsured';
  amountPaise: bigint;
};

/**
 * The moratorium is a clause of the policy but NOT a stage of the pipeline.
 * It never appears in `STAGES` and never produces a deduction. See ORDER.md.
 */
export type MoratoriumClause = ClauseCommon & {
  kind: 'Moratorium';
  months: number;
};

export type Clause =
  | PermanentExclusionClause
  | WaitingPeriodClause
  | LineItemIneligibilityClause
  | RoomRentCapClause
  | SubLimitClause
  | DeductibleClause
  | CoPayClause
  | SumInsuredClause
  | MoratoriumClause;

export type ClauseKind = Clause['kind'];

export type CompiledPolicy = {
  id: string;
  /** Always a specimen name. No real insurer is named anywhere in this product. */
  name: string;
  synthetic: true;
  /** Slug of the canonical text and of the generated PDF, without extension. */
  slug: string;
  summary: string;
  /** Free text describing the shape of the cover, shown on the policy picker. */
  shape: string;
  clauses: readonly Clause[];
};

/* -------------------------------------------------------------------------- */
/* Claims                                                                     */
/* -------------------------------------------------------------------------- */

export type ClaimLine = {
  id: string;
  label: string;
  category: LineCategory;
  amountPaise: bigint;
};

export type Claim = {
  id: string;
  policyInceptionDate: ISODate;
  admissionDate: ISODate;
  dischargeDate: ISODate;
  procedure: ProcedureCode;
  /** True when the condition treated was pre-existing at inception. */
  arisesFromPreExistingCondition: boolean;
  /** What the room actually cost per day. Drives the proportionate reduction. */
  roomActualPerDayPaise: bigint;
  lines: readonly ClaimLine[];
};

/* -------------------------------------------------------------------------- */
/* Verdict                                                                    */
/* -------------------------------------------------------------------------- */

export type DeductionLine = {
  id: string;
  label: string;
  category: LineCategory;
  beforePaise: bigint;
  afterPaise: bigint;
  removedPaise: bigint;
};

/**
 * The arithmetic behind a single band of the waterfall, in a shape the clause
 * card can render without recomputing anything.
 */
export type DeductionBasis =
  | { kind: 'wholeClaim'; claimedPaise: bigint; monthsOfCover?: number; monthsRequired?: number }
  | { kind: 'lines'; lines: readonly DeductionLine[] }
  | {
      kind: 'proportionate';
      eligiblePerDayPaise: bigint;
      actualPerDayPaise: bigint;
      payableBps: number;
      associatedBeforePaise: bigint;
      associatedAfterPaise: bigint;
      exemptedPaise: bigint;
      exemptCategories: readonly LineCategory[];
      lines: readonly DeductionLine[];
    }
  | { kind: 'cap'; beforePaise: bigint; capPaise: bigint }
  | { kind: 'flat'; beforePaise: bigint; statedPaise: bigint }
  | { kind: 'percent'; beforePaise: bigint; percentBps: number };

export type Deduction = {
  amountPaise: bigint;
  clauseId: string;
  clauseRef: string;
  ruleId: VMRuleId;
  humanReason: string;
  stage: Stage;
  /** Quoted wording that produced this deduction, at most 25 words. */
  sourceQuote: string;
  clauseTitle: string;
  basis: DeductionBasis;
};

/** Why nothing downstream was reached. Present only for a nil-admissible claim. */
export type Block = {
  stage: Extract<Stage, 'exclusion' | 'waitingPeriod'>;
  clauseId: string;
  clauseRef: string;
  clauseTitle: string;
  ruleId: VMRuleId;
  humanReason: string;
  sourceQuote: string;
};

/**
 * The moratorium result. It is deliberately not a deduction, not a stage and
 * not part of the waterfall. It answers a different question: not "how much is
 * payable" but "may the insurer still contest this claim for non-disclosure".
 */
export type Contestability = {
  moratoriumMonths: number;
  monthsOfContinuousCover: number;
  moratoriumComplete: boolean;
  insurerMayContestNonDisclosure: boolean;
  clauseId: string;
  clauseRef: string;
  clauseTitle: string;
  sourceQuote: string;
  ruleId: VMRuleId;
  note: string;
};

export type TraceStep = {
  order: number;
  stage: Stage;
  /** False when an earlier stage rendered the claim nil-admissible. */
  reached: boolean;
  /** False when the policy has no clause of this kind, or the clause did not bite. */
  applied: boolean;
  clauseIds: readonly string[];
  beforePaise: bigint;
  afterPaise: bigint;
  note: string;
};

export type Verdict = {
  policyId: string;
  claimId: string;
  asOf: ISODate;
  /** The date the waiting periods were tested at: the earlier of asOf and admission. */
  testedAt: ISODate;
  monthsOfCoverAtTest: number;
  claimedPaise: bigint;
  paidPaise: bigint;
  deductions: readonly Deduction[];
  block: Block | null;
  contestability: Contestability;
  trace: readonly TraceStep[];
};
