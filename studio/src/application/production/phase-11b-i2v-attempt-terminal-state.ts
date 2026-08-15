/**
 * Phase 11B — I2V attempt terminal-state hardening and live reconciliation dry-run.
 * Mutation of the live attempt is forbidden in this phase.
 */
import {
  isGenerationAttemptTerminal,
  type GenerationAttemptRecord,
} from "./generation-attempt-terminal-state";

export const PHASE_11B_ATTEMPT_HARDENING_AUTH =
  "AUTH_11B_I2V_ATTEMPT_TERMINAL_STATE_HARDENING" as const;

export const PHASE_11B_ATTEMPT_HARDENING_VERDICT =
  "I2V_ATTEMPT_TERMINAL_STATE_HARDENED_READY_FOR_LIVE_RECONCILIATION_PREFLIGHT" as const;

export const PHASE_11B_NEXT_LIVE_RECONCILIATION_AUTH =
  "AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT" as const;

export const PHASE_11B_LIVE_ATTEMPT_ID = "6be95728-3c97-4c34-86c9-b1b5ab3a92dc" as const;
export const PHASE_11B_LIVE_RUN_ID = "4c5b53a5-584d-4f0d-a08f-3bf5d9a8f460" as const;
export const PHASE_11B_LIVE_JOB_ID = "2e43152b-051a-41e1-8ecf-6619f868f795" as const;
export const PHASE_11B_LIVE_WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01" as const;
export const PHASE_11B_LIVE_PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974" as const;
export const PHASE_11B_LIVE_VIDEO_ASSET_ID = "9be6cb0c-45ee-40f6-b433-02b62d81a283" as const;

export const PHASE_11B_I2V_PAID_SCRIPT_AUTH_CONSUMED = true as const;

export type Phase11BLiveReconciliationFacts = {
  workspaceId: string;
  projectId: string;
  attemptId: string;
  runId: string;
  jobId: string;
  attemptStatus: string;
  attemptCountForRun: number;
  jobStatus: string;
  runStatus: string;
  submitCount: number;
  providerJobIdPresent: boolean;
  outputIngested: boolean;
  humanReviewDecision: string | null;
  videoLifecycle: string;
  videoActive: boolean;
  ledgerSettledProvisional: boolean;
  reservedActive: boolean;
};

export type Phase11BLiveReconciliationPlan = {
  mutationAllowed: false;
  targetAttemptId: string;
  currentStatus: string;
  desiredStatus: "completed";
  desiredCompletedAt: "now";
  retryable: false;
  jobStatus: string;
  runStatus: string;
  providerJobIdPresent: boolean;
  outputIngested: boolean;
  humanReviewApproved: boolean;
  ledgerSettledProvisional: boolean;
  accepted: boolean;
  refuseCode: string | null;
};

export function assertPhase11BPaidScriptMustNotResubmit(authConsumed: boolean): void {
  if (authConsumed) {
    throw new Error("AUTH_11B_I2V_FIRST_PAID_SINGLE_EXECUTION consumed — no resubmit");
  }
}

export function planPhase11BLiveAttemptReconciliation(
  facts: Phase11BLiveReconciliationFacts,
): Phase11BLiveReconciliationPlan {
  const base = {
    mutationAllowed: false as const,
    targetAttemptId: facts.attemptId,
    currentStatus: facts.attemptStatus,
    desiredStatus: "completed" as const,
    desiredCompletedAt: "now" as const,
    retryable: false as const,
    jobStatus: facts.jobStatus,
    runStatus: facts.runStatus,
    providerJobIdPresent: facts.providerJobIdPresent,
    outputIngested: facts.outputIngested,
    humanReviewApproved: facts.humanReviewDecision === "approved",
    ledgerSettledProvisional: facts.ledgerSettledProvisional,
  };

  if (facts.workspaceId !== PHASE_11B_LIVE_WORKSPACE_ID || facts.projectId !== PHASE_11B_LIVE_PROJECT_ID) {
    return { ...base, accepted: false, refuseCode: "scope_mismatch" };
  }
  if (facts.attemptId !== PHASE_11B_LIVE_ATTEMPT_ID) {
    return { ...base, accepted: false, refuseCode: "attempt_mismatch" };
  }
  if (facts.runId !== PHASE_11B_LIVE_RUN_ID || facts.jobId !== PHASE_11B_LIVE_JOB_ID) {
    return { ...base, accepted: false, refuseCode: "run_job_mismatch" };
  }
  if (facts.attemptCountForRun !== 1) {
    return { ...base, accepted: false, refuseCode: "ambiguous_attempts" };
  }
  if (facts.jobStatus !== "completed" || facts.runStatus !== "completed") {
    return { ...base, accepted: false, refuseCode: "job_run_not_terminal" };
  }
  if (!facts.providerJobIdPresent) {
    return { ...base, accepted: false, refuseCode: "missing_provider_job" };
  }
  if (!facts.outputIngested || facts.videoLifecycle !== "approved" || facts.videoActive) {
    return { ...base, accepted: false, refuseCode: "asset_incoherent" };
  }
  if (facts.humanReviewDecision !== "approved") {
    return { ...base, accepted: false, refuseCode: "human_review_incoherent" };
  }
  if (!facts.ledgerSettledProvisional || facts.reservedActive) {
    return { ...base, accepted: false, refuseCode: "budget_incoherent" };
  }
  if (isGenerationAttemptTerminal(facts.attemptStatus) && facts.attemptStatus !== "completed") {
    return { ...base, accepted: false, refuseCode: "terminal_conflict" };
  }
  if (facts.attemptStatus !== "started") {
    return { ...base, accepted: false, refuseCode: "unexpected_current_status" };
  }

  return { ...base, accepted: true, refuseCode: null };
}

export function liveAttemptFactsFromRecord(attempt: GenerationAttemptRecord): Pick<
  Phase11BLiveReconciliationFacts,
  "workspaceId" | "projectId" | "attemptId" | "runId" | "attemptStatus"
> {
  return {
    workspaceId: attempt.workspaceId,
    projectId: attempt.projectId,
    attemptId: attempt.id,
    runId: attempt.runId,
    attemptStatus: attempt.status,
  };
}
