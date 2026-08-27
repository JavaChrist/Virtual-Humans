/**
 * In-memory lipsync run/job/attempt. Terminal states are immutable.
 * Replay never creates a second submit.
 */
export const PHASE_11D_RUN_TERMINAL = new Set(["completed", "failed", "cancelled"]);

export type Phase11DLipsyncRunStatus =
  | "idle"
  | "planned"
  | "dry_run"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type Phase11DLipsyncJobStatus =
  | "intent"
  | "submitted"
  | "polling"
  | "completed"
  | "failed"
  | "cancelled";

export type Phase11DLipsyncAttemptStatus = "pending" | "executing" | "completed" | "failed" | "cancelled";

export type Phase11DStructuredError = {
  code: string;
  message: string;
};

export type Phase11DLipsyncJobState = {
  idempotencyKey: string;
  runStatus: Phase11DLipsyncRunStatus;
  jobStatus: Phase11DLipsyncJobStatus;
  attemptStatus: Phase11DLipsyncAttemptStatus;
  submitCount: number;
  retryCount: number;
  fallbackCount: number;
  providerCalls: 0;
  mergeExportCalls: 0;
  mergeExportAuthorized: false;
  outputActive: false;
  persistedToProduction: false;
  error: Phase11DStructuredError | null;
  fakeOutputChecksum: string | null;
};

export function createPhase11DLipsyncJobState(idempotencyKey: string): Phase11DLipsyncJobState {
  return {
    idempotencyKey,
    runStatus: "planned",
    jobStatus: "intent",
    attemptStatus: "pending",
    submitCount: 0,
    retryCount: 0,
    fallbackCount: 0,
    providerCalls: 0,
    mergeExportCalls: 0,
    mergeExportAuthorized: false,
    outputActive: false,
    persistedToProduction: false,
    error: null,
    fakeOutputChecksum: null,
  };
}

function assertNotTerminal(job: Phase11DLipsyncJobState, action: string): void {
  if (PHASE_11D_RUN_TERMINAL.has(job.runStatus)) {
    throw new Error(`Phase 11D: cannot ${action} a terminal lipsync run.`);
  }
}

export function markPhase11DLipsyncDryRun(job: Phase11DLipsyncJobState): Phase11DLipsyncJobState {
  assertNotTerminal(job, "dry-run");
  return { ...job, runStatus: "dry_run", error: null };
}

export function beginPhase11DLipsyncFakeSubmit(job: Phase11DLipsyncJobState): Phase11DLipsyncJobState {
  if (PHASE_11D_RUN_TERMINAL.has(job.runStatus) && job.submitCount >= 1) {
    return job;
  }
  assertNotTerminal(job, "submit");
  if (job.submitCount >= 1) {
    throw new Error("Phase 11D: second lipsync submit is forbidden.");
  }
  return {
    ...job,
    runStatus: "executing",
    jobStatus: "submitted",
    attemptStatus: "executing",
    submitCount: 1,
    error: null,
  };
}

export function completePhase11DLipsyncFake(
  job: Phase11DLipsyncJobState,
  fakeOutputChecksum: string,
): Phase11DLipsyncJobState {
  if (job.runStatus === "completed" && job.fakeOutputChecksum === fakeOutputChecksum) {
    return job;
  }
  assertNotTerminal(job, "complete");
  if (job.submitCount !== 1) {
    throw new Error("Phase 11D: fake completion requires exactly one submit.");
  }
  return {
    ...job,
    runStatus: "completed",
    jobStatus: "completed",
    attemptStatus: "completed",
    fakeOutputChecksum,
    providerCalls: 0,
    mergeExportAuthorized: false,
    outputActive: false,
    persistedToProduction: false,
  };
}

export function failPhase11DLipsync(
  job: Phase11DLipsyncJobState,
  error: Phase11DStructuredError,
): Phase11DLipsyncJobState {
  if (job.runStatus === "failed") return job;
  assertNotTerminal(job, "fail");
  return {
    ...job,
    runStatus: "failed",
    jobStatus: "failed",
    attemptStatus: "failed",
    error,
  };
}

export function cancelPhase11DLipsync(job: Phase11DLipsyncJobState): Phase11DLipsyncJobState {
  if (job.runStatus === "cancelled") return job;
  assertNotTerminal(job, "cancel");
  return {
    ...job,
    runStatus: "cancelled",
    jobStatus: "cancelled",
    attemptStatus: "cancelled",
    error: { code: "cancelled", message: "Lipsync run cancelled." },
  };
}

export function replayPhase11DLipsync(
  existing: Phase11DLipsyncJobState | undefined,
  idempotencyKey: string,
): Phase11DLipsyncJobState | null {
  if (!existing) return null;
  if (existing.idempotencyKey !== idempotencyKey) {
    throw new Error("Phase 11D: idempotency key mismatch on replay.");
  }
  return existing;
}

export function assertPhase11DNoRetryOrFallback(job: Phase11DLipsyncJobState): void {
  if (job.retryCount !== 0 || job.fallbackCount !== 0 || job.providerCalls !== 0) {
    throw new Error("Phase 11D: retry, fallback, and provider calls are forbidden.");
  }
}

export function assertPhase11DMergeExportRemainsClosed(job: Phase11DLipsyncJobState): void {
  if (job.mergeExportAuthorized !== false || job.mergeExportCalls !== 0) {
    throw new Error("Phase 11D: merge/export must remain unauthorized.");
  }
  if (job.runStatus === "completed" && job.mergeExportAuthorized) {
    throw new Error("Phase 11D: completed does not authorize merge/export.");
  }
}
