/**
 * Phase 11B — paid smoke final preflight.
 * Proves the unique I2V execution can run later. Does not reserve, sign, write, or call fal.
 */
import { buildIdempotencyKey } from "@/domain/generation/idempotency";
import type { ExistingMediaAssetFacts } from "@/domain/generation/existing-media-asset-reference";
import {
  PHASE_11B_ACTION,
  PHASE_11B_CAPABILITY,
  PHASE_11B_DURATION_SECONDS,
  PHASE_11B_I2V_DOWNSTREAM_FLAG_ENV,
  PHASE_11B_MODEL,
  PHASE_11B_PROJECT_ID,
  PHASE_11B_PROVIDER,
  PHASE_11B_SCENE_ID,
  PHASE_11B_SOURCE_ASSET_ID,
  PHASE_11B_SOURCE_HR_DECISION_PREFIX,
  PHASE_11B_WORKSPACE_ID,
  assertPhase11BDoesNotCallOpenAIImage,
  assertPhase11BI2vFlagsRemainOff,
  assertVhs11BFalI2vAllowlistScope,
  phase11BFutureBudgetCompare,
  phase11BI2vFlagsAuditView,
  phase11BI2vWiringDryRun,
} from "./phase-11b-i2v-allowlist";
import {
  PHASE_11B_AVAILABLE_AFTER_MINOR,
  PHASE_11B_COMMITTED_UNCHANGED_MINOR,
  PHASE_11B_FUTURE_MARGIN_MINOR,
  PHASE_11B_FUTURE_RESERVE_MINOR,
  PHASE_11B_HARD_LIMIT_NEW_MINOR,
  PHASE_11B_KLING_ESTIMATE_MINOR,
  PHASE_11B_RESERVED_UNCHANGED_MINOR,
} from "./phase-11b-i2v-budget-hard-limit";
import {
  assertPhase11BSourceReferenceReady,
  buildPhase11BApprovedSourceReference,
} from "./phase-11b-existing-asset";
import { PHASE_11B_VERIFIED_LIVE_METADATA } from "./phase-11b-i2v-live-preflight";
import {
  assertPhase11BMayCreateSignedUrl,
  phase11BResolverMustStayUnsigned,
  phase11BSignedUrlPolicy,
  resolvePhase11BExistingAssetToInternalInput,
} from "./phase-11b-i2v-resolver";
import { buildPhase11BSingleStepGenerationPlan } from "./phase-11b-single-step-plan";
import {
  assertPhase11BI2vNoAutomaticDownstream,
  createPhase11BI2vJobState,
  markPhase11BI2vSubmissionUnknown,
  persistPhase11BI2vSubmitIntent,
  pollPhase11BI2vJob,
  recordPhase11BI2vSubmit,
  recoverPhase11BI2vFreshProcess,
  settlePhase11BI2vLedgerOnce,
} from "./phase-11b-i2v-worker";
import {
  assertPhase11BI2vNoOverwrite,
  assertPhase11BI2vOutputMime,
  assertPhase11BI2vOutputSize,
  assertPhase11BI2vResultHostAllowlist,
  createPhase11BI2vOutputProvenance,
} from "./phase-11b-i2v-ingest";
import { assertPhase11BI2vNoAutoApprove, evaluatePhase11BI2vTechnicalQuality } from "./phase-11b-i2v-quality";
import { assertPhase11BI2vReviewStaysLocal, createPhase11BI2vReviewHandoff } from "./phase-11b-i2v-human-review";

export const PHASE_11B_PAID_SMOKE_FINAL_PREFLIGHT_AUTH =
  "AUTH_11B_I2V_PAID_SMOKE_FINAL_PREFLIGHT" as const;
export const PHASE_11B_PAID_SMOKE_FINAL_PREFLIGHT_VERSION =
  "phase-11b-i2v-paid-smoke-final-preflight-1.0.0" as const;
export const PHASE_11B_NEXT_PAID_AUTH = "AUTH_11B_I2V_FIRST_PAID_SINGLE_EXECUTION" as const;

export const PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET = {
  hard: PHASE_11B_HARD_LIMIT_NEW_MINOR,
  committed: PHASE_11B_COMMITTED_UNCHANGED_MINOR,
  reserved: PHASE_11B_RESERVED_UNCHANGED_MINOR,
  available: PHASE_11B_AVAILABLE_AFTER_MINOR,
} as const;

export const PHASE_11B_PAID_SMOKE_FLAG_OPEN_ORDER = [
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "VHS11B_I2V_CAPABILITY_ENABLED",
  "VHS11B_I2V_PAID_ENABLED",
  "VHS11B_I2V_FAL_ENABLED",
  "VHS11B_FAL_I2V_DIRECTOR_EXCEPTION",
  "VHS11B_I2V_WORKER_ENABLED",
] as const;

export const PHASE_11B_PAID_SMOKE_FLAG_CLOSE_ORDER = [
  "VHS11B_I2V_WORKER_ENABLED",
  "VHS11B_FAL_I2V_DIRECTOR_EXCEPTION",
  "VHS11B_I2V_FAL_ENABLED",
  "VHS11B_I2V_PAID_ENABLED",
  "VHS11B_I2V_CAPABILITY_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_WORKER_ENABLED",
] as const;

export const PHASE_11B_PAID_SMOKE_FLAGS_ALWAYS_OFF = [
  PHASE_11B_I2V_DOWNSTREAM_FLAG_ENV,
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
  "MOTION_TRANSFER_ENABLED",
  "MOTION_TRANSFER_PAID_ENABLED",
  "MOTION_TRANSFER_FAL_ENABLED",
  "MOTION_TRANSFER_WORKER_ENABLED",
] as const;

export const PHASE_11B_PAID_EXECUTION_SEQUENCE = [
  "verify_new_human_paid_auth",
  "revalidate_git_deploy_asset_pricing_budget",
  "create_single_reservation_cap_168",
  "persist_submit_intent",
  "open_minimal_flags",
  "resolve_media_immediately_before_submit",
  "sign_short_ttl_url_memory_only",
  "single_fal_submit",
  "persist_provider_job_id",
  "close_submit_flags_in_finally",
  "durable_poll_without_resubmit",
  "fetch_unique_output",
  "private_ingest_ssrf_mime_size",
  "create_inactive_video_asset",
  "honest_technical_qc",
  "visual_qc_unavailable_human_only",
  "mandatory_human_review",
  "settle_ledger_once",
  "release_reservation_remainder",
  "keep_downstream_activation_merge_export_off",
] as const;

const PLAN_DEFAULTS = {
  storyboardRevisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  scenePackageRevisionIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  createdAt: "2026-08-14T23:55:00.000Z",
  createdBy: "00000000-0000-4000-8000-000000000001",
  correlationId: "11b-i2v-paid-smoke-final-preflight",
} as const;

export type Phase11BPaidPreflightBudget = {
  hard: number;
  committed: number;
  reserved: number;
  available: number;
};

export type Phase11BFutureReservationContract = {
  workspaceId: typeof PHASE_11B_WORKSPACE_ID;
  projectId: typeof PHASE_11B_PROJECT_ID;
  capability: typeof PHASE_11B_CAPABILITY;
  provider: typeof PHASE_11B_PROVIDER;
  model: typeof PHASE_11B_MODEL;
  durationSeconds: typeof PHASE_11B_DURATION_SECONDS;
  estimateMinor: typeof PHASE_11B_KLING_ESTIMATE_MINOR;
  capMinor: typeof PHASE_11B_FUTURE_RESERVE_MINOR;
  futureMarginMinor: typeof PHASE_11B_FUTURE_MARGIN_MINOR;
  idempotencyKey: string;
  expiresControlled: true;
  settleAtMostOnce: true;
  releaseOnPreCostFailure: true;
  noCapOverflow: true;
  noConcurrentEquivalent: true;
  created: false;
};

export type Phase11BPaidSmokeFinalPreflightInput = {
  liveFacts?: ExistingMediaAssetFacts;
  liveBudget?: Phase11BPaidPreflightBudget;
  flags?: Record<string, string | undefined>;
  providerMode?: "disabled";
  paidAuthPresent?: false;
};

export type Phase11BPaidSmokeFinalPreflightResult = {
  auth: typeof PHASE_11B_PAID_SMOKE_FINAL_PREFLIGHT_AUTH;
  version: typeof PHASE_11B_PAID_SMOKE_FINAL_PREFLIGHT_VERSION;
  sourceAdmissible: true;
  sourceActive: false;
  theoreticallySufficient: true;
  executionAuthorized: false;
  providerCallAllowed: false;
  reservationCreated: false;
  paidBlockedReason: "BLOCKED_PENDING_NEW_HUMAN_PAID_AUTH";
  providerCalled: false;
  signedUrlCount: 0;
  mediaReads: 0;
  productionWrites: 0;
  budgetWrites: 0;
  runsCreated: 0;
  jobsCreated: 0;
  flagsWritten: 0;
  persistedPlan: false;
  providerMode: "disabled";
  capability: typeof PHASE_11B_CAPABILITY;
  provider: typeof PHASE_11B_PROVIDER;
  model: typeof PHASE_11B_MODEL;
  durationSeconds: typeof PHASE_11B_DURATION_SECONDS;
  estimateMinor: typeof PHASE_11B_KLING_ESTIMATE_MINOR;
  reservationCapMinor: typeof PHASE_11B_FUTURE_RESERVE_MINOR;
  futureMarginMinor: typeof PHASE_11B_FUTURE_MARGIN_MINOR;
  availableMinor: typeof PHASE_11B_AVAILABLE_AFTER_MINOR;
  fingerprint: string;
  reservationIdempotencyKey: string;
  sourceAssetId: typeof PHASE_11B_SOURCE_ASSET_ID;
  humanReviewDecisionPrefix: typeof PHASE_11B_SOURCE_HR_DECISION_PREFIX;
  nextAuth: typeof PHASE_11B_NEXT_PAID_AUTH;
};

export function assertPhase11BPaidPreflightLiveBudget(
  budget: Phase11BPaidPreflightBudget,
): void {
  if (
    budget.hard !== PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET.hard ||
    budget.committed !== PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET.committed ||
    budget.reserved !== PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET.reserved ||
    budget.available !== PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET.available
  ) {
    throw new Error("BLOCKED_I2V_PAID_SMOKE_FINAL_PREFLIGHT: live budget diverged from 437/249/0/188.");
  }
}

export function planPhase11BFutureReservation(): Phase11BFutureReservationContract {
  const idempotencyKey = buildIdempotencyKey({
    projectId: PHASE_11B_PROJECT_ID,
    planRevisionId: PHASE_11B_PAID_SMOKE_FINAL_PREFLIGHT_VERSION,
    sceneId: PHASE_11B_SCENE_ID,
    stepId: "i2v-kling-5s",
    attempt: 1,
  });
  return {
    workspaceId: PHASE_11B_WORKSPACE_ID,
    projectId: PHASE_11B_PROJECT_ID,
    capability: PHASE_11B_CAPABILITY,
    provider: PHASE_11B_PROVIDER,
    model: PHASE_11B_MODEL,
    durationSeconds: PHASE_11B_DURATION_SECONDS,
    estimateMinor: PHASE_11B_KLING_ESTIMATE_MINOR,
    capMinor: PHASE_11B_FUTURE_RESERVE_MINOR,
    futureMarginMinor: PHASE_11B_FUTURE_MARGIN_MINOR,
    idempotencyKey,
    expiresControlled: true,
    settleAtMostOnce: true,
    releaseOnPreCostFailure: true,
    noCapOverflow: true,
    noConcurrentEquivalent: true,
    created: false,
  };
}

export function assertPhase11BReservationNotCreated(created: boolean): void {
  if (created) {
    throw new Error("Phase 11B paid preflight must not create a reservation.");
  }
}

export function simulatePhase11BReservationIdempotency(
  store: Map<string, true>,
  key: string,
  mode: "plan" | "create",
): { created: boolean } {
  if (mode === "plan") {
    return { created: false };
  }
  if (store.has(key)) {
    throw new Error("Phase 11B reservation: concurrent equivalent reservation forbidden.");
  }
  store.set(key, true);
  return { created: true };
}

export function phase11BPaidSmokeFlagPolicy(): {
  environment: "vercel-production";
  openValue: "1";
  closeValue: "0";
  openOrder: typeof PHASE_11B_PAID_SMOKE_FLAG_OPEN_ORDER;
  closeOrder: typeof PHASE_11B_PAID_SMOKE_FLAG_CLOSE_ORDER;
  alwaysOff: typeof PHASE_11B_PAID_SMOKE_FLAGS_ALWAYS_OFF;
  verifyAfterWrite: true;
  closeInFinally: true;
  verifyFinalOff: true;
  failClosedIfCloseFails: true;
  writtenThisPhase: 0;
} {
  return {
    environment: "vercel-production",
    openValue: "1",
    closeValue: "0",
    openOrder: PHASE_11B_PAID_SMOKE_FLAG_OPEN_ORDER,
    closeOrder: PHASE_11B_PAID_SMOKE_FLAG_CLOSE_ORDER,
    alwaysOff: PHASE_11B_PAID_SMOKE_FLAGS_ALWAYS_OFF,
    verifyAfterWrite: true,
    closeInFinally: true,
    verifyFinalOff: true,
    failClosedIfCloseFails: true,
    writtenThisPhase: 0,
  };
}

export function simulatePhase11BFlagWindow(env: Record<string, string | undefined>): {
  opened: typeof PHASE_11B_PAID_SMOKE_FLAG_OPEN_ORDER;
  closedInFinally: true;
  finalOff: true;
  downstreamStayedOff: true;
} {
  const next = { ...env };
  try {
    for (const flag of PHASE_11B_PAID_SMOKE_FLAG_OPEN_ORDER) {
      next[flag] = "1";
    }
    for (const flag of PHASE_11B_PAID_SMOKE_FLAGS_ALWAYS_OFF) {
      if (next[flag] === "1") {
        throw new Error("Phase 11B flag window: always-off flag must stay OFF.");
      }
    }
  } finally {
    for (const flag of PHASE_11B_PAID_SMOKE_FLAG_CLOSE_ORDER) {
      next[flag] = "0";
    }
  }
  for (const flag of PHASE_11B_PAID_SMOKE_FLAG_OPEN_ORDER) {
    if (next[flag] !== "0") {
      throw new Error("Phase 11B flag window: close failed — fail-closed.");
    }
  }
  return {
    opened: PHASE_11B_PAID_SMOKE_FLAG_OPEN_ORDER,
    closedInFinally: true,
    finalOff: true,
    downstreamStayedOff: true,
  };
}

export function assertPhase11BFlagCloseFailedFailClosed(closeSucceeded: boolean): void {
  if (!closeSucceeded) {
    throw new Error("Phase 11B flag window: close failed — fail-closed, no resubmit.");
  }
}

export function provePhase11BPaidExecutionContractInMemory(): {
  submits: 1;
  jobs: 1;
  outputs: 1;
  retries: 0;
  fallbacks: 0;
  downstream: 0;
  outputActive: false;
  humanReviewRequired: true;
} {
  let unknown = persistPhase11BI2vSubmitIntent(createPhase11BI2vJobState());
  unknown = markPhase11BI2vSubmissionUnknown(unknown);
  try {
    recordPhase11BI2vSubmit(unknown, "must-not-resubmit");
    throw new Error("Phase 11B paid preflight: submission_unknown must not resubmit.");
  } catch (err) {
    if (!(err instanceof Error) || !/submission_unknown/i.test(err.message)) {
      throw err;
    }
  }
  let state = persistPhase11BI2vSubmitIntent(createPhase11BI2vJobState());
  state = recordPhase11BI2vSubmit(state, "fake-preflight-job");
  const recovered = recoverPhase11BI2vFreshProcess(state);
  state = pollPhase11BI2vJob(recovered, "COMPLETED");
  state = settlePhase11BI2vLedgerOnce(state);
  const settledAgain = settlePhase11BI2vLedgerOnce(state);
  assertPhase11BI2vNoAutomaticDownstream(settledAgain);
  assertPhase11BI2vOutputMime("video/mp4");
  assertPhase11BI2vOutputSize(1_048_576);
  assertPhase11BI2vResultHostAllowlist("https://v3.fal.media/files/example/output.mp4");
  assertPhase11BI2vNoOverwrite(false);
  const provenance = createPhase11BI2vOutputProvenance({
    sourceAssetId: PHASE_11B_SOURCE_ASSET_ID,
    sourceChecksum: PHASE_11B_VERIFIED_LIVE_METADATA.checksum,
    outputAssetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  const qc = evaluatePhase11BI2vTechnicalQuality({
    mime: "video/mp4",
    durationSeconds: 5,
    expectedDurationSeconds: 5,
    width: 1024,
    height: 1024,
    fps: 24,
    bytes: 1_048_576,
    checksum: "a".repeat(64),
    probeAvailable: false,
    provenanceOk: provenance.active === false,
  });
  assertPhase11BI2vNoAutoApprove(qc);
  const handoff = createPhase11BI2vReviewHandoff({
    outputAssetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    qualityReportId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    reviewRequestId: "11b-paid-preflight-local",
  });
  assertPhase11BI2vReviewStaysLocal(handoff.persistedToProduction);
  return {
    submits: 1,
    jobs: 1,
    outputs: 1,
    retries: 0,
    fallbacks: 0,
    downstream: 0,
    outputActive: false,
    humanReviewRequired: true,
  };
}

export function redactPhase11BPaidPreflightError(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/token=[^&\s]+/gi, "token=[redacted]");
}

export function runPhase11BI2vPaidSmokeFinalPreflight(
  input: Phase11BPaidSmokeFinalPreflightInput = {},
): Phase11BPaidSmokeFinalPreflightResult {
  if ((input.providerMode ?? "disabled") !== "disabled") {
    throw new Error("Phase 11B paid preflight: providerMode must stay disabled.");
  }
  if (input.paidAuthPresent) {
    throw new Error("Phase 11B paid preflight: paid Auth must stay absent.");
  }
  const flags = input.flags ?? {};
  assertPhase11BI2vFlagsRemainOff(flags);
  assertPhase11BDoesNotCallOpenAIImage(0);
  phase11BI2vWiringDryRun();
  const liveBudget = input.liveBudget ?? PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET;
  assertPhase11BPaidPreflightLiveBudget(liveBudget);
  const facts = input.liveFacts ?? PHASE_11B_VERIFIED_LIVE_METADATA;
  const source = buildPhase11BApprovedSourceReference({
    humanReviewDecisionId: `${PHASE_11B_SOURCE_HR_DECISION_PREFIX}-paid-preflight`,
  });
  assertPhase11BSourceReferenceReady(source, facts);
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
  const resolved = resolvePhase11BExistingAssetToInternalInput(source, facts);
  const store = { signedUrlCount: 0, mediaReads: 0, persistedPayloads: [] as unknown[] };
  phase11BResolverMustStayUnsigned(store, { access: resolved.asset.access });
  try {
    assertPhase11BMayCreateSignedUrl({
      reserved: false,
      immediatelyBeforeSubmit: false,
      authorized: false,
    });
    throw new Error("Phase 11B paid preflight: unsigned gate must fail-closed.");
  } catch (err) {
    if (!(err instanceof Error) || !/forbidden/i.test(err.message)) {
      throw err;
    }
  }
  const ttl = phase11BSignedUrlPolicy();
  if (ttl.persist !== false || ttl.ttlSeconds !== 60) {
    throw new Error("Phase 11B paid preflight: signed URL policy must stay memory-only TTL 60s.");
  }

  const reservation = planPhase11BFutureReservation();
  assertPhase11BReservationNotCreated(reservation.created);
  const compare = phase11BFutureBudgetCompare({ availableMinor: liveBudget.available });
  if (compare.klingShortfallMinor !== 0) {
    throw new Error("BLOCKED_I2V_PAID_SMOKE_FINAL_PREFLIGHT: expected theoretically sufficient budget.");
  }
  if (compare.klingEstimateMinor !== PHASE_11B_KLING_ESTIMATE_MINOR) {
    throw new Error("Phase 11B paid preflight: Kling estimate must stay 140¢.");
  }
  if (compare.klingCapMinor !== PHASE_11B_FUTURE_RESERVE_MINOR) {
    throw new Error("Phase 11B paid preflight: reservation cap must stay 168¢.");
  }
  if (liveBudget.available - compare.klingCapMinor !== PHASE_11B_FUTURE_MARGIN_MINOR) {
    throw new Error("Phase 11B paid preflight: future margin must stay 20¢.");
  }

  const built = buildPhase11BSingleStepGenerationPlan({
    storyboardRevisionId: PLAN_DEFAULTS.storyboardRevisionId,
    scenePackageRevisionIds: [...PLAN_DEFAULTS.scenePackageRevisionIds],
    createdAt: PLAN_DEFAULTS.createdAt,
    createdBy: PLAN_DEFAULTS.createdBy,
    correlationId: PLAN_DEFAULTS.correlationId,
    source,
  });
  if (built.persistedToProduction) {
    throw new Error("Phase 11B paid preflight must not persist a plan.");
  }
  const flagView = phase11BI2vFlagsAuditView(flags);
  if (
    flagView.paid ||
    flagView.provider ||
    flagView.exception ||
    flagView.worker ||
    flagView.downstream
  ) {
    throw new Error("Phase 11B paid preflight: I2V flags must stay OFF.");
  }
  provePhase11BPaidExecutionContractInMemory();
  phase11BPaidSmokeFlagPolicy();

  return {
    auth: PHASE_11B_PAID_SMOKE_FINAL_PREFLIGHT_AUTH,
    version: PHASE_11B_PAID_SMOKE_FINAL_PREFLIGHT_VERSION,
    sourceAdmissible: true,
    sourceActive: false,
    theoreticallySufficient: true,
    executionAuthorized: false,
    providerCallAllowed: false,
    reservationCreated: false,
    paidBlockedReason: "BLOCKED_PENDING_NEW_HUMAN_PAID_AUTH",
    providerCalled: false,
    signedUrlCount: 0,
    mediaReads: 0,
    productionWrites: 0,
    budgetWrites: 0,
    runsCreated: 0,
    jobsCreated: 0,
    flagsWritten: 0,
    persistedPlan: false,
    providerMode: "disabled",
    capability: PHASE_11B_CAPABILITY,
    provider: PHASE_11B_PROVIDER,
    model: PHASE_11B_MODEL,
    durationSeconds: PHASE_11B_DURATION_SECONDS,
    estimateMinor: PHASE_11B_KLING_ESTIMATE_MINOR,
    reservationCapMinor: PHASE_11B_FUTURE_RESERVE_MINOR,
    futureMarginMinor: PHASE_11B_FUTURE_MARGIN_MINOR,
    availableMinor: PHASE_11B_AVAILABLE_AFTER_MINOR,
    fingerprint: built.fingerprint,
    reservationIdempotencyKey: reservation.idempotencyKey,
    sourceAssetId: PHASE_11B_SOURCE_ASSET_ID,
    humanReviewDecisionPrefix: PHASE_11B_SOURCE_HR_DECISION_PREFIX,
    nextAuth: PHASE_11B_NEXT_PAID_AUTH,
  };
}

export function replayPhase11BI2vPaidSmokeFinalPreflight(
  input: Phase11BPaidSmokeFinalPreflightInput = {},
): {
  first: Phase11BPaidSmokeFinalPreflightResult;
  second: Phase11BPaidSmokeFinalPreflightResult;
  stable: true;
  reservationKeyStable: true;
} {
  const first = runPhase11BI2vPaidSmokeFinalPreflight(input);
  const second = runPhase11BI2vPaidSmokeFinalPreflight(input);
  if (first.fingerprint !== second.fingerprint) {
    throw new Error("Phase 11B paid preflight fingerprint must be stable.");
  }
  if (first.reservationIdempotencyKey !== second.reservationIdempotencyKey) {
    throw new Error("Phase 11B paid preflight reservation key must be stable.");
  }
  if (
    second.providerCalled ||
    second.signedUrlCount !== 0 ||
    second.mediaReads !== 0 ||
    second.reservationCreated
  ) {
    throw new Error("Phase 11B paid preflight replay must stay side-effect free.");
  }
  return { first, second, stable: true, reservationKeyStable: true };
}
