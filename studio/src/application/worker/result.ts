/**
 * Worker run result — no job payload, prompt, URL, or lease token.
 */

export type WorkerRunStatus =
  | "disabled"
  | "dry_run"
  | "completed"
  | "partial"
  | "failed";

export type WorkerIssueCode =
  | "worker_disabled"
  | "paid_generation_disabled"
  | "claim_failed"
  | "lease_lost"
  | "job_failed"
  | "blocked_by_kill_switch"
  | "needs_review"
  | "cancelled_run"
  | "budget_exhausted"
  | "timeout"
  | "provider_budget_exhausted"
  | "dry_run_issue"
  | "unknown";

export type WorkerIssue = {
  code: WorkerIssueCode;
  publicMessage: string;
  jobId?: string;
  runId?: string;
  projectId?: string;
};

export type WorkerRunResult = {
  status: WorkerRunStatus;
  workerId: string;
  claimed: number;
  processed: number;
  completed: number;
  rescheduled: number;
  failed: number;
  leaseLost: number;
  providerCalls: number;
  durationMs: number;
  issues: WorkerIssue[];
};

export type WorkerObservabilityEvent =
  | { type: "worker.run.started"; workerId: string; correlationId: string }
  | { type: "worker.run.disabled"; workerId: string; correlationId: string }
  | {
      type: "worker.jobs.claimed";
      workerId: string;
      correlationId: string;
      count: number;
    }
  | {
      type: "worker.job.started";
      workerId: string;
      correlationId: string;
      jobId: string;
      runId: string;
      projectId: string;
    }
  | {
      type: "worker.job.rescheduled";
      workerId: string;
      correlationId: string;
      jobId: string;
      runId: string;
    }
  | {
      type: "worker.job.completed";
      workerId: string;
      correlationId: string;
      jobId: string;
      runId: string;
    }
  | {
      type: "worker.job.failed";
      workerId: string;
      correlationId: string;
      jobId: string;
      runId?: string;
      errorCode: string;
    }
  | {
      type: "worker.job.lease_lost";
      workerId: string;
      correlationId: string;
      jobId: string;
    }
  | {
      type: "worker.run.completed";
      workerId: string;
      correlationId: string;
      status: WorkerRunStatus;
      claimed: number;
      processed: number;
      completed: number;
      rescheduled: number;
      failed: number;
      leaseLost: number;
      providerCalls: number;
      durationMs: number;
    };

export type WorkerEventSink = {
  emit(event: WorkerObservabilityEvent): void | Promise<void>;
};

export function emptyWorkerResult(
  workerId: string,
  status: WorkerRunStatus,
  durationMs = 0,
  issues: WorkerIssue[] = []
): WorkerRunResult {
  return {
    status,
    workerId,
    claimed: 0,
    processed: 0,
    completed: 0,
    rescheduled: 0,
    failed: 0,
    leaseLost: 0,
    providerCalls: 0,
    durationMs,
    issues,
  };
}
