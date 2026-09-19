/**
 * The rule registry.
 *
 * Every deduction the evaluator emits and every sentence the appeal generator
 * writes carries one of these identifiers. Nothing in the product may attribute
 * a rupee or a claim to a rule that is not listed here, and a test enforces it.
 *
 * VM rules describe what the evaluator did. Letter rules describe what the
 * appeal generator asserted. They are kept apart because a letter sentence is a
 * claim about a verdict, not a step in producing one.
 */

export const VM_RULE_IDS = {
  permanentExclusion: 'vm.exclusion.permanent',
  waitingInitial: 'vm.waiting.initial',
  waitingSpecificDisease: 'vm.waiting.specificDisease',
  waitingPreExisting: 'vm.waiting.preExisting',
  lineItemIneligible: 'vm.lineItem.ineligible',
  roomRentProportionate: 'vm.roomRent.proportionate',
  subLimit: 'vm.subLimit.procedure',
  deductible: 'vm.deductible.perClaim',
  coPay: 'vm.coPay.percentage',
  sumInsuredCap: 'vm.sumInsured.cap',
  moratoriumContestability: 'vm.moratorium.contestability',
} as const;

export type VMRuleId = (typeof VM_RULE_IDS)[keyof typeof VM_RULE_IDS];

export const LETTER_RULE_IDS = {
  salutation: 'letter.frame.salutation',
  subject: 'letter.frame.subject',
  factsClaim: 'letter.facts.claim',
  factsCover: 'letter.facts.cover',
  groundStated: 'letter.ground.stated',
  groundUndetected: 'letter.ground.undetected',
  verdictSummary: 'letter.verdict.summary',
  verdictNilExplained: 'letter.verdict.nilExplained',
  contradictionIntro: 'letter.contradiction.intro',
  contradictionItem: 'letter.contradiction.item',
  moratoriumBoundary: 'letter.moratorium.boundary',
  roomRentExemptHeads: 'letter.roomRent.exemptHeads',
  requestReview: 'letter.request.review',
  requestTimeline: 'letter.request.timeline',
  escalation: 'letter.request.escalation',
  closing: 'letter.frame.closing',
  disclaimer: 'letter.frame.disclaimer',
} as const;

export type LetterRuleId = (typeof LETTER_RULE_IDS)[keyof typeof LETTER_RULE_IDS];

export type RuleId = VMRuleId | LetterRuleId;

const ALL: readonly string[] = [
  ...Object.values(VM_RULE_IDS),
  ...Object.values(LETTER_RULE_IDS),
];

export const ALL_RULE_IDS: ReadonlySet<string> = new Set(ALL);

export function isKnownRuleId(value: string): value is RuleId {
  return ALL_RULE_IDS.has(value);
}

/**
 * One plain sentence per rule, used by the inspector so that a reader who has
 * never seen the codebase can tell what each identifier means.
 */
export const RULE_DESCRIPTIONS: Readonly<Record<RuleId, string>> = {
  [VM_RULE_IDS.permanentExclusion]:
    'The procedure appears on the policy permanent exclusion list, so the claim is not admissible at all.',
  [VM_RULE_IDS.waitingInitial]:
    'The initial waiting period from the date of inception had not expired on the date tested.',
  [VM_RULE_IDS.waitingSpecificDisease]:
    'A named-condition waiting period covering this procedure had not expired on the date tested.',
  [VM_RULE_IDS.waitingPreExisting]:
    'The pre-existing disease waiting period had not expired on the date tested.',
  [VM_RULE_IDS.lineItemIneligible]:
    'Line items in heads the policy lists as non-payable are removed before any cap is applied.',
  [VM_RULE_IDS.roomRentProportionate]:
    'Where the room occupied exceeds the eligible room rent, associated charges are reduced in the same proportion. Exempt heads are not touched.',
  [VM_RULE_IDS.subLimit]:
    'A per-procedure ceiling is applied to the admissible amount that survives the earlier stages.',
  [VM_RULE_IDS.deductible]:
    'The deductible is borne by the policyholder before the policy responds.',
  [VM_RULE_IDS.coPay]:
    'A fixed percentage of the admissible amount is borne by the policyholder, applied after every other reduction.',
  [VM_RULE_IDS.sumInsuredCap]:
    'The sum insured is the ceiling on what the policy can pay in the period.',
  [VM_RULE_IDS.moratoriumContestability]:
    'After sixty months of continuous cover the insurer may no longer contest the claim for non-disclosure or misrepresentation. This changes who may raise what, not how much is payable.',

  [LETTER_RULE_IDS.salutation]: 'Addressing line of the appeal.',
  [LETTER_RULE_IDS.subject]: 'Subject line naming the claim and the decision under appeal.',
  [LETTER_RULE_IDS.factsClaim]: 'The admitted facts of the claim as entered.',
  [LETTER_RULE_IDS.factsCover]: 'The length of continuous cover at the date tested.',
  [LETTER_RULE_IDS.groundStated]: 'The ground the insurer stated, as classified from the letter.',
  [LETTER_RULE_IDS.groundUndetected]:
    'No stated ground could be classified from the text supplied.',
  [LETTER_RULE_IDS.verdictSummary]: 'The amount the compiled policy makes admissible.',
  [LETTER_RULE_IDS.verdictNilExplained]:
    'The compiled policy also arrives at nil, and the reason it gives.',
  [LETTER_RULE_IDS.contradictionIntro]: 'Introduces the points on which the stated ground and the policy wording diverge.',
  [LETTER_RULE_IDS.contradictionItem]: 'One divergence between the stated ground and the policy wording.',
  [LETTER_RULE_IDS.moratoriumBoundary]:
    'States what the sixty-month moratorium does and does not do.',
  [LETTER_RULE_IDS.roomRentExemptHeads]:
    'Names the heads the policy exempts from proportionate reduction.',
  [LETTER_RULE_IDS.requestReview]: 'The request made of the insurer.',
  [LETTER_RULE_IDS.requestTimeline]: 'The response time sought.',
  [LETTER_RULE_IDS.escalation]: 'The next forum available if the review does not resolve the matter.',
  [LETTER_RULE_IDS.closing]: 'Sign-off of the appeal.',
  [LETTER_RULE_IDS.disclaimer]: 'States how the figures in the appeal were produced.',
};
