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
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-2 px-2 py-2 sm:px-4">
        <Link href="/" className="group flex items-center gap-[5px]" aria-label={`${PRODUCT_NAME} home`}>
          <span className="display text-[19px] leading-none ink-strong sm:text-[21px]">
            WhyUnpaid
          </span>
          <span
            className="slab display flex h-[22px] w-[20px] items-center justify-center text-[15px] leading-none sm:h-[24px] sm:w-[22px] sm:text-[17px]"
            style={{ background: 'var(--paprika)', boxShadow: 'var(--shadow-hard-sm)' }}
            aria-hidden="true"
          >
            ?
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
        <nav aria-label="Primary">
          <ul className="flex items-center gap-0">
            {NAV.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={item.hint}
                    aria-current={active ? 'page' : undefined}
                    className="relative block px-1 py-1 text-[13px] font-medium transition-opacity sm:px-2 sm:text-[14px]"
                    style={{
                      color: active
                        ? 'var(--ink)'
                        : 'color-mix(in srgb, var(--ink) 80%, transparent)',
                    }}
                  >
                    {item.label}
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-1 -bottom-[7px] h-[2px] sm:inset-x-2"
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
