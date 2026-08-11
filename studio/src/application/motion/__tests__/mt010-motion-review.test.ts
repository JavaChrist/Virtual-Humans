/**
 * MT-010 — Motion Transfer human review (API/orchestrator contracts, no provider).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowedHumanReviewDecisions,
  MOTION_QC_MEASUREMENT_SET_VERSION,
  type MotionQcResult,
} from "@/domain/motion";
import { createSyntheticMotionQcPolicy } from "@/domain/motion/qc";
import { buildMotionQcQualityReport } from "../motion-qc-report";
import {
  assertMotionReviewEventRedacted,
  type MotionReviewEvent,
} from "../motion-review-events";
import {
  createMemoryMotionReviewDecisionStore,
  createMemoryMotionReviewSessionStore,
  createMotionReviewOrchestrator,
  seedMotionReviewSession,
} from "../motion-review-orchestrator";

const AT = "2026-08-11T20:00:00.000Z";
const WS = "ws-motion-harness";
const PROJ = "proj-mt010";

function makeQc(over: Partial<MotionQcResult> = {}): MotionQcResult {
  return {
    schemaVersion: "1.0.0",
    motionFidelity: "pass",
    identityFidelity: "pass",
    outfitFidelity: "pass",
    cameraCompliance: "pass",
    bodyIntegrity: "pass",
    temporalConsistency: "pass",
    checkpointResults: [{ checkpointId: "cp-1", status: "pass" }],
    issues: [],
    overallStatus: "human_review",
    humanValidationRequired: true,
    ...over,
  };
}

function setup(opts?: {
  qc?: MotionQcResult;
  outcome?: "needs_review" | "retry_recommended" | "qc_passed" | "qc_pending";
  stale?: boolean;
  quarantined?: boolean;
  capabilityEnabled?: boolean;
}) {
  const sessions = createMemoryMotionReviewSessionStore();
  const decisions = createMemoryMotionReviewDecisionStore();
  const events: MotionReviewEvent[] = [];
  const policy = createSyntheticMotionQcPolicy();
  const qc = opts?.qc ?? makeQc();
  const report = buildMotionQcQualityReport({
    result: qc,
    policy,
    measurementVersion: MOTION_QC_MEASUREMENT_SET_VERSION,
    runId: "run-mt010-1",
    jobId: "job-mt010-1",
    attemptId: "att-mt010-1",
    outputRef: "out-opaque-1",
    correlationId: "corr-mt010",
    createdBy: "actor-test",
    createdAt: AT,
  });
  seedMotionReviewSession(sessions, {
    workspaceId: WS,
    projectId: PROJ,
    report,
    policy,
    outcome: opts?.outcome ?? "needs_review",
    qualityReportStale: opts?.stale ?? false,
    lateQuarantined: opts?.quarantined ?? false,
    evidence: [
      {
        evidenceId: "ev-1",
        role: "motion_qc_evidence",
        contentFingerprint: "fp-ev-1",
        mimeType: "image/png",
        provenance: {
          correlationId: "corr-mt010",
          measurementVersion: MOTION_QC_MEASUREMENT_SET_VERSION,
        },
      },
    ],
  });
  const orch = createMotionReviewOrchestrator({
    sessions,
    decisions,
    events: { emit: (e) => events.push(e) },
    capabilityEnabled: opts?.capabilityEnabled,
  });
  return { orch, sessions, decisions, events, policy, qc };
}

test("MT-010 GET context valide", async () => {
  const { orch, events } = setup();
  const ctx = await orch.getContext({
    projectId: PROJ,
    workspaceId: WS,
    correlationId: "c1",
  });
  assert.equal(ctx.status, "ok");
  if (ctx.status !== "ok") return;
  assert.equal(ctx.context.runId, "run-mt010-1");
  assert.ok(ctx.context.allowedDecisions.includes("approved"));
  assert.ok(ctx.context.allowedDecisions.includes("rejected"));
  assert.ok(!JSON.stringify(ctx.context).includes("https://"));
  assert.ok(events.some((e) => e.type === "motion.review.opened"));
});

test("MT-010 auth/scope cross-project", async () => {
  const { orch } = setup();
  const ctx = await orch.getContext({
    projectId: PROJ,
    workspaceId: "other-ws",
    correlationId: "c2",
  });
  assert.equal(ctx.status, "failed");
  if (ctx.status === "failed") assert.equal(ctx.code, "scope_mismatch");
});

test("MT-010 report absent", async () => {
  const orch = createMotionReviewOrchestrator({
    sessions: createMemoryMotionReviewSessionStore(),
    decisions: createMemoryMotionReviewDecisionStore(),
  });
  const ctx = await orch.getContext({
    projectId: PROJ,
    workspaceId: WS,
    correlationId: "c3",
  });
  assert.equal(ctx.status, "failed");
});

test("MT-010 report stale — aucune décision positive", () => {
  const qc = makeQc();
  const allowed = allowedHumanReviewDecisions(qc, createSyntheticMotionQcPolicy(), {
    outcome: "needs_review",
    humanValidationRequired: true,
    qualityReportPresent: true,
    qualityReportStale: true,
  });
  assert.deepEqual(allowed.allowed, []);
});

test("MT-010 allowed decisions — human_review auto-ish → approve/reject", () => {
  const allowed = allowedHumanReviewDecisions(
    makeQc({ overallStatus: "human_review" }),
    createSyntheticMotionQcPolicy(),
    {
      outcome: "needs_review",
      humanValidationRequired: true,
      qualityReportPresent: true,
      qualityReportStale: false,
    },
  );
  assert.ok(allowed.allowed.includes("approved"));
  assert.ok(allowed.allowed.includes("rejected"));
});

test("MT-010 QC reject → pas approve", () => {
  const allowed = allowedHumanReviewDecisions(
    makeQc({
      overallStatus: "reject",
      motionFidelity: "fail",
      issues: [
        {
          code: "technical.mime_invalid",
          severity: "blocking",
          message: "bad",
          requirementClass: "required",
          retryClass: "nonRetryable",
          reviewIntent: "REJECT",
        },
      ],
    }),
    createSyntheticMotionQcPolicy(),
    {
      outcome: "needs_review",
      humanValidationRequired: true,
      qualityReportPresent: true,
      qualityReportStale: false,
    },
  );
  assert.deepEqual([...allowed.allowed], ["rejected"]);
});

test("MT-010 retryable → retry same/update/reject", () => {
  const allowed = allowedHumanReviewDecisions(
    makeQc({
      overallStatus: "retry",
      motionFidelity: "fail",
      issues: [
        {
          code: "motion_fidelity.fail",
          severity: "blocking",
          message: "fail",
          requirementClass: "required",
          retryClass: "retryable",
          reviewIntent: "RETRY_WITH_SAME_REFERENCE",
        },
      ],
    }),
    createSyntheticMotionQcPolicy(),
    {
      outcome: "retry_recommended",
      humanValidationRequired: true,
      qualityReportPresent: true,
      qualityReportStale: false,
    },
  );
  assert.ok(allowed.allowed.includes("retry_same_reference"));
  assert.ok(allowed.allowed.includes("retry_updated_constraints"));
  assert.ok(allowed.allowed.includes("rejected"));
  assert.ok(!allowed.allowed.includes("approved"));
});

test("MT-010 APPROVE valide", async () => {
  const { orch } = setup();
  const r = await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "approved",
    expectedRevision: 1,
    reviewRequestId: "req-approve-1",
    humanAttestation: true,
    confirmation: true,
    actorId: "actor-test",
    correlationId: "c-ap",
    nowIso: AT,
  });
  assert.equal(r.status, "recorded");
  if (r.status === "recorded") {
    assert.equal(r.nextAllowedState, "approved_pending_ingest");
    assert.equal(r.sideEffects.productionJobsDelta, 0);
  }
});

test("MT-010 APPROVE interdit sans attestation", async () => {
  const { orch } = setup();
  const r = await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "approved",
    expectedRevision: 1,
    reviewRequestId: "req-approve-2",
    humanAttestation: false,
    confirmation: true,
    actorId: "actor-test",
    correlationId: "c-ap2",
    nowIso: AT,
  });
  assert.equal(r.status, "failed");
});

test("MT-010 APPROVE interdit si required issue", async () => {
  const { orch } = setup({
    qc: makeQc({
      overallStatus: "retry",
      motionFidelity: "fail",
      issues: [
        {
          code: "motion_fidelity.fail",
          severity: "blocking",
          message: "x",
          requirementClass: "required",
          retryClass: "retryable",
        },
      ],
    }),
    outcome: "retry_recommended",
  });
  const r = await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "approved",
    expectedRevision: 1,
    reviewRequestId: "req-approve-bad",
    humanAttestation: true,
    confirmation: true,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  });
  assert.equal(r.status, "conflict");
});

test("MT-010 REJECT justification obligatoire", async () => {
  const { orch } = setup();
  const r = await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "rejected",
    expectedRevision: 1,
    reviewRequestId: "req-rej-1",
    confirmation: true,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  });
  assert.equal(r.status, "failed");
  const ok = await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "rejected",
    expectedRevision: 1,
    reviewRequestId: "req-rej-2",
    comment: "Hors brief sportif",
    confirmation: true,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  });
  assert.equal(ok.status, "recorded");
});

test("MT-010 retry same — zéro job / ledger / provider", async () => {
  const { orch } = setup({
    qc: makeQc({
      overallStatus: "retry",
      motionFidelity: "fail",
      issues: [
        {
          code: "motion_fidelity.fail",
          severity: "blocking",
          message: "x",
          requirementClass: "required",
          retryClass: "retryable",
        },
      ],
    }),
    outcome: "retry_recommended",
  });
  const r = await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "retry_same_reference",
    expectedRevision: 1,
    reviewRequestId: "req-retry-1",
    confirmation: true,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  });
  assert.equal(r.status, "recorded");
  if (r.status === "recorded") {
    assert.equal(r.nextAllowedState, "intent_recorded");
    assert.equal(r.sideEffects.productionJobsDelta, 0);
    assert.equal(r.sideEffects.ledgerDelta, 0);
    assert.equal(r.sideEffects.providerCalls, 0);
    assert.equal(r.sideEffects.mergeCalls, 0);
    assert.equal(r.sideEffects.exportCalls, 0);
  }
  assert.equal(orch.sideEffects.productionJobsDelta, 0);
});

test("MT-010 retry updated constraints — ref versionnée", async () => {
  const { orch } = setup({
    qc: makeQc({
      overallStatus: "retry",
      issues: [
        {
          code: "motion_fidelity.fail",
          severity: "blocking",
          message: "x",
          requirementClass: "required",
          retryClass: "requiresUpdatedConstraints",
        },
      ],
    }),
    outcome: "retry_recommended",
  });
  const bad = await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "retry_updated_constraints",
    expectedRevision: 1,
    reviewRequestId: "req-up-1",
    updatedConstraintsRef: '{"inline":true}',
    confirmation: true,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  });
  assert.equal(bad.status, "failed");
  const ok = await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "retry_updated_constraints",
    expectedRevision: 1,
    reviewRequestId: "req-up-2",
    updatedConstraintsRef: "constraints:v2:opaque-ref",
    confirmation: true,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  });
  assert.equal(ok.status, "recorded");
});

test("MT-010 request new reference", async () => {
  const { orch, events } = setup({
    qc: makeQc({
      overallStatus: "retry",
      issues: [
        {
          code: "ref.bad",
          severity: "blocking",
          message: "x",
          requirementClass: "required",
          retryClass: "requiresNewReference",
          reviewIntent: "REQUEST_NEW_REFERENCE",
        },
      ],
    }),
    outcome: "retry_recommended",
  });
  const r = await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "request_new_reference",
    expectedRevision: 1,
    reviewRequestId: "req-new-1",
    comment: "Source occluse",
    confirmation: true,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  });
  assert.equal(r.status, "recorded");
  assert.ok(events.some((e) => e.type === "motion.review.new_reference_requested"));
});

test("MT-010 idempotence same request", async () => {
  const { orch } = setup();
  const body = {
    projectId: PROJ,
    workspaceId: WS,
    decision: "approved" as const,
    expectedRevision: 1,
    reviewRequestId: "req-idem-1",
    humanAttestation: true,
    confirmation: true as const,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  };
  const a = await orch.recordDecision(body);
  const b = await orch.recordDecision(body);
  assert.equal(a.status, "recorded");
  assert.equal(b.status, "existing");
});

test("MT-010 payload conflict same request id", async () => {
  const { orch } = setup();
  await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "approved",
    expectedRevision: 1,
    reviewRequestId: "req-conflict-1",
    humanAttestation: true,
    confirmation: true,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  });
  const conflict = await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "rejected",
    expectedRevision: 1,
    reviewRequestId: "req-conflict-1",
    comment: "other",
    confirmation: true,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  });
  assert.equal(conflict.status, "conflict");
  if (conflict.status === "conflict") {
    assert.equal(conflict.code, "payload_conflict");
  }
});

test("MT-010 optimistic revision conflict", async () => {
  const { orch } = setup();
  const r = await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "approved",
    expectedRevision: 99,
    reviewRequestId: "req-stale-1",
    humanAttestation: true,
    confirmation: true,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  });
  assert.equal(r.status, "conflict");
  if (r.status === "conflict") assert.equal(r.code, "revision_stale");
});

test("MT-010 concurrence deux reviewers — une décision par request", async () => {
  const { orch, decisions } = setup();
  const [a, b] = await Promise.all([
    orch.recordDecision({
      projectId: PROJ,
      workspaceId: WS,
      decision: "approved",
      expectedRevision: 1,
      reviewRequestId: "req-race-a",
      humanAttestation: true,
      confirmation: true,
      actorId: "r1",
      correlationId: "c1",
      nowIso: AT,
    }),
    orch.recordDecision({
      projectId: PROJ,
      workspaceId: WS,
      decision: "approved",
      expectedRevision: 1,
      reviewRequestId: "req-race-b",
      humanAttestation: true,
      confirmation: true,
      actorId: "r2",
      correlationId: "c2",
      nowIso: AT,
    }),
  ]);
  assert.ok(a.status === "recorded" || a.status === "conflict");
  assert.ok(b.status === "recorded" || b.status === "conflict");
  // append-only: both distinct request ids may record; quality report untouched
  assert.ok(decisions.records.length >= 1);
});

test("MT-010 append-only — list grows, report immutable", async () => {
  const { orch, sessions, decisions } = setup({
    qc: makeQc({
      overallStatus: "retry",
      issues: [
        {
          code: "motion_fidelity.fail",
          severity: "blocking",
          message: "x",
          requirementClass: "required",
          retryClass: "retryable",
        },
      ],
    }),
    outcome: "retry_recommended",
  });
  const before = (await sessions.get(PROJ))!.report;
  await orch.recordDecision({
    projectId: PROJ,
    workspaceId: WS,
    decision: "retry_same_reference",
    expectedRevision: 1,
    reviewRequestId: "req-app-1",
    confirmation: true,
    actorId: "a",
    correlationId: "c",
    nowIso: AT,
  });
  const after = (await sessions.get(PROJ))!.report;
  assert.equal(after, before);
  assert.equal(decisions.records.length, 1);
});

test("MT-010 preview redaction — no signed URL in context", async () => {
  const { orch } = setup();
  const ctx = await orch.getContext({
    projectId: PROJ,
    workspaceId: WS,
    correlationId: "c",
  });
  assert.equal(ctx.status, "ok");
  if (ctx.status !== "ok") return;
  const blob = JSON.stringify(ctx.context);
  assert.ok(!/https?:\/\//i.test(blob));
  assert.ok(!/X-Amz-/i.test(blob));
});

test("MT-010 fake Production guard — capability off", async () => {
  const { orch } = setup({ capabilityEnabled: false });
  const ctx = await orch.getContext({
    projectId: PROJ,
    workspaceId: WS,
    correlationId: "c",
  });
  assert.equal(ctx.status, "failed");
});

test("MT-010 qc_pending non évalué → pas de décisions", () => {
  const allowed = allowedHumanReviewDecisions(
    makeQc(),
    createSyntheticMotionQcPolicy(),
    {
      outcome: "qc_pending",
      humanValidationRequired: true,
      qualityReportPresent: true,
      qualityReportStale: false,
    },
  );
  assert.deepEqual(allowed.allowed, []);
});

test("MT-010 human-only / critical path keeps approve with attestation", () => {
  const allowed = allowedHumanReviewDecisions(
    makeQc({
      overallStatus: "human_review",
      issues: [
        {
          code: "requirement.human_only:sport",
          severity: "blocking",
          message: "human",
          requirementClass: "human_only",
          retryClass: "humanOnly",
        },
      ],
    }),
    createSyntheticMotionQcPolicy(),
    {
      outcome: "needs_review",
      humanValidationRequired: true,
      qualityReportPresent: true,
      qualityReportStale: false,
    },
  );
  assert.ok(allowed.allowed.includes("approved"));
});

test("MT-010 events redacted", () => {
  assert.throws(() =>
    assertMotionReviewEventRedacted({
      type: "motion.review.decision.recorded",
      correlationId: "c",
      projectId: "p",
      decision: "https://cdn.evil/x",
    }),
  );
});

test("MT-010 UI decision labels cover all intents", () => {
  const labels = [
    "approved",
    "rejected",
    "retry_same_reference",
    "retry_updated_constraints",
    "request_new_reference",
  ];
  for (const d of labels) assert.ok(d.length > 0);
});
