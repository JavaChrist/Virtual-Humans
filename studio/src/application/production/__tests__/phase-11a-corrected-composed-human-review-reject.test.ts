/**
 * Phase 11A corrected composed-asset Human Review REJECT — no provider, no Storage.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPhase11AComposedProductionResult } from "../phase-11a-composed-execution-scaffold";
import { assertPhase11APayloadHasNoMediaLeak } from "../phase-11a-human-review-reject";
import {
  applyPhase11ACorrectedComposedRejectToAssetProvenance,
  applyPhase11ACorrectedComposedRejectToProductionResult,
  applyPhase11ACorrectedComposedRejectToRunState,
  assertPhase11ACorrectedComposedRequestedDecisionIsReject,
  buildPhase11ACorrectedComposedRejectReviewRequestId,
  emptyPhase11ACorrectedComposedRejectStore,
  persistPhase11ACorrectedComposedHumanRejectOnce,
  phase11ACorrectedComposedRejectIdempotencyKey,
  PHASE_11A_CORRECTED_ATLAS_VERSION,
  PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_AUTH,
  PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_COMMENT,
  PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_ISSUE_CODE,
  PHASE_11A_CORRECTED_COMPOSITOR_VERSION,
  type Phase11ACorrectedComposedRejectFacts,
} from "../phase-11a-corrected-composed-human-review-reject";

const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const COMPOSED_ID = "4429654f-9bf9-5525-92ed-41d6718e9481";
const PARENT_ID = "7832765d-45e9-4bcd-923b-d7dbfd023f60";
const REJECTED_100_ID = "6a2beca9-d938-5c07-9502-911680d01bea";
const REJECTED_100_DECISION = "f1fcb832-0000-4000-8000-000000000000";
const SMOKE_ID = "5d68ef64-9219-41c8-bb2d-59079a9bcee9";
const CHECKSUM = "b284e877e5a80e7af19a84fdce9db79f0ab1e31298b6f9b43fcb9e18a7921fe5";
const QR_ID = "ce3a2b6d-0000-4000-8000-000000000000";
const DECISION_ID = "bbbbbbbb-cccc-4ddd-8eee-555555555555";

function facts(): Phase11ACorrectedComposedRejectFacts {
  return {
    composedAssetId: COMPOSED_ID,
    parentAssetId: PARENT_ID,
    composedChecksumSha256: CHECKSUM,
    qualityReportId: QR_ID,
    reviewRequestId: buildPhase11ACorrectedComposedRejectReviewRequestId({
      projectId: PROJECT_ID,
      composedAssetId: COMPOSED_ID,
    }),
    decisionId: DECISION_ID,
    nowIso: "2026-08-14T16:40:00.000Z",
  };
}

function store() {
  return emptyPhase11ACorrectedComposedRejectStore({
    composedAssetId: COMPOSED_ID,
    parentAssetId: PARENT_ID,
    rejectedComposed100Id: REJECTED_100_ID,
    rejectedComposed100DecisionId: REJECTED_100_DECISION,
    rejectedSmokeId: SMOKE_ID,
    composedChecksum: CHECKSUM,
    productionResultRevision: 5,
  });
}

test("11A-CORRECTED-HR-REJECT — auth, comment and issue code are bound", () => {
  assert.equal(
    PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_AUTH,
    "AUTH_11A_CORRECTED_COMPOSED_ASSET_HUMAN_REVIEW_REJECT_ONCE",
  );
  assert.equal(
    PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_ISSUE_CODE,
    "human.overlay_typography_layout_not_production_ready",
  );
  assert.match(PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_COMMENT, /glyphes sont maintenant lisibles/);
  assert.match(PHASE_11A_CORRECTED_COMPOSED_HR_REJECT_COMMENT, /Studio/);
  assert.equal(PHASE_11A_CORRECTED_COMPOSITOR_VERSION, "phase-11a-bitmap-compositor-1.1.0");
  assert.equal(PHASE_11A_CORRECTED_ATLAS_VERSION, "vhs-overlay-latin-bitmap-shapes-v1");
  assert.doesNotThrow(() => assertPhase11ACorrectedComposedRequestedDecisionIsReject("rejected"));
  assert.throws(() => assertPhase11ACorrectedComposedRequestedDecisionIsReject("approved"), /BLOCKED_DECISION_CONFLICT/);
  assert.throws(
    () => assertPhase11ACorrectedComposedRequestedDecisionIsReject("retry_updated_constraints"),
    /BLOCKED_DECISION_CONFLICT/,
  );
});

test("11A-CORRECTED-HR-REJECT — reviewRequestId is stable and distinct from 1.0.0", () => {
  const a = buildPhase11ACorrectedComposedRejectReviewRequestId({
    projectId: PROJECT_ID,
    composedAssetId: COMPOSED_ID,
  });
  const b = buildPhase11ACorrectedComposedRejectReviewRequestId({
    projectId: PROJECT_ID,
    composedAssetId: COMPOSED_ID,
  });
  assert.equal(a, b);
  assert.match(a, /^11a-corrected-compose-hr-reject-[a-f0-9]{24}$/);
  const other = buildPhase11ACorrectedComposedRejectReviewRequestId({
    projectId: PROJECT_ID,
    composedAssetId: REJECTED_100_ID,
  });
  assert.notEqual(a, other);
});

test("11A-CORRECTED-HR-REJECT — persist once then replay existing", () => {
  const s = store();
  const f = facts();
  const key = phase11ACorrectedComposedRejectIdempotencyKey(f.reviewRequestId);
  const first = persistPhase11ACorrectedComposedHumanRejectOnce(s, {
    requestedDecision: "rejected",
    facts: f,
    idempotencyKey: key,
  });
  const replay = persistPhase11ACorrectedComposedHumanRejectOnce(s, {
    requestedDecision: "rejected",
    facts: { ...f, decisionId: "bbbbbbbb-cccc-4ddd-8eee-666666666666" },
    idempotencyKey: key,
  });
  assert.equal(first.status, "created");
  assert.equal(replay.status, "existing");
  if (first.status === "created" && replay.status === "existing") {
    assert.equal(replay.decisionId, first.decisionId);
    assert.equal(first.expectedRevision, 5);
  }
  assert.equal(s.decisions.length, 1);
  assert.equal(s.composed.status, "rejected");
  assert.equal(s.composed.active, false);
  assert.equal(s.parent.status, "pending_review");
  assert.equal(s.parent.active, false);
  assert.equal(s.rejectedComposed100.status, "rejected");
  assert.equal(s.rejectedComposed100.decisionId, REJECTED_100_DECISION);
  assert.equal(s.rejectedSmoke.status, "rejected");
  assert.equal(s.storageWrites, 0);
  assert.equal(s.providerCalls, 0);
  assert.equal(s.ledgerWrites, 0);
});

test("11A-CORRECTED-HR-REJECT — stale revision and checksum mismatch are fail-closed", () => {
  const stale = persistPhase11ACorrectedComposedHumanRejectOnce(store(), {
    requestedDecision: "rejected",
    facts: facts(),
    idempotencyKey: "hr-decision:stale",
    expectedProductionResultRevision: 99,
  });
  assert.equal(stale.status, "conflict");
  if (stale.status === "conflict") assert.equal(stale.reason, "optimistic_conflict");

  const checksum = persistPhase11ACorrectedComposedHumanRejectOnce(store(), {
    requestedDecision: "rejected",
    facts: { ...facts(), composedChecksumSha256: "0".repeat(64) },
    idempotencyKey: "hr-decision:checksum",
  });
  assert.equal(checksum.status, "conflict");
  if (checksum.status === "conflict") assert.equal(checksum.reason, "checksum_mismatch");
});

test("11A-CORRECTED-HR-REJECT — delivery blocked, glyphs PASS, layout FAIL", () => {
  const pr = buildPhase11AComposedProductionResult({
    qualityReportId: QR_ID,
    productionResultId: "a5a109e3-0000-4000-8000-000000000000",
    projectId: PROJECT_ID,
    createdBy: "phase-11a-corrected-recomposition",
    correlationId: "corr-11a-corrected-hr-reject",
    nowIso: "2026-08-14T16:40:00.000Z",
    runId: "39329a01-a0b0-4744-a7d3-308d258cd73b",
    jobId: "edc6e84a-9181-4607-8e42-3e6c6e9344f3",
    parentAssetId: PARENT_ID,
    composedAssetId: COMPOSED_ID,
    composedChecksumSha256: CHECKSUM,
    composedByteLength: 1_309_704,
    overlayFingerprint: "fdfae63fe1c7d003d9e4190bf0aea904fdab59caa2ddad5c2972cb6c39a423b9",
    compositorVersion: PHASE_11A_CORRECTED_COMPOSITOR_VERSION,
    generationPlanArtifactId: "a55bd426-aaaa-4bbb-8ccc-dddddddddddd",
    estimatedCostMinor: 1,
    committedCostMinor: 1,
    typographicStatus: "accepted",
    contrastRatio: 15.01,
  });
  const rejected = applyPhase11ACorrectedComposedRejectToProductionResult({
    productionResult: pr,
    facts: facts(),
  });
  assert.equal(rejected.delivery?.status, "blocked");
  const note = rejected as {
    phase11a?: {
      parentAssetDecision?: string;
      glyphPipeline?: string;
      typographicLayout?: string;
      readability?: string;
    };
  };
  assert.equal(note.phase11a?.parentAssetDecision, "UNCHANGED_PENDING_REVIEW");
  assert.equal(note.phase11a?.glyphPipeline, "PASS");
  assert.equal(note.phase11a?.readability, "PASS");
  assert.equal(note.phase11a?.typographicLayout, "FAIL");
  assertPhase11APayloadHasNoMediaLeak(rejected);
  assert.equal(/https?:\/\//i.test(JSON.stringify(rejected)), false);

  const provenance = applyPhase11ACorrectedComposedRejectToAssetProvenance(
    {
      active: false,
      mediaRole: "composed_overlay_image",
      parentAssetId: PARENT_ID,
      compositorVersion: PHASE_11A_CORRECTED_COMPOSITOR_VERSION,
      atlasVersion: PHASE_11A_CORRECTED_ATLAS_VERSION,
    },
    { reviewRequestId: facts().reviewRequestId, decisionId: DECISION_ID, parentAssetId: PARENT_ID },
  );
  assert.equal(provenance.active, false);
  assert.equal(provenance.lifecycle, "rejected");
  assert.equal(provenance.glyphPipeline, "PASS");
  assert.equal(provenance.typographicLayout, "FAIL");

  const runState = applyPhase11ACorrectedComposedRejectToRunState(
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
