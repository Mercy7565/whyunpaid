/**
 * Golden scenarios.
 *
 * One scenario per clause kind and per deduction stage, plus the combinations
 * where the order of the stages is what decides the answer. Each is snapshotted
 * in full: the deductions in order, the clause that caused each one, the
 * sentence shown to the user, and the eight-step trace. A snapshot that moves
 * is a change in what this product tells someone about their money, so it
 * should be read line by line before it is accepted.
 */

import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { formatPaise } from '../format';
import type { Claim, CompiledPolicy, Verdict } from '../types';
import { CLAUSES, claim, kneeBill, line, policy } from './fixtures';

const SI_5L = 50_000_000n;

/** The policy behind the headline: four lakh becomes two lakh twelve thousand. */
function demoPolicy(): CompiledPolicy {
  return policy('demo', [
    CLAUSES.sumInsured(SI_5L),
    CLAUSES.moratorium(60),
    CLAUSES.permanentExclusion(['cosmeticSurgery']),
    CLAUSES.waiting('fx.wait.initial', '4.1', 1, 'initial', { scope: 'all' }),
    CLAUSES.waiting('fx.wait.specific', '4.2a', 24, 'specificDisease', {
      scope: 'procedures',
      procedures: ['cataract', 'herniaRepair', 'kneeReplacement'],
    }),
    CLAUSES.waiting('fx.wait.ped', '4.3', 36, 'preExistingDisease', { scope: 'preExisting' }),
    CLAUSES.ineligible(['nonMedical']),
    CLAUSES.roomCapPercentOfSi(100),
    CLAUSES.subLimit(['kneeReplacement'], 26_500_000n),
    CLAUSES.coPay(2_000),
  ]);
}

/**
 * A readable projection of the verdict. Snapshotting the raw object would bury
 * the interesting facts under bigint noise; this keeps both the exact paise and
 * the rupee figure a human would check against.
 */
function golden(verdict: Verdict) {
  return {
    claimed: `${formatPaise(verdict.claimedPaise)} (${verdict.claimedPaise} paise)`,
    paid: `${formatPaise(verdict.paidPaise)} (${verdict.paidPaise} paise)`,
    monthsOfCoverAtTest: verdict.monthsOfCoverAtTest,
    testedAt: verdict.testedAt,
    deductions: verdict.deductions.map((d) => ({
      stage: d.stage,
      amount: `${formatPaise(d.amountPaise)} (${d.amountPaise} paise)`,
      clause: `${d.clauseRef} ${d.clauseTitle}`,
      ruleId: d.ruleId,
      humanReason: d.humanReason,
      basisKind: d.basis.kind,
    })),
    block: verdict.block
      ? { stage: verdict.block.stage, clauseRef: verdict.block.clauseRef, ruleId: verdict.block.ruleId }
      : null,
    contestability: {
      moratoriumComplete: verdict.contestability.moratoriumComplete,
      insurerMayContestNonDisclosure: verdict.contestability.insurerMayContestNonDisclosure,
      monthsOfContinuousCover: verdict.contestability.monthsOfContinuousCover,
    },
    trace: verdict.trace.map(
      (t) =>
        `${t.order}. ${t.stage} ${t.reached ? (t.applied ? 'APPLIED' : 'no-op') : 'unreached'} ${formatPaise(t.beforePaise)} -> ${formatPaise(t.afterPaise)} | ${t.note}`,
    ),
  };
}

function run(p: CompiledPolicy, c: Claim, asOf = c.admissionDate) {
  return golden(evaluate(p, c, asOf));
}

describe('golden scenarios', () => {
  it('01 pays a clean claim in full when no clause bites', () => {
    const p = policy('clean', [CLAUSES.sumInsured(SI_5L), CLAUSES.moratorium(60)]);
    const c = claim({ lines: [line('l1', 'surgeon', 80_000)] });
    expect(run(p, c)).toMatchSnapshot();
  });

  it('02 refuses the whole claim for a permanent exclusion', () => {
    const c = claim({ procedure: 'cosmeticSurgery' });
    expect(run(demoPolicy(), c)).toMatchSnapshot();
  });

  it('03 refuses the whole claim inside the initial waiting period', () => {
    const c = claim({ policyInceptionDate: '2024-09-20', admissionDate: '2024-10-01' });
    expect(run(demoPolicy(), c)).toMatchSnapshot();
  });

  it('04 refuses the whole claim inside a named-condition waiting period', () => {
    const c = claim({ policyInceptionDate: '2023-06-01', admissionDate: '2024-10-01' });
    expect(run(demoPolicy(), c)).toMatchSnapshot();
  });

  it('05 refuses the whole claim inside the pre-existing disease waiting period', () => {
    const c = claim({
      policyInceptionDate: '2022-04-01',
      admissionDate: '2024-10-01',
      arisesFromPreExistingCondition: true,
    });
    expect(run(demoPolicy(), c)).toMatchSnapshot();
  });

  it('06 reports the most binding wait when two are unexpired at once', () => {
    const p = policy('twoWaits', [
      CLAUSES.sumInsured(SI_5L),
      CLAUSES.moratorium(60),
      CLAUSES.waiting('fx.wait.a', '4.1', 12, 'specificDisease', {
        scope: 'procedures',
        procedures: ['kneeReplacement'],
      }),
      CLAUSES.waiting('fx.wait.b', '4.3', 48, 'preExistingDisease', { scope: 'preExisting' }),
    ]);
    const c = claim({
      policyInceptionDate: '2024-04-01',
      admissionDate: '2024-10-01',
      arisesFromPreExistingCondition: true,
    });
    expect(run(p, c)).toMatchSnapshot();
  });

  it('07 removes non-payable line items and nothing else', () => {
    const p = policy('ineligibleOnly', [
      CLAUSES.sumInsured(SI_5L),
      CLAUSES.moratorium(60),
      CLAUSES.ineligible(['nonMedical']),
    ]);
    expect(run(p, claim())).toMatchSnapshot();
  });

  it('08 reduces associated heads in proportion and leaves exempt heads untouched', () => {
    const p = policy('roomOnly', [
      CLAUSES.sumInsured(SI_5L),
      CLAUSES.moratorium(60),
      CLAUSES.roomCapPerDay(500_000n),
    ]);
    const verdict = evaluate(p, claim(), '2024-10-01');
    const room = verdict.deductions.find((d) => d.stage === 'roomRentProportionate');
    expect(room).toBeDefined();
    if (room?.basis.kind !== 'proportionate') throw new Error('expected a proportionate basis');

    /* The exemption is the point of the scenario: assert it, do not only snapshot it. */
    const touched = room.basis.lines.map((l) => l.category);
    expect(touched).not.toContain('pharmacy');
    expect(touched).not.toContain('consumables');
    expect(touched).not.toContain('implants');
    expect(touched).not.toContain('diagnostics');
    expect(room.basis.exemptedPaise).toBe(17_600_000n);

    expect(golden(verdict)).toMatchSnapshot();
  });

  it('09 takes nothing when the room occupied is within the eligible room rent', () => {
    const p = policy('roomWithin', [
      CLAUSES.sumInsured(SI_5L),
      CLAUSES.moratorium(60),
      CLAUSES.roomCapPerDay(1_200_000n),
    ]);
    expect(run(p, claim())).toMatchSnapshot();
  });

  it('10 applies a per-procedure sub-limit to what survives the earlier stages', () => {
    const p = policy('subLimitOnly', [
      CLAUSES.sumInsured(SI_5L),
      CLAUSES.moratorium(60),
      CLAUSES.subLimit(['cataract'], 4_000_000n),
    ]);
    const c = claim({
      procedure: 'cataract',
      lines: [line('l1', 'surgeon', 55_000), line('l2', 'implants', 30_000)],
    });
    expect(run(p, c)).toMatchSnapshot();
  });

  it('11 applies a deductible to the admissible amount', () => {
    const p = policy('deductibleOnly', [
      CLAUSES.sumInsured(SI_5L),
      CLAUSES.moratorium(60),
      CLAUSES.deductible(2_500_000n),
    ]);
    expect(run(p, claim())).toMatchSnapshot();
  });

  it('12 applies the co-pay last, on the admissible amount', () => {
    const p = policy('coPayOnly', [
      CLAUSES.sumInsured(SI_5L),
      CLAUSES.moratorium(60),
      CLAUSES.coPay(2_000),
    ]);
    expect(run(p, claim())).toMatchSnapshot();
  });

  it('13 caps the admissible amount at the sum insured', () => {
    const p = policy('smallSi', [CLAUSES.sumInsured(15_000_000n), CLAUSES.moratorium(60)]);
    expect(run(p, claim())).toMatchSnapshot();
  });

  it('14 the headline: four lakh becomes two lakh twelve thousand across four clauses', () => {
    const verdict = evaluate(demoPolicy(), claim(), '2024-10-01');

    expect(verdict.claimedPaise).toBe(40_000_000n);
    expect(verdict.paidPaise).toBe(21_200_000n);
    expect(verdict.deductions).toHaveLength(4);
    expect(verdict.deductions.map((d) => d.stage)).toEqual([
      'lineItemIneligible',
      'roomRentProportionate',
      'subLimit',
      'coPay',
    ]);
    expect(formatPaise(verdict.paidPaise)).toBe('₹2,12,000');

    expect(golden(verdict)).toMatchSnapshot();
  });

  it('15 handles a bill of zero without inventing a deduction', () => {
    const p = demoPolicy();
    const c = claim({ lines: [line('l1', 'surgeon', 0)], roomActualPerDayPaise: 0n });
    expect(run(p, c)).toMatchSnapshot();
  });

  it('16 proves the order: the sub-limit is reached after the room proportion, not before', () => {
    /*
     * Same policy, same bill, two orders. Applying the sub-limit first would cap
     * at 2,65,000 and then proportion it down; applying the room proportion
     * first, as the pipeline does, proportions 3,95,000 and then caps. The two
     * answers differ, which is exactly why the order is fixed and tested.
     */
    const verdict = evaluate(demoPolicy(), claim(), '2024-10-01');
    const room = verdict.deductions.find((d) => d.stage === 'roomRentProportionate');
    const sub = verdict.deductions.find((d) => d.stage === 'subLimit');

    if (room?.basis.kind !== 'proportionate') throw new Error('expected a proportionate basis');
    if (sub?.basis.kind !== 'cap') throw new Error('expected a cap basis');

    /* The proportion saw the full 3,95,000, not the capped 2,65,000. */
    expect(sub.basis.beforePaise).toBe(29_766_667n);
    expect(room.basis.associatedBeforePaise).toBe(21_900_000n);

    const indexRoom = verdict.deductions.indexOf(room);
    const indexSub = verdict.deductions.indexOf(sub);
    expect(indexRoom).toBeLessThan(indexSub);

    expect(golden(verdict)).toMatchSnapshot();
  });

  it('17 runs every stage in one claim, in order', () => {
    const p = policy('everything', [
      CLAUSES.sumInsured(20_000_000n),
      CLAUSES.moratorium(60),
      CLAUSES.permanentExclusion(['cosmeticSurgery']),
      CLAUSES.waiting('fx.wait.initial', '4.1', 1, 'initial', { scope: 'all' }),
      CLAUSES.ineligible(['nonMedical']),
      CLAUSES.roomCapPerDay(500_000n),
      CLAUSES.subLimit(['kneeReplacement'], 25_000_000n),
      CLAUSES.deductible(1_000_000n),
      CLAUSES.coPay(1_000),
    ]);
    const c = claim({ lines: kneeBill().map((l) => ({ ...l, amountPaise: l.amountPaise * 3n })) });
    expect(run(p, { ...c, roomActualPerDayPaise: 2_700_000n })).toMatchSnapshot();
  });

  it('18 treats a head listed as both associated and exempt as exempt', () => {
    const p = policy('overlap', [
      CLAUSES.sumInsured(SI_5L),
      CLAUSES.moratorium(60),
      {
        kind: 'RoomRentCap',
        id: 'fx.roomCap',
        ref: '4.2',
        title: 'Room rent limit and proportionate deduction',
        limit: { basis: 'perDayAmount', perDayPaise: 500_000n },
        associatedCategories: ['room', 'nursing', 'surgeon', 'anaesthetist', 'operationTheatre'],
        exemptCategories: ['pharmacy', 'consumables', 'implants', 'diagnostics', 'surgeon'],
        provenance: {
          sourceQuote: 'Surgeon fees shall not abate with the room rent under this endorsement.',
          page: 1,
          charStart: 9_000,
          charEnd: 9_070,
          confidence: 'high',
        },
      },
    ]);
    const verdict = evaluate(p, claim(), '2024-10-01');
    const room = verdict.deductions.find((d) => d.stage === 'roomRentProportionate');
    if (room?.basis.kind !== 'proportionate') throw new Error('expected a proportionate basis');
    expect(room.basis.lines.map((l) => l.category)).not.toContain('surgeon');
    expect(golden(verdict)).toMatchSnapshot();
  });
});
