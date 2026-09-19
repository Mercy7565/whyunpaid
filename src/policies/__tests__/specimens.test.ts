/**
 * The shipped specimens, held to the promise the product makes about them.
 *
 * A clause with no provenance is a bug, so this file proves that every clause
 * in every shipped policy quotes its source, that the quote is at most
 * twenty-five words, and that the character range it claims really does contain
 * that quote in the wording the specimen PDF was typeset from. If any of that
 * drifts, the inspector would highlight the wrong words and the appeal would
 * cite wording that is not there.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_QUOTE_WORDS, parseCompiledPolicy, wordCount } from '@/compiler/schema';
import { BILL_PROFILES, buildClaim, profileWeightTotal } from '@/claims/buildClaim';
import { POLICIES } from '@/policies';
import { evaluate } from '@/vm/evaluate';
import { formatPaise } from '@/vm/format';
import { sumInsuredOf } from '@/vm/selectors';
import { PROCEDURE_CODES } from '@/vm/types';
import type { CompiledPolicy, Provenance } from '@/vm/types';

const PUBLIC = join(process.cwd(), 'public', 'policies');

type SpansFile = { pages: number; spans: [number, number, number, number, number, number, number][] };

function wordingOf(policy: CompiledPolicy): string {
  return readFileSync(join(PUBLIC, `${policy.slug}.txt`), 'utf8');
}

function spansOf(policy: CompiledPolicy): SpansFile {
  return JSON.parse(readFileSync(join(PUBLIC, `${policy.slug}.spans.json`), 'utf8')) as SpansFile;
}

describe('the shipped specimen policies', () => {
  it('ships exactly four, all marked synthetic, none naming an insurer', () => {
    expect(POLICIES).toHaveLength(4);
    for (const policy of POLICIES) {
      expect(policy.synthetic).toBe(true);
      expect(policy.name).toMatch(/^Specimen Floater [A-D]$/);
    }
  });

  it('parses every one of them through the boundary schema', () => {
    for (const policy of POLICIES) {
      expect(() => parseCompiledPolicy(JSON.parse(serialise(policy)), policy.id)).not.toThrow();
    }
  });

  describe.each(POLICIES.map((policy) => [policy.name, policy] as const))('%s', (_name, policy) => {
    const wording = wordingOf(policy);
    const spans = spansOf(policy);

    it('gives every clause a quotable source', () => {
      expect(policy.clauses.length).toBeGreaterThan(0);
      for (const clause of policy.clauses) {
        expect(clause.provenance, `clause ${clause.ref} has no provenance`).toBeDefined();
        expect(clause.provenance.sourceQuote.trim().length).toBeGreaterThan(0);
        expect(clause.provenance.confidence).toBe('high');
      }
    });

    it('keeps every quote inside the twenty-five word limit', () => {
      for (const clause of policy.clauses) {
        expect(
          wordCount(clause.provenance.sourceQuote),
          `clause ${clause.ref} quote is too long`,
        ).toBeLessThanOrEqual(MAX_QUOTE_WORDS);
      }
    });

    it('points every character range at the words it claims to quote', () => {
      const check = (ref: string, provenance: Provenance) => {
        const slice = wording.slice(provenance.charStart, provenance.charEnd);
        expect(slice, `clause ${ref} range does not contain its quote`).toBe(
          provenance.sourceQuote,
        );
        expect(provenance.page).toBeGreaterThanOrEqual(1);
        expect(provenance.page).toBeLessThanOrEqual(spans.pages);
      };

      for (const clause of policy.clauses) {
        check(clause.ref, clause.provenance);
        if (clause.kind === 'RoomRentCap' && clause.exemptionProvenance) {
          check(`${clause.ref} exemption`, clause.exemptionProvenance);
        }
      }
    });

    it('has a typeset box for every quoted range, so the inspector can highlight it', () => {
      for (const clause of policy.clauses) {
        const { charStart, charEnd } = clause.provenance;
        const covering = spans.spans.filter(([start, end]) => end > charStart && start < charEnd);
        expect(covering.length, `clause ${clause.ref} has no highlight box`).toBeGreaterThan(0);
        for (const [, , page] of covering) {
          expect(page).toBeGreaterThanOrEqual(1);
          expect(page).toBeLessThanOrEqual(spans.pages);
        }
      }
    });

    it('exempts pharmacy, consumables, implants and diagnostics wherever it caps room rent', () => {
      for (const clause of policy.clauses) {
        if (clause.kind !== 'RoomRentCap') continue;
        expect([...clause.exemptCategories].sort()).toEqual([
          'consumables',
          'diagnostics',
          'implants',
          'pharmacy',
        ]);
        expect(clause.exemptionProvenance).toBeDefined();
      }
    });

    it('produces a balanced verdict across every procedure, bill and length of cover', () => {
      const sumInsured = sumInsuredOf(policy).amountPaise;
      for (const procedure of PROCEDURE_CODES) {
        for (const billRupees of [25_000, 400_000, 1_800_000]) {
          for (const months of [0, 11, 23, 24, 36, 47, 59, 61, 84]) {
            for (const preExisting of [false, true]) {
              const { claim } = buildClaim({
                procedure,
                billPaise: BigInt(billRupees) * 100n,
                monthsSinceInception: months,
                preExisting,
              });
              const verdict = evaluate(policy, claim, claim.admissionDate);
              const deducted = verdict.deductions.reduce((t, d) => t + d.amountPaise, 0n);

              expect(verdict.paidPaise + deducted).toBe(verdict.claimedPaise);
              expect(verdict.paidPaise <= verdict.claimedPaise).toBe(true);
              expect(verdict.paidPaise <= sumInsured).toBe(true);
              expect(verdict.claimedPaise).toBe(BigInt(billRupees) * 100n);
            }
          }
        }
      }
    });
  });

  it('splits every bill profile into shares that total the whole bill', () => {
    for (const procedure of PROCEDURE_CODES) {
      expect(profileWeightTotal(procedure), `${procedure} weights`).toBe(10_000);
      expect(BILL_PROFILES[procedure].days).toBeGreaterThanOrEqual(1);
    }
  });

  it('produces the headline figure a visitor sees on first load', () => {
    const policy = POLICIES.find((p) => p.id === 'specimen-a');
    if (!policy) throw new Error('Specimen Floater A is missing');

    const { claim } = buildClaim({
      procedure: 'kneeReplacement',
      billPaise: 40_000_000n,
      monthsSinceInception: 42,
      preExisting: false,
    });
    const verdict = evaluate(policy, claim, claim.admissionDate);

    expect(formatPaise(verdict.claimedPaise)).toBe('₹4,00,000');
    expect(formatPaise(verdict.paidPaise)).toBe('₹2,12,000');
    expect(verdict.deductions).toHaveLength(4);
    expect(verdict.deductions.map((d) => d.clauseRef)).toEqual(['3.9', '4.2', '4.6(b)', '4.9']);
    expect(verdict.contestability.moratoriumComplete).toBe(false);
  });

  it('flips contestability, and only contestability, past the sixtieth month', () => {
    const policy = POLICIES.find((p) => p.id === 'specimen-a');
    if (!policy) throw new Error('Specimen Floater A is missing');

    const at42 = buildClaim({
      procedure: 'kneeReplacement',
      billPaise: 40_000_000n,
      monthsSinceInception: 42,
      preExisting: false,
    });
    const at61 = buildClaim({
      procedure: 'kneeReplacement',
      billPaise: 40_000_000n,
      monthsSinceInception: 61,
      preExisting: false,
    });

    const before = evaluate(policy, at42.claim, at42.claim.admissionDate);
    const after = evaluate(policy, at61.claim, at61.claim.admissionDate);

    expect(before.paidPaise).toBe(after.paidPaise);
    expect(before.deductions.map((d) => d.amountPaise)).toEqual(
      after.deductions.map((d) => d.amountPaise),
    );
    expect(before.contestability.insurerMayContestNonDisclosure).toBe(true);
    expect(after.contestability.insurerMayContestNonDisclosure).toBe(false);
  });
});

/** bigints do not survive JSON.stringify, so the round-trip check puts them back. */
function serialise(policy: CompiledPolicy): string {
  return JSON.stringify(policy, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}
