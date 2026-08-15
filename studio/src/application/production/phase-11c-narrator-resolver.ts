/**
 * Phase 11C — resolve ExistingVoiceReference from binding + consent.
 * Live Production persist is refused: Mei collision and missing artifact type.
 */
import { createExistingVoiceReference, type ExistingVoiceReference } from "@/domain/generation/existing-voice-reference";
import {
  PHASE_11C_MODEL,
  PHASE_11C_PROVIDER,
  assertPhase11CVoiceFlagsRemainOff,
} from "./phase-11c-voice-allowlist";
import {
  PHASE_11C_NARRATOR_BINDING_VERDICT,
  assertNarratorBindingScope,
  type NarratorBinding,
} from "./phase-11c-narrator-binding";
import { assertVoiceConsentAdmissible, type VoiceConsentAttestation } from "./phase-11c-voice-consent";
import {
  PHASE_11C_VOICE_SECRET_LOCATOR,
  detectCharacterVoiceCollision,
  hashVoiceSecret,
  readLocatorValue,
  verifyConfiguredVoiceFingerprint,
} from "./phase-11c-voice-secret-locator";

export type Phase11CNarratorResolution = {
  bindingAdmissible: boolean;
  consentAdmissible: boolean;
  fingerprintCoherent: boolean;
  providerModelCoherent: boolean;
  executionAuthorized: false;
  providerCallAllowed: false;
  productionPersisted: false;
  reservationCreated: false;
  reference: ExistingVoiceReference | null;
  refuseCode:
    | "character_substitution_mei"
    | "character_substitution_tom"
    | "configured_voice_absent"
    | "fingerprint_mismatch"
    | "requires_migration"
    | "consent_inadmissible"
    | "scope_mismatch"
    | null;
  verdict: typeof PHASE_11C_NARRATOR_BINDING_VERDICT;
};

export function resolveExistingVoiceReferenceFromBinding(input: {
  binding: NarratorBinding;
  consent: VoiceConsentAttestation;
}): ExistingVoiceReference {
  assertNarratorBindingScope({
    workspaceId: input.binding.workspaceId,
    projectId: input.binding.projectId,
    contentKind: input.binding.allowedContentKinds[0],
    locale: input.binding.locale,
    provider: input.binding.provider,
    model: input.binding.model,
  });
  assertVoiceConsentAdmissible(input.consent);
  if (input.binding.voiceFingerprint !== input.consent.voiceFingerprint) {
    throw new Error("Phase 11C resolver: binding/consent fingerprint mismatch.");
  }
  return createExistingVoiceReference({
    workspaceId: input.binding.workspaceId,
    projectId: input.binding.projectId,
    speakerKind: "narrator",
    narratorId: input.binding.narratorId,
    voiceProvider: input.binding.provider,
    voiceConfigIdRedacted: "el-voice:********",
    expectedModelId: input.binding.model,
    language: input.binding.locale,
    configSource: "project_narrator_binding",
    consentStatus: "authorized",
    usageRestrictions: [
      "director_tts_only",
      "no_cloning",
      "no_identity_impersonation",
      "no_downstream_auto",
      "project_scoped",
    ],
  });
}

export function evaluateLiveNarratorBindingAttempt(input: {
  env: Record<string, string | undefined>;
  characterFingerprints: { tom?: string | null; mei?: string | null };
}): Phase11CNarratorResolution {
  assertPhase11CVoiceFlagsRemainOff(input.env);
  const verified = verifyConfiguredVoiceFingerprint({
    locator: PHASE_11C_VOICE_SECRET_LOCATOR,
    env: input.env,
  });
  if (!verified.present) {
    return liveRefuse("configured_voice_absent");
  }
  const raw = readLocatorValue(PHASE_11C_VOICE_SECRET_LOCATOR, input.env);
  const fingerprint = hashVoiceSecret(raw);
  const collision = detectCharacterVoiceCollision(fingerprint, input.characterFingerprints);
  if (collision === "mei") return liveRefuse("character_substitution_mei");
  if (collision === "tom") return liveRefuse("character_substitution_tom");
  return liveRefuse("requires_migration");
}

function liveRefuse(
  refuseCode: NonNullable<Phase11CNarratorResolution["refuseCode"]>,
): Phase11CNarratorResolution {
  return {
    bindingAdmissible: false,
    consentAdmissible: false,
    fingerprintCoherent: false,
    providerModelCoherent: true,
    executionAuthorized: false,
    providerCallAllowed: false,
    productionPersisted: false,
    reservationCreated: false,
    reference: null,
    refuseCode,
    verdict: PHASE_11C_NARRATOR_BINDING_VERDICT,
  };
}

export function resolveSyntheticNarratorBinding(input: {
  binding: NarratorBinding;
  consent: VoiceConsentAttestation;
  env: Record<string, string | undefined>;
  expectedFingerprint: string;
}): Phase11CNarratorResolution {
  assertPhase11CVoiceFlagsRemainOff(input.env);
  const verified = verifyConfiguredVoiceFingerprint({
    locator: PHASE_11C_VOICE_SECRET_LOCATOR,
    env: input.env,
    expectedFingerprint: input.expectedFingerprint,
  });
  if (!verified.present) return liveRefuse("configured_voice_absent");
  if (verified.matches === false) return liveRefuse("fingerprint_mismatch");
  try {
    const reference = resolveExistingVoiceReferenceFromBinding(input);
    return {
      bindingAdmissible: true,
      consentAdmissible: true,
      fingerprintCoherent: true,
      providerModelCoherent:
        reference.voiceProvider === PHASE_11C_PROVIDER && reference.expectedModelId === PHASE_11C_MODEL,
      executionAuthorized: false,
      providerCallAllowed: false,
      productionPersisted: false,
      reservationCreated: false,
      reference,
      refuseCode: null,
      verdict: PHASE_11C_NARRATOR_BINDING_VERDICT,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/consent/i.test(message)) return liveRefuse("consent_inadmissible");
    if (/scope|project|workspace|voice_over|locale/i.test(message)) return liveRefuse("scope_mismatch");
    throw error;
  }
}

export function assertNoVoiceIdInPublicArtifact(value: unknown): void {
  const blob = JSON.stringify(value);
  if (/voiceId["']?\s*:/i.test(blob) || /ELEVENLABS_VOICE_ID\s*=\s*\S+/.test(blob)) {
    throw new Error("Phase 11C: raw voiceId must not appear in public artifacts.");
  }
}
