'use client';

import { useId } from 'react';
import { LETTER_SAMPLES, type LetterSample } from '@/letter/samples';

/**
 * The paste box, and six ways to avoid needing it.
 *
 * Nobody arriving at this page for the first time has a rejection letter in
 * their clipboard, so a sample is always one tap away and each one carries the
 * claim it belongs to. No file upload, ever: a repudiation letter is a medical
 * record and this product has no server to put one on.
 */
export function LetterInput({
  value,
  onChange,
  onSample,
  activeSampleId,
}: {
  value: string;
  onChange: (value: string) => void;
  onSample: (sample: LetterSample) => void;
  activeSampleId: string | null;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-[13px] font-medium ink-body">
          The reason given for the decision
        </label>
        <textarea
          id={id}
          value={value}
          rows={8}
          spellCheck={false}
          placeholder="Paste the paragraph from the letter that gives the reason. Nothing leaves this browser."
          onChange={(event) => onChange(event.target.value)}
          className="w-full resize-y hair bg-transparent px-1 py-1 text-[14px] leading-[1.6] ink-strong placeholder:opacity-55"
          style={{ background: 'color-mix(in srgb, var(--surface) 90%, transparent)' }}
        />
        <p className="text-[12px] leading-[1.5] ink-muted">
          {value.trim().length === 0
            ? 'Or start from a sample below.'
            : `${value.trim().split(/\s+/).length} words. Nothing is uploaded and nothing is stored.`}
        </p>
      </div>

      <fieldset>
        <legend className="eyebrow mb-1">Sample reasons</legend>
        <ul className="m-0 flex list-none flex-col gap-[2px] p-0">
          {LETTER_SAMPLES.map((sample) => {
            const active = sample.id === activeSampleId;
            return (
              <li key={sample.id}>
                <button
                  type="button"
                  onClick={() => onSample(sample)}
                  aria-pressed={active}
                  className="w-full hair px-1 py-1 text-left transition-colors"
                  style={{
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active
                      ? 'var(--on-accent)'
                      : 'color-mix(in srgb, var(--sand) 88%, transparent)',
                  }}
                >
                  <span className="block text-[13px] font-medium">{sample.title}</span>
                  <span
                    className="block text-[12px] leading-[1.45]"
                    style={{ opacity: active ? 0.82 : 0.66 }}
                  >
                    {sample.note}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );
}
