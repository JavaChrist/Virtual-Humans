/**
 * Phase 11A — Human Review REJECT without regeneration.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PHASE_11A_SMOKE_PROJECT_ID } from "../phase-11a-openai-image-allowlist";
import {
  assertPhase11AActivationAllowed,
  assertPhase11AOutputNotAutoActive,
  assertPhase11ARejectedBlocksActivationAndDownstream,
} from "../phase-11a-human-review-gate";
import {
  applyPhase11AHumanRejectToProductionResult,
  applyPhase11ARejectToAssetProvenance,
  applyPhase11ARejectToRunState,
  assertPhase11APayloadHasNoMediaLeak,
  assertPhase11ARequestedDecisionIsReject,
  auditPhase11AReviewScaffold,
  buildPhase11AMinimalProductionResult,
  buildPhase11AMinimalQualityReport,
  buildPhase11ARejectReviewRequestId,
  emptyPhase11ARejectStore,
  persistPhase11AHumanRejectOnce,
  phase11ARejectIdempotencyKey,
  phase11ATechnicalVsHumanVerdict,
  PHASE_11A_HR_REJECT_AUTH,
  PHASE_11A_HR_REJECT_COMMENT,
  PHASE_11A_HR_REJECT_ISSUE_CODE,
  type Phase11ARejectFacts,
} from "../phase-11a-human-review-reject";

const ASSET_ID = "5d68ef64-9219-41c8-bb2d-59079a9bcee9";
const RUN_ID = "f43377a6-a8aa-4632-867f-370112aca7da";
const JOB_ID = "c9aa68e9-2a8c-4b92-adf3-2449c0bfef09";
const PLAN_ID = "437ae89d-acd3-4a1e-80c6-8666144e25fc";
const QR_ID = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const PR_ID = "aaaaaaaa-bbbb-4ccc-8ddd-222222222222";
const DECISION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-333333333333";
const CHECKSUM = "c508e3e54f2ccac74441f553e9c749cfca27e1092ca82fbaa24616645346e2f3";

function facts(overrides: Partial<Phase11ARejectFacts> = {}): Phase11ARejectFacts {
  return {
    qualityReportId: QR_ID,
    productionResultId: PR_ID,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    createdBy: "phase-11a-human-operator",
    correlationId: "corr-11a-hr-reject-once",
    nowIso: "2026-08-13T23:15:00.000Z",
    runId: RUN_ID,
    jobId: JOB_ID,
    attemptId: "step:scene-2:image:gpt-image-1:a1",
    assetId: ASSET_ID,
    generationPlanArtifactId: PLAN_ID,
    checksumSha256: CHECKSUM,
    sizeBytes: 1_035_500,
    estimatedCostMinor: 1,
    committedCostMinor: 1,
    ...overrides,
  };
}

function persistArgs(storeFacts = facts()) {
  const reviewRequestId = buildPhase11ARejectReviewRequestId({
    projectId: storeFacts.projectId,
    assetId: storeFacts.assetId,
  });
  return {
    requestedDecision: "rejected",
    facts: storeFacts,
    reviewRequestId,
    decisionId: DECISION_ID,
    idempotencyKey: phase11ARejectIdempotencyKey(reviewRequestId),
  };
}

test("11A HR REJECT — requested decision must be rejected", () => {
  assert.doesNotThrow(() => assertPhase11ARequestedDecisionIsReject("rejected"));
  assert.throws(() => assertPhase11ARequestedDecisionIsReject("approved"), /BLOCKED_DECISION_CONFLICT/);
  assert.throws(
    () => assertPhase11ARequestedDecisionIsReject("retry_updated_constraints"),
    /BLOCKED_DECISION_CONFLICT/,
  );
});

test("11A HR REJECT — reviewRequestId is stable", () => {
  const a = buildPhase11ARejectReviewRequestId({
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    assetId: ASSET_ID,
  });
  const b = buildPhase11ARejectReviewRequestId({
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    assetId: ASSET_ID,
  });
  assert.equal(a, b);
  assert.match(a, /^11a-hr-reject-[a-f0-9]{24}$/);
});

test("11A HR REJECT — scaffold absent creates unique QR + PR then one decision", () => {
  const store = emptyPhase11ARejectStore(ASSET_ID);
  const first = persistPhase11AHumanRejectOnce(store, persistArgs());
  assert.equal(first.status, "created");
  if (first.status !== "created") return;
  assert.equal(store.qualityReports.length, 1);
  assert.equal(store.productionResults.length, 2);
  assert.equal(store.decisions.length, 1);
  assert.equal(store.decisions[0]?.decision, "rejected");
  assert.equal(store.asset.status, "rejected");
  assert.equal(store.asset.active, false);
  assert.equal(first.qualityReport.revision, 1);
  assert.equal(first.expectedRevision, 1);
});

test("11A HR REJECT — scaffold existing is reused", () => {
  const f = facts();
  const qr = {
    id: QR_ID,
    revision: 1,
    value: buildPhase11AMinimalQualityReport(f) as unknown as Record<string, unknown>,
  };
  const pr = {
    id: PR_ID,
    revision: 1,
    value: buildPhase11AMinimalProductionResult(f) as unknown as Record<string, unknown>,
  };
  const store = emptyPhase11ARejectStore(ASSET_ID);
  store.qualityReports = [qr];
  store.productionResults = [pr];
  const result = persistPhase11AHumanRejectOnce(store, persistArgs(f));
  assert.equal(result.status, "created");
  assert.equal(store.qualityReports.length, 1);
  assert.equal(store.qualityReports[0]?.id, QR_ID);
  assert.equal(store.productionResults[0]?.id, PR_ID);
  assert.equal(store.decisions.length, 1);
});

test("11A HR REJECT — contradictory scaffold is fail-closed", () => {
  const audit = auditPhase11AReviewScaffold({
    qualityReports: [
      {
        id: "qr-other",
        revision: 1,
        value: { kind: "other", status: "accepted", asset: { id: "other-asset" } },
      },
    ],
    productionResults: [],
    expectedRunId: RUN_ID,
    expectedAssetId: ASSET_ID,
    expectedSceneId: "scene-2",
  });
  assert.equal(audit.status, "inconsistent");
  const store = emptyPhase11ARejectStore(ASSET_ID);
  store.qualityReports = [
    {
      id: "qr-other",
      revision: 1,
      value: { kind: "other", status: "accepted", asset: { id: "other-asset" } },
    },
  ];
  const result = persistPhase11AHumanRejectOnce(store, persistArgs());
  assert.equal(result.status, "inconsistent");
  assert.equal(store.decisions.length, 0);
});

test("11A HR REJECT — replay returns existing without a second decision", () => {
  const store = emptyPhase11ARejectStore(ASSET_ID);
  const args = persistArgs();
  const first = persistPhase11AHumanRejectOnce(store, args);
  const replay = persistPhase11AHumanRejectOnce(store, {
    ...args,
    decisionId: "aaaaaaaa-bbbb-4ccc-8ddd-444444444444",
  });
  assert.equal(first.status, "created");
  assert.equal(replay.status, "existing");
  if (replay.status !== "existing" || first.status !== "created") return;
  assert.equal(replay.decisionId, first.decisionId);
  assert.equal(store.decisions.length, 1);
  assert.equal(store.qualityReports.length, 1);
  assert.equal(store.jobsCreated, 0);
  assert.equal(store.retriesCreated, 0);
  assert.equal(store.ledgerWrites, 0);
  assert.equal(store.storageWrites, 0);
  assert.equal(store.providerCalls, 0);
});

test("11A HR REJECT — stale expectedRevision conflicts without a new write", () => {
  const f = facts();
  const store = emptyPhase11ARejectStore(ASSET_ID);
  store.qualityReports = [
    {
      id: QR_ID,
      revision: 1,
      value: buildPhase11AMinimalQualityReport(f) as unknown as Record<string, unknown>,
    },
  ];
  store.productionResults = [
    {
      id: PR_ID,
      revision: 1,
      value: buildPhase11AMinimalProductionResult(f) as unknown as Record<string, unknown>,
    },
  ];
  const conflict = persistPhase11AHumanRejectOnce(store, {
    ...persistArgs(f),
    expectedProductionResultRevision: 99,
  });
  assert.equal(conflict.status, "conflict");
  if (conflict.status === "conflict") {
    assert.equal(conflict.reason, "optimistic_conflict");
  }
  assert.equal(store.decisions.length, 0);
  assert.equal(store.productionResults.length, 1);
});

test("11A HR REJECT — distinct concurrent decision is refused", () => {
  const store = emptyPhase11ARejectStore(ASSET_ID);
  persistPhase11AHumanRejectOnce(store, persistArgs());
  const other = persistPhase11AHumanRejectOnce(store, {
    ...persistArgs(),
    idempotencyKey: "hr-decision:concurrent-other",
    decisionId: "aaaaaaaa-bbbb-4ccc-8ddd-666666666666",
  });
  assert.equal(other.status, "conflict");
  assert.equal(store.decisions.length, 1);
});

test("11A HR REJECT — asset stays inactive; no retry/job/ledger/storage/provider", () => {
  const store = emptyPhase11ARejectStore(ASSET_ID);
  persistPhase11AHumanRejectOnce(store, persistArgs());
  assert.equal(store.asset.active, false);
  assert.equal(store.asset.status, "rejected");
  assert.equal(store.jobsCreated, 0);
  assert.equal(store.retriesCreated, 0);
  assert.equal(store.ledgerWrites, 0);
  assert.equal(store.storageWrites, 0);
  assert.equal(store.providerCalls, 0);
  assertPhase11ARejectedBlocksActivationAndDownstream({
    decision: "rejected",
    active: false,
    mergeRequested: false,
    exportRequested: false,
    retryJobCreated: false,
    providerCalls: 0,
  });
  assert.throws(
    () =>
      assertPhase11AActivationAllowed({
        technicalQcStatus: "needs_review",
        reviews: [
          {
            decision: "rejected",
            decidedAt: "2026-08-13T23:15:00.000Z",
            actorId: "human",
            assetId: ASSET_ID,
            sequence: 1,
          },
        ],
      }),
    /approved/,
  );
});

test("11A HR REJECT — payloads have no URL or base64; technical PASS ≠ human reject", () => {
  const f = facts();
  const qr = buildPhase11AMinimalQualityReport(f);
  const pr = buildPhase11AMinimalProductionResult(f);
  assertPhase11APayloadHasNoMediaLeak(qr);
  assertPhase11APayloadHasNoMediaLeak(pr);
  assert.equal(qr.technicalStatus, "pass");
  assert.equal(qr.status, "needs_review");
  assert.equal(qr.visualQuality, "unavailable_humanOnly");
  assert.equal(qr.humanObservedDefect.measuredAutomatically, false);
  const rejected = applyPhase11AHumanRejectToProductionResult({
    productionResult: pr,
    decisionId: DECISION_ID,
    qualityReportId: QR_ID,
    reviewRequestId: "11a-hr-reject-test",
    nowIso: f.nowIso,
  });
  assert.equal(rejected.delivery?.status, "blocked");
  assert.equal(rejected.status, "completed");
  assert.equal(phase11ATechnicalVsHumanVerdict().technicalPipeline, "PASS");
  assert.equal(phase11ATechnicalVsHumanVerdict().assetDecision, "HUMAN_REJECTED");
  assert.throws(
    () => assertPhase11APayloadHasNoMediaLeak({ url: "https://example.invalid/preview" }),
    /URL/,
  );
});

test("11A HR REJECT — downstream remains blocked; comment and auth are bound", () => {
  assert.match(PHASE_11A_HR_REJECT_COMMENT, /faux texte illisible/);
  assert.equal(PHASE_11A_HR_REJECT_AUTH, "AUTH_11A_HUMAN_REVIEW_REJECT_ONCE_NO_REGENERATE");
  assert.equal(PHASE_11A_HR_REJECT_ISSUE_CODE, "human.illegible_invented_button_text");
  const provenance = applyPhase11ARejectToAssetProvenance(
    { source: "openai" },
    { reviewRequestId: "req", decisionId: DECISION_ID },
  );
  assert.equal(provenance.active, false);
  assert.equal(provenance.lifecycle, "rejected");
  const runState = applyPhase11ARejectToRunState(
    { waitingReason: "needs_review", status: "running" },
    { nowIso: "2026-08-13T23:15:00.000Z", reviewRequestId: "req", decisionId: DECISION_ID },
  );
  assert.equal(runState.waitingReason, undefined);
  assert.equal(runState.status, "completed");
  assertPhase11AOutputNotAutoActive({
    active: false,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
  });
  assert.throws(
    () =>
      assertPhase11ARejectedBlocksActivationAndDownstream({
        decision: "rejected",
        active: false,
        mergeRequested: true,
        exportRequested: false,
        retryJobCreated: false,
        providerCalls: 0,
      }),
    /merge\/export/,
  );
});
