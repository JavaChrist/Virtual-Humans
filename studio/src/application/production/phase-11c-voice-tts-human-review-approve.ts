/**
 * Phase 11C — persist Human Review APPROVE on the first paid Voice/TTS audio.
 * Strategy C: explicit run / plan / output. Does not activate I2V pointers,
 * publish, lipsync, merge, export, or call a provider.
 */
import { createHash } from "node:crypto";
import { assertPhase11APayloadHasNoMediaLeak } from "./phase-11a-human-review-reject";
import { assertPhase11AOutputNotAutoActive } from "./phase-11a-human-review-gate";
import {
  PHASE_11B_ACTIVE_GENERATION_PLAN_ID,
  PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID,
  PHASE_11B_ACTIVE_QUALITY_REPORT_ID,
} from "./phase-11b-artifact-pointer-coherence";
import { PHASE_11B_LIVE_VIDEO_ASSET_ID } from "./phase-11b-i2v-attempt-terminal-state";
import { PHASE_11C_VOICE_TTS_FIRST_PAID_NEXT_AUTH } from "./phase-11c-voice-tts-first-paid-execution";

export const PHASE_11C_VOICE_TTS_HR_APPROVE_AUTH =
  "AUTH_11C_VOICE_TTS_PRIVATE_PREVIEW_AND_HUMAN_DECISION" as const;
export const PHASE_11C_VOICE_TTS_HR_APPROVE_VERDICT =
  "VOICE_TTS_FIRST_PAID_AUDIO_HUMAN_APPROVED_PRIVATE_INACTIVE" as const;
export const PHASE_11C_VOICE_TTS_HR_APPROVE_NEXT_AUTH =
  "AUTH_11C_CLOSE_AND_NEXT_MEDIA_GATE_AUDIT" as const;

export const PHASE_11C_VOICE_TTS_HR_APPROVE_ISSUE_CODE =
  "human.voice_tts_audio_approved" as const;

export const PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT =
  "Audio Voice/TTS privé écouté et approuvé par Christian. Qualité, clarté, langue et exploitabilité acceptées pour cette validation. Aucun downstream, lipsync ni activation autorisé." as const;

export const PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID =
  "bc36bba7-c937-5e2e-88be-2d034e25a8aa" as const;
export const PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM =
  "2ca9ebbd98187dd64553dc1866cd21a3fc4b12ede97a4556a42f02258c33fdad" as const;
export const PHASE_11C_VOICE_TTS_AUDIO_BYTES = 80_710 as const;
export const PHASE_11C_VOICE_TTS_AUDIO_MIME = "audio/mpeg" as const;
export const PHASE_11C_VOICE_TTS_HR_REVIEW_REQUEST_PREFIX =
  "11c-voice-hr-bc36bba7" as const;
export const PHASE_11C_VOICE_TTS_HR_LOCAL_PREVIEW_RELATIVE =
  "studio/.tmp/voice-tts-private-preview.mp3" as const;

export const PHASE_11C_VOICE_TTS_HR_RUN_ID =
  "2eaffebf-a4e2-5ede-9353-e55366c1f077" as const;
export const PHASE_11C_VOICE_TTS_HR_JOB_ID =
  "428c7f48-6ea3-5efa-beff-2a654d256ebd" as const;
export const PHASE_11C_VOICE_TTS_HR_ATTEMPT_ID =
  "ea07475f-4ea2-55c3-9d9a-f5d52f823b25" as const;
export const PHASE_11C_VOICE_TTS_HR_PLAN_ID =
  "7bb3e30c-a734-58b5-ad73-c655aa1a0b29" as const;

export const PHASE_11C_VOICE_TTS_HR_FROZEN_I2V_POINTERS = {
  generationPlanId: PHASE_11B_ACTIVE_GENERATION_PLAN_ID,
  qualityReportId: PHASE_11B_ACTIVE_QUALITY_REPORT_ID,
  productionResultId: PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID,
  videoAssetId: PHASE_11B_LIVE_VIDEO_ASSET_ID,
} as const;

export type Phase11CVoiceApproveFacts = {
  audioAssetId: string;
  audioChecksumSha256: string;
  qualityReportId: string;
  productionResultId: string;
  reviewRequestId: string;
  decisionId: string;
  nowIso: string;
};

export type Phase11CVoiceApproveStore = {
  decisions: Array<{
    id: string;
    decision: string;
    idempotencyKey: string;
    reviewRequestId: string;
    audioAssetId: string;
    qualityReportId: string;
    productionResultId: string;
    comment: string;
  }>;
  qualityReportRevision: number;
  productionResultRevision: number;
  audio: { id: string; status: string; active: boolean; published: boolean; checksum: string };
  video: { id: string; status: string; active: boolean; published: boolean };
  activeQualityReportId: string;
  activeProductionResultId: string;
  storageWrites: number;
  providerCalls: number;
  ledgerWrites: number;
  flagsWritten: number;
  signedUrlCount: number;
  mediaReads: number;
};

function deterministicUuid(parts: readonly string[]): string {
  const digest = createHash("sha256").update(parts.join("\0"), "utf8").digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function assertPhase11CVoiceTtsHrAuthMatchesResume(): void {
  if (PHASE_11C_VOICE_TTS_FIRST_PAID_NEXT_AUTH !== PHASE_11C_VOICE_TTS_HR_APPROVE_AUTH) {
    throw new Error("Phase 11C Voice HR: first paid next Auth diverged.");
  }
}

export function assertPhase11CVoiceRequestedDecisionIsApprove(
  decision: string,
): asserts decision is "approved" {
  if (decision !== "approved") {
    throw new Error(`BLOCKED_VOICE_HUMAN_REVIEW_DECISION_CONFLICT: expected approved, got ${decision}`);
  }
}

export function resolvePhase11CVoiceReviewRequestId(audioAssetId: string): string {
  return `${PHASE_11C_VOICE_TTS_HR_REVIEW_REQUEST_PREFIX}:${audioAssetId}`;
}

export function phase11CVoiceApproveIdempotencyKey(reviewRequestId: string): string {
  return `hr-decision:${reviewRequestId}`;
}

export function phase11CVoiceScopedQualityReportId(audioAssetId: string): string {
  return deterministicUuid([audioAssetId, "voice-hr-quality-report"]);
}

export function phase11CVoiceScopedProductionResultId(audioAssetId: string): string {
  return deterministicUuid([audioAssetId, "voice-hr-production-result"]);
}

export function assertPhase11CVoiceApproveAttestation(comment: string): void {
  if (comment !== PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT) {
    throw new Error("BLOCKED_ATTESTATION_MISMATCH");
  }
  assertPhase11APayloadHasNoMediaLeak({ comment });
}

export function assertPhase11CVoiceApprovedRemainsInactive(input: {
  decision: "approved";
  active: boolean;
  published: boolean;
  mergeRequested: boolean;
  exportRequested: boolean;
  downstreamRequested: boolean;
  lipsyncRequested: boolean;
  providerCalls: number;
}): void {
  if (input.decision !== "approved") {
    throw new Error("Phase 11C Voice: expected approved Human Review decision.");
  }
  assertPhase11AOutputNotAutoActive({
    active: input.active,
    published: input.published,
    mergeRequested: input.mergeRequested,
    exportRequested: input.exportRequested,
    downstreamRequested: input.downstreamRequested,
  });
  if (input.lipsyncRequested) {
    throw new Error("Phase 11C Voice APPROVE must not authorize lipsync.");
  }
  if (input.providerCalls !== 0) {
    throw new Error("Phase 11C Voice APPROVE must not call a provider.");
  }
}

export function assertPhase11CVoiceQualityReportScope(
  value: Record<string, unknown>,
  audioAssetId: string,
): void {
  if (value.audioAssetId !== audioAssetId && value.outputAssetId !== audioAssetId) {
    throw new Error("BLOCKED_VOICE_HUMAN_REVIEW_TARGET_DIVERGENCE quality_report asset");
  }
  if (value.technicalStatus === "fail" || value.technicalStatus === "rejected") {
    throw new Error("BLOCKED_QC_REJECT_PRESENT");
  }
  if (value.perceptualStatus !== "unavailable_humanOnly" && value.visualStatus !== "unavailable_humanOnly") {
    throw new Error("BLOCKED_VOICE_HUMAN_REVIEW_TARGET_DIVERGENCE perceptualStatus");
  }
  if (value.autoApprove === true) {
    throw new Error("BLOCKED_AUTO_APPROVE");
  }
  if (value.humanReviewDecision != null && value.humanReviewDecision !== "none") {
    throw new Error("BLOCKED_REVIEW_ALREADY_DECIDED");
  }
  assertPhase11APayloadHasNoMediaLeak(value);
}

export function assertPhase11CVoiceI2vPointersFrozen(input: {
  activeQualityReportId: string;
  activeProductionResultId: string;
  videoActive: boolean;
  videoPublished: boolean;
}): void {
  if (input.activeQualityReportId !== PHASE_11C_VOICE_TTS_HR_FROZEN_I2V_POINTERS.qualityReportId) {
    throw new Error("BLOCKED_I2V_POINTER_MUTATION quality_report");
  }
  if (input.activeProductionResultId !== PHASE_11C_VOICE_TTS_HR_FROZEN_I2V_POINTERS.productionResultId) {
    throw new Error("BLOCKED_I2V_POINTER_MUTATION production_result");
  }
  if (input.videoActive || input.videoPublished) {
    throw new Error("BLOCKED_I2V_VIDEO_ACTIVATION");
  }
}

export function applyPhase11CVoiceApproveToQualityReport(input: {
  facts: Phase11CVoiceApproveFacts;
  technicalStatus: "needs_review";
}): Record<string, unknown> {
  const next = {
    schemaVersion: "phase-11c-voice-tts-hr-approve-1.0.0",
    artifactType: "quality_report",
    kind: "phase_11c_voice_tts_quality_report",
    capability: "audio.voice",
    audioAssetId: input.facts.audioAssetId,
    outputAssetId: input.facts.audioAssetId,
    checksum: PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM,
    bytes: PHASE_11C_VOICE_TTS_AUDIO_BYTES,
    mime: PHASE_11C_VOICE_TTS_AUDIO_MIME,
    technicalStatus: input.technicalStatus,
    perceptualStatus: "unavailable_humanOnly",
    visualStatus: "unavailable_humanOnly",
    humanReviewRequired: true,
    autoApprove: false,
    humanReviewDecision: null,
    runId: PHASE_11C_VOICE_TTS_HR_RUN_ID,
    jobId: PHASE_11C_VOICE_TTS_HR_JOB_ID,
    attemptId: PHASE_11C_VOICE_TTS_HR_ATTEMPT_ID,
    generationPlanId: PHASE_11C_VOICE_TTS_HR_PLAN_ID,
    i2vVideoAssetId: PHASE_11B_LIVE_VIDEO_ASSET_ID,
    activatePointers: false,
  };
  assertPhase11CVoiceQualityReportScope(next, input.facts.audioAssetId);
  return Object.freeze(JSON.parse(JSON.stringify(next)) as Record<string, unknown>);
}

export function applyPhase11CVoiceApproveToProductionResult(input: {
  productionResult?: Record<string, unknown>;
  facts: Phase11CVoiceApproveFacts;
}): Record<string, unknown> {
  const next = {
    ...(input.productionResult ?? {}),
    schemaVersion: "phase-11c-voice-tts-hr-approve-1.0.0",
    artifactType: "production_result",
    capability: "audio.voice",
    audioAssetId: input.facts.audioAssetId,
    outputAssetId: input.facts.audioAssetId,
    runId: PHASE_11C_VOICE_TTS_HR_RUN_ID,
    generationPlanId: PHASE_11C_VOICE_TTS_HR_PLAN_ID,
    active: false,
    published: false,
    downstream: false,
    lipsyncAuthorized: false,
    mergeExportAuthorized: false,
    activationAuthorized: false,
    reviewRequest: {
      pending: false,
      decision: "approved",
      humanReviewRequired: true,
    },
    delivery: {
      status: "voice_approved_private",
      updatedAt: input.facts.nowIso,
      qualityReportId: input.facts.qualityReportId,
      humanReviewId: input.facts.decisionId,
      finalAssetId: input.facts.audioAssetId,
      blockingCodes: [],
    },
    phase11c: {
      assetDecision: "HUMAN_APPROVED",
      perceptualStatus: "unavailable_humanOnly",
      technicalAvailable: "PASS",
      outputActive: false,
      mergeExportAuthorized: false,
      activationAuthorized: false,
      lipsyncAuthorized: false,
      retryCreated: false,
      humanReviewDecision: "approved",
      issueCode: PHASE_11C_VOICE_TTS_HR_APPROVE_ISSUE_CODE,
      reviewRequestId: input.facts.reviewRequestId,
      i2vVideoAssetId: PHASE_11B_LIVE_VIDEO_ASSET_ID,
      pointerStrategy: "C_explicit_run_plan_output",
    },
  };
  assertPhase11APayloadHasNoMediaLeak(next);
  return Object.freeze(JSON.parse(JSON.stringify(next)) as Record<string, unknown>);
}

export function applyPhase11CVoiceApproveToAssetProvenance(
  provenance: Record<string, unknown>,
  input: { reviewRequestId: string; decisionId: string },
): Record<string, unknown> {
  const next = {
    ...provenance,
    active: false,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
    lipsyncRequested: false,
    lifecycle: "approved",
    outputLifecycle: "approved",
    humanDecision: "approved",
    assetDecision: "HUMAN_APPROVED",
    reviewRequestId: input.reviewRequestId,
    decisionId: input.decisionId,
    auth: PHASE_11C_VOICE_TTS_HR_APPROVE_AUTH,
    issueCode: PHASE_11C_VOICE_TTS_HR_APPROVE_ISSUE_CODE,
  };
  assertPhase11APayloadHasNoMediaLeak(next);
  assertPhase11CVoiceApprovedRemainsInactive({
    decision: "approved",
    active: Boolean(next.active),
    published: Boolean(next.published),
    mergeRequested: Boolean(next.mergeRequested),
    exportRequested: Boolean(next.exportRequested),
    downstreamRequested: Boolean(next.downstreamRequested),
    lipsyncRequested: Boolean(next.lipsyncRequested),
    providerCalls: 0,
  });
  return next;
}

export function applyPhase11CVoiceApproveToRunState(
  state: Record<string, unknown>,
  input: { nowIso: string; reviewRequestId: string; decisionId: string },
): Record<string, unknown> {
  const next = { ...state };
  delete next.waitingReason;
  next.status = "completed";
  next.updatedAt = input.nowIso;
  next.humanReview = {
    decision: "approved",
    target: "voice_tts_output_audio",
    reviewRequestId: input.reviewRequestId,
    decisionId: input.decisionId,
    assetDecision: "HUMAN_APPROVED",
    outputActive: false,
    lipsyncAuthorized: false,
    decidedAt: input.nowIso,
    auth: PHASE_11C_VOICE_TTS_HR_APPROVE_AUTH,
    issueCode: PHASE_11C_VOICE_TTS_HR_APPROVE_ISSUE_CODE,
  };
  const reviewRequest = next.reviewRequest;
  if (reviewRequest && typeof reviewRequest === "object") {
    next.reviewRequest = {
      ...(reviewRequest as Record<string, unknown>),
      pending: false,
      decision: "approved",
    };
  }
  assertPhase11APayloadHasNoMediaLeak(next);
  return next;
}

export type PersistPhase11CVoiceApproveResult =
  | { status: "created" | "existing"; decisionId: string }
  | { status: "conflict"; reason: string };

export function persistPhase11CVoiceHumanApproveOnce(
  store: Phase11CVoiceApproveStore,
  input: {
    requestedDecision: string;
    facts: Phase11CVoiceApproveFacts;
    idempotencyKey: string;
    comment: string;
  },
): PersistPhase11CVoiceApproveResult {
  assertPhase11CVoiceRequestedDecisionIsApprove(input.requestedDecision);
  assertPhase11CVoiceApproveAttestation(input.comment);
  if (store.audio.checksum !== input.facts.audioChecksumSha256) {
    return { status: "conflict", reason: "checksum_mismatch" };
  }
  if (store.audio.id !== input.facts.audioAssetId) {
    return { status: "conflict", reason: "asset_mismatch" };
  }
  if (!input.facts.reviewRequestId.startsWith(PHASE_11C_VOICE_TTS_HR_REVIEW_REQUEST_PREFIX)) {
    return { status: "conflict", reason: "review_request_mismatch" };
  }
  try {
    assertPhase11CVoiceI2vPointersFrozen({
      activeQualityReportId: store.activeQualityReportId,
      activeProductionResultId: store.activeProductionResultId,
      videoActive: store.video.active,
      videoPublished: store.video.published,
    });
  } catch {
    return { status: "conflict", reason: "i2v_pointer_mutation" };
  }
  const existing = store.decisions.find((d) => d.idempotencyKey === input.idempotencyKey);
  if (existing) {
    if (existing.comment !== input.comment || existing.decision !== "approved") {
      return { status: "conflict", reason: "payload_mismatch" };
    }
    return { status: "existing", decisionId: existing.id };
  }
  if (store.decisions.some((d) => d.audioAssetId === input.facts.audioAssetId)) {
    return { status: "conflict", reason: "audio_decision_already_present" };
  }
  store.decisions.push({
    id: input.facts.decisionId,
    decision: "approved",
    idempotencyKey: input.idempotencyKey,
    reviewRequestId: input.facts.reviewRequestId,
    audioAssetId: input.facts.audioAssetId,
    qualityReportId: input.facts.qualityReportId,
    productionResultId: input.facts.productionResultId,
    comment: input.comment,
  });
  store.audio = { ...store.audio, status: "approved", active: false, published: false };
  assertPhase11CVoiceApprovedRemainsInactive({
    decision: "approved",
    active: store.audio.active,
    published: store.audio.published,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
    lipsyncRequested: false,
    providerCalls: store.providerCalls,
  });
  assertPhase11CVoiceI2vPointersFrozen({
    activeQualityReportId: store.activeQualityReportId,
    activeProductionResultId: store.activeProductionResultId,
    videoActive: store.video.active,
    videoPublished: store.video.published,
  });
  return { status: "created", decisionId: input.facts.decisionId };
}

export function emptyPhase11CVoiceApproveStore(input: {
  audioAssetId: string;
  audioChecksum: string;
  qualityReportRevision: number;
  productionResultRevision: number;
}): Phase11CVoiceApproveStore {
  return {
    decisions: [],
    qualityReportRevision: input.qualityReportRevision,
    productionResultRevision: input.productionResultRevision,
    audio: {
      id: input.audioAssetId,
      status: "pending_review",
      active: false,
      published: false,
      checksum: input.audioChecksum,
    },
    video: {
      id: PHASE_11B_LIVE_VIDEO_ASSET_ID,
      status: "approved",
      active: false,
      published: false,
    },
    activeQualityReportId: PHASE_11B_ACTIVE_QUALITY_REPORT_ID,
    activeProductionResultId: PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID,
    storageWrites: 0,
    providerCalls: 0,
    ledgerWrites: 0,
    flagsWritten: 0,
    signedUrlCount: 0,
    mediaReads: 0,
  };
}
