/**
 * Human names for the closed vocabularies. Pure data.
 *
 * These live inside the VM because the evaluator writes the `humanReason` on
 * every deduction, and that sentence has to read like English rather than like
 * an enum. Nothing here performs I/O or reads a locale.
 */

import type { LineCategory, ProcedureCode, Stage } from './types';

export const PROCEDURE_LABELS: Readonly<Record<ProcedureCode, string>> = {
  cataract: 'Cataract surgery',
  kneeReplacement: 'Total knee replacement',
  angioplasty: 'Coronary angioplasty',
  cabg: 'Coronary artery bypass graft',
  herniaRepair: 'Hernia repair',
  appendectomy: 'Appendectomy',
  maternityDelivery: 'Maternity delivery',
  cosmeticSurgery: 'Cosmetic surgery',
  bariatricSurgery: 'Bariatric surgery',
  dialysis: 'Dialysis admission',
};

/** The same names in Hindi, for the appeal body only. */
export const PROCEDURE_LABELS_HI: Readonly<Record<ProcedureCode, string>> = {
  cataract: 'मोतियाबिंद शल्यक्रिया',
  kneeReplacement: 'संपूर्ण घुटना प्रत्यारोपण',
  angioplasty: 'कोरोनरी एंजियोप्लास्टी',
  cabg: 'कोरोनरी आर्टरी बायपास ग्राफ्ट',
  herniaRepair: 'हर्निया की शल्यक्रिया',
  appendectomy: 'अपेंडिक्स की शल्यक्रिया',
  maternityDelivery: 'प्रसव',
  cosmeticSurgery: 'सौंदर्य शल्यक्रिया',
  bariatricSurgery: 'बैरिएट्रिक शल्यक्रिया',
  dialysis: 'डायलिसिस हेतु भर्ती',
};

export const CATEGORY_LABELS: Readonly<Record<LineCategory, string>> = {
  room: 'Room rent',
  nursing: 'Nursing charges',
  surgeon: 'Surgeon fee',
  anaesthetist: 'Anaesthetist fee',
  operationTheatre: 'Operation theatre',
  pharmacy: 'Pharmacy',
  consumables: 'Consumables',
  implants: 'Implants',
  diagnostics: 'Diagnostics',
  ambulance: 'Ambulance',
  nonMedical: 'Non-medical items',
};

export const STAGE_LABELS: Readonly<Record<Stage, string>> = {
  exclusion: 'Permanent exclusion',
  waitingPeriod: 'Waiting period',
  lineItemIneligible: 'Ineligible items',
  roomRentProportionate: 'Room rent proportion',
  subLimit: 'Sub-limit',
  deductible: 'Deductible',
  coPay: 'Co-pay',
  sumInsured: 'Sum insured cap',
};

/** Joins a list the way a sentence would: "a, b and c". */
export function listPhrase(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  const head = items.slice(0, -1).join(', ');
  return `${head} and ${items[items.length - 1] ?? ''}`;
}

export function categoryPhrase(categories: readonly LineCategory[]): string {
  return listPhrase(categories.map((c) => (CATEGORY_LABELS[c] ?? c).toLowerCase()));
}

export const CATEGORY_LABELS_HI: Readonly<Record<LineCategory, string>> = {
  room: 'कक्ष किराया',
  nursing: 'नर्सिंग शुल्क',
  surgeon: 'शल्य चिकित्सक शुल्क',
  anaesthetist: 'निश्चेतक शुल्क',
  operationTheatre: 'ऑपरेशन थिएटर',
  pharmacy: 'औषधि',
  consumables: 'उपभोग्य सामग्री',
  implants: 'प्रत्यारोपण',
  diagnostics: 'जाँच',
  ambulance: 'एम्बुलेंस',
  nonMedical: 'गैर-चिकित्सीय मदें',
};

export const STAGE_LABELS_HI: Readonly<Record<Stage, string>> = {
  exclusion: 'स्थायी अपवर्जन',
  waitingPeriod: 'प्रतीक्षा अवधि',
  lineItemIneligible: 'अदेय मदें',
  roomRentProportionate: 'कक्ष किराया आनुपातिक कटौती',
  subLimit: 'उप-सीमा',
  deductible: 'कटौती योग्य राशि',
  coPay: 'सह-भुगतान',
  sumInsured: 'बीमा राशि की सीमा',
};

/** Joins a Hindi list: "a, b तथा c". */
export function listPhraseHi(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  const head = items.slice(0, -1).join(', ');
  return `${head} तथा ${items[items.length - 1] ?? ''}`;
}

export function categoryPhraseHi(categories: readonly LineCategory[]): string {
  return listPhraseHi(categories.map((c) => CATEGORY_LABELS_HI[c] ?? c));
}

/** "18 माह" - the digits are the same, the unit is not. */
export function formatMonthsHi(months: number): string {
  return `${months} माह`;
}
