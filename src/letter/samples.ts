/**
 * Sample rejection reasons, one tap away.
 *
 * Written in the register repudiation letters are actually written in, so the
 * keyword rules are exercised against something realistic rather than against
 * a phrasing chosen to make them look good. They are invented: no insurer is
 * named and no real letter is reproduced.
 *
 * Each sample comes with the claim context it belongs to, so a visitor can see
 * a complete comparison without filling in a single field.
 */

import type { ProcedureCode } from '@/vm/types';

export type LetterSample = {
  id: string;
  title: string;
  note: string;
  text: string;
  context: {
    policyId: string;
    procedure: ProcedureCode;
    billRupees: number;
    months: number;
    preExisting: boolean;
    insurerPaidRupees: number;
  };
};

export const LETTER_SAMPLES: readonly LetterSample[] = [
  {
    id: 'ped-non-disclosure',
    title: 'Non-disclosure, seven years in',
    note: 'The moratorium has run. The letter relies on a ground the wording no longer allows.',
    text: `We regret to inform you that the above claim stands repudiated. On scrutiny of the records submitted, it is observed that the insured person was suffering from the ailment prior to the inception of the policy, and the same was not disclosed in the proposal form at the time of taking the policy. This amounts to non-disclosure of material facts. The claim is therefore not payable and the file is being closed.`,
    context: {
      policyId: 'specimen-a',
      procedure: 'angioplasty',
      billRupees: 350_000,
      months: 78,
      preExisting: true,
      insurerPaidRupees: 0,
    },
  },
  {
    id: 'waiting-period',
    title: 'A waiting period said to be unexpired',
    note: 'The letter cites a twenty-four month wait against four years of cover.',
    text: `With reference to your claim under the captioned policy, we wish to state that the procedure undergone falls under the list of specified diseases which carry a waiting period of 24 months from the date of commencement of the first policy. As the waiting period was not completed on the date of admission, the claim is not admissible under the terms of the policy and stands rejected.`,
    context: {
      policyId: 'specimen-a',
      procedure: 'kneeReplacement',
      billRupees: 400_000,
      months: 49,
      preExisting: false,
      insurerPaidRupees: 0,
    },
  },
  {
    id: 'room-rent',
    title: 'Room rent, applied to everything',
    note: 'A proportionate deduction taken across heads the same clause exempts.',
    text: `Please note that as per the policy terms the eligible room rent per day is limited to 1% of the sum insured. The insured person was admitted in a room of a higher category than the eligibility. Accordingly, a proportionate deduction has been applied to the entire hospitalisation expenses including pharmacy, consumables and implant charges. The balance amount has been settled as per the enclosed statement.`,
    context: {
      policyId: 'specimen-a',
      procedure: 'kneeReplacement',
      billRupees: 400_000,
      months: 42,
      preExisting: false,
      insurerPaidRupees: 160_000,
    },
  },
  {
    id: 'not-medically-necessary',
    title: 'Said not to be medically necessary',
    note: 'A clinical objection with no clause behind it.',
    text: `On review of the discharge summary and the treatment records, our panel of medical experts is of the opinion that there was no active line of treatment administered during the hospitalisation, and the investigations carried out could have been managed on an outpatient basis. The admission was therefore not medically necessary. The claim is repudiated accordingly.`,
    context: {
      policyId: 'specimen-b',
      procedure: 'dialysis',
      billRupees: 95_000,
      months: 40,
      preExisting: false,
      insurerPaidRupees: 0,
    },
  },
  {
    id: 'permanent-exclusion',
    title: 'Said to be permanently excluded',
    note: 'The procedure is not on the exclusion list in this policy.',
    text: `We have examined the claim documents. The treatment undergone by the insured person is specifically excluded under the permanent exclusions of the policy, and no cover is available for the same at any time during the currency of the policy. The claim is therefore closed as not payable.`,
    context: {
      policyId: 'specimen-a',
      procedure: 'herniaRepair',
      billRupees: 180_000,
      months: 50,
      preExisting: false,
      insurerPaidRupees: 0,
    },
  },
  {
    id: 'documents',
    title: 'Closed for want of documents',
    note: 'Not a decision on the merits of the claim at all.',
    text: `This has reference to our earlier communications dated as per record. Despite two reminders, the following documents have not been submitted: original discharge summary, indoor case papers and the break-up of pharmacy bills. In the absence of the pending documents we are unable to process the claim and the file is being closed as no claim.`,
    context: {
      policyId: 'specimen-c',
      procedure: 'cataract',
      billRupees: 90_000,
      months: 55,
      preExisting: false,
      insurerPaidRupees: 0,
    },
  },
];

export const DEFAULT_SAMPLE_ID = 'ped-non-disclosure';

export function findSample(id: string | null | undefined): LetterSample | null {
  return LETTER_SAMPLES.find((sample) => sample.id === id) ?? null;
}
