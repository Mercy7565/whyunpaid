'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The theme switcher.
 *
 * Three states, not two. "System" is the default and is what most people
 * actually want; light and dark are explicit overrides that survive a reload.
 * Storing only an explicit choice means someone who never touches this control
 * keeps following their operating system when it changes at dusk.
 *
 * The attribute is written to <html> by an inline script before first paint
 * (see layout.tsx), so a reader who chose light never sees a dark page flash
 * first. This component only has to keep the button in step with it.
 */

export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'whyunpaid-theme';

/** The inline script. Kept here so the reader and the writer stay together. */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

function readChoice(): ThemeChoice {
  if (typeof document === 'undefined') return 'system';
  const attribute = document.documentElement.getAttribute('data-theme');
  return attribute === 'light' || attribute === 'dark' ? attribute : 'system';
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') {
    root.removeAttribute('data-theme');
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      /* Private mode. The choice simply will not persist. */
    }
    return;
  }
  root.setAttribute('data-theme', choice);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* Same. */
  }
}

const ORDER: ThemeChoice[] = ['system', 'light', 'dark'];

const LABEL: Record<ThemeChoice, string> = {
  system: 'Match the system',
  light: 'Light',
  dark: 'Dark',
};

function Glyph({ choice }: { choice: ThemeChoice }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    'aria-hidden': true as const,
  };

  if (choice === 'light') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="3.1" />
        <path d="M8 1v1.7M8 13.3V15M15 8h-1.7M2.7 8H1M12.9 3.1l-1.2 1.2M4.3 11.7l-1.2 1.2M12.9 12.9l-1.2-1.2M4.3 4.3L3.1 3.1" />
      </svg>
    );
  }

  if (choice === 'dark') {
    return (
      <svg {...common}>
        <path d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a5.9 5.9 0 1 0 7 7Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="1.4" y="2.6" width="13.2" height="9" rx="0.6" />
      <path d="M5.6 14h4.8" />
    </svg>
  );
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setChoice(readChoice());
    setMounted(true);
  }, []);

  const cycle = useCallback(() => {
    setChoice((current) => {
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system';
      apply(next);
      return next;
    });
  }, []);

  /*
   * Until the effect has run, the server and the client disagree about which
   * choice is active, so the button renders its neutral state and announces
   * nothing it cannot yet know.
   */
  const shown = mounted ? choice : 'system';

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${LABEL[shown].toLowerCase()}. Click to change.`}
      aria-label={`Theme: ${LABEL[shown]}. Activate to switch theme.`}
      className="flex shrink-0 items-center gap-[5px] px-1 py-[5px] text-[12px] font-medium transition-colors"
      style={{
        border: 'var(--hair) solid color-mix(in srgb, var(--line) 55%, transparent)',
        color: 'color-mix(in srgb, var(--ink) 82%, transparent)',
      }}
    >
      <Glyph choice={shown} />
      <span className="hidden sm:inline" suppressHydrationWarning>
        {LABEL[shown]}
      </span>
    </button>
  );
}
