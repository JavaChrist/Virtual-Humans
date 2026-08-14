/**
 * Phase 11A composed-asset Human Review REJECT — no provider, no Storage.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPhase11AComposedProductionResult } from "../phase-11a-composed-execution-scaffold";
import { assertPhase11APayloadHasNoMediaLeak } from "../phase-11a-human-review-reject";
import {
  applyPhase11AComposedRejectToAssetProvenance,
  applyPhase11AComposedRejectToProductionResult,
  applyPhase11AComposedRejectToRunState,
  assertPhase11AComposedRequestedDecisionIsReject,
  buildPhase11AComposedRejectReviewRequestId,
  emptyPhase11AComposedRejectStore,
  persistPhase11AComposedHumanRejectOnce,
  phase11AComposedRejectIdempotencyKey,
  PHASE_11A_COMPOSED_HR_REJECT_AUTH,
  PHASE_11A_COMPOSED_HR_REJECT_COMMENT,
  PHASE_11A_COMPOSED_HR_REJECT_ISSUE_CODE,
  type Phase11AComposedRejectFacts,
} from "../phase-11a-composed-human-review-reject";

const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const COMPOSED_ID = "6a2beca9-d938-5c07-9502-911680d01bea";
const PARENT_ID = "7832765d-45e9-4bcd-923b-d7dbfd023f60";
const LEGACY_ID = "5d68ef64-9219-41c8-bb2d-59079a9bcee9";
const CHECKSUM = "d056b85aa4f9452d750760fd632f55616281a2aa80c658212ac988a443325efa";
const QR_ID = "05b64a29-cd2c-45cb-915c-88eb9713e8db";
const DECISION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-555555555555";

function facts(): Phase11AComposedRejectFacts {
  return {
    composedAssetId: COMPOSED_ID,
    parentAssetId: PARENT_ID,
    composedChecksumSha256: CHECKSUM,
    qualityReportId: QR_ID,
    reviewRequestId: buildPhase11AComposedRejectReviewRequestId({
      projectId: PROJECT_ID,
      composedAssetId: COMPOSED_ID,
    }),
    decisionId: DECISION_ID,
    nowIso: "2026-08-14T15:05:00.000Z",
  };
}

function store() {
  return emptyPhase11AComposedRejectStore({
    composedAssetId: COMPOSED_ID,
    parentAssetId: PARENT_ID,
    legacyRejectedAssetId: LEGACY_ID,
    composedChecksum: CHECKSUM,
    productionResultRevision: 3,
  });
}

test("11A-COMPOSE-HR-REJECT — auth, comment and issue code are bound", () => {
  assert.equal(PHASE_11A_COMPOSED_HR_REJECT_AUTH, "AUTH_11A_COMPOSED_ASSET_HUMAN_REVIEW_REJECT_ONCE");
  assert.equal(PHASE_11A_COMPOSED_HR_REJECT_ISSUE_CODE, "human.corrupted_overlay_glyphs");
  assert.match(PHASE_11A_COMPOSED_HR_REJECT_COMMENT, /glyphes corrompus/);
  assert.doesNotThrow(() => assertPhase11AComposedRequestedDecisionIsReject("rejected"));
  assert.throws(() => assertPhase11AComposedRequestedDecisionIsReject("approved"), /BLOCKED_DECISION_CONFLICT/);
  assert.throws(
    () => assertPhase11AComposedRequestedDecisionIsReject("retry_updated_constraints"),
    /BLOCKED_DECISION_CONFLICT/,
  );
});

test("11A-COMPOSE-HR-REJECT — reviewRequestId is stable and reject-specific", () => {
  const a = buildPhase11AComposedRejectReviewRequestId({
    projectId: PROJECT_ID,
    composedAssetId: COMPOSED_ID,
  });
  const b = buildPhase11AComposedRejectReviewRequestId({
    projectId: PROJECT_ID,
    composedAssetId: COMPOSED_ID,
  });
  assert.equal(a, b);
  assert.match(a, /^11a-compose-hr-reject-[a-f0-9]{24}$/);
});

test("11A-COMPOSE-HR-REJECT — persist once then replay existing", () => {
  const s = store();
  const f = facts();
  const key = phase11AComposedRejectIdempotencyKey(f.reviewRequestId);
  const first = persistPhase11AComposedHumanRejectOnce(s, {
    requestedDecision: "rejected",
    facts: f,
    idempotencyKey: key,
  });
  const replay = persistPhase11AComposedHumanRejectOnce(s, {
    requestedDecision: "rejected",
    facts: { ...f, decisionId: "aaaaaaaa-bbbb-4ccc-8ddd-666666666666" },
    idempotencyKey: key,
  });
  assert.equal(first.status, "created");
  assert.equal(replay.status, "existing");
  if (first.status === "created" && replay.status === "existing") {
    assert.equal(replay.decisionId, first.decisionId);
    assert.equal(first.expectedRevision, 3);
  }
  assert.equal(s.decisions.length, 1);
  assert.equal(s.composed.status, "rejected");
  assert.equal(s.composed.active, false);
  assert.equal(s.parent.status, "pending_review");
  assert.equal(s.parent.active, false);
  assert.equal(s.rejectedLegacy.status, "rejected");
  assert.equal(s.storageWrites, 0);
  assert.equal(s.providerCalls, 0);
  assert.equal(s.ledgerWrites, 0);
});

test("11A-COMPOSE-HR-REJECT — stale revision and checksum mismatch are fail-closed", () => {
  const stale = persistPhase11AComposedHumanRejectOnce(store(), {
    requestedDecision: "rejected",
    facts: facts(),
    idempotencyKey: "hr-decision:stale",
    expectedProductionResultRevision: 99,
  });
  assert.equal(stale.status, "conflict");
  if (stale.status === "conflict") assert.equal(stale.reason, "optimistic_conflict");

  const checksum = persistPhase11AComposedHumanRejectOnce(store(), {
    requestedDecision: "rejected",
    facts: { ...facts(), composedChecksumSha256: "0".repeat(64) },
    idempotencyKey: "hr-decision:checksum",
  });
  assert.equal(checksum.status, "conflict");
  if (checksum.status === "conflict") assert.equal(checksum.reason, "checksum_mismatch");
});

test("11A-COMPOSE-HR-REJECT — delivery blocked and parent stays reusable", () => {
  const pr = buildPhase11AComposedProductionResult({
    qualityReportId: QR_ID,
    productionResultId: "6dc0ec6f-c67d-4658-96ab-1bb06fdb3bf1",
    projectId: PROJECT_ID,
    createdBy: "phase-11a-compose-execution",
    correlationId: "corr-11a-compose-hr-reject",
    nowIso: "2026-08-14T15:05:00.000Z",
    runId: "39329a01-a0b0-4744-a7d3-308d258cd73b",
    jobId: "edc6e84a-9181-4607-8e42-3e6c6e9344f3",
    parentAssetId: PARENT_ID,
    composedAssetId: COMPOSED_ID,
    composedChecksumSha256: CHECKSUM,
    composedByteLength: 1_310_249,
    overlayFingerprint: "fdfae63fe1c7d003d9e4190bf0aea904fdab59caa2ddad5c2972cb6c39a423b9",
    compositorVersion: "phase-11a-bitmap-compositor-1.0.0",
    generationPlanArtifactId: "a55bd426-aaaa-4bbb-8ccc-dddddddddddd",
    estimatedCostMinor: 1,
    committedCostMinor: 1,
    typographicStatus: "accepted",
    contrastRatio: 15.006,
  });
  const rejected = applyPhase11AComposedRejectToProductionResult({
    productionResult: pr,
    facts: facts(),
  });
  assert.equal(rejected.delivery?.status, "blocked");
  assert.equal(
    (rejected as { phase11a?: { parentAssetDecision?: string; compositorVisual?: string } }).phase11a
      ?.parentAssetDecision,
    "UNCHANGED_PENDING_REVIEW",
  );
  assert.equal(
    (rejected as { phase11a?: { compositorVisual?: string } }).phase11a?.compositorVisual,
    "FAIL",
  );
  assertPhase11APayloadHasNoMediaLeak(rejected);
  assert.equal(/https?:\/\//i.test(JSON.stringify(rejected)), false);

  const provenance = applyPhase11AComposedRejectToAssetProvenance(
    { active: false, mediaRole: "composed_overlay_image", parentAssetId: PARENT_ID },
    { reviewRequestId: facts().reviewRequestId, decisionId: DECISION_ID, parentAssetId: PARENT_ID },
  );
  assert.equal(provenance.active, false);
  assert.equal(provenance.lifecycle, "rejected");
  assert.equal(provenance.parentAssetDecision, "UNCHANGED_PENDING_REVIEW");

  const runState = applyPhase11AComposedRejectToRunState(
    { waitingReason: "needs_review", status: "completed" },
    {
      nowIso: facts().nowIso,
      reviewRequestId: facts().reviewRequestId,
      decisionId: DECISION_ID,
    },
  );
  assert.equal(runState.waitingReason, undefined);
  assert.equal(runState.status, "completed");
});
