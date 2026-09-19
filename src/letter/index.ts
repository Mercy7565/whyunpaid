/**
 * Rejection reason to ground to contradiction to appeal, in one call.
 *
 * Pure and offline. The keyword rules run everywhere; the model is a fallback
 * the caller may supply for the cases the rules cannot place, and the pipeline
 * is complete without it.
 */

import { buildClaim } from '@/claims/buildClaim';
import { getPolicy } from '@/policies';
import { evaluate } from '@/vm/evaluate';
import type { Claim, CompiledPolicy, ProcedureCode, Verdict } from '@/vm/types';
import { buildAppeal, type Appeal } from './appeal';
import { findContradictions, sortContradictions, type Contradiction } from './contradictions';
import { detectGround, type GroundDetection, type GroundKind } from './grounds';

export * from './appeal';
export * from './contradictions';
export * from './grounds';
export * from './samples';

export type ReviewInput = {
  letterText: string;
  policyId: string;
  procedure: ProcedureCode;
  billRupees: number;
  months: number;
  preExisting: boolean;
  insurerPaidRupees: number;
  /** Set when the reader has overridden the detected ground by hand. */
  groundOverride?: GroundKind | null;
};

export type Review = {
  policy: CompiledPolicy;
  claim: Claim;
  verdict: Verdict;
  detection: GroundDetection;
  ground: GroundKind | null;
  contradictions: readonly Contradiction[];
  appeal: Appeal;
  insurerPaidPaise: bigint;
};

export function review(input: ReviewInput): Review {
  const policy = getPolicy(input.policyId);
  const { claim } = buildClaim({
    procedure: input.procedure,
    billPaise: BigInt(Math.max(0, Math.round(input.billRupees))) * 100n,
    monthsSinceInception: input.months,
    preExisting: input.preExisting,
  });

  const verdict = evaluate(policy, claim, claim.admissionDate);
  const detection = detectGround(input.letterText);
  const ground = input.groundOverride !== undefined ? input.groundOverride : detection.ground;

  const insurerPaidPaise = BigInt(Math.max(0, Math.round(input.insurerPaidRupees))) * 100n;

  const contradictions = sortContradictions(
    findContradictions({ policy, claim, verdict, ground, insurerPaidPaise }),
  );

  const appeal = buildAppeal({
    policy,
    claim,
    verdict,
    ground,
    contradictions,
    insurerPaidPaise,
  });

  return {
    policy,
    claim,
    verdict,
    detection,
    ground,
    contradictions,
    appeal,
    insurerPaidPaise,
  };
}
