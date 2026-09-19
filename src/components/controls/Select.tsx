'use client';

import { useId } from 'react';

type SelectProps<T extends string> = {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string;
};

/**
 * A native select, restyled down to the arrow.
 *
 * A custom listbox would let us style the options too, and would be worse on
 * every touch device and every screen reader. The chevron is ours; the menu is
 * the platform's.
 */
export function Select<T extends string>({ label, value, options, onChange, hint }: SelectProps<T>) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-medium ink-body">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.target.value as T)}
          className="w-full appearance-none hair bg-transparent px-1 py-1 pr-4 text-[15px] ink-strong"
          style={{ background: 'color-mix(in srgb, var(--surface) 40%, transparent)' }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} style={{ color: 'var(--on-accent)' }}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 8"
          className="pointer-events-none absolute right-1 top-1/2 h-[7px] w-[11px] -translate-y-1/2"
          fill="none"
        >
          <path
            d="M1 1.5 6 6.5 11 1.5"
            stroke="var(--paid-full)"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
        </svg>
      </div>
      {hint ? (
        <p id={hintId} className="text-[12px] leading-[1.5] ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
