/**
 * Generic generation_attempts terminal-state contract.
 * No provider, budget, asset, flag, or artifact writes.
 */

export const GENERATION_ATTEMPT_IN_PROGRESS_STATUSES = [
  "started",
  "running",
  "pending",
  "executing",
  "submitted",
  "processing",
] as const;

export const GENERATION_ATTEMPT_TERMINAL_STATUSES = [
  "completed",
  "failed",
  "cancelled",
] as const;

export const GENERATION_ATTEMPT_TRANSITION_ORDER = [
  "submit_intent",
  "unique_submit",
  "persist_provider_job_id",
  "provider_terminal",
  "ingest_or_failure",
  "attempt_terminal",
  "job_terminal",
  "run_terminal",
  "settlement",
  "human_review_handoff",
] as const;

export type GenerationAttemptOutcome =
  | "success"
  | "provider_failed"
  | "submission_unknown"
  | "quarantined"
  | "provider_pending";

export type GenerationAttemptRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  runId: string;
  status: string;
  externalJobId: string | null;
  retryable: boolean | null;
  completedAt: string | null;
  costStatus: string | null;
  providerId: string;
  modelId: string;
};

export type GenerationAttemptTerminalDecision =
  | {
      kind: "apply";
      expectedCurrentStatus: string;
      nextStatus: "completed" | "failed";
      completedAt: string;
      retryable: false;
      costStatus: string | null;
      preserveExternalJobId: true;
    }
  | {
      kind: "existing";
      nextStatus: "completed" | "failed";
      completedAt: string;
      retryable: false;
    }
  | {
      kind: "prudent_hold";
      nextStatus: string;
      retryable: false;
      completedAt: null;
    }
  | {
      kind: "conflict";
      code: "optimistic_conflict";
      message: string;
    }
  | {
      kind: "refused";
      code: string;
      message: string;
    };

export type GenerationAttemptLifecycleStore = {
  attempt: GenerationAttemptRecord;
  job: { status: string; submitCount: number; externalJobId: string | null };
  run: { status: string };
  providerCalls: number;
  budgetWrites: number;
  assetWrites: number;
  flagsWritten: number;
  ledgerWrites: number;
};

export function isGenerationAttemptTerminal(status: string): boolean {
  return (GENERATION_ATTEMPT_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function desiredStatusForAttemptOutcome(
  outcome: GenerationAttemptOutcome,
): "completed" | "failed" | "hold" {
  if (outcome === "success") return "completed";
  if (outcome === "provider_failed" || outcome === "quarantined") return "failed";
  return "hold";
}

export function assertJobRunCompletedImpliesAttemptTerminal(input: {
  jobStatus: string;
  runStatus: string;
  attemptStatus: string;
}): void {
  if (input.jobStatus === "completed" && input.runStatus === "completed") {
    if (!isGenerationAttemptTerminal(input.attemptStatus)) {
      throw new Error("BLOCKED_ATTEMPT_NOT_TERMINAL_AFTER_JOB_RUN_COMPLETED");
    }
  }
}

export function resolveGenerationAttemptTerminalDecision(input: {
  outcome: GenerationAttemptOutcome;
  attempt: GenerationAttemptRecord;
  expected: {
    workspaceId: string;
    projectId: string;
    runId: string;
    attemptId: string;
    currentStatus: string;
  };
  nowIso: string;
  settlementCostStatus?: string | null;
}): GenerationAttemptTerminalDecision {
  if (input.attempt.id !== input.expected.attemptId) {
    return { kind: "refused", code: "target_mismatch", message: "attempt id mismatch" };
  }
  if (
    input.attempt.workspaceId !== input.expected.workspaceId ||
    input.attempt.projectId !== input.expected.projectId ||
    input.attempt.runId !== input.expected.runId
  ) {
    return { kind: "refused", code: "scope_mismatch", message: "workspace/project/run mismatch" };
  }
  if (input.attempt.status !== input.expected.currentStatus) {
    return {
      kind: "conflict",
      code: "optimistic_conflict",
      message: "attempt status does not match expected current status",
    };
  }

  const desired = desiredStatusForAttemptOutcome(input.outcome);
  if (desired === "hold") {
    if (isGenerationAttemptTerminal(input.attempt.status)) {
      return {
        kind: "refused",
        code: "terminal_reopen_forbidden",
        message: "cannot reopen a terminal attempt",
      };
    }
    return {
      kind: "prudent_hold",
      nextStatus: input.attempt.status,
      retryable: false,
      completedAt: null,
    };
  }

  if (isGenerationAttemptTerminal(input.attempt.status)) {
    if (input.attempt.status === desired) {
      return {
        kind: "existing",
        nextStatus: desired,
        completedAt: input.attempt.completedAt ?? input.nowIso,
        retryable: false,
      };
    }
    return {
      kind: "refused",
      code: "terminal_conflict",
      message: "attempt already terminal with a different status",
    };
  }

  return {
    kind: "apply",
    expectedCurrentStatus: input.attempt.status,
    nextStatus: desired,
    completedAt: input.nowIso,
    retryable: false,
    costStatus: desired === "completed" ? (input.settlementCostStatus ?? "provisional") : null,
    preserveExternalJobId: true,
  };
}

export function applyGenerationAttemptTerminalToStore(
  store: GenerationAttemptLifecycleStore,
  decision: GenerationAttemptTerminalDecision,
): {
  store: GenerationAttemptLifecycleStore;
  result: "applied" | "existing" | "conflict" | "refused" | "prudent_hold";
} {
  if (decision.kind === "conflict") {
    return { store, result: "conflict" };
  }
  if (decision.kind === "refused") {
    return { store, result: "refused" };
  }
  if (decision.kind === "existing") {
    return {
      store: {
        ...store,
        attempt: { ...store.attempt, retryable: false },
      },
      result: "existing",
    };
  }
  if (decision.kind === "prudent_hold") {
    return {
      store: {
        ...store,
        attempt: {
          ...store.attempt,
          retryable: false,
          completedAt: null,
        },
      },
      result: "prudent_hold",
    };
  }
  if (store.attempt.status !== decision.expectedCurrentStatus) {
    return { store, result: "conflict" };
  }
  return {
    store: {
      ...store,
      attempt: {
        ...store.attempt,
        status: decision.nextStatus,
        completedAt: decision.completedAt,
        retryable: false,
        costStatus: decision.costStatus,
        externalJobId: store.attempt.externalJobId,
      },
    },
    result: "applied",
  };
}

export function resumeAfterProviderTerminal(input: {
  attemptStatus: string;
  jobStatus: string;
  runStatus: string;
  submitCount: number;
  providerJobIdPresent: boolean;
}): { mayResubmit: false; next: "ingest_or_fail" | "mark_attempt_terminal" | "mark_job_run" | "settle" } {
  if (input.submitCount !== 1 || !input.providerJobIdPresent) {
    return { mayResubmit: false, next: "ingest_or_fail" };
  }
  if (!isGenerationAttemptTerminal(input.attemptStatus)) {
    return { mayResubmit: false, next: "mark_attempt_terminal" };
  }
  if (input.jobStatus !== "completed" || input.runStatus !== "completed") {
    return { mayResubmit: false, next: "mark_job_run" };
  }
  return { mayResubmit: false, next: "settle" };
}

export function resumeAfterAttemptTerminal(input: {
  attemptStatus: string;
  jobStatus: string;
  runStatus: string;
  submitCount: number;
}): { mayResubmit: false; next: "mark_job_run" | "settle" | "done" } {
  if (input.submitCount !== 1) {
    return { mayResubmit: false, next: "mark_job_run" };
  }
  if (input.jobStatus !== "completed" || input.runStatus !== "completed") {
    return { mayResubmit: false, next: "mark_job_run" };
  }
  if (!isGenerationAttemptTerminal(input.attemptStatus)) {
    return { mayResubmit: false, next: "mark_job_run" };
  }
  return { mayResubmit: false, next: "done" };
}

export function assertAttemptHelperHasNoSideEffects(store: GenerationAttemptLifecycleStore): void {
  if (
    store.providerCalls !== 0 ||
    store.budgetWrites !== 0 ||
    store.assetWrites !== 0 ||
    store.flagsWritten !== 0 ||
    store.ledgerWrites !== 0
  ) {
    throw new Error("BLOCKED_ATTEMPT_HELPER_SIDE_EFFECT");
  }
}

export function redactGenerationAttemptError(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/token=[^&\s]+/gi, "token=[redacted]");
}
