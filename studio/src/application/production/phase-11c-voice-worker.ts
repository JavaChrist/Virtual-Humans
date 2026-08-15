/**
 * Phase 11C — Voice worker durability for a potentially synchronous provider.
 * Fake-local only. No ElevenLabs call. No invented providerJobId.
 */
import {
  applyGenerationAttemptTerminalToStore,
  resolveGenerationAttemptTerminalDecision,
  type GenerationAttemptLifecycleStore,
  type GenerationAttemptOutcome,
  type GenerationAttemptRecord,
} from "./generation-attempt-terminal-state";

export type Phase11CVoiceJobStatus =
  | "intent"
  | "submit_intent"
  | "calling"
  | "bytes_durable"
  | "submission_unknown"
  | "ingested"
  | "completed"
  | "failed"
  | "cancelled";

export type Phase11CDurableAudio = {
  mimeType: "audio/mpeg";
  byteLength: number;
  checksum: string;
  persisted: true;
};

export type Phase11CVoiceJobState = {
  status: Phase11CVoiceJobStatus;
  submitIntentPersisted: boolean;
  submitCount: number;
  providerCalls: number;
  durableAudio: Phase11CDurableAudio | null;
  submissionUnknown: boolean;
  ledgerSettled: boolean;
  downstreamRequested: boolean;
  lipsyncRequested: boolean;
  dataUrlPersisted: false;
  providerJobId: null;
};

export function createPhase11CVoiceJobState(): Phase11CVoiceJobState {
  return {
    status: "intent",
    submitIntentPersisted: false,
    submitCount: 0,
    providerCalls: 0,
    durableAudio: null,
    submissionUnknown: false,
    ledgerSettled: false,
    downstreamRequested: false,
    lipsyncRequested: false,
    dataUrlPersisted: false,
    providerJobId: null,
  };
}

export function persistPhase11CVoiceSubmitIntent(state: Phase11CVoiceJobState): Phase11CVoiceJobState {
  if (state.downstreamRequested || state.lipsyncRequested) {
    throw new Error("Phase 11C worker: lipsync/downstream chaining forbidden.");
  }
  return { ...state, submitIntentPersisted: true, status: "submit_intent" };
}

export function recordPhase11CVoiceSyntheticCompletion(
  state: Phase11CVoiceJobState,
  audio: Phase11CDurableAudio,
): Phase11CVoiceJobState {
  if (!state.submitIntentPersisted) {
    throw new Error("Phase 11C worker: persist submit intent before the unique call.");
  }
  if (state.submitCount >= 1 || state.providerCalls >= 1) {
    throw new Error("Phase 11C worker: second TTS call forbidden.");
  }
  if (state.submissionUnknown) {
    throw new Error("Phase 11C worker: submission_unknown must not call the provider again.");
  }
  return {
    ...state,
    status: "bytes_durable",
    submitCount: 1,
    providerCalls: 0,
    durableAudio: audio,
  };
}

export function markPhase11CVoiceSubmissionUnknown(state: Phase11CVoiceJobState): Phase11CVoiceJobState {
  return {
    ...state,
    submissionUnknown: true,
    status: "submission_unknown",
    providerJobId: null,
  };
}

export function recoverPhase11CVoiceAfterSyncResponse(state: Phase11CVoiceJobState): Phase11CVoiceJobState {
  if (state.durableAudio?.persisted) {
    return { ...state, status: "bytes_durable" };
  }
  return markPhase11CVoiceSubmissionUnknown(state);
}

export function ingestPhase11CVoiceFromDurableBuffer(state: Phase11CVoiceJobState): Phase11CVoiceJobState {
  if (!state.durableAudio) {
    throw new Error("Phase 11C worker: ingest requires durable audio bytes.");
  }
  if (state.submissionUnknown && !state.durableAudio) {
    throw new Error("Phase 11C worker: cannot invent bytes after submission_unknown.");
  }
  return { ...state, status: "ingested" };
}

export function settlePhase11CVoiceLedgerOnce(state: Phase11CVoiceJobState): Phase11CVoiceJobState {
  if (state.status !== "completed" && state.status !== "failed" && state.status !== "ingested") {
    throw new Error("Phase 11C worker: settle only on a terminal or ingested status.");
  }
  if (state.ledgerSettled) return state;
  return { ...state, ledgerSettled: true };
}

export function assertPhase11CVoiceNoAutomaticDownstream(state: Phase11CVoiceJobState): void {
  if (state.downstreamRequested || state.lipsyncRequested) {
    throw new Error("Phase 11C worker: lipsync/merge/export must stay OFF.");
  }
}

export function applyPhase11CVoiceAttemptOutcome(input: {
  outcome: GenerationAttemptOutcome;
  store: GenerationAttemptLifecycleStore;
  nowIso: string;
}): { store: GenerationAttemptLifecycleStore; result: string } {
  const decision = resolveGenerationAttemptTerminalDecision({
    outcome: input.outcome,
    attempt: input.store.attempt,
    expected: {
      workspaceId: input.store.attempt.workspaceId,
      projectId: input.store.attempt.projectId,
      runId: input.store.attempt.runId,
      attemptId: input.store.attempt.id,
      currentStatus: input.store.attempt.status,
    },
    nowIso: input.nowIso,
  });
  return applyGenerationAttemptTerminalToStore(input.store, decision);
}

export function createPhase11CVoiceAttemptStore(input: {
  attemptId: string;
  runId: string;
  workspaceId: string;
  projectId: string;
  status?: string;
}): GenerationAttemptLifecycleStore {
  const attempt: GenerationAttemptRecord = {
    id: input.attemptId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    runId: input.runId,
    status: input.status ?? "started",
    externalJobId: null,
    retryable: null,
    completedAt: null,
    costStatus: null,
    providerId: "elevenlabs",
    modelId: "eleven_multilingual_v2",
  };
  return {
    attempt,
    job: { status: "started", submitCount: 0, externalJobId: null },
    run: { status: "started" },
    providerCalls: 0,
    budgetWrites: 0,
    assetWrites: 0,
    flagsWritten: 0,
    ledgerWrites: 0,
  };
}
