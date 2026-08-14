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
import type { ImageTextOverlaySpec } from "@/domain/production/image-text-overlay";
import { fingerprintImageTextOverlaySpec } from "@/domain/production/image-text-overlay";
import { buildPhase11AImagePromptFromScenePackage } from "./phase-11a-image-prompt";
import { PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME } from "./phase-11a-deterministic-compositor";

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
  overlayFingerprint?: string;
  compositorRuntime: typeof PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME;
  humanReviewRequired: true;
  providerOutputs: 1;
  composedOutputs: 1;
  estimateUsd: number;
  estimateMinor: number;
  reservationMinor: number;
  stepCount: 1;
  fallbackCount: 0;
  retryCount: 0;
  downstreamCount: 0;
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
  overlay?: ImageTextOverlaySpec;
}): Phase11ASingleStepPlanBuild {
  const projectId = input.projectId ?? PHASE_11A_SMOKE_PROJECT_ID;
  const pkg = input.scenePackage;
  const overlayFingerprint = input.overlay
    ? fingerprintImageTextOverlaySpec(input.overlay)
    : undefined;

  const prompt = buildPhase11AImagePromptFromScenePackage(
    pkg,
    input.overlay ? { overlay: input.overlay } : undefined,
  );
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
      ...(overlayFingerprint
        ? [
            {
              kind: "package_block" as const,
              id: overlayFingerprint,
              role: "deterministic_overlay_fingerprint",
            },
          ]
        : []),
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

  const planIdSeed = createHash("sha256")
    .update(
      [
        projectId,
        input.storyboardRevisionId,
        pkg.id,
        prompt.promptHash,
        PHASE_11A_WIRE_VERSION,
      ].join("|"),
    )
    .digest("hex");
  /** Deterministic UUID so persist_generation_plan artifact id is valid. */
  const planId =
    input.planId ??
    `${planIdSeed.slice(0, 8)}-${planIdSeed.slice(8, 12)}-4${planIdSeed.slice(13, 16)}-8${planIdSeed.slice(17, 20)}-${planIdSeed.slice(20, 32)}`;

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
        ...(overlayFingerprint ? { overlayFingerprint } : {}),
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
      {
        code: "provider_no_text",
        message: "Provider payload is visual-only; overlay copy stays in compositor spec.",
      },
      {
        code: "local_compositor",
        message: "Deterministic overlay is a local derived output, not a second provider.",
      },
      {
        code: "human_review_required",
        message: "Human Review is mandatory before any activation.",
      },
    ],
  };

  return {
    plan,
    scenePackage,
    promptHash: prompt.promptHash,
    promptVersion: prompt.promptVersion,
    fingerprint,
    ...(overlayFingerprint ? { overlayFingerprint } : {}),
    compositorRuntime: PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
    humanReviewRequired: true,
    providerOutputs: 1,
    composedOutputs: 1,
    estimateUsd,
    estimateMinor,
    reservationMinor,
    stepCount: 1,
    fallbackCount: 0,
    retryCount: 0,
    downstreamCount: 0,
  };
}
