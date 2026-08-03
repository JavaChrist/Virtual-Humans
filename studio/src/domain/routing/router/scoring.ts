/**
 * Pure scoring for model candidates (VHS-108).
 * Never invents scores; unknown dimensions follow policy.
 */

import type { ModelCapabilities } from "@/domain/routing/capabilities";
import type { Money } from "@/domain/cost";
import { RoutingDomainError } from "./errors";
import type {
  RoutingPolicy,
  RoutingScoreDimension,
  RoutingTieBreaker,
} from "./policy";

export type ScoreContribution = {
  dimension: RoutingScoreDimension;
  weight: number;
  rawScore: number;
  weighted: number;
  status: "known" | "excluded" | "penalty" | "blocked";
};

export type CandidateScore = {
  quality?: number;
  identity?: number;
  speed?: number;
  reliability?: number;
  cost?: number;
  total: number;
  missingDimensions: RoutingScoreDimension[];
  contributions: ScoreContribution[];
};

export type ScoredPick = {
  providerId: string;
  modelId: string;
  cost: Money;
  estimatedDurationSeconds: number;
  strategyId: string;
  model: ModelCapabilities;
  score: CandidateScore;
};

function readRegistryScore(
  model: ModelCapabilities,
  dim: Exclude<RoutingScoreDimension, "cost">,
): number | undefined {
  const map = {
    quality: model.quality.quality,
    identity: model.quality.identity,
    speed: model.quality.speed,
    reliability: model.quality.reliability,
  } as const;
  const v = map[dim];
  if (v === undefined) return undefined;
  if (!Number.isInteger(v) || v < 0 || v > 100) {
    throw new RoutingDomainError("invalid_policy", "Registry score out of bounds.", dim);
  }
  // Evidence already required by registry schema when score present
  return v;
}

/**
 * Normalize cost among comparable candidates: lower cost → higher score.
 * Pure integer arithmetic (basis: 0–100).
 */
export function normalizeCostScores(
  costs: ReadonlyArray<{ key: string; amountMinor: number }>,
): Map<string, number> {
  const out = new Map<string, number>();
  if (costs.length === 0) return out;
  let min = costs[0]!.amountMinor;
  let max = costs[0]!.amountMinor;
  for (const c of costs) {
    if (c.amountMinor < min) min = c.amountMinor;
    if (c.amountMinor > max) max = c.amountMinor;
  }
  for (const c of costs) {
    if (max === min) {
      out.set(c.key, 100);
    } else {
      // score = round(100 * (max - cost) / (max - min))
      const num = 100 * (max - c.amountMinor);
      const den = max - min;
      out.set(c.key, Math.round(num / den));
    }
  }
  return out;
}

export type ScoreCandidateInput = {
  model: ModelCapabilities;
  costScore: number | undefined;
  policy: RoutingPolicy;
  identityPriorityHigh: boolean;
};

/**
 * Score one candidate. Returns null if blocked by unknown hard dimension.
 */
export function scoreCandidate(input: ScoreCandidateInput): CandidateScore | null {
  const { model, costScore, policy, identityPriorityHigh } = input;
  const dims: RoutingScoreDimension[] = [
    "quality",
    "identity",
    "speed",
    "reliability",
    "cost",
  ];
  const contributions: ScoreContribution[] = [];
  const missing: RoutingScoreDimension[] = [];
  let weightedSum = 0;
  let weightSum = 0;

  for (const dim of dims) {
    const weight = policy.priorities[dim];
    let raw: number | undefined;
    if (dim === "cost") {
      raw = costScore;
    } else {
      raw = readRegistryScore(model, dim);
    }

    if (raw === undefined) {
      missing.push(dim);
      const action = policy.unknownScorePolicy[dim];
      const hardIdentity =
        dim === "identity" &&
        identityPriorityHigh &&
        policy.hardRequirements.identityScoreRequiredWhenHighPriority;
      if (action === "block" || hardIdentity) {
        return null;
      }
      if (action === "penalty") {
        const penalty = 100 - policy.unknownScorePolicy.penaltyPoints;
        const clamped = Math.max(0, Math.min(100, penalty));
        contributions.push({
          dimension: dim,
          weight,
          rawScore: clamped,
          weighted: weight * clamped,
          status: "penalty",
        });
        weightedSum += weight * clamped;
        weightSum += weight;
      } else {
        contributions.push({
          dimension: dim,
          weight,
          rawScore: 0,
          weighted: 0,
          status: "excluded",
        });
      }
      continue;
    }

    contributions.push({
      dimension: dim,
      weight,
      rawScore: raw,
      weighted: weight * raw,
      status: "known",
    });
    weightedSum += weight * raw;
    weightSum += weight;
  }

  if (weightSum === 0) {
    return null;
  }

  const total = Math.round(weightedSum / weightSum);
  return {
    quality: contributions.find((c) => c.dimension === "quality" && c.status === "known")
      ?.rawScore,
    identity: contributions.find((c) => c.dimension === "identity" && c.status === "known")
      ?.rawScore,
    speed: contributions.find((c) => c.dimension === "speed" && c.status === "known")?.rawScore,
    reliability: contributions.find(
      (c) => c.dimension === "reliability" && c.status === "known",
    )?.rawScore,
    cost: contributions.find((c) => c.dimension === "cost" && c.status === "known")?.rawScore,
    total,
    missingDimensions: missing,
    contributions,
  };
}

function cmpNum(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Deterministic total order using policy tie-breakers.
 * Higher score first; returns <0 if a should rank before b.
 */
export function compareScoredPicks(
  a: ScoredPick,
  b: ScoredPick,
  tieBreakers: readonly RoutingTieBreaker[],
): number {
  for (const tb of tieBreakers) {
    let c = 0;
    switch (tb) {
      case "total_score_desc":
        c = -cmpNum(a.score.total, b.score.total);
        break;
      case "reliability_desc": {
        const ar = a.score.reliability ?? -1;
        const br = b.score.reliability ?? -1;
        c = -cmpNum(ar, br);
        break;
      }
      case "cost_asc":
        c = cmpNum(a.cost.amountMinor, b.cost.amountMinor);
        break;
      case "duration_asc":
        c = cmpNum(a.estimatedDurationSeconds, b.estimatedDurationSeconds);
        break;
      case "providerId_asc":
        c = cmpStr(a.providerId, b.providerId);
        break;
      case "modelId_asc":
        c = cmpStr(a.modelId, b.modelId);
        break;
      case "strategyId_asc":
        c = cmpStr(a.strategyId, b.strategyId);
        break;
      default: {
        const _e: never = tb;
        void _e;
      }
    }
    if (c !== 0) return c;
  }
  return 0;
}

export function sortScoredPicks(
  picks: ScoredPick[],
  tieBreakers: readonly RoutingTieBreaker[],
): ScoredPick[] {
  return [...picks].sort((a, b) => compareScoredPicks(a, b, tieBreakers));
}
