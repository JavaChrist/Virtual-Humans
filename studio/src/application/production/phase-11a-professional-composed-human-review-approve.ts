/**
 * Phase 11A — persist Human Review APPROVE on the professional 1.2.0 composed overlay.
 * Does not activate, merge, export, or call a provider. Historical rejects stay immutable.
 */
import {
  assertDeliveryTransition,
  withDeliveryUpdate,
  type ProductionResult,
} from "@/domain/production";
import { assertPhase11APayloadHasNoMediaLeak } from "./phase-11a-human-review-reject";
import { assertPhase11AOutputNotAutoActive } from "./phase-11a-human-review-gate";
import {
  buildPhase11AComposedReviewRequestId,
  PHASE_11A_COMPOSED_QUALITY_REPORT_KIND,
} from "./phase-11a-composed-execution-scaffold";
import { PHASE_11A_PROFESSIONAL_RECOMPOSITION_AUTH } from "./phase-11a-professional-overlay-recomposition-execution";

export const PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_AUTH =
  "AUTH_11A_PROFESSIONAL_COMPOSED_ASSET_HUMAN_REVIEW_APPROVE_ONCE" as const;

export const PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_ISSUE_CODE =
  "human.professional_overlay_visual_approved" as const;

export const PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT =
  "Rendu professionnel validé : titre et CTA exacts et lisibles, accents et apostrophe typographique corrects, hiérarchie satisfaisante, espacement équilibré, panneaux discrets, contraste et safe areas conformes, absence de clipping et d’artefacts bloquants." as const;

export const PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID =
  "49284892-d6ba-5249-b645-4f55084361cc" as const;
export const PHASE_11A_PROFESSIONAL_COMPOSED_CHECKSUM =
  "9ac484b7a1db3264330ee09ddcb197fa8d83e6735a3476c7af5ab1547ff317f0" as const;
export const PHASE_11A_PROFESSIONAL_REVIEW_REQUEST_PREFIX = "11a-compose-hr-f0a6f908" as const;

export type Phase11AProfessionalApproveFacts = {
  composedAssetId: string;
  parentAssetId: string;
  composedChecksumSha256: string;
  qualityReportId: string;
  reviewRequestId: string;
  decisionId: string;
  nowIso: string;
};

export type Phase11AProfessionalApproveStore = {
  decisions: Array<{
    id: string;
    decision: string;
    idempotencyKey: string;
    reviewRequestId: string;
    composedAssetId: string;
    productionResultRevision: number;
    comment: string;
  }>;
  productionResultRevision: number;
  composed: { id: string; status: string; active: boolean; checksum: string };
  parent: { id: string; status: string; active: boolean };
  rejectedComposed110: { id: string; status: string; active: boolean; decisionId: string };
  rejectedComposed100: { id: string; status: string; active: boolean; decisionId: string };
  rejectedSmoke: { id: string; status: string; active: boolean };
  storageWrites: number;
  providerCalls: number;
  ledgerWrites: number;
};

export function assertPhase11AProfessionalRequestedDecisionIsApprove(
  decision: string,
): asserts decision is "approved" {
  if (decision !== "approved") {
    throw new Error(
      `BLOCKED_DECISION_CONFLICT: professional composed review must be approved, got ${decision}`,
    );
  }
}

export function resolvePhase11AProfessionalReviewRequestId(input: {
  projectId: string;
  composedAssetId: string;
}): string {
  return buildPhase11AComposedReviewRequestId({
    projectId: input.projectId,
    composedAssetId: input.composedAssetId,
    auth: PHASE_11A_PROFESSIONAL_RECOMPOSITION_AUTH,
  });
}

export function phase11AProfessionalApproveIdempotencyKey(reviewRequestId: string): string {
  return `hr-decision:${reviewRequestId}`;
}

export function assertPhase11AProfessionalApproveAttestation(comment: string): void {
  if (comment !== PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT) {
    throw new Error("BLOCKED_ATTESTATION_MISMATCH");
  }
  assertPhase11APayloadHasNoMediaLeak({ comment });
}

export function assertPhase11AApprovedRemainsInactive(input: {
  decision: "approved";
  active: boolean;
  published: boolean;
  mergeRequested: boolean;
  exportRequested: boolean;
  downstreamRequested: boolean;
  providerCalls: number;
}): void {
  if (input.decision !== "approved") {
    throw new Error("Phase 11A: expected approved Human Review decision.");
  }
  assertPhase11AOutputNotAutoActive({
    active: input.active,
    published: input.published,
    mergeRequested: input.mergeRequested,
    exportRequested: input.exportRequested,
    downstreamRequested: input.downstreamRequested,
  });
  if (input.providerCalls !== 0) {
    throw new Error("Phase 11A: APPROVE must not call a provider.");
  }
}

export function applyPhase11AProfessionalApproveToProductionResult(input: {
  productionResult: ProductionResult;
  facts: Phase11AProfessionalApproveFacts;
}): ProductionResult {
  const current = input.productionResult.delivery ?? {
    status: "not_started" as const,
    updatedAt: input.facts.nowIso,
  };
  assertDeliveryTransition(current.status, "merge_ready");
  const next = withDeliveryUpdate(input.productionResult, {
    ...current,
    status: "merge_ready",
    updatedAt: input.facts.nowIso,
    qualityReportId: input.facts.qualityReportId,
    humanReviewId: input.facts.decisionId,
    finalAssetId: input.facts.composedAssetId,
    blockingCodes: [],
  });
  const withNote = {
    ...next,
    phase11a: {
      technicalPipeline: "PASS",
      typographicPipeline: "PASS",
      assetDecision: "HUMAN_APPROVED",
      parentAssetId: input.facts.parentAssetId,
      parentAssetDecision: "UNCHANGED_PENDING_REVIEW",
      reviewRequestId: input.facts.reviewRequestId,
      outputActive: false,
      mergeExportAuthorized: false,
      activationAuthorized: false,
      retryCreated: false,
      compositorVersion: "phase-11a-vector-compositor-1.2.0",
      fontFamily: "vhs-overlay-latin-vector-v1",
      layoutVersion: "phase-11a-overlay-layout-1.2.0",
      panelVersion: "phase-11a-contrast-panel-1.2.0",
      humanReviewDecision: "approved",
      issueCode: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_ISSUE_CODE,
      preflightVisualDecision: "ACCEPT_PREFLIGHT_VISUAL",
      preflightVisualIsNotDurableDecision: true,
    },
  };
  assertPhase11APayloadHasNoMediaLeak(withNote);
  return Object.freeze(JSON.parse(JSON.stringify(withNote)) as ProductionResult);
}

export function applyPhase11AProfessionalApproveToAssetProvenance(
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
    technicalPipeline: "PASS",
    typographicPipeline: "PASS",
    assetDecision: "HUMAN_APPROVED",
    parentAssetId: input.parentAssetId,
    parentAssetDecision: "UNCHANGED_PENDING_REVIEW",
    reviewRequestId: input.reviewRequestId,
    decisionId: input.decisionId,
    auth: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_AUTH,
    issueCode: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_ISSUE_CODE,
    preflightVisualDecision: "ACCEPT_PREFLIGHT_VISUAL",
  };
  assertPhase11APayloadHasNoMediaLeak(next);
  assertPhase11AApprovedRemainsInactive({
    decision: "approved",
    active: next.active,
    published: next.published,
    mergeRequested: next.mergeRequested,
    exportRequested: next.exportRequested,
    downstreamRequested: next.downstreamRequested,
    providerCalls: 0,
  });
  return next;
}

export function applyPhase11AProfessionalApproveToRunState(
  state: Record<string, unknown>,
  input: { nowIso: string; reviewRequestId: string; decisionId: string },
): Record<string, unknown> {
  const next = { ...state };
  delete next.waitingReason;
  next.status = "completed";
  next.updatedAt = input.nowIso;
  next.humanReview = {
    decision: "approved",
    target: "composed_overlay_image",
    reviewRequestId: input.reviewRequestId,
    decisionId: input.decisionId,
    technicalPipeline: "PASS",
    typographicPipeline: "PASS",
    assetDecision: "HUMAN_APPROVED",
    parentAssetDecision: "UNCHANGED_PENDING_REVIEW",
    outputActive: false,
    decidedAt: input.nowIso,
    auth: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_AUTH,
    issueCode: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_ISSUE_CODE,
  };
  assertPhase11APayloadHasNoMediaLeak(next);
  return next;
}

export function assertPhase11AProfessionalQualityReportScope(
  value: Record<string, unknown>,
  composedAssetId: string,
): void {
  if (value.kind !== PHASE_11A_COMPOSED_QUALITY_REPORT_KIND) {
    throw new Error("BLOCKED_REVIEW_SCAFFOLD_INCONSISTENT quality_report kind");
  }
  const asset = value.asset && typeof value.asset === "object" ? (value.asset as Record<string, unknown>) : null;
  if (!asset || asset.id !== composedAssetId) {
    throw new Error("BLOCKED_REVIEW_SCAFFOLD_INCONSISTENT quality_report asset");
  }
  if (value.technicalStatus === "fail" || value.typographicStatus === "fail") {
    throw new Error("BLOCKED_QC_REJECT_PRESENT");
  }
  if (value.humanReviewDecision != null) {
    throw new Error("BLOCKED_REVIEW_SCAFFOLD_INCONSISTENT quality_report already decided");
  }
  assertPhase11APayloadHasNoMediaLeak(value);
}

export type PersistPhase11AProfessionalApproveResult =
  | { status: "created" | "existing"; decisionId: string; expectedRevision: number }
  | { status: "conflict"; reason: string };

export function persistPhase11AProfessionalHumanApproveOnce(
  store: Phase11AProfessionalApproveStore,
  input: {
    requestedDecision: string;
    facts: Phase11AProfessionalApproveFacts;
    idempotencyKey: string;
    comment: string;
    expectedProductionResultRevision?: number;
  },
): PersistPhase11AProfessionalApproveResult {
  assertPhase11AProfessionalRequestedDecisionIsApprove(input.requestedDecision);
  assertPhase11AProfessionalApproveAttestation(input.comment);
  if (store.composed.checksum !== input.facts.composedChecksumSha256) {
    return { status: "conflict", reason: "checksum_mismatch" };
  }
  if (store.parent.id !== input.facts.parentAssetId) {
    return { status: "conflict", reason: "parent_mismatch" };
  }
  if (!input.facts.reviewRequestId.startsWith(PHASE_11A_PROFESSIONAL_REVIEW_REQUEST_PREFIX)) {
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
  if (store.decisions.some((d) => d.composedAssetId === input.facts.composedAssetId)) {
    return { status: "conflict", reason: "composed_decision_already_present" };
  }
  const expected = input.expectedProductionResultRevision ?? store.productionResultRevision;
  if (expected !== store.productionResultRevision) {
    return { status: "conflict", reason: "optimistic_conflict" };
  }
  store.decisions.push({
    id: input.facts.decisionId,
    decision: "approved",
    idempotencyKey: input.idempotencyKey,
    reviewRequestId: input.facts.reviewRequestId,
    composedAssetId: input.facts.composedAssetId,
    productionResultRevision: store.productionResultRevision,
    comment: input.comment,
  });
  store.productionResultRevision += 1;
  store.composed = { ...store.composed, status: "approved", active: false };
  assertPhase11AApprovedRemainsInactive({
    decision: "approved",
    active: store.composed.active,
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

export function emptyPhase11AProfessionalApproveStore(input: {
  composedAssetId: string;
  parentAssetId: string;
  rejectedComposed110Id: string;
  rejectedComposed110DecisionId: string;
  rejectedComposed100Id: string;
  rejectedComposed100DecisionId: string;
  rejectedSmokeId: string;
  composedChecksum: string;
  productionResultRevision: number;
}): Phase11AProfessionalApproveStore {
  return {
    decisions: [],
    productionResultRevision: input.productionResultRevision,
    composed: {
      id: input.composedAssetId,
      status: "pending_review",
      active: false,
      checksum: input.composedChecksum,
    },
    parent: { id: input.parentAssetId, status: "pending_review", active: false },
    rejectedComposed110: {
      id: input.rejectedComposed110Id,
      status: "rejected",
      active: false,
      decisionId: input.rejectedComposed110DecisionId,
    },
    rejectedComposed100: {
      id: input.rejectedComposed100Id,
      status: "rejected",
      active: false,
      decisionId: input.rejectedComposed100DecisionId,
    },
    rejectedSmoke: { id: input.rejectedSmokeId, status: "rejected", active: false },
    storageWrites: 0,
    providerCalls: 0,
    ledgerWrites: 0,
  };
}
