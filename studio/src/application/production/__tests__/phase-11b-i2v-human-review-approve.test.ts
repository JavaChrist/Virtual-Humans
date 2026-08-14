/**
 * Phase 11B I2V Human Review APPROVE — no provider, no Storage, no flags.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPhase11APayloadHasNoMediaLeak } from "../phase-11a-human-review-reject";
import {
  applyPhase11BI2vApproveToAssetProvenance,
  applyPhase11BI2vApproveToProductionResult,
  applyPhase11BI2vApproveToRunState,
  assertPhase11BI2vApprovedRemainsInactive,
  assertPhase11BI2vApproveAttestation,
  assertPhase11BI2vQualityReportScope,
  assertPhase11BI2vRequestedDecisionIsApprove,
  emptyPhase11BI2vApproveStore,
  persistPhase11BI2vHumanApproveOnce,
  phase11BI2vApproveIdempotencyKey,
  resolvePhase11BI2vReviewRequestId,
  PHASE_11B_I2V_HR_APPROVE_AUTH,
  PHASE_11B_I2V_HR_APPROVE_COMMENT,
  PHASE_11B_I2V_HR_APPROVE_ISSUE_CODE,
  PHASE_11B_I2V_PARENT_ASSET_ID,
  PHASE_11B_I2V_REVIEW_REQUEST_PREFIX,
  PHASE_11B_I2V_VIDEO_ASSET_ID,
  PHASE_11B_I2V_VIDEO_BYTES,
  PHASE_11B_I2V_VIDEO_CHECKSUM,
  type Phase11BI2vApproveFacts,
} from "../phase-11b-i2v-human-review-approve";

const QR_ID = "0da85052-0000-4000-8000-000000000000";
const DECISION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function facts(): Phase11BI2vApproveFacts {
  return {
    videoAssetId: PHASE_11B_I2V_VIDEO_ASSET_ID,
    parentAssetId: PHASE_11B_I2V_PARENT_ASSET_ID,
    videoChecksumSha256: PHASE_11B_I2V_VIDEO_CHECKSUM,
    qualityReportId: QR_ID,
    reviewRequestId: resolvePhase11BI2vReviewRequestId(PHASE_11B_I2V_VIDEO_ASSET_ID),
    decisionId: DECISION_ID,
    nowIso: "2026-08-15T01:30:00.000Z",
  };
}

function store() {
  return emptyPhase11BI2vApproveStore({
    videoAssetId: PHASE_11B_I2V_VIDEO_ASSET_ID,
    parentAssetId: PHASE_11B_I2V_PARENT_ASSET_ID,
    videoChecksum: PHASE_11B_I2V_VIDEO_CHECKSUM,
    productionResultRevision: 9,
  });
}

test("11B-I2V-HR-APPROVE — auth, target, attestation, request id", () => {
  assert.equal(PHASE_11B_I2V_HR_APPROVE_AUTH, "AUTH_11B_I2V_HUMAN_REVIEW_APPROVE_ONCE");
  assert.equal(PHASE_11B_I2V_HR_APPROVE_ISSUE_CODE, "human.i2v_visual_approved");
  assert.equal(PHASE_11B_I2V_VIDEO_ASSET_ID, "9be6cb0c-45ee-40f6-b433-02b62d81a283");
  assert.equal(PHASE_11B_I2V_VIDEO_BYTES, 1_629_267);
  assert.doesNotThrow(() => assertPhase11BI2vApproveAttestation(PHASE_11B_I2V_HR_APPROVE_COMMENT));
  assert.throws(() => assertPhase11BI2vApproveAttestation("autre"), /ATTESTATION/);
  assert.doesNotThrow(() => assertPhase11BI2vRequestedDecisionIsApprove("approved"));
  assert.throws(() => assertPhase11BI2vRequestedDecisionIsApprove("rejected"), /CONFLICT/);
  const reviewRequestId = facts().reviewRequestId;
  assert.equal(reviewRequestId.startsWith(PHASE_11B_I2V_REVIEW_REQUEST_PREFIX), true);
  assertPhase11APayloadHasNoMediaLeak({ comment: PHASE_11B_I2V_HR_APPROVE_COMMENT });
});

test("11B-I2V-HR-APPROVE — persist created, replay existing, stale conflict, no double", () => {
  const s = store();
  const f = facts();
  const key = phase11BI2vApproveIdempotencyKey(f.reviewRequestId);
  const created = persistPhase11BI2vHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: f,
    idempotencyKey: key,
    comment: PHASE_11B_I2V_HR_APPROVE_COMMENT,
    expectedProductionResultRevision: 9,
  });
  assert.equal(created.status, "created");
  if (created.status !== "created") throw new Error("expected created");
  assert.equal(created.expectedRevision, 9);
  assert.equal(s.video.status, "approved");
  assert.equal(s.video.active, false);
  assert.equal(s.decisions.length, 1);
  const replay = persistPhase11BI2vHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: { ...f, decisionId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff" },
    idempotencyKey: key,
    comment: PHASE_11B_I2V_HR_APPROVE_COMMENT,
    expectedProductionResultRevision: 9,
  });
  assert.equal(replay.status, "existing");
  if (replay.status !== "existing") throw new Error("expected existing");
  assert.equal(replay.decisionId, DECISION_ID);
  assert.equal(s.decisions.length, 1);
  assert.equal(s.productionResultRevision, 10);
  const stale = persistPhase11BI2vHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: {
      ...f,
      decisionId: "cccccccc-dddd-4eee-8fff-000000000000",
      reviewRequestId: "11b-i2v-hr-9be6cb0c:other",
    },
    idempotencyKey: `${key}:stale`,
    comment: PHASE_11B_I2V_HR_APPROVE_COMMENT,
    expectedProductionResultRevision: 99,
  });
  assert.equal(stale.status, "conflict");
  if (stale.status !== "conflict") throw new Error("expected conflict");
  assert.equal(stale.reason, "optimistic_conflict");
  assert.equal(s.decisions.length, 1);
});

test("11B-I2V-HR-APPROVE — checksum/parent/request divergence fail closed", () => {
  const s = store();
  const f = facts();
  const key = phase11BI2vApproveIdempotencyKey(f.reviewRequestId);
  const checksum = persistPhase11BI2vHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: { ...f, videoChecksumSha256: "0".repeat(64) },
    idempotencyKey: key,
    comment: PHASE_11B_I2V_HR_APPROVE_COMMENT,
  });
  assert.equal(checksum.status, "conflict");
  const parent = persistPhase11BI2vHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: { ...f, parentAssetId: "00000000-0000-4000-8000-000000000000" },
    idempotencyKey: key,
    comment: PHASE_11B_I2V_HR_APPROVE_COMMENT,
  });
  assert.equal(parent.status, "conflict");
  const request = persistPhase11BI2vHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: { ...f, reviewRequestId: "wrong-request" },
    idempotencyKey: "hr-decision:wrong-request",
    comment: PHASE_11B_I2V_HR_APPROVE_COMMENT,
  });
  assert.equal(request.status, "conflict");
  assert.equal(s.decisions.length, 0);
  assert.equal(s.video.status, "pending_review");
});

test("11B-I2V-HR-APPROVE — PR/asset/run stay inactive, delivery not a merge auth", () => {
  const f = facts();
  const nextPr = applyPhase11BI2vApproveToProductionResult({
    productionResult: {
      capability: "video.image_to_video",
      videoAssetId: PHASE_11B_I2V_VIDEO_ASSET_ID,
      sourceAssetId: PHASE_11B_I2V_PARENT_ASSET_ID,
      active: false,
      published: false,
      downstream: false,
      reviewRequest: { pending: true, decision: null, humanReviewRequired: true },
    },
    facts: f,
  });
  const delivery = nextPr.delivery as { status?: string };
  const phase = nextPr.phase11b as {
    outputActive?: boolean;
    mergeExportAuthorized?: boolean;
    humanReviewDecision?: string;
  };
  assert.equal(delivery.status, "merge_ready");
  assert.equal(phase.outputActive, false);
  assert.equal(phase.mergeExportAuthorized, false);
  assert.equal(phase.humanReviewDecision, "approved");
  const prov = applyPhase11BI2vApproveToAssetProvenance(
    { active: false, mediaRole: "i2v_output_video" },
    {
      reviewRequestId: f.reviewRequestId,
      decisionId: f.decisionId,
      parentAssetId: PHASE_11B_I2V_PARENT_ASSET_ID,
    },
  );
  assert.equal(prov.active, false);
  assert.equal(prov.published, false);
  assert.equal(prov.lifecycle, "approved");
  const run = applyPhase11BI2vApproveToRunState(
    {
      waitingReason: "needs_review",
      status: "completed",
      reviewRequest: { pending: true },
    },
    { nowIso: f.nowIso, reviewRequestId: f.reviewRequestId, decisionId: f.decisionId },
  );
  assert.equal(run.waitingReason, undefined);
  assert.equal((run.reviewRequest as { pending?: boolean }).pending, false);
  assertPhase11APayloadHasNoMediaLeak(nextPr);
  assertPhase11APayloadHasNoMediaLeak(prov);
  assertPhase11APayloadHasNoMediaLeak(run);
  assertPhase11BI2vApprovedRemainsInactive({
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
      assertPhase11BI2vApprovedRemainsInactive({
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

test("11B-I2V-HR-APPROVE — QC humanOnly, no auto-approve, no provider/downstream/budget", () => {
  assert.doesNotThrow(() =>
    assertPhase11BI2vQualityReportScope(
      {
        videoAssetId: PHASE_11B_I2V_VIDEO_ASSET_ID,
        technicalStatus: "needs_review",
        visualStatus: "unavailable_humanOnly",
        autoApprove: false,
        checksum: PHASE_11B_I2V_VIDEO_CHECKSUM,
        bytes: PHASE_11B_I2V_VIDEO_BYTES,
      },
      PHASE_11B_I2V_VIDEO_ASSET_ID,
    ),
  );
  assert.throws(
    () =>
      assertPhase11BI2vQualityReportScope(
        {
          videoAssetId: PHASE_11B_I2V_VIDEO_ASSET_ID,
          technicalStatus: "fail",
          visualStatus: "unavailable_humanOnly",
          autoApprove: false,
        },
        PHASE_11B_I2V_VIDEO_ASSET_ID,
      ),
    /QC_REJECT/,
  );
  const s = store();
  assert.equal(s.parent.status, "approved");
  assert.equal(s.parent.active, false);
  assert.equal(s.providerCalls, 0);
  assert.equal(s.ledgerWrites, 0);
  assert.equal(s.storageWrites, 0);
  assert.equal(s.flagsWritten, 0);
});
