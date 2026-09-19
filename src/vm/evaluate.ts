/**
 * PolicyVM: the evaluator.
 *
 * Pure. No `fetch`, no `Date.now()`, no `Math.random()`, no file reads, no
 * locale lookup. `asOf` is a parameter, always. Money is `bigint` paise from
 * the first line to the last, and every division goes through `mulDivRound`
 * in ./money.ts, which is the only rounding rule in the product.
 *
 * The evaluation order is fixed and documented in ./ORDER.md. It is tested.
 * Do not reorder the stages in this file without changing both.
 *
 * The 60-month moratorium is deliberately NOT one of the stages. It cannot
 * unlock cover and it cannot take a rupee; it decides only whether the insurer
 * may still contest the claim for non-disclosure. It is reported on the verdict
 * as `contestability`, alongside the waterfall rather than inside it.
 */

import { earlierISO, fullMonthsBetween, inpatientDays } from './dates';
import { formatBps, formatMonths, formatPaise } from './format';
import { CATEGORY_LABELS, PROCEDURE_LABELS, categoryPhrase, listPhrase } from './labels';
import { minPaise, mulDivRound, ratioBps, shareOfBps, sumPaise } from './money';
import { VM_RULE_IDS } from './rules';
import { clausesOfKind, firstClauseOfKind, moratoriumOf, sumInsuredOf } from './selectors';
import type {
  Block,
  Claim,
  ClaimLine,
  CompiledPolicy,
  Contestability,
  Deduction,
  DeductionLine,
  ISODate,
  LineCategory,
  RoomRentCapClause,
  Stage,
  TraceStep,
  Verdict,
  WaitingPeriodClause,
} from './types';
import { STAGES } from './types';

/* -------------------------------------------------------------------------- */
/* Internal working state                                                     */
/* -------------------------------------------------------------------------- */

type WorkingLine = {
  readonly id: string;
  readonly label: string;
  readonly category: LineCategory;
  readonly originalPaise: bigint;
  remainingPaise: bigint;
};

type Session = {
  deductions: Deduction[];
  trace: TraceStep[];
  blocked: Block | null;
};

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function pushTrace(
  session: Session,
  order: number,
  stage: Stage,
  options: {
    reached: boolean;
    applied: boolean;
    clauseIds: readonly string[];
    beforePaise: bigint;
    afterPaise: bigint;
    note: string;
  },
): void {
  session.trace.push({ order, stage, ...options });
}

/* -------------------------------------------------------------------------- */
/* The evaluator                                                              */
/* -------------------------------------------------------------------------- */

export function evaluate(policy: CompiledPolicy, claim: Claim, asOf: ISODate): Verdict {
  const lines: WorkingLine[] = claim.lines
    .slice()
    .sort(byId)
    .map((line) => ({
      id: line.id,
      label: line.label,
      category: line.category,
      originalPaise: line.amountPaise,
      remainingPaise: line.amountPaise,
    }));

  const claimedPaise = sumPaise(lines.map((line) => line.originalPaise));

  /*
   * Waiting periods are tested at the date of admission. `asOf` lets a caller
   * ask what the policy said at an earlier moment, so the test date is the
   * earlier of the two. Taking the earlier date also keeps `paid` monotone in
   * months of cover, which is one of the invariants.
   */
  const testedAt = earlierISO(asOf, claim.admissionDate);
  const monthsOfCoverAtTest = fullMonthsBetween(claim.policyInceptionDate, testedAt);

  const session: Session = { deductions: [], trace: [], blocked: null };

  const sumInsured = sumInsuredOf(policy);
  const procedureLabel = PROCEDURE_LABELS[claim.procedure];

  /* ---- 1. Permanent exclusion ------------------------------------------- */

  const exclusions = clausesOfKind(policy, 'PermanentExclusion');
  const matchedExclusion =
    exclusions.find((clause) => clause.procedures.includes(claim.procedure)) ?? null;

  if (matchedExclusion) {
    const humanReason = `${procedureLabel} is listed as a permanent exclusion at ${matchedExclusion.ref}, so no part of this claim is admissible under this policy.`;
    if (claimedPaise > 0n) {
      session.deductions.push({
        amountPaise: claimedPaise,
        clauseId: matchedExclusion.id,
        clauseRef: matchedExclusion.ref,
        clauseTitle: matchedExclusion.title,
        ruleId: VM_RULE_IDS.permanentExclusion,
        humanReason,
        stage: 'exclusion',
        sourceQuote: matchedExclusion.provenance.sourceQuote,
        basis: { kind: 'wholeClaim', claimedPaise },
      });
    }
    session.blocked = {
      stage: 'exclusion',
      clauseId: matchedExclusion.id,
      clauseRef: matchedExclusion.ref,
      clauseTitle: matchedExclusion.title,
      ruleId: VM_RULE_IDS.permanentExclusion,
      humanReason,
      sourceQuote: matchedExclusion.provenance.sourceQuote,
    };
  }

  pushTrace(session, 1, 'exclusion', {
    reached: true,
    applied: matchedExclusion !== null,
    clauseIds: matchedExclusion ? [matchedExclusion.id] : exclusions.map((c) => c.id),
    beforePaise: claimedPaise,
    afterPaise: matchedExclusion ? 0n : claimedPaise,
    note: matchedExclusion
      ? `${procedureLabel} matches the exclusion list at ${matchedExclusion.ref}.`
      : exclusions.length === 0
        ? 'This policy declares no permanent exclusions.'
        : `${procedureLabel} does not appear on any exclusion list in this policy.`,
  });

  if (session.blocked) {
    return finish(policy, claim, asOf, testedAt, monthsOfCoverAtTest, claimedPaise, 0n, session, 1);
  }

  /* ---- 2. Waiting periods ------------------------------------------------ */

  const waitingClauses = clausesOfKind(policy, 'WaitingPeriod').filter((clause) =>
    waitingApplies(clause, claim),
  );

  /* The most binding unexpired wait is the one reported; ties break by id. */
  const unexpired = waitingClauses
    .filter((clause) => monthsOfCoverAtTest < clause.months)
    .sort((a, b) => (b.months - a.months !== 0 ? b.months - a.months : byId(a, b)));
  const bindingWait = unexpired[0] ?? null;

  if (bindingWait) {
    const humanReason = `The ${formatMonths(bindingWait.months)} ${waitingKindPhrase(bindingWait)} at ${bindingWait.ref} had not expired: the claim was tested at ${formatMonths(monthsOfCoverAtTest)} of continuous cover.`;
    if (claimedPaise > 0n) {
      session.deductions.push({
        amountPaise: claimedPaise,
        clauseId: bindingWait.id,
        clauseRef: bindingWait.ref,
        clauseTitle: bindingWait.title,
        ruleId: waitingRuleId(bindingWait),
        humanReason,
        stage: 'waitingPeriod',
        sourceQuote: bindingWait.provenance.sourceQuote,
        basis: {
          kind: 'wholeClaim',
          claimedPaise,
          monthsOfCover: monthsOfCoverAtTest,
          monthsRequired: bindingWait.months,
        },
      });
    }
    session.blocked = {
      stage: 'waitingPeriod',
      clauseId: bindingWait.id,
      clauseRef: bindingWait.ref,
      clauseTitle: bindingWait.title,
      ruleId: waitingRuleId(bindingWait),
      humanReason,
      sourceQuote: bindingWait.provenance.sourceQuote,
    };
  }

  pushTrace(session, 2, 'waitingPeriod', {
    reached: true,
    applied: bindingWait !== null,
    clauseIds: bindingWait ? [bindingWait.id] : waitingClauses.map((c) => c.id),
    beforePaise: claimedPaise,
    afterPaise: bindingWait ? 0n : claimedPaise,
    note: bindingWait
      ? `${formatMonths(monthsOfCoverAtTest)} of cover at the date tested, against ${formatMonths(bindingWait.months)} required by ${bindingWait.ref}.`
      : waitingClauses.length === 0
        ? 'No waiting period in this policy applies to this claim.'
        : `Every applicable waiting period had expired at ${formatMonths(monthsOfCoverAtTest)} of cover.`,
  });

  if (session.blocked) {
    return finish(policy, claim, asOf, testedAt, monthsOfCoverAtTest, claimedPaise, 0n, session, 2);
  }

  /* ---- 3. Line-item ineligibility ---------------------------------------- */

  const ineligibilityClauses = clausesOfKind(policy, 'LineItemIneligibility');
  const beforeStage3 = sumPaise(lines.map((line) => line.remainingPaise));
  const stage3ClauseIds: string[] = [];

  for (const clause of ineligibilityClauses) {
    const categories = new Set<LineCategory>(clause.categories);
    const hit = lines.filter((line) => line.remainingPaise > 0n && categories.has(line.category));
    const removed = sumPaise(hit.map((line) => line.remainingPaise));
    if (removed === 0n) continue;

    const detail: DeductionLine[] = hit.map((line) => ({
      id: line.id,
      label: line.label,
      category: line.category,
      beforePaise: line.remainingPaise,
      afterPaise: 0n,
      removedPaise: line.remainingPaise,
    }));
    for (const line of hit) line.remainingPaise = 0n;

    stage3ClauseIds.push(clause.id);
    session.deductions.push({
      amountPaise: removed,
      clauseId: clause.id,
      clauseRef: clause.ref,
      clauseTitle: clause.title,
      ruleId: VM_RULE_IDS.lineItemIneligible,
      humanReason: `${sentenceCase(categoryPhrase(clause.categories))} are listed as non-payable at ${clause.ref}, so those lines are removed before any cap is applied.`,
      stage: 'lineItemIneligible',
      sourceQuote: clause.provenance.sourceQuote,
      basis: { kind: 'lines', lines: detail },
    });
  }

  const afterStage3 = sumPaise(lines.map((line) => line.remainingPaise));
  pushTrace(session, 3, 'lineItemIneligible', {
    reached: true,
    applied: stage3ClauseIds.length > 0,
    clauseIds: stage3ClauseIds.length > 0 ? stage3ClauseIds : ineligibilityClauses.map((c) => c.id),
    beforePaise: beforeStage3,
    afterPaise: afterStage3,
    note:
      stage3ClauseIds.length > 0
        ? 'Non-payable heads removed line by line.'
        : ineligibilityClauses.length === 0
          ? 'This policy lists no non-payable heads.'
          : 'This bill contains nothing in a non-payable head.',
  });

  /* ---- 4. Room rent cap, proportionate ----------------------------------- */

  const roomCap = firstClauseOfKind(policy, 'RoomRentCap');
  const beforeStage4 = afterStage3;
  let stage4Applied = false;

  if (roomCap) {
    const eligiblePerDayPaise = eligibleRoomPerDay(roomCap, sumInsured.amountPaise);
    const actualPerDayPaise = claim.roomActualPerDayPaise;

    if (actualPerDayPaise > 0n && actualPerDayPaise > eligiblePerDayPaise) {
      const exemptSet = new Set<LineCategory>(roomCap.exemptCategories);
      /*
       * The exemption list wins. A head that appears in both lists is exempt,
       * because the exemption is the promise the policyholder was given and the
       * association list is the mechanism.
       */
      const touched = lines.filter(
        (line) =>
          line.remainingPaise > 0n &&
          roomCap.associatedCategories.includes(line.category) &&
          !exemptSet.has(line.category),
      );

      const associatedBeforePaise = sumPaise(touched.map((line) => line.remainingPaise));
      const detail: DeductionLine[] = [];
      let removed = 0n;

      for (const line of touched) {
        const after = mulDivRound(line.remainingPaise, eligiblePerDayPaise, actualPerDayPaise);
        const cut = line.remainingPaise - after;
        detail.push({
          id: line.id,
          label: line.label,
          category: line.category,
          beforePaise: line.remainingPaise,
          afterPaise: after,
          removedPaise: cut,
        });
        line.remainingPaise = after;
        removed += cut;
      }

      const exemptedPaise = sumPaise(
        lines.filter((line) => exemptSet.has(line.category)).map((line) => line.remainingPaise),
      );
      const payableBps = ratioBps(eligiblePerDayPaise, actualPerDayPaise);

      if (removed > 0n) {
        stage4Applied = true;
        session.deductions.push({
          amountPaise: removed,
          clauseId: roomCap.id,
          clauseRef: roomCap.ref,
          clauseTitle: roomCap.title,
          ruleId: VM_RULE_IDS.roomRentProportionate,
          humanReason: `The room occupied cost ${formatPaise(actualPerDayPaise)} a day against an eligible ${formatPaise(eligiblePerDayPaise)} a day, so ${categoryPhrase(roomCap.associatedCategories)} are payable at ${formatBps(payableBps)} under ${roomCap.ref}. ${sentenceCase(categoryPhrase(roomCap.exemptCategories))} are exempt and were not reduced.`,
          stage: 'roomRentProportionate',
          sourceQuote: roomCap.provenance.sourceQuote,
          basis: {
            kind: 'proportionate',
            eligiblePerDayPaise,
            actualPerDayPaise,
            payableBps,
            associatedBeforePaise,
            associatedAfterPaise: associatedBeforePaise - removed,
            exemptedPaise,
            exemptCategories: roomCap.exemptCategories,
            lines: detail,
          },
        });
      }
    }
  }

  const afterStage4 = sumPaise(lines.map((line) => line.remainingPaise));
  pushTrace(session, 4, 'roomRentProportionate', {
    reached: true,
    applied: stage4Applied,
    clauseIds: roomCap ? [roomCap.id] : [],
    beforePaise: beforeStage4,
    afterPaise: afterStage4,
    note: !roomCap
      ? 'This policy caps no room rent.'
      : stage4Applied
        ? `Associated heads reduced in proportion; ${categoryPhrase(roomCap.exemptCategories)} exempt.`
        : 'The room occupied was within the eligible room rent, so nothing was reduced.',
  });

  /*
   * From here the claim is a single admissible figure. Stages 5 to 8 are
   * ceilings and shares applied to the whole, so per-line state is no longer
   * meaningful and keeping it would only invite an allocation that rounds.
   */
  let admissible = afterStage4;

  /* ---- 5. Sub-limits ------------------------------------------------------ */

  const subLimits = clausesOfKind(policy, 'SubLimit').filter((clause) =>
    clause.procedures.includes(claim.procedure),
  );
  const beforeStage5 = admissible;
  const stage5ClauseIds: string[] = [];

  for (const clause of subLimits) {
    if (admissible <= clause.capPaise) continue;
    const removed = admissible - clause.capPaise;
    stage5ClauseIds.push(clause.id);
    session.deductions.push({
      amountPaise: removed,
      clauseId: clause.id,
      clauseRef: clause.ref,
      clauseTitle: clause.title,
      ruleId: VM_RULE_IDS.subLimit,
      humanReason: `${procedureLabel} carries a ceiling of ${formatPaise(clause.capPaise)} at ${clause.ref}, and ${formatPaise(admissible)} was otherwise admissible.`,
      stage: 'subLimit',
      sourceQuote: clause.provenance.sourceQuote,
      basis: { kind: 'cap', beforePaise: admissible, capPaise: clause.capPaise },
    });
    admissible = clause.capPaise;
  }

  pushTrace(session, 5, 'subLimit', {
    reached: true,
    applied: stage5ClauseIds.length > 0,
    clauseIds: stage5ClauseIds.length > 0 ? stage5ClauseIds : subLimits.map((c) => c.id),
    beforePaise: beforeStage5,
    afterPaise: admissible,
    note:
      stage5ClauseIds.length > 0
        ? 'A per-procedure ceiling was reached.'
        : subLimits.length === 0
          ? `This policy sets no sub-limit for ${procedureLabel.toLowerCase()}.`
          : 'The admissible amount was within the per-procedure ceiling.',
  });

  /* ---- 6. Deductible ------------------------------------------------------ */

  const deductibles = clausesOfKind(policy, 'Deductible');
  const beforeStage6 = admissible;
  const stage6ClauseIds: string[] = [];

  for (const clause of deductibles) {
    const removed = minPaise(clause.amountPaise, admissible);
    if (removed === 0n) continue;
    stage6ClauseIds.push(clause.id);
    session.deductions.push({
      amountPaise: removed,
      clauseId: clause.id,
      clauseRef: clause.ref,
      clauseTitle: clause.title,
      ruleId: VM_RULE_IDS.deductible,
      humanReason: `The first ${formatPaise(clause.amountPaise)} of every claim is borne by the policyholder under ${clause.ref}.`,
      stage: 'deductible',
      sourceQuote: clause.provenance.sourceQuote,
      basis: { kind: 'flat', beforePaise: admissible, statedPaise: clause.amountPaise },
    });
    admissible -= removed;
  }

  pushTrace(session, 6, 'deductible', {
    reached: true,
    applied: stage6ClauseIds.length > 0,
    clauseIds: stage6ClauseIds.length > 0 ? stage6ClauseIds : deductibles.map((c) => c.id),
    beforePaise: beforeStage6,
    afterPaise: admissible,
    note:
      stage6ClauseIds.length > 0
        ? 'The deductible was applied to the admissible amount.'
        : deductibles.length === 0
          ? 'This policy carries no deductible.'
          : 'Nothing remained for the deductible to reach.',
  });

  /* ---- 7. Co-pay, applied last on the admissible amount ------------------ */

  const coPays = clausesOfKind(policy, 'CoPay');
  const beforeStage7 = admissible;
  const stage7ClauseIds: string[] = [];

  for (const clause of coPays) {
    const removed = shareOfBps(admissible, clause.percentBps);
    if (removed === 0n) continue;
    stage7ClauseIds.push(clause.id);
    session.deductions.push({
      amountPaise: removed,
      clauseId: clause.id,
      clauseRef: clause.ref,
      clauseTitle: clause.title,
      ruleId: VM_RULE_IDS.coPay,
      humanReason: `A ${formatBps(clause.percentBps)} co-pay under ${clause.ref} is applied last, to the ${formatPaise(admissible)} that remained admissible.`,
      stage: 'coPay',
      sourceQuote: clause.provenance.sourceQuote,
      basis: { kind: 'percent', beforePaise: admissible, percentBps: clause.percentBps },
    });
    admissible -= removed;
  }

  pushTrace(session, 7, 'coPay', {
    reached: true,
    applied: stage7ClauseIds.length > 0,
    clauseIds: stage7ClauseIds.length > 0 ? stage7ClauseIds : coPays.map((c) => c.id),
    beforePaise: beforeStage7,
    afterPaise: admissible,
    note:
      stage7ClauseIds.length > 0
        ? 'The co-pay share was taken from the admissible amount.'
        : coPays.length === 0
          ? 'This policy carries no co-pay.'
          : 'Nothing remained for the co-pay to reach.',
  });

  /* ---- 8. Sum insured ----------------------------------------------------- */

  const beforeStage8 = admissible;
  let stage8Applied = false;

  if (admissible > sumInsured.amountPaise) {
    const removed = admissible - sumInsured.amountPaise;
    stage8Applied = true;
    session.deductions.push({
      amountPaise: removed,
      clauseId: sumInsured.id,
      clauseRef: sumInsured.ref,
      clauseTitle: sumInsured.title,
      ruleId: VM_RULE_IDS.sumInsuredCap,
      humanReason: `The sum insured of ${formatPaise(sumInsured.amountPaise)} at ${sumInsured.ref} is the ceiling for the period, and ${formatPaise(admissible)} was otherwise admissible.`,
      stage: 'sumInsured',
      sourceQuote: sumInsured.provenance.sourceQuote,
      basis: { kind: 'cap', beforePaise: admissible, capPaise: sumInsured.amountPaise },
    });
    admissible = sumInsured.amountPaise;
  }

  pushTrace(session, 8, 'sumInsured', {
    reached: true,
    applied: stage8Applied,
    clauseIds: [sumInsured.id],
    beforePaise: beforeStage8,
    afterPaise: admissible,
    note: stage8Applied
      ? 'The admissible amount exceeded the sum insured and was capped.'
      : 'The admissible amount was within the sum insured.',
  });

  return finish(
    policy,
    claim,
    asOf,
    testedAt,
    monthsOfCoverAtTest,
    claimedPaise,
    admissible,
    session,
    8,
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function finish(
  policy: CompiledPolicy,
  claim: Claim,
  asOf: ISODate,
  testedAt: ISODate,
  monthsOfCoverAtTest: number,
  claimedPaise: bigint,
  paidPaise: bigint,
  session: Session,
  stagesReached: number,
): Verdict {
  /* Stages the claim never reached are still reported, marked unreached. */
  for (let order = stagesReached + 1; order <= STAGES.length; order += 1) {
    const stage = STAGES[order - 1];
    if (!stage) continue;
    session.trace.push({
      order,
      stage,
      reached: false,
      applied: false,
      clauseIds: [],
      beforePaise: 0n,
      afterPaise: 0n,
      note: 'Not reached: the claim was already nil-admissible.',
    });
  }

  const verdict: Verdict = {
    policyId: policy.id,
    claimId: claim.id,
    asOf,
    testedAt,
    monthsOfCoverAtTest,
    claimedPaise,
    paidPaise,
    deductions: session.deductions,
    block: session.blocked,
    contestability: contestabilityOf(policy, claim, asOf),
    trace: session.trace,
  };

  assertBalances(verdict);
  return verdict;
}

/**
 * The moratorium, modelled where it belongs.
 *
 * It is computed from `asOf` rather than from the test date, because
 * contestability is a question about the moment the insurer raises the point,
 * not about the moment the patient was admitted.
 */
function contestabilityOf(policy: CompiledPolicy, claim: Claim, asOf: ISODate): Contestability {
  const clause = moratoriumOf(policy);
  const monthsOfContinuousCover = fullMonthsBetween(claim.policyInceptionDate, asOf);
  const moratoriumComplete = monthsOfContinuousCover >= clause.months;

  const note = moratoriumComplete
    ? `${formatMonths(clause.months)} of continuous cover are complete, so under ${clause.ref} the insurer may no longer contest this claim for non-disclosure or misrepresentation, except on grounds of established fraud. This changes nothing in the waterfall above: permanent exclusions, sub-limits, co-pay and any unexpired waiting period still apply in full.`
    : `${formatMonths(monthsOfContinuousCover)} of the ${formatMonths(clause.months)} of continuous cover are complete, so under ${clause.ref} the insurer may still contest this claim for non-disclosure or misrepresentation. The moratorium is not a waiting period: completing it would not change any figure in the waterfall above.`;

  return {
    moratoriumMonths: clause.months,
    monthsOfContinuousCover,
    moratoriumComplete,
    insurerMayContestNonDisclosure: !moratoriumComplete,
    clauseId: clause.id,
    clauseRef: clause.ref,
    clauseTitle: clause.title,
    sourceQuote: clause.provenance.sourceQuote,
    ruleId: VM_RULE_IDS.moratoriumContestability,
    note,
  };
}

function eligibleRoomPerDay(clause: RoomRentCapClause, sumInsuredPaise: bigint): bigint {
  return clause.limit.basis === 'perDayAmount'
    ? clause.limit.perDayPaise
    : shareOfBps(sumInsuredPaise, clause.limit.percentBps);
}

function waitingApplies(clause: WaitingPeriodClause, claim: Claim): boolean {
  switch (clause.appliesTo.scope) {
    case 'all':
      return true;
    case 'procedures':
      return clause.appliesTo.procedures.includes(claim.procedure);
    case 'preExisting':
      return claim.arisesFromPreExistingCondition;
  }
}

function waitingRuleId(clause: WaitingPeriodClause) {
  switch (clause.waitingKind) {
    case 'initial':
      return VM_RULE_IDS.waitingInitial;
    case 'specificDisease':
      return VM_RULE_IDS.waitingSpecificDisease;
    case 'preExistingDisease':
      return VM_RULE_IDS.waitingPreExisting;
  }
}

function waitingKindPhrase(clause: WaitingPeriodClause): string {
  switch (clause.waitingKind) {
    case 'initial':
      return 'initial waiting period';
    case 'specificDisease':
      return 'named-condition waiting period';
    case 'preExistingDisease':
      return 'pre-existing disease waiting period';
  }
}

function sentenceCase(text: string): string {
  return text.length === 0 ? text : `${text[0]?.toUpperCase() ?? ''}${text.slice(1)}`;
}

export class VerdictBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerdictBalanceError';
  }
}

/**
 * The identity the whole product rests on, asserted on every single verdict
 * rather than only in the test suite. If this ever throws, a screen showing a
 * number that does not add up is strictly worse than a screen showing an error.
 */
export function assertBalances(verdict: Verdict): void {
  const deducted = verdict.deductions.reduce((total, d) => total + d.amountPaise, 0n);
  if (verdict.paidPaise + deducted !== verdict.claimedPaise) {
    throw new VerdictBalanceError(
      `verdict does not balance: paid ${verdict.paidPaise} + deductions ${deducted} !== claimed ${verdict.claimedPaise}`,
    );
  }
  if (verdict.paidPaise < 0n) {
    throw new VerdictBalanceError(`verdict pays a negative amount: ${verdict.paidPaise}`);
  }
  if (verdict.paidPaise > verdict.claimedPaise) {
    throw new VerdictBalanceError(
      `verdict pays more than was claimed: ${verdict.paidPaise} > ${verdict.claimedPaise}`,
    );
  }
}

/** Convenience for the interface: the claimed total of a bill. */
export function claimedTotal(lines: readonly ClaimLine[]): bigint {
  return sumPaise(lines.map((line) => line.amountPaise));
}

/** Days of stay implied by a claim. Exported for the clause card arithmetic. */
export function claimDays(claim: Claim): number {
  return inpatientDays(claim.admissionDate, claim.dischargeDate);
}

export { CATEGORY_LABELS, PROCEDURE_LABELS, listPhrase };
