/**
 * Writes the test summary that the /vm inspector renders.
 *
 * The inspector is the page that claims this thing is engineered rather than
 * asserted, so the numbers on it have to come from a real run rather than from
 * a hand-maintained constant. This reporter turns the Vitest result tree into
 * `src/generated/vm-summary.json`, which the page imports at build time. No
 * fetch, no API route, nothing to go stale between deploys.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

type TaskState = 'pass' | 'fail' | 'skip' | 'todo' | 'run' | 'only' | 'queued' | string;

type TaskLike = {
  type?: string;
  name?: string;
  mode?: string;
  tasks?: TaskLike[];
  result?: { state?: TaskState; duration?: number };
};

type FileLike = TaskLike & { filepath?: string; name?: string };

type TestRow = { name: string; state: 'passed' | 'failed' | 'skipped'; durationMs: number };

type FileRow = {
  path: string;
  kind: 'scenarios' | 'invariants' | 'guards';
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  cases: TestRow[];
};

const ROOT = resolve(process.cwd());
const OUTPUT = resolve(ROOT, 'src/generated/vm-summary.json');

/**
 * Which counter a file feeds. Scenarios are worked examples with an expected
 * answer; invariants are statements that must hold for every input; guards are
 * the structural checks that keep the other two honest.
 */
function classify(path: string): FileRow['kind'] {
  const lower = path.replace(/\\/g, '/').toLowerCase();
  if (lower.includes('properties.test')) return 'invariants';
  if (lower.includes('golden.test') || lower.includes('specimens.test')) return 'scenarios';
  return 'guards';
}

function collectTests(task: TaskLike, into: TaskLike[]): void {
  if (task.type === 'test') {
    into.push(task);
    return;
  }
  for (const child of task.tasks ?? []) collectTests(child, into);
}

function stateOf(task: TaskLike): TestRow['state'] {
  const state = task.result?.state;
  if (state === 'pass') return 'passed';
  if (state === 'fail') return 'failed';
  return task.mode === 'skip' || task.mode === 'todo' || state === 'skip' ? 'skipped' : 'failed';
}

export default class VmSummaryReporter {
  onFinished(files: FileLike[] = []): void {
    const rows: FileRow[] = [];

    for (const file of files) {
      const absolute = file.filepath ?? file.name ?? 'unknown';
      const path = relative(ROOT, absolute).replace(/\\/g, '/');
      const tests: TaskLike[] = [];
      collectTests(file, tests);

      const cases: TestRow[] = tests.map((task) => ({
        name: task.name ?? 'unnamed test',
        state: stateOf(task),
        durationMs: Math.round(task.result?.duration ?? 0),
      }));

      rows.push({
        path,
        kind: classify(path),
        tests: cases.length,
        passed: cases.filter((c) => c.state === 'passed').length,
        failed: cases.filter((c) => c.state === 'failed').length,
        skipped: cases.filter((c) => c.state === 'skipped').length,
        durationMs: cases.reduce((total, c) => total + c.durationMs, 0),
        cases,
      });
    }

    rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

    const countBy = (kind: FileRow['kind']) =>
      rows.filter((row) => row.kind === kind).reduce((total, row) => total + row.tests, 0);

    const totals = {
      files: rows.length,
      tests: rows.reduce((t, row) => t + row.tests, 0),
      passed: rows.reduce((t, row) => t + row.passed, 0),
      failed: rows.reduce((t, row) => t + row.failed, 0),
      skipped: rows.reduce((t, row) => t + row.skipped, 0),
      durationMs: rows.reduce((t, row) => t + row.durationMs, 0),
    };

    const summary = {
      ok: totals.failed === 0 && totals.tests > 0,
      scenarios: countBy('scenarios'),
      invariants: countBy('invariants'),
      guards: countBy('guards'),
      totals,
      files: rows,
    };

    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  }
}
