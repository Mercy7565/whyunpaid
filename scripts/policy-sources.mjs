/**
 * The authored source of the four specimen policies.
 *
 * These are SYNTHETIC wordings. They are modelled on structures common to
 * Indian indemnity health cover so that those structures can be demonstrated
 * and tested. No insurer is named, no insurer's wording is reproduced, and
 * nothing here should be mistaken for a real contract.
 *
 * The wording and the clause quotes are generated from the same template
 * strings, so a quote is a substring of the document by construction rather
 * than by a copy-and-paste that can rot. The build script still verifies it.
 *
 * Everything stays inside WinAnsi: the specimen PDFs are typeset in the
 * standard PDF fonts, which have no rupee sign, so the wordings say "Rs." the
 * way a printed policy schedule does.
 */

/* -------------------------------------------------------------------------- */
/* Numbers in words, the way a schedule writes them                           */
/* -------------------------------------------------------------------------- */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n] ?? '';
  const tens = TENS[Math.floor(n / 10)] ?? '';
  const ones = n % 10 === 0 ? '' : `-${ONES[n % 10]}`;
  return `${tens}${ones}`;
}

function threeDigits(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return twoDigits(rest);
  const tail = rest === 0 ? '' : ` and ${twoDigits(rest)}`;
  return `${ONES[hundreds]} Hundred${tail}`;
}

/** 265000 becomes "Two Lakh Sixty-Five Thousand". */
export function rupeesInWords(amount) {
  if (amount === 0) return 'Nil';
  const parts = [];
  const crore = Math.floor(amount / 10_000_000);
  let rest = amount % 10_000_000;
  const lakh = Math.floor(rest / 100_000);
  rest %= 100_000;
  const thousand = Math.floor(rest / 1_000);
  rest %= 1_000;

  if (crore > 0) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest > 0) parts.push(threeDigits(rest));
  return parts.join(' ');
}

/** 265000 becomes "2,65,000". */
export function groupIndian(amount) {
  const digits = String(amount);
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const pairs = [];
  let index = rest.length;
  while (index > 2) {
    pairs.unshift(rest.slice(index - 2, index));
    index -= 2;
  }
  if (index > 0) pairs.unshift(rest.slice(0, index));
  return `${pairs.join(',')},${last3}`;
}

export function rs(amount) {
  return `Rs. ${groupIndian(amount)}`;
}

const MONTH_WORDS = {
  0: 'nil',
  1: 'thirty days',
  12: 'twelve months',
  24: 'twenty-four months',
  36: 'thirty-six months',
  48: 'forty-eight months',
  60: 'sixty months',
};

function monthsInWords(months) {
  return MONTH_WORDS[months] ?? `${months} months`;
}

const PERCENT_WORDS = {
  100: 'one per cent',
  150: 'one and a half per cent',
  1000: 'ten per cent',
  2000: 'twenty per cent',
  3000: 'thirty per cent',
};

function percentInWords(bps) {
  return PERCENT_WORDS[bps] ?? `${bps / 100} per cent`;
}

const PROCEDURE_WORDING = {
  cataract: 'cataract surgery',
  kneeReplacement: 'total knee replacement',
  angioplasty: 'coronary angioplasty',
  cabg: 'coronary artery bypass graft',
  herniaRepair: 'hernia repair',
  appendectomy: 'appendectomy',
  maternityDelivery: 'maternity and childbirth',
  cosmeticSurgery: 'cosmetic or aesthetic treatment',
  bariatricSurgery: 'bariatric and weight-control surgery',
  dialysis: 'dialysis',
};

const PROCEDURE_TABLE_WORDING = {
  cataract: 'Cataract surgery, per eye',
  kneeReplacement: 'Total knee replacement, per joint',
  angioplasty: 'Coronary angioplasty, per admission',
  cabg: 'Coronary artery bypass graft, per admission',
  herniaRepair: 'Hernia repair, per admission',
  appendectomy: 'Appendectomy, per admission',
  maternityDelivery: 'Maternity and childbirth, per delivery',
  cosmeticSurgery: 'Cosmetic or aesthetic treatment',
  bariatricSurgery: 'Bariatric surgery, per admission',
  dialysis: 'Dialysis, per admission',
};

function listWording(codes, table = false) {
  const names = codes.map((code) =>
    table ? PROCEDURE_TABLE_WORDING[code] : PROCEDURE_WORDING[code],
  );
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/* -------------------------------------------------------------------------- */
/* Shared wording                                                             */
/* -------------------------------------------------------------------------- */

const ASSOCIATED = ['room', 'nursing', 'surgeon', 'anaesthetist', 'operationTheatre'];
const EXEMPT = ['pharmacy', 'consumables', 'implants', 'diagnostics'];

const NON_PAYABLE_SENTENCE =
  'The following are not payable under this Policy: items of personal comfort and convenience, toiletries, attendant charges, admission and registration fees, documentation and service charges, and other non-medical items of the kind set out in the annexure of non-medical expenses.';

const NON_PAYABLE_QUOTE =
  'items of personal comfort and convenience, toiletries, attendant charges, admission and registration fees, documentation and service charges, and other non-medical items';

const EXEMPTION_SENTENCE =
  'Proportionate deduction under this Clause shall not be applied to pharmacy, consumables, implants or diagnostics, the cost of which does not vary with the category of room occupied.';

const EXEMPTION_QUOTE =
  'Proportionate deduction under this Clause shall not be applied to pharmacy, consumables, implants or diagnostics';

/* -------------------------------------------------------------------------- */
/* The document                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Builds the full wording and the clause list for one specimen from its spec.
 * Returns `{ document, clauses }`, where every clause carries a `quote` that
 * the build script must be able to find, verbatim, inside the document.
 */
export function buildPolicySource(spec) {
  const sections = [];
  const clauses = [];

  const siWords = rupeesInWords(spec.sumInsuredRupees);
  const siFigure = rs(spec.sumInsuredRupees);

  /* ---- 1. Preamble ------------------------------------------------------- */

  sections.push({
    heading: '1. Preamble',
    paragraphs: [
      'This is a synthetic specimen policy wording. It is not the wording of any insurer, no insurer is named in it, and it creates no rights or obligations of any kind. It has been written to model the structure of indemnity health insurance cover issued in India so that the operation of that structure can be demonstrated and tested.',
      'Whereas the Insured Person has made a proposal to the Company and has paid the premium stated in the Schedule, the Company agrees, subject to the terms, conditions, limits and exclusions of this Policy, to indemnify the Insured Person in respect of the reasonable and customary expenses of Hospitalisation incurred during the Policy Year.',
      `This Policy is issued in the shape described as follows. ${spec.shape}`,
    ],
  });

  /* ---- 2. The Schedule --------------------------------------------------- */

  const sumInsuredSentence = `Sum Insured: Rupees ${siWords} (${siFigure}) for the Policy Year, available on a floater basis to all Insured Persons named in the Schedule.`;

  sections.push({
    heading: '2. The Schedule',
    paragraphs: [
      sumInsuredSentence,
      'Policy Year: a period of twelve consecutive months commencing on the date of inception stated in the Schedule, or on any anniversary of that date.',
      'Continuous Cover: cover under this Policy or under a policy it replaced, renewed without a break, reckoned from the date of inception of the first Policy Year.',
    ],
  });

  clauses.push({
    id: `${spec.id}.sumInsured`,
    ref: '2.1',
    title: 'Sum insured',
    kind: 'SumInsured',
    amountPaise: String(spec.sumInsuredRupees * 100),
    quote: sumInsuredSentence,
    confidence: 'high',
  });

  /* ---- 3. What is payable ------------------------------------------------ */

  sections.push({
    heading: '3. Cover',
    paragraphs: [
      'The Company shall indemnify the medical expenses reasonably and necessarily incurred by an Insured Person on Hospitalisation for the medical or surgical treatment of an Illness or Injury contracted or sustained during the Policy Year, provided the Hospitalisation is medically necessary and is on the written advice of a Medical Practitioner.',
      'Payable heads of expense include room rent for the category of room occupied, nursing charges, the fees of the surgeon, anaesthetist and physician, operation theatre charges, the cost of drugs and consumables administered during the Hospitalisation, the cost of implants and prostheses used in the course of the procedure, and diagnostic and investigative charges directly related to the treatment.',
      NON_PAYABLE_SENTENCE,
    ],
  });

  clauses.push({
    id: `${spec.id}.nonPayable`,
    ref: '3.9',
    title: 'Non-payable items',
    kind: 'LineItemIneligibility',
    categories: spec.nonPayable,
    quote: NON_PAYABLE_QUOTE,
    confidence: 'high',
  });

  /* ---- 4. Limits, deductions and shares ---------------------------------- */

  const part4 = { heading: '4. Limits, deductions and shares', paragraphs: [] };

  part4.paragraphs.push(
    'The amounts payable under Part 3 are subject to the limits, deductions and shares set out in this Part. They are applied in the sequence in which they appear below.',
  );

  if (spec.roomCap) {
    const eligibleSentence =
      spec.roomCap.basis === 'percentOfSumInsuredPerDay'
        ? `The eligible room rent per day is ${percentInWords(spec.roomCap.percentBps)} of the Sum Insured.`
        : `The eligible room rent per day is Rupees ${rupeesInWords(spec.roomCap.perDayRupees)} (${rs(spec.roomCap.perDayRupees)}).`;

    /* Kept to 21 words: a source quote may be at most 25. */
    const proportionQuote =
      'the room charge and the associated charges for nursing, surgeon, anaesthetist and operation theatre shall be payable in the same proportion';

    part4.paragraphs.push(
      `${eligibleSentence} Where the Insured Person occupies a room whose rent exceeds the eligible room rent, ${proportionQuote} that the eligible room rent bears to the room rent actually incurred.`,
      EXEMPTION_SENTENCE,
    );

    clauses.push({
      id: `${spec.id}.roomCap`,
      ref: '4.2',
      title: 'Room rent limit and proportionate deduction',
      kind: 'RoomRentCap',
      limit:
        spec.roomCap.basis === 'percentOfSumInsuredPerDay'
          ? { basis: 'percentOfSumInsuredPerDay', percentBps: spec.roomCap.percentBps }
          : { basis: 'perDayAmount', perDayPaise: String(spec.roomCap.perDayRupees * 100) },
      associatedCategories: ASSOCIATED,
      exemptCategories: EXEMPT,
      quote: proportionQuote,
      exemptionQuote: EXEMPTION_QUOTE,
      confidence: 'high',
    });
  } else {
    part4.paragraphs.push(
      'No limit is placed by this Policy on the category of room that may be occupied, and no proportionate deduction is applied to associated charges on account of the room rent incurred.',
    );
  }

  if (spec.subLimits.length > 0) {
    const rows = spec.subLimits
      .map(
        (limit) =>
          `${listWording(limit.procedures, true)}: Rupees ${rupeesInWords(limit.rupees)} (${rs(limit.rupees)}).`,
      )
      .join(' ');
    part4.paragraphs.push(
      `The Company shall not be liable to pay more than the amount stated against a procedure in the table below, whatever the amount otherwise admissible. ${rows}`,
    );

    spec.subLimits.forEach((limit, index) => {
      clauses.push({
        id: `${spec.id}.subLimit.${index}`,
        ref: `4.6(${String.fromCharCode(97 + index)})`,
        title: `Sub-limit: ${listWording(limit.procedures)}`,
        kind: 'SubLimit',
        procedures: limit.procedures,
        capPaise: String(limit.rupees * 100),
        quote: `${listWording(limit.procedures, true)}: Rupees ${rupeesInWords(limit.rupees)} (${rs(limit.rupees)}).`,
        confidence: 'high',
      });
    });
  } else {
    part4.paragraphs.push(
      'This Policy sets no procedure-wise sub-limit. The Sum Insured is the only ceiling on an admissible claim.',
    );
  }

  if (spec.deductibleRupees > 0) {
    const deductibleQuote = `A deductible of Rupees ${rupeesInWords(spec.deductibleRupees)} (${rs(spec.deductibleRupees)}) shall be borne by the Insured Person in respect of each and every claim`;
    part4.paragraphs.push(
      `${deductibleQuote}, before the Company becomes liable to pay anything under this Policy.`,
    );
    clauses.push({
      id: `${spec.id}.deductible`,
      ref: '4.8',
      title: 'Deductible',
      kind: 'Deductible',
      amountPaise: String(spec.deductibleRupees * 100),
      quote: deductibleQuote,
      confidence: 'high',
    });
  } else {
    part4.paragraphs.push('No deductible applies to a claim under this Policy.');
  }

  if (spec.coPayBps > 0) {
    const coPayQuote = `a co-payment of ${percentInWords(spec.coPayBps)}, which shall be borne by the Insured Person and applied to the admissible amount`;
    part4.paragraphs.push(
      `Every admissible claim under this Policy is subject to ${coPayQuote} after every other limit and deduction in this Part has been applied.`,
    );
    clauses.push({
      id: `${spec.id}.coPay`,
      ref: '4.9',
      title: 'Co-payment',
      kind: 'CoPay',
      percentBps: spec.coPayBps,
      quote: coPayQuote,
      confidence: 'high',
    });
  } else {
    part4.paragraphs.push('No co-payment applies to a claim under this Policy.');
  }

  sections.push(part4);

  /* ---- 5. Waiting periods ------------------------------------------------ */

  const part5 = { heading: '5. Waiting periods', paragraphs: [] };

  const initialQuote = `No claim is admissible for any Illness contracted within ${monthsInWords(spec.waits.initialMonths)} of the commencement of the first Policy Year`;
  part5.paragraphs.push(
    `${initialQuote}, other than a claim arising from accidental bodily Injury.`,
  );
  clauses.push({
    id: `${spec.id}.wait.initial`,
    ref: '5.1',
    title: 'Initial waiting period',
    kind: 'WaitingPeriod',
    waitingKind: 'initial',
    months: spec.waits.initialMonths,
    appliesTo: { scope: 'all' },
    quote: initialQuote,
    confidence: 'high',
  });

  const specificQuote = `${capitalise(listWording(spec.waits.specific.procedures))} are subject to a waiting period of ${monthsInWords(spec.waits.specific.months)} of Continuous Cover`;
  part5.paragraphs.push(
    `${specificQuote} reckoned from the commencement of the first Policy Year, whether or not the condition was disclosed at proposal.`,
  );
  clauses.push({
    id: `${spec.id}.wait.specific`,
    ref: '5.2',
    title: 'Specified-condition waiting period',
    kind: 'WaitingPeriod',
    waitingKind: 'specificDisease',
    months: spec.waits.specific.months,
    appliesTo: { scope: 'procedures', procedures: spec.waits.specific.procedures },
    quote: specificQuote,
    confidence: 'high',
  });

  const pedQuote = `A condition pre-existing at the commencement of the first Policy Year is subject to a waiting period of ${monthsInWords(spec.waits.pedMonths)} of Continuous Cover`;
  part5.paragraphs.push(
    `${pedQuote}. A waiting period runs from the date of inception and is not interrupted by a claim.`,
  );
  clauses.push({
    id: `${spec.id}.wait.ped`,
    ref: '5.3',
    title: 'Pre-existing disease waiting period',
    kind: 'WaitingPeriod',
    waitingKind: 'preExistingDisease',
    months: spec.waits.pedMonths,
    appliesTo: { scope: 'preExisting' },
    quote: pedQuote,
    confidence: 'high',
  });

  sections.push(part5);

  /* ---- 6. Permanent exclusions ------------------------------------------- */

  const exclusionQuote =
    'The Company shall not be liable for any expense in respect of the following at any time during the currency of this Policy';
  sections.push({
    heading: '6. Permanent exclusions',
    paragraphs: [
      `${exclusionQuote}: ${listWording(spec.exclusions)}.`,
      'A permanent exclusion is not a waiting period. It does not expire, and no length of Continuous Cover brings the excluded treatment within the scope of this Policy.',
    ],
  });
  clauses.push({
    id: `${spec.id}.exclusions`,
    ref: '6.1',
    title: 'Permanent exclusions',
    kind: 'PermanentExclusion',
    procedures: spec.exclusions,
    quote: exclusionQuote,
    confidence: 'high',
  });

  /* ---- 7. Conditions ------------------------------------------------------ */

  const moratoriumQuote = `After ${monthsInWords(spec.moratoriumMonths)} of Continuous Cover, no claim under this Policy shall be contestable on the ground of non-disclosure or misrepresentation`;
  sections.push({
    heading: '7. Conditions',
    paragraphs: [
      'Notice of a claim shall be given to the Company within the period stated in the Schedule, and the documents listed in the claim form shall be furnished with it.',
      `${moratoriumQuote}, save where fraud is established.`,
      'The preceding Clause does not extend cover. Permanent exclusions, sub-limits, deductibles, co-payment and any waiting period that remains unexpired continue to apply in full after the moratorium is complete.',
      'This Policy shall be governed by the law in force in India and is subject to the grievance redressal and ombudsman mechanism described in the Schedule.',
    ],
  });
  clauses.push({
    id: `${spec.id}.moratorium`,
    ref: '7.4',
    title: 'Moratorium period',
    kind: 'Moratorium',
    months: spec.moratoriumMonths,
    quote: moratoriumQuote,
    confidence: 'high',
  });

  return {
    id: spec.id,
    name: spec.name,
    synthetic: true,
    slug: spec.slug,
    summary: spec.summary,
    shape: spec.shape,
    document: {
      title: spec.name.toUpperCase(),
      subtitle:
        'Synthetic specimen wording. Not the wording of any insurer. Generated for demonstration and testing.',
      sections,
    },
    clauses,
  };
}

function capitalise(text) {
  return text.length === 0 ? text : `${text[0].toUpperCase()}${text.slice(1)}`;
}

/* -------------------------------------------------------------------------- */
/* The four specimens                                                         */
/* -------------------------------------------------------------------------- */

export const SPECIMENS = [
  {
    id: 'specimen-a',
    name: 'Specimen Floater A',
    slug: 'specimen-floater-a',
    summary: 'Five lakh floater. Room rent pegged to the sum insured, a fifth of the claim co-paid.',
    shape:
      'The room rent is pegged to the Sum Insured, two procedures carry their own ceilings, and a co-payment is taken from whatever survives.',
    sumInsuredRupees: 500_000,
    roomCap: { basis: 'percentOfSumInsuredPerDay', percentBps: 100 },
    subLimits: [
      { procedures: ['cataract'], rupees: 40_000 },
      { procedures: ['kneeReplacement'], rupees: 265_000 },
    ],
    deductibleRupees: 0,
    coPayBps: 2_000,
    nonPayable: ['nonMedical'],
    waits: {
      initialMonths: 1,
      specific: { months: 24, procedures: ['cataract', 'herniaRepair', 'kneeReplacement'] },
      pedMonths: 36,
    },
    exclusions: ['cosmeticSurgery'],
    moratoriumMonths: 60,
  },
  {
    id: 'specimen-b',
    name: 'Specimen Floater B',
    slug: 'specimen-floater-b',
    summary: 'Ten lakh floater. A flat room cap and a deductible instead of a co-payment.',
    shape:
      'The room rent is capped in rupees rather than as a share of the Sum Insured, a deductible is taken on every claim, and there is no co-payment.',
    sumInsuredRupees: 1_000_000,
    roomCap: { basis: 'perDayAmount', perDayRupees: 7_500 },
    subLimits: [
      { procedures: ['cataract'], rupees: 35_000 },
      { procedures: ['kneeReplacement'], rupees: 300_000 },
      { procedures: ['angioplasty'], rupees: 200_000 },
    ],
    deductibleRupees: 50_000,
    coPayBps: 0,
    nonPayable: ['nonMedical'],
    waits: {
      initialMonths: 1,
      specific: { months: 24, procedures: ['cataract', 'herniaRepair'] },
      pedMonths: 24,
    },
    exclusions: ['cosmeticSurgery', 'bariatricSurgery'],
    moratoriumMonths: 60,
  },
  {
    id: 'specimen-c',
    name: 'Specimen Floater C',
    slug: 'specimen-floater-c',
    summary: 'Three lakh senior plan. A long pre-existing wait, a deductible and a heavy co-payment.',
    shape:
      'Cover is smaller, the pre-existing disease waiting period is the longest of the four specimens, and both a deductible and a substantial co-payment apply.',
    sumInsuredRupees: 300_000,
    roomCap: { basis: 'percentOfSumInsuredPerDay', percentBps: 150 },
    subLimits: [
      { procedures: ['cataract'], rupees: 30_000 },
      { procedures: ['kneeReplacement'], rupees: 150_000 },
      { procedures: ['cabg'], rupees: 200_000 },
    ],
    deductibleRupees: 25_000,
    coPayBps: 3_000,
    nonPayable: ['nonMedical'],
    waits: {
      initialMonths: 1,
      specific: { months: 24, procedures: ['cataract', 'herniaRepair', 'kneeReplacement'] },
      pedMonths: 48,
    },
    exclusions: ['cosmeticSurgery', 'bariatricSurgery', 'maternityDelivery'],
    moratoriumMonths: 60,
  },
  {
    id: 'specimen-d',
    name: 'Specimen Floater D',
    slug: 'specimen-floater-d',
    summary: 'Twenty-five lakh cover. No room cap, no sub-limits, one large deductible.',
    shape:
      'There is no room rent cap and no procedure sub-limit at all, so a single large deductible is the only thing standing between the bill and the Sum Insured.',
    sumInsuredRupees: 2_500_000,
    roomCap: null,
    subLimits: [],
    deductibleRupees: 100_000,
    coPayBps: 0,
    nonPayable: ['nonMedical'],
    waits: {
      initialMonths: 1,
      specific: { months: 24, procedures: ['cataract', 'herniaRepair'] },
      pedMonths: 36,
    },
    exclusions: ['cosmeticSurgery'],
    moratoriumMonths: 60,
  },
];
