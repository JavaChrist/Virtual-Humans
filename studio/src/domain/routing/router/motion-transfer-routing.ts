/**
 * Motion Transfer Router strategy (MT-003).
 * Pure decision — no provider calls, no ledger writes, no job creation.
 */

import type { BriefAspectRatio } from "@/domain/brief";
import type { Money } from "@/domain/cost";
import {
  MOTION_TRANSFER_CAPABILITY,
  assertNotI2vOrT2vFallback,
  type MotionTransferInput,
  type MotionTransferRoutingErrorCode,
  type LockLevel,
  type MotionFidelity,
  type PoseControlMode,
} from "@/domain/motion";
import {
  MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
  assertSnapshotFresh,
  canonicalModelKey,
  explainMotionTransferIneligibility,
  listModelsForProfile,
  satisfiesMotionTransferHardConstraints,
  supportsMotionTransfer,
  type CapabilityRegistrySnapshot,
  type ModelCapabilities,
  type MotionTransferHardConstraintInput,
  type MotionTransferIneligibility,
  type SyncOrAsync,
} from "@/domain/routing/capabilities";
import { estimateStepCost } from "./cost-estimation";
import { combinationKey, estimateId, stepId } from "./deterministic-id";
import {
  compareScoredPicks,
  normalizeCostScores,
  scoreCandidate,
  type CandidateScore,
  type ScoredPick,
} from "./scoring";
import {
  createDefaultRoutingPolicy,
  type RoutingPolicy,
} from "./policy";
import { getStrategy } from "./strategy-library";
import { sanitizePublicMessage } from "@/domain/motion/errors";

export const MOTION_TRANSFER_ROUTING_REQUEST_SCHEMA_VERSION = "1.0.0" as const;
export const MOTION_TRANSFER_ROUTING_DECISION_VERSION = "1.0.0" as const;
export const MOTION_TRANSFER_STRATEGY_ID = "motion_transfer" as const;

/** Maximum fallbacks for motion_transfer V1 — hard zero. */
export const MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP = 0 as const;

export type MotionTransferRoutingConstraints = {
  fidelity: MotionFidelity;
  identityLock: LockLevel;
  outfitLock?: LockLevel;
  fullBodyRequired?: boolean;
  handsFeetCritical?: boolean;
  preserveTiming: boolean;
  preserveCamera?: boolean;
  poseControl?: PoseControlMode;
  durationSeconds: number;
  aspectRatio: BriefAspectRatio;
  resolution?: string;
  fps?: number;
  /** When set, model.syncOrAsync must be included. Default: ["async", "sync"]. */
  acceptedSyncModes?: readonly SyncOrAsync[];
};

/**
 * Routing request — constraints only (no media bytes / signed URLs / prompts).
 */
export type MotionTransferRoutingRequest = {
  schemaVersion: typeof MOTION_TRANSFER_ROUTING_REQUEST_SCHEMA_VERSION;
  strategy: typeof MOTION_TRANSFER_STRATEGY_ID;
  constraints: MotionTransferRoutingConstraints;
  registry: CapabilityRegistrySnapshot;
  /**
   * Allowlists (optional):
   * - omitted → no allowlist filter (all registry models considered)
   * - present (even empty) → only listed IDs; empty ⇒ zero candidates
   * Production callers should pass explicit allowlists. No implicit Production wildcard.
   */
  allowedProviders?: readonly string[];
  /** Canonical keys `providerId::modelId`. */
  allowedModels?: readonly string[];
  /** Compare-only budget ceiling in minor units — never reserves ledger. */
  budgetLimitMinor?: number;
  currency?: string;
  at: string;
  correlationId: string;
  /** Injected policy; maximumFallbacksPerStep forced to 0. */
  policy?: RoutingPolicy;
};

export type MotionTransferRoutingRejection = {
  providerId: string;
  modelId: string;
  reasons: Array<{
    code: string;
    field?: string;
    message: string;
  }>;
};

export type MotionTransferRoutingCandidate = {
  providerId: string;
  modelId: string;
  /** Capability block schema version when present. */
  motionCapabilitiesSchemaVersion: string;
  estimate: Money;
  estimatedDurationSeconds: number;
  score: CandidateScore;
  scoreBreakdown: CandidateScore["contributions"];
  hardConstraintPass: true;
};

export type MotionTransferRoutingFailure = {
  code: MotionTransferRoutingErrorCode;
  message: string;
  rejected: MotionTransferRoutingRejection[];
  eligibleCandidateCount: 0;
};

export type MotionTransferRoutingSuccess = {
  status: "selected";
  strategy: typeof MOTION_TRANSFER_STRATEGY_ID;
  decisionVersion: typeof MOTION_TRANSFER_ROUTING_DECISION_VERSION;
  capability: typeof MOTION_TRANSFER_CAPABILITY;
  capabilityVersion: typeof MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION;
  registryVersion: string;
  policyVersion: string;
  selected: {
    providerId: string;
    modelId: string;
  };
  candidate: MotionTransferRoutingCandidate;
  eligibleCandidateCount: number;
  rejected: MotionTransferRoutingRejection[];
  estimate: Money;
  maximumFallbacksPerStep: typeof MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP;
  fallbacks: [];
  decisionFingerprint: string;
  correlationId: string;
};

export type MotionTransferRoutingDecision =
  | MotionTransferRoutingSuccess
  | {
      status: "failed";
      strategy: typeof MOTION_TRANSFER_STRATEGY_ID;
      decisionVersion: typeof MOTION_TRANSFER_ROUTING_DECISION_VERSION;
      capability: typeof MOTION_TRANSFER_CAPABILITY;
      registryVersion: string;
      policyVersion: string;
      failure: MotionTransferRoutingFailure;
      maximumFallbacksPerStep: typeof MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP;
      fallbacks: [];
      decisionFingerprint: string;
      correlationId: string;
    };

/** Strip media / prompts from MotionTransferInput → routing constraints. */
export function routingConstraintsFromMotionTransferInput(
  input: MotionTransferInput,
): MotionTransferRoutingConstraints {
  assertNotI2vOrT2vFallback(input.capability);
  const handsFeetCritical = input.qcRequirements.some(
    (q) =>
      q.severity === "blocking" &&
      /hand|foot|feet|pied|main/i.test(q.code),
  );
  return {
    fidelity: input.motion.fidelity,
    identityLock: input.character.identityLock,
    outfitLock: input.character.outfitLock,
    fullBodyRequired: input.character.fullBodyRequired,
    handsFeetCritical: handsFeetCritical || undefined,
    preserveTiming: input.motion.preserveTiming,
    preserveCamera: input.motion.preserveCamera,
    poseControl: input.motion.poseControl,
    durationSeconds: input.output.durationSeconds ?? 8,
    aspectRatio: input.output.aspectRatio,
    resolution: input.output.resolution,
    fps: input.output.fps,
  };
}

function toHardInput(
  c: MotionTransferRoutingConstraints,
): MotionTransferHardConstraintInput {
  return {
    fidelity: c.fidelity,
    identityLock: c.identityLock,
    outfitLock: c.outfitLock,
    fullBodyRequired: c.fullBodyRequired,
    handsFeetCritical: c.handsFeetCritical,
    preserveTiming: c.preserveTiming,
    preserveCamera: c.preserveCamera,
    poseControl: c.poseControl,
    durationSeconds: c.durationSeconds,
    aspectRatio: c.aspectRatio,
    resolution: c.resolution,
    fps: c.fps,
    requireVerifiedForPaid: true,
  };
}

function motionPolicyForFidelity(
  fidelity: MotionFidelity,
  base?: RoutingPolicy,
): RoutingPolicy {
  const priorities =
    fidelity === "critical"
      ? {
          // Motion/body fidelity dominate cost for critical.
          quality: 35,
          identity: 30,
          reliability: 20,
          speed: 10,
          cost: 5,
        }
      : (base?.priorities ?? {
          quality: 25,
          identity: 25,
          reliability: 15,
          speed: 10,
          cost: 25,
        });

  const overrides: Partial<RoutingPolicy> = {
    priorities,
    hardRequirements: {
      identityScoreRequiredWhenHighPriority:
        base?.hardRequirements.identityScoreRequiredWhenHighPriority ?? false,
      requireFirmPricing: true,
      rejectUnknownPricingConfidence:
        base?.hardRequirements.rejectUnknownPricingConfidence ?? false,
    },
    maximumFallbacksPerStep: MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP,
  };
  if (base?.version) overrides.version = base.version;
  if (base?.maximumCandidatesPerStep != null) {
    overrides.maximumCandidatesPerStep = base.maximumCandidatesPerStep;
  }
  if (base?.maximumStrategyCombinations != null) {
    overrides.maximumStrategyCombinations = base.maximumStrategyCombinations;
  }
  if (base?.unknownScorePolicy) overrides.unknownScorePolicy = base.unknownScorePolicy;
  if (base?.tieBreakers) overrides.tieBreakers = base.tieBreakers;
  if (base?.maxRejectedAlternatives != null) {
    overrides.maxRejectedAlternatives = base.maxRejectedAlternatives;
  }
  const defaults = createDefaultRoutingPolicy(overrides);
  if (defaults.maximumFallbacksPerStep !== 0) {
    throw new Error("fallback_forbidden");
  }
  return defaults;
}

function rejectReasonsFromIneligibility(
  items: MotionTransferIneligibility[],
): MotionTransferRoutingRejection["reasons"] {
  return items.map((i) => ({
    code: i.reason,
    field: i.field,
    message: sanitizePublicMessage(i.message),
  }));
}

function assertRequestValid(request: MotionTransferRoutingRequest): void {
  if (request.schemaVersion !== MOTION_TRANSFER_ROUTING_REQUEST_SCHEMA_VERSION) {
    throw new Error("invalid_routing_request:unknown_schema_version");
  }
  if (request.strategy !== MOTION_TRANSFER_STRATEGY_ID) {
    throw new Error("invalid_routing_request:strategy");
  }
  assertNotI2vOrT2vFallback(MOTION_TRANSFER_CAPABILITY);
  if (
    !Number.isFinite(request.constraints.durationSeconds) ||
    request.constraints.durationSeconds <= 0
  ) {
    throw new Error("invalid_routing_request:duration");
  }
  if (!request.correlationId?.trim()) {
    throw new Error("invalid_routing_request:correlationId");
  }
}

function deepFreezeJson<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) {
      deepFreezeJson(v);
    }
  }
  return value;
}

function decisionFingerprint(parts: {
  registryVersion: string;
  policyVersion: string;
  constraints: MotionTransferRoutingConstraints;
  selected?: { providerId: string; modelId: string };
  failureCode?: string;
}): string {
  const payload = {
    v: MOTION_TRANSFER_ROUTING_DECISION_VERSION,
    strategy: MOTION_TRANSFER_STRATEGY_ID,
    registryVersion: parts.registryVersion,
    policyVersion: parts.policyVersion,
    constraints: parts.constraints,
    selected: parts.selected ?? null,
    failureCode: parts.failureCode ?? null,
  };
  return `mt-route:${combinationKey(
    MOTION_TRANSFER_STRATEGY_ID,
    parts.selected ? [parts.selected] : [],
  )}:${stableHash(JSON.stringify(payload))}`;
}

/** Stable non-crypto fingerprint for determinism checks (not a security hash). */
function stableHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function failedDecision(
  request: MotionTransferRoutingRequest,
  policy: RoutingPolicy,
  code: MotionTransferRoutingErrorCode,
  message: string,
  rejected: MotionTransferRoutingRejection[],
): MotionTransferRoutingDecision {
  const decision: MotionTransferRoutingDecision = {
    status: "failed",
    strategy: MOTION_TRANSFER_STRATEGY_ID,
    decisionVersion: MOTION_TRANSFER_ROUTING_DECISION_VERSION,
    capability: MOTION_TRANSFER_CAPABILITY,
    registryVersion: request.registry.registryVersion,
    policyVersion: policy.version,
    failure: {
      code,
      message: sanitizePublicMessage(message),
      rejected: rejected
        .map((r) => ({
          ...r,
          reasons: r.reasons
            .map((x) => ({ ...x, message: sanitizePublicMessage(x.message) }))
            .sort((a, b) =>
              a.code === b.code
                ? (a.field ?? "").localeCompare(b.field ?? "")
                : a.code.localeCompare(b.code),
            ),
        }))
        .sort((a, b) =>
          a.providerId === b.providerId
            ? a.modelId.localeCompare(b.modelId)
            : a.providerId.localeCompare(b.providerId),
        ),
      eligibleCandidateCount: 0,
    },
    maximumFallbacksPerStep: MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP,
    fallbacks: [],
    decisionFingerprint: decisionFingerprint({
      registryVersion: request.registry.registryVersion,
      policyVersion: policy.version,
      constraints: request.constraints,
      failureCode: code,
    }),
    correlationId: request.correlationId,
  };
  return deepFreezeJson(structuredClone(decision));
}

/**
 * Pure motion-transfer routing decision.
 * Consumes MT-002 hard-constraint helpers. No external effects.
 */
export function routeMotionTransfer(
  request: MotionTransferRoutingRequest,
): MotionTransferRoutingDecision {
  const requestSnapshot = structuredClone({
    ...request,
    registry: undefined,
  });
  void requestSnapshot;

  try {
    assertRequestValid(request);
  } catch {
    const policy = motionPolicyForFidelity(request.constraints?.fidelity ?? "standard");
    return failedDecision(
      request,
      policy,
      "invalid_routing_request",
      "Motion-transfer routing request is invalid.",
      [],
    );
  }

  const policy = motionPolicyForFidelity(request.constraints.fidelity, request.policy);
  const strategy = getStrategy(MOTION_TRANSFER_STRATEGY_ID);
  if (strategy.id !== MOTION_TRANSFER_STRATEGY_ID) {
    return failedDecision(
      request,
      policy,
      "no_eligible_motion_strategy",
      "Motion-transfer strategy is not registered.",
      [],
    );
  }

  try {
    assertSnapshotFresh(request.registry, request.at);
  } catch {
    return failedDecision(
      request,
      policy,
      "motion_capability_unavailable",
      "Capability registry snapshot is not usable.",
      [],
    );
  }

  const hard = toHardInput(request.constraints);
  const acceptedSync =
    request.constraints.acceptedSyncModes ??
    (["async", "sync"] as const);

  const profileModels = listModelsForProfile(
    request.registry,
    MOTION_TRANSFER_CAPABILITY,
  );

  // Also scan all models so I2V/T2V rejections appear in explanations when relevant.
  const allModels = [...request.registry.models].sort((a, b) =>
    canonicalModelKey(a.providerId, a.modelId).localeCompare(
      canonicalModelKey(b.providerId, b.modelId),
    ),
  );

  const rejected: MotionTransferRoutingRejection[] = [];
  const hardEligible: ModelCapabilities[] = [];

  for (const model of allModels) {
    const key = canonicalModelKey(model.providerId, model.modelId);
    const reasons: MotionTransferRoutingRejection["reasons"] = [];

    if (request.allowedProviders !== undefined) {
      if (!request.allowedProviders.includes(model.providerId)) {
        reasons.push({
          code: "provider_not_allowlisted",
          field: "allowedProviders",
          message: "Provider is not on the motion-transfer allowlist.",
        });
      }
    }
    if (request.allowedModels !== undefined) {
      if (!request.allowedModels.includes(key)) {
        reasons.push({
          code: "model_not_allowlisted",
          field: "allowedModels",
          message: "Model is not on the motion-transfer allowlist.",
        });
      }
    }

    if (model.status === "unavailable" || model.status === "unknown") {
      reasons.push({
        code: "model_status_not_verified",
        field: "status",
        message: "Model status is not verified/available for paid routing.",
      });
    }

    if (!supportsMotionTransfer(model)) {
      // Profile / block missing — record structured reasons (anti I2V/T2V).
      const mtReasons = explainMotionTransferIneligibility(model, hard);
      if (mtReasons.length === 0) {
        reasons.push({
          code: "motion_transfer_not_supported",
          message: "Model does not support video.motion_transfer.",
        });
      } else {
        reasons.push(...rejectReasonsFromIneligibility(mtReasons));
      }
    } else {
      if (
        model.motionTransfer &&
        !acceptedSync.includes(model.motionTransfer.syncOrAsync)
      ) {
        reasons.push({
          code: "sync_mode_unsupported",
          field: "motionTransfer.syncOrAsync",
          message: "Model sync/async mode is not accepted for this request.",
        });
      }
      if (!satisfiesMotionTransferHardConstraints(model, hard)) {
        reasons.push(
          ...rejectReasonsFromIneligibility(
            explainMotionTransferIneligibility(model, hard),
          ),
        );
      }
    }

    // Deduplicate reasons
    const seen = new Set<string>();
    const uniqueReasons = reasons.filter((r) => {
      const k = `${r.code}:${r.field ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (uniqueReasons.length > 0) {
      // Only keep rejections for profile MT models or allowlist/status issues on others
      // that were considered — always keep MT profile models; for non-MT keep if they
      // appeared in profileModels or were video models (hostile I2V proof).
      const isMtProfile = profileModels.some(
        (m) =>
          m.providerId === model.providerId && m.modelId === model.modelId,
      );
      const isHostileVideo =
        model.supportedProfiles.includes("video.image_to_video") ||
        model.supportedProfiles.includes("video.text_to_video");
      if (isMtProfile || isHostileVideo || request.allowedModels !== undefined) {
        rejected.push({
          providerId: model.providerId,
          modelId: model.modelId,
          reasons: uniqueReasons,
        });
      }
      continue;
    }

    hardEligible.push(model);
  }

  if (hardEligible.length === 0) {
    return failedDecision(
      request,
      policy,
      "motion_capability_unavailable",
      "No verified motion-transfer model satisfies hard constraints.",
      rejected,
    );
  }

  // Estimate costs for hard-eligible candidates
  const priced: Array<{
    model: ModelCapabilities;
    cost: Money;
    durationSeconds: number;
    pricingOk: true;
  }> = [];

  for (const model of hardEligible) {
    if (!model.pricing || model.pricing.length === 0) {
      rejected.push({
        providerId: model.providerId,
        modelId: model.modelId,
        reasons: [
          {
            code: "pricing_unconfigured",
            field: "pricing",
            message: "Model pricing is not configured.",
          },
        ],
      });
      continue;
    }

    const sid = stepId({
      sceneId: "motion_transfer",
      strategyId: MOTION_TRANSFER_STRATEGY_ID,
      order: 1,
      profile: MOTION_TRANSFER_CAPABILITY,
    });

    try {
      const { estimate } = estimateStepCost(model, {
        projectId: "motion_transfer",
        sceneId: "motion_transfer",
        stepId: sid,
        action: "motion_transfer",
        durationSeconds: request.constraints.durationSeconds,
        characterCount: 0,
        at: request.at,
        correlationId: request.correlationId,
        createdBy: "motion-transfer-router",
        createdAt: request.at,
        role: "primary",
        requireFirmPricing: policy.hardRequirements.requireFirmPricing,
        rejectUnknownPricingConfidence:
          policy.hardRequirements.rejectUnknownPricingConfidence,
      });

      if (
        request.currency &&
        estimate.total.currency !== request.currency
      ) {
        rejected.push({
          providerId: model.providerId,
          modelId: model.modelId,
          reasons: [
            {
              code: "estimate_unavailable",
              field: "currency",
              message: "Estimate currency does not match request currency.",
            },
          ],
        });
        continue;
      }

      if (
        request.budgetLimitMinor !== undefined &&
        estimate.total.amountMinor > request.budgetLimitMinor
      ) {
        rejected.push({
          providerId: model.providerId,
          modelId: model.modelId,
          reasons: [
            {
              code: "budget_limit_exceeded",
              field: "budgetLimitMinor",
              message: "Estimated cost exceeds the provided budget limit.",
            },
          ],
        });
        continue;
      }

      // Touch estimateId for stable artifact naming (no side effect)
      void estimateId({
        stepId: sid,
        providerId: model.providerId,
        modelId: model.modelId,
        role: "primary",
      });

      priced.push({
        model,
        cost: estimate.total,
        durationSeconds: request.constraints.durationSeconds,
        pricingOk: true,
      });
    } catch {
      rejected.push({
        providerId: model.providerId,
        modelId: model.modelId,
        reasons: [
          {
            code: "estimate_unavailable",
            field: "pricing",
            message: "Could not produce a firm cost estimate for this model.",
          },
        ],
      });
    }
  }

  if (priced.length === 0) {
    const hasPricingIssue = rejected.some((r) =>
      r.reasons.some(
        (x) =>
          x.code === "pricing_unconfigured" ||
          x.code === "estimate_unavailable",
      ),
    );
    const hasBudget = rejected.some((r) =>
      r.reasons.some((x) => x.code === "budget_limit_exceeded"),
    );
    const code: MotionTransferRoutingErrorCode = hasBudget
      ? "budget_limit_exceeded"
      : hasPricingIssue
        ? rejected.some((r) =>
            r.reasons.some((x) => x.code === "pricing_unconfigured"),
          )
          ? "pricing_unconfigured"
          : "estimate_unavailable"
        : "motion_capability_unavailable";
    return failedDecision(
      request,
      policy,
      code,
      code === "budget_limit_exceeded"
        ? "All eligible motion-transfer estimates exceed the budget limit."
        : code === "pricing_unconfigured"
          ? "Motion-transfer pricing is not configured for eligible models."
          : code === "estimate_unavailable"
            ? "Motion-transfer cost estimate is unavailable."
            : "No verified motion-transfer model satisfies hard constraints.",
      rejected,
    );
  }

  const costScores = normalizeCostScores(
    priced.map((p) => ({
      key: canonicalModelKey(p.model.providerId, p.model.modelId),
      amountMinor: p.cost.amountMinor,
    })),
  );

  const identityPriorityHigh =
    request.constraints.identityLock === "required" ||
    request.constraints.fidelity === "critical";

  const scored: ScoredPick[] = [];
  for (const p of priced) {
    const key = canonicalModelKey(p.model.providerId, p.model.modelId);
    const score = scoreCandidate({
      model: p.model,
      costScore: costScores.get(key),
      policy,
      identityPriorityHigh,
    });
    if (!score) {
      rejected.push({
        providerId: p.model.providerId,
        modelId: p.model.modelId,
        reasons: [
          {
            code: "scoring_blocked",
            message: "Candidate blocked by unknown hard score dimension.",
          },
        ],
      });
      continue;
    }
    scored.push({
      providerId: p.model.providerId,
      modelId: p.model.modelId,
      cost: p.cost,
      estimatedDurationSeconds: p.durationSeconds,
      strategyId: MOTION_TRANSFER_STRATEGY_ID,
      model: p.model,
      score,
    });
  }

  if (scored.length === 0) {
    return failedDecision(
      request,
      policy,
      "motion_capability_unavailable",
      "No scored motion-transfer candidate remained after hard eligibility.",
      rejected,
    );
  }

  // Shuffle-invariant: sort by canonical key before tie-break sort
  scored.sort((a, b) =>
    canonicalModelKey(a.providerId, a.modelId).localeCompare(
      canonicalModelKey(b.providerId, b.modelId),
    ),
  );
  const ordered = [...scored].sort((a, b) =>
    compareScoredPicks(a, b, policy.tieBreakers),
  );
  const best = ordered[0]!;

  const candidate: MotionTransferRoutingCandidate = {
    providerId: best.providerId,
    modelId: best.modelId,
    motionCapabilitiesSchemaVersion:
      best.model.motionTransfer?.schemaVersion ??
      MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
    estimate: best.cost,
    estimatedDurationSeconds: best.estimatedDurationSeconds,
    score: best.score,
    scoreBreakdown: best.score.contributions,
    hardConstraintPass: true,
  };

  const success: MotionTransferRoutingSuccess = {
    status: "selected",
    strategy: MOTION_TRANSFER_STRATEGY_ID,
    decisionVersion: MOTION_TRANSFER_ROUTING_DECISION_VERSION,
    capability: MOTION_TRANSFER_CAPABILITY,
    capabilityVersion: MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
    registryVersion: request.registry.registryVersion,
    policyVersion: policy.version,
    selected: {
      providerId: best.providerId,
      modelId: best.modelId,
    },
    candidate,
    eligibleCandidateCount: scored.length,
    rejected: rejected
      .map((r) => ({
        ...r,
        reasons: r.reasons.map((x) => ({
          ...x,
          message: sanitizePublicMessage(x.message),
        })),
      }))
      .sort((a, b) =>
        a.providerId === b.providerId
          ? a.modelId.localeCompare(b.modelId)
          : a.providerId.localeCompare(b.providerId),
      ),
    estimate: best.cost,
    maximumFallbacksPerStep: MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP,
    fallbacks: [],
    decisionFingerprint: decisionFingerprint({
      registryVersion: request.registry.registryVersion,
      policyVersion: policy.version,
      constraints: request.constraints,
      selected: { providerId: best.providerId, modelId: best.modelId },
    }),
    correlationId: request.correlationId,
  };

  // Immutability of caller request: we never mutate request fields.
  return deepFreezeJson(structuredClone(success));
}

/** Redact a decision for logs/API — strips any accidental URL-like strings. */
export function redactMotionTransferRoutingDecision(
  decision: MotionTransferRoutingDecision,
): MotionTransferRoutingDecision {
  const raw = JSON.stringify(decision);
  const cleaned = sanitizePublicMessage(raw);
  // sanitize truncates — for structured redact, deep-walk messages only
  const clone = structuredClone(decision) as MotionTransferRoutingDecision;
  if (clone.status === "failed") {
    clone.failure.message = sanitizePublicMessage(clone.failure.message);
    for (const r of clone.failure.rejected) {
      for (const reason of r.reasons) {
        reason.message = sanitizePublicMessage(reason.message);
      }
    }
  } else {
    for (const r of clone.rejected) {
      for (const reason of r.reasons) {
        reason.message = sanitizePublicMessage(reason.message);
      }
    }
  }
  void cleaned;
  return deepFreezeJson(clone);
}
