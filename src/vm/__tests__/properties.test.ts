/**
 * Invariants.
 *
 * The golden scenarios say what the machine answers for eighteen specific
 * claims. These say what it must never do for any claim at all. Between them,
 * a reader who does not trust the snapshots still has something to hold on to.
 *
 * Every invariant here is checked with exact bigint equality. There is no
 * tolerance anywhere in this file, because a rupee that cannot be attributed to
 * a clause is the exact failure this product exists to expose.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addMonths } from '../dates';
import { evaluate } from '../evaluate';
import { sumInsuredOf } from '../selectors';
import type { Claim, Clause, CompiledPolicy, LineCategory, ProcedureCode, Verdict } from '../types';
import { LINE_CATEGORIES, PROCEDURE_CODES } from '../types';
import { CLAUSES, policy } from './fixtures';

const RUNS = 400;

/** Verdicts compared as text, so bigints and key order are both visible. */
function stable(verdict: Verdict): string {
  return JSON.stringify(verdict, (_key, value) =>
    typeof value === 'bigint' ? `${value}n` : value,
  );
}

function sumDeductions(verdict: Verdict): bigint {
  return verdict.deductions.reduce((total, d) => total + d.amountPaise, 0n);
}

/* -------------------------------------------------------------------------- */
/* Arbitraries                                                                */
/* -------------------------------------------------------------------------- */

const paise = (max: number) =>
  fc.integer({ min: 0, max }).map((rupees) => BigInt(rupees) * 100n);

const category = fc.constantFrom<LineCategory>(...LINE_CATEGORIES);
const procedure = fc.constantFrom<ProcedureCode>(...PROCEDURE_CODES);

const arbLines = fc
  .array(fc.tuple(category, paise(200_000)), { minLength: 1, maxLength: 12 })
  .map((entries) =>
    entries.map(([cat, amountPaise], index) => ({
      id: `l${String(index).padStart(2, '0')}`,
      label: `Line ${index}`,
      category: cat,
      amountPaise,
    })),
  );

const arbPolicy: fc.Arbitrary<CompiledPolicy> = fc
  .record({
    sumInsuredRupees: fc.integer({ min: 1, max: 2_500_000 }),
    moratoriumMonths: fc.constantFrom(60),
    exclusions: fc.subarray([...PROCEDURE_CODES], { maxLength: 3 }),
    initialWaitMonths: fc.integer({ min: 0, max: 6 }),
    specificWaitMonths: fc.integer({ min: 0, max: 48 }),
    specificWaitProcedures: fc.subarray([...PROCEDURE_CODES], { maxLength: 4 }),
    pedWaitMonths: fc.integer({ min: 0, max: 60 }),
    hasIneligible: fc.boolean(),
    ineligibleCategories: fc.subarray([...LINE_CATEGORIES], { maxLength: 3 }),
    hasRoomCap: fc.boolean(),
    roomCapRupees: fc.integer({ min: 0, max: 30_000 }),
    hasSubLimit: fc.boolean(),
    subLimitProcedures: fc.subarray([...PROCEDURE_CODES], { maxLength: 4 }),
    subLimitRupees: fc.integer({ min: 0, max: 800_000 }),
    hasDeductible: fc.boolean(),
    deductibleRupees: fc.integer({ min: 0, max: 200_000 }),
    hasCoPay: fc.boolean(),
    coPayBps: fc.integer({ min: 0, max: 10_000 }),
  })
  .map((spec) => {
    const clauses: Clause[] = [
      CLAUSES.sumInsured(BigInt(spec.sumInsuredRupees) * 100n),
      CLAUSES.moratorium(spec.moratoriumMonths),
      CLAUSES.permanentExclusion(spec.exclusions),
      CLAUSES.waiting('fx.wait.initial', '4.1', spec.initialWaitMonths, 'initial', {
        scope: 'all',
      }),
      CLAUSES.waiting('fx.wait.specific', '4.2a', spec.specificWaitMonths, 'specificDisease', {
        scope: 'procedures',
        procedures: spec.specificWaitProcedures,
      }),
      CLAUSES.waiting('fx.wait.ped', '4.3', spec.pedWaitMonths, 'preExistingDisease', {
        scope: 'preExisting',
      }),
    ];
    if (spec.hasIneligible) clauses.push(CLAUSES.ineligible(spec.ineligibleCategories));
    if (spec.hasRoomCap) clauses.push(CLAUSES.roomCapPerDay(BigInt(spec.roomCapRupees) * 100n));
    if (spec.hasSubLimit) {
      clauses.push(CLAUSES.subLimit(spec.subLimitProcedures, BigInt(spec.subLimitRupees) * 100n));
    }
    if (spec.hasDeductible) {
      clauses.push(CLAUSES.deductible(BigInt(spec.deductibleRupees) * 100n));
    }
    if (spec.hasCoPay) clauses.push(CLAUSES.coPay(spec.coPayBps));
    return policy('property', clauses);
  });

const INCEPTION = '2019-03-15';

const arbClaim: fc.Arbitrary<Claim> = fc
  .record({
    months: fc.integer({ min: 0, max: 90 }),
    stayDays: fc.integer({ min: 0, max: 20 }),
    proc: procedure,
    ped: fc.boolean(),
    roomRupees: fc.integer({ min: 0, max: 40_000 }),
    lines: arbLines,
  })
  .map((spec) => {
    const admissionDate = addMonths(INCEPTION, spec.months);
    return {
      id: 'property-claim',
      policyInceptionDate: INCEPTION,
      admissionDate,
      dischargeDate: addMonths(admissionDate, 0),
      procedure: spec.proc,
      arisesFromPreExistingCondition: spec.ped,
      roomActualPerDayPaise: BigInt(spec.roomRupees) * 100n,
      lines: spec.lines,
    } satisfies Claim;
  });

/* -------------------------------------------------------------------------- */
/* The invariants                                                             */
/* -------------------------------------------------------------------------- */

describe('invariants', () => {
  it('I1 never pays more than was claimed', () => {
    fc.assert(
      fc.property(arbPolicy, arbClaim, (p, c) => {
        const verdict = evaluate(p, c, c.admissionDate);
        expect(verdict.paidPaise <= verdict.claimedPaise).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it('I2 paid plus every deduction equals claimed, exactly', () => {
    fc.assert(
      fc.property(arbPolicy, arbClaim, (p, c) => {
        const verdict = evaluate(p, c, c.admissionDate);
        expect(verdict.paidPaise + sumDeductions(verdict)).toBe(verdict.claimedPaise);
      }),
      { numRuns: RUNS },
    );
  });

  it('I3 never pays more than the sum insured', () => {
    fc.assert(
      fc.property(arbPolicy, arbClaim, (p, c) => {
        const verdict = evaluate(p, c, c.admissionDate);
        expect(verdict.paidPaise <= sumInsuredOf(p).amountPaise).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it('I4 never pays less as months of cover increase', () => {
    fc.assert(
      fc.property(
        arbPolicy,
        arbClaim,
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 60 }),
        (p, c, a, b) => {
          const [low, high] = a <= b ? [a, b] : [b, a];
          const early = { ...c, admissionDate: addMonths(c.policyInceptionDate, low) };
          const late = { ...c, admissionDate: addMonths(c.policyInceptionDate, high) };
          const paidEarly = evaluate(p, early, early.admissionDate).paidPaise;
          const paidLate = evaluate(p, late, late.admissionDate).paidPaise;
          expect(paidLate >= paidEarly).toBe(true);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('I5 is idempotent: the same inputs always give the same verdict', () => {
    fc.assert(
      fc.property(arbPolicy, arbClaim, (p, c) => {
        const first = evaluate(p, c, c.admissionDate);
        const second = evaluate(p, c, c.admissionDate);
        expect(stable(second)).toBe(stable(first));
      }),
      { numRuns: RUNS },
    );
  });

  it('I6 is order-independent: shuffling clauses and bill lines changes nothing', () => {
    fc.assert(
      fc.property(
        arbPolicy,
        arbClaim,
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (p, c, seed) => {
          const shuffledClauses = permute(p.clauses, seed);
          const shuffledLines = permute(c.lines, seed * 7 + 1);
          const reference = evaluate(p, c, c.admissionDate);
          const shuffled = evaluate(
            { ...p, clauses: shuffledClauses },
            { ...c, lines: shuffledLines },
            c.admissionDate,
          );
          expect(stable(shuffled)).toBe(stable(reference));
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('I7 is key-order-independent: rebuilding the inputs with reversed keys changes nothing', () => {
    fc.assert(
      fc.property(arbPolicy, arbClaim, (p, c) => {
        const reference = evaluate(p, c, c.admissionDate);
        const shuffled = evaluate(
          reverseKeys(p) as CompiledPolicy,
          reverseKeys(c) as Claim,
          c.admissionDate,
        );
        expect(stable(shuffled)).toBe(stable(reference));
      }),
      { numRuns: RUNS },
    );
  });

  it('I8 attributes every deduction to a clause that exists in the policy', () => {
    fc.assert(
      fc.property(arbPolicy, arbClaim, (p, c) => {
        const verdict = evaluate(p, c, c.admissionDate);
        const ids = new Set(p.clauses.map((clause) => clause.id));
        for (const deduction of verdict.deductions) {
          expect(ids.has(deduction.clauseId)).toBe(true);
          expect(deduction.amountPaise > 0n).toBe(true);
          expect(deduction.sourceQuote.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: RUNS },
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** A deterministic permutation, so a counterexample can be replayed exactly. */
function permute<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  let state = seed % 2_147_483_647;
  if (state <= 0) state += 2_147_483_646;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 16_807) % 2_147_483_647;
    const j = state % (i + 1);
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

/** Rebuilds every object in the structure with its keys in reverse order. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value === null || typeof value !== 'object' || typeof value === 'bigint') return value;
  const entries = Object.entries(value as Record<string, unknown>).reverse();
  const out: Record<string, unknown> = {};
  for (const [key, inner] of entries) out[key] = reverseKeys(inner);
  return out;
}
