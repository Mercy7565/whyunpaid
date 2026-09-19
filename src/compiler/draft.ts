/**
 * A draft policy: what comes out of an extractor, before a human has agreed to it.
 *
 * Path A ships four policies that were compiled at build time and verified by a
 * test. Path B has to deal with a PDF nobody has seen, so it produces drafts
 * instead of clauses. A draft is a clause with three extra things attached:
 * where the extractor thinks it came from, how sure it is, and whether a person
 * has looked at it yet.
 *
 * The rule that makes Path B safe is enforced in `compileDraft`: a draft whose
 * quotation cannot be found in the document, or which is marked low confidence
 * and has not been touched, does not compile. Not "compiles with a warning" -
 * does not compile. The whole product is the claim that every rupee traces to
 * wording, and that claim cannot survive a clause nobody checked.
 */

import { z } from 'zod';
import type {
  Clause,
  ClauseKind,
  CompiledPolicy,
  LineCategory,
  ProcedureCode,
} from '@/vm/types';
import { parseCompiledPolicy } from './schema';

export type DraftConfidence = 'high' | 'low';
export type DraftSource = 'heuristic' | 'model' | 'hand';

export type DraftClause = {
  id: string;
  kind: ClauseKind;
  ref: string;
  title: string;
  /** Verbatim from the document. Must be findable in it, and at most 25 words. */
  quote: string;
  confidence: DraftConfidence;
  source: DraftSource;
  /** True once a person has edited or explicitly accepted the row. */
  touched: boolean;

  /* Kind-specific parameters, held as the primitives a form can edit. */
  amountRupees?: number;
  perDayRupees?: number;
  percentBps?: number;
  months?: number;
  procedures?: ProcedureCode[];
  categories?: LineCategory[];
  waitingKind?: 'initial' | 'specificDisease' | 'preExistingDisease';
  scope?: 'all' | 'procedures' | 'preExisting';
  limitBasis?: 'perDayAmount' | 'percentOfSumInsuredPerDay';
  associatedCategories?: LineCategory[];
  exemptCategories?: LineCategory[];
};

export type DraftPolicy = {
  name: string;
  slug: string;
  summary: string;
  shape: string;
  /** The text the quotes must be findable in. */
  documentText: string;
  /** 1-based page number for each character offset boundary. */
  pageStarts: number[];
  clauses: DraftClause[];
};

/* -------------------------------------------------------------------------- */
/* Locating a quotation                                                       */
/* -------------------------------------------------------------------------- */

export type Located =
  | { found: true; charStart: number; charEnd: number; page: number; exact: boolean }
  | { found: false; reason: string };

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Finds a quotation in the document.
 *
 * Exact first. Failing that, whitespace-insensitive, because a PDF text layer
 * breaks lines wherever the typesetter did and a person retyping a quote will
 * not. Anything looser than that would be guessing, and a guess here is a
 * citation to wording that may not exist.
 */
export function locateQuote(quote: string, documentText: string, pageStarts: number[]): Located {
  const trimmed = quote.trim();
  if (trimmed.length === 0) return { found: false, reason: 'the quotation is empty' };
  if (wordsIn(trimmed) > 25) {
    return { found: false, reason: `the quotation is ${wordsIn(trimmed)} words; the limit is 25` };
  }

  const exactAt = documentText.indexOf(trimmed);
  if (exactAt >= 0) {
    if (documentText.indexOf(trimmed, exactAt + 1) >= 0) {
      return { found: false, reason: 'the quotation appears more than once, so it cannot locate a clause' };
    }
    return {
      found: true,
      charStart: exactAt,
      charEnd: exactAt + trimmed.length,
      page: pageFor(exactAt, pageStarts),
      exact: true,
    };
  }

  /* Whitespace-insensitive: walk the document keeping a map back to real offsets. */
  const map: number[] = [];
  let flat = '';
  let previousWasSpace = true;
  for (let i = 0; i < documentText.length; i += 1) {
    const character = documentText[i] ?? '';
    const isSpace = /\s/.test(character);
    if (isSpace) {
      if (previousWasSpace) continue;
      flat += ' ';
      map.push(i);
      previousWasSpace = true;
    } else {
      flat += character;
      map.push(i);
      previousWasSpace = false;
    }
  }

  const needle = collapse(trimmed);
  const at = flat.indexOf(needle);
  if (at < 0) return { found: false, reason: 'the quotation does not appear in this document' };
  if (flat.indexOf(needle, at + 1) >= 0) {
    return { found: false, reason: 'the quotation appears more than once, so it cannot locate a clause' };
  }

  const charStart = map[at] ?? 0;
  const charEnd = (map[at + needle.length - 1] ?? charStart) + 1;
  return { found: true, charStart, charEnd, page: pageFor(charStart, pageStarts), exact: false };
}

export function wordsIn(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function pageFor(offset: number, pageStarts: number[]): number {
  let page = 1;
  for (let index = 0; index < pageStarts.length; index += 1) {
    if ((pageStarts[index] ?? 0) <= offset) page = index + 1;
    else break;
  }
  return page;
}

/* -------------------------------------------------------------------------- */
/* Compiling a draft                                                          */
/* -------------------------------------------------------------------------- */

export type DraftIssue = {
  clauseId: string | null;
  severity: 'blocking' | 'advisory';
  message: string;
};

export type CompileResult =
  | { ok: true; policy: CompiledPolicy; issues: DraftIssue[] }
  | { ok: false; issues: DraftIssue[] };

const rupeesToPaiseString = (rupees: number): string =>
  String(Math.max(0, Math.round(rupees)) * 100);

/** Which rows are not yet allowed to compile, and why. */
export function blockingIssues(draft: DraftPolicy): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const kinds = new Map<ClauseKind, number>();

  for (const clause of draft.clauses) {
    kinds.set(clause.kind, (kinds.get(clause.kind) ?? 0) + 1);

    if (clause.confidence === 'low' && !clause.touched) {
      issues.push({
        clauseId: clause.id,
        severity: 'blocking',
        message: 'Low confidence. Check this row against the document and confirm it.',
      });
    }

    const located = locateQuote(clause.quote, draft.documentText, draft.pageStarts);
    if (!located.found) {
      issues.push({
        clauseId: clause.id,
        severity: 'blocking',
        message: `Quotation cannot be located: ${located.reason}.`,
      });
    } else if (!located.exact) {
      issues.push({
        clauseId: clause.id,
        severity: 'advisory',
        message: 'Matched ignoring line breaks. The wording is the same; the spacing is not.',
      });
    }
  }

  if ((kinds.get('SumInsured') ?? 0) !== 1) {
    issues.push({
      clauseId: null,
      severity: 'blocking',
      message: 'A policy must declare exactly one sum insured.',
    });
  }
  if ((kinds.get('Moratorium') ?? 0) !== 1) {
    issues.push({
      clauseId: null,
      severity: 'blocking',
      message:
        'A policy must declare exactly one moratorium clause. If the wording has none, add one at 60 months and mark it by hand.',
    });
  }
  if ((kinds.get('RoomRentCap') ?? 0) > 1) {
    issues.push({
      clauseId: null,
      severity: 'blocking',
      message: 'A policy may declare at most one room rent cap.',
    });
  }

  return issues;
}

function toClause(draft: DraftClause, located: Extract<Located, { found: true }>): unknown {
  const provenance = {
    sourceQuote: draft.quote.trim(),
    page: located.page,
    charStart: located.charStart,
    charEnd: located.charEnd,
    confidence: draft.confidence,
  };
  const common = { id: draft.id, ref: draft.ref, title: draft.title, provenance };

  switch (draft.kind) {
    case 'SumInsured':
      return { ...common, kind: 'SumInsured', amountPaise: rupeesToPaiseString(draft.amountRupees ?? 0) };
    case 'Moratorium':
      return { ...common, kind: 'Moratorium', months: draft.months ?? 60 };
    case 'Deductible':
      return { ...common, kind: 'Deductible', amountPaise: rupeesToPaiseString(draft.amountRupees ?? 0) };
    case 'CoPay':
      return { ...common, kind: 'CoPay', percentBps: draft.percentBps ?? 0 };
    case 'PermanentExclusion':
      return { ...common, kind: 'PermanentExclusion', procedures: draft.procedures ?? [] };
    case 'LineItemIneligibility':
      return { ...common, kind: 'LineItemIneligibility', categories: draft.categories ?? [] };
    case 'SubLimit':
      return {
        ...common,
        kind: 'SubLimit',
        procedures: draft.procedures ?? [],
        capPaise: rupeesToPaiseString(draft.amountRupees ?? 0),
      };
    case 'WaitingPeriod':
      return {
        ...common,
        kind: 'WaitingPeriod',
        waitingKind: draft.waitingKind ?? 'initial',
        months: draft.months ?? 0,
        appliesTo:
          draft.scope === 'procedures'
            ? { scope: 'procedures', procedures: draft.procedures ?? [] }
            : draft.scope === 'preExisting'
              ? { scope: 'preExisting' }
              : { scope: 'all' },
      };
    case 'RoomRentCap':
      return {
        ...common,
        kind: 'RoomRentCap',
        limit:
          draft.limitBasis === 'percentOfSumInsuredPerDay'
            ? { basis: 'percentOfSumInsuredPerDay', percentBps: draft.percentBps ?? 100 }
            : { basis: 'perDayAmount', perDayPaise: rupeesToPaiseString(draft.perDayRupees ?? 0) },
        associatedCategories: draft.associatedCategories ?? DEFAULT_ASSOCIATED,
        exemptCategories: draft.exemptCategories ?? DEFAULT_EXEMPT,
      };
  }
}

export const DEFAULT_ASSOCIATED: LineCategory[] = [
  'room',
  'nursing',
  'surgeon',
  'anaesthetist',
  'operationTheatre',
];

export const DEFAULT_EXEMPT: LineCategory[] = [
  'pharmacy',
  'consumables',
  'implants',
  'diagnostics',
];

export function compileDraft(draft: DraftPolicy): CompileResult {
  const issues = blockingIssues(draft);
  if (issues.some((issue) => issue.severity === 'blocking')) return { ok: false, issues };

  const clauses: unknown[] = [];
  for (const clause of draft.clauses) {
    const located = locateQuote(clause.quote, draft.documentText, draft.pageStarts);
    if (!located.found) {
      return {
        ok: false,
        issues: [
          ...issues,
          { clauseId: clause.id, severity: 'blocking', message: located.reason },
        ],
      };
    }
    clauses.push(toClause(clause, located));
  }

  try {
    const policy = parseCompiledPolicy(
      {
        id: draft.slug,
        name: draft.name,
        synthetic: true,
        slug: draft.slug,
        summary: draft.summary,
        shape: draft.shape,
        clauses,
      },
      draft.slug,
    );
    return { ok: true, policy, issues };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      issues: [...issues, { clauseId: null, severity: 'blocking', message }],
    };
  }
}

/** Serialises a compiled policy back to the JSON shape the repository checks in. */
export function policyToJson(policy: CompiledPolicy): string {
  return JSON.stringify(
    policy,
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2,
  );
}

/* -------------------------------------------------------------------------- */
/* The shape a model is asked to return                                       */
/* -------------------------------------------------------------------------- */

export const extractedClauseSchema = z.object({
  kind: z.enum([
    'SumInsured',
    'Moratorium',
    'PermanentExclusion',
    'WaitingPeriod',
    'LineItemIneligibility',
    'RoomRentCap',
    'SubLimit',
    'Deductible',
    'CoPay',
  ]),
  ref: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  quote: z.string().min(1),
  confidence: z.enum(['high', 'low']),
  amountRupees: z.number().nonnegative().optional(),
  perDayRupees: z.number().nonnegative().optional(),
  percentBps: z.number().int().min(0).max(10_000).optional(),
  months: z.number().int().min(0).max(240).optional(),
  procedures: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  waitingKind: z.enum(['initial', 'specificDisease', 'preExistingDisease']).optional(),
  scope: z.enum(['all', 'procedures', 'preExisting']).optional(),
  limitBasis: z.enum(['perDayAmount', 'percentOfSumInsuredPerDay']).optional(),
});

export const extractionSchema = z.object({
  clauses: z.array(extractedClauseSchema).max(40),
});

export type ExtractedClause = z.infer<typeof extractedClauseSchema>;

export type { Clause };
