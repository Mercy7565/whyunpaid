import Link from 'next/link';

/**
 * Three sentences for someone who has never seen this before.
 *
 * It sits below the waterfall rather than above it, because the waterfall is
 * the argument and an explanation that arrives before the thing it explains is
 * just a wall between a visitor and the product.
 */

const STEPS = [
  {
    step: '01',
    title: 'The policy is compiled, not summarised',
    body: 'Every clause becomes data with a reference, a page and at most twenty-five quoted words. A clause that cannot quote its source does not ship.',
    href: '/vm',
    link: 'See the clause tree',
  },
  {
    step: '02',
    title: 'The claim is run, in a fixed order',
    body: 'Eight stages, always the same sequence, documented and tested. Money is counted in paise as integers, so every rupee that disappears is attributed to exactly one clause.',
    href: '/vm',
    link: 'See the evaluation order',
  },
  {
    step: '03',
    title: 'The letter is checked against the wording',
    body: 'Paste the reason an insurer gave. Where the wording does not do what the letter says it does, that divergence becomes a point you can put in writing.',
    href: '/appeal',
    link: 'Check a rejection letter',
  },
] as const;

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="hair-t mt-6 pt-3" data-print="hide">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <h2 id="how-title" className="text-[15px] font-medium ink-strong">
          How it works
        </h2>
        <span className="eyebrow">no account, no upload, no model call</span>
      </div>

      <ol className="m-0 mt-2 grid list-none gap-3 p-0 sm:grid-cols-3 sm:gap-4">
        {STEPS.map((step) => (
          <li key={step.step} className="flex flex-col gap-1">
            <span
              className="slab display flex h-[34px] w-[34px] items-center justify-center text-[17px] leading-none"
              style={{ background: 'var(--amber)' }}
              aria-hidden="true"
            >
              {step.step}
            </span>
            <h3 className="text-[15px] font-medium leading-[1.3] ink-strong">{step.title}</h3>
            <p className="text-[13px] leading-[1.6] ink-muted">{step.body}</p>
            <Link
              href={step.href}
              className="mt-[2px] self-start text-[13px] font-medium underline underline-offset-4"
              style={{ color: 'var(--accent)' }}
            >
              {step.link}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
