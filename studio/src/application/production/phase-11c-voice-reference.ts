/**
 * Phase 11C — explicit voice resolution. No silent env fallback.
 */
import {
  assertVoiceConsentAllowsProductionTts,
  createExistingVoiceReference,
  type ExistingVoiceReference,
} from "@/domain/generation/existing-voice-reference";
import {
  PHASE_11C_MODEL,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_PROVIDER,
  PHASE_11C_SUPPORTED_LANGUAGE,
  PHASE_11C_WORKSPACE_ID,
} from "./phase-11c-voice-allowlist";

export const PHASE_11C_LIVE_NARRATOR_VOICE_STATUS =
  "missing_explicit_narrator_binding" as const;
export const PHASE_11C_LIVE_CONSENT_STATUS = "insufficient" as const;
export const PHASE_11C_LIVE_CONSENT_NOTE =
  "Privacy Pack MV-001 is benchmark-only and is not Voice consent." as const;

export function resolvePhase11CLiveNarratorVoice(): never {
  throw new Error(
    "Phase 11C: no authorized narrator voice is bound to the I2V project. Fail-closed; no substitution.",
  );
}

export function inspectPhase11CLiveVoiceConsent(): {
  technicalVoiceConfigured: false;
  voiceUsageAuthorized: false;
  globalConsent: false;
  benchmarkOnlyConsent: true;
  characterIdentityBound: false;
  clonedVoice: false;
  status: typeof PHASE_11C_LIVE_CONSENT_STATUS;
  note: typeof PHASE_11C_LIVE_CONSENT_NOTE;
} {
  return {
    technicalVoiceConfigured: false,
    voiceUsageAuthorized: false,
    globalConsent: false,
    benchmarkOnlyConsent: true,
    characterIdentityBound: false,
    clonedVoice: false,
    status: PHASE_11C_LIVE_CONSENT_STATUS,
    note: PHASE_11C_LIVE_CONSENT_NOTE,
  };
}

export function buildPhase11CFixtureVoiceReference(input?: {
  speakerKind?: "narrator" | "character";
  consentStatus?: ExistingVoiceReference["consentStatus"];
  characterId?: string;
  narratorId?: string;
}): ExistingVoiceReference {
  const speakerKind = input?.speakerKind ?? "narrator";
  return createExistingVoiceReference({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    speakerKind,
    characterId: speakerKind === "character" ? (input?.characterId ?? "character:fixture") : undefined,
    narratorId: speakerKind === "narrator" ? (input?.narratorId ?? "narrator:fixture") : undefined,
    voiceProvider: PHASE_11C_PROVIDER,
    voiceConfigIdRedacted: "el-voice:********",
    expectedModelId: PHASE_11C_MODEL,
    language: PHASE_11C_SUPPORTED_LANGUAGE,
    configSource: "explicit_test_fixture",
    consentStatus: input?.consentStatus ?? "authorized",
    usageRestrictions: [
      "director_tts_only",
      "no_cloning",
      "no_identity_impersonation",
      "no_downstream_auto",
    ],
  });
}

export function assertPhase11CVoiceReadyForFuturePaidCall(reference: ExistingVoiceReference): void {
  if (reference.workspaceId !== PHASE_11C_WORKSPACE_ID || reference.projectId !== PHASE_11C_PROJECT_ID) {
    throw new Error("Phase 11C voice: workspace/project mismatch.");
  }
  if (reference.voiceProvider !== PHASE_11C_PROVIDER || reference.expectedModelId !== PHASE_11C_MODEL) {
    throw new Error("Phase 11C voice: provider/model mismatch.");
  }
  assertVoiceConsentAllowsProductionTts(reference);
}
