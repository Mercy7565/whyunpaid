/**
 * The boundary.
 *
 * Nothing becomes a `CompiledPolicy` without passing through this file. That
 * matters for two reasons.
 *
 * First, money: JSON has no bigint, so every amount arrives as a string of
 * digits and is turned into paise here. This is the only place that conversion
 * happens, which is what makes it impossible for a float to reach the evaluator.
 *
 * Second, provenance: a clause with no quotable source is rejected rather than
 * degraded. The whole product is the claim that every rupee can be traced to
 * wording; a clause that cannot be traced is not a weaker clause, it is a bug.
 */

import { z } from 'zod';
import { LINE_CATEGORIES, PROCEDURE_CODES } from '@/vm/types';
import type { CompiledPolicy } from '@/vm/types';

export const MAX_QUOTE_WORDS = 25;

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/** Money crosses the boundary as a string of paise digits, and only here. */
const paise = z
  .string()
  .regex(/^\d+$/, 'money must be an integer count of paise written as digits')
  .transform((value) => BigInt(value));

const lineCategory = z.enum(LINE_CATEGORIES);
const procedureCode = z.enum(PROCEDURE_CODES);

export const provenanceSchema = z
  .object({
    sourceQuote: z
      .string()
      .min(1, 'a clause must quote its source')
      .refine((quote) => wordCount(quote) <= MAX_QUOTE_WORDS, {
        message: `a source quote may be at most ${MAX_QUOTE_WORDS} words`,
      }),
    page: z.number().int().min(1),
    charStart: z.number().int().min(0),
    charEnd: z.number().int().min(1),
    confidence: z.enum(['high', 'low']),
  })
  .refine((p) => p.charEnd > p.charStart, {
    message: 'charEnd must come after charStart',
  });

const common = {
  id: z.string().min(1),
  ref: z.string().min(1),
  title: z.string().min(1),
  provenance: provenanceSchema,
};

const permanentExclusion = z.object({
  ...common,
  kind: z.literal('PermanentExclusion'),
  procedures: z.array(procedureCode).min(1),
});

const waitingPeriod = z.object({
  ...common,
  kind: z.literal('WaitingPeriod'),
  waitingKind: z.enum(['initial', 'specificDisease', 'preExistingDisease']),
  months: z.number().int().min(0).max(240),
  appliesTo: z.union([
    z.object({ scope: z.literal('all') }),
    z.object({ scope: z.literal('procedures'), procedures: z.array(procedureCode).min(1) }),
    z.object({ scope: z.literal('preExisting') }),
  ]),
});

const lineItemIneligibility = z.object({
  ...common,
  kind: z.literal('LineItemIneligibility'),
  categories: z.array(lineCategory).min(1),
});

const roomRentCap = z.object({
  ...common,
  kind: z.literal('RoomRentCap'),
  limit: z.union([
    z.object({ basis: z.literal('perDayAmount'), perDayPaise: paise }),
    z.object({
      basis: z.literal('percentOfSumInsuredPerDay'),
      percentBps: z.number().int().min(0).max(10_000),
    }),
  ]),
  associatedCategories: z.array(lineCategory).min(1),
  exemptCategories: z.array(lineCategory),
  /** The sentence that protects the exempt heads, quoted separately. */
  exemptionProvenance: provenanceSchema.optional(),
});

const subLimit = z.object({
  ...common,
  kind: z.literal('SubLimit'),
  procedures: z.array(procedureCode).min(1),
  capPaise: paise,
});

const deductible = z.object({
  ...common,
  kind: z.literal('Deductible'),
  amountPaise: paise,
});

const coPay = z.object({
  ...common,
  kind: z.literal('CoPay'),
  percentBps: z.number().int().min(0).max(10_000),
});

const sumInsured = z.object({
  ...common,
  kind: z.literal('SumInsured'),
  amountPaise: paise,
});

const moratorium = z.object({
  ...common,
  kind: z.literal('Moratorium'),
  months: z.number().int().min(0).max(240),
});

export const clauseSchema = z.discriminatedUnion('kind', [
  permanentExclusion,
  waitingPeriod,
  lineItemIneligibility,
  roomRentCap,
  subLimit,
  deductible,
  coPay,
  sumInsured,
  moratorium,
]);

export const compiledPolicySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    synthetic: z.literal(true),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    summary: z.string().min(1),
    shape: z.string().min(1),
    clauses: z.array(clauseSchema).min(1),
  })
  .superRefine((policy, ctx) => {
    const counts = new Map<string, number>();
    const ids = new Set<string>();

    for (const clause of policy.clauses) {
      counts.set(clause.kind, (counts.get(clause.kind) ?? 0) + 1);
      if (ids.has(clause.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate clause id "${clause.id}"` });
      }
      ids.add(clause.id);
    }

    /*
     * The evaluator reads exactly one sum insured and exactly one moratorium,
     * and applies at most one room rent cap. Rather than let it guess when a
     * policy declares two, the shape is a precondition.
     */
    if (counts.get('SumInsured') !== 1) {
      ctx.addIssue({ code: 'custom', message: 'a policy must declare exactly one sum insured' });
    }
    if (counts.get('Moratorium') !== 1) {
      ctx.addIssue({ code: 'custom', message: 'a policy must declare exactly one moratorium clause' });
    }
    if ((counts.get('RoomRentCap') ?? 0) > 1) {
      ctx.addIssue({ code: 'custom', message: 'a policy may declare at most one room rent cap' });
    }
  });

export type ParsedPolicy = z.infer<typeof compiledPolicySchema>;

/**
 * A compile-time proof that the boundary schema and the VM vocabulary have not
 * drifted apart. If a field is added to one and not the other, this line stops
 * type-checking, which is cheaper than finding out at runtime.
 */
const _schemaMatchesVmTypes: (parsed: ParsedPolicy) => CompiledPolicy = (parsed) => parsed;
void _schemaMatchesVmTypes;

export class PolicyParseError extends Error {
  readonly issues: readonly string[];
  constructor(policyId: string, issues: readonly string[]) {
    super(`policy "${policyId}" did not compile:\n  - ${issues.join('\n  - ')}`);
    this.name = 'PolicyParseError';
    this.issues = issues;
  }
}

export function parseCompiledPolicy(input: unknown, label = 'unknown'): CompiledPolicy {
  const result = compiledPolicySchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new PolicyParseError(label, issues);
  }
  return result.data;
}
