'use client';

import { useId } from 'react';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Shown to assistive technology and as a title, where the label is a letter. */
  description?: string;
};

type SegmentedProps<T extends string> = {
  legend: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * A radio group that looks like a segmented control.
 *
 * Built on radio semantics rather than buttons so that a screen reader
 * announces "2 of 4" without being told to, and so the left and right arrow
 * keys work because they are supposed to, not because we bound them.
 */
export function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  const groupName = useId();

  return (
    <fieldset className="min-w-0">
      <legend className="eyebrow mb-1">{legend}</legend>
      <div
        className="grid hair"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              title={option.description}
              className="relative flex min-w-0 cursor-pointer items-center justify-center px-1 py-1 text-[13px] font-medium transition-colors"
              style={{
                background: selected ? 'var(--accent)' : 'transparent',
                color: selected
                  ? 'var(--on-accent)'
                  : 'color-mix(in srgb, var(--ink) 80%, transparent)',
                borderLeft:
                  index === 0
                    ? 'none'
                    : 'var(--hair) solid color-mix(in srgb, var(--line) 55%, transparent)',
              }}
            >
              <input
                type="radio"
                name={groupName}
                className="peer sr-only"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
              />
              <span className="truncate peer-focus-visible:underline peer-focus-visible:underline-offset-4">
                {option.label}
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 hidden peer-focus-visible:block"
                style={{ outline: '2px solid var(--accent)', outlineOffset: '2px' }}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
