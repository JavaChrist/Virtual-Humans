/**
 * Phase 11B — live preflight compare-only. No provider, no signed URL, no media, no write.
 */
import type { ExistingMediaAssetFacts } from "@/domain/generation/existing-media-asset-reference";
import {
  PHASE_11B_CAPABILITY,
  PHASE_11B_DURATION_SECONDS,
  PHASE_11B_LIVE_BUDGET,
  PHASE_11B_MODEL,
  PHASE_11B_PROVIDER,
  PHASE_11B_SOURCE_ASSET_ID,
  PHASE_11B_SOURCE_CHECKSUM,
  PHASE_11B_SOURCE_HR_DECISION_PREFIX,
  assertPhase11BDoesNotCallOpenAIImage,
  assertPhase11BI2vFlagsRemainOff,
  phase11BFutureBudgetCompare,
  phase11BI2vFlagsAuditView,
  phase11BI2vWiringDryRun,
} from "./phase-11b-i2v-allowlist";
import {
  assertPhase11BSourceReferenceReady,
  buildPhase11BApprovedSourceReference,
  phase11BComposedStoragePath,
} from "./phase-11b-existing-asset";
import { buildPhase11BSingleStepGenerationPlan } from "./phase-11b-single-step-plan";
import {
  assertPhase11BMayCreateSignedUrl,
  phase11BResolverMustStayUnsigned,
  resolvePhase11BExistingAssetToInternalInput,
} from "./phase-11b-i2v-resolver";

export const PHASE_11B_LIVE_PREFLIGHT_AUTH =
  "AUTH_11B_I2V_LIVE_PREFLIGHT_NO_PROVIDER" as const;

export const PHASE_11B_LIVE_PREFLIGHT_VERSION = "phase-11b-i2v-live-preflight-1.0.0" as const;

export const PHASE_11B_VERIFIED_LIVE_METADATA: ExistingMediaAssetFacts = {
  workspaceId: "3c308f57-f448-40ba-aaca-bc0d8d546d01",
  projectId: "984507af-a89e-4644-8ea3-344797baa974",
  assetId: PHASE_11B_SOURCE_ASSET_ID,
  checksum: PHASE_11B_SOURCE_CHECKSUM,
  mimeType: "image/png",
  width: 1024,
  height: 1024,
  lifecycle: "approved",
  sourceKind: "internal",
  storagePath: phase11BComposedStoragePath(),
  bucketPrivate: true,
  active: false,
  humanReviewDecision: "approved",
};

export type Phase11BLivePreflightInput = {
  liveFacts?: ExistingMediaAssetFacts;
  liveBudget?: {
    hard: number;
    committed: number;
    reserved: number;
    available: number;
  };
  flags?: Record<string, string | undefined>;
  providerMode?: "disabled";
  createdAt?: string;
  createdBy?: string;
  correlationId?: string;
  storyboardRevisionId?: string;
  scenePackageRevisionIds?: string[];
};

export type Phase11BLivePreflightResult = {
  auth: typeof PHASE_11B_LIVE_PREFLIGHT_AUTH;
  version: typeof PHASE_11B_LIVE_PREFLIGHT_VERSION;
  providerCalled: false;
  signedUrlCount: 0;
  mediaReads: 0;
  productionWrites: 0;
  budgetWrites: 0;
  reservationsCreated: 0;
  runsCreated: 0;
  jobsCreated: 0;
  persistedPlan: false;
  activationRequested: false;
  providerMode: "disabled";
  capability: typeof PHASE_11B_CAPABILITY;
  provider: typeof PHASE_11B_PROVIDER;
  model: typeof PHASE_11B_MODEL;
  durationSeconds: typeof PHASE_11B_DURATION_SECONDS;
  budgetDecisionAllowed: false;
  budgetDecisionReason: "insufficient_funds";
  estimateMinor: number;
  reservationMinor: number;
  shortfallMinor: number;
  availableMinor: number;
  fingerprint: string;
  sourceAssetId: typeof PHASE_11B_SOURCE_ASSET_ID;
  sourceActive: false;
  humanReviewDecisionPrefix: typeof PHASE_11B_SOURCE_HR_DECISION_PREFIX;
};

const PLAN_DEFAULTS = {
  storyboardRevisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  scenePackageRevisionIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  createdAt: "2026-08-14T20:50:00.000Z",
  createdBy: "00000000-0000-4000-8000-000000000001",
  correlationId: "11b-i2v-live-preflight-no-provider",
} as const;

export function assertPhase11BLiveSignConditionsUnmet(): void {
  assertPhase11BMayCreateSignedUrl({
    reserved: false,
    immediatelyBeforeSubmit: false,
    authorized: false,
  });
}

export function runPhase11BI2vLivePreflightNoProvider(
  input: Phase11BLivePreflightInput = {},
): Phase11BLivePreflightResult {
  if ((input.providerMode ?? "disabled") !== "disabled") {
    throw new Error("Phase 11B live preflight: providerMode must stay disabled.");
  }
  const flags = input.flags ?? {};
  assertPhase11BI2vFlagsRemainOff(flags);
  assertPhase11BDoesNotCallOpenAIImage(0);
  phase11BI2vWiringDryRun();
  const facts = input.liveFacts ?? PHASE_11B_VERIFIED_LIVE_METADATA;
  const source = buildPhase11BApprovedSourceReference({
    humanReviewDecisionId: `${PHASE_11B_SOURCE_HR_DECISION_PREFIX}-live-metadata`,
  });
  assertPhase11BSourceReferenceReady(source, facts);
  const resolved = resolvePhase11BExistingAssetToInternalInput(source, facts);
  if (resolved.asset.access.kind !== "internal") {
    throw new Error("Phase 11B live preflight: resolver must stay internal.");
  }
  const store = { signedUrlCount: 0, mediaReads: 0, persistedPayloads: [] as unknown[] };
  phase11BResolverMustStayUnsigned(store, { access: resolved.asset.access });
  try {
    assertPhase11BLiveSignConditionsUnmet();
    throw new Error("Phase 11B live preflight: unsigned gate must fail-closed.");
  } catch (err) {
    if (!(err instanceof Error) || !/forbidden/i.test(err.message)) {
      throw err;
    }
  }

  const built = buildPhase11BSingleStepGenerationPlan({
    storyboardRevisionId: input.storyboardRevisionId ?? PLAN_DEFAULTS.storyboardRevisionId,
    scenePackageRevisionIds: input.scenePackageRevisionIds ?? [...PLAN_DEFAULTS.scenePackageRevisionIds],
    createdAt: input.createdAt ?? PLAN_DEFAULTS.createdAt,
    createdBy: input.createdBy ?? PLAN_DEFAULTS.createdBy,
    correlationId: input.correlationId ?? PLAN_DEFAULTS.correlationId,
    source,
  });
  if (built.persistedToProduction) {
    throw new Error("Phase 11B live preflight must not persist a plan.");
  }
  if (built.plan.budgetDecision.allowed !== false) {
    throw new Error("Phase 11B live preflight must remain compare-only.");
  }
  const liveBudget = input.liveBudget ?? PHASE_11B_LIVE_BUDGET;
  const compare = phase11BFutureBudgetCompare({ availableMinor: liveBudget.available });
  if (compare.klingShortfallMinor <= 0) {
    throw new Error("Phase 11B live preflight expected a Kling shortfall.");
  }
  const flagView = phase11BI2vFlagsAuditView(flags);
  if (flagView.paid || flagView.provider || flagView.exception || flagView.worker) {
    throw new Error("Phase 11B live preflight: I2V flags must stay OFF.");
  }

  return {
    auth: PHASE_11B_LIVE_PREFLIGHT_AUTH,
    version: PHASE_11B_LIVE_PREFLIGHT_VERSION,
    providerCalled: false,
    signedUrlCount: 0,
    mediaReads: 0,
    productionWrites: 0,
    budgetWrites: 0,
    reservationsCreated: 0,
    runsCreated: 0,
    jobsCreated: 0,
    persistedPlan: false,
    activationRequested: false,
    providerMode: "disabled",
    capability: PHASE_11B_CAPABILITY,
    provider: PHASE_11B_PROVIDER,
    model: PHASE_11B_MODEL,
    durationSeconds: PHASE_11B_DURATION_SECONDS,
    budgetDecisionAllowed: false,
    budgetDecisionReason: "insufficient_funds",
    estimateMinor: compare.klingEstimateMinor,
    reservationMinor: compare.klingReservationMinor,
    shortfallMinor: compare.klingShortfallMinor,
    availableMinor: liveBudget.available,
    fingerprint: built.fingerprint,
    sourceAssetId: PHASE_11B_SOURCE_ASSET_ID,
    sourceActive: false,
    humanReviewDecisionPrefix: PHASE_11B_SOURCE_HR_DECISION_PREFIX,
  };
}

export function replayPhase11BI2vLivePreflightNoProvider(
  input: Phase11BLivePreflightInput = {},
): { first: Phase11BLivePreflightResult; second: Phase11BLivePreflightResult; stable: true } {
  const first = runPhase11BI2vLivePreflightNoProvider(input);
  const second = runPhase11BI2vLivePreflightNoProvider(input);
  if (first.fingerprint !== second.fingerprint) {
    throw new Error("Phase 11B live preflight fingerprint must be stable.");
  }
  if (second.providerCalled || second.signedUrlCount !== 0 || second.mediaReads !== 0) {
    throw new Error("Phase 11B live preflight replay must stay side-effect free.");
  }
  return { first, second, stable: true };
}
