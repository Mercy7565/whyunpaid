/**
 * Where the letter and the wording disagree.
 *
 * A contradiction is not an opinion about the claim. It is a specific, stated
 * divergence between the ground the insurer gave and what the compiled policy
 * tree does with the same claim, with the clause that produces the divergence
 * attached. Everything here is phrased as possible grounds: this tool cannot
 * know the clinical facts, the file, or what was written on a proposal form
 * seven years ago.
 *
 * Every contradiction carries its Hindi alongside its English. The appeal is
 * meant to be sent, and a machine translation of a legal-register sentence is
 * not something anyone should put their name to, so both are written here.
 */

import { LETTER_RULE_IDS, VM_RULE_IDS } from '@/vm/rules';
import type { RuleId } from '@/vm/rules';
import { formatMonths, formatPaise } from '@/vm/format';
import {
  PROCEDURE_LABELS,
  PROCEDURE_LABELS_HI,
  categoryPhrase,
  categoryPhraseHi,
  formatMonthsHi,
} from '@/vm/labels';
import { clausesOfKind, firstClauseOfKind } from '@/vm/selectors';
import type { Claim, CompiledPolicy, Verdict } from '@/vm/types';
import type { GroundKind } from './grounds';

export const CONTRADICTION_KINDS = [
  'waitingPeriodExpired',
  'noSuchExclusion',
  'moratoriumComplete',
  'proportionateExemptHeads',
  'noRoomRentCapInPolicy',
  'repudiationExceedsDeduction',
  'noClauseSupportsGround',
  'notADenialOnMerits',
  'treeAgrees',
  'groundNotDetected',
] as const;

export type ContradictionKind = (typeof CONTRADICTION_KINDS)[number];

export type Contradiction = {
  id: string;
  kind: ContradictionKind;
  statedGround: GroundKind | null;
  /** One sentence naming the divergence. */
  summary: string;
  summaryHi: string;
  /** What the compiled tree found, in figures. */
  vmFinding: string;
  vmFindingHi: string;
  strength: 'direct' | 'supporting';
  clauseRef?: string;
  clauseTitle?: string;
  sourceQuote?: string;
  ruleId: RuleId;
};

export type ContradictionInput = {
  policy: CompiledPolicy;
  claim: Claim;
  verdict: Verdict;
  ground: GroundKind | null;
  /** What the insurer actually settled, in paise. Nil for a full repudiation. */
  insurerPaidPaise: bigint;
};

function applicableWaits(policy: CompiledPolicy, claim: Claim) {
  return clausesOfKind(policy, 'WaitingPeriod').filter((clause) => {
    switch (clause.appliesTo.scope) {
      case 'all':
        return true;
      case 'procedures':
        return clause.appliesTo.procedures.includes(claim.procedure);
      case 'preExisting':
        return claim.arisesFromPreExistingCondition;
    }
  });
}

export function findContradictions(input: ContradictionInput): Contradiction[] {
  const { policy, claim, verdict, ground, insurerPaidPaise } = input;
  const out: Contradiction[] = [];
  const procedure = PROCEDURE_LABELS[claim.procedure];
  const procedureHi = PROCEDURE_LABELS_HI[claim.procedure];
  const months = verdict.monthsOfCoverAtTest;
  const paid = formatPaise(verdict.paidPaise);
  const claimed = formatPaise(verdict.claimedPaise);

  const push = (c: Contradiction) => out.push(c);

  if (ground === null) {
    push({
      id: 'ground-not-detected',
      kind: 'groundNotDetected',
      statedGround: null,
      summary:
        'No recognised ground could be read from the text supplied, so nothing has been compared against it.',
      summaryHi:
        'प्रस्तुत पाठ से कोई पहचाना जा सकने वाला आधार नहीं निकला, अतः उसके विरुद्ध कोई तुलना नहीं की गई है।',
      vmFinding: `On the wording alone, ${policy.name} makes ${paid} of this ${claimed} bill admissible.`,
      vmFindingHi: `केवल शब्दावली के आधार पर, ${policy.name} के अंतर्गत ${claimed} के इस बिल में से ${paid} देय बनता है।`,
      strength: 'supporting',
      ruleId: LETTER_RULE_IDS.groundUndetected,
    });
  }

  /* ---- Waiting period ---------------------------------------------------- */

  if (ground === 'unexpiredWaitingPeriod') {
    const blocked = verdict.block?.stage === 'waitingPeriod';
    const wait = applicableWaits(policy, claim).sort((a, b) => b.months - a.months)[0];

    if (!blocked && wait) {
      push({
        id: 'waiting-expired',
        kind: 'waitingPeriodExpired',
        statedGround: ground,
        summary: `The longest waiting period that could apply to this claim is the ${formatMonths(wait.months)} at ${wait.ref}, and the admission fell at ${formatMonths(months)} of continuous cover.`,
        summaryHi: `इस दावे पर लागू हो सकने वाली सबसे लंबी प्रतीक्षा अवधि खंड ${wait.ref} की ${formatMonthsHi(wait.months)} है, जबकि भर्ती के समय ${formatMonthsHi(months)} की निरंतर बीमा अवधि पूर्ण हो चुकी थी।`,
        vmFinding: `Run against ${policy.name}, no waiting period reduces this claim; ${paid} is admissible.`,
        vmFindingHi: `${policy.name} पर चलाने पर कोई प्रतीक्षा अवधि इस दावे को कम नहीं करती; ${paid} देय बनता है।`,
        strength: 'direct',
        clauseRef: wait.ref,
        clauseTitle: wait.title,
        sourceQuote: wait.provenance.sourceQuote,
        ruleId: VM_RULE_IDS.waitingInitial,
      });
    } else if (blocked && verdict.block) {
      push({
        id: 'waiting-agrees',
        kind: 'treeAgrees',
        statedGround: ground,
        summary: `On this policy and these dates the stated ground holds: ${verdict.block.humanReason}`,
        summaryHi: `इस पॉलिसी और इन तिथियों पर बताया गया आधार खंड ${verdict.block.clauseRef} के अनुसार टिकता है।`,
        vmFinding:
          'The line worth putting is therefore factual rather than contractual: check the date of inception and the date of admission on the file against the ones used here.',
        vmFindingHi:
          'अतः उठाने योग्य बिंदु अनुबंध का नहीं, तथ्य का है: फाइल में दर्ज आरंभ तिथि और भर्ती तिथि की जाँच यहाँ प्रयुक्त तिथियों से करें।',
        strength: 'supporting',
        clauseRef: verdict.block.clauseRef,
        clauseTitle: verdict.block.clauseTitle,
        sourceQuote: verdict.block.sourceQuote,
        ruleId: verdict.block.ruleId,
      });
    }
  }

  /* ---- Permanent exclusion ----------------------------------------------- */

  if (ground === 'permanentExclusion') {
    const blocked = verdict.block?.stage === 'exclusion';
    const exclusion = firstClauseOfKind(policy, 'PermanentExclusion');

    if (!blocked) {
      push({
        id: 'no-such-exclusion',
        kind: 'noSuchExclusion',
        statedGround: ground,
        summary: exclusion
          ? `${procedure} does not appear on the permanent exclusion list at ${exclusion.ref} of ${policy.name}.`
          : `${policy.name} declares no permanent exclusions at all.`,
        summaryHi: exclusion
          ? `${procedureHi} ${policy.name} के खंड ${exclusion.ref} की स्थायी अपवर्जन सूची में नहीं है।`
          : `${policy.name} में कोई स्थायी अपवर्जन घोषित ही नहीं है।`,
        vmFinding: `Run against the compiled wording, ${paid} of this claim is admissible.`,
        vmFindingHi: `संकलित शब्दावली पर चलाने पर इस दावे में से ${paid} देय बनता है।`,
        strength: 'direct',
        ...(exclusion
          ? {
              clauseRef: exclusion.ref,
              clauseTitle: exclusion.title,
              sourceQuote: exclusion.provenance.sourceQuote,
            }
          : {}),
        ruleId: VM_RULE_IDS.permanentExclusion,
      });
    } else if (verdict.block) {
      push({
        id: 'exclusion-agrees',
        kind: 'treeAgrees',
        statedGround: ground,
        summary: `On this policy the stated ground holds: ${verdict.block.humanReason}`,
        summaryHi: `इस पॉलिसी पर बताया गया आधार खंड ${verdict.block.clauseRef} के अनुसार टिकता है।`,
        vmFinding:
          'A permanent exclusion does not expire, so the length of cover and the moratorium are both beside the point. The question worth raising is whether the procedure performed is the one the clause names.',
        vmFindingHi:
          'स्थायी अपवर्जन समाप्त नहीं होता, अतः बीमा अवधि की लंबाई और मोरेटोरियम दोनों अप्रासंगिक हैं। उठाने योग्य प्रश्न यह है कि की गई प्रक्रिया वही है या नहीं जिसका उल्लेख खंड में है।',
        strength: 'supporting',
        clauseRef: verdict.block.clauseRef,
        clauseTitle: verdict.block.clauseTitle,
        sourceQuote: verdict.block.sourceQuote,
        ruleId: verdict.block.ruleId,
      });
    }
  }

  /* ---- Non-disclosure, and the moratorium -------------------------------- */

  if (ground === 'nonDisclosurePED') {
    const { contestability } = verdict;

    if (contestability.moratoriumComplete) {
      push({
        id: 'moratorium-complete',
        kind: 'moratoriumComplete',
        statedGround: ground,
        summary: `${formatMonths(contestability.monthsOfContinuousCover)} of continuous cover are complete, and the moratorium at ${contestability.clauseRef} runs at ${formatMonths(contestability.moratoriumMonths)}.`,
        summaryHi: `${formatMonthsHi(contestability.monthsOfContinuousCover)} की निरंतर बीमा अवधि पूर्ण है, और खंड ${contestability.clauseRef} की मोरेटोरियम अवधि ${formatMonthsHi(contestability.moratoriumMonths)} की है।`,
        vmFinding:
          'On the wording, a claim is no longer contestable on the ground of non-disclosure or misrepresentation once the moratorium is complete, except where fraud is established. This matches IRDAI’s stated basis for the moratorium in indemnity health cover.',
        vmFindingHi:
          'शब्दावली के अनुसार, मोरेटोरियम पूर्ण होने के बाद दावे को अप्रकटीकरण या गलतबयानी के आधार पर चुनौती नहीं दी जा सकती, सिवाय सिद्ध धोखाधड़ी के। यह क्षतिपूर्ति स्वास्थ्य बीमा में मोरेटोरियम हेतु IRDAI द्वारा बताए गए आधार से मेल खाता है।',
        strength: 'direct',
        clauseRef: contestability.clauseRef,
        clauseTitle: contestability.clauseTitle,
        sourceQuote: contestability.sourceQuote,
        ruleId: VM_RULE_IDS.moratoriumContestability,
      });
    }

    const pedWait = clausesOfKind(policy, 'WaitingPeriod').find(
      (clause) => clause.waitingKind === 'preExistingDisease',
    );
    const blockedByWait = verdict.block?.stage === 'waitingPeriod';

    if (pedWait && !blockedByWait && months >= pedWait.months) {
      push({
        id: 'ped-wait-expired',
        kind: 'waitingPeriodExpired',
        statedGround: ground,
        summary: `The pre-existing disease waiting period at ${pedWait.ref} runs for ${formatMonths(pedWait.months)}, and this admission fell at ${formatMonths(months)} of continuous cover.`,
        summaryHi: `खंड ${pedWait.ref} की पूर्व-विद्यमान रोग प्रतीक्षा अवधि ${formatMonthsHi(pedWait.months)} की है, और यह भर्ती ${formatMonthsHi(months)} की निरंतर बीमा अवधि पर हुई।`,
        vmFinding:
          'Once that period is complete the wording treats a pre-existing condition as covered. Whether it was disclosed is a separate question from whether it is covered, and the two are often run together in a repudiation letter.',
        vmFindingHi:
          'उस अवधि के पूर्ण होने पर शब्दावली पूर्व-विद्यमान रोग को कवर मानती है। रोग बताया गया था या नहीं, यह प्रश्न इससे अलग है कि वह कवर है या नहीं; अस्वीकृति पत्र में ये दोनों प्रायः मिला दिए जाते हैं।',
        strength: 'direct',
        clauseRef: pedWait.ref,
        clauseTitle: pedWait.title,
        sourceQuote: pedWait.provenance.sourceQuote,
        ruleId: VM_RULE_IDS.waitingPreExisting,
      });
    }

    if (!contestability.moratoriumComplete) {
      push({
        id: 'moratorium-incomplete',
        kind: 'treeAgrees',
        statedGround: ground,
        summary: `The moratorium at ${contestability.clauseRef} is not yet complete: ${formatMonths(contestability.monthsOfContinuousCover)} of ${formatMonths(contestability.moratoriumMonths)} have run.`,
        summaryHi: `खंड ${contestability.clauseRef} की मोरेटोरियम अवधि अभी पूर्ण नहीं है: ${formatMonthsHi(contestability.moratoriumMonths)} में से ${formatMonthsHi(contestability.monthsOfContinuousCover)} बीते हैं।`,
        vmFinding:
          'The insurer may still raise non-disclosure. The points worth putting are factual: what was asked on the proposal form, what was answered, and whether the condition was known at that date.',
        vmFindingHi:
          'बीमाकर्ता अभी भी अप्रकटीकरण का प्रश्न उठा सकता है। उठाने योग्य बिंदु तथ्यात्मक हैं: प्रस्ताव फॉर्म में क्या पूछा गया, क्या उत्तर दिया गया, और उस तिथि पर रोग की जानकारी थी या नहीं।',
        strength: 'supporting',
        clauseRef: contestability.clauseRef,
        clauseTitle: contestability.clauseTitle,
        sourceQuote: contestability.sourceQuote,
        ruleId: VM_RULE_IDS.moratoriumContestability,
      });
    }
  }

  /* ---- Room rent --------------------------------------------------------- */

  if (ground === 'roomRentProportionate') {
    const cap = firstClauseOfKind(policy, 'RoomRentCap');
    const roomDeduction = verdict.deductions.find((d) => d.stage === 'roomRentProportionate');

    if (!cap) {
      push({
        id: 'no-room-cap',
        kind: 'noRoomRentCapInPolicy',
        statedGround: ground,
        summary: `${policy.name} contains no room rent limit and no proportionate deduction clause.`,
        summaryHi: `${policy.name} में न कोई कक्ष किराया सीमा है और न ही आनुपातिक कटौती का कोई खंड।`,
        vmFinding: `Run against the compiled wording, ${paid} of this claim is admissible with no reduction on account of the room occupied.`,
        vmFindingHi: `संकलित शब्दावली पर चलाने पर, कक्ष के कारण बिना किसी कटौती के इस दावे में से ${paid} देय बनता है।`,
        strength: 'direct',
        ruleId: VM_RULE_IDS.roomRentProportionate,
      });
    } else if (roomDeduction && roomDeduction.basis.kind === 'proportionate') {
      const basis = roomDeduction.basis;
      push({
        id: 'proportionate-exempt-heads',
        kind: 'proportionateExemptHeads',
        statedGround: ground,
        summary: `The proportion at ${cap.ref} reaches ${categoryPhrase(cap.associatedCategories)} only. ${formatPaise(basis.exemptedPaise)} of this bill sits in ${categoryPhrase(cap.exemptCategories)}, which the same clause exempts by name.`,
        summaryHi: `खंड ${cap.ref} की आनुपातिक कटौती केवल ${categoryPhraseHi(cap.associatedCategories)} पर लागू होती है। इस बिल का ${formatPaise(basis.exemptedPaise)} ${categoryPhraseHi(cap.exemptCategories)} में है, जिन्हें वही खंड नाम लेकर छूट देता है।`,
        vmFinding: `On the wording, the proportion accounts for ${formatPaise(roomDeduction.amountPaise)} and no more; ${categoryPhrase(cap.exemptCategories)} are not reduced.`,
        vmFindingHi: `शब्दावली के अनुसार आनुपातिक कटौती ${formatPaise(roomDeduction.amountPaise)} तक ही सीमित है; ${categoryPhraseHi(cap.exemptCategories)} में कोई कटौती नहीं होती।`,
        strength: 'direct',
        clauseRef: cap.ref,
        clauseTitle: cap.title,
        sourceQuote: cap.exemptionProvenance?.sourceQuote ?? cap.provenance.sourceQuote,
        ruleId: VM_RULE_IDS.roomRentProportionate,
      });
    } else {
      push({
        id: 'room-within-limit',
        kind: 'noClauseSupportsGround',
        statedGround: ground,
        summary: `The room in this claim is within the eligible room rent under ${cap.ref}, so a proportionate deduction does not arise.`,
        summaryHi: `इस दावे का कक्ष खंड ${cap.ref} की पात्र कक्ष किराया सीमा के भीतर है, अतः आनुपातिक कटौती का प्रश्न ही नहीं उठता।`,
        vmFinding: `Run against the compiled wording, ${paid} of this claim is admissible.`,
        vmFindingHi: `संकलित शब्दावली पर चलाने पर इस दावे में से ${paid} देय बनता है।`,
        strength: 'direct',
        clauseRef: cap.ref,
        clauseTitle: cap.title,
        sourceQuote: cap.provenance.sourceQuote,
        ruleId: VM_RULE_IDS.roomRentProportionate,
      });
    }
  }

  /* ---- Medical necessity -------------------------------------------------- */

  if (ground === 'notMedicallyNecessary') {
    push({
      id: 'no-clause-medical-necessity',
      kind: 'noClauseSupportsGround',
      statedGround: ground,
      summary: `No clause in ${policy.name} makes ${procedure.toLowerCase()} inadmissible, and the compiled tree reaches ${paid} on the wording alone.`,
      summaryHi: `${policy.name} का कोई खंड ${procedureHi} को अदेय नहीं बनाता, और केवल शब्दावली के आधार पर संकलित वृक्ष ${paid} तक पहुँचता है।`,
      vmFinding:
        'Medical necessity is a clinical question rather than a clause, so this tool cannot answer it. What it can say is that the wording contains nothing refusing this procedure, which puts the weight on the treating record rather than on the policy.',
      vmFindingHi:
        'चिकित्सकीय आवश्यकता खंड का नहीं, चिकित्सा का प्रश्न है, अतः यह उपकरण उसका उत्तर नहीं दे सकता। यह इतना अवश्य कह सकता है कि शब्दावली में इस प्रक्रिया को अस्वीकार करने वाला कुछ नहीं है, जिससे भार पॉलिसी पर नहीं, उपचार के अभिलेख पर आ जाता है।',
      strength: verdict.paidPaise > 0n ? 'direct' : 'supporting',
      ruleId: LETTER_RULE_IDS.verdictSummary,
    });
  }

  /* ---- Documents ---------------------------------------------------------- */

  if (ground === 'documentsIncomplete') {
    push({
      id: 'not-a-denial-on-merits',
      kind: 'notADenialOnMerits',
      statedGround: ground,
      summary:
        'A closure for want of documents is not a decision on the merits of the claim, and the wording contains no clause extinguishing a claim on that basis.',
      summaryHi:
        'दस्तावेज़ों के अभाव में फाइल बंद करना दावे के गुण-दोष पर निर्णय नहीं है, और शब्दावली में ऐसा कोई खंड नहीं है जो इस आधार पर दावे को समाप्त करता हो।',
      vmFinding: `On the wording, ${paid} of this ${claimed} bill is admissible once the file is complete.`,
      vmFindingHi: `शब्दावली के अनुसार, फाइल पूर्ण होने पर ${claimed} के इस बिल में से ${paid} देय बनता है।`,
      strength: 'direct',
      ruleId: LETTER_RULE_IDS.verdictSummary,
    });
  }

  /* ---- The arithmetic, whatever the ground -------------------------------- */

  const shortfall = verdict.paidPaise - insurerPaidPaise;
  if (shortfall > 0n) {
    const deducted = formatPaise(verdict.claimedPaise - verdict.paidPaise);
    push({
      id: 'shortfall',
      kind: 'repudiationExceedsDeduction',
      statedGround: ground,
      summary: `The compiled wording makes ${paid} admissible. The settlement was ${formatPaise(insurerPaidPaise)}. The difference of ${formatPaise(shortfall)} is not accounted for by any clause in this policy.`,
      summaryHi: `संकलित शब्दावली के अनुसार ${paid} देय बनता है। निपटान ${formatPaise(insurerPaidPaise)} का हुआ। ${formatPaise(shortfall)} का यह अंतर इस पॉलिसी के किसी खंड से स्पष्ट नहीं होता।`,
      vmFinding:
        verdict.deductions.length === 0
          ? 'Not one clause in the compiled tree reduces this claim.'
          : `Every reduction the wording supports is itemised above and totals ${deducted}.`,
      vmFindingHi:
        verdict.deductions.length === 0
          ? 'संकलित वृक्ष का एक भी खंड इस दावे को कम नहीं करता।'
          : `शब्दावली द्वारा समर्थित प्रत्येक कटौती ऊपर मदवार दी गई है और उनका योग ${deducted} है।`,
      strength: 'direct',
      ruleId: LETTER_RULE_IDS.verdictSummary,
    });
  }

  return out;
}

/** Direct contradictions first, then supporting, stable within each group. */
export function sortContradictions(items: readonly Contradiction[]): Contradiction[] {
  const direct = items.filter((item) => item.strength === 'direct');
  const supporting = items.filter((item) => item.strength !== 'direct');
  return [...direct, ...supporting];
}
