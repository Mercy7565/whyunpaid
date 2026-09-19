/**
 * Ground detection, and the contradictions that follow from it.
 *
 * The hard case in this file is the boundary between non-disclosure and an
 * unexpired waiting period. Both letters mention a pre-existing condition;
 * only one of them is about disclosure, and only one of them is answered by
 * the moratorium. Getting that wrong would put the wrong argument in someone's
 * appeal, so it is tested from both directions.
 */

import { describe, expect, it } from 'vitest';
import { detectGround, mergeMatches } from '../grounds';
import { LETTER_SAMPLES } from '../samples';
import { review } from '..';

describe('ground detection', () => {
  it('classifies every sample letter as the ground it was written to express', () => {
    const expected: Record<string, string> = {
      'ped-non-disclosure': 'nonDisclosurePED',
      'waiting-period': 'unexpiredWaitingPeriod',
      'room-rent': 'roomRentProportionate',
      'not-medically-necessary': 'notMedicallyNecessary',
      'permanent-exclusion': 'permanentExclusion',
      documents: 'documentsIncomplete',
    };

    for (const sample of LETTER_SAMPLES) {
      const detection = detectGround(sample.text);
      expect(detection.ground, `sample "${sample.id}"`).toBe(expected[sample.id]);
      expect(detection.method).toBe('keyword');
      expect(detection.matches.length).toBeGreaterThan(0);
    }
  });

  it('separates a waiting-period letter from a non-disclosure letter', () => {
    const waiting = detectGround(
      'The pre-existing disease waiting period of 36 months was not completed on the date of admission.',
    );
    expect(waiting.ground).toBe('unexpiredWaitingPeriod');

    const disclosure = detectGround(
      'The insured failed to disclose the pre-existing ailment in the proposal form, amounting to suppression of material facts.',
    );
    expect(disclosure.ground).toBe('nonDisclosurePED');
  });

  it('returns no ground, rather than a guess, for text it cannot place', () => {
    const detection = detectGround('Thank you for your recent correspondence. We will revert.');
    expect(detection.ground).toBeNull();
    expect(detection.confidence).toBe('low');
    expect(detection.method).toBe('none');
    expect(detection.rationale).toMatch(/pick the ground by hand/);
  });

  it('handles an empty paste without throwing', () => {
    expect(detectGround('').ground).toBeNull();
    expect(detectGround('   \n  ').ground).toBeNull();
  });

  it('reports matched spans that line up with the reader’s own text', () => {
    const letter = 'The claim is rejected on account of non-disclosure of material facts.';
    const detection = detectGround(letter);
    expect(detection.ground).toBe('nonDisclosurePED');
    for (const match of detection.matches) {
      expect(match.start).toBeGreaterThanOrEqual(0);
      expect(match.end).toBeLessThanOrEqual(letter.length);
      expect(match.end).toBeGreaterThan(match.start);
    }
    const merged = mergeMatches(detection.matches);
    for (let i = 1; i < merged.length; i += 1) {
      expect((merged[i]?.start ?? 0) > (merged[i - 1]?.end ?? 0)).toBe(true);
    }
  });

  it('marks a letter that straddles two grounds as low confidence', () => {
    const detection = detectGround(
      'The room category occupied was higher than the eligibility and a proportionate deduction applies. The documents submitted were also insufficient and the discharge summary was not submitted.',
    );
    expect(detection.confidence).toBe('low');
    expect(detection.runnerUp).not.toBeNull();
  });
});

describe('contradictions', () => {
  it('reaches the moratorium when a disclosure letter arrives past month sixty', () => {
    const sample = LETTER_SAMPLES.find((s) => s.id === 'ped-non-disclosure');
    if (!sample) throw new Error('sample missing');

    const result = review({
      letterText: sample.text,
      policyId: sample.context.policyId,
      procedure: sample.context.procedure,
      billRupees: sample.context.billRupees,
      months: sample.context.months,
      preExisting: sample.context.preExisting,
      insurerPaidRupees: sample.context.insurerPaidRupees,
    });

    expect(result.ground).toBe('nonDisclosurePED');
    expect(result.verdict.contestability.moratoriumComplete).toBe(true);
    const kinds = result.contradictions.map((c) => c.kind);
    expect(kinds).toContain('moratoriumComplete');
    expect(result.contradictions[0]?.strength).toBe('direct');
  });

  it('does not reach the moratorium when it has not run', () => {
    const result = review({
      letterText: 'Repudiated for non-disclosure of material facts in the proposal form.',
      policyId: 'specimen-a',
      procedure: 'angioplasty',
      billRupees: 350_000,
      months: 40,
      preExisting: true,
      insurerPaidRupees: 0,
    });
    expect(result.verdict.contestability.moratoriumComplete).toBe(false);
    expect(result.contradictions.map((c) => c.kind)).not.toContain('moratoriumComplete');
  });

  it('contradicts a waiting-period letter when the period had expired', () => {
    const sample = LETTER_SAMPLES.find((s) => s.id === 'waiting-period');
    if (!sample) throw new Error('sample missing');

    const result = review({
      letterText: sample.text,
      policyId: sample.context.policyId,
      procedure: sample.context.procedure,
      billRupees: sample.context.billRupees,
      months: sample.context.months,
      preExisting: sample.context.preExisting,
      insurerPaidRupees: sample.context.insurerPaidRupees,
    });

    expect(result.ground).toBe('unexpiredWaitingPeriod');
    const direct = result.contradictions.filter((c) => c.strength === 'direct');
    expect(direct.map((c) => c.kind)).toContain('waitingPeriodExpired');
    expect(direct[0]?.sourceQuote).toBeTruthy();
  });

  it('agrees with the letter, and says so, when the wording supports it', () => {
    const result = review({
      letterText: 'The specified disease waiting period of 24 months was not completed.',
      policyId: 'specimen-a',
      procedure: 'kneeReplacement',
      billRupees: 400_000,
      months: 12,
      preExisting: false,
      insurerPaidRupees: 0,
    });
    expect(result.verdict.paidPaise).toBe(0n);
    expect(result.contradictions.map((c) => c.kind)).toContain('treeAgrees');
    expect(result.contradictions.every((c) => c.kind !== 'repudiationExceedsDeduction')).toBe(true);
  });

  it('names the exempt heads when a proportion was taken across the whole bill', () => {
    const sample = LETTER_SAMPLES.find((s) => s.id === 'room-rent');
    if (!sample) throw new Error('sample missing');

    const result = review({
      letterText: sample.text,
      policyId: sample.context.policyId,
      procedure: sample.context.procedure,
      billRupees: sample.context.billRupees,
      months: sample.context.months,
      preExisting: sample.context.preExisting,
      insurerPaidRupees: sample.context.insurerPaidRupees,
    });

    expect(result.ground).toBe('roomRentProportionate');
    const exempt = result.contradictions.find((c) => c.kind === 'proportionateExemptHeads');
    expect(exempt).toBeDefined();
    expect(exempt?.summary).toMatch(/pharmacy/);
    expect(exempt?.sourceQuote).toMatch(/shall not be applied to pharmacy/);

    /* The insurer settled 1,60,000; the wording reaches 2,12,000. */
    const shortfall = result.contradictions.find((c) => c.kind === 'repudiationExceedsDeduction');
    expect(shortfall).toBeDefined();
    expect(shortfall?.summary).toContain('₹2,12,000');
    expect(shortfall?.summary).toContain('₹52,000');
  });

  it('says a document closure is not a decision on the merits', () => {
    const sample = LETTER_SAMPLES.find((s) => s.id === 'documents');
    if (!sample) throw new Error('sample missing');
    const result = review({
      letterText: sample.text,
      policyId: sample.context.policyId,
      procedure: sample.context.procedure,
      billRupees: sample.context.billRupees,
      months: sample.context.months,
      preExisting: sample.context.preExisting,
      insurerPaidRupees: sample.context.insurerPaidRupees,
    });
    expect(result.ground).toBe('documentsIncomplete');
    expect(result.contradictions.map((c) => c.kind)).toContain('notADenialOnMerits');
  });

  it('says plainly when it could not read a ground at all', () => {
    const result = review({
      letterText: 'We acknowledge receipt of your email.',
      policyId: 'specimen-a',
      procedure: 'cataract',
      billRupees: 90_000,
      months: 40,
      preExisting: false,
      insurerPaidRupees: 0,
    });
    expect(result.ground).toBeNull();
    expect(result.contradictions.map((c) => c.kind)).toContain('groundNotDetected');
  });
});
