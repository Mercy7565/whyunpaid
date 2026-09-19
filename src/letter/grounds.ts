/**
 * Reading a rejection letter.
 *
 * Insurers write repudiation letters in a small number of registers, and the
 * ground they are relying on is almost always signalled by a handful of set
 * phrases. So the first pass is a keyword rule set, which runs everywhere, in
 * the browser, offline, with no key and no network. A model is a fallback for
 * the cases the rules cannot place, never the primary path.
 *
 * Weights, not counts. "waiting period" is decisive; "pre-existing" on its own
 * is not, because it appears in letters about disclosure and letters about
 * waiting periods alike. Getting that one boundary right is most of the
 * accuracy in this file.
 */

export const GROUND_KINDS = [
  'nonDisclosurePED',
  'unexpiredWaitingPeriod',
  'permanentExclusion',
  'roomRentProportionate',
  'notMedicallyNecessary',
  'documentsIncomplete',
] as const;

export type GroundKind = (typeof GROUND_KINDS)[number];

export const GROUND_LABELS: Readonly<Record<GroundKind, string>> = {
  nonDisclosurePED: 'Non-disclosure of a pre-existing condition',
  unexpiredWaitingPeriod: 'An unexpired waiting period',
  permanentExclusion: 'A permanent exclusion',
  roomRentProportionate: 'Room rent and proportionate deduction',
  notMedicallyNecessary: 'Treatment said not to be medically necessary',
  documentsIncomplete: 'Documents said to be incomplete',
};

export const GROUND_LABELS_HI: Readonly<Record<GroundKind, string>> = {
  nonDisclosurePED: 'पूर्व-विद्यमान रोग को न बताना',
  unexpiredWaitingPeriod: 'प्रतीक्षा अवधि पूरी न होना',
  permanentExclusion: 'स्थायी अपवर्जन',
  roomRentProportionate: 'कक्ष किराया और आनुपातिक कटौती',
  notMedicallyNecessary: 'उपचार को चिकित्सकीय रूप से आवश्यक न मानना',
  documentsIncomplete: 'दस्तावेज़ अपूर्ण बताना',
};

export const GROUND_NOTES: Readonly<Record<GroundKind, string>> = {
  nonDisclosurePED:
    'The insurer says something material was not disclosed at proposal. This is the ground the sixty-month moratorium speaks to, and the only one it speaks to.',
  unexpiredWaitingPeriod:
    'The insurer says the admission fell inside a waiting period. A waiting period is tested against the length of continuous cover at the date of admission.',
  permanentExclusion:
    'The insurer says the treatment is excluded outright. A permanent exclusion does not expire, so the length of cover is beside the point.',
  roomRentProportionate:
    'The insurer says a higher room category was occupied. That reduces associated charges in proportion. It does not reduce the heads the wording exempts, and it is not a reason to repudiate a claim in full.',
  notMedicallyNecessary:
    'The insurer disputes that the admission was required. This is a clinical question rather than a clause in the wording, so the compiled tree can only show what the wording itself makes admissible.',
  documentsIncomplete:
    'The insurer says the file is incomplete. This is not a decision on the merits of the claim, and it does not usually prevent the claim being re-filed.',
};

type Rule = { phrase: string; weight: number };

/**
 * Phrases are matched case-insensitively against a normalised copy of the
 * letter, so spacing, punctuation and line breaks do not defeat a match.
 */
const RULES: Readonly<Record<GroundKind, readonly Rule[]>> = {
  nonDisclosurePED: [
    { phrase: 'non disclosure', weight: 4 },
    { phrase: 'nondisclosure', weight: 4 },
    { phrase: 'failed to disclose', weight: 4 },
    { phrase: 'did not disclose', weight: 4 },
    { phrase: 'not disclosed', weight: 3 },
    { phrase: 'suppression of material', weight: 4 },
    { phrase: 'material fact', weight: 3 },
    { phrase: 'misrepresentation', weight: 4 },
    { phrase: 'concealment', weight: 3 },
    { phrase: 'concealed', weight: 3 },
    { phrase: 'proposal form', weight: 2 },
    { phrase: 'at the time of proposal', weight: 2 },
    { phrase: 'declaration in the proposal', weight: 2 },
    { phrase: 'pre existing', weight: 1 },
    { phrase: 'preexisting', weight: 1 },
    { phrase: 'ped', weight: 1 },
  ],
  unexpiredWaitingPeriod: [
    { phrase: 'waiting period', weight: 5 },
    { phrase: 'waiting periods', weight: 5 },
    { phrase: 'cooling period', weight: 3 },
    { phrase: 'not completed', weight: 2 },
    { phrase: 'yet to complete', weight: 2 },
    { phrase: 'prior to the expiry', weight: 2 },
    { phrase: 'within the first', weight: 2 },
    { phrase: 'specified disease', weight: 2 },
    { phrase: 'specific disease', weight: 2 },
    { phrase: '24 months', weight: 1 },
    { phrase: '36 months', weight: 1 },
    { phrase: '48 months', weight: 1 },
    { phrase: '30 days', weight: 1 },
  ],
  permanentExclusion: [
    { phrase: 'permanent exclusion', weight: 5 },
    { phrase: 'permanently excluded', weight: 5 },
    { phrase: 'specifically excluded', weight: 4 },
    { phrase: 'stands excluded', weight: 4 },
    { phrase: 'exclusion clause', weight: 3 },
    { phrase: 'excluded under clause', weight: 4 },
    { phrase: 'not covered under the policy', weight: 2 },
    { phrase: 'cosmetic', weight: 2 },
    { phrase: 'aesthetic', weight: 2 },
    { phrase: 'bariatric', weight: 2 },
  ],
  roomRentProportionate: [
    { phrase: 'proportionate deduction', weight: 5 },
    { phrase: 'proportionate', weight: 3 },
    { phrase: 'room rent', weight: 4 },
    { phrase: 'room category', weight: 4 },
    { phrase: 'eligible room', weight: 4 },
    { phrase: 'higher room', weight: 3 },
    { phrase: 'room eligibility', weight: 4 },
    { phrase: 'single private room', weight: 2 },
    { phrase: 'per day limit', weight: 2 },
  ],
  notMedicallyNecessary: [
    { phrase: 'not medically necessary', weight: 5 },
    { phrase: 'medically not necessary', weight: 5 },
    { phrase: 'no active line of treatment', weight: 5 },
    { phrase: 'could have been managed', weight: 4 },
    { phrase: 'could have been treated', weight: 4 },
    { phrase: 'on an outpatient basis', weight: 3 },
    { phrase: 'opd basis', weight: 3 },
    { phrase: 'admission was not warranted', weight: 4 },
    { phrase: 'for evaluation purpose', weight: 3 },
    { phrase: 'reasonable and customary', weight: 2 },
  ],
  documentsIncomplete: [
    { phrase: 'documents', weight: 3 },
    { phrase: 'document', weight: 2 },
    { phrase: 'discharge summary', weight: 3 },
    { phrase: 'deficiency letter', weight: 5 },
    { phrase: 'query letter', weight: 4 },
    { phrase: 'not submitted', weight: 3 },
    { phrase: 'insufficient', weight: 2 },
    { phrase: 'pending documents', weight: 5 },
    { phrase: 'reminders', weight: 2 },
    { phrase: 'no response', weight: 2 },
  ],
};

export type GroundMatch = { phrase: string; start: number; end: number; weight: number };

export type GroundDetection = {
  ground: GroundKind | null;
  confidence: 'high' | 'low';
  method: 'keyword' | 'model' | 'none';
  score: number;
  runnerUp: { ground: GroundKind; score: number } | null;
  matches: readonly GroundMatch[];
  rationale: string;
};

/** Lower-cased, with punctuation reduced to spaces, but the same length as the input. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
}

function findAll(haystack: string, needle: string): number[] {
  const at: number[] = [];
  let index = haystack.indexOf(needle);
  while (index >= 0) {
    at.push(index);
    index = haystack.indexOf(needle, index + 1);
  }
  return at;
}

const MIN_CONFIDENT_SCORE = 5;
const MIN_ANY_SCORE = 3;

/**
 * Classifies the stated ground from the text of a letter.
 *
 * Returns the matched spans as well as the ground, so the interface can show
 * the reader which words in their own letter drove the answer rather than
 * asking them to take it on trust.
 */
export function detectGround(letter: string): GroundDetection {
  const text = normalise(letter);
  const padded = ` ${text} `;

  const scored = GROUND_KINDS.map((ground) => {
    const matches: GroundMatch[] = [];
    let score = 0;
    for (const rule of RULES[ground]) {
      const needle = ` ${normalise(rule.phrase).trim()} `;
      for (const at of findAll(padded, needle)) {
        const start = at;
        const end = at + needle.length - 2;
        matches.push({ phrase: rule.phrase, start, end, weight: rule.weight });
        score += rule.weight;
      }
    }
    return { ground, score, matches };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];

  if (!best || best.score < MIN_ANY_SCORE) {
    return {
      ground: null,
      confidence: 'low',
      method: 'none',
      score: best?.score ?? 0,
      runnerUp: null,
      matches: [],
      rationale:
        'No phrase in the text matched a ground this tool recognises. Paste more of the letter, or pick the ground by hand.',
    };
  }

  const decisive = best.score >= MIN_CONFIDENT_SCORE && best.score >= (second?.score ?? 0) * 1.5;

  return {
    ground: best.ground,
    confidence: decisive ? 'high' : 'low',
    method: 'keyword',
    score: best.score,
    runnerUp: second && second.score > 0 ? { ground: second.ground, score: second.score } : null,
    matches: best.matches.sort((a, b) => a.start - b.start),
    rationale: decisive
      ? `Matched on ${summarisePhrases(best.matches)}.`
      : `Matched on ${summarisePhrases(best.matches)}, but ${second ? GROUND_LABELS[second.ground].toLowerCase() : 'another ground'} scored nearly as highly. Check the ground before relying on it.`,
  };
}

function summarisePhrases(matches: readonly GroundMatch[]): string {
  const unique = Array.from(new Set(matches.map((m) => `"${m.phrase}"`)));
  const shown = unique.slice(0, 4);
  const rest = unique.length - shown.length;
  return `${shown.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`;
}

/** Non-overlapping spans, for highlighting the reader's own text. */
export function mergeMatches(matches: readonly GroundMatch[]): { start: number; end: number }[] {
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const match of sorted) {
    const last = merged[merged.length - 1];
    if (last && match.start <= last.end) {
      last.end = Math.max(last.end, match.end);
    } else {
      merged.push({ start: match.start, end: match.end });
    }
  }
  return merged;
}
