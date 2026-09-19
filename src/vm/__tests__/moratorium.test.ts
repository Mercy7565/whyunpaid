/**
 * The moratorium boundary.
 *
 * This is the clause most implementations get wrong, so it gets its own file
 * and two assertions that pull in opposite directions:
 *
 *   1. Crossing sixty months CHANGES contestability.
 *   2. Crossing sixty months CHANGES NOTHING in the waterfall.
 *
 * If either stops holding, the product is making a claim about someone's money
 * that the policy wording does not support.
 */

import { describe, expect, it } from 'vitest';
import { addMonths } from '../dates';
import { evaluate } from '../evaluate';
import { STAGES } from '../types';
import type { CompiledPolicy, Verdict } from '../types';
import { CLAUSES, claim, policy } from './fixtures';

const INCEPTION = '2019-01-01';

/**
 * Admission sits at month 53, comfortably past every waiting period in the
 * policy, so the only thing that differs between the two evaluations below is
 * the date the file is assessed on.
 */
const ADMISSION = addMonths(INCEPTION, 53);

const BEFORE = addMonths(INCEPTION, 59);
const AFTER = addMonths(INCEPTION, 61);

function subject(): CompiledPolicy {
  return policy('moratorium', [
    CLAUSES.sumInsured(50_000_000n),
    CLAUSES.moratorium(60),
    CLAUSES.permanentExclusion(['cosmeticSurgery']),
    CLAUSES.waiting('fx.wait.initial', '4.1', 1, 'initial', { scope: 'all' }),
    CLAUSES.waiting('fx.wait.ped', '4.3', 36, 'preExistingDisease', { scope: 'preExisting' }),
    CLAUSES.ineligible(['nonMedical']),
    CLAUSES.roomCapPerDay(500_000n),
    CLAUSES.subLimit(['kneeReplacement'], 26_500_000n),
    CLAUSES.coPay(2_000),
  ]);
}

function waterfall(verdict: Verdict) {
  return {
    claimedPaise: verdict.claimedPaise,
    paidPaise: verdict.paidPaise,
    testedAt: verdict.testedAt,
    monthsOfCoverAtTest: verdict.monthsOfCoverAtTest,
    deductions: verdict.deductions,
    block: verdict.block,
    trace: verdict.trace,
  };
}

describe('the 60-month moratorium', () => {
  const p = subject();
  const c = claim({
    policyInceptionDate: INCEPTION,
    admissionDate: ADMISSION,
    dischargeDate: addMonths(ADMISSION, 0),
    arisesFromPreExistingCondition: true,
  });

  const before = evaluate(p, c, BEFORE);
  const after = evaluate(p, c, AFTER);

  it('changes contestability once sixty months of continuous cover are complete', () => {
    expect(before.contestability.monthsOfContinuousCover).toBe(59);
    expect(before.contestability.moratoriumComplete).toBe(false);
    expect(before.contestability.insurerMayContestNonDisclosure).toBe(true);

    expect(after.contestability.monthsOfContinuousCover).toBe(61);
    expect(after.contestability.moratoriumComplete).toBe(true);
    expect(after.contestability.insurerMayContestNonDisclosure).toBe(false);

    expect(before.contestability.note).not.toBe(after.contestability.note);
  });

  it('changes nothing whatsoever in the waterfall', () => {
    expect(waterfall(after)).toEqual(waterfall(before));

    /* And the figures are not nil, so the equality above is not vacuous. */
    expect(before.paidPaise).toBeGreaterThan(0n);
    expect(before.deductions.length).toBeGreaterThan(0);
  });

  it('never appears as a stage of the pipeline', () => {
    expect([...STAGES]).not.toContain('moratorium');
    for (const verdict of [before, after]) {
      for (const deduction of verdict.deductions) {
        expect(deduction.clauseId).not.toBe('fx.moratorium');
        expect(deduction.ruleId).not.toBe('vm.moratorium.contestability');
      }
      for (const step of verdict.trace) {
        expect(step.clauseIds).not.toContain('fx.moratorium');
      }
    }
  });

  it('does not override an unexpired waiting period even once complete', () => {
    /*
     * Admission inside the PED waiting period, assessed long after the
     * moratorium has run. The insurer may no longer contest disclosure, and the
     * claim is still nil, because those are different questions.
     */
    const early = claim({
      policyInceptionDate: INCEPTION,
      admissionDate: addMonths(INCEPTION, 12),
      dischargeDate: addMonths(INCEPTION, 12),
      arisesFromPreExistingCondition: true,
    });
    const verdict = evaluate(p, early, addMonths(INCEPTION, 72));

    expect(verdict.contestability.moratoriumComplete).toBe(true);
    expect(verdict.contestability.insurerMayContestNonDisclosure).toBe(false);
    expect(verdict.paidPaise).toBe(0n);
    expect(verdict.block?.stage).toBe('waitingPeriod');
  });

  it('does not override a permanent exclusion even once complete', () => {
    const cosmetic = claim({
      policyInceptionDate: INCEPTION,
      admissionDate: ADMISSION,
      dischargeDate: ADMISSION,
      procedure: 'cosmeticSurgery',
    });
    const verdict = evaluate(p, cosmetic, AFTER);

    expect(verdict.contestability.moratoriumComplete).toBe(true);
    expect(verdict.paidPaise).toBe(0n);
    expect(verdict.block?.stage).toBe('exclusion');
  });

  it('does not lift the co-pay or the sub-limit once complete', () => {
    /* The same four clauses bite on both sides of month sixty. */
    const stagesBefore = before.deductions.map((d) => d.stage);
    const stagesAfter = after.deductions.map((d) => d.stage);
    expect(stagesAfter).toEqual(stagesBefore);
    expect(stagesAfter).toContain('coPay');
    expect(stagesAfter).toContain('subLimit');
  });
});
