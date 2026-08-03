/**
 * Fallback selection for generation steps (VHS-108).
 * Max 2; deterministic; never loops or retries.
 */

import type { CostEstimate } from "@/domain/cost";
import type { ModelCapabilities } from "@/domain/routing/capabilities";
import type { StepEstimateContext } from "./cost-estimation";
import { estimateStepCost } from "./cost-estimation";
import type { FallbackStep } from "./generation-plan";
import type { RoutingPolicy } from "./policy";
import { compareScoredPicks, scoreCandidate, type ScoredPick } from "./scoring";

export type FallbackCandidate = {
  model: ModelCapabilities;
  estimate: CostEstimate;
  eligibilityEvidence: string[];
  scoreTotal: number;
};

/**
 * Pick up to N fallbacks different from the primary, same hard eligibility already filtered.
 */
export function selectFallbacks(input: {
  primaryProviderId: string;
  primaryModelId: string;
  alternatives: Array<{
    model: ModelCapabilities;
    eligibilityEvidence: string[];
  }>;
  estimateContext: Omit<StepEstimateContext, "role">;
  policy: RoutingPolicy;
  identityPriorityHigh: boolean;
  stepCostScores: Map<string, number>;
}): FallbackStep[] {
  const max = input.policy.maximumFallbacksPerStep;
  if (max === 0) return [];

  const scored: ScoredPick[] = [];
  for (const alt of input.alternatives) {
    if (
      alt.model.providerId === input.primaryProviderId &&
      alt.model.modelId === input.primaryModelId
    ) {
      continue;
    }
    const key = `${alt.model.providerId}::${alt.model.modelId}`;
    const costScore = input.stepCostScores.get(key);
    const score = scoreCandidate({
      model: alt.model,
      costScore,
      policy: input.policy,
      identityPriorityHigh: input.identityPriorityHigh,
    });
    if (!score) continue;

    let estimate: CostEstimate;
    try {
      const role =
        scored.length === 0 ? "fallback1" : scored.length === 1 ? "fallback2" : "fallback2";
      estimate = estimateStepCost(alt.model, {
        ...input.estimateContext,
        role: role as "fallback1" | "fallback2",
      }).estimate;
    } catch {
      continue;
    }

    scored.push({
      providerId: alt.model.providerId,
      modelId: alt.model.modelId,
      cost: estimate.total,
      estimatedDurationSeconds: input.estimateContext.durationSeconds,
      strategyId: "",
      model: alt.model,
      score,
    });
  }

  scored.sort((a, b) => compareScoredPicks(a, b, input.policy.tieBreakers));

  const seen = new Set<string>();
  const out: FallbackStep[] = [];
  for (const s of scored) {
    const key = `${s.providerId}::${s.modelId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const order = (out.length + 1) as 1 | 2;
    let estimate: CostEstimate;
    try {
      estimate = estimateStepCost(s.model, {
        ...input.estimateContext,
        role: order === 1 ? "fallback1" : "fallback2",
      }).estimate;
    } catch {
      continue;
    }
    const alt = input.alternatives.find(
      (a) => a.model.providerId === s.providerId && a.model.modelId === s.modelId,
    );
    out.push({
      order,
      providerId: s.providerId,
      modelId: s.modelId,
      estimate,
      reason: `Deterministic fallback #${order} under routing policy ${input.policy.version}.`,
      eligibilityEvidence: alt?.eligibilityEvidence ?? [],
    });
    if (out.length >= max) break;
  }
  return out;
}
