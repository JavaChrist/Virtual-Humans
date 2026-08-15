/**
 * Phase 11C — deterministic single-step Voice GenerationPlan.
 * Built and tested locally. Never persisted to Production in this phase.
 */
import { createHash } from "node:crypto";
import { fromLegacyUsdEstimate, money } from "@/domain/cost";
import type { ExistingVoiceReference } from "@/domain/generation/existing-voice-reference";
import {
  GENERATION_PLAN_ARTIFACT_TYPE,
  GENERATION_PLAN_SCHEMA_VERSION,
  type GenerationPlan,
  type GenerationStep,
  type SceneGenerationPlan,
} from "@/domain/routing/router";
import {
  PHASE_11B_I2V_GENERATION_PLAN_ID,
  PHASE_11B_I2V_GENERATION_PLAN_REVISION,
} from "./phase-11b-artifact-pointer-coherence";
import { PHASE_11B_LIVE_VIDEO_ASSET_ID } from "./phase-11b-i2v-attempt-terminal-state";
import {
  PHASE_11C_ACTION,
  PHASE_11C_ALLOWLIST_SCOPE,
  PHASE_11C_CAPABILITY,
  PHASE_11C_MODEL,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_PROVIDER,
  PHASE_11C_SCENE_ID,
  PHASE_11C_SCENE_ORDER,
  PHASE_11C_STRATEGY,
  PHASE_11C_STRATEGY_SLICE,
  PHASE_11C_WIRE_VERSION,
  PHASE_11C_WORKSPACE_ID,
  assertVhs11CVoiceAllowlistScope,
  estimatePhase11CVoiceCatalogue,
} from "./phase-11c-voice-allowlist";
import {
  fingerprintSpokenSegment,
  type CanonicalSpokenSegment,
} from "./phase-11c-spoken-segment";

export type Phase11CSingleStepPlanBuild = {
  plan: GenerationPlan;
  spokenSegment: CanonicalSpokenSegment;
  voice: ExistingVoiceReference;
  i2vContext: {
    generationPlanId: typeof PHASE_11B_I2V_GENERATION_PLAN_ID;
    generationPlanRevision: typeof PHASE_11B_I2V_GENERATION_PLAN_REVISION;
    videoAssetId: typeof PHASE_11B_LIVE_VIDEO_ASSET_ID;
    mediaRead: false;
    videoMutated: false;
  };
  fingerprint: string;
  estimateMinor: number;
  reservationMinor: number;
  pricingFirm: false;
  stepCount: 1;
  fallbackCount: 0;
  retryCount: 0;
  downstreamCount: 0;
  humanReviewRequired: true;
  persistedToProduction: false;
  planActive: false;
};

export function buildPhase11CSingleStepGenerationPlan(input: {
  spokenSegment: CanonicalSpokenSegment;
  voice: ExistingVoiceReference;
  createdAt: string;
  createdBy: string;
  correlationId: string;
  storyboardRevisionId: string;
  scenePackageRevisionIds: string[];
  planId?: string;
}): Phase11CSingleStepPlanBuild {
  const pricing = estimatePhase11CVoiceCatalogue(input.spokenSegment.characterCount);
  assertVhs11CVoiceAllowlistScope({
    workspaceId: input.spokenSegment.workspaceId,
    projectId: input.spokenSegment.projectId,
    sceneId: input.spokenSegment.sceneId,
    action: PHASE_11C_ACTION,
    capabilityProfile: PHASE_11C_CAPABILITY,
    providerId: PHASE_11C_PROVIDER,
    modelId: PHASE_11C_MODEL,
    language: input.spokenSegment.language,
    textChars: input.spokenSegment.characterCount,
    stepCount: 1,
    jobCount: 1,
    outputCount: 1,
    voiceMissing: false,
    consentInsufficient: input.voice.consentStatus !== "authorized",
  });

  const estimate = fromLegacyUsdEstimate({
    id: `est-11c-${input.spokenSegment.textSha256.slice(0, 12)}`,
    projectId: PHASE_11C_PROJECT_ID,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    sceneId: PHASE_11C_SCENE_ID,
    action: PHASE_11C_ACTION,
    modelId: PHASE_11C_MODEL,
    providerId: PHASE_11C_PROVIDER,
    quantity: input.spokenSegment.characterCount,
    usd: pricing.catalogueEstimateUsd,
    confidence: "unknown",
    assumptions: ["catalogue_only", "plan_unknown", "not_firm"],
  });

  const step: GenerationStep = {
    id: "step:scene-2:audio:elevenlabs-tts",
    order: 1,
    action: PHASE_11C_ACTION,
    capabilityProfile: PHASE_11C_CAPABILITY,
    providerId: PHASE_11C_PROVIDER,
    modelId: PHASE_11C_MODEL,
    inputRefs: [
      {
        kind: "scene_reference",
        id: input.spokenSegment.segmentId,
        role: "spoken_text",
      },
      {
        kind: "scene_reference",
        id: input.voice.narratorId ?? input.voice.characterId ?? "voice",
        role: "tts_voice",
      },
      {
        kind: "existing_asset",
        id: PHASE_11B_LIVE_VIDEO_ASSET_ID,
        role: "future_lipsync_context_only",
      },
    ],
    dependsOnStepIds: [],
    expectedOutput: {
      mediaType: "audio",
      durationSeconds: input.spokenSegment.estimatedDurationSeconds,
    },
    timeoutSeconds: 60,
    estimate,
    fallbacks: [],
    selection: {
      selectedBecause: [
        {
          code: "only_candidate",
          message: "Phase 11C ElevenLabs Voice allowlist — single allowed model.",
        },
        {
          code: "within_budget",
          message: `Compare-only catalogue: ${pricing.catalogueEstimateMinor}¢ · reserve ${pricing.reservationMinor}¢ · firm=false.`,
        },
      ],
      rejectedAlternatives: [
        {
          providerId: "fake",
          modelId: "universal-fake",
          reasonCodes: ["not_allowlisted"],
          message: "Universal fake is forbidden in Production.",
        },
        {
          providerId: "elevenlabs",
          modelId: "eleven_turbo_v2",
          reasonCodes: ["not_allowlisted"],
          message: "Only eleven_multilingual_v2 is allowlisted.",
        },
      ],
      score: {
        total: 1,
        cost: 1,
        missingDimensions: ["quality", "identity", "speed", "reliability"],
        contributions: [],
      },
      eligibilityEvidence: [PHASE_11C_ALLOWLIST_SCOPE.exceptionId],
      pricingEvidence: ["estimateVoice(catalogue 0.15 USD/1k) firm=false"],
      unknowns: ["plan_tier", "perceptual_qc_human_only", "narrator_voice_binding"],
    },
  };

  const scenePlan: SceneGenerationPlan = {
    sceneId: PHASE_11C_SCENE_ID,
    sceneOrder: PHASE_11C_SCENE_ORDER,
    strategy: PHASE_11C_STRATEGY,
    steps: [step],
    estimatedCost: money(pricing.catalogueEstimateMinor, "USD"),
    estimatedDurationSeconds: input.spokenSegment.estimatedDurationSeconds,
    rationale: {
      strategyId: PHASE_11C_STRATEGY,
      summary: "Phase 11C Voice-only single-step slice — no T2V, lipsync, or mux.",
      reasons: [
        { code: "strategy_fit", message: PHASE_11C_STRATEGY_SLICE },
        { code: "only_candidate", message: "No fallback; lipsync/merge omitted." },
      ],
    },
  };

  const spokenFp = fingerprintSpokenSegment(input.spokenSegment);
  const planIdSeed = createHash("sha256")
    .update(
      [PHASE_11C_PROJECT_ID, input.spokenSegment.textSha256, input.voice.provenanceFingerprint, PHASE_11C_WIRE_VERSION].join("|"),
    )
    .digest("hex");
  const planId =
    input.planId ??
    `${planIdSeed.slice(0, 8)}-${planIdSeed.slice(8, 12)}-4${planIdSeed.slice(13, 16)}-8${planIdSeed.slice(17, 20)}-${planIdSeed.slice(20, 32)}`;

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        v: PHASE_11C_WIRE_VERSION,
        projectId: PHASE_11C_PROJECT_ID,
        sceneId: PHASE_11C_SCENE_ID,
        model: PHASE_11C_MODEL,
        spokenFp,
        voiceFp: input.voice.provenanceFingerprint,
        i2vPlan: PHASE_11B_I2V_GENERATION_PLAN_ID,
        i2vVideo: PHASE_11B_LIVE_VIDEO_ASSET_ID,
        storyboardRevisionId: input.storyboardRevisionId,
      }),
    )
    .digest("hex");

  const plan: GenerationPlan = {
    id: planId,
    projectId: PHASE_11C_PROJECT_ID,
    schemaVersion: GENERATION_PLAN_SCHEMA_VERSION,
    revision: 1,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    artifactType: GENERATION_PLAN_ARTIFACT_TYPE,
    storyboardRevisionId: input.storyboardRevisionId,
    scenePackageRevisionIds: input.scenePackageRevisionIds,
    registryVersion: "phase-11c-voice-allowlist-disabled",
    policyVersion: PHASE_11C_WIRE_VERSION,
    currency: "USD",
    scenePlans: [scenePlan],
    estimatedCost: money(pricing.catalogueEstimateMinor, "USD"),
    estimatedDurationSeconds: input.spokenSegment.estimatedDurationSeconds,
    budgetDecision: {
      allowed: false,
      estimated: money(pricing.catalogueEstimateMinor, "USD"),
      available: money(pricing.availableMinor, "USD"),
      reason: "insufficient_funds",
    },
    rationale: {
      summary: "Phase 11C ElevenLabs Voice single-step allowlist plan (compare-only, pricing not firm).",
      policyVersion: PHASE_11C_WIRE_VERSION,
      registryVersion: "phase-11c-voice-allowlist-disabled",
      decisions: [
        {
          sceneId: PHASE_11C_SCENE_ID,
          strategyId: PHASE_11C_STRATEGY,
          summary: "audio.voice eleven_multilingual_v2 from explicit spoken segment",
        },
      ],
    },
    warnings: [
      {
        code: "vhs11c_temporary_exception",
        message: "Does not declare global Production Registry real-provider compatibility.",
      },
      {
        code: "pricing_not_firm",
        message: "Catalogue estimate only; ElevenLabs USD depends on the unknown live plan.",
      },
      {
        code: "budget_compare_only",
        message: "budgetDecision.allowed=false · reservationCreated=false.",
      },
      {
        code: "human_review_required",
        message: "Human Review is mandatory. APPROVE does not authorize lipsync.",
      },
    ],
  };

  return {
    plan,
    spokenSegment: input.spokenSegment,
    voice: input.voice,
    i2vContext: {
      generationPlanId: PHASE_11B_I2V_GENERATION_PLAN_ID,
      generationPlanRevision: PHASE_11B_I2V_GENERATION_PLAN_REVISION,
      videoAssetId: PHASE_11B_LIVE_VIDEO_ASSET_ID,
      mediaRead: false,
      videoMutated: false,
    },
    fingerprint,
    estimateMinor: pricing.catalogueEstimateMinor,
    reservationMinor: pricing.reservationMinor,
    pricingFirm: false,
    stepCount: 1,
    fallbackCount: 0,
    retryCount: 0,
    downstreamCount: 0,
    humanReviewRequired: true,
    persistedToProduction: false,
    planActive: false,
  };
}

export function buildPhase11CIdempotencyKey(input: {
  spokenSegment: CanonicalSpokenSegment;
  voice: ExistingVoiceReference;
}): string {
  return createHash("sha256")
    .update(
      [
        PHASE_11C_WORKSPACE_ID,
        PHASE_11C_PROJECT_ID,
        PHASE_11C_SCENE_ID,
        input.spokenSegment.scriptArtifactId,
        String(input.spokenSegment.scriptRevision),
        input.spokenSegment.segmentId,
        input.spokenSegment.textSha256,
        input.voice.provenanceFingerprint,
        PHASE_11C_MODEL,
        PHASE_11C_WIRE_VERSION,
      ].join("|"),
    )
    .digest("hex");
}
