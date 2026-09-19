/**
 * Calendar arithmetic with no `Date`, no timezone and no clock.
 *
 * The VM is pure: `asOf` is always a parameter, so nothing here may read the
 * system time. Dates are `YYYY-MM-DD` strings, which sort lexicographically in
 * the same order they sort chronologically, so comparison is string comparison.
 */

export type ISODate = string;

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateParts = { year: number; month: number; day: number };

export class DateError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'DateError';
  }
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) throw new DateError(`month out of range: ${month}`);
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_LENGTHS[month - 1] ?? 30;
}

export function parseISODate(value: ISODate): DateParts {
  const match = ISO_PATTERN.exec(value);
  if (!match) throw new DateError(`expected a YYYY-MM-DD date, received "${value}"`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) throw new DateError(`month out of range in "${value}"`);
  if (day < 1 || day > daysInMonth(year, month)) throw new DateError(`day out of range in "${value}"`);
  return { year, month, day };
}

export function toISODate(parts: DateParts): ISODate {
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${String(parts.year).padStart(4, '0')}-${mm}-${dd}`;
}

/** Days since 1970-01-01, by the standard civil-calendar algorithm. Proleptic Gregorian. */
export function toDayNumber(value: ISODate): number {
  const { year, month, day } = parseISODate(value);
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

export function fromDayNumber(days: number): ISODate {
  const shifted = days + 719_468;
  const era = Math.floor(shifted / 146_097);
  const dayOfEra = shifted - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return toISODate({ year: month <= 2 ? year + 1 : year, month, day });
}

export function addDays(value: ISODate, days: number): ISODate {
  return fromDayNumber(toDayNumber(value) + days);
}

/**
 * Adds whole months, clamping the day to the length of the target month, so
 * 2024-01-31 plus one month is 2024-02-29 rather than spilling into March.
 */
export function addMonths(value: ISODate, months: number): ISODate {
  const { year, month, day } = parseISODate(value);
  const zeroBased = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(zeroBased / 12);
  const targetMonth = zeroBased - targetYear * 12 + 1;
  return toISODate({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  });
}

/**
 * Whole months elapsed from `from` to `to`, never negative.
 *
 * A waiting period of 36 months expires the moment 36 whole months of cover are
 * complete, so the comparison the evaluator makes is `monthsOfCover < clause.months`.
 */
export function fullMonthsBetween(from: ISODate, to: ISODate): number {
  const start = parseISODate(from);
  const end = parseISODate(to);
  let months = (end.year - start.year) * 12 + (end.month - start.month);
  if (end.day < start.day) months -= 1;
  return months < 0 ? 0 : months;
}

/** Days of stay, counted inclusively: same-day admission and discharge is one day. */
export function inpatientDays(admission: ISODate, discharge: ISODate): number {
  const span = toDayNumber(discharge) - toDayNumber(admission);
  return span < 0 ? 1 : span + 1;
}

export function earlierISO(a: ISODate, b: ISODate): ISODate {
  parseISODate(a);
  parseISODate(b);
  return a <= b ? a : b;
}

export function compareISO(a: ISODate, b: ISODate): number {
  parseISODate(a);
  parseISODate(b);
  return a < b ? -1 : a > b ? 1 : 0;
}
