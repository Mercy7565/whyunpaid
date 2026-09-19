/**
 * Money in WhyUnpaid? is a `bigint` count of paise. Never a `number`, never a float.
 *
 * There is exactly one rounding rule in the product and it lives here:
 *
 *   ROUND HALF UP, on non-negative paise only.
 *
 * Every proportionate reduction, percentage and share in the evaluator goes
 * through `mulDivRound`. Nothing else is allowed to divide money. Because the
 * rule is applied in one place, `paid + sum(deductions) === claimed` holds as an
 * exact bigint identity rather than as a tolerance.
 *
 * Negative money is a programming error here, not a modelled case: a claim line,
 * a cap and a deduction are all non-negative by construction. The guard below
 * turns a sign mistake into a loud throw instead of a silently wrong rupee.
 */

export const PAISE_PER_RUPEE = 100n;
export const BPS_DENOMINATOR = 10_000n;

export class MoneyError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

function assertNonNegative(value: bigint, what: string): void {
  if (value < 0n) throw new MoneyError(`${what} must be non-negative paise, received ${value}`);
}

/**
 * `round(amount * numerator / denominator)`, half up.
 *
 * Derivation: for non-negative integers, `floor(p/d + 1/2) === floor((2p + d) / 2d)`,
 * and bigint division truncates toward zero, which is `floor` on non-negatives.
 */
export function mulDivRound(amount: bigint, numerator: bigint, denominator: bigint): bigint {
  assertNonNegative(amount, 'amount');
  assertNonNegative(numerator, 'numerator');
  if (denominator <= 0n) {
    throw new MoneyError(`denominator must be positive paise, received ${denominator}`);
  }
  return (amount * numerator * 2n + denominator) / (denominator * 2n);
}

/** A share of an amount expressed in basis points (10000 bps = 100%). */
export function shareOfBps(amount: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new MoneyError(`basis points must be an integer in [0, 10000], received ${bps}`);
  }
  return mulDivRound(amount, BigInt(bps), BPS_DENOMINATOR);
}

/** The proportion `part / whole`, in basis points, rounded half up. For display only. */
export function ratioBps(part: bigint, whole: bigint): number {
  assertNonNegative(part, 'part');
  if (whole <= 0n) throw new MoneyError(`whole must be positive paise, received ${whole}`);
  return Number(mulDivRound(part, BPS_DENOMINATOR, whole));
}

export function sumPaise(values: readonly bigint[]): bigint {
  let total = 0n;
  for (const value of values) {
    assertNonNegative(value, 'line amount');
    total += value;
  }
  return total;
}

export function minPaise(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function maxPaise(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/** Rupees as a JS number to paise. Used only at the UI boundary, never inside the VM. */
export function rupeesToPaise(rupees: number): bigint {
  if (!Number.isFinite(rupees) || rupees < 0) {
    throw new MoneyError(`rupees must be a finite non-negative number, received ${rupees}`);
  }
  return BigInt(Math.round(rupees * 100));
}

/** Paise to rupees as a JS number. Lossy by design; never feed the result back in. */
export function paiseToRupees(paise: bigint): number {
  return Number(paise) / 100;
}

/** Parses the decimal-string form money takes in JSON. Paise, as digits only. */
export function parsePaiseString(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new MoneyError(
      `money in JSON must be an integer count of paise written as digits, received "${value}"`,
    );
  }
  return BigInt(value);
}
