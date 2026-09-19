/**
 * Rendering paise as rupees, in the Indian grouping, without `Intl`.
 *
 * This lives inside the VM because the evaluator writes a human sentence on
 * every deduction and that sentence quotes amounts. Implementing the grouping
 * by hand rather than calling `Intl.NumberFormat` keeps the VM free of locale
 * data and keeps the output byte-identical across Node versions, which matters
 * because golden snapshots contain these strings.
 */

const RUPEE = '₹';

/** Groups the integer part the Indian way: last three digits, then pairs. */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const pairs: string[] = [];
  let index = rest.length;
  while (index > 2) {
    pairs.unshift(rest.slice(index - 2, index));
    index -= 2;
  }
  if (index > 0) pairs.unshift(rest.slice(0, index));
  return `${pairs.join(',')},${last3}`;
}

export type FormatOptions = {
  /** Show the rupee sign. Default true. */
  symbol?: boolean;
  /** Always show two decimal places, even when the paise are zero. Default false. */
  forcePaise?: boolean;
};

/**
 * `formatPaise(21_200_000n)` is `"₹2,12,000"`.
 * Paise are shown only when they are non-zero, so whole-rupee figures stay quiet.
 */
export function formatPaise(paise: bigint, options: FormatOptions = {}): string {
  const { symbol = true, forcePaise = false } = options;
  const negative = paise < 0n;
  const absolute = negative ? -paise : paise;
  const rupees = absolute / 100n;
  const remainder = absolute % 100n;
  const grouped = groupIndian(rupees.toString());
  const fraction =
    remainder === 0n && !forcePaise ? '' : `.${remainder.toString().padStart(2, '0')}`;
  return `${negative ? '-' : ''}${symbol ? RUPEE : ''}${grouped}${fraction}`;
}

/** The same figure with an explicit minus sign, for deduction rows. */
export function formatDeduction(paise: bigint): string {
  return `−${formatPaise(paise)}`;
}

/** Basis points as a percentage string: 1250 becomes "12.5%". */
export function formatBps(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const fraction = Math.abs(bps % 100);
  if (fraction === 0) return `${whole}%`;
  const text = (fraction / 100).toFixed(2).slice(2).replace(/0+$/, '');
  return `${whole}.${text}%`;
}

/** "18 months" / "1 month", used in waiting-period sentences. */
export function formatMonths(months: number): string {
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

export { RUPEE };
