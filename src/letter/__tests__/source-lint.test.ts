/**
 * The source lint.
 *
 * No sentence in any generated appeal may be free-floating prose. Every one
 * must carry either a rule identifier from the registry or a quotation from
 * the wording, in both languages, for every ground, on every policy, for
 * claims that pay in full and claims that pay nothing.
 *
 * If this file fails, the build fails, and it should: a letter someone is
 * about to sign and send to their insurer cannot contain a sentence that
 * nobody can trace.
 */

import { describe, expect, it } from 'vitest';
import { POLICIES } from '@/policies';
import { ALL_RULE_IDS, isKnownRuleId } from '@/vm/rules';
import { PROCEDURE_CODES } from '@/vm/types';
import { APPEAL_SECTIONS, appealToText, sentenceSource } from '../appeal';
import { GROUND_KINDS, type GroundKind } from '../grounds';
import { LETTER_SAMPLES } from '../samples';
import { review } from '..';

/** Every combination a reader could reach from the interface. */
function everyReview() {
  const grounds: (GroundKind | null)[] = [...GROUND_KINDS, null];
  const out = [];
  for (const policy of POLICIES) {
    for (const procedure of ['kneeReplacement', 'cataract', 'cosmeticSurgery'] as const) {
      for (const months of [3, 25, 42, 61]) {
        for (const ground of grounds) {
          for (const insurerPaidRupees of [0, 120_000]) {
            out.push(
              review({
                letterText: 'the text is irrelevant when the ground is overridden',
                policyId: policy.id,
                procedure,
                billRupees: 400_000,
                months,
                preExisting: months % 2 === 0,
                insurerPaidRupees,
                groundOverride: ground,
              }),
            );
          }
        }
      }
    }
  }
  return out;
}

describe('the source lint', () => {
  const reviews = everyReview();

  it('covers a wide enough matrix to be worth trusting', () => {
    expect(reviews.length).toBeGreaterThanOrEqual(600);
  });

  it('gives every generated sentence a rule id or a quotation', () => {
    for (const result of reviews) {
      for (const sentence of result.appeal.sentences) {
        const source = sentenceSource(sentence);
        expect(
          source,
          `sentence "${sentence.id}" in the ${result.policy.id} appeal has no source`,
        ).not.toBe('none');
      }
    }
  });

  it('never attributes a sentence to a rule that is not in the registry', () => {
    for (const result of reviews) {
      for (const sentence of result.appeal.sentences) {
        if (!sentence.ruleId) continue;
        expect(
          isKnownRuleId(sentence.ruleId),
          `sentence "${sentence.id}" cites unknown rule "${sentence.ruleId}"`,
        ).toBe(true);
      }
    }
    expect(ALL_RULE_IDS.size).toBeGreaterThan(20);
  });

  it('writes every sentence in both languages, with neither left empty', () => {
    for (const result of reviews) {
      for (const sentence of result.appeal.sentences) {
        expect(sentence.en.trim().length, `"${sentence.id}" has no English`).toBeGreaterThan(0);
        expect(sentence.hi.trim().length, `"${sentence.id}" has no Hindi`).toBeGreaterThan(0);
        /* Hindi that is byte-identical to the English has not been written. */
        expect(sentence.hi).not.toBe(sentence.en);
        expect(sentence.hi).toMatch(/[ऀ-ॿ]/);
      }
    }
  });

  it('never leaves a template placeholder in the output', () => {
    for (const result of reviews) {
      for (const sentence of result.appeal.sentences) {
        for (const text of [sentence.en, sentence.hi]) {
          expect(text).not.toMatch(/\$\{/);
          expect(text).not.toMatch(/\bundefined\b/);
          expect(text).not.toMatch(/\bNaN\b/);
          expect(text).not.toMatch(/\[object Object\]/);
        }
      }
    }
  });

  it('keeps to the copy rules on every sentence it can produce', () => {
    const forbidden = [
      /\billegal\b/i,
      /your claim will be paid/i,
      /you will win/i,
      /\bguarantee[sd]?\b/i,
      /\bcertain(ly)? to succeed\b/i,
    ];
    for (const result of reviews) {
      for (const sentence of result.appeal.sentences) {
        for (const pattern of forbidden) {
          expect(sentence.en, `"${sentence.id}" breaks a copy rule`).not.toMatch(pattern);
        }
      }
    }
  });

  it('always states how the figures were produced, and always in the last section', () => {
    for (const result of reviews) {
      const disclaimer = result.appeal.sentences.filter((s) => s.section === 'disclaimer');
      expect(disclaimer).toHaveLength(1);
      expect(disclaimer[0]?.en).toContain('not medical, legal or financial advice');
      expect(APPEAL_SECTIONS[APPEAL_SECTIONS.length - 1]).toBe('disclaimer');
    }
  });

  it('always sets out the moratorium boundary, whichever ground was stated', () => {
    for (const result of reviews) {
      const moratorium = result.appeal.sentences.filter((s) => s.section === 'moratorium');
      expect(moratorium).toHaveLength(1);
      const text = moratorium[0]?.en ?? '';
      expect(text).toMatch(/moratorium/);
      expect(text).toMatch(/not a waiting period|does not extend cover/);
    }
  });

  it('renders to plain text in both languages without losing a sentence', () => {
    for (const result of reviews.slice(0, 50)) {
      for (const language of ['en', 'hi'] as const) {
        const text = appealToText(result.appeal, language);
        expect(text.trim().length).toBeGreaterThan(200);
        for (const sentence of result.appeal.sentences) {
          expect(text).toContain(language === 'en' ? sentence.en : sentence.hi);
        }
      }
    }
  });

  it('never cites a clause that is not in the policy it was generated against', () => {
    for (const result of reviews) {
      const refs = new Set(result.policy.clauses.map((clause) => clause.ref));
      for (const sentence of result.appeal.sentences) {
        if (!sentence.clauseRef) continue;
        expect(
          refs.has(sentence.clauseRef),
          `sentence "${sentence.id}" cites clause ${sentence.clauseRef}, absent from ${result.policy.id}`,
        ).toBe(true);
      }
    }
  });

  it('never quotes wording that is not in the policy it was generated against', () => {
    for (const result of reviews) {
      const quotes = new Set<string>();
      for (const clause of result.policy.clauses) {
        quotes.add(clause.provenance.sourceQuote);
        if (clause.kind === 'RoomRentCap' && clause.exemptionProvenance) {
          quotes.add(clause.exemptionProvenance.sourceQuote);
        }
      }
      for (const sentence of result.appeal.sentences) {
        if (!sentence.sourceQuote) continue;
        expect(
          quotes.has(sentence.sourceQuote),
          `sentence "${sentence.id}" quotes wording absent from ${result.policy.id}`,
        ).toBe(true);
      }
    }
  });

  it('sources every sentence of every appeal built from a sample letter', () => {
    for (const sample of LETTER_SAMPLES) {
      const result = review({
        letterText: sample.text,
        policyId: sample.context.policyId,
        procedure: sample.context.procedure,
        billRupees: sample.context.billRupees,
        months: sample.context.months,
        preExisting: sample.context.preExisting,
        insurerPaidRupees: sample.context.insurerPaidRupees,
      });
      for (const sentence of result.appeal.sentences) {
        expect(sentenceSource(sentence), `${sample.id}: "${sentence.id}"`).not.toBe('none');
      }
    }
  });
});
