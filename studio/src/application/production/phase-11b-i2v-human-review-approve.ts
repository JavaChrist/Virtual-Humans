/**
 * Phase 11B — persist Human Review APPROVE on the first paid I2V video.
 * Does not activate, publish, merge, export, or call a provider.
 */
import { assertPhase11APayloadHasNoMediaLeak } from "./phase-11a-human-review-reject";
import { assertPhase11AOutputNotAutoActive } from "./phase-11a-human-review-gate";

export const PHASE_11B_I2V_HR_APPROVE_AUTH =
  "AUTH_11B_I2V_HUMAN_REVIEW_APPROVE_ONCE" as const;

export const PHASE_11B_I2V_HR_APPROVE_ISSUE_CODE = "human.i2v_visual_approved" as const;

export const PHASE_11B_I2V_HR_APPROVE_COMMENT =
  "Vidéo I2V privée visionnée et approuvée par Christian. Fidélité, stabilité, mouvement, overlay et exploitabilité visuelle acceptés pour cette validation. Aucun downstream ni activation autorisé." as const;

export const PHASE_11B_I2V_VIDEO_ASSET_ID = "9be6cb0c-45ee-40f6-b433-02b62d81a283" as const;
export const PHASE_11B_I2V_VIDEO_CHECKSUM =
  "e929f00a5625d37f6b3f390b66193d4b8a60fecaf5a0bf36c6f2fb89ce00195f" as const;
export const PHASE_11B_I2V_PARENT_ASSET_ID = "49284892-d6ba-5249-b645-4f55084361cc" as const;
export const PHASE_11B_I2V_REVIEW_REQUEST_PREFIX = "11b-i2v-hr-9be6cb0c" as const;
export const PHASE_11B_I2V_VIDEO_BYTES = 1_629_267 as const;

export type Phase11BI2vApproveFacts = {
  videoAssetId: string;
  parentAssetId: string;
  videoChecksumSha256: string;
  qualityReportId: string;
  reviewRequestId: string;
  decisionId: string;
  nowIso: string;
};

export type Phase11BI2vApproveStore = {
  decisions: Array<{
    id: string;
    decision: string;
    idempotencyKey: string;
    reviewRequestId: string;
    videoAssetId: string;
    productionResultRevision: number;
    comment: string;
  }>;
  productionResultRevision: number;
  video: { id: string; status: string; active: boolean; checksum: string };
  parent: { id: string; status: string; active: boolean };
  storageWrites: number;
  providerCalls: number;
  ledgerWrites: number;
  flagsWritten: number;
};

export function assertPhase11BI2vRequestedDecisionIsApprove(
  decision: string,
): asserts decision is "approved" {
  if (decision !== "approved") {
    throw new Error(`BLOCKED_I2V_HUMAN_REVIEW_DECISION_CONFLICT: expected approved, got ${decision}`);
  }
}

export function resolvePhase11BI2vReviewRequestId(videoAssetId: string): string {
  return `${PHASE_11B_I2V_REVIEW_REQUEST_PREFIX}:${videoAssetId.slice(0, 8)}`;
}

export function phase11BI2vApproveIdempotencyKey(reviewRequestId: string): string {
  return `hr-decision:${reviewRequestId}`;
}

export function assertPhase11BI2vApproveAttestation(comment: string): void {
  if (comment !== PHASE_11B_I2V_HR_APPROVE_COMMENT) {
    throw new Error("BLOCKED_ATTESTATION_MISMATCH");
  }
  assertPhase11APayloadHasNoMediaLeak({ comment });
}

export function assertPhase11BI2vApprovedRemainsInactive(input: {
  decision: "approved";
  active: boolean;
  published: boolean;
  mergeRequested: boolean;
  exportRequested: boolean;
  downstreamRequested: boolean;
  providerCalls: number;
}): void {
  if (input.decision !== "approved") {
    throw new Error("Phase 11B: expected approved Human Review decision.");
  }
  assertPhase11AOutputNotAutoActive({
    active: input.active,
    published: input.published,
    mergeRequested: input.mergeRequested,
    exportRequested: input.exportRequested,
    downstreamRequested: input.downstreamRequested,
  });
  if (input.providerCalls !== 0) {
    throw new Error("Phase 11B: APPROVE must not call a provider.");
  }
}

export function assertPhase11BI2vQualityReportScope(
  value: Record<string, unknown>,
  videoAssetId: string,
): void {
  if (value.videoAssetId !== videoAssetId) {
    throw new Error("BLOCKED_I2V_HUMAN_REVIEW_TARGET_DIVERGENCE quality_report asset");
  }
  if (value.technicalStatus === "fail" || value.technicalStatus === "rejected") {
    throw new Error("BLOCKED_QC_REJECT_PRESENT");
  }
  if (value.visualStatus !== "unavailable_humanOnly") {
    throw new Error("BLOCKED_I2V_HUMAN_REVIEW_TARGET_DIVERGENCE visualStatus");
  }
  if (value.autoApprove === true) {
    throw new Error("BLOCKED_AUTO_APPROVE");
  }
  if (value.humanReviewDecision != null) {
    throw new Error("BLOCKED_REVIEW_ALREADY_DECIDED");
  }
  assertPhase11APayloadHasNoMediaLeak(value);
}

export function applyPhase11BI2vApproveToProductionResult(input: {
  productionResult: Record<string, unknown>;
  facts: Phase11BI2vApproveFacts;
}): Record<string, unknown> {
  const next = {
    ...input.productionResult,
    active: false,
    published: false,
    downstream: false,
    reviewRequest: {
      pending: false,
      decision: "approved",
      humanReviewRequired: true,
    },
    delivery: {
      status: "merge_ready",
      updatedAt: input.facts.nowIso,
      qualityReportId: input.facts.qualityReportId,
      humanReviewId: input.facts.decisionId,
      finalAssetId: input.facts.videoAssetId,
      blockingCodes: [],
    },
    phase11b: {
      assetDecision: "HUMAN_APPROVED",
      visualStatus: "unavailable_humanOnly",
      technicalAvailable: "PASS",
      outputActive: false,
      mergeExportAuthorized: false,
      activationAuthorized: false,
      retryCreated: false,
      humanReviewDecision: "approved",
      issueCode: PHASE_11B_I2V_HR_APPROVE_ISSUE_CODE,
      reviewRequestId: input.facts.reviewRequestId,
      parentAssetId: input.facts.parentAssetId,
    },
  };
  assertPhase11APayloadHasNoMediaLeak(next);
  return Object.freeze(JSON.parse(JSON.stringify(next)) as Record<string, unknown>);
}

export function applyPhase11BI2vApproveToAssetProvenance(
  provenance: Record<string, unknown>,
  input: { reviewRequestId: string; decisionId: string; parentAssetId: string },
): Record<string, unknown> {
  const next = {
    ...provenance,
    active: false,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
    lifecycle: "approved",
    outputLifecycle: "approved",
    humanDecision: "approved",
    assetDecision: "HUMAN_APPROVED",
    reviewRequestId: input.reviewRequestId,
    decisionId: input.decisionId,
    parentAssetId: input.parentAssetId,
    auth: PHASE_11B_I2V_HR_APPROVE_AUTH,
    issueCode: PHASE_11B_I2V_HR_APPROVE_ISSUE_CODE,
  };
  assertPhase11APayloadHasNoMediaLeak(next);
  assertPhase11BI2vApprovedRemainsInactive({
    decision: "approved",
    active: Boolean(next.active),
    published: Boolean(next.published),
    mergeRequested: Boolean(next.mergeRequested),
    exportRequested: Boolean(next.exportRequested),
    downstreamRequested: Boolean(next.downstreamRequested),
    providerCalls: 0,
  });
  return next;
}

export function applyPhase11BI2vApproveToRunState(
  state: Record<string, unknown>,
  input: { nowIso: string; reviewRequestId: string; decisionId: string },
): Record<string, unknown> {
  const next = { ...state };
  delete next.waitingReason;
  next.status = "completed";
  next.updatedAt = input.nowIso;
  next.humanReview = {
    decision: "approved",
    target: "i2v_output_video",
    reviewRequestId: input.reviewRequestId,
    decisionId: input.decisionId,
    assetDecision: "HUMAN_APPROVED",
    outputActive: false,
    decidedAt: input.nowIso,
    auth: PHASE_11B_I2V_HR_APPROVE_AUTH,
    issueCode: PHASE_11B_I2V_HR_APPROVE_ISSUE_CODE,
  };
  const reviewRequest = next.reviewRequest;
  if (reviewRequest && typeof reviewRequest === "object") {
    next.reviewRequest = {
      ...(reviewRequest as Record<string, unknown>),
      pending: false,
    };
  }
  assertPhase11APayloadHasNoMediaLeak(next);
  return next;
}

export type PersistPhase11BI2vApproveResult =
  | { status: "created" | "existing"; decisionId: string; expectedRevision: number }
  | { status: "conflict"; reason: string };

export function persistPhase11BI2vHumanApproveOnce(
  store: Phase11BI2vApproveStore,
  input: {
    requestedDecision: string;
    facts: Phase11BI2vApproveFacts;
    idempotencyKey: string;
    comment: string;
    expectedProductionResultRevision?: number;
  },
): PersistPhase11BI2vApproveResult {
  assertPhase11BI2vRequestedDecisionIsApprove(input.requestedDecision);
  assertPhase11BI2vApproveAttestation(input.comment);
  if (store.video.checksum !== input.facts.videoChecksumSha256) {
    return { status: "conflict", reason: "checksum_mismatch" };
  }
  if (store.video.id !== input.facts.videoAssetId) {
    return { status: "conflict", reason: "asset_mismatch" };
  }
  if (store.parent.id !== input.facts.parentAssetId) {
    return { status: "conflict", reason: "parent_mismatch" };
  }
  if (!input.facts.reviewRequestId.startsWith(PHASE_11B_I2V_REVIEW_REQUEST_PREFIX)) {
    return { status: "conflict", reason: "review_request_mismatch" };
  }
  const existing = store.decisions.find((d) => d.idempotencyKey === input.idempotencyKey);
  if (existing) {
    if (existing.comment !== input.comment || existing.decision !== "approved") {
      return { status: "conflict", reason: "payload_mismatch" };
    }
    return {
      status: "existing",
      decisionId: existing.id,
      expectedRevision: existing.productionResultRevision,
    };
  }
  const expected = input.expectedProductionResultRevision ?? store.productionResultRevision;
  if (expected !== store.productionResultRevision) {
    return { status: "conflict", reason: "optimistic_conflict" };
  }
  if (store.decisions.some((d) => d.videoAssetId === input.facts.videoAssetId)) {
    return { status: "conflict", reason: "video_decision_already_present" };
  }
  store.decisions.push({
    id: input.facts.decisionId,
    decision: "approved",
    idempotencyKey: input.idempotencyKey,
    reviewRequestId: input.facts.reviewRequestId,
    videoAssetId: input.facts.videoAssetId,
    productionResultRevision: store.productionResultRevision,
    comment: input.comment,
  });
  store.productionResultRevision += 1;
  store.video = { ...store.video, status: "approved", active: false };
  assertPhase11BI2vApprovedRemainsInactive({
    decision: "approved",
    active: store.video.active,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
    providerCalls: store.providerCalls,
  });
  return {
    status: "created",
    decisionId: input.facts.decisionId,
    expectedRevision: expected,
  };
}

export function emptyPhase11BI2vApproveStore(input: {
  videoAssetId: string;
  parentAssetId: string;
  videoChecksum: string;
  productionResultRevision: number;
}): Phase11BI2vApproveStore {
  return {
    decisions: [],
    productionResultRevision: input.productionResultRevision,
    video: {
      id: input.videoAssetId,
      status: "pending_review",
      active: false,
      checksum: input.videoChecksum,
    },
    parent: { id: input.parentAssetId, status: "approved", active: false },
    storageWrites: 0,
    providerCalls: 0,
    ledgerWrites: 0,
    flagsWritten: 0,
  };
}
