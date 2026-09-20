'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PRESETS, type Preset, type Scenario } from '@/lib/scenario';

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  onPick: (scenario: Scenario) => void;
};

/**
 * Scenario switcher, on Command-K.
 *
 * Hand-built: a dialog, a filter, a listbox and a focus trap. It restores focus
 * to whatever opened it, closes on Escape and on a click outside, and never
 * traps a reader who arrived with a keyboard and no mouse.
 */
export function CommandPalette({ open, onClose, onPick }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const baseId = useId();

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return PRESETS;
    return PRESETS.filter(
      (preset) =>
        preset.title.toLowerCase().includes(needle) || preset.note.toLowerCase().includes(needle),
    );
  }, [query]);

  /*
   * Focus moves into the filter synchronously, before the browser paints.
   *
   * This used to be scheduled with requestAnimationFrame, and the callback did
   * not reliably run: the dialog opened with focus left on whatever was behind
   * it, so typing to filter did nothing and a keyboard reader was stranded
   * outside the modal. A layout effect runs after the DOM is in place and
   * before paint, which is exactly when the input is focusable, and it does
   * not depend on a frame ever being produced.
   */
  useLayoutEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setActive(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) return;
    returnFocusRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const choose = useCallback(
    (preset: Preset | undefined) => {
      if (!preset) return;
      onPick({ ...preset.scenario });
    },
    [onPick],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((index) => Math.min(index + 1, results.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setActive(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setActive(Math.max(results.length - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        choose(results[active]);
        return;
      }
      /* Nothing else is focusable inside, so Tab would leave: keep it here. */
      if (event.key === 'Tab') event.preventDefault();
    },
    [active, choose, onClose, results],
  );

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-2 pt-6 sm:pt-[12vh]"
      style={{ background: 'color-mix(in srgb, var(--ground) 86%, transparent)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-label`}
        className="panel-raised flex w-full max-w-[560px] flex-col overflow-hidden"
        onKeyDown={onKeyDown}
      >
        <h2 id={`${baseId}-label`} className="sr-only">
          Switch scenario
        </h2>

        <div className="hair-b px-2 py-1">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${baseId}-list`}
            aria-activedescendant={results.length > 0 ? `${baseId}-option-${active}` : undefined}
            aria-autocomplete="list"
            placeholder="Filter scenarios"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            className="w-full bg-transparent py-1 text-[16px] ink-strong outline-none placeholder:opacity-60"
          />
        </div>

        <ul
          ref={listRef}
          id={`${baseId}-list`}
          role="listbox"
          aria-label="Scenarios"
          className="m-0 max-h-[52vh] list-none overflow-y-auto p-0"
        >
          {results.map((preset, index) => (
            <li
              key={preset.id}
              id={`${baseId}-option-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(preset);
              }}
              className="cursor-pointer px-2 py-1 hair-t first:border-t-0"
              style={{
                background: index === active ? 'var(--accent)' : 'transparent',
                color:
                  index === active
                    ? 'var(--on-accent)'
                    : 'color-mix(in srgb, var(--ink) 88%, transparent)',
              }}
            >
              <span className="block text-[14px] font-medium">{preset.title}</span>
              <span
                className="block text-[12px] leading-[1.5]"
                style={{ opacity: index === active ? 0.8 : 0.66 }}
              >
                {preset.note}
              </span>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="px-2 py-2 text-[14px] ink-muted">
              Nothing matches that. Clear the filter to see all {PRESETS.length} scenarios.
            </li>
          ) : null}
        </ul>

        <div className="hair-t flex items-center justify-between gap-1 px-2 py-1 text-[12px] ink-muted">
          <span>Up and down to move, Enter to run, Escape to close.</span>
          <span>{results.length} of {PRESETS.length}</span>
        </div>
      </div>
    </div>
  );
}
