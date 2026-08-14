/**
 * Phase 11B — I2V worker durability contract (fake-local only).
 * Poll without resubmit. Fresh-process recovery. Ledger settle once.
 */
export type Phase11BI2vJobStatus =
  | "intent"
  | "submitted"
  | "polling"
  | "completed"
  | "failed"
  | "cancelled"
  | "quarantined";

export type Phase11BI2vJobState = {
  status: Phase11BI2vJobStatus;
  submitIntentPersisted: boolean;
  providerJobId: string | null;
  submitCount: number;
  pollCount: number;
  ledgerSettled: boolean;
  lateOutput: boolean;
  submissionUnknown: boolean;
  queueAttempts: number;
  maxQueueAttempts: number;
  downstreamRequested: boolean;
};

export function createPhase11BI2vJobState(): Phase11BI2vJobState {
  return {
    status: "intent",
    submitIntentPersisted: false,
    providerJobId: null,
    submitCount: 0,
    pollCount: 0,
    ledgerSettled: false,
    lateOutput: false,
    submissionUnknown: false,
    queueAttempts: 0,
    maxQueueAttempts: 3,
    downstreamRequested: false,
  };
}

export function persistPhase11BI2vSubmitIntent(state: Phase11BI2vJobState): Phase11BI2vJobState {
  if (state.downstreamRequested) {
    throw new Error("Phase 11B worker: downstream chaining forbidden.");
  }
  return { ...state, submitIntentPersisted: true, status: "intent" };
}

export function recordPhase11BI2vSubmit(
  state: Phase11BI2vJobState,
  providerJobId: string,
): Phase11BI2vJobState {
  if (!state.submitIntentPersisted) {
    throw new Error("Phase 11B worker: persist submit intent before provider submit.");
  }
  if (state.submitCount >= 1) {
    throw new Error("Phase 11B worker: provider resubmit forbidden.");
  }
  if (state.submissionUnknown) {
    throw new Error("Phase 11B worker: submission_unknown must poll, not resubmit.");
  }
  return {
    ...state,
    status: "submitted",
    providerJobId,
    submitCount: 1,
  };
}

export function pollPhase11BI2vJob(
  state: Phase11BI2vJobState,
  next: "IN_PROGRESS" | "COMPLETED" | "FAILED" | "LATE",
): Phase11BI2vJobState {
  if (!state.providerJobId) {
    throw new Error("Phase 11B worker: cannot poll without providerJobId.");
  }
  if (state.submitCount !== 1) {
    throw new Error("Phase 11B worker: poll must not create a second submit.");
  }
  const pollCount = state.pollCount + 1;
  if (next === "IN_PROGRESS") return { ...state, status: "polling", pollCount };
  if (next === "FAILED") return { ...state, status: "failed", pollCount };
  if (next === "LATE") return { ...state, status: "quarantined", pollCount, lateOutput: true };
  return { ...state, status: "completed", pollCount };
}

export function recoverPhase11BI2vFreshProcess(state: Phase11BI2vJobState): Phase11BI2vJobState {
  if (!state.providerJobId) {
    return { ...state, submissionUnknown: true, status: "intent" };
  }
  return { ...state, status: "polling" };
}

export function markPhase11BI2vSubmissionUnknown(state: Phase11BI2vJobState): Phase11BI2vJobState {
  return { ...state, submissionUnknown: true };
}

export function settlePhase11BI2vLedgerOnce(state: Phase11BI2vJobState): Phase11BI2vJobState {
  if (state.status !== "completed" && state.status !== "failed" && state.status !== "cancelled") {
    throw new Error("Phase 11B worker: settle only on terminal status.");
  }
  if (state.ledgerSettled) return state;
  return { ...state, ledgerSettled: true };
}

export function incrementPhase11BI2vQueueAttempt(state: Phase11BI2vJobState): Phase11BI2vJobState {
  const queueAttempts = state.queueAttempts + 1;
  if (queueAttempts > state.maxQueueAttempts) {
    throw new Error("Phase 11B worker: queue max_attempts exhausted (distinct from provider submit).");
  }
  return { ...state, queueAttempts };
}

export function cancelPhase11BI2vJob(state: Phase11BI2vJobState): Phase11BI2vJobState {
  if (state.status === "completed") {
    return { ...state, status: "quarantined", lateOutput: true };
  }
  return { ...state, status: "cancelled" };
}

export function assertPhase11BI2vNoAutomaticDownstream(state: Phase11BI2vJobState): void {
  if (state.downstreamRequested) {
    throw new Error("Phase 11B worker: voice/lipsync/merge must stay OFF.");
  }
}
