/**
 * Reading a policy without a model.
 *
 * Path B is a bonus and the brief allows it to need an API key. It does not,
 * and that is a deliberate choice: the same argument that keeps the letter
 * classifier on keyword rules applies here. A policy document is a private
 * document, and a product whose pitch is "no server, no account, no upload"
 * should not quietly require a network call the first time someone tries the
 * interesting feature.
 *
 * So the first pass is regular expressions over the extracted text. It finds
 * the constructs that actually matter - sum insured, room rent, co-payment,
 * deductible, waiting periods, sub-limits, exclusions, the moratorium - and it
 * marks almost everything LOW CONFIDENCE, because a regular expression reading
 * an insurance contract should not be trusted and the confirmation table exists
 * precisely so that a person has to look. A model, where one is configured,
 * refines these drafts rather than replacing them.
 *
 * Pure: no I/O, no clock, no randomness.
 */

import type { LineCategory, ProcedureCode } from '@/vm/types';
import { DEFAULT_ASSOCIATED, DEFAULT_EXEMPT, type DraftClause } from './draft';

/* -------------------------------------------------------------------------- */
/* Numbers, as documents write them                                           */
/* -------------------------------------------------------------------------- */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** "twenty-four" to 24, "thirty" to 30, "24" to 24. */
export function parseCount(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^\d+$/.test(text)) return Number(text);

  /*
   * Documents do not hand you a bare number. They hand you "of twenty-four
   * months" or "contracted within thirty days", so leading words are skipped
   * until a number appears, and the first word after it ends the number.
   */
  const parts = text.split(/[\s-]+/).filter(Boolean);
  let total = 0;
  let matched = false;
  for (const part of parts) {
    if (part in UNITS) {
      total += UNITS[part] ?? 0;
      matched = true;
    } else if (part in TENS) {
      total += TENS[part] ?? 0;
      matched = true;
    } else if (/^\d+$/.test(part)) {
      total += Number(part);
      matched = true;
    } else if (part === 'and') {
      continue;
    } else if (matched) {
      break;
    }
  }
  return matched ? total : null;
}

/** "5,00,000" to 500000. Indian or international grouping, both fine. */
export function parseFigure(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 0) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

/**
 * "Two Lakh Sixty-Five Thousand" to 265000. Handles crore, lakh and thousand,
 * which is the whole vocabulary an Indian policy schedule uses.
 */
export function parseAmountWords(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(/[,]/g, ' ').replace(/\s+/g, ' ');
  if (text.length === 0) return null;

  const scales: [RegExp, number][] = [
    [/\bcrores?\b/, 10_000_000],
    [/\blakhs?\b|\blacs?\b/, 100_000],
    [/\bthousands?\b/, 1_000],
  ];

  let total = 0;
  let rest = text;
  let matchedAnything = false;

  for (const [pattern, multiplier] of scales) {
    const match = pattern.exec(rest);
    if (!match) continue;
    const head = rest.slice(0, match.index);
    const count = parseCount(head);
    if (count !== null) {
      total += count * multiplier;
      matchedAnything = true;
    }
    rest = rest.slice(match.index + match[0].length);
  }

  const tail = parseCount(rest);
  if (tail !== null && tail > 0) {
    total += tail;
    matchedAnything = true;
  }

  return matchedAnything ? total : null;
}

/** "one per cent" to 100 bps, "20%" to 2000 bps, "one and a half per cent" to 150. */
export function parsePercentBps(raw: string): number | null {
  const text = raw.trim().toLowerCase();

  const digits = /^(\d+(?:\.\d+)?)\s*(?:%|per\s*cent)/.exec(text);
  if (digits?.[1]) return Math.round(Number(digits[1]) * 100);

  if (/\band a half\b/.test(text)) {
    const whole = parseCount(text.replace(/\band a half\b.*$/, ''));
    if (whole !== null) return whole * 100 + 50;
  }
  const words = parseCount(text.replace(/\s*(?:%|per\s*cent).*$/, ''));
  return words === null ? null : words * 100;
}

/* -------------------------------------------------------------------------- */
/* Vocabulary in documents                                                    */
/* -------------------------------------------------------------------------- */

const PROCEDURE_PATTERNS: [RegExp, ProcedureCode][] = [
  [/\bcataract\b/i, 'cataract'],
  [/\b(?:total\s+)?knee\s+(?:replacement|arthroplasty)\b/i, 'kneeReplacement'],
  [/\bangioplasty\b|\bptca\b|\bstent(?:ing)?\b/i, 'angioplasty'],
  [/\bbypass\s+graft\b|\bcabg\b|\bcoronary\s+artery\s+bypass\b/i, 'cabg'],
  [/\bhernia\b/i, 'herniaRepair'],
  [/\bappendec?tomy\b|\bappendix\b/i, 'appendectomy'],
  [/\bmaternity\b|\bchildbirth\b|\bdelivery\b|\bpregnanc/i, 'maternityDelivery'],
  [/\bcosmetic\b|\baesthetic\b|\bplastic\s+surgery\b/i, 'cosmeticSurgery'],
  [/\bbariatric\b|\bweight[-\s]control\b|\bobesity\s+surgery\b/i, 'bariatricSurgery'],
  [/\bdialysis\b/i, 'dialysis'],
];

function proceduresIn(text: string): ProcedureCode[] {
  const found: ProcedureCode[] = [];
  for (const [pattern, code] of PROCEDURE_PATTERNS) {
    if (pattern.test(text) && !found.includes(code)) found.push(code);
  }
  return found;
}

const CATEGORY_PATTERNS: [RegExp, LineCategory][] = [
  [/\bnon[-\s]?medical\b|\bpersonal comfort\b|\btoiletries\b|\bconvenience\b/i, 'nonMedical'],
  [/\bambulance\b/i, 'ambulance'],
];

function categoriesIn(text: string): LineCategory[] {
  const found: LineCategory[] = [];
  for (const [pattern, code] of CATEGORY_PATTERNS) {
    if (pattern.test(text) && !found.includes(code)) found.push(code);
  }
  return found;
}

/* -------------------------------------------------------------------------- */
/* Sentence splitting                                                         */
/* -------------------------------------------------------------------------- */

export type Sentence = { text: string; start: number };

/**
 * Splits on full stops that end a sentence rather than an abbreviation.
 * "Rs." and "No." are the two that matter in this register.
 *
 * Blocks are split first. A heading and the paragraph beneath it are separated
 * by a blank line and are not one sentence, however the full stops happen to
 * fall. That also guarantees every sentence lies inside a single paragraph, so
 * a quotation cut from one matches the document with ordinary single spaces.
 */
export function sentencesOf(documentText: string): Sentence[] {
  const out: Sentence[] = [];
  const blockPattern = /[^\n]+(?:\n(?!\n)[^\n]+)*/g;

  for (const block of documentText.matchAll(blockPattern)) {
    const blockText = block[0];
    const blockStart = block.index ?? 0;
    let start = 0;

    const emit = (from: number, to: number) => {
      const raw = blockText.slice(from, to);
      const text = raw.trim();
      if (text.length === 0) return;
      out.push({ text, start: blockStart + from + raw.indexOf(text) });
    };

    for (let i = 0; i < blockText.length; i += 1) {
      if (blockText[i] !== '.') continue;
      const before = blockText.slice(Math.max(0, i - 4), i + 1).toLowerCase();
      if (/\b(?:rs|no|cl|sr|vs|etc)\.$/.test(before)) continue;
      const next = blockText[i + 1];
      if (next !== undefined && !/\s/.test(next)) continue;
      emit(start, i + 1);
      start = i + 1;
    }
    emit(start, blockText.length);
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Quoting                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cuts a quotation of at most 25 words around a match, preferring the words
 * that carry the number, and checks it occurs only once in the document so it
 * can actually locate the clause.
 */
function quoteAround(sentence: string, focus: string, documentText: string): string | null {
  const words = sentence.trim().split(/\s+/);
  if (words.length <= 25) {
    return unique(sentence.trim(), documentText) ? sentence.trim() : trimToUnique(words, focus, documentText);
  }
  return trimToUnique(words, focus, documentText);
}

/**
 * A candidate is usable only if it appears exactly once. The comparison ignores
 * whitespace, because a PDF text layer breaks lines wherever the typesetter did
 * and the locator that runs later is whitespace-insensitive for the same reason.
 */
function unique(candidate: string, documentText: string): boolean {
  const flatDocument = documentText.replace(/\s+/g, ' ');
  const needle = candidate.replace(/\s+/g, ' ').trim();
  if (needle.length === 0) return false;
  const at = flatDocument.indexOf(needle);
  return at >= 0 && flatDocument.indexOf(needle, at + 1) < 0;
}

function trimToUnique(words: string[], focus: string, documentText: string): string | null {
  const focusWord = focus.trim().split(/\s+/)[0] ?? '';
  let centre = words.findIndex((word) => word.toLowerCase().includes(focusWord.toLowerCase()));
  if (centre < 0) centre = Math.floor(words.length / 2);

  for (const span of [24, 20, 16, 12, 10, 8]) {
    const half = Math.floor(span / 2);
    const from = Math.max(0, Math.min(centre - half, words.length - span));
    const candidate = words.slice(Math.max(0, from), Math.max(0, from) + span).join(' ');
    if (candidate.length > 0 && unique(candidate, documentText)) return candidate;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* The extractor                                                              */
/* -------------------------------------------------------------------------- */

type Builder = {
  id: string;
  kind: DraftClause['kind'];
  title: string;
  ref: string;
  quote: string;
  confidence: DraftConfidenceLocal;
  fields: Partial<DraftClause>;
};

type DraftConfidenceLocal = 'high' | 'low';

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}.${sequence}`;
}

/** Resets the id counter so a re-extraction of the same document is identical. */
export function resetIds(): void {
  sequence = 0;
}

function refFrom(sentence: string, fallback: string): string {
  const clause = /\b(?:clause|section|part)\s+([0-9]+(?:\.[0-9]+)*(?:\([a-z]\))?)/i.exec(sentence);
  if (clause?.[1]) return clause[1];
  const leading = /^\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)/.exec(sentence);
  if (leading?.[1]) return leading[1];
  return fallback;
}

/**
 * Reads a policy document into draft clauses.
 *
 * Everything it returns is a candidate. Confidence is `high` only where the
 * construct is unambiguous in the register - a stated sum insured, a stated
 * co-payment percentage - and `low` everywhere else, which means the
 * confirmation table will not let it compile until a person has looked.
 */
export function extractDrafts(documentText: string): DraftClause[] {
  resetIds();
  const sentences = sentencesOf(documentText);
  const builders: Builder[] = [];

  const add = (builder: Builder | null) => {
    if (builder && builder.quote.trim().length > 0) builders.push(builder);
  };

  const seenKinds = new Set<string>();

  for (const { text } of sentences) {
    const lower = text.toLowerCase();

    /* ---- Sum insured ---------------------------------------------------- */
    if (!seenKinds.has('SumInsured') && /\bsum insured\b/i.test(text)) {
      const figure =
        /\bsum insured\b[^.]{0,120}?(?:rs\.?|₹|inr)\s*([\d,]{3,})/i.exec(text)?.[1] ??
        /(?:rs\.?|₹|inr)\s*([\d,]{3,})[^.]{0,60}?\bsum insured\b/i.exec(text)?.[1] ??
        null;
      const words = /\brupees\s+([a-z\s-]+?(?:crore|lakh|lac|thousand)[a-z\s-]*)/i.exec(text)?.[1] ?? null;
      const amount = (figure ? parseFigure(figure) : null) ?? (words ? parseAmountWords(words) : null);

      if (amount !== null && amount > 0) {
        const quote = quoteAround(text, 'Sum', documentText);
        if (quote) {
          seenKinds.add('SumInsured');
          add({
            id: nextId('draft.sumInsured'),
            kind: 'SumInsured',
            title: 'Sum insured',
            ref: refFrom(text, '2.1'),
            quote,
            confidence: figure ? 'high' : 'low',
            fields: { amountRupees: amount },
          });
        }
      }
    }

    /* ---- Room rent ------------------------------------------------------- */
    if (!seenKinds.has('RoomRentCap') && /\broom\s+(?:rent|category|charges)\b|\beligible room\b/i.test(text)) {
      const percent = /(\d+(?:\.\d+)?\s*(?:%|per\s*cent)|[a-z\s-]+?(?:and a half\s+)?per\s*cent)\s+of the sum insured/i.exec(text)?.[1] ?? null;
      const perDay = /(?:rs\.?|₹|inr)\s*([\d,]{3,})/i.exec(text)?.[1] ?? null;
      const bps = percent ? parsePercentBps(percent) : null;
      const rupees = perDay ? parseFigure(perDay) : null;

      if (bps !== null || rupees !== null) {
        const quote = quoteAround(text, 'room', documentText);
        if (quote) {
          seenKinds.add('RoomRentCap');
          add({
            id: nextId('draft.roomCap'),
            kind: 'RoomRentCap',
            title: 'Room rent limit and proportionate deduction',
            ref: refFrom(text, '4.2'),
            quote,
            confidence: 'low',
            fields: {
              limitBasis: bps !== null ? 'percentOfSumInsuredPerDay' : 'perDayAmount',
              ...(bps !== null ? { percentBps: bps } : { perDayRupees: rupees ?? 0 }),
              associatedCategories: DEFAULT_ASSOCIATED,
              exemptCategories: DEFAULT_EXEMPT,
            },
          });
        }
      }
    }

    /* ---- Co-payment ------------------------------------------------------ */
    if (!seenKinds.has('CoPay') && /\bco[-\s]?pay(?:ment)?\b/i.test(text)) {
      const percent =
        /\bco[-\s]?pay(?:ment)?\b[^.]{0,80}?(\d+(?:\.\d+)?\s*(?:%|per\s*cent)|[a-z\s-]+?\s+per\s*cent)/i.exec(text)?.[1] ??
        /(\d+(?:\.\d+)?\s*(?:%|per\s*cent))[^.]{0,60}?\bco[-\s]?pay/i.exec(text)?.[1] ??
        null;
      const bps = percent ? parsePercentBps(percent) : null;
      if (bps !== null && bps > 0) {
        const quote = quoteAround(text, 'co-payment', documentText);
        if (quote) {
          seenKinds.add('CoPay');
          add({
            id: nextId('draft.coPay'),
            kind: 'CoPay',
            title: 'Co-payment',
            ref: refFrom(text, '4.9'),
            quote,
            confidence: /\d\s*(?:%|per\s*cent)/i.test(percent ?? '') ? 'high' : 'low',
            fields: { percentBps: bps },
          });
        }
      }
    }

    /* ---- Deductible ------------------------------------------------------ */
    if (!seenKinds.has('Deductible') && /\bdeductible\b/i.test(text) && !/no deductible/i.test(lower)) {
      const figure = /(?:rs\.?|₹|inr)\s*([\d,]{3,})/i.exec(text)?.[1] ?? null;
      const words = /\brupees\s+([a-z\s-]+?(?:crore|lakh|lac|thousand)[a-z\s-]*)/i.exec(text)?.[1] ?? null;
      const amount = (figure ? parseFigure(figure) : null) ?? (words ? parseAmountWords(words) : null);
      if (amount !== null && amount > 0) {
        const quote = quoteAround(text, 'deductible', documentText);
        if (quote) {
          seenKinds.add('Deductible');
          add({
            id: nextId('draft.deductible'),
            kind: 'Deductible',
            title: 'Deductible',
            ref: refFrom(text, '4.8'),
            quote,
            confidence: 'low',
            fields: { amountRupees: amount },
          });
        }
      }
    }

    /* ---- Waiting periods -------------------------------------------------- */
    if (/\bwaiting period\b|\bcontracted within\b[^.]{0,40}\bdays\b/i.test(text)) {
      const monthsRaw =
        /\b(?:of|for)\s+([a-z\s-]+?|\d{1,3})\s+months?\b/i.exec(text)?.[1] ??
        /\b([a-z\s-]+?|\d{1,3})\s+months?\b/i.exec(text)?.[1] ??
        null;
      const daysRaw = /\b([a-z\s-]+?|\d{1,3})\s+days?\b/i.exec(text)?.[1] ?? null;

      const months =
        monthsRaw !== null
          ? parseCount(monthsRaw)
          : daysRaw !== null
            ? Math.max(1, Math.round((parseCount(daysRaw) ?? 30) / 30))
            : null;

      if (months !== null && months >= 0 && months <= 240) {
        const isPed = /\bpre[-\s]?existing\b/i.test(text);
        const named = proceduresIn(text);
        const isInitial = /\bthirty days\b|\b30 days\b|\bfirst policy year\b/i.test(text) && named.length === 0 && !isPed;

        const waitingKind = isPed ? 'preExistingDisease' : named.length > 0 ? 'specificDisease' : 'initial';
        const key = `WaitingPeriod:${waitingKind}`;
        if (!seenKinds.has(key)) {
          const quote = quoteAround(text, 'waiting', documentText);
          if (quote) {
            seenKinds.add(key);
            add({
              id: nextId('draft.wait'),
              kind: 'WaitingPeriod',
              title:
                waitingKind === 'preExistingDisease'
                  ? 'Pre-existing disease waiting period'
                  : waitingKind === 'specificDisease'
                    ? 'Specified-condition waiting period'
                    : 'Initial waiting period',
              ref: refFrom(text, waitingKind === 'initial' ? '5.1' : waitingKind === 'specificDisease' ? '5.2' : '5.3'),
              quote,
              confidence: 'low',
              fields: {
                waitingKind,
                months: isInitial ? Math.max(months, 1) : months,
                scope: isPed ? 'preExisting' : named.length > 0 ? 'procedures' : 'all',
                ...(named.length > 0 ? { procedures: named } : {}),
              },
            });
          }
        }
      }
    }

    /* ---- Sub-limits -------------------------------------------------------- */

    /*
     * Two shapes. A prose limit ("shall not be liable to pay more than ... for
     * cataract surgery ... Rs. 40,000"), and a table row, which is how most
     * schedules actually write it: one procedure, a colon, an amount, short.
     */
    const hasAmount = /(?:rs\.?|₹|inr)\s*[\d,]{3,}|\brupees\s+[a-z\s-]*(?:crore|lakh|lac|thousand)/i.test(text);
    const namedHere = proceduresIn(text);
    const looksLikeTableRow =
      hasAmount && namedHere.length === 1 && text.includes(':') && text.split(/\s+/).length <= 24;

    if (looksLikeTableRow) {
      const code = namedHere[0];
      const key = `SubLimit:${code}`;
      if (code && !seenKinds.has(key)) {
        const figure = /(?:rs\.?|₹|inr)\s*([\d,]{3,})/i.exec(text)?.[1] ?? null;
        const words = /\brupees\s+([a-z\s-]+?(?:crore|lakh|lac|thousand)[a-z\s-]*)/i.exec(text)?.[1] ?? null;
        const amount = (figure ? parseFigure(figure) : null) ?? (words ? parseAmountWords(words) : null);
        const quote = quoteAround(text, code, documentText);
        if (amount !== null && amount > 0 && quote) {
          seenKinds.add(key);
          add({
            id: nextId('draft.subLimit'),
            kind: 'SubLimit',
            title: 'Procedure sub-limit',
            ref: refFrom(text, '4.6'),
            quote,
            confidence: 'low',
            fields: { procedures: [code], amountRupees: amount },
          });
        }
      }
    }

    if (/\bsub[-\s]?limit\b|\bshall not be liable to pay more than\b|\blimited to\b/i.test(text)) {
      for (const [pattern, code] of PROCEDURE_PATTERNS) {
        const hit = pattern.exec(text);
        if (!hit) continue;
        const after = text.slice(hit.index, hit.index + 220);
        const figure = /(?:rs\.?|₹|inr)\s*([\d,]{3,})/i.exec(after)?.[1] ?? null;
        const words = /\brupees\s+([a-z\s-]+?(?:crore|lakh|lac|thousand)[a-z\s-]*)/i.exec(after)?.[1] ?? null;
        const amount = (figure ? parseFigure(figure) : null) ?? (words ? parseAmountWords(words) : null);
        if (amount === null || amount <= 0) continue;

        const key = `SubLimit:${code}`;
        if (seenKinds.has(key)) continue;
        const quote = quoteAround(after, hit[0], documentText) ?? quoteAround(text, hit[0], documentText);
        if (!quote) continue;
        seenKinds.add(key);
        add({
          id: nextId('draft.subLimit'),
          kind: 'SubLimit',
          title: 'Procedure sub-limit',
          ref: refFrom(text, '4.6'),
          quote,
          confidence: 'low',
          fields: { procedures: [code], amountRupees: amount },
        });
      }
    }

    /* ---- Permanent exclusions ---------------------------------------------- */
    if (
      !seenKinds.has('PermanentExclusion') &&
      /\bpermanent exclusion|\bshall not be liable for\b|\bspecifically excluded\b|\bstands excluded\b/i.test(text)
    ) {
      const named = proceduresIn(text);
      if (named.length > 0) {
        const quote = quoteAround(text, 'liable', documentText);
        if (quote) {
          seenKinds.add('PermanentExclusion');
          add({
            id: nextId('draft.exclusions'),
            kind: 'PermanentExclusion',
            title: 'Permanent exclusions',
            ref: refFrom(text, '6.1'),
            quote,
            confidence: 'low',
            fields: { procedures: named },
          });
        }
      }
    }

    /* ---- Non-payable items --------------------------------------------------- */
    if (
      !seenKinds.has('LineItemIneligibility') &&
      /\bnot payable\b|\bnon[-\s]?payable\b|\bnon[-\s]?medical\b/i.test(text)
    ) {
      const cats = categoriesIn(text);
      if (cats.length > 0) {
        const quote = quoteAround(text, 'non-medical', documentText) ?? quoteAround(text, 'payable', documentText);
        if (quote) {
          seenKinds.add('LineItemIneligibility');
          add({
            id: nextId('draft.nonPayable'),
            kind: 'LineItemIneligibility',
            title: 'Non-payable items',
            ref: refFrom(text, '3.9'),
            quote,
            confidence: 'low',
            fields: { categories: cats },
          });
        }
      }
    }

    /* ---- The moratorium ------------------------------------------------------ */
    if (
      !seenKinds.has('Moratorium') &&
      /\bmoratorium\b/i.test(text) === false &&
      /\bcontestab|\bnon[-\s]?disclosure\b|\bmisrepresentation\b/i.test(text) &&
      /\b(sixty|60)\s+months?\b/i.test(text)
    ) {
      const quote = quoteAround(text, 'months', documentText);
      if (quote) {
        seenKinds.add('Moratorium');
        add({
          id: nextId('draft.moratorium'),
          kind: 'Moratorium',
          title: 'Moratorium period',
          ref: refFrom(text, '7.4'),
          quote,
          confidence: 'low',
          fields: { months: 60 },
        });
      }
    }

    if (!seenKinds.has('Moratorium') && /\bmoratorium\b/i.test(text)) {
      const monthsRaw = /\b([a-z\s-]+?|\d{1,3})\s+months?\b/i.exec(text)?.[1] ?? null;
      const months = monthsRaw ? parseCount(monthsRaw) : 60;
      const quote = quoteAround(text, 'moratorium', documentText);
      if (quote) {
        seenKinds.add('Moratorium');
        add({
          id: nextId('draft.moratorium'),
          kind: 'Moratorium',
          title: 'Moratorium period',
          ref: refFrom(text, '7.4'),
          quote,
          confidence: 'low',
          fields: { months: months ?? 60 },
        });
      }
    }
  }

  return builders.map((builder) => ({
    id: builder.id,
    kind: builder.kind,
    ref: builder.ref,
    title: builder.title,
    quote: builder.quote,
    confidence: builder.confidence,
    source: 'heuristic' as const,
    touched: false,
    ...builder.fields,
  }));
}
