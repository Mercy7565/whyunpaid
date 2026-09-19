'use client';

import { useId } from 'react';

type SliderProps = {
  label: string;
  /** Rendered beside the label, already formatted. */
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Short sentence under the track, e.g. what the number means in practice. */
  hint?: string;
  /** Text read out instead of the raw number. */
  valueText?: string;
  /** Marks drawn on the track, as raw values. */
  ticks?: readonly { value: number; label: string }[];
};

/**
 * A native range input, restyled.
 *
 * Native because a hand-rolled slider that has to work with a keyboard, a
 * screen reader, a touch screen and a trackpad is a worse version of the one
 * the platform already ships. Everything visible is ours; the behaviour is the
 * browser's.
 */
export function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  hint,
  valueText,
  ticks,
}: SliderProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-1">
        <label htmlFor={id} className="text-[13px] font-medium ink-body">
          {label}
        </label>
        <output htmlFor={id} className="display text-[17px] leading-none ink-strong" data-figure>
          {display}
        </output>
      </div>

      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={hint ? hintId : undefined}
        aria-valuetext={valueText ?? display}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ ['--range-progress' as string]: `${progress}%` }}
      />

      {ticks && ticks.length > 0 ? (
        <div className="relative h-[14px]" aria-hidden="true">
          {ticks.map((tick) => {
            const left = max === min ? 0 : ((tick.value - min) / (max - min)) * 100;
            return (
              <span
                key={tick.value}
                className="absolute top-0 -translate-x-1/2 text-[10px] leading-none ink-muted whitespace-nowrap"
                style={{ left: `${Math.min(96, Math.max(4, left))}%` }}
              >
                {tick.label}
              </span>
            );
          })}
        </div>
      ) : null}

      {hint ? (
        <p id={hintId} className="text-[12px] leading-[1.5] ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
