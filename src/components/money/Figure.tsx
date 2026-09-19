'use client';

import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { formatPaise } from '@/vm/format';

type FigureProps = {
  paise: bigint;
  className?: string;
  /**
   * A string at least as wide as any value this slot will show. The grid keeps
   * a cell that size, so a figure growing from six digits to eight never moves
   * anything around it.
   */
  reserve?: string;
  /** Duration in seconds. Ignored when the reader has asked for less motion. */
  duration?: number;
};

/**
 * A rupee figure that counts to its new value.
 *
 * The animation writes into the DOM node directly rather than through React
 * state: a slider drag would otherwise re-render the whole waterfall sixty
 * times a second to move four digits. Tabular figures and a reserved cell mean
 * nothing shifts while it runs.
 */
export function Figure({ paise, className, reserve, duration = 0.45 }: FigureProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const currentRef = useRef<number>(Number(paise));
  const reduceMotion = useReducedMotion();
  const formatted = formatPaise(paise);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const target = Number(paise);

    if (reduceMotion) {
      currentRef.current = target;
      node.textContent = formatted;
      return;
    }

    const controls = animate(currentRef.current, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (value) => {
        currentRef.current = value;
        node.textContent = formatPaise(BigInt(Math.round(value)));
      },
      onComplete: () => {
        currentRef.current = target;
        node.textContent = formatted;
      },
    });

    return () => controls.stop();
  }, [paise, formatted, reduceMotion, duration]);

  if (reserve) {
    return (
      <span className={`grid ${className ?? ''}`} data-figure>
        <span className="invisible col-start-1 row-start-1" aria-hidden="true">
          {reserve}
        </span>
        <span ref={ref} className="col-start-1 row-start-1">
          {formatted}
        </span>
      </span>
    );
  }

  return (
    <span ref={ref} className={className} data-figure>
      {formatted}
    </span>
  );
}

/** The widest string a figure up to `paise` can produce, for `reserve`. */
export function reserveFor(paise: bigint): string {
  const digits = formatPaise(paise, { symbol: false }).replace(/\d/g, '0');
  return `₹${digits}`;
}
