/**
 * Structured routing explanations (VHS-108).
 * No prompts, secrets, or signed URLs.
 */

import type { CandidateScore } from "./scoring";

export type RoutingReasonCode =
  | "eligible"
  | "best_score"
  | "identity_compatible"
  | "ratio_compatible"
  | "within_budget"
  | "lowest_cost_tiebreak"
  | "lexical_tiebreak"
  | "only_candidate"
  | "strategy_fit";

export type RoutingReason = {
  code: RoutingReasonCode;
  message: string;
};

export type RejectedCandidateSummary = {
  providerId: string;
  modelId: string;
  reasonCodes: string[];
  message: string;
  scoreTotal?: number;
};

export type ModelSelectionExplanation = {
  selectedBecause: RoutingReason[];
  rejectedAlternatives: RejectedCandidateSummary[];
  score: CandidateScore;
  eligibilityEvidence: string[];
  pricingEvidence: string[];
  unknowns: string[];
};

export type SceneRoutingRationale = {
  strategyId: string;
  summary: string;
  reasons: RoutingReason[];
};

export type RoutingRationale = {
  summary: string;
  policyVersion: string;
  registryVersion: string;
  decisions: Array<{ sceneId: string; strategyId: string; summary: string }>;
};

export type RoutingWarning = {
  code: string;
  message: string;
  sceneId?: string;
  field?: string;
};

export function buildSelectionExplanation(input: {
  score: CandidateScore;
  eligibilityEvidence: string[];
  pricingEvidence: string[];
  rejected: RejectedCandidateSummary[];
  withinBudget: boolean;
  identityPriorityHigh: boolean;
}): ModelSelectionExplanation {
  const selectedBecause: RoutingReason[] = [
    { code: "eligible", message: "Model satisfies hard eligibility requirements." },
    { code: "best_score", message: "Highest composite score under routing policy." },
  ];
  if (input.identityPriorityHigh) {
    selectedBecause.push({
      code: "identity_compatible",
      message: "Identity constraints satisfied for this scene.",
    });
  }
  if (input.withinBudget) {
    selectedBecause.push({
      code: "within_budget",
      message: "Estimated cost fits the hard budget.",
    });
  }
  selectedBecause.push({
    code: "ratio_compatible",
    message: "Aspect ratio and duration constraints satisfied.",
  });

  return {
    selectedBecause,
    rejectedAlternatives: input.rejected,
    score: input.score,
    eligibilityEvidence: input.eligibilityEvidence,
    pricingEvidence: input.pricingEvidence,
    unknowns: input.score.missingDimensions.map((d) => `score.${d}`),
  };
}
