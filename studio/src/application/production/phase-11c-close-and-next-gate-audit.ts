/**
 * Phase 11C close audit — read-only facts. No provider, media, or Production write.
 */
import {
  PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
  PHASE_11C_VOICE_TTS_HR_APPROVE_AUTH,
  PHASE_11C_VOICE_TTS_HR_APPROVE_NEXT_AUTH,
  PHASE_11C_VOICE_TTS_HR_FROZEN_I2V_POINTERS,
  phase11CVoiceScopedProductionResultId,
  phase11CVoiceScopedQualityReportId,
} from "./phase-11c-voice-tts-human-review-approve";

export const PHASE_11C_CLOSE_AUTH = "AUTH_11C_CLOSE_AND_NEXT_MEDIA_GATE_AUDIT" as const;

export const PHASE_11C_CLOSE_VERDICT = "PHASE_11C_CLOSED_PASS_WITH_NOTES" as const;

export const PHASE_11C_NEXT_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_INPUT_COLLECTION_PREFLIGHT_NO_PROVIDER" as const;

export const PHASE_11C_CLOSE_DECISION_ID_PREFIX = "068a2b25" as const;
export const PHASE_11C_CLOSE_VOICE_QR_ID_PREFIX = "a581e9e6" as const;
export const PHASE_11C_CLOSE_VOICE_PR_ID_PREFIX = "8032699a" as const;
export const PHASE_11C_CLOSE_VOICE_QR_REVISION = 6 as const;
export const PHASE_11C_CLOSE_VOICE_PR_REVISION = 11 as const;

export type Phase11CCloseDebtSeverity = "P0" | "P1" | "P2";

export type Phase11CCloseOption =
  | "ridecloud_separate_project_inputs"
  | "keep_validation_assets_private_inactive"
  | "lipsync_only_if_on_camera_character"
  | "merge_export_after_distinct_architecture_auth";

export type Phase11CCloseOptionDisposition = "chosen" | "conserved" | "deferred" | "forbidden";

export function assertPhase11CCloseAuthMatchesHrNext(): void {
  if (PHASE_11C_VOICE_TTS_HR_APPROVE_NEXT_AUTH !== PHASE_11C_CLOSE_AUTH) {
    throw new Error("Phase 11C close: HR next Auth diverged.");
  }
  if (PHASE_11C_VOICE_TTS_HR_APPROVE_AUTH !== "AUTH_11C_VOICE_TTS_PRIVATE_PREVIEW_AND_HUMAN_DECISION") {
    throw new Error("Phase 11C close: consumed HR Auth diverged.");
  }
}

export function assertPhase11CCloseKeepsAudioInactive(input: {
  lifecycle: string;
  humanReviewDecision: string;
  active: boolean;
  published: boolean;
}): void {
  if (input.lifecycle !== "approved" || input.humanReviewDecision !== "approved") {
    throw new Error("BLOCKED_VOICE_CLOSE_AUDIO_NOT_APPROVED");
  }
  if (input.active || input.published) {
    throw new Error("BLOCKED_VOICE_CLOSE_AUDIO_NOT_PRIVATE_INACTIVE");
  }
}

export function assertPhase11CCloseI2vPointersFrozen(input: {
  activeQualityReportId: string;
  activeProductionResultId: string;
  voiceQualityReportActive: boolean;
  voiceProductionResultActive: boolean;
}): void {
  if (input.activeQualityReportId !== PHASE_11C_VOICE_TTS_HR_FROZEN_I2V_POINTERS.qualityReportId) {
    throw new Error("BLOCKED_VOICE_CLOSE_I2V_QR_MUTATED");
  }
  if (input.activeProductionResultId !== PHASE_11C_VOICE_TTS_HR_FROZEN_I2V_POINTERS.productionResultId) {
    throw new Error("BLOCKED_VOICE_CLOSE_I2V_PR_MUTATED");
  }
  if (input.voiceQualityReportActive || input.voiceProductionResultActive) {
    throw new Error("BLOCKED_VOICE_CLOSE_VOICE_POINTERS_ACTIVATED");
  }
}

export function assertPhase11CCloseNoSideEffects(input: {
  providerCalls: number;
  elevenLabsCalls: number;
  signedUrlCount: number;
  mediaReads: number;
  mediaWrites: number;
  humanReviewWrites: number;
  productionWrites: number;
  budgetWrites: number;
  flagsWritten: number;
  deploymentsTriggered: number;
}): void {
  const counts = Object.values(input);
  if (counts.some((n) => n !== 0)) {
    throw new Error("BLOCKED_VOICE_CLOSE_SIDE_EFFECT");
  }
}

export function classifyPhase11CSecondSubmitDebt(input: {
  submitCount: number;
  maySubmit: boolean;
  jobStatus: string;
  runStatus: string;
  attemptStatus: string;
  flagsOff: boolean;
}): { severity: Phase11CCloseDebtSeverity; secondSubmitPossible: boolean } {
  const secondSubmitPossible =
    input.maySubmit ||
    input.submitCount !== 1 ||
    input.jobStatus !== "completed" ||
    input.runStatus !== "completed" ||
    !input.flagsOff;
  if (secondSubmitPossible) {
    return { severity: "P0", secondSubmitPossible: true };
  }
  if (input.attemptStatus !== "completed") {
    return { severity: "P1", secondSubmitPossible: false };
  }
  return { severity: "P2", secondSubmitPossible: false };
}

export function classifyPhase11CRideCloudReadiness(input: {
  technicalProofsPrivateInactive: boolean;
  rideCloudProjectExists: boolean;
  rideCloudInputsPresent: boolean;
}): { severity: Phase11CCloseDebtSeverity; nextIsRideCloudPreflight: boolean } {
  if (!input.technicalProofsPrivateInactive) {
    return { severity: "P0", nextIsRideCloudPreflight: false };
  }
  if (input.rideCloudProjectExists || input.rideCloudInputsPresent) {
    return { severity: "P2", nextIsRideCloudPreflight: true };
  }
  return { severity: "P1", nextIsRideCloudPreflight: true };
}

export function evaluatePhase11CCloseOptions(): Record<
  Phase11CCloseOption,
  Phase11CCloseOptionDisposition
> {
  return {
    ridecloud_separate_project_inputs: "chosen",
    keep_validation_assets_private_inactive: "conserved",
    lipsync_only_if_on_camera_character: "deferred",
    merge_export_after_distinct_architecture_auth: "deferred",
  };
}

export function choosePhase11CNextAuth(input: {
  audioApprovedInactive: boolean;
  secondSubmitPossible: boolean;
  i2vPointersFrozen: boolean;
}): typeof PHASE_11C_NEXT_AUTH {
  if (!input.audioApprovedInactive || input.secondSubmitPossible || !input.i2vPointersFrozen) {
    throw new Error("BLOCKED_VOICE_CLOSE_NEXT_AUTH");
  }
  return PHASE_11C_NEXT_AUTH;
}

export function phase11CCloseScopedArtifactIds(): {
  audioAssetId: typeof PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID;
  qualityReportId: string;
  productionResultId: string;
} {
  return {
    audioAssetId: PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
    qualityReportId: phase11CVoiceScopedQualityReportId(PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID),
    productionResultId: phase11CVoiceScopedProductionResultId(PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID),
  };
}

export const PHASE_11C_CLOSE_NOTES = [
  "TTS settlement remains provisional 2¢, not a firm invoice.",
  "Audio probe was unavailable; perceptual QC stayed humanOnly.",
  "Vercel flag values were not individually re-read; proof is finally 153_ plus no later paid activity.",
  "Vercel Ready SHA remains unproven.",
  "11A/11B/11C assets are private technical proofs, not RideCloud deliverables.",
  "Voice QR/PR stay non-active under strategy C; I2V pointers stay frozen.",
  "Lipsync and real merge/export stay unauthorized.",
] as const;
