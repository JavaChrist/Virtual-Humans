/**
 * Phase 11B — I2V attempt terminal-state hardening and live reconciliation dry-run.
 * Mutation of the live attempt is forbidden in this phase.
 */
import { createHash } from "node:crypto";
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

export const PHASE_11B_LIVE_RECONCILIATION_PREFLIGHT_AUTH =
  "AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT" as const;

export const PHASE_11B_LIVE_RECONCILIATION_PREFLIGHT_VERDICT =
  "I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT_READY_FOR_SINGLE_WRITE_AUTH" as const;

export const PHASE_11B_NEXT_SINGLE_WRITE_AUTH =
  "AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_SINGLE_WRITE" as const;

export const PHASE_11B_HARDENING_COMMIT_SHA = "97f7ad7" as const;

export const PHASE_11B_LIVE_ATTEMPT_ID = "6be95728-3c97-4c34-86c9-b1b5ab3a92dc" as const;
export const PHASE_11B_LIVE_RUN_ID = "4c5b53a5-584d-4f0d-a08f-3bf5d9a8f460" as const;
export const PHASE_11B_LIVE_JOB_ID = "2e43152b-051a-41e1-8ecf-6619f868f795" as const;
export const PHASE_11B_LIVE_WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01" as const;
export const PHASE_11B_LIVE_PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974" as const;
export const PHASE_11B_LIVE_VIDEO_ASSET_ID = "9be6cb0c-45ee-40f6-b433-02b62d81a283" as const;
export const PHASE_11B_LIVE_PROVIDER_JOB_ID_PREFIX = "01a0025d" as const;

export const PHASE_11B_I2V_PAID_SCRIPT_AUTH_CONSUMED = true as const;

/** Asset ingest timestamp — best historical terminal proof (provider/job/run completed_at absent). */
export const PHASE_11B_PROPOSED_COMPLETED_AT = "2026-08-14T22:24:41.938Z" as const;
export const PHASE_11B_PROPOSED_COMPLETED_AT_SOURCE = "asset_ingest" as const;

export type Phase11BCompletedAtSource =
  | "provider_terminal"
  | "job_completed"
  | "run_completed"
  | "asset_ingest"
  | "settlement"
  | "human_review_handoff"
  | "reconciliation_clock";

export type Phase11BLiveReconciliationFacts = {
  workspaceId: string;
  projectId: string;
  attemptId: string;
  runId: string;
  jobId: string;
  attemptStatus: string;
  attemptCompletedAt: string | null;
  attemptCountForRun: number;
  jobStatus: string;
  runStatus: string;
  submitCount: number;
  providerJobIdPresent: boolean;
  outputIngested: boolean;
  outputCount: number;
  humanReviewDecision: string | null;
  humanReviewRejectedCount: number;
  videoLifecycle: string;
  videoActive: boolean;
  ledgerSettledProvisional: boolean;
  reservedActive: boolean;
  hardLimitMinor: number;
  committedMinor: number;
  reservedMinor: number;
  availableMinor: number;
  proposedCompletedAt?: string;
};

export type Phase11BPreparedCas = {
  table: "generation_attempts";
  executed: false;
  expectedRows: 1;
  abortIfRowCountNotOne: true;
  match: {
    id: string;
    workspaceId: string;
    projectId: string;
    runId: string;
    status: "started";
    completedAt: null;
    externalJobIdPresent: true;
  };
  set: {
    status: "completed";
    completedAt: string;
    retryable: false;
  };
  unchanged: readonly [
    "external_job_id",
    "provider_id",
    "model_id",
    "idempotency_key",
    "run_id",
    "cost_status",
  ];
};

export type Phase11BLiveReconciliationPlan = {
  mutationAllowed: false;
  resubmitAllowed: false;
  sideEffects: "none";
  expectedRows: 1;
  targetAttemptId: string;
  currentStatus: string;
  desiredStatus: "completed";
  desiredCompletedAt: string;
  completedAtSource: Phase11BCompletedAtSource;
  retryable: false;
  jobStatus: string;
  runStatus: string;
  providerJobIdPresent: boolean;
  outputIngested: boolean;
  humanReviewApproved: boolean;
  ledgerSettledProvisional: boolean;
  preconditionsPassed: boolean;
  accepted: boolean;
  refuseCode: string | null;
  cas: Phase11BPreparedCas;
  fingerprint: string;
};

const UNCHANGED_CAS_COLUMNS = [
  "external_job_id",
  "provider_id",
  "model_id",
  "idempotency_key",
  "run_id",
  "cost_status",
] as const;

export const PHASE_11B_VERIFIED_LIVE_FACTS: Phase11BLiveReconciliationFacts = {
  workspaceId: PHASE_11B_LIVE_WORKSPACE_ID,
  projectId: PHASE_11B_LIVE_PROJECT_ID,
  attemptId: PHASE_11B_LIVE_ATTEMPT_ID,
  runId: PHASE_11B_LIVE_RUN_ID,
  jobId: PHASE_11B_LIVE_JOB_ID,
  attemptStatus: "started",
  attemptCompletedAt: null,
  attemptCountForRun: 1,
  jobStatus: "completed",
  runStatus: "completed",
  submitCount: 1,
  providerJobIdPresent: true,
  outputIngested: true,
  outputCount: 1,
  humanReviewDecision: "approved",
  humanReviewRejectedCount: 0,
  videoLifecycle: "approved",
  videoActive: false,
  ledgerSettledProvisional: true,
  reservedActive: false,
  hardLimitMinor: 437,
  committedMinor: 389,
  reservedMinor: 0,
  availableMinor: 48,
  proposedCompletedAt: PHASE_11B_PROPOSED_COMPLETED_AT,
};

export function assertPhase11BPaidScriptMustNotResubmit(authConsumed: boolean): void {
  if (authConsumed) {
    throw new Error("AUTH_11B_I2V_FIRST_PAID_SINGLE_EXECUTION consumed — no resubmit");
  }
}

export function selectPhase11BAttemptCompletedAt(input: {
  submittedAt: string;
  providerAcceptedAt?: string | null;
  providerTerminalAt?: string | null;
  jobCompletedAt?: string | null;
  runCompletedAt?: string | null;
  assetIngestedAt?: string | null;
  settlementAt?: string | null;
  humanReviewAt?: string | null;
  reconciliationNow?: string | null;
}): { iso: string; source: Phase11BCompletedAtSource; historical: boolean } {
  const submitted = Date.parse(input.submittedAt);
  const accepted = input.providerAcceptedAt ? Date.parse(input.providerAcceptedAt) : submitted;
  const floor = Math.max(submitted, accepted);

  const candidates: Array<{ value: string | null | undefined; source: Phase11BCompletedAtSource }> = [
    { value: input.providerTerminalAt, source: "provider_terminal" },
    { value: input.jobCompletedAt, source: "job_completed" },
    { value: input.runCompletedAt, source: "run_completed" },
    { value: input.assetIngestedAt, source: "asset_ingest" },
    { value: input.settlementAt, source: "settlement" },
    { value: input.humanReviewAt, source: "human_review_handoff" },
  ];

  for (const candidate of candidates) {
    if (!candidate.value) continue;
    const ms = Date.parse(candidate.value);
    if (Number.isNaN(ms) || ms < floor) continue;
    return { iso: normalizeIso(candidate.value), source: candidate.source, historical: true };
  }

  if (input.reconciliationNow) {
    return {
      iso: normalizeIso(input.reconciliationNow),
      source: "reconciliation_clock",
      historical: false,
    };
  }

  throw new Error("no reliable completed_at evidence");
}

export function planPhase11BLiveAttemptReconciliation(
  facts: Phase11BLiveReconciliationFacts,
): Phase11BLiveReconciliationPlan {
  const desiredCompletedAt = facts.proposedCompletedAt ?? PHASE_11B_PROPOSED_COMPLETED_AT;
  const cas = buildPreparedCas(facts.attemptId, desiredCompletedAt);
  const base = {
    mutationAllowed: false as const,
    resubmitAllowed: false as const,
    sideEffects: "none" as const,
    expectedRows: 1 as const,
    targetAttemptId: facts.attemptId,
    currentStatus: facts.attemptStatus,
    desiredStatus: "completed" as const,
    desiredCompletedAt,
    completedAtSource: PHASE_11B_PROPOSED_COMPLETED_AT_SOURCE,
    retryable: false as const,
    jobStatus: facts.jobStatus,
    runStatus: facts.runStatus,
    providerJobIdPresent: facts.providerJobIdPresent,
    outputIngested: facts.outputIngested,
    humanReviewApproved: facts.humanReviewDecision === "approved",
    ledgerSettledProvisional: facts.ledgerSettledProvisional,
    cas,
  };

  const refuse = (code: string): Phase11BLiveReconciliationPlan => {
    const plan = {
      ...base,
      preconditionsPassed: false,
      accepted: false,
      refuseCode: code,
      fingerprint: "",
    };
    return { ...plan, fingerprint: fingerprintPhase11BLiveReconciliationPlan(plan) };
  };

  if (facts.workspaceId !== PHASE_11B_LIVE_WORKSPACE_ID || facts.projectId !== PHASE_11B_LIVE_PROJECT_ID) {
    return refuse("scope_mismatch");
  }
  if (facts.attemptId !== PHASE_11B_LIVE_ATTEMPT_ID) {
    return refuse("attempt_mismatch");
  }
  if (facts.runId !== PHASE_11B_LIVE_RUN_ID || facts.jobId !== PHASE_11B_LIVE_JOB_ID) {
    return refuse("run_job_mismatch");
  }
  if (facts.attemptCountForRun !== 1) {
    return refuse("ambiguous_attempts");
  }
  if (facts.jobStatus !== "completed" || facts.runStatus !== "completed") {
    return refuse("job_run_not_terminal");
  }
  if (facts.submitCount !== 1) {
    return refuse("submit_count_mismatch");
  }
  if (!facts.providerJobIdPresent) {
    return refuse("missing_provider_job");
  }
  if (facts.attemptCompletedAt !== null) {
    return refuse("completed_at_already_set");
  }
  if (
    !facts.outputIngested ||
    facts.outputCount !== 1 ||
    facts.videoLifecycle !== "approved" ||
    facts.videoActive
  ) {
    return refuse("asset_incoherent");
  }
  if (facts.humanReviewDecision !== "approved" || facts.humanReviewRejectedCount !== 0) {
    return refuse("human_review_incoherent");
  }
  if (
    !facts.ledgerSettledProvisional ||
    facts.reservedActive ||
    facts.hardLimitMinor !== 437 ||
    facts.committedMinor !== 389 ||
    facts.reservedMinor !== 0 ||
    facts.availableMinor !== 48
  ) {
    return refuse("budget_incoherent");
  }
  if (isGenerationAttemptTerminal(facts.attemptStatus) && facts.attemptStatus !== "completed") {
    return refuse("terminal_conflict");
  }
  if (facts.attemptStatus !== "started") {
    return refuse("unexpected_current_status");
  }

  const accepted = {
    ...base,
    preconditionsPassed: true,
    accepted: true,
    refuseCode: null,
    fingerprint: "",
  };
  return { ...accepted, fingerprint: fingerprintPhase11BLiveReconciliationPlan(accepted) };
}

export function fingerprintPhase11BLiveReconciliationPlan(
  plan: Omit<Phase11BLiveReconciliationPlan, "fingerprint"> & { fingerprint?: string },
): string {
  const stable = {
    mutationAllowed: plan.mutationAllowed,
    resubmitAllowed: plan.resubmitAllowed,
    sideEffects: plan.sideEffects,
    expectedRows: plan.expectedRows,
    targetAttemptId: plan.targetAttemptId,
    currentStatus: plan.currentStatus,
    desiredStatus: plan.desiredStatus,
    desiredCompletedAt: plan.desiredCompletedAt,
    completedAtSource: plan.completedAtSource,
    retryable: plan.retryable,
    accepted: plan.accepted,
    refuseCode: plan.refuseCode,
    preconditionsPassed: plan.preconditionsPassed,
    cas: plan.cas,
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 16);
}

export function liveAttemptFactsFromRecord(attempt: GenerationAttemptRecord): Pick<
  Phase11BLiveReconciliationFacts,
  "workspaceId" | "projectId" | "attemptId" | "runId" | "attemptStatus" | "attemptCompletedAt"
> {
  return {
    workspaceId: attempt.workspaceId,
    projectId: attempt.projectId,
    attemptId: attempt.id,
    runId: attempt.runId,
    attemptStatus: attempt.status,
    attemptCompletedAt: attempt.completedAt,
  };
}

function buildPreparedCas(attemptId: string, completedAt: string): Phase11BPreparedCas {
  return {
    table: "generation_attempts",
    executed: false,
    expectedRows: 1,
    abortIfRowCountNotOne: true,
    match: {
      id: attemptId,
      workspaceId: PHASE_11B_LIVE_WORKSPACE_ID,
      projectId: PHASE_11B_LIVE_PROJECT_ID,
      runId: PHASE_11B_LIVE_RUN_ID,
      status: "started",
      completedAt: null,
      externalJobIdPresent: true,
    },
    set: {
      status: "completed",
      completedAt,
      retryable: false,
    },
    unchanged: UNCHANGED_CAS_COLUMNS,
  };
}

function normalizeIso(value: string): string {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error("invalid timestamp");
  }
  return new Date(ms).toISOString().replace(/\.(\d{3})\d+Z$/, ".$1Z");
}
