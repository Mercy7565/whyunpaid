/**
 * The no-key extractor, tested against the documents the compiler produced.
 *
 * The four specimen PDFs are typeset from the four specimen texts, so running
 * the heuristic extractor over those texts is a genuine round trip: Path A
 * wrote the wording, Path B has to read it back. It is not a soft test either,
 * because the extractor has never seen the generator and works only from the
 * prose.
 *
 * What is asserted here is that it finds the constructs and gets the numbers
 * right. What is deliberately NOT asserted is that it is trusted: almost every
 * draft comes back low confidence, and `compileDraft` refuses to compile a low
 * confidence row nobody has looked at.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blockingIssues, compileDraft, locateQuote, type DraftPolicy } from '../draft';
import {
  extractDrafts,
  parseAmountWords,
  parseCount,
  parseFigure,
  parsePercentBps,
  sentencesOf,
} from '../heuristics';
import { POLICIES } from '@/policies';
import { wordCount } from '../schema';

function wordingOf(slug: string): string {
  return readFileSync(join(process.cwd(), 'public', 'policies', `${slug}.txt`), 'utf8');
}

function draftPolicyFor(slug: string): DraftPolicy {
  const documentText = wordingOf(slug);
  return {
    name: 'Uploaded policy',
    slug: 'uploaded-policy',
    summary: 'Compiled in the browser from an uploaded document.',
    shape: 'Compiled from an uploaded document.',
    documentText,
    pageStarts: [0],
    clauses: extractDrafts(documentText),
  };
}

describe('reading numbers the way documents write them', () => {
  it('reads counts in words and in digits', () => {
    expect(parseCount('twenty-four')).toBe(24);
    expect(parseCount('thirty six')).toBe(36);
    expect(parseCount('sixty')).toBe(60);
    expect(parseCount('30')).toBe(30);
    expect(parseCount('thirty')).toBe(30);
    expect(parseCount('not a number')).toBeNull();
  });

  it('reads Indian grouping', () => {
    expect(parseFigure('5,00,000')).toBe(500_000);
    expect(parseFigure('2,65,000')).toBe(265_000);
    expect(parseFigure('25,00,000')).toBe(2_500_000);
    expect(parseFigure('')).toBeNull();
  });

  it('reads amounts written out in words', () => {
    expect(parseAmountWords('Five Lakh')).toBe(500_000);
    expect(parseAmountWords('Two Lakh Sixty-Five Thousand')).toBe(265_000);
    expect(parseAmountWords('Forty Thousand')).toBe(40_000);
    expect(parseAmountWords('Twenty-Five Lakh')).toBe(2_500_000);
    expect(parseAmountWords('One Lakh')).toBe(100_000);
  });

  it('reads percentages in both registers', () => {
    expect(parsePercentBps('one per cent')).toBe(100);
    expect(parsePercentBps('twenty per cent')).toBe(2_000);
    expect(parsePercentBps('thirty per cent')).toBe(3_000);
    expect(parsePercentBps('one and a half per cent')).toBe(150);
    expect(parsePercentBps('20%')).toBe(2_000);
    expect(parsePercentBps('1.5%')).toBe(150);
  });

  it('does not split a sentence at "Rs."', () => {
    const text = 'The limit is Rs. 40,000 per eye. The next sentence starts here.';
    const sentences = sentencesOf(text);
    expect(sentences).toHaveLength(2);
    expect(sentences[0]?.text).toContain('Rs. 40,000 per eye.');
  });
});

describe.each(POLICIES.map((p) => [p.name, p.slug, p.id] as const))(
  'reading %s back with no model',
  (_name, slug, id) => {
    const draft = draftPolicyFor(slug);
    const byKind = (kind: string) => draft.clauses.filter((clause) => clause.kind === kind);
    const shipped = POLICIES.find((p) => p.id === id);
    if (!shipped) throw new Error('policy missing');

    it('finds the sum insured and reads the figure correctly', () => {
      const found = byKind('SumInsured');
      expect(found).toHaveLength(1);
      const shippedSi = shipped.clauses.find((c) => c.kind === 'SumInsured');
      if (shippedSi?.kind !== 'SumInsured') throw new Error('no sum insured');
      expect(BigInt(found[0]?.amountRupees ?? 0) * 100n).toBe(shippedSi.amountPaise);
    });

    it('finds the moratorium', () => {
      const found = byKind('Moratorium');
      expect(found).toHaveLength(1);
      expect(found[0]?.months).toBe(60);
    });

    it('finds all three waiting periods and reads their lengths', () => {
      const found = byKind('WaitingPeriod');
      expect(found.length).toBeGreaterThanOrEqual(3);

      const shippedWaits = shipped.clauses.filter((c) => c.kind === 'WaitingPeriod');
      for (const expected of shippedWaits) {
        if (expected.kind !== 'WaitingPeriod') continue;
        const match = found.find((d) => d.waitingKind === expected.waitingKind);
        expect(match, `no draft for ${expected.waitingKind}`).toBeDefined();
        expect(match?.months, `${expected.waitingKind} length`).toBe(expected.months);
      }
    });

    it('finds the permanent exclusions and the procedures they name', () => {
      const found = byKind('PermanentExclusion');
      expect(found).toHaveLength(1);
      const shippedExclusion = shipped.clauses.find((c) => c.kind === 'PermanentExclusion');
      if (shippedExclusion?.kind !== 'PermanentExclusion') throw new Error('no exclusions');
      for (const procedure of shippedExclusion.procedures) {
        expect(found[0]?.procedures ?? []).toContain(procedure);
      }
    });

    it('finds the non-payable heads', () => {
      expect(byKind('LineItemIneligibility')).toHaveLength(1);
      expect(byKind('LineItemIneligibility')[0]?.categories).toContain('nonMedical');
    });

    it('finds every sub-limit in the wording, with the right cap', () => {
      const shippedLimits = shipped.clauses.filter((c) => c.kind === 'SubLimit');
      const found = byKind('SubLimit');
      expect(found.length).toBe(shippedLimits.length);

      for (const expected of shippedLimits) {
        if (expected.kind !== 'SubLimit') continue;
        const procedure = expected.procedures[0];
        const match = found.find((d) => (d.procedures ?? []).includes(procedure!));
        expect(match, `no draft sub-limit for ${procedure}`).toBeDefined();
        expect(BigInt(match?.amountRupees ?? 0) * 100n).toBe(expected.capPaise);
      }
    });

    it('finds the room rent cap where the wording has one, and not where it does not', () => {
      const shippedCap = shipped.clauses.find((c) => c.kind === 'RoomRentCap');
      const found = byKind('RoomRentCap');
      if (!shippedCap) {
        expect(found).toHaveLength(0);
        return;
      }
      expect(found).toHaveLength(1);
      if (shippedCap.kind !== 'RoomRentCap') throw new Error('bad clause');
      if (shippedCap.limit.basis === 'percentOfSumInsuredPerDay') {
        expect(found[0]?.limitBasis).toBe('percentOfSumInsuredPerDay');
        expect(found[0]?.percentBps).toBe(shippedCap.limit.percentBps);
      } else {
        expect(found[0]?.limitBasis).toBe('perDayAmount');
        expect(BigInt(found[0]?.perDayRupees ?? 0) * 100n).toBe(shippedCap.limit.perDayPaise);
      }
    });

    it('finds the co-payment where the wording has one', () => {
      const shippedCoPay = shipped.clauses.find((c) => c.kind === 'CoPay');
      const found = byKind('CoPay');
      if (!shippedCoPay) {
        expect(found).toHaveLength(0);
        return;
      }
      if (shippedCoPay.kind !== 'CoPay') throw new Error('bad clause');
      expect(found).toHaveLength(1);
      expect(found[0]?.percentBps).toBe(shippedCoPay.percentBps);
    });

    it('finds the deductible where the wording has one', () => {
      const shippedDeductible = shipped.clauses.find((c) => c.kind === 'Deductible');
      const found = byKind('Deductible');
      if (!shippedDeductible) {
        expect(found).toHaveLength(0);
        return;
      }
      if (shippedDeductible.kind !== 'Deductible') throw new Error('bad clause');
      expect(found).toHaveLength(1);
      expect(BigInt(found[0]?.amountRupees ?? 0) * 100n).toBe(shippedDeductible.amountPaise);
    });

    it('quotes wording that is in the document, once, and within 25 words', () => {
      for (const clause of draft.clauses) {
        expect(wordCount(clause.quote), `${clause.id} quote length`).toBeLessThanOrEqual(25);
        const located = locateQuote(clause.quote, draft.documentText, draft.pageStarts);
        expect(located.found, `${clause.id}: ${'reason' in located ? located.reason : ''}`).toBe(
          true,
        );
      }
    });

    it('refuses to compile until a person has confirmed the low-confidence rows', () => {
      const issues = blockingIssues(draft);
      const untouched = draft.clauses.filter((c) => c.confidence === 'low' && !c.touched);
      expect(untouched.length).toBeGreaterThan(0);
      expect(issues.filter((i) => i.severity === 'blocking').length).toBeGreaterThan(0);
      expect(compileDraft(draft).ok).toBe(false);
    });

    it('compiles once every row has been confirmed, and runs', () => {
      const confirmed: DraftPolicy = {
        ...draft,
        clauses: draft.clauses.map((clause) => ({ ...clause, touched: true })),
      };
      const result = compileDraft(confirmed);
      if (!result.ok) {
        throw new Error(
          `expected a compile: ${result.issues.map((i) => i.message).join('; ')}`,
        );
      }
      expect(result.policy.clauses.length).toBe(draft.clauses.length);
      for (const clause of result.policy.clauses) {
        expect(clause.provenance.sourceQuote.length).toBeGreaterThan(0);
        expect(clause.provenance.charEnd).toBeGreaterThan(clause.provenance.charStart);
      }
    });
  },
);
