'use client';

import { useEffect } from 'react';
import { DISCLAIMER_ESTIMATE } from '@/lib/copy';

/**
 * The error boundary.
 *
 * The evaluator asserts that every verdict balances and throws rather than
 * render a figure that does not add up. That is deliberate, so this screen has
 * to be a real screen: it says what happened, it does not pretend a number was
 * produced, and it offers the way back.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /* No analytics in this product; the console is where a developer looks. */
    console.error('[whyunpaid]', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 py-6 sm:px-4">
      <p className="eyebrow">Something stopped</p>
      <h1 className="display mt-1 text-[clamp(26px,5.6vw,46px)] leading-[1.02] ink-strong">
        This screen did not finish.
      </h1>
      <p className="mt-2 text-[15px] leading-[1.65] ink-body measure">
        Rather than show you a figure it could not stand behind, the evaluator stopped. Nothing was
        sent anywhere and nothing was stored. Try again, and if it keeps happening the scenario in
        the address bar is enough to reproduce it exactly.
      </p>

      {error.digest ? (
        <p className="mt-1 text-[12px] ink-muted">
          Reference <code className="text-[12px]">{error.digest}</code>
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={reset}
          className="px-2 py-1 text-[14px] font-medium"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          Try again
        </button>
        <a href="/" className="hair px-2 py-1 text-[14px] font-medium ink-body">
          Back to the opening scenario
        </a>
      </div>

      <p className="mt-3 text-[12px] leading-[1.6] ink-muted measure">{DISCLAIMER_ESTIMATE}</p>
    </div>
  );
}
