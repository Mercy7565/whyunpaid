'use client';

import { useState } from 'react';
import summary from '@/generated/vm-summary.json';

/**
 * The test run, rendered from the file the test run wrote.
 *
 * This page claims the engineering is real, so its numbers come from
 * `src/generated/vm-summary.json`, which a custom Vitest reporter writes on
 * every `npm test`. It is imported at build time, so there is no fetch, no API
 * route and nothing that can be true on a laptop and false on the deployment.
 */

type Kind = 'scenarios' | 'invariants' | 'guards';

const KIND_BLURB: Record<Kind, string> = {
  scenarios: 'Worked examples with an expected answer, snapshotted in full.',
  invariants: 'Statements that must hold for every input, checked with generated claims.',
  guards: 'Structural checks that keep the other two honest.',
};

function Stat({ value, label, blurb }: { value: number; label: string; blurb: string }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="display text-[clamp(30px,5vw,44px)] leading-[0.95] ink-strong" data-figure>
        {value}
      </span>
      <span className="text-[13px] font-medium ink-body">{label}</span>
      <span className="text-[12px] leading-[1.5] ink-muted">{blurb}</span>
    </div>
  );
}

export function TestSummary() {
  const [open, setOpen] = useState(false);
  const failed = summary.totals.failed;

  return (
    <section aria-labelledby="tests-title" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <h2 id="tests-title" className="text-[15px] font-medium ink-strong">
          The test run
        </h2>
        <span className="eyebrow">written by the suite, read at build time</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={summary.scenarios} label="scenarios" blurb={KIND_BLURB.scenarios} />
        <Stat value={summary.invariants} label="invariants" blurb={KIND_BLURB.invariants} />
        <Stat value={summary.guards} label="guards" blurb={KIND_BLURB.guards} />
        <div className="flex flex-col gap-[2px]">
          <span
            className="display text-[clamp(30px,5vw,44px)] leading-[0.95]"
            style={{ color: failed === 0 ? 'var(--figure-good)' : 'var(--line)' }}
            data-figure
          >
            {summary.totals.passed}
          </span>
          <span className="text-[13px] font-medium ink-body">
            {failed === 0 ? 'passing' : `passing, ${failed} failing`}
          </span>
          <span className="text-[12px] leading-[1.5] ink-muted">
            across {summary.totals.files} files, in {Math.round(summary.totals.durationMs)}ms.
          </span>
        </div>
      </div>

      <div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="test-detail"
          onClick={() => setOpen((value) => !value)}
          className="text-[13px] underline underline-offset-4 ink-muted transition-colors hover:ink-body"
        >
          {open ? 'Hide the list' : `Show all ${summary.totals.tests} tests`}
        </button>
      </div>

      {open ? (
        <div id="test-detail" className="flex flex-col gap-2">
          {summary.files.map((file) => (
            <div key={file.path}>
              <p className="flex flex-wrap items-baseline gap-1">
                <code className="text-[12px] ink-body">{file.path}</code>
                <span className="text-[11px] ink-muted">
                  {file.kind} &middot; {file.passed}/{file.tests} passing
                </span>
              </p>
              <ul className="m-0 mt-[2px] list-none p-0">
                {/*
                  Keyed by position, not by name. A test that runs once per
                  specimen policy carries the same name four times inside one
                  file, and keying by name made React drop the duplicates: the
                  count said 159 while the list showed fewer.
                */}
                {file.cases.map((test, index) => (
                  <li
                    key={`${test.name}#${index}`}
                    className="flex items-baseline gap-1 py-[1px] text-[12px] ink-muted"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block h-[6px] w-[6px] shrink-0"
                      style={{
                        background:
                          test.state === 'passed' ? 'var(--paid-full)' : 'var(--line)',
                      }}
                    />
                    <span className="sr-only">{test.state}:</span>
                    <span>{test.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
