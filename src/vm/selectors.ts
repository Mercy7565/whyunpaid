/**
 * Reading clauses out of a compiled policy.
 *
 * Every selector sorts by clause id. That is what makes the evaluator
 * order-independent: a policy whose clause array is shuffled produces a
 * byte-identical verdict, and a property test asserts it.
 */

import type {
  Clause,
  ClauseKind,
  CompiledPolicy,
  MoratoriumClause,
  SumInsuredClause,
} from './types';

type OfKind<K extends ClauseKind> = Extract<Clause, { kind: K }>;

export function clausesOfKind<K extends ClauseKind>(
  policy: CompiledPolicy,
  kind: K,
): OfKind<K>[] {
  return policy.clauses
    .filter((clause): clause is OfKind<K> => clause.kind === kind)
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function firstClauseOfKind<K extends ClauseKind>(
  policy: CompiledPolicy,
  kind: K,
): OfKind<K> | null {
  return clausesOfKind(policy, kind)[0] ?? null;
}

export class PolicyShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyShapeError';
  }
}

/**
 * Every policy must declare exactly one sum insured and exactly one moratorium.
 * The Zod schema enforces this at the boundary; these throw if a policy reached
 * the evaluator some other way.
 */
export function sumInsuredOf(policy: CompiledPolicy): SumInsuredClause {
  const clause = firstClauseOfKind(policy, 'SumInsured');
  if (!clause) throw new PolicyShapeError(`policy "${policy.id}" declares no sum insured`);
  return clause;
}

export function moratoriumOf(policy: CompiledPolicy): MoratoriumClause {
  const clause = firstClauseOfKind(policy, 'Moratorium');
  if (!clause) throw new PolicyShapeError(`policy "${policy.id}" declares no moratorium clause`);
  return clause;
}

export function clauseById(policy: CompiledPolicy, id: string): Clause | null {
  return policy.clauses.find((clause) => clause.id === id) ?? null;
}

/** The clause order the inspector renders: by pipeline stage, then by reference. */
const KIND_ORDER: readonly ClauseKind[] = [
  'SumInsured',
  'PermanentExclusion',
  'WaitingPeriod',
  'LineItemIneligibility',
  'RoomRentCap',
  'SubLimit',
  'Deductible',
  'CoPay',
  'Moratorium',
];

export function clausesInReadingOrder(policy: CompiledPolicy): Clause[] {
  return policy.clauses.slice().sort((a, b) => {
    const ka = KIND_ORDER.indexOf(a.kind);
    const kb = KIND_ORDER.indexOf(b.kind);
    if (ka !== kb) return ka - kb;
    return a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
  });
}
