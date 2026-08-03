/**
 * Versioned routing policy (VHS-108).
 * Injected — never read from process.env.
 */

import { RoutingDomainError } from "./errors";

export const DEFAULT_ROUTING_POLICY_VERSION = "routing-policy-v1" as const;

export type RoutingScoreDimension =
  | "quality"
  | "identity"
  | "speed"
  | "reliability"
  | "cost";

export type UnknownScorePolicyAction =
  | "block"
  | "exclude_from_denominator"
  | "penalty";

export type UnknownScorePolicy = {
  quality: UnknownScorePolicyAction;
  identity: UnknownScorePolicyAction;
  speed: UnknownScorePolicyAction;
  reliability: UnknownScorePolicyAction;
  cost: UnknownScorePolicyAction;
  /** Penalty points (0–100) when action is penalty. */
  penaltyPoints: number;
};

export type RoutingHardRequirements = {
  /** When identityPriority is high, identity score unknown → block if identity policy is block. */
  identityScoreRequiredWhenHighPriority: boolean;
  /** Pricing must resolve to a firm Money amount. */
  requireFirmPricing: boolean;
  /** Reject candidates with pricing confidence unknown when firm pricing required. */
  rejectUnknownPricingConfidence: boolean;
};

export type RoutingTieBreaker =
  | "total_score_desc"
  | "reliability_desc"
  | "cost_asc"
  | "duration_asc"
  | "providerId_asc"
  | "modelId_asc"
  | "strategyId_asc";

export type RoutingPolicy = {
  version: string;
  priorities: {
    quality: number;
    identity: number;
    speed: number;
    reliability: number;
    cost: number;
  };
  hardRequirements: RoutingHardRequirements;
  maximumCandidatesPerStep: number;
  maximumStrategyCombinations: number;
  maximumFallbacksPerStep: 0 | 1 | 2;
  unknownScorePolicy: UnknownScorePolicy;
  tieBreakers: RoutingTieBreaker[];
  /** Max rejected alternatives kept in explanations. */
  maxRejectedAlternatives: number;
};

export function createDefaultRoutingPolicy(
  overrides: Partial<RoutingPolicy> = {},
): RoutingPolicy {
  const base: RoutingPolicy = {
    version: DEFAULT_ROUTING_POLICY_VERSION,
    priorities: {
      quality: 20,
      identity: 30,
      speed: 10,
      reliability: 15,
      cost: 25,
    },
    hardRequirements: {
      // Eligibility already enforces identity refs; registry scores optional unless enabled.
      identityScoreRequiredWhenHighPriority: false,
      requireFirmPricing: true,
      rejectUnknownPricingConfidence: false,
    },
    maximumCandidatesPerStep: 5,
    maximumStrategyCombinations: 64,
    maximumFallbacksPerStep: 2,
    unknownScorePolicy: {
      quality: "exclude_from_denominator",
      identity: "exclude_from_denominator",
      speed: "exclude_from_denominator",
      reliability: "exclude_from_denominator",
      cost: "block",
      penaltyPoints: 10,
    },
    tieBreakers: [
      "total_score_desc",
      "reliability_desc",
      "cost_asc",
      "duration_asc",
      "providerId_asc",
      "modelId_asc",
      "strategyId_asc",
    ],
    maxRejectedAlternatives: 8,
  };
  const policy = { ...base, ...overrides, priorities: { ...base.priorities, ...overrides.priorities } };
  validateRoutingPolicy(policy);
  return Object.freeze(policy) as RoutingPolicy;
}

export function validateRoutingPolicy(policy: RoutingPolicy): void {
  if (!policy.version?.trim()) {
    throw new RoutingDomainError("invalid_policy", "Routing policy version is required.");
  }
  const dims: RoutingScoreDimension[] = [
    "quality",
    "identity",
    "speed",
    "reliability",
    "cost",
  ];
  let sum = 0;
  for (const d of dims) {
    const w = policy.priorities[d];
    if (!Number.isInteger(w) || w < 0 || w > 100) {
      throw new RoutingDomainError(
        "invalid_policy",
        "Priority weights must be integers in 0–100.",
        d,
      );
    }
    sum += w;
  }
  if (sum !== 100) {
    throw new RoutingDomainError(
      "invalid_policy",
      "Priority weights must sum to 100.",
      `sum=${sum}`,
    );
  }
  if (
    !Number.isInteger(policy.maximumCandidatesPerStep) ||
    policy.maximumCandidatesPerStep < 1 ||
    policy.maximumCandidatesPerStep > 20
  ) {
    throw new RoutingDomainError("invalid_policy", "Invalid maximumCandidatesPerStep.");
  }
  if (
    !Number.isInteger(policy.maximumStrategyCombinations) ||
    policy.maximumStrategyCombinations < 1 ||
    policy.maximumStrategyCombinations > 256
  ) {
    throw new RoutingDomainError("invalid_policy", "Invalid maximumStrategyCombinations.");
  }
  if (![0, 1, 2].includes(policy.maximumFallbacksPerStep)) {
    throw new RoutingDomainError("invalid_policy", "maximumFallbacksPerStep must be 0, 1, or 2.");
  }
  if (!policy.tieBreakers.length) {
    throw new RoutingDomainError("invalid_policy", "tieBreakers required.");
  }
}
