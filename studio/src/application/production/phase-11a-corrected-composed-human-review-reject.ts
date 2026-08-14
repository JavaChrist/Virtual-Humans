/**
 * Phase 11A — persist Human Review REJECT on the corrected 1.1.0 composed overlay.
 * Does not reject the provider parent or mutate historical rejects. No provider / Storage / ledger.
 */
import { createHash } from "node:crypto";
import {
  assertDeliveryTransition,
  withDeliveryUpdate,
  type ProductionResult,
} from "@/domain/production";
import { assertPhase11APayloadHasNoMediaLeak } from "./phase-11a-human-review-reject";
import { assertPhase11ARejectedBlocksActivationAndDownstream } from "./phase-11a-human-review-gate";
import { PHASE_11A_COMPOSED_QUALITY_REPORT_KIND } from "./phase-11a-composed-execution-scaffold";

export const PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_AUTH =
  "AUTH_11A_CORRECTED_COMPOSED_ASSET_HUMAN_REVIEW_REJECT_ONCE" as const;

export const PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_ISSUE_CODE =
  "human.overlay_typography_layout_not_production_ready" as const;

export const PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_COMMENT =
  "Les glyphes sont maintenant lisibles et le correctif technique du composeur 1.1.0 est validé. L’asset reste toutefois inutilisable en Production : police trop pixelisée, espacement excessif, bandeaux noirs trop lourds et CTA déséquilibré avec “Studio” isolé. Asset composé rejeté. Le parent provider reste réutilisable pour une nouvelle composition locale sans appel OpenAI." as const;

export const PHASE_11A_CORRECTED_COMPOSITOR_VERSION =
  "phase-11a-bitmap-compositor-1.1.0" as const;

export const PHASE_11A_CORRECTED_ATLAS_VERSION =
  "vhs-overlay-latin-bitmap-shapes-v1" as const;

export type Phase11ACorrectedComposedRejectFacts = {
  composedAssetId: string;
  parentAssetId: string;
  composedChecksumSha256: string;
  qualityReportId: string;
  reviewRequestId: string;
  decisionId: string;
  nowIso: string;
};

export type Phase11ACorrectedComposedRejectStore = {
  decisions: Array<{
    id: string;
    decision: string;
    idempotencyKey: string;
    reviewRequestId: string;
    composedAssetId: string;
    productionResultRevision: number;
  }>;
  productionResultRevision: number;
  composed: { id: string; status: string; active: boolean; checksum: string };
  parent: { id: string; status: string; active: boolean };
  rejectedComposed100: { id: string; status: string; active: boolean; decisionId: string };
  rejectedSmoke: { id: string; status: string; active: boolean };
  storageWrites: number;
  providerCalls: number;
  ledgerWrites: number;
};

export function assertPhase11ACorrectedComposedRequestedDecisionIsReject(
  decision: string,
): asserts decision is "rejected" {
  if (decision !== "rejected") {
    throw new Error(
      `BLOCKED_DECISION_CONFLICT: corrected composed review must be rejected, got ${decision}`,
    );
  }
}

export function buildPhase11ACorrectedComposedRejectReviewRequestId(input: {
  projectId: string;
  composedAssetId: string;
}): string {
  const digest = createHash("sha256")
    .update(
      `${input.projectId}|${input.composedAssetId}|rejected|${PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_AUTH}`,
    )
    .digest("hex")
    .slice(0, 24);
  return `11a-corrected-compose-hr-reject-${digest}`;
}

export function phase11ACorrectedComposedRejectIdempotencyKey(reviewRequestId: string): string {
  return `hr-decision:${reviewRequestId}`;
}

export function applyPhase11ACorrectedComposedRejectToProductionResult(input: {
  productionResult: ProductionResult;
  facts: Phase11ACorrectedComposedRejectFacts;
}): ProductionResult {
  const current = input.productionResult.delivery ?? {
    status: "not_started" as const,
    updatedAt: input.facts.nowIso,
  };
  assertDeliveryTransition(current.status, "blocked");
  const next = withDeliveryUpdate(input.productionResult, {
    ...current,
    status: "blocked",
    updatedAt: input.facts.nowIso,
    qualityReportId: input.facts.qualityReportId,
    humanReviewId: input.facts.decisionId,
    finalAssetId: input.facts.composedAssetId,
    blockingCodes: [PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_ISSUE_CODE, "human_rejected"],
  });
  const withNote = {
    ...next,
    phase11a: {
      technicalPipeline: "PASS",
      glyphPipeline: "PASS",
      readability: "PASS",
      typographicLayout: "FAIL",
      assetDecision: "HUMAN_REJECTED",
      parentAssetId: input.facts.parentAssetId,
      parentAssetDecision: "UNCHANGED_PENDING_REVIEW",
      reviewRequestId: input.facts.reviewRequestId,
      outputActive: false,
      mergeExportAuthorized: false,
      retryCreated: false,
      compositorVersion: PHASE_11A_CORRECTED_COMPOSITOR_VERSION,
      atlasVersion: PHASE_11A_CORRECTED_ATLAS_VERSION,
      humanReviewDecision: "rejected",
      issueCode: PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_ISSUE_CODE,
    },
  };
  assertPhase11APayloadHasNoMediaLeak(withNote);
  return Object.freeze(JSON.parse(JSON.stringify(withNote)) as ProductionResult);
}

export function applyPhase11ACorrectedComposedRejectToAssetProvenance(
  provenance: Record<string, unknown>,
  input: { reviewRequestId: string; decisionId: string; parentAssetId: string },
): Record<string, unknown> {
  const next = {
    ...provenance,
    active: false,
    lifecycle: "rejected",
    outputLifecycle: "rejected",
    humanDecision: "rejected",
    technicalPipeline: "PASS",
    glyphPipeline: "PASS",
    readability: "PASS",
    typographicLayout: "FAIL",
    assetDecision: "HUMAN_REJECTED",
    parentAssetId: input.parentAssetId,
    parentAssetDecision: "UNCHANGED_PENDING_REVIEW",
    reviewRequestId: input.reviewRequestId,
    decisionId: input.decisionId,
    auth: PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_AUTH,
    issueCode: PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_ISSUE_CODE,
    compositorVersion: provenance.compositorVersion ?? PHASE_11A_CORRECTED_COMPOSITOR_VERSION,
    atlasVersion: provenance.atlasVersion ?? PHASE_11A_CORRECTED_ATLAS_VERSION,
  };
  assertPhase11APayloadHasNoMediaLeak(next);
  return next;
}

export function applyPhase11ACorrectedComposedRejectToRunState(
  state: Record<string, unknown>,
  input: { nowIso: string; reviewRequestId: string; decisionId: string },
): Record<string, unknown> {
  const next = { ...state };
  delete next.waitingReason;
  next.status = "completed";
  next.updatedAt = input.nowIso;
  next.humanReview = {
    decision: "rejected",
    target: "composed_overlay_image",
    reviewRequestId: input.reviewRequestId,
    decisionId: input.decisionId,
    technicalPipeline: "PASS",
    glyphPipeline: "PASS",
    readability: "PASS",
    typographicLayout: "FAIL",
    assetDecision: "HUMAN_REJECTED",
    parentAssetDecision: "UNCHANGED_PENDING_REVIEW",
    decidedAt: input.nowIso,
    auth: PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_AUTH,
    issueCode: PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_ISSUE_CODE,
  };
  assertPhase11APayloadHasNoMediaLeak(next);
  return next;
}

export function assertPhase11ACorrectedComposedQualityReportScope(
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
  if (value.humanReviewDecision != null) {
    throw new Error("BLOCKED_REVIEW_SCAFFOLD_INCONSISTENT quality_report already decided");
  }
  assertPhase11APayloadHasNoMediaLeak(value);
}

export type PersistPhase11ACorrectedComposedRejectResult =
  | { status: "created" | "existing"; decisionId: string; expectedRevision: number }
  | { status: "conflict"; reason: string };

export function persistPhase11ACorrectedComposedHumanRejectOnce(
  store: Phase11ACorrectedComposedRejectStore,
  input: {
    requestedDecision: string;
    facts: Phase11ACorrectedComposedRejectFacts;
    idempotencyKey: string;
    expectedProductionResultRevision?: number;
  },
): PersistPhase11ACorrectedComposedRejectResult {
  assertPhase11ACorrectedComposedRequestedDecisionIsReject(input.requestedDecision);
  if (store.composed.checksum !== input.facts.composedChecksumSha256) {
    return { status: "conflict", reason: "checksum_mismatch" };
  }
  if (store.parent.id !== input.facts.parentAssetId) {
    return { status: "conflict", reason: "parent_mismatch" };
  }
  const existing = store.decisions.find((d) => d.idempotencyKey === input.idempotencyKey);
  if (existing) {
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
    decision: "rejected",
    idempotencyKey: input.idempotencyKey,
    reviewRequestId: input.facts.reviewRequestId,
    composedAssetId: input.facts.composedAssetId,
    productionResultRevision: store.productionResultRevision,
  });
  store.productionResultRevision += 1;
  store.composed = { ...store.composed, status: "rejected", active: false };
  assertPhase11ARejectedBlocksActivationAndDownstream({
    decision: "rejected",
    active: store.composed.active,
    mergeRequested: false,
    exportRequested: false,
    retryJobCreated: false,
    providerCalls: store.providerCalls,
  });
  return {
    status: "created",
    decisionId: input.facts.decisionId,
    expectedRevision: expected,
  };
}

export function emptyPhase11ACorrectedComposedRejectStore(input: {
  composedAssetId: string;
  parentAssetId: string;
  rejectedComposed100Id: string;
  rejectedComposed100DecisionId: string;
  rejectedSmokeId: string;
  composedChecksum: string;
  productionResultRevision: number;
}): Phase11ACorrectedComposedRejectStore {
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
