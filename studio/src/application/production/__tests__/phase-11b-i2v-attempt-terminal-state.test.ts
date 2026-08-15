import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GENERATION_ATTEMPT_TRANSITION_ORDER,
  applyGenerationAttemptTerminalToStore,
  assertAttemptHelperHasNoSideEffects,
  assertJobRunCompletedImpliesAttemptTerminal,
  redactGenerationAttemptError,
  resolveGenerationAttemptTerminalDecision,
  resumeAfterAttemptTerminal,
  resumeAfterProviderTerminal,
  type GenerationAttemptLifecycleStore,
  type GenerationAttemptRecord,
} from "../generation-attempt-terminal-state";
import {
  PHASE_11B_ATTEMPT_HARDENING_AUTH,
  PHASE_11B_ATTEMPT_HARDENING_VERDICT,
  PHASE_11B_I2V_PAID_SCRIPT_AUTH_CONSUMED,
  PHASE_11B_LIVE_ATTEMPT_ID,
  PHASE_11B_LIVE_JOB_ID,
  PHASE_11B_LIVE_PROJECT_ID,
  PHASE_11B_LIVE_RUN_ID,
  PHASE_11B_LIVE_VIDEO_ASSET_ID,
  PHASE_11B_LIVE_WORKSPACE_ID,
  PHASE_11B_NEXT_LIVE_RECONCILIATION_AUTH,
  assertPhase11BPaidScriptMustNotResubmit,
  planPhase11BLiveAttemptReconciliation,
} from "../phase-11b-i2v-attempt-terminal-state";

const NOW = "2026-08-15T00:40:00.000Z";

function attempt(overrides: Partial<GenerationAttemptRecord> = {}): GenerationAttemptRecord {
  return {
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
    ...overrides,
  };
}

function store(overrides: Partial<GenerationAttemptLifecycleStore> = {}): GenerationAttemptLifecycleStore {
  return {
    attempt: attempt(),
    job: { status: "completed", submitCount: 1, externalJobId: "01a0025d-provider" },
    run: { status: "completed" },
    providerCalls: 0,
    budgetWrites: 0,
    assetWrites: 0,
    flagsWritten: 0,
    ledgerWrites: 0,
    ...overrides,
  };
}

function expected(currentStatus = "started") {
  return {
    workspaceId: PHASE_11B_LIVE_WORKSPACE_ID,
    projectId: PHASE_11B_LIVE_PROJECT_ID,
    runId: PHASE_11B_LIVE_RUN_ID,
    attemptId: PHASE_11B_LIVE_ATTEMPT_ID,
    currentStatus,
  };
}

function liveFacts(
  overrides: Partial<Parameters<typeof planPhase11BLiveAttemptReconciliation>[0]> = {},
) {
  return {
    workspaceId: PHASE_11B_LIVE_WORKSPACE_ID,
    projectId: PHASE_11B_LIVE_PROJECT_ID,
    attemptId: PHASE_11B_LIVE_ATTEMPT_ID,
    runId: PHASE_11B_LIVE_RUN_ID,
    jobId: PHASE_11B_LIVE_JOB_ID,
    attemptStatus: "started",
    attemptCountForRun: 1,
    jobStatus: "completed",
    runStatus: "completed",
    submitCount: 1,
    providerJobIdPresent: true,
    outputIngested: true,
    humanReviewDecision: "approved",
    videoLifecycle: "approved",
    videoActive: false,
    ledgerSettledProvisional: true,
    reservedActive: false,
    ...overrides,
  };
}

test("11B-ATTEMPT — auth, order, consumed script, no resubmit", () => {
  assert.equal(PHASE_11B_ATTEMPT_HARDENING_AUTH, "AUTH_11B_I2V_ATTEMPT_TERMINAL_STATE_HARDENING");
  assert.equal(
    PHASE_11B_ATTEMPT_HARDENING_VERDICT,
    "I2V_ATTEMPT_TERMINAL_STATE_HARDENED_READY_FOR_LIVE_RECONCILIATION_PREFLIGHT",
  );
  assert.equal(
    PHASE_11B_NEXT_LIVE_RECONCILIATION_AUTH,
    "AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT",
  );
  assert.equal(PHASE_11B_I2V_PAID_SCRIPT_AUTH_CONSUMED, true);
  assert.equal(GENERATION_ATTEMPT_TRANSITION_ORDER[5], "attempt_terminal");
  assert.equal(GENERATION_ATTEMPT_TRANSITION_ORDER[6], "job_terminal");
  assert.throws(() => assertPhase11BPaidScriptMustNotResubmit(true));
  assert.equal(PHASE_11B_LIVE_VIDEO_ASSET_ID.startsWith("9be6cb0c"), true);
});

test("11B-ATTEMPT — success completes attempt with completed_at and retryable false", () => {
  const decision = resolveGenerationAttemptTerminalDecision({
    outcome: "success",
    attempt: attempt(),
    expected: expected(),
    nowIso: NOW,
    settlementCostStatus: "provisional",
  });
  assert.equal(decision.kind, "apply");
  if (decision.kind !== "apply") return;
  const next = applyGenerationAttemptTerminalToStore(store(), decision);
  assert.equal(next.result, "applied");
  assert.equal(next.store.attempt.status, "completed");
  assert.equal(next.store.attempt.completedAt, NOW);
  assert.equal(next.store.attempt.retryable, false);
  assert.equal(next.store.attempt.externalJobId, "01a0025d-provider");
  assert.equal(next.store.attempt.costStatus, "provisional");
  assert.equal(next.store.job.submitCount, 1);
  assertJobRunCompletedImpliesAttemptTerminal({
    jobStatus: next.store.job.status,
    runStatus: next.store.run.status,
    attemptStatus: next.store.attempt.status,
  });
  assertAttemptHelperHasNoSideEffects(next.store);
});

test("11B-ATTEMPT — job/run completed without terminal attempt fails closed", () => {
  assert.throws(() =>
    assertJobRunCompletedImpliesAttemptTerminal({
      jobStatus: "completed",
      runStatus: "completed",
      attemptStatus: "started",
    }),
  );
});

test("11B-ATTEMPT — replay idempotent and terminal reopen refused", () => {
  const first = resolveGenerationAttemptTerminalDecision({
    outcome: "success",
    attempt: attempt(),
    expected: expected(),
    nowIso: NOW,
  });
  const applied = applyGenerationAttemptTerminalToStore(store(), first);
  const replay = resolveGenerationAttemptTerminalDecision({
    outcome: "success",
    attempt: applied.store.attempt,
    expected: expected("completed"),
    nowIso: "2026-08-15T00:41:00.000Z",
  });
  assert.equal(replay.kind, "existing");
  const replayed = applyGenerationAttemptTerminalToStore(applied.store, replay);
  assert.equal(replayed.result, "existing");
  assert.equal(replayed.store.attempt.status, "completed");
  assert.equal(replayed.store.attempt.completedAt, NOW);
  assert.equal(replayed.store.job.submitCount, 1);

  const reopen = resolveGenerationAttemptTerminalDecision({
    outcome: "provider_failed",
    attempt: applied.store.attempt,
    expected: expected("completed"),
    nowIso: NOW,
  });
  assert.equal(reopen.kind, "refused");
});

test("11B-ATTEMPT — optimistic lock conflict does not persist", () => {
  const decision = resolveGenerationAttemptTerminalDecision({
    outcome: "success",
    attempt: attempt({ status: "started" }),
    expected: expected("processing"),
    nowIso: NOW,
  });
  assert.equal(decision.kind, "conflict");
  const next = applyGenerationAttemptTerminalToStore(store(), decision);
  assert.equal(next.result, "conflict");
  assert.equal(next.store.attempt.status, "started");
  assert.equal(next.store.attempt.completedAt, null);
});

test("11B-ATTEMPT — failed and quarantined are terminal without retry or resubmit", () => {
  for (const outcome of ["provider_failed", "quarantined"] as const) {
    const decision = resolveGenerationAttemptTerminalDecision({
      outcome,
      attempt: attempt(),
      expected: expected(),
      nowIso: NOW,
    });
    const next = applyGenerationAttemptTerminalToStore(store(), decision);
    assert.equal(next.store.attempt.status, "failed");
    assert.ok(next.store.attempt.completedAt);
    assert.equal(next.store.attempt.retryable, false);
    assert.equal(next.store.job.submitCount, 1);
    assert.equal(next.store.providerCalls, 0);
  }
});

test("11B-ATTEMPT — submission_unknown stays prudent, retryable false, no resubmit", () => {
  const decision = resolveGenerationAttemptTerminalDecision({
    outcome: "submission_unknown",
    attempt: attempt({ externalJobId: null }),
    expected: expected(),
    nowIso: NOW,
  });
  assert.equal(decision.kind, "prudent_hold");
  const next = applyGenerationAttemptTerminalToStore(
    store({ attempt: attempt({ externalJobId: null }) }),
    decision,
  );
  assert.equal(next.result, "prudent_hold");
  assert.equal(next.store.attempt.status, "started");
  assert.equal(next.store.attempt.completedAt, null);
  assert.equal(next.store.attempt.retryable, false);
  assert.equal(next.store.job.submitCount, 1);
});

test("11B-ATTEMPT — crash resume never resubmits", () => {
  const afterProvider = resumeAfterProviderTerminal({
    attemptStatus: "started",
    jobStatus: "running",
    runStatus: "running",
    submitCount: 1,
    providerJobIdPresent: true,
  });
  assert.equal(afterProvider.mayResubmit, false);
  assert.equal(afterProvider.next, "mark_attempt_terminal");

  const afterAttempt = resumeAfterAttemptTerminal({
    attemptStatus: "completed",
    jobStatus: "running",
    runStatus: "running",
    submitCount: 1,
  });
  assert.equal(afterAttempt.mayResubmit, false);
  assert.equal(afterAttempt.next, "mark_job_run");

  const done = resumeAfterAttemptTerminal({
    attemptStatus: "completed",
    jobStatus: "completed",
    runStatus: "completed",
    submitCount: 1,
  });
  assert.equal(done.next, "done");
});

test("11B-ATTEMPT — dry-run accepts exact live target and refuses ambiguous ones", () => {
  const ok = planPhase11BLiveAttemptReconciliation(liveFacts());
  assert.equal(ok.accepted, true);
  assert.equal(ok.mutationAllowed, false);
  assert.equal(ok.desiredStatus, "completed");
  assert.equal(ok.retryable, false);
  assert.equal(ok.currentStatus, "started");

  assert.equal(planPhase11BLiveAttemptReconciliation(liveFacts({ attemptId: "other" })).refuseCode, "attempt_mismatch");
  assert.equal(planPhase11BLiveAttemptReconciliation(liveFacts({ attemptCountForRun: 2 })).refuseCode, "ambiguous_attempts");
  assert.equal(planPhase11BLiveAttemptReconciliation(liveFacts({ jobStatus: "running" })).refuseCode, "job_run_not_terminal");
  assert.equal(planPhase11BLiveAttemptReconciliation(liveFacts({ providerJobIdPresent: false })).refuseCode, "missing_provider_job");
  assert.equal(planPhase11BLiveAttemptReconciliation(liveFacts({ videoActive: true })).refuseCode, "asset_incoherent");
  assert.equal(planPhase11BLiveAttemptReconciliation(liveFacts({ reservedActive: true })).refuseCode, "budget_incoherent");
  assert.equal(
    planPhase11BLiveAttemptReconciliation(liveFacts({ attemptStatus: "failed" })).refuseCode,
    "terminal_conflict",
  );
});

test("11B-ATTEMPT — helper never writes provider/budget/asset/flags and redacts errors", () => {
  const dirty = store({ providerCalls: 1 });
  assert.throws(() => assertAttemptHelperHasNoSideEffects(dirty));
  assert.match(redactGenerationAttemptError("failed https://db.example/x"), /\[redacted-url\]/);
  assert.match(redactGenerationAttemptError("failed token=supersecrettokenvalue"), /token=\[redacted\]/);
});
