/**
 * Phase 11B — deterministic single-step I2V GenerationPlan.
 * Built and tested locally. Never persisted to Production in this phase.
 */
import { createHash } from "node:crypto";
import { fromLegacyUsdEstimate, money } from "@/domain/cost";
import type { ExistingMediaAssetReference } from "@/domain/generation/existing-media-asset-reference";
import {
  GENERATION_PLAN_ARTIFACT_TYPE,
  GENERATION_PLAN_SCHEMA_VERSION,
  type GenerationPlan,
  type GenerationStep,
  type SceneGenerationPlan,
} from "@/domain/routing/router";
import { buildPhase11BApprovedSourceReference } from "./phase-11b-existing-asset";
import {
  PHASE_11B_ACTION,
  PHASE_11B_ALLOWLIST_SCOPE,
  PHASE_11B_CAPABILITY,
  PHASE_11B_DURATION_SECONDS,
  PHASE_11B_MODEL,
  PHASE_11B_PROJECT_ID,
  PHASE_11B_PROVIDER,
  PHASE_11B_SCENE_ID,
  PHASE_11B_SCENE_ORDER,
  PHASE_11B_WIRE_VERSION,
  assertVhs11BFalI2vAllowlistScope,
  estimatePhase11BKlingI2vUsd,
  phase11BFutureBudgetCompare,
} from "./phase-11b-i2v-allowlist";

export const PHASE_11B_SINGLE_STEP_PLAN_STRATEGY = "image_to_video" as const;

export type Phase11BSingleStepPlanBuild = {
  plan: GenerationPlan;
  source: ExistingMediaAssetReference;
  fingerprint: string;
  estimateUsd: number;
  estimateMinor: number;
  reservationMinor: number;
  shortfallMinor: number;
  stepCount: 1;
  fallbackCount: 0;
  retryCount: 0;
  downstreamCount: 0;
  humanReviewRequired: true;
  persistedToProduction: false;
};

export function buildPhase11BSingleStepGenerationPlan(input: {
  storyboardRevisionId: string;
  scenePackageRevisionIds: string[];
  createdAt: string;
  createdBy: string;
  correlationId: string;
  planId?: string;
  source?: ExistingMediaAssetReference;
}): Phase11BSingleStepPlanBuild {
  const source = input.source ?? buildPhase11BApprovedSourceReference();
  const estimateUsd = estimatePhase11BKlingI2vUsd();
  const budget = phase11BFutureBudgetCompare();
  assertVhs11BFalI2vAllowlistScope({
    workspaceId: source.workspaceId,
    projectId: source.projectId,
    sceneId: PHASE_11B_SCENE_ID,
    action: PHASE_11B_ACTION,
    capabilityProfile: PHASE_11B_CAPABILITY,
    providerId: PHASE_11B_PROVIDER,
    modelId: PHASE_11B_MODEL,
    durationSeconds: PHASE_11B_DURATION_SECONDS,
    stepCount: 1,
    jobCount: 1,
    outputCount: 1,
  });

  const estimate = fromLegacyUsdEstimate({
    id: `est-11b-${source.provenanceFingerprint.slice(0, 12)}`,
    projectId: PHASE_11B_PROJECT_ID,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    sceneId: PHASE_11B_SCENE_ID,
    action: PHASE_11B_ACTION,
    modelId: PHASE_11B_MODEL,
    providerId: PHASE_11B_PROVIDER,
    quantity: PHASE_11B_DURATION_SECONDS,
    usd: estimateUsd,
    confidence: "high",
  });

  const step: GenerationStep = {
    id: "step:scene-2:video:kling-i2v",
    order: 1,
    action: PHASE_11B_ACTION,
    capabilityProfile: PHASE_11B_CAPABILITY,
    providerId: PHASE_11B_PROVIDER,
    modelId: PHASE_11B_MODEL,
    inputRefs: [
      {
        kind: "existing_asset",
        id: source.assetId,
        role: "i2v_start_frame",
      },
    ],
    dependsOnStepIds: [],
    expectedOutput: {
      mediaType: "video",
      aspectRatio: "1:1",
      durationSeconds: PHASE_11B_DURATION_SECONDS,
    },
    timeoutSeconds: 300,
    estimate,
    fallbacks: [],
    existingMediaAsset: source,
    selection: {
      selectedBecause: [
        {
          code: "only_candidate",
          message: "Phase 11B VHS-11B fal Kling I2V allowlist — single allowed model.",
        },
        {
          code: "within_budget",
          message: `Compare-only: estimate ${budget.klingEstimateMinor}¢ · reserve ${budget.klingReservationMinor}¢ · shortfall ${budget.klingShortfallMinor}¢.`,
        },
      ],
      rejectedAlternatives: [
        {
          providerId: "fal",
          modelId: "fal-ai/runway-gen3/turbo/image-to-video",
          reasonCodes: ["not_allowlisted"],
          message: "Same fal transport exists, but 11B allowlists Kling only.",
        },
        {
          providerId: "fal",
          modelId: "fal-ai/kling-video/v2/master/text-to-video",
          reasonCodes: ["capability_mismatch"],
          message: "T2V is out of 11B scope.",
        },
      ],
      score: {
        total: 1,
        cost: 1,
        missingDimensions: ["quality", "identity", "speed", "reliability"],
        contributions: [],
      },
      eligibilityEvidence: [PHASE_11B_ALLOWLIST_SCOPE.exceptionId],
      pricingEvidence: [`estimateVideo(${PHASE_11B_MODEL},${PHASE_11B_DURATION_SECONDS})=USD ${estimateUsd}`],
      unknowns: ["visual_qc_human_only", "future_hard_limit_raise"],
    },
  };

  const scenePlan: SceneGenerationPlan = {
    sceneId: PHASE_11B_SCENE_ID,
    sceneOrder: PHASE_11B_SCENE_ORDER,
    strategy: PHASE_11B_SINGLE_STEP_PLAN_STRATEGY,
    steps: [step],
    estimatedCost: money(budget.klingEstimateMinor, "USD"),
    estimatedDurationSeconds: PHASE_11B_DURATION_SECONDS,
    rationale: {
      strategyId: PHASE_11B_SINGLE_STEP_PLAN_STRATEGY,
      summary: "Phase 11B single-step video.image_to_video allowlist.",
      reasons: [
        { code: "strategy_fit", message: PHASE_11B_ALLOWLIST_SCOPE.exceptionId },
        { code: "only_candidate", message: "No fallback; voice/lipsync/merge omitted." },
      ],
    },
  };

  const planIdSeed = createHash("sha256")
    .update(
      [PHASE_11B_PROJECT_ID, input.storyboardRevisionId, source.provenanceFingerprint, PHASE_11B_WIRE_VERSION].join("|"),
    )
    .digest("hex");
  const planId =
    input.planId ??
    `${planIdSeed.slice(0, 8)}-${planIdSeed.slice(8, 12)}-4${planIdSeed.slice(13, 16)}-8${planIdSeed.slice(17, 20)}-${planIdSeed.slice(20, 32)}`;

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        v: PHASE_11B_WIRE_VERSION,
        projectId: PHASE_11B_PROJECT_ID,
        sceneId: PHASE_11B_SCENE_ID,
        model: PHASE_11B_MODEL,
        duration: PHASE_11B_DURATION_SECONDS,
        sourceFp: source.provenanceFingerprint,
        storyboardRevisionId: input.storyboardRevisionId,
      }),
    )
    .digest("hex");

  const plan: GenerationPlan = {
    id: planId,
    projectId: PHASE_11B_PROJECT_ID,
    schemaVersion: GENERATION_PLAN_SCHEMA_VERSION,
    revision: 1,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    artifactType: GENERATION_PLAN_ARTIFACT_TYPE,
    storyboardRevisionId: input.storyboardRevisionId,
    scenePackageRevisionIds: input.scenePackageRevisionIds,
    registryVersion: "phase-11b-i2v-allowlist-disabled",
    policyVersion: PHASE_11B_WIRE_VERSION,
    currency: "USD",
    scenePlans: [scenePlan],
    estimatedCost: money(budget.klingEstimateMinor, "USD"),
    estimatedDurationSeconds: PHASE_11B_DURATION_SECONDS,
    budgetDecision: {
      allowed: false,
      estimated: money(budget.klingEstimateMinor, "USD"),
      available: money(budget.availableMinor, "USD"),
      reason: "insufficient_funds",
    },
    rationale: {
      summary: "Phase 11B fal Kling I2V single-step allowlist plan (compare-only budget).",
      policyVersion: PHASE_11B_WIRE_VERSION,
      registryVersion: "phase-11b-i2v-allowlist-disabled",
      decisions: [
        {
          sceneId: PHASE_11B_SCENE_ID,
          strategyId: PHASE_11B_SINGLE_STEP_PLAN_STRATEGY,
          summary: "video.image_to_video fal Kling 5s from approved inactive still",
        },
      ],
    },
    warnings: [
      {
        code: "vhs11b_temporary_exception",
        message: "Does not declare global Production Registry real-provider compatibility.",
      },
      {
        code: "budget_compare_only",
        message: `Kling reserve ${budget.klingReservationMinor}¢ exceeds available ${budget.availableMinor}¢.`,
      },
      {
        code: "human_review_required",
        message: "Human Review is mandatory before any activation.",
      },
    ],
  };

  return {
    plan,
    source,
    fingerprint,
    estimateUsd,
    estimateMinor: budget.klingEstimateMinor,
    reservationMinor: budget.klingReservationMinor,
    shortfallMinor: budget.klingShortfallMinor,
    stepCount: 1,
    fallbackCount: 0,
    retryCount: 0,
    downstreamCount: 0,
    humanReviewRequired: true,
    persistedToProduction: false,
  };
}
