'use client';

import { useId } from 'react';

type SwitchProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
};

/** A checkbox wearing a switch. Semantics native, appearance ours. */
export function Switch({ label, checked, onChange, hint }: SwitchProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex cursor-pointer items-center gap-1">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          aria-hidden="true"
          className="relative inline-flex h-[20px] w-[36px] shrink-0 items-center transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
          style={{
            border: 'var(--hair) solid color-mix(in srgb, var(--line) 70%, transparent)',
            background: checked ? 'var(--accent)' : 'transparent',
            outlineColor: 'var(--accent)',
          }}
        >
          <span
            className="absolute h-[12px] w-[12px] transition-transform"
            style={{
              left: '3px',
              transform: checked ? 'translateX(16px)' : 'translateX(0)',
              background: checked ? 'var(--on-accent)' : 'var(--line)',
            }}
          />
        </span>
        <span className="text-[13px] font-medium ink-body">{label}</span>
      </label>
      {hint ? (
        <p id={hintId} className="text-[12px] leading-[1.5] ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
