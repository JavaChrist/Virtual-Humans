/**
 * Phase 11A — deterministic single-step GenerationPlan for scene-2 image.
 * Bypasses Router full-plan `text_motion` → no_eligible_strategy without
 * declaring global Registry real-provider compatibility.
 */

import { createHash } from "node:crypto";
import { fromLegacyUsdEstimate, money } from "@/domain/cost";
import type { ScenePackage, ScenePackageSet } from "@/domain/prompt";
import {
  GENERATION_PLAN_ARTIFACT_TYPE,
  GENERATION_PLAN_SCHEMA_VERSION,
  type GenerationPlan,
  type GenerationStep,
  type SceneGenerationPlan,
} from "@/domain/routing/router";
import { estimateImage } from "@/lib/pricing";
import {
  assertVhs124OpenAIImageAllowlistScope,
  PHASE_11A_ALLOWLIST_SCOPE,
  PHASE_11A_MAX_RESERVATION_MINOR,
  PHASE_11A_SMOKE_ACTION,
  PHASE_11A_SMOKE_CAPABILITY,
  PHASE_11A_SMOKE_MODEL,
  PHASE_11A_SMOKE_PROJECT_ID,
  PHASE_11A_SMOKE_PROVIDER,
  PHASE_11A_SMOKE_QUALITY,
  PHASE_11A_SMOKE_SCENE_ID,
  PHASE_11A_SMOKE_SCENE_ORDER,
  PHASE_11A_SMOKE_SIZE,
  PHASE_11A_WIRE_VERSION,
} from "./phase-11a-openai-image-allowlist";
import { buildPhase11AImagePromptFromScenePackage } from "./phase-11a-image-prompt";

/**
 * Reuses library id `product_demo` (has image.text_to_image) but emits
 * only the image step — video downstream stays OFF for the smoke.
 */
export const PHASE_11A_SINGLE_STEP_PLAN_STRATEGY = "product_demo" as const;

export type Phase11ASingleStepPlanBuild = {
  plan: GenerationPlan;
  scenePackage: ScenePackage;
  promptHash: string;
  promptVersion: string;
  fingerprint: string;
  estimateUsd: number;
  estimateMinor: number;
  reservationMinor: number;
  stepCount: 1;
  fallbackCount: 0;
};

function selectScene2Package(packages: readonly ScenePackage[]): ScenePackage {
  const byId = packages.find((p) => p.sceneId === PHASE_11A_SMOKE_SCENE_ID);
  if (byId) return byId;
  const byOrder = packages.find((p) => p.sceneOrder === PHASE_11A_SMOKE_SCENE_ORDER);
  if (byOrder) return byOrder;
  throw new Error("Phase 11A: scene-2 package absent from ScenePackageSet.");
}

export function selectPhase11AScene2Package(
  set: ScenePackageSet | { packages: readonly ScenePackage[] },
): ScenePackage {
  return selectScene2Package(set.packages);
}

export function buildPhase11ASingleStepGenerationPlan(input: {
  projectId?: string;
  storyboardRevisionId: string;
  scenePackageRevisionIds: string[];
  scenePackage: ScenePackage;
  createdAt: string;
  createdBy: string;
  correlationId: string;
  planId?: string;
  registryVersion?: string;
  policyVersion?: string;
  availableAfterMinor?: number;
  estimateUsd?: number;
}): Phase11ASingleStepPlanBuild {
  const projectId = input.projectId ?? PHASE_11A_SMOKE_PROJECT_ID;
  const pkg = input.scenePackage;

  const prompt = buildPhase11AImagePromptFromScenePackage(pkg);
  const estimateUsd =
    input.estimateUsd ?? estimateImage(PHASE_11A_SMOKE_SIZE, PHASE_11A_SMOKE_QUALITY, 1);
  const estimateMinor = Math.round(estimateUsd * 100);
  const reservationMinor = Math.min(
    PHASE_11A_MAX_RESERVATION_MINOR,
    Math.max(estimateMinor, 2),
  );

  assertVhs124OpenAIImageAllowlistScope({
    projectId,
    sceneId: pkg.sceneId === "sc-2" ? PHASE_11A_SMOKE_SCENE_ID : pkg.sceneId,
    action: PHASE_11A_SMOKE_ACTION,
    capabilityProfile: PHASE_11A_SMOKE_CAPABILITY,
    providerId: PHASE_11A_SMOKE_PROVIDER,
    modelId: PHASE_11A_SMOKE_MODEL,
    stepCount: 1,
    jobCount: 1,
    outputCount: 1,
    fallbackRequested: false,
    retryRequested: false,
    downstreamRequested: false,
    estimateMinor,
    motionFlagsOrAssetsReferenced: false,
    legacyEndpoint: false,
    fakeAdapterOnRealPath: false,
  });

  const estimate = fromLegacyUsdEstimate({
    id: `est-11a-${prompt.promptHash.slice(0, 12)}`,
    projectId,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    action: PHASE_11A_SMOKE_ACTION,
    modelId: PHASE_11A_SMOKE_MODEL,
    providerId: PHASE_11A_SMOKE_PROVIDER,
    quantity: 1,
    usd: estimateUsd,
    confidence: "high",
  });

  const step: GenerationStep = {
    id: "step:scene-2:image:gpt-image-1",
    order: 1,
    action: PHASE_11A_SMOKE_ACTION,
    capabilityProfile: PHASE_11A_SMOKE_CAPABILITY,
    providerId: PHASE_11A_SMOKE_PROVIDER,
    modelId: PHASE_11A_SMOKE_MODEL,
    promptVariantId: prompt.variantId,
    inputRefs: [
      {
        kind: "package_block",
        id: pkg.id,
        role: "scene_package",
      },
    ],
    dependsOnStepIds: [],
    expectedOutput: {
      mediaType: "image",
      aspectRatio: "1:1",
    },
    timeoutSeconds: 120,
    estimate,
    fallbacks: [],
    selection: {
      selectedBecause: [
        {
          code: "only_candidate",
          message: "Phase 11A VHS-124 OpenAI image allowlist — single allowed model.",
        },
        {
          code: "within_budget",
          message: `Estimate ${estimateMinor}¢ within max reservation ${PHASE_11A_MAX_RESERVATION_MINOR}¢.`,
        },
      ],
      rejectedAlternatives: [],
      score: {
        total: 1,
        cost: 1,
        missingDimensions: ["quality", "identity", "speed", "reliability"],
        contributions: [],
      },
      eligibilityEvidence: [PHASE_11A_ALLOWLIST_SCOPE.exceptionId],
      pricingEvidence: [`estimateImage(${PHASE_11A_SMOKE_SIZE},${PHASE_11A_SMOKE_QUALITY})=USD ${estimateUsd}`],
      unknowns: ["visual_qc_human_only"],
    },
  };

  const scenePlan: SceneGenerationPlan = {
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    sceneOrder: PHASE_11A_SMOKE_SCENE_ORDER,
    strategy: PHASE_11A_SINGLE_STEP_PLAN_STRATEGY,
    steps: [step],
    estimatedCost: money(estimateMinor, "USD"),
    estimatedDurationSeconds: 30,
    rationale: {
      strategyId: PHASE_11A_SINGLE_STEP_PLAN_STRATEGY,
      summary: "Phase 11A single-step image.text_to_image allowlist.",
      reasons: [
        {
          code: "strategy_fit",
          message: PHASE_11A_ALLOWLIST_SCOPE.exceptionId,
        },
        {
          code: "only_candidate",
          message: "No fallback; downstream video step omitted.",
        },
      ],
    },
  };

  const planId =
    input.planId ??
    `plan-11a-${createHash("sha256")
      .update(
        [
          projectId,
          input.storyboardRevisionId,
          pkg.id,
          prompt.promptHash,
          PHASE_11A_WIRE_VERSION,
        ].join("|"),
      )
      .digest("hex")
      .slice(0, 32)}`;

  // Normalize scene id on package copy for Production matching (memory-only build).
  const scenePackage: ScenePackage = {
    ...pkg,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    sceneOrder: PHASE_11A_SMOKE_SCENE_ORDER,
    productionIntent: "text_motion",
  };

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        v: PHASE_11A_WIRE_VERSION,
        projectId,
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
        model: PHASE_11A_SMOKE_MODEL,
        quality: PHASE_11A_SMOKE_QUALITY,
        size: PHASE_11A_SMOKE_SIZE,
        promptHash: prompt.promptHash,
        storyboardRevisionId: input.storyboardRevisionId,
        packageId: pkg.id,
      }),
    )
    .digest("hex");

  const availableAfter = money(input.availableAfterMinor ?? 27, "USD");

  const plan: GenerationPlan = {
    id: planId,
    projectId,
    schemaVersion: GENERATION_PLAN_SCHEMA_VERSION,
    revision: 1,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    artifactType: GENERATION_PLAN_ARTIFACT_TYPE,
    storyboardRevisionId: input.storyboardRevisionId,
    scenePackageRevisionIds: input.scenePackageRevisionIds,
    registryVersion: input.registryVersion ?? "phase-11a-allowlist-registry",
    policyVersion: input.policyVersion ?? PHASE_11A_WIRE_VERSION,
    currency: "USD",
    scenePlans: [scenePlan],
    estimatedCost: money(estimateMinor, "USD"),
    estimatedDurationSeconds: 30,
    budgetDecision:
      estimateMinor <= PHASE_11A_MAX_RESERVATION_MINOR
        ? {
            allowed: true as const,
            estimated: money(estimateMinor, "USD"),
            availableAfter,
          }
        : {
            allowed: false as const,
            estimated: money(estimateMinor, "USD"),
            available: availableAfter,
            reason: "insufficient_funds",
          },
    rationale: {
      summary: "Phase 11A OpenAI image single-step allowlist plan.",
      policyVersion: input.policyVersion ?? PHASE_11A_WIRE_VERSION,
      registryVersion: input.registryVersion ?? "phase-11a-allowlist-registry",
      decisions: [
        {
          sceneId: PHASE_11A_SMOKE_SCENE_ID,
          strategyId: PHASE_11A_SINGLE_STEP_PLAN_STRATEGY,
          summary: "image.text_to_image gpt-image-1 low 1024",
        },
      ],
    },
    warnings: [
      {
        code: "vhs124_temporary_exception",
        message:
          "Does not declare global Production Registry real-provider compatibility.",
      },
    ],
  };

  return {
    plan,
    scenePackage,
    promptHash: prompt.promptHash,
    promptVersion: prompt.promptVersion,
    fingerprint,
    estimateUsd,
    estimateMinor,
    reservationMinor,
    stepCount: 1,
    fallbackCount: 0,
  };
}
