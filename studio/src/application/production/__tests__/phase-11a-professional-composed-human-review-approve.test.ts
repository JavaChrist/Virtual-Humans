/**
 * Phase 11A professional composed-asset Human Review APPROVE — no provider, no Storage.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPhase11AComposedProductionResult } from "../phase-11a-composed-execution-scaffold";
import { assertPhase11APayloadHasNoMediaLeak } from "../phase-11a-human-review-reject";
import { assertPhase11AOverlayPipelineGuards } from "../phase-11a-overlay-review";
import { PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME } from "../phase-11a-deterministic-compositor";
import {
  applyPhase11AProfessionalApproveToAssetProvenance,
  applyPhase11AProfessionalApproveToProductionResult,
  applyPhase11AProfessionalApproveToRunState,
  assertPhase11AApprovedRemainsInactive,
  assertPhase11AProfessionalApproveAttestation,
  assertPhase11AProfessionalQualityReportScope,
  assertPhase11AProfessionalRequestedDecisionIsApprove,
  emptyPhase11AProfessionalApproveStore,
  persistPhase11AProfessionalHumanApproveOnce,
  phase11AProfessionalApproveIdempotencyKey,
  resolvePhase11AProfessionalReviewRequestId,
  PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID,
  PHASE_11A_PROFESSIONAL_COMPOSED_CHECKSUM,
  PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_AUTH,
  PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT,
  PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_ISSUE_CODE,
  PHASE_11A_PROFESSIONAL_REVIEW_REQUEST_PREFIX,
  type Phase11AProfessionalApproveFacts,
} from "../phase-11a-professional-composed-human-review-approve";

const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const PARENT_ID = "7832765d-45e9-4bcd-923b-d7dbfd023f60";
const REJECTED_110_ID = "4429654f-9bf9-5525-92ed-41d6718e9481";
const REJECTED_110_DECISION = "058faa7d-0000-4000-8000-000000000000";
const REJECTED_100_ID = "6a2beca9-d938-5c07-9502-911680d01bea";
const REJECTED_100_DECISION = "f1fcb832-0000-4000-8000-000000000000";
const SMOKE_ID = "5d68ef64-9219-41c8-bb2d-59079a9bcee9";
const QR_ID = "81b7acb6-0000-4000-8000-000000000000";
const DECISION_ID = "cccccccc-dddd-4eee-8fff-666666666666";

function facts(): Phase11AProfessionalApproveFacts {
  return {
    composedAssetId: PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID,
    parentAssetId: PARENT_ID,
    composedChecksumSha256: PHASE_11A_PROFESSIONAL_COMPOSED_CHECKSUM,
    qualityReportId: QR_ID,
    reviewRequestId: resolvePhase11AProfessionalReviewRequestId({
      projectId: PROJECT_ID,
      composedAssetId: PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID,
    }),
    decisionId: DECISION_ID,
    nowIso: "2026-08-14T19:56:00.000Z",
  };
}

function store() {
  return emptyPhase11AProfessionalApproveStore({
    composedAssetId: PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID,
    parentAssetId: PARENT_ID,
    rejectedComposed110Id: REJECTED_110_ID,
    rejectedComposed110DecisionId: REJECTED_110_DECISION,
    rejectedComposed100Id: REJECTED_100_ID,
    rejectedComposed100DecisionId: REJECTED_100_DECISION,
    rejectedSmokeId: SMOKE_ID,
    composedChecksum: PHASE_11A_PROFESSIONAL_COMPOSED_CHECKSUM,
    productionResultRevision: 7,
  });
}

test("11A-PROFESSIONAL-HR-APPROVE — auth, attestation, request id, decision bound", () => {
  assert.equal(
    PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_AUTH,
    "AUTH_11A_PROFESSIONAL_COMPOSED_ASSET_HUMAN_REVIEW_APPROVE_ONCE",
  );
  assert.equal(
    PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_ISSUE_CODE,
    "human.professional_overlay_visual_approved",
  );
  assert.match(PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT, /Rendu professionnel validé/);
  assert.doesNotThrow(() =>
    assertPhase11AProfessionalApproveAttestation(PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT),
  );
  assert.throws(() => assertPhase11AProfessionalApproveAttestation("autre"), /ATTESTATION/);
  assert.doesNotThrow(() => assertPhase11AProfessionalRequestedDecisionIsApprove("approved"));
  assert.throws(() => assertPhase11AProfessionalRequestedDecisionIsApprove("rejected"), /BLOCKED_DECISION_CONFLICT/);
  const reviewRequestId = facts().reviewRequestId;
  assert.equal(reviewRequestId.startsWith(PHASE_11A_PROFESSIONAL_REVIEW_REQUEST_PREFIX), true);
  assertPhase11APayloadHasNoMediaLeak({ comment: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT });
});

test("11A-PROFESSIONAL-HR-APPROVE — persist created, replay existing, stale and payload conflict", () => {
  const s = store();
  const f = facts();
  const key = phase11AProfessionalApproveIdempotencyKey(f.reviewRequestId);
  const created = persistPhase11AProfessionalHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: f,
    idempotencyKey: key,
    comment: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT,
    expectedProductionResultRevision: 7,
  });
  assert.equal(created.status, "created");
  if (created.status !== "created") throw new Error("expected created");
  assert.equal(created.expectedRevision, 7);
  assert.equal(s.composed.status, "approved");
  assert.equal(s.composed.active, false);
  assert.equal(s.decisions.length, 1);
  const replay = persistPhase11AProfessionalHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: { ...f, decisionId: "dddddddd-eeee-4fff-8000-777777777777" },
    idempotencyKey: key,
    comment: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT,
    expectedProductionResultRevision: 7,
  });
  assert.equal(replay.status, "existing");
  if (replay.status !== "existing") throw new Error("expected existing");
  assert.equal(replay.decisionId, DECISION_ID);
  assert.equal(s.decisions.length, 1);
  const stale = persistPhase11AProfessionalHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: { ...f, decisionId: "eeeeeeee-ffff-4000-8000-888888888888", reviewRequestId: "11a-compose-hr-f0a6f908other" },
    idempotencyKey: key + ":stale",
    comment: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT,
    expectedProductionResultRevision: 99,
  });
  assert.equal(stale.status, "conflict");
  const payload = persistPhase11AProfessionalHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: f,
    idempotencyKey: key,
    comment: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT,
  });
  assert.equal(payload.status, "existing");
});

test("11A-PROFESSIONAL-HR-APPROVE — PR/asset/run stay inactive, delivery merge_ready, no leak", () => {
  const f = facts();
  const pr = buildPhase11AComposedProductionResult({
    qualityReportId: QR_ID,
    productionResultId: "0f2aa24e-0000-4000-8000-000000000000",
    projectId: PROJECT_ID,
    createdBy: "phase-11a-professional-recomposition",
    correlationId: "corr-11a-professional-hr-approve",
    nowIso: f.nowIso,
    runId: "39329a01-aaaa-4bbb-8ccc-dddddddddddd",
    jobId: "edc6e84a-aaaa-4bbb-8ccc-dddddddddddd",
    parentAssetId: PARENT_ID,
    composedAssetId: PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID,
    composedChecksumSha256: PHASE_11A_PROFESSIONAL_COMPOSED_CHECKSUM,
    composedByteLength: 1_338_305,
    overlayFingerprint: "4cfcc445f41ca453".padEnd(64, "0"),
    compositorVersion: "phase-11a-vector-compositor-1.2.0",
    generationPlanArtifactId: "a55bd426-aaaa-4bbb-8ccc-dddddddddddd",
    estimatedCostMinor: 1,
    committedCostMinor: 1,
    typographicStatus: "accepted",
    contrastRatio: 14.67,
  });
  const nextPr = applyPhase11AProfessionalApproveToProductionResult({ productionResult: pr, facts: f });
  assert.equal(nextPr.delivery?.status, "merge_ready");
  assert.equal((nextPr as { phase11a?: { outputActive?: boolean } }).phase11a?.outputActive, false);
  assert.equal((nextPr as { phase11a?: { mergeExportAuthorized?: boolean } }).phase11a?.mergeExportAuthorized, false);
  assert.equal((nextPr as { phase11a?: { humanReviewDecision?: string } }).phase11a?.humanReviewDecision, "approved");
  const prov = applyPhase11AProfessionalApproveToAssetProvenance(
    { active: false, compositorVersion: "phase-11a-vector-compositor-1.2.0" },
    { reviewRequestId: f.reviewRequestId, decisionId: f.decisionId, parentAssetId: PARENT_ID },
  );
  assert.equal(prov.active, false);
  assert.equal(prov.lifecycle, "approved");
  const run = applyPhase11AProfessionalApproveToRunState(
    { waitingReason: "needs_review", status: "completed" },
    { nowIso: f.nowIso, reviewRequestId: f.reviewRequestId, decisionId: f.decisionId },
  );
  assert.equal(run.waitingReason, undefined);
  assertPhase11APayloadHasNoMediaLeak(nextPr);
  assertPhase11APayloadHasNoMediaLeak(prov);
  assertPhase11APayloadHasNoMediaLeak(run);
  assertPhase11AApprovedRemainsInactive({
    decision: "approved",
    active: false,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
    providerCalls: 0,
  });
  assert.throws(
    () =>
      assertPhase11AApprovedRemainsInactive({
        decision: "approved",
        active: true,
        published: false,
        mergeRequested: false,
        exportRequested: false,
        downstreamRequested: false,
        providerCalls: 0,
      }),
    /active/,
  );
});

test("11A-PROFESSIONAL-HR-APPROVE — QC scope, historical rejects untouched, guards", () => {
  assert.doesNotThrow(() =>
    assertPhase11AProfessionalQualityReportScope(
      {
        kind: "phase_11a_composed_overlay_quality_report",
        technicalStatus: "pass",
        typographicStatus: "pass",
        humanReviewDecision: null,
        asset: { id: PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID },
      },
      PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID,
    ),
  );
  assert.throws(
    () =>
      assertPhase11AProfessionalQualityReportScope(
        {
          kind: "phase_11a_composed_overlay_quality_report",
          technicalStatus: "fail",
          typographicStatus: "pass",
          humanReviewDecision: null,
          asset: { id: PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID },
        },
        PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID,
      ),
    /QC_REJECT/,
  );
  const s = store();
  assert.equal(s.rejectedComposed110.status, "rejected");
  assert.equal(s.rejectedComposed100.status, "rejected");
  assert.equal(s.rejectedSmoke.status, "rejected");
  assert.equal(s.parent.status, "pending_review");
  assertPhase11AOverlayPipelineGuards({
    overlayRuntime: PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
    legacyEndpoint: false,
    motionReferenced: false,
    downstreamRequested: false,
    humanReviewPresent: true,
    providerCalls: 0,
  });
});
