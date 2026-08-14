/**
 * Phase 11B close audit — read-only facts. No provider, media, or Production write.
 */
export const PHASE_11B_CLOSE_AUTH = "AUTH_11B_CLOSE_AND_NEXT_MEDIA_GATE_AUDIT" as const;

export const PHASE_11B_CLOSE_VERDICT = "PHASE_11B_CLOSED_PASS_WITH_NOTES" as const;

export const PHASE_11B_NEXT_AUTH = "AUTH_11B_I2V_ATTEMPT_TERMINAL_STATE_HARDENING" as const;

export const PHASE_11B_FOLLOW_ON_VOICE_AUTH =
  "AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT" as const;

export const PHASE_11B_I2V_ATTEMPT_ID_PREFIX = "6be95728" as const;

export type Phase11BCloseDebtSeverity = "P0" | "P1" | "P2";

export type Phase11BChainClassification =
  | "PASS_REAL"
  | "PASS_WITH_NOTE"
  | "PASS_SYNTHETIC"
  | "UNAVAILABLE"
  | "DEFERRED"
  | "BLOCKED";

export function classifyPhase11BAttemptDebt(input: {
  attemptStatus: string;
  jobStatus: string;
  runStatus: string;
  submitCount: number;
  providerJobIdPresent: boolean;
  uniqueIdempotencyKey: boolean;
  startedAttemptCountInWorkspace: number;
  resubmitConsumerExists: boolean;
  flagsOff: boolean;
}): { severity: Phase11BCloseDebtSeverity; resubmitPossible: boolean } {
  const resubmitPossible =
    input.resubmitConsumerExists ||
    !input.flagsOff ||
    input.submitCount !== 1 ||
    !input.providerJobIdPresent ||
    !input.uniqueIdempotencyKey ||
    input.jobStatus !== "completed" ||
    input.runStatus !== "completed";
  if (resubmitPossible) {
    return { severity: "P0", resubmitPossible: true };
  }
  if (input.attemptStatus === "started" && input.startedAttemptCountInWorkspace >= 1) {
    return { severity: "P1", resubmitPossible: false };
  }
  return { severity: "P2", resubmitPossible: false };
}

export function classifyPhase11BArtifactPointerDebt(input: {
  qualityReportActiveIsI2v: boolean;
  productionResultActiveIsI2v: boolean;
  generationPlanActiveIs11A: boolean;
  i2vGenerationPlanPersistedNotActive: boolean;
  mergeExportAuthorized: boolean;
  outputActive: boolean;
}): { severity: Phase11BCloseDebtSeverity; coherentForNewProduction: boolean } {
  const mixed =
    input.qualityReportActiveIsI2v &&
    input.productionResultActiveIsI2v &&
    input.generationPlanActiveIs11A &&
    input.i2vGenerationPlanPersistedNotActive;
  if (input.mergeExportAuthorized || input.outputActive) {
    return { severity: "P0", coherentForNewProduction: false };
  }
  if (mixed) {
    return { severity: "P1", coherentForNewProduction: false };
  }
  return { severity: "P2", coherentForNewProduction: true };
}

export function assertPhase11BCloseKeepsVideoInactive(input: {
  lifecycle: string;
  active: boolean;
  published: boolean;
}): void {
  if (input.lifecycle !== "approved" || input.active || input.published) {
    throw new Error("BLOCKED_I2V_CLOSE_VIDEO_NOT_PRIVATE_INACTIVE");
  }
}

export function assertPhase11BCloseNoSideEffects(input: {
  providerCalls: number;
  signedUrlCount: number;
  mediaReads: number;
  productionWrites: number;
  budgetWrites: number;
  flagsWritten: number;
}): void {
  if (
    input.providerCalls !== 0 ||
    input.signedUrlCount !== 0 ||
    input.mediaReads !== 0 ||
    input.productionWrites !== 0 ||
    input.budgetWrites !== 0 ||
    input.flagsWritten !== 0
  ) {
    throw new Error("BLOCKED_I2V_CLOSE_SIDE_EFFECT");
  }
}

export function choosePhase11BNextAuth(input: {
  attemptSeverity: Phase11BCloseDebtSeverity;
  resubmitPossible: boolean;
}): typeof PHASE_11B_NEXT_AUTH | typeof PHASE_11B_FOLLOW_ON_VOICE_AUTH {
  if (input.resubmitPossible || input.attemptSeverity === "P0" || input.attemptSeverity === "P1") {
    return PHASE_11B_NEXT_AUTH;
  }
  return PHASE_11B_FOLLOW_ON_VOICE_AUTH;
}
