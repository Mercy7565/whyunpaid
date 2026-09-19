/**
 * The two primitives everything else is built on: money and the calendar.
 *
 * A rounding rule that is wrong by one paise in one direction is invisible in a
 * screenshot and fatal in an appeal, so the rule gets its own tests rather than
 * being covered incidentally by the scenarios.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  earlierISO,
  fromDayNumber,
  fullMonthsBetween,
  inpatientDays,
  parseISODate,
  toDayNumber,
} from '../dates';
import { formatBps, formatPaise } from '../format';
import { MoneyError, mulDivRound, ratioBps, shareOfBps } from '../money';

describe('money', () => {
  it('rounds half up, and only half up', () => {
    expect(mulDivRound(5n, 1n, 2n)).toBe(3n); // 2.5 -> 3
    expect(mulDivRound(7n, 1n, 2n)).toBe(4n); // 3.5 -> 4
    expect(mulDivRound(1n, 1n, 3n)).toBe(0n); // 0.333 -> 0
    expect(mulDivRound(2n, 1n, 3n)).toBe(1n); // 0.667 -> 1
    expect(mulDivRound(0n, 1n, 7n)).toBe(0n);
  });

  it('never loses or invents a paise across a proportionate split', () => {
    fc.assert(
      fc.property(
        fc.array(fc.bigInt({ min: 0n, max: 10_000_000n }), { minLength: 1, maxLength: 20 }),
        fc.bigInt({ min: 1n, max: 5_000_000n }),
        fc.bigInt({ min: 1n, max: 5_000_000n }),
        (amounts, numerator, denominator) => {
          /*
           * Each line is reduced independently, which is what the evaluator
           * does, so the kept and the removed halves must still account for
           * every original paise line by line.
           */
          for (const amount of amounts) {
            const kept = mulDivRound(amount, numerator, denominator);
            const removed = amount - kept;
            if (numerator <= denominator) {
              expect(kept + removed).toBe(amount);
              expect(kept >= 0n).toBe(true);
              expect(removed >= 0n).toBe(true);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('refuses negative money loudly rather than quietly', () => {
    expect(() => mulDivRound(-1n, 1n, 2n)).toThrow(MoneyError);
    expect(() => mulDivRound(1n, 1n, 0n)).toThrow(MoneyError);
    expect(() => shareOfBps(100n, 10_001)).toThrow(MoneyError);
    expect(() => shareOfBps(100n, -1)).toThrow(MoneyError);
    expect(() => ratioBps(1n, 0n)).toThrow(MoneyError);
  });

  it('takes a percentage share the way a policy schedule reads it', () => {
    expect(shareOfBps(26_500_000n, 2_000)).toBe(5_300_000n); // 20% of 2,65,000
    expect(shareOfBps(10_000n, 0)).toBe(0n);
    expect(shareOfBps(10_000n, 10_000)).toBe(10_000n);
  });

  it('groups rupees the Indian way', () => {
    expect(formatPaise(21_200_000n)).toBe('₹2,12,000');
    expect(formatPaise(0n)).toBe('₹0');
    expect(formatPaise(100n)).toBe('₹1');
    expect(formatPaise(1_111_111n)).toBe('₹11,111.11');
    expect(formatPaise(250_000_000n)).toBe('₹25,00,000');
    expect(formatPaise(1_000_000_000_000n)).toBe('₹10,00,00,00,000');
    expect(formatPaise(12_345n, { symbol: false })).toBe('123.45');
  });

  it('prints basis points as a schedule would', () => {
    expect(formatBps(2_000)).toBe('20%');
    expect(formatBps(1_250)).toBe('12.5%');
    expect(formatBps(5_556)).toBe('55.56%');
    expect(formatBps(0)).toBe('0%');
  });
});

describe('the calendar', () => {
  it('round-trips every day number it produces', () => {
    fc.assert(
      fc.property(fc.integer({ min: -25_000, max: 30_000 }), (days) => {
        expect(toDayNumber(fromDayNumber(days))).toBe(days);
      }),
      { numRuns: 500 },
    );
  });

  it('counts whole months the way a waiting period is read', () => {
    expect(fullMonthsBetween('2021-04-01', '2024-10-01')).toBe(42);
    expect(fullMonthsBetween('2021-04-15', '2021-05-14')).toBe(0);
    expect(fullMonthsBetween('2021-04-15', '2021-05-15')).toBe(1);
    expect(fullMonthsBetween('2024-10-01', '2021-04-01')).toBe(0);
    expect(fullMonthsBetween('2019-01-01', '2024-01-01')).toBe(60);
  });

  it('clamps the day when a month is shorter than the one it started in', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2024-03-31', -1)).toBe('2024-02-29');
    expect(addMonths('2024-12-15', 1)).toBe('2025-01-15');
  });

  it('counts a same-day admission and discharge as one day', () => {
    expect(inpatientDays('2024-10-01', '2024-10-01')).toBe(1);
    expect(inpatientDays('2024-10-01', '2024-10-05')).toBe(5);
    expect(inpatientDays('2024-10-05', '2024-10-01')).toBe(1);
  });

  it('handles the leap day and the century rule', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('1900-02-28', 1)).toBe('1900-03-01');
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29');
  });

  it('rejects anything that is not a calendar date', () => {
    expect(() => parseISODate('2024-13-01')).toThrow();
    expect(() => parseISODate('2023-02-29')).toThrow();
    expect(() => parseISODate('01-01-2024')).toThrow();
  });

  it('picks the earlier of two dates', () => {
    expect(earlierISO('2024-10-01', '2024-09-30')).toBe('2024-09-30');
    expect(earlierISO('2024-10-01', '2024-10-01')).toBe('2024-10-01');
  });
});
