/**
 * The evaluation order as data.
 *
 * ORDER.md is what a reader of the repository is told; this is what the
 * inspector renders; `evaluate.ts` is what actually runs. A test asserts all
 * three list the same eight stages in the same sequence, because an order that
 * is documented in three places and enforced in none is not an order.
 */

import type { ClauseKind, Stage } from './types';

export type OrderRow = {
  order: number;
  stage: Stage;
  clauseKind: ClauseKind;
  operatesOn: 'the whole claim' | 'each line' | 'the running total';
  effect: string;
  shortCircuits: boolean;
};

export const ORDER_TABLE: readonly OrderRow[] = [
  {
    order: 1,
    stage: 'exclusion',
    clauseKind: 'PermanentExclusion',
    operatesOn: 'the whole claim',
    effect:
      'A procedure on the exclusion list takes the claim to nil in one deduction. Nothing downstream is reached.',
    shortCircuits: true,
  },
  {
    order: 2,
    stage: 'waitingPeriod',
    clauseKind: 'WaitingPeriod',
    operatesOn: 'the whole claim',
    effect:
      'Any applicable waiting period unexpired at the test date takes the claim to nil. The most binding one is the one reported.',
    shortCircuits: true,
  },
  {
    order: 3,
    stage: 'lineItemIneligible',
    clauseKind: 'LineItemIneligibility',
    operatesOn: 'each line',
    effect: 'Lines in a head the policy lists as non-payable are removed before any cap applies.',
    shortCircuits: false,
  },
  {
    order: 4,
    stage: 'roomRentProportionate',
    clauseKind: 'RoomRentCap',
    operatesOn: 'each line',
    effect:
      'Associated heads are reduced by eligible over actual room rent. The exempt heads are named on the clause and are never touched.',
    shortCircuits: false,
  },
  {
    order: 5,
    stage: 'subLimit',
    clauseKind: 'SubLimit',
    operatesOn: 'the running total',
    effect: 'A per-procedure ceiling on whatever survived the earlier stages.',
    shortCircuits: false,
  },
  {
    order: 6,
    stage: 'deductible',
    clauseKind: 'Deductible',
    operatesOn: 'the running total',
    effect: 'A flat amount carried by the policyholder before the policy responds.',
    shortCircuits: false,
  },
  {
    order: 7,
    stage: 'coPay',
    clauseKind: 'CoPay',
    operatesOn: 'the running total',
    effect: 'A percentage share, applied last on the admissible amount.',
    shortCircuits: false,
  },
  {
    order: 8,
    stage: 'sumInsured',
    clauseKind: 'SumInsured',
    operatesOn: 'the running total',
    effect: 'The ceiling on what the policy can pay in the period.',
    shortCircuits: false,
  },
];

/**
 * The clause kind that is deliberately absent from the table above.
 *
 * The moratorium is a clause of every policy and a stage of none. It cannot
 * unlock cover and it cannot take a rupee; it decides only whether the insurer
 * may still contest the claim for non-disclosure or misrepresentation.
 */
export const OUT_OF_PIPELINE: {
  clauseKind: ClauseKind;
  title: string;
  reportedAs: string;
  because: string;
} = {
  clauseKind: 'Moratorium',
  title: 'The 60-month moratorium',
  reportedAs: 'contestability, on the verdict',
  because:
    'Modelling it as a stage would make a claim payable at month sixty that was not payable at month fifty-nine for reasons having nothing to do with disclosure. It does not override a permanent exclusion, a sub-limit, a co-payment or an unexpired waiting period.',
};
