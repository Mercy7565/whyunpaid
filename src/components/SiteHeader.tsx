'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NAV, PRODUCT_NAME } from '@/lib/copy';

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-40 hair-b"
      style={{ background: 'color-mix(in srgb, var(--ground) 88%, transparent)', backdropFilter: 'none' }}
      data-print="hide"
    >
      {/*
        The masthead has to fit a wordmark, three destinations and the theme
        control inside 380px. It is tuned to fit at that width with room to
        spare, and it is allowed to wrap rather than overflow if a longer label
        or a larger font ever pushes it: a control that scrolls off the right
        edge of a phone is a control nobody can reach.
      */}
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-y-1 gap-x-[6px] px-[10px] py-2 sm:gap-x-2 sm:px-4">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-[4px]"
          aria-label={`${PRODUCT_NAME} home`}
        >
          <span className="display text-[17px] leading-none ink-strong sm:text-[21px]">
            WhyUnpaid
          </span>
          <span
            className="slab display flex h-[19px] w-[17px] items-center justify-center text-[13px] leading-none sm:h-[24px] sm:w-[22px] sm:text-[17px]"
            style={{ background: 'var(--paprika)', boxShadow: 'var(--shadow-hard-sm)' }}
            aria-hidden="true"
          >
            ?
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-[6px] sm:gap-2">
          <nav aria-label="Primary">
            <ul className="flex items-center gap-0">
              {NAV.map((item) => {
                const active =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.hint}
                      aria-current={active ? 'page' : undefined}
                      className="relative block px-[5px] py-1 text-[12px] font-semibold transition-opacity sm:px-2 sm:text-[14px]"
                      style={{
                        color: active
                          ? 'var(--ink)'
                          : 'color-mix(in srgb, var(--ink) 80%, transparent)',
                      }}
                    >
                      {item.label}
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-[5px] -bottom-[7px] h-[2px] sm:inset-x-2"
                        style={{ background: active ? 'var(--accent)' : 'transparent' }}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
