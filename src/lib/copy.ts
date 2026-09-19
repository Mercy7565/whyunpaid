/**
 * Every user-visible sentence that is not generated from a clause lives here.
 *
 * House rules, applied to every string in the product:
 *  - We say "matches IRDAI's stated basis for ..." and "possible grounds".
 *  - We never say "illegal", "your claim will be paid", or "you will win".
 *  - Every verdict surface carries DISCLAIMER_ESTIMATE, verbatim.
 *  - No emoji, anywhere.
 */

export const PRODUCT_NAME = 'WhyUnpaid?';
export const TAGLINE = 'Your policy is already a program. Nobody can read it. So run it.';

export const DISCLAIMER_ESTIMATE =
  'This is an estimate produced from the policy wording, not medical, legal or financial advice.';

export const DISCLAIMER_SPECIMEN =
  'The specimen policies are synthetic. They are modelled on structures common to Indian indemnity health cover and are not the wording of any insurer.';

export const MORATORIUM_NOTE =
  'The 60-month moratorium is not a waiting period. It does not unlock cover. Once 60 months of continuous cover are complete, the insurer may no longer contest the claim for non-disclosure or misrepresentation, except on grounds of established fraud. Permanent exclusions, sub-limits, co-pay and any unexpired waiting period still apply in full.';

export const NAV = [
  { href: '/', label: 'Simulate', hint: 'Run a hospitalisation through a policy' },
  { href: '/appeal', label: 'Appeal', hint: 'Check a rejection reason against the policy' },
  { href: '/vm', label: 'Inspector', hint: 'The clause tree, the order, the tests' },
] as const;

export const STAGE_LABEL = {
  exclusion: 'Permanent exclusion',
  waitingPeriod: 'Waiting period',
  lineItemIneligible: 'Ineligible items',
  roomRentProportionate: 'Room rent proportion',
  subLimit: 'Sub-limit',
  deductible: 'Deductible',
  coPay: 'Co-pay',
  sumInsured: 'Sum insured cap',
} as const;

export const STAGE_BLURB = {
  exclusion: 'The procedure appears on the permanent exclusion list, so nothing downstream is reached.',
  waitingPeriod: 'The applicable waiting period had not expired on the date tested.',
  lineItemIneligible: 'Heads the policy lists as non-payable, applied line by line.',
  roomRentProportionate:
    'Where the room occupied costs more than the eligible room, associated charges are reduced in the same proportion.',
  subLimit: 'A per-procedure ceiling applied to what remains admissible.',
  deductible: 'The amount the policyholder carries before the policy responds.',
  coPay: 'A fixed share of the admissible amount, applied last.',
  sumInsured: 'The annual ceiling on what the policy can pay.',
} as const;
