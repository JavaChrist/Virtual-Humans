/**
 * In-memory merge/export run/job/attempt. Terminal states are immutable.
 * Replay never creates a second submit. Export never auto-starts after merge.
 */
export const PHASE_11E_RUN_TERMINAL = new Set(["completed", "failed", "cancelled"]);

export type Phase11ERunStatus =
  | "idle"
  | "planned"
  | "dry_run"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type Phase11EJobStatus =
  | "intent"
  | "submitted"
  | "polling"
  | "completed"
  | "failed"
  | "cancelled";

export type Phase11EAttemptStatus = "pending" | "executing" | "completed" | "failed" | "cancelled";

export type Phase11EStructuredError = {
  code: string;
  message: string;
};

export type Phase11EJobState = {
  kind: "merge" | "export";
  idempotencyKey: string;
  runStatus: Phase11ERunStatus;
  jobStatus: Phase11EJobStatus;
  attemptStatus: Phase11EAttemptStatus;
  submitCount: number;
  retryCount: number;
  fallbackCount: number;
  engineCalls: 0;
  filesCreated: 0;
  urlsCreated: 0;
  downloadsTriggered: 0;
  mergeExportAuthorized: false;
  outputActive: false;
  published: false;
  persistedToProduction: false;
  error: Phase11EStructuredError | null;
  fakeChecksum: string | null;
};

export function createPhase11EJobState(
  kind: "merge" | "export",
  idempotencyKey: string,
): Phase11EJobState {
  return {
    kind,
    idempotencyKey,
    runStatus: "planned",
    jobStatus: "intent",
    attemptStatus: "pending",
    submitCount: 0,
    retryCount: 0,
    fallbackCount: 0,
    engineCalls: 0,
    filesCreated: 0,
    urlsCreated: 0,
    downloadsTriggered: 0,
    mergeExportAuthorized: false,
    outputActive: false,
    published: false,
    persistedToProduction: false,
    error: null,
    fakeChecksum: null,
  };
}

function assertNotTerminal(job: Phase11EJobState, action: string): void {
  if (PHASE_11E_RUN_TERMINAL.has(job.runStatus)) {
    throw new Error(`Phase 11E: cannot ${action} a terminal ${job.kind} run.`);
  }
}

export function markPhase11EDryRun(job: Phase11EJobState): Phase11EJobState {
  assertNotTerminal(job, "dry-run");
  return { ...job, runStatus: "dry_run", error: null };
}

export function beginPhase11EFakeSubmit(job: Phase11EJobState): Phase11EJobState {
  if (PHASE_11E_RUN_TERMINAL.has(job.runStatus) && job.submitCount >= 1) {
    return job;
  }
  assertNotTerminal(job, "submit");
  if (job.submitCount >= 1) {
    throw new Error(`Phase 11E: second ${job.kind} submit is forbidden.`);
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

export function completePhase11EFake(job: Phase11EJobState, fakeChecksum: string): Phase11EJobState {
  if (job.runStatus === "completed" && job.fakeChecksum === fakeChecksum) {
    return job;
  }
  assertNotTerminal(job, "complete");
  if (job.submitCount !== 1) {
    throw new Error(`Phase 11E: fake ${job.kind} completion requires exactly one submit.`);
  }
  return {
    ...job,
    runStatus: "completed",
    jobStatus: "completed",
    attemptStatus: "completed",
    fakeChecksum,
    engineCalls: 0,
    filesCreated: 0,
    urlsCreated: 0,
    downloadsTriggered: 0,
    mergeExportAuthorized: false,
    outputActive: false,
    published: false,
    persistedToProduction: false,
  };
}

export function failPhase11EJob(job: Phase11EJobState, error: Phase11EStructuredError): Phase11EJobState {
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

export function cancelPhase11EJob(job: Phase11EJobState): Phase11EJobState {
  if (job.runStatus === "cancelled") return job;
  assertNotTerminal(job, "cancel");
  return {
    ...job,
    runStatus: "cancelled",
    jobStatus: "cancelled",
    attemptStatus: "cancelled",
    error: { code: "cancelled", message: `${job.kind} run cancelled.` },
  };
}

export function replayPhase11EJob(
  existing: Phase11EJobState | undefined,
  idempotencyKey: string,
): Phase11EJobState | null {
  if (!existing) return null;
  if (existing.idempotencyKey !== idempotencyKey) {
    throw new Error("Phase 11E: idempotency key mismatch on replay.");
  }
  return existing;
}

export function assertPhase11ENoRetryOrFallback(job: Phase11EJobState): void {
  if (job.retryCount !== 0 || job.fallbackCount !== 0 || job.engineCalls !== 0) {
    throw new Error("Phase 11E: retry, fallback, and engine calls are forbidden.");
  }
}

export function assertPhase11ENoFilesOrUrls(job: Phase11EJobState): void {
  if (job.filesCreated !== 0 || job.urlsCreated !== 0 || job.downloadsTriggered !== 0) {
    throw new Error("Phase 11E: files, URLs, and downloads are forbidden.");
  }
}

export function assertPhase11EMergeExportRemainsClosed(job: Phase11EJobState): void {
  if (job.mergeExportAuthorized !== false) {
    throw new Error("Phase 11E: merge/export must remain unauthorized.");
  }
  if (job.published || job.outputActive) {
    throw new Error("Phase 11E: publication and activation remain forbidden.");
  }
  if (job.runStatus === "completed" && job.mergeExportAuthorized) {
    throw new Error("Phase 11E: completed does not authorize merge/export.");
  }
}
