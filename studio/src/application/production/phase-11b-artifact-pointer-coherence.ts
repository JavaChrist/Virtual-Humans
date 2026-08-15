/**
 * Phase 11B — artifact pointer coherence dry-run. Read-only. No pointer mutation.
 */
import {
  ARTIFACT_BUNDLE_COHERENCE_VERSION,
  evaluateArtifactBundleCoherence,
  evaluateMergeExportAuthorization,
  evaluateNaiveActivePointerSet,
  fingerprintCoherenceDecision,
  readMergeExportAuthorized,
  redactCoherenceError,
  selectExplicitArtifactBundle,
  type ArtifactBundle,
  type ArtifactBundleMember,
} from "./artifact-bundle-coherence";
import {
  PHASE_11B_LIVE_PROJECT_ID,
  PHASE_11B_LIVE_RUN_ID,
  PHASE_11B_LIVE_VIDEO_ASSET_ID,
  PHASE_11B_LIVE_WORKSPACE_ID,
} from "./phase-11b-i2v-attempt-terminal-state";
import { PHASE_11B_I2V_PARENT_ASSET_ID } from "./phase-11b-i2v-human-review-approve";

export const PHASE_11B_POINTER_COHERENCE_AUTH =
  "AUTH_11B_ARTIFACT_POINTER_COHERENCE_HARDENING" as const;

export const PHASE_11B_POINTER_COHERENCE_VERDICT =
  "ARTIFACT_POINTER_COHERENCE_HARDENED_NO_LIVE_MUTATION_REQUIRED" as const;

export const PHASE_11B_NEXT_VOICE_AUTH =
  "AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT" as const;

export const PHASE_11B_POINTER_STRATEGY = "C_explicit_run_plan_output" as const;

export const PHASE_11B_ACTIVE_GENERATION_PLAN_ID =
  "a55bd426-86ae-4594-850a-d5ddb58048ce" as const;
export const PHASE_11B_ACTIVE_GENERATION_PLAN_REVISION = 2 as const;
export const PHASE_11B_I2V_GENERATION_PLAN_ID =
  "3d1858eb-99d5-4327-a47b-f6011ff3247a" as const;
export const PHASE_11B_I2V_GENERATION_PLAN_REVISION = 3 as const;
export const PHASE_11B_ACTIVE_QUALITY_REPORT_ID =
  "0da85052-9aaf-4e81-a719-193d5e90547c" as const;
export const PHASE_11B_ACTIVE_QUALITY_REPORT_REVISION = 5 as const;
export const PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID =
  "fa5c42bd-760b-4db5-a180-fb4cc58d750e" as const;
export const PHASE_11B_ACTIVE_PRODUCTION_RESULT_REVISION = 10 as const;
export const PHASE_11B_I2V_PLAN_FINGERPRINT_PREFIX = "6e7199283c45e940" as const;
export const PHASE_11B_I2V_VIDEO_CHECKSUM_PREFIX = "e929f00a" as const;
export const PHASE_11B_I2V_HUMAN_REVIEW_ID_PREFIX = "301ee080" as const;
export const PHASE_11B_I2V_CAPABILITY = "video.image_to_video" as const;
export const PHASE_11A_IMAGE_CAPABILITY = "image.text_to_image" as const;

export type Phase11BPointerLiveFacts = {
  workspaceId: string;
  projectId: string;
  runId: string;
  activeGenerationPlanId: string;
  activeGenerationPlanRevision: number;
  persistedI2vGenerationPlanId: string;
  persistedI2vGenerationPlanRevision: number;
  activeQualityReportId: string;
  activeQualityReportRevision: number;
  activeProductionResultId: string;
  activeProductionResultRevision: number;
  sourceAssetId: string;
  outputAssetId: string;
  outputChecksumPrefix: string;
  outputLifecycle: string;
  outputActive: boolean;
  outputPublished: boolean;
  deliveryStatus: string;
  productionResultValue: unknown;
  humanReviewDecision: string;
  humanReviewAssetId: string;
  downstreamEnabled: boolean;
  stale: boolean;
  quarantined: boolean;
};

export type Phase11BPointerCoherencePlan = {
  auth: typeof PHASE_11B_POINTER_COHERENCE_AUTH;
  contractVersion: typeof ARTIFACT_BUNDLE_COHERENCE_VERSION;
  strategy: typeof PHASE_11B_POINTER_STRATEGY;
  activeGenerationPlan: { idPrefix: string; revision: number; phase: "11A" };
  persistedI2vGenerationPlan: { idPrefix: string; revision: number; active: false };
  activeQualityReport: { idPrefix: string; revision: number; phase: "11B" };
  activeProductionResult: { idPrefix: string; revision: number; phase: "11B" };
  pointerSetCoherent: boolean;
  explicitI2vBundleCoherent: boolean;
  explicit11AAccessPreserved: boolean;
  mergeExportAuthorized: boolean;
  mergeAllowed: boolean;
  exportAllowed: boolean;
  downstreamAllowed: boolean;
  mutationRequired: false;
  mutationAllowed: false;
  pointerWrites: 0;
  productionWrites: 0;
  providerCalls: 0;
  budgetWrites: 0;
  refuseCodes: string[];
  verdict: typeof PHASE_11B_POINTER_COHERENCE_VERDICT;
  nextAuth: typeof PHASE_11B_NEXT_VOICE_AUTH;
  fingerprint: string;
};

function prefix(id: string): string {
  return id.slice(0, 8);
}

function member(input: {
  workspaceId: string;
  projectId: string;
  artifactId: string;
  revision: number;
  artifactType: string;
  generationPlanId?: string;
  runId?: string;
  sourceAssetId?: string;
  outputAssetId?: string;
  capability?: string;
  planFingerprint?: string;
  checksum?: string;
}): ArtifactBundleMember {
  return {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    artifactId: input.artifactId,
    revision: input.revision,
    artifactType: input.artifactType,
    generationPlanId: input.generationPlanId ?? null,
    runId: input.runId ?? null,
    sourceAssetId: input.sourceAssetId ?? null,
    outputAssetId: input.outputAssetId ?? null,
    capability: input.capability ?? null,
    planFingerprint: input.planFingerprint ?? null,
    checksum: input.checksum ?? null,
    stale: false,
    quarantined: false,
  };
}

export function livePhase11BPointerFacts(
  overrides: Partial<Phase11BPointerLiveFacts> = {},
): Phase11BPointerLiveFacts {
  return {
    workspaceId: PHASE_11B_LIVE_WORKSPACE_ID,
    projectId: PHASE_11B_LIVE_PROJECT_ID,
    runId: PHASE_11B_LIVE_RUN_ID,
    activeGenerationPlanId: PHASE_11B_ACTIVE_GENERATION_PLAN_ID,
    activeGenerationPlanRevision: PHASE_11B_ACTIVE_GENERATION_PLAN_REVISION,
    persistedI2vGenerationPlanId: PHASE_11B_I2V_GENERATION_PLAN_ID,
    persistedI2vGenerationPlanRevision: PHASE_11B_I2V_GENERATION_PLAN_REVISION,
    activeQualityReportId: PHASE_11B_ACTIVE_QUALITY_REPORT_ID,
    activeQualityReportRevision: PHASE_11B_ACTIVE_QUALITY_REPORT_REVISION,
    activeProductionResultId: PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID,
    activeProductionResultRevision: PHASE_11B_ACTIVE_PRODUCTION_RESULT_REVISION,
    sourceAssetId: PHASE_11B_I2V_PARENT_ASSET_ID,
    outputAssetId: PHASE_11B_LIVE_VIDEO_ASSET_ID,
    outputChecksumPrefix: PHASE_11B_I2V_VIDEO_CHECKSUM_PREFIX,
    outputLifecycle: "approved",
    outputActive: false,
    outputPublished: false,
    deliveryStatus: "merge_ready",
    productionResultValue: {
      delivery: { status: "merge_ready" },
      phase11b: { mergeExportAuthorized: false, outputActive: false },
    },
    humanReviewDecision: "approved",
    humanReviewAssetId: PHASE_11B_LIVE_VIDEO_ASSET_ID,
    downstreamEnabled: false,
    stale: false,
    quarantined: false,
    ...overrides,
  };
}

export function buildPhase11BExplicitI2vBundle(facts: Phase11BPointerLiveFacts): ArtifactBundle {
  return {
    workspaceId: facts.workspaceId,
    projectId: facts.projectId,
    runId: facts.runId,
    generationPlanId: facts.persistedI2vGenerationPlanId,
    planFingerprint: PHASE_11B_I2V_PLAN_FINGERPRINT_PREFIX,
    sourceAssetId: facts.sourceAssetId,
    outputAssetId: facts.outputAssetId,
    capability: PHASE_11B_I2V_CAPABILITY,
    generationPlan: member({
      workspaceId: facts.workspaceId,
      projectId: facts.projectId,
      artifactId: facts.persistedI2vGenerationPlanId,
      revision: facts.persistedI2vGenerationPlanRevision,
      artifactType: "generation_plan",
      generationPlanId: facts.persistedI2vGenerationPlanId,
      sourceAssetId: facts.sourceAssetId,
      capability: PHASE_11B_I2V_CAPABILITY,
      planFingerprint: PHASE_11B_I2V_PLAN_FINGERPRINT_PREFIX,
    }),
    qualityReport: member({
      workspaceId: facts.workspaceId,
      projectId: facts.projectId,
      artifactId: facts.activeQualityReportId,
      revision: facts.activeQualityReportRevision,
      artifactType: "quality_report",
      generationPlanId: facts.persistedI2vGenerationPlanId,
      runId: facts.runId,
      outputAssetId: facts.outputAssetId,
      capability: PHASE_11B_I2V_CAPABILITY,
      checksum: facts.outputChecksumPrefix,
    }),
    productionResult: member({
      workspaceId: facts.workspaceId,
      projectId: facts.projectId,
      artifactId: facts.activeProductionResultId,
      revision: facts.activeProductionResultRevision,
      artifactType: "production_result",
      generationPlanId: facts.persistedI2vGenerationPlanId,
      runId: facts.runId,
      sourceAssetId: facts.sourceAssetId,
      outputAssetId: facts.outputAssetId,
      capability: PHASE_11B_I2V_CAPABILITY,
      checksum: facts.outputChecksumPrefix,
    }),
    humanReview: {
      decisionId: PHASE_11B_I2V_HUMAN_REVIEW_ID_PREFIX,
      decision: facts.humanReviewDecision,
      assetId: facts.humanReviewAssetId,
    },
    output: {
      assetId: facts.outputAssetId,
      checksum: facts.outputChecksumPrefix,
      lifecycle: facts.outputLifecycle,
      active: facts.outputActive,
      published: facts.outputPublished,
      stale: facts.stale,
      quarantined: facts.quarantined,
    },
  };
}

export function buildPhase11AExplicitImageBundle(facts: Phase11BPointerLiveFacts): ArtifactBundle {
  return {
    workspaceId: facts.workspaceId,
    projectId: facts.projectId,
    runId: "39329a01-image-11a",
    generationPlanId: facts.activeGenerationPlanId,
    sourceAssetId: facts.sourceAssetId,
    outputAssetId: facts.sourceAssetId,
    capability: PHASE_11A_IMAGE_CAPABILITY,
    generationPlan: member({
      workspaceId: facts.workspaceId,
      projectId: facts.projectId,
      artifactId: facts.activeGenerationPlanId,
      revision: facts.activeGenerationPlanRevision,
      artifactType: "generation_plan",
      generationPlanId: facts.activeGenerationPlanId,
      outputAssetId: facts.sourceAssetId,
      capability: PHASE_11A_IMAGE_CAPABILITY,
    }),
    qualityReport: member({
      workspaceId: facts.workspaceId,
      projectId: facts.projectId,
      artifactId: "81b7acb6-11a1-4aaa-8aaa-aaaaaaaaaaaa",
      revision: 1,
      artifactType: "quality_report",
      generationPlanId: facts.activeGenerationPlanId,
      outputAssetId: facts.sourceAssetId,
      capability: PHASE_11A_IMAGE_CAPABILITY,
    }),
    productionResult: member({
      workspaceId: facts.workspaceId,
      projectId: facts.projectId,
      artifactId: "0f2aa24e-11a1-4aaa-8aaa-aaaaaaaaaaaa",
      revision: 1,
      artifactType: "production_result",
      generationPlanId: facts.activeGenerationPlanId,
      outputAssetId: facts.sourceAssetId,
      capability: PHASE_11A_IMAGE_CAPABILITY,
    }),
    humanReview: {
      decisionId: "fb2f886c",
      decision: "approved",
      assetId: facts.sourceAssetId,
    },
    output: {
      assetId: facts.sourceAssetId,
      checksum: "9ac484b7",
      lifecycle: "approved",
      active: false,
      published: false,
    },
  };
}

export function planPhase11BArtifactPointerCoherence(
  facts: Phase11BPointerLiveFacts,
): Phase11BPointerCoherencePlan {
  const naive = evaluateNaiveActivePointerSet({
    workspaceId: facts.workspaceId,
    projectId: facts.projectId,
    activeGenerationPlan: member({
      workspaceId: facts.workspaceId,
      projectId: facts.projectId,
      artifactId: facts.activeGenerationPlanId,
      revision: facts.activeGenerationPlanRevision,
      artifactType: "generation_plan",
      generationPlanId: facts.activeGenerationPlanId,
      outputAssetId: facts.sourceAssetId,
      capability: PHASE_11A_IMAGE_CAPABILITY,
    }),
    activeQualityReport: member({
      workspaceId: facts.workspaceId,
      projectId: facts.projectId,
      artifactId: facts.activeQualityReportId,
      revision: facts.activeQualityReportRevision,
      artifactType: "quality_report",
      generationPlanId: facts.persistedI2vGenerationPlanId,
      outputAssetId: facts.outputAssetId,
      capability: PHASE_11B_I2V_CAPABILITY,
    }),
    activeProductionResult: member({
      workspaceId: facts.workspaceId,
      projectId: facts.projectId,
      artifactId: facts.activeProductionResultId,
      revision: facts.activeProductionResultRevision,
      artifactType: "production_result",
      generationPlanId: facts.persistedI2vGenerationPlanId,
      outputAssetId: facts.outputAssetId,
      capability: PHASE_11B_I2V_CAPABILITY,
    }),
  });

  const i2vBundle = buildPhase11BExplicitI2vBundle(facts);
  const imageBundle = buildPhase11AExplicitImageBundle(facts);
  const explicitI2v = evaluateArtifactBundleCoherence(i2vBundle);
  const explicit11A = evaluateArtifactBundleCoherence(imageBundle);
  const selected = selectExplicitArtifactBundle({
    candidates: [i2vBundle],
    selectedOutputAssetId: facts.outputAssetId,
    selectedRunId: facts.runId,
    selectedGenerationPlanId: facts.persistedI2vGenerationPlanId,
  });

  const mergeExportAuthorized = readMergeExportAuthorized(facts.productionResultValue);
  const authorization = evaluateMergeExportAuthorization({
    deliveryStatus: facts.deliveryStatus,
    mergeExportAuthorized,
    outputApproved: facts.outputLifecycle === "approved",
    outputSelected: true,
    outputActive: facts.outputActive,
    humanReviewApproved: facts.humanReviewDecision === "approved",
    stale: facts.stale,
    quarantined: facts.quarantined,
    bundleCoherent: explicitI2v.coherent && selected.ok,
    downstreamEnabled: facts.downstreamEnabled,
    requireActivation: false,
  });

  const refuseCodes = [
    ...naive.issues.map((item) => item.code),
    ...authorization.reasons,
  ].filter((code, index, all) => all.indexOf(code) === index);

  const plan: Omit<Phase11BPointerCoherencePlan, "fingerprint"> = {
    auth: PHASE_11B_POINTER_COHERENCE_AUTH,
    contractVersion: ARTIFACT_BUNDLE_COHERENCE_VERSION,
    strategy: PHASE_11B_POINTER_STRATEGY,
    activeGenerationPlan: {
      idPrefix: prefix(facts.activeGenerationPlanId),
      revision: facts.activeGenerationPlanRevision,
      phase: "11A",
    },
    persistedI2vGenerationPlan: {
      idPrefix: prefix(facts.persistedI2vGenerationPlanId),
      revision: facts.persistedI2vGenerationPlanRevision,
      active: false,
    },
    activeQualityReport: {
      idPrefix: prefix(facts.activeQualityReportId),
      revision: facts.activeQualityReportRevision,
      phase: "11B",
    },
    activeProductionResult: {
      idPrefix: prefix(facts.activeProductionResultId),
      revision: facts.activeProductionResultRevision,
      phase: "11B",
    },
    pointerSetCoherent: naive.coherent,
    explicitI2vBundleCoherent: explicitI2v.coherent && selected.ok,
    explicit11AAccessPreserved: explicit11A.coherent,
    mergeExportAuthorized,
    mergeAllowed: authorization.mergeAllowed,
    exportAllowed: authorization.exportAllowed,
    downstreamAllowed: authorization.downstreamAllowed,
    mutationRequired: false,
    mutationAllowed: false,
    pointerWrites: 0,
    productionWrites: 0,
    providerCalls: 0,
    budgetWrites: 0,
    refuseCodes: refuseCodes.map((code) => redactCoherenceError(code)),
    verdict: PHASE_11B_POINTER_COHERENCE_VERDICT,
    nextAuth: PHASE_11B_NEXT_VOICE_AUTH,
  };

  return {
    ...plan,
    fingerprint: fingerprintCoherenceDecision([
      plan.auth,
      plan.strategy,
      plan.activeGenerationPlan.idPrefix,
      String(plan.activeGenerationPlan.revision),
      plan.persistedI2vGenerationPlan.idPrefix,
      String(plan.persistedI2vGenerationPlan.revision),
      plan.activeQualityReport.idPrefix,
      String(plan.activeQualityReport.revision),
      plan.activeProductionResult.idPrefix,
      String(plan.activeProductionResult.revision),
      String(plan.pointerSetCoherent),
      String(plan.explicitI2vBundleCoherent),
      String(plan.mergeExportAuthorized),
      String(plan.mergeAllowed),
      String(plan.exportAllowed),
      String(plan.downstreamAllowed),
      String(plan.mutationRequired),
      String(plan.mutationAllowed),
      plan.verdict,
    ]),
  };
}

export function assertPhase11BPointerCoherenceNoSideEffects(plan: Phase11BPointerCoherencePlan): void {
  if (plan.mutationAllowed || plan.mutationRequired) {
    throw new Error("Phase 11B pointer coherence must not require or allow mutation.");
  }
  if (plan.pointerWrites !== 0 || plan.productionWrites !== 0 || plan.providerCalls !== 0 || plan.budgetWrites !== 0) {
    throw new Error("Phase 11B pointer coherence must remain zero-write.");
  }
  if (plan.mergeAllowed || plan.exportAllowed || plan.downstreamAllowed) {
    throw new Error("Phase 11B live pointers must not authorize merge, export, or downstream.");
  }
}
