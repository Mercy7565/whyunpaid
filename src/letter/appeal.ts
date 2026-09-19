/**
 * The appeal, assembled from sentences rather than written as prose.
 *
 * Every sentence in the output is an object, and every object carries either a
 * rule identifier or a quotation from the wording. There is no free-floating
 * prose anywhere in a generated letter, which is the whole point: a sentence
 * that cannot say where it came from is a sentence nobody should sign and send
 * to their insurer. A test fails the build if one ever appears.
 *
 * English and Hindi are both written here. A generated legal-register sentence
 * run through a machine translator is not something anyone should put their
 * name to, so each sentence carries its own Hindi.
 */

import { LETTER_RULE_IDS } from '@/vm/rules';
import type { RuleId } from '@/vm/rules';
import { formatMonths, formatPaise } from '@/vm/format';
import {
  PROCEDURE_LABELS,
  PROCEDURE_LABELS_HI,
  STAGE_LABELS,
  STAGE_LABELS_HI,
  formatMonthsHi,
} from '@/vm/labels';
import type { Claim, CompiledPolicy, Verdict } from '@/vm/types';
import type { Contradiction } from './contradictions';
import { GROUND_LABELS, GROUND_LABELS_HI, type GroundKind } from './grounds';

export const APPEAL_SECTIONS = [
  'salutation',
  'subject',
  'facts',
  'ground',
  'verdict',
  'contradictions',
  'moratorium',
  'request',
  'closing',
  'disclaimer',
] as const;

export type AppealSection = (typeof APPEAL_SECTIONS)[number];

export type AppealSentence = {
  id: string;
  section: AppealSection;
  /** The sentence in English. */
  en: string;
  /** The same sentence in Hindi. */
  hi: string;
  /**
   * Where the sentence comes from. At least one of these is always present,
   * and a test enforces it.
   */
  ruleId?: RuleId;
  sourceQuote?: string;
  clauseRef?: string;
};

export type Appeal = {
  sentences: readonly AppealSentence[];
  generatedFor: { policyId: string; claimId: string };
};

export type AppealInput = {
  policy: CompiledPolicy;
  claim: Claim;
  verdict: Verdict;
  ground: GroundKind | null;
  contradictions: readonly Contradiction[];
  insurerPaidPaise: bigint;
};

export const SECTION_LABELS: Readonly<Record<AppealSection, string>> = {
  salutation: 'Salutation',
  subject: 'Subject',
  facts: 'The claim',
  ground: 'The ground stated',
  verdict: 'The wording, applied',
  contradictions: 'Where the two diverge',
  moratorium: 'The moratorium',
  request: 'What is requested',
  closing: 'Closing',
  disclaimer: 'How these figures were produced',
};

export function buildAppeal(input: AppealInput): Appeal {
  const { policy, claim, verdict, ground, contradictions, insurerPaidPaise } = input;
  const sentences: AppealSentence[] = [];

  const claimed = formatPaise(verdict.claimedPaise);
  const paid = formatPaise(verdict.paidPaise);
  const settled = formatPaise(insurerPaidPaise);
  const procedure = PROCEDURE_LABELS[claim.procedure];
  const procedureHi = PROCEDURE_LABELS_HI[claim.procedure];
  const months = verdict.monthsOfCoverAtTest;

  const add = (sentence: AppealSentence) => sentences.push(sentence);

  /* ---- Frame -------------------------------------------------------------- */

  add({
    id: 'salutation',
    section: 'salutation',
    en: 'To the Grievance Redressal Officer,',
    hi: 'सेवा में, शिकायत निवारण अधिकारी,',
    ruleId: LETTER_RULE_IDS.salutation,
  });

  add({
    id: 'subject',
    section: 'subject',
    en: `Subject: request for review of the claim under ${policy.name}, admitted ${claim.admissionDate}, on a hospital bill of ${claimed}.`,
    hi: `विषय: ${policy.name} के अंतर्गत दावे की पुनः समीक्षा हेतु अनुरोध; भर्ती दिनांक ${claim.admissionDate}, अस्पताल बिल ${claimed}।`,
    ruleId: LETTER_RULE_IDS.subject,
  });

  /* ---- Facts -------------------------------------------------------------- */

  add({
    id: 'facts-claim',
    section: 'facts',
    en: `The claim concerns ${procedure.toLowerCase()}, with admission on ${claim.admissionDate} and discharge on ${claim.dischargeDate}, on a hospital bill of ${claimed}.`,
    hi: `यह दावा ${procedureHi} से संबंधित है; भर्ती ${claim.admissionDate} को तथा छुट्टी ${claim.dischargeDate} को हुई, और अस्पताल का बिल ${claimed} रहा।`,
    ruleId: LETTER_RULE_IDS.factsClaim,
  });

  add({
    id: 'facts-cover',
    section: 'facts',
    en: `Cover under this policy had run for ${formatMonths(months)} of continuous cover on the date of admission.`,
    hi: `भर्ती की तिथि तक इस पॉलिसी के अंतर्गत ${formatMonthsHi(months)} की निरंतर बीमा अवधि पूर्ण हो चुकी थी।`,
    ruleId: LETTER_RULE_IDS.factsCover,
  });

  if (insurerPaidPaise > 0n) {
    add({
      id: 'facts-settlement',
      section: 'facts',
      en: `The claim was settled at ${settled}.`,
      hi: `दावे का निपटान ${settled} पर किया गया।`,
      ruleId: LETTER_RULE_IDS.factsClaim,
    });
  } else {
    add({
      id: 'facts-repudiated',
      section: 'facts',
      en: 'Nothing was settled on the claim.',
      hi: 'दावे पर कोई राशि स्वीकृत नहीं की गई।',
      ruleId: LETTER_RULE_IDS.factsClaim,
    });
  }

  /* ---- The stated ground --------------------------------------------------- */

  if (ground) {
    add({
      id: 'ground-stated',
      section: 'ground',
      en: `The decision communicated to me rests on one stated ground: ${GROUND_LABELS[ground].toLowerCase()}.`,
      hi: `मुझे भेजे गए निर्णय का आधार एक ही बताया गया है: ${GROUND_LABELS_HI[ground]}।`,
      ruleId: LETTER_RULE_IDS.groundStated,
    });
  } else {
    add({
      id: 'ground-undetected',
      section: 'ground',
      en: 'The letter as supplied does not state a ground that could be identified on review, so the policy wording has been applied to the claim on its own terms.',
      hi: 'प्रस्तुत पत्र में ऐसा कोई आधार नहीं है जिसे समीक्षा में पहचाना जा सके, अतः पॉलिसी की शब्दावली को दावे पर स्वतंत्र रूप से लागू किया गया है।',
      ruleId: LETTER_RULE_IDS.groundUndetected,
    });
  }

  /* ---- The wording, applied ----------------------------------------------- */

  add({
    id: 'verdict-summary',
    section: 'verdict',
    en: `Applying the wording of ${policy.name} to this claim clause by clause gives an admissible amount of ${paid} against a bill of ${claimed}.`,
    hi: `${policy.name} की शब्दावली को इस दावे पर खंड-दर-खंड लागू करने पर ${claimed} के बिल में से ${paid} देय बनता है।`,
    ruleId: LETTER_RULE_IDS.verdictSummary,
  });

  verdict.deductions.forEach((deduction, index) => {
    add({
      id: `verdict-deduction-${index}`,
      section: 'verdict',
      en: deduction.humanReason,
      hi: `खंड ${deduction.clauseRef} (${STAGE_LABELS_HI[deduction.stage]}) के अंतर्गत ${formatPaise(deduction.amountPaise)} की कटौती बनती है।`,
      ruleId: deduction.ruleId,
      sourceQuote: deduction.sourceQuote,
      clauseRef: deduction.clauseRef,
    });
  });

  if (verdict.block) {
    add({
      id: 'verdict-nil',
      section: 'verdict',
      en: `On this wording the claim reaches nil, and the reason it gives is this: ${verdict.block.humanReason}`,
      hi: `इस शब्दावली पर दावा शून्य पर पहुँचता है; इसका कारण खंड ${verdict.block.clauseRef} (${STAGE_LABELS_HI[verdict.block.stage]}) है।`,
      ruleId: LETTER_RULE_IDS.verdictNilExplained,
      sourceQuote: verdict.block.sourceQuote,
      clauseRef: verdict.block.clauseRef,
    });
  }

  if (verdict.deductions.length === 0 && !verdict.block) {
    add({
      id: 'verdict-no-deduction',
      section: 'verdict',
      en: `Not one clause of ${policy.name} reduces this claim, and the stages the wording provides for were each reached and each left the amount where it was.`,
      hi: `${policy.name} का एक भी खंड इस दावे को कम नहीं करता; शब्दावली में दिए गए सभी चरण लागू हुए और किसी ने राशि नहीं घटाई।`,
      ruleId: LETTER_RULE_IDS.verdictSummary,
    });
  }

  /* ---- Contradictions ------------------------------------------------------ */

  if (contradictions.length > 0) {
    add({
      id: 'contradiction-intro',
      section: 'contradictions',
      en: 'On the following points the ground stated and the wording of the policy do not sit together. These are put as possible grounds for review, on the wording as compiled.',
      hi: 'निम्नलिखित बिंदुओं पर बताया गया आधार और पॉलिसी की शब्दावली परस्पर मेल नहीं खाते। ये संकलित शब्दावली के आधार पर समीक्षा हेतु संभावित बिंदु के रूप में प्रस्तुत हैं।',
      ruleId: LETTER_RULE_IDS.contradictionIntro,
    });

    contradictions.forEach((contradiction, index) => {
      add({
        id: `contradiction-${contradiction.id}-${index}`,
        section: 'contradictions',
        en: `${contradiction.summary} ${contradiction.vmFinding}`,
        hi: `${contradiction.summaryHi} ${contradiction.vmFindingHi}`,
        ruleId: contradiction.ruleId,
        ...(contradiction.sourceQuote ? { sourceQuote: contradiction.sourceQuote } : {}),
        ...(contradiction.clauseRef ? { clauseRef: contradiction.clauseRef } : {}),
      });
    });
  }

  /* ---- The moratorium, always -------------------------------------------- */

  const { contestability } = verdict;
  add({
    id: 'moratorium-boundary',
    section: 'moratorium',
    en: contestability.moratoriumComplete
      ? `The ${formatMonths(contestability.moratoriumMonths)} moratorium at ${contestability.clauseRef} is complete. It bars the insurer from contesting this claim for non-disclosure or misrepresentation, except where fraud is established. It does not extend cover, and it does not disturb any permanent exclusion, sub-limit, co-payment or unexpired waiting period.`
      : `The ${formatMonths(contestability.moratoriumMonths)} moratorium at ${contestability.clauseRef} is not complete: ${formatMonths(contestability.monthsOfContinuousCover)} have run. It is not a waiting period, and completing it would not, by itself, make one further rupee of this claim payable.`,
    hi: contestability.moratoriumComplete
      ? `खंड ${contestability.clauseRef} की ${formatMonthsHi(contestability.moratoriumMonths)} की मोरेटोरियम अवधि पूर्ण हो चुकी है। इसके पश्चात बीमाकर्ता इस दावे को अप्रकटीकरण या गलतबयानी के आधार पर चुनौती नहीं दे सकता, सिवाय सिद्ध धोखाधड़ी के। यह कवर का विस्तार नहीं करती, और किसी स्थायी अपवर्जन, उप-सीमा, सह-भुगतान अथवा अपूर्ण प्रतीक्षा अवधि को प्रभावित नहीं करती।`
      : `खंड ${contestability.clauseRef} की ${formatMonthsHi(contestability.moratoriumMonths)} की मोरेटोरियम अवधि पूर्ण नहीं हुई है; ${formatMonthsHi(contestability.monthsOfContinuousCover)} बीते हैं। यह प्रतीक्षा अवधि नहीं है, और इसके पूर्ण होने मात्र से इस दावे का एक रुपया भी अतिरिक्त देय नहीं होगा।`,
    ruleId: LETTER_RULE_IDS.moratoriumBoundary,
    sourceQuote: contestability.sourceQuote,
    clauseRef: contestability.clauseRef,
  });

  /* ---- The request --------------------------------------------------------- */

  add({
    id: 'request-review',
    section: 'request',
    en: 'I request that this claim be placed before the Grievance Redressal Officer for review on the points set out above, and that the reasons for the decision be stated clause by clause.',
    hi: 'मेरा अनुरोध है कि उपर्युक्त बिंदुओं पर इस दावे की समीक्षा शिकायत निवारण अधिकारी द्वारा की जाए, तथा निर्णय के कारण खंड-दर-खंड बताए जाएँ।',
    ruleId: LETTER_RULE_IDS.requestReview,
  });

  add({
    id: 'request-timeline',
    section: 'request',
    en: 'I would be grateful for a written response within fifteen days of the date of this letter.',
    hi: 'कृपया इस पत्र की तिथि से पंद्रह दिनों के भीतर लिखित उत्तर देने की कृपा करें।',
    ruleId: LETTER_RULE_IDS.requestTimeline,
  });

  add({
    id: 'request-escalation',
    section: 'request',
    en: 'If the matter is not resolved on review, I intend to place it before the Insurance Ombudsman for the jurisdiction, and before the grievance mechanism of the Insurance Regulatory and Development Authority of India where that is appropriate.',
    hi: 'यदि समीक्षा पर मामला हल नहीं होता, तो मैं इसे संबंधित क्षेत्राधिकार के बीमा लोकपाल के समक्ष, तथा यथोचित स्थिति में भारतीय बीमा विनियामक और विकास प्राधिकरण की शिकायत प्रणाली के समक्ष रखने का आशय रखता हूँ।',
    ruleId: LETTER_RULE_IDS.escalation,
  });

  add({
    id: 'closing',
    section: 'closing',
    en: 'Yours faithfully,',
    hi: 'भवदीय,',
    ruleId: LETTER_RULE_IDS.closing,
  });

  add({
    id: 'disclaimer',
    section: 'disclaimer',
    en: `The figures above were produced by applying the wording of ${policy.name} to this claim clause by clause, in the order the wording sets out. They are an estimate from the policy wording, not medical, legal or financial advice.`,
    hi: `उपर्युक्त आँकड़े ${policy.name} की शब्दावली को इस दावे पर, शब्दावली में दिए गए क्रम में, खंड-दर-खंड लागू करके निकाले गए हैं। ये पॉलिसी की शब्दावली पर आधारित अनुमान हैं; ये चिकित्सीय, विधिक अथवा वित्तीय परामर्श नहीं हैं।`,
    ruleId: LETTER_RULE_IDS.disclaimer,
  });

  return { sentences, generatedFor: { policyId: policy.id, claimId: claim.id } };
}

/** The appeal as plain text, for the clipboard. */
export function appealToText(appeal: Appeal, language: 'en' | 'hi'): string {
  const bySection = new Map<AppealSection, string[]>();
  for (const sentence of appeal.sentences) {
    const list = bySection.get(sentence.section) ?? [];
    list.push(language === 'en' ? sentence.en : sentence.hi);
    bySection.set(sentence.section, list);
  }

  const blocks: string[] = [];
  for (const section of APPEAL_SECTIONS) {
    const lines = bySection.get(section);
    if (!lines || lines.length === 0) continue;
    blocks.push(lines.join(' '));
  }
  return blocks.join('\n\n');
}

/** Used by the source lint, and by the interface to show what backs a sentence. */
export function sentenceSource(sentence: AppealSentence): 'rule' | 'quote' | 'none' {
  if (sentence.sourceQuote && sentence.sourceQuote.trim().length > 0) return 'quote';
  if (sentence.ruleId && sentence.ruleId.trim().length > 0) return 'rule';
  return 'none';
}

/** Stage names, exported so the interface can label a deduction sentence. */
export { STAGE_LABELS, STAGE_LABELS_HI };
