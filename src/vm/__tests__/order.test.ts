/**
 * The evaluation order, held to its documentation.
 *
 * ORDER.md is not a comment: it is what a reader of this repository is told the
 * machine does. This file reads that table and asserts it names the same eight
 * stages, in the same sequence, as the code. Documentation that can silently
 * drift from the implementation is worse than no documentation at all.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { ORDER_TABLE, OUT_OF_PIPELINE } from '../orderTable';
import { STAGES } from '../types';
import { CLAUSES, claim, policy } from './fixtures';

const ORDER_MD = readFileSync(fileURLToPath(new URL('../ORDER.md', import.meta.url)), 'utf8');

describe('evaluation order', () => {
  it('is exactly the eight documented stages in the documented sequence', () => {
    expect([...STAGES]).toEqual([
      'exclusion',
      'waitingPeriod',
      'lineItemIneligible',
      'roomRentProportionate',
      'subLimit',
      'deductible',
      'coPay',
      'sumInsured',
    ]);
  });

  it('matches the table in ORDER.md, row for row', () => {
    const rows = ORDER_MD.split('\n')
      .map((line) => line.trim())
      .filter((line) => /^\| \d \|/.test(line))
      .map((line) => {
        const cells = line.split('|').map((cell) => cell.trim());
        return { order: Number(cells[1]), stage: (cells[2] ?? '').replace(/`/g, '') };
      });

    expect(rows.map((row) => row.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rows.map((row) => row.stage)).toEqual([...STAGES]);
  });

  it('matches the table the inspector renders, row for row', () => {
    expect(ORDER_TABLE.map((row) => row.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ORDER_TABLE.map((row) => row.stage)).toEqual([...STAGES]);
    expect(ORDER_TABLE.filter((row) => row.shortCircuits).map((row) => row.stage)).toEqual([
      'exclusion',
      'waitingPeriod',
    ]);
    expect(ORDER_TABLE.map((row) => row.clauseKind)).not.toContain('Moratorium');
    expect(OUT_OF_PIPELINE.clauseKind).toBe('Moratorium');
  });

  it('documents that the moratorium is not part of the pipeline', () => {
    expect(ORDER_MD).toContain('The moratorium is not a waiting period. It does not unlock cover.');
  });

  it('emits a trace step for all eight stages, in order, on every verdict', () => {
    const p = policy('trace', [CLAUSES.sumInsured(50_000_000n), CLAUSES.moratorium(60)]);
    const verdict = evaluate(p, claim(), '2024-10-01');

    expect(verdict.trace).toHaveLength(STAGES.length);
    expect(verdict.trace.map((step) => step.stage)).toEqual([...STAGES]);
    expect(verdict.trace.map((step) => step.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(verdict.trace.every((step) => step.reached)).toBe(true);
  });

  it('marks the stages a blocked claim never reached', () => {
    const p = policy('blocked', [
      CLAUSES.sumInsured(50_000_000n),
      CLAUSES.moratorium(60),
      CLAUSES.permanentExclusion(['kneeReplacement']),
      CLAUSES.coPay(2_000),
    ]);
    const verdict = evaluate(p, claim(), '2024-10-01');

    expect(verdict.trace.map((step) => step.reached)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(verdict.paidPaise).toBe(0n);
    expect(verdict.deductions).toHaveLength(1);
  });

  it('emits deductions in stage order and never out of it', () => {
    const p = policy('ordered', [
      CLAUSES.sumInsured(20_000_000n),
      CLAUSES.moratorium(60),
      CLAUSES.ineligible(['nonMedical']),
      CLAUSES.roomCapPerDay(500_000n),
      CLAUSES.subLimit(['kneeReplacement'], 25_000_000n),
      CLAUSES.deductible(1_000_000n),
      CLAUSES.coPay(1_000),
    ]);
    const verdict = evaluate(p, claim(), '2024-10-01');
    const positions = verdict.deductions.map((d) => STAGES.indexOf(d.stage));
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });
});
