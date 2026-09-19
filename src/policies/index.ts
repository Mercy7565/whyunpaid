/**
 * The shipped specimen policies.
 *
 * Four pre-compiled `CompiledPolicy` documents, imported statically and parsed
 * through the boundary schema once, at module load. Nothing here fetches. The
 * demo path never touches the network, which is the point: the simulator runs
 * entirely in the browser on wording that was compiled at build time.
 *
 * Every one of these is SYNTHETIC. They are modelled on structures common to
 * Indian indemnity health cover. No insurer is named and no insurer's wording
 * is reproduced.
 */

import { parseCompiledPolicy } from '@/compiler/schema';
import type { CompiledPolicy } from '@/vm/types';
import specimenA from './compiled/specimen-floater-a.json';
import specimenB from './compiled/specimen-floater-b.json';
import specimenC from './compiled/specimen-floater-c.json';
import specimenD from './compiled/specimen-floater-d.json';

const RAW = [specimenA, specimenB, specimenC, specimenD] as const;

export const POLICIES: readonly CompiledPolicy[] = RAW.map((raw) =>
  parseCompiledPolicy(raw, (raw as { id?: string }).id ?? 'unknown'),
);

export const DEFAULT_POLICY_ID = 'specimen-a';

const BY_ID = new Map(POLICIES.map((policy) => [policy.id, policy]));

export function findPolicy(id: string | null | undefined): CompiledPolicy | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/** Falls back to the default rather than throwing: a bad URL should still render. */
export function getPolicy(id: string | null | undefined): CompiledPolicy {
  const policy = findPolicy(id) ?? BY_ID.get(DEFAULT_POLICY_ID);
  if (!policy) throw new Error('no specimen policies are compiled into this build');
  return policy;
}

export function policyPdfPath(policy: CompiledPolicy): string {
  return `/policies/${policy.slug}.pdf`;
}

export function policySpansPath(policy: CompiledPolicy): string {
  return `/policies/${policy.slug}.spans.json`;
}

export function policyTextPath(policy: CompiledPolicy): string {
  return `/policies/${policy.slug}.txt`;
}
