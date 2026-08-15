import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertAttemptHelperHasNoSideEffects,
  redactGenerationAttemptError,
  type GenerationAttemptLifecycleStore,
} from "../generation-attempt-terminal-state";
import {
  PHASE_11B_HARDENING_COMMIT_SHA,
  PHASE_11B_I2V_PAID_SCRIPT_AUTH_CONSUMED,
  PHASE_11B_LIVE_ATTEMPT_ID,
  PHASE_11B_LIVE_PROJECT_ID,
  PHASE_11B_LIVE_RECONCILIATION_PREFLIGHT_AUTH,
  PHASE_11B_LIVE_RECONCILIATION_PREFLIGHT_VERDICT,
  PHASE_11B_LIVE_RUN_ID,
  PHASE_11B_LIVE_WORKSPACE_ID,
  PHASE_11B_NEXT_SINGLE_WRITE_AUTH,
  PHASE_11B_PROPOSED_COMPLETED_AT,
  PHASE_11B_PROPOSED_COMPLETED_AT_SOURCE,
  PHASE_11B_VERIFIED_LIVE_FACTS,
  assertPhase11BPaidScriptMustNotResubmit,
  fingerprintPhase11BLiveReconciliationPlan,
  planPhase11BLiveAttemptReconciliation,
  selectPhase11BAttemptCompletedAt,
  type Phase11BLiveReconciliationFacts,
} from "../phase-11b-i2v-attempt-terminal-state";

function facts(
  overrides: Partial<Phase11BLiveReconciliationFacts> = {},
): Phase11BLiveReconciliationFacts {
  return { ...PHASE_11B_VERIFIED_LIVE_FACTS, ...overrides };
}

function emptyStore(): GenerationAttemptLifecycleStore {
  return {
    attempt: {
      id: PHASE_11B_LIVE_ATTEMPT_ID,
      workspaceId: PHASE_11B_LIVE_WORKSPACE_ID,
      projectId: PHASE_11B_LIVE_PROJECT_ID,
      runId: PHASE_11B_LIVE_RUN_ID,
      status: "started",
      externalJobId: "01a0025d-provider",
      retryable: null,
      completedAt: null,
      costStatus: null,
      providerId: "fal",
      modelId: "fal-ai/kling-video/v2/master/image-to-video",
    },
    job: { status: "completed", submitCount: 1, externalJobId: "01a0025d-provider" },
    run: { status: "completed" },
    providerCalls: 0,
    budgetWrites: 0,
    assetWrites: 0,
    flagsWritten: 0,
    ledgerWrites: 0,
  };
}

test("11B-RECON-PREFLIGHT — auth, hardening SHA, consumed paid script", () => {
  assert.equal(
    PHASE_11B_LIVE_RECONCILIATION_PREFLIGHT_AUTH,
    "AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT",
  );
  assert.equal(
    PHASE_11B_LIVE_RECONCILIATION_PREFLIGHT_VERDICT,
    "I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT_READY_FOR_SINGLE_WRITE_AUTH",
  );
  assert.equal(
    PHASE_11B_NEXT_SINGLE_WRITE_AUTH,
    "AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_SINGLE_WRITE",
  );
  assert.equal(PHASE_11B_HARDENING_COMMIT_SHA, "97f7ad7");
  assert.equal(PHASE_11B_I2V_PAID_SCRIPT_AUTH_CONSUMED, true);
  assert.throws(() => assertPhase11BPaidScriptMustNotResubmit(true));
});

test("11B-RECON-PREFLIGHT — completed_at prefers asset ingest when provider/job/run stamps are absent", () => {
  const chosen = selectPhase11BAttemptCompletedAt({
    submittedAt: "2026-08-14T22:20:47.701Z",
    providerAcceptedAt: "2026-08-14T22:20:47.701Z",
    providerTerminalAt: null,
    jobCompletedAt: null,
    runCompletedAt: null,
    assetIngestedAt: "2026-08-14 22:24:41.938085+00",
    settlementAt: "2026-08-14T22:24:42.589Z",
    humanReviewAt: "2026-08-14T23:31:45.489Z",
  });
  assert.equal(chosen.source, "asset_ingest");
  assert.equal(chosen.historical, true);
  assert.equal(chosen.iso, PHASE_11B_PROPOSED_COMPLETED_AT);
  assert.equal(PHASE_11B_PROPOSED_COMPLETED_AT_SOURCE, "asset_ingest");
});

test("11B-RECON-PREFLIGHT — live target exact dry-run accepted, mutationAllowed false", () => {
  const plan = planPhase11BLiveAttemptReconciliation(PHASE_11B_VERIFIED_LIVE_FACTS);
  assert.equal(plan.accepted, true);
  assert.equal(plan.preconditionsPassed, true);
  assert.equal(plan.mutationAllowed, false);
  assert.equal(plan.resubmitAllowed, false);
  assert.equal(plan.sideEffects, "none");
  assert.equal(plan.expectedRows, 1);
  assert.equal(plan.currentStatus, "started");
  assert.equal(plan.desiredStatus, "completed");
  assert.equal(plan.desiredCompletedAt, PHASE_11B_PROPOSED_COMPLETED_AT);
  assert.equal(plan.retryable, false);
  assert.equal(plan.targetAttemptId, PHASE_11B_LIVE_ATTEMPT_ID);
  assert.equal(plan.cas.executed, false);
  assert.equal(plan.cas.expectedRows, 1);
  assert.equal(plan.cas.abortIfRowCountNotOne, true);
  assert.equal(plan.cas.set.status, "completed");
  assert.equal(plan.cas.match.status, "started");
  assert.equal(plan.cas.match.completedAt, null);
  assert.ok(plan.cas.unchanged.includes("external_job_id"));
});

test("11B-RECON-PREFLIGHT — refuses wrong workspace, project, attempt, run/job", () => {
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ workspaceId: "other" })).refuseCode,
    "scope_mismatch",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ projectId: "other" })).refuseCode,
    "scope_mismatch",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ attemptId: "other" })).refuseCode,
    "attempt_mismatch",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ runId: "other" })).refuseCode,
    "run_job_mismatch",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ jobId: "other" })).refuseCode,
    "run_job_mismatch",
  );
});

test("11B-RECON-PREFLIGHT — refuses ambiguous attempts and non-started / completed_at set", () => {
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ attemptCountForRun: 2 })).refuseCode,
    "ambiguous_attempts",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ attemptStatus: "running" })).refuseCode,
    "unexpected_current_status",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ attemptCompletedAt: PHASE_11B_PROPOSED_COMPLETED_AT }))
      .refuseCode,
    "completed_at_already_set",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ attemptStatus: "failed" })).refuseCode,
    "terminal_conflict",
  );
});

test("11B-RECON-PREFLIGHT — refuses job/run, submitCount, providerJobId, output, HR, budget", () => {
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ jobStatus: "queued" })).refuseCode,
    "job_run_not_terminal",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ runStatus: "running" })).refuseCode,
    "job_run_not_terminal",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ submitCount: 2 })).refuseCode,
    "submit_count_mismatch",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ providerJobIdPresent: false })).refuseCode,
    "missing_provider_job",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ outputCount: 0, outputIngested: false })).refuseCode,
    "asset_incoherent",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ outputCount: 2 })).refuseCode,
    "asset_incoherent",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ videoLifecycle: "pending_review" })).refuseCode,
    "asset_incoherent",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ humanReviewDecision: "rejected" })).refuseCode,
    "human_review_incoherent",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ humanReviewRejectedCount: 1 })).refuseCode,
    "human_review_incoherent",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ reservedActive: true })).refuseCode,
    "budget_incoherent",
  );
  assert.equal(
    planPhase11BLiveAttemptReconciliation(facts({ committedMinor: 388 })).refuseCode,
    "budget_incoherent",
  );
});

test("11B-RECON-PREFLIGHT — replay fingerprint deterministic, CAS one row, no writes", () => {
  const first = planPhase11BLiveAttemptReconciliation(PHASE_11B_VERIFIED_LIVE_FACTS);
  const second = planPhase11BLiveAttemptReconciliation(PHASE_11B_VERIFIED_LIVE_FACTS);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.fingerprint, fingerprintPhase11BLiveReconciliationPlan(first));
  assert.match(first.fingerprint, /^[0-9a-f]{16}$/);
  assert.equal(first.cas.expectedRows, 1);
  assert.equal(first.cas.executed, false);
  assertAttemptHelperHasNoSideEffects(emptyStore());
  assert.equal(emptyStore().job.submitCount, 1);
  assert.throws(() => assertPhase11BPaidScriptMustNotResubmit(true));
  assert.match(redactGenerationAttemptError("failed https://db.example/x?token=abc"), /\[redacted-url\]/);
  assert.match(redactGenerationAttemptError("failed token=supersecrettokenvalue"), /token=\[redacted\]/);
});
