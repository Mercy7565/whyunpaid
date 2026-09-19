'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The theme switcher. Two states: light and dark.
 *
 * There is no "system" option in the control. The system preference still
 * decides what a first-time visitor sees, because the stylesheet handles that
 * in a media query, but the button itself only ever flips between the two
 * modes and always writes an explicit choice that survives a reload.
 *
 * The attribute is written to <html> by an inline script before first paint
 * (see layout.tsx), so someone who chose light never sees a dark page flash
 * first. This component only has to keep the button in step with it.
 */

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'whyunpaid-theme';

/** The inline script. Kept here so the reader and the writer stay together. */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

/**
 * What the reader is actually looking at: an explicit choice if one was made,
 * and otherwise whatever the operating system asked for.
 */
function effectiveTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const attribute = document.documentElement.getAttribute('data-theme');
  if (attribute === 'light' || attribute === 'dark') return attribute;
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function apply(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Private mode. The choice simply will not persist. */
  }
}

const LABEL: Record<Theme, string> = { light: 'Light', dark: 'Dark' };

function Glyph({ theme }: { theme: Theme }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    'aria-hidden': true as const,
  };

  return theme === 'light' ? (
    <svg {...common}>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1v1.7M8 13.3V15M15 8h-1.7M2.7 8H1M12.9 3.1l-1.2 1.2M4.3 11.7l-1.2 1.2M12.9 12.9l-1.2-1.2M4.3 4.3L3.1 3.1" />
    </svg>
  ) : (
    <svg {...common}>
      <path d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a5.9 5.9 0 1 0 7 7Z" />
    </svg>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(effectiveTheme());
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      apply(next);
      return next;
    });
  }, []);

  const other: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      title={`Switch to the ${LABEL[other].toLowerCase()} theme`}
      aria-label={`Theme: ${LABEL[theme]}. Activate to switch to ${LABEL[other].toLowerCase()}.`}
      className="flex shrink-0 items-center gap-[5px] px-1 py-[5px] text-[12px] font-semibold transition-colors"
      style={{
        border: 'var(--hair) solid var(--line)',
        color: 'var(--line)',
      }}
    >
      {/* Until the effect runs, the server and client disagree about the mode. */}
      <span suppressHydrationWarning className="flex items-center gap-[5px]">
        <Glyph theme={mounted ? theme : 'dark'} />
        <span className="hidden sm:inline">{LABEL[mounted ? theme : 'dark']}</span>
      </span>
    </button>
  );
}
