/**
 * PolicyVM public surface.
 *
 * Everything reachable from here is pure. If a symbol in this barrel ever needs
 * `fetch`, a clock or a file handle, it belongs in another layer.
 */

export { evaluate, assertBalances, claimedTotal, claimDays, VerdictBalanceError } from './evaluate';
export {
  mulDivRound,
  shareOfBps,
  ratioBps,
  sumPaise,
  minPaise,
  maxPaise,
  rupeesToPaise,
  paiseToRupees,
  parsePaiseString,
  MoneyError,
  PAISE_PER_RUPEE,
  BPS_DENOMINATOR,
} from './money';
export {
  addDays,
  addMonths,
  compareISO,
  earlierISO,
  fullMonthsBetween,
  inpatientDays,
  parseISODate,
  toISODate,
  toDayNumber,
  fromDayNumber,
  DateError,
} from './dates';
export { formatPaise, formatDeduction, formatBps, formatMonths, RUPEE } from './format';
export {
  CATEGORY_LABELS,
  PROCEDURE_LABELS,
  PROCEDURE_LABELS_HI,
  STAGE_LABELS,
  categoryPhrase,
  listPhrase,
} from './labels';
export {
  VM_RULE_IDS,
  LETTER_RULE_IDS,
  ALL_RULE_IDS,
  RULE_DESCRIPTIONS,
  isKnownRuleId,
} from './rules';
export type { VMRuleId, LetterRuleId, RuleId } from './rules';
export {
  clauseById,
  clausesInReadingOrder,
  clausesOfKind,
  firstClauseOfKind,
  moratoriumOf,
  sumInsuredOf,
  PolicyShapeError,
} from './selectors';
export * from './types';
