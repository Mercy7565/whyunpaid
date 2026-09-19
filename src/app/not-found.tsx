import Link from 'next/link';
import { NAV } from '@/lib/copy';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 py-6 sm:px-4">
      <p className="eyebrow">404</p>
      <h1 className="display mt-1 text-[clamp(28px,6vw,52px)] leading-[1.02] ink-strong">
        No clause here.
      </h1>
      <p className="mt-2 text-[15px] leading-[1.65] ink-body measure">
        That address does not resolve to anything in this product. Everything WhyUnpaid? does lives
        behind one of the three links below, and none of them needs an account.
      </p>

      <ul className="mt-3 flex list-none flex-col gap-1 p-0">
        {NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex flex-wrap items-baseline gap-1 hair px-2 py-1 transition-colors"
            >
              <span className="text-[15px] font-medium ink-strong">{item.label}</span>
              <span className="text-[13px] ink-muted">{item.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
