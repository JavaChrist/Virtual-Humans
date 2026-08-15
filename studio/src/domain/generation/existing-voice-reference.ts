/**
 * Canonical voice reference for Production TTS.
 * Provider-agnostic. Never carries an API key, sample, data URL, or biometric payload.
 */
import { createHash } from "node:crypto";

export const EXISTING_VOICE_REFERENCE_VERSION = "existing-voice-reference-1.0.0" as const;

export const VOICE_CONSENT_STATUSES = [
  "authorized",
  "insufficient",
  "missing",
  "benchmark_only",
  "revoked",
] as const;
export type VoiceConsentStatus = (typeof VOICE_CONSENT_STATUSES)[number];

export const VOICE_SPEAKER_KINDS = ["character", "narrator"] as const;
export type VoiceSpeakerKind = (typeof VOICE_SPEAKER_KINDS)[number];

export const VOICE_CONFIG_SOURCES = [
  "project_narrator_binding",
  "character_sdk_config",
  "explicit_test_fixture",
] as const;
export type VoiceConfigSource = (typeof VOICE_CONFIG_SOURCES)[number];

export type ExistingVoiceReference = {
  referenceVersion: typeof EXISTING_VOICE_REFERENCE_VERSION;
  workspaceId: string;
  projectId: string;
  speakerKind: VoiceSpeakerKind;
  characterId?: string;
  narratorId?: string;
  voiceProvider: "elevenlabs";
  /** Redacted config/asset token — never a raw provider voice id. */
  voiceConfigIdRedacted: string;
  expectedModelId: "eleven_multilingual_v2";
  language: string;
  configSource: VoiceConfigSource;
  consentStatus: VoiceConsentStatus;
  usageRestrictions: readonly string[];
  provenanceFingerprint: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertNoSensitiveLeak(value: unknown): void {
  const blob = JSON.stringify(value);
  if (
    /https?:\/\//i.test(blob) ||
    /data:[^;]+;base64,/i.test(blob) ||
    /sk[-_]|api[_-]?key|xi-api-key/i.test(blob) ||
    /token=/i.test(blob)
  ) {
    throw new Error("ExistingVoiceReference must not contain URL, secret, or media payload.");
  }
}

export function fingerprintExistingVoiceReference(
  input: Omit<ExistingVoiceReference, "provenanceFingerprint" | "referenceVersion"> & {
    referenceVersion?: typeof EXISTING_VOICE_REFERENCE_VERSION;
  },
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: EXISTING_VOICE_REFERENCE_VERSION,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        speakerKind: input.speakerKind,
        characterId: input.characterId ?? "",
        narratorId: input.narratorId ?? "",
        voiceProvider: input.voiceProvider,
        voiceConfigIdRedacted: input.voiceConfigIdRedacted,
        expectedModelId: input.expectedModelId,
        language: input.language,
        configSource: input.configSource,
        consentStatus: input.consentStatus,
        usageRestrictions: [...input.usageRestrictions].sort(),
      }),
    )
    .digest("hex");
}

export function createExistingVoiceReference(
  input: Omit<ExistingVoiceReference, "provenanceFingerprint" | "referenceVersion"> & {
    referenceVersion?: typeof EXISTING_VOICE_REFERENCE_VERSION;
  },
): ExistingVoiceReference {
  if (!UUID_RE.test(input.workspaceId) || !UUID_RE.test(input.projectId)) {
    throw new Error("ExistingVoiceReference: workspace/project ids must be UUIDs.");
  }
  if (input.speakerKind === "character" && !input.characterId) {
    throw new Error("ExistingVoiceReference: character speaker requires characterId.");
  }
  if (input.speakerKind === "narrator" && !input.narratorId) {
    throw new Error("ExistingVoiceReference: narrator speaker requires narratorId.");
  }
  if (input.voiceProvider !== "elevenlabs") {
    throw new Error("ExistingVoiceReference: provider must be elevenlabs.");
  }
  if (input.expectedModelId !== "eleven_multilingual_v2") {
    throw new Error("ExistingVoiceReference: model must be eleven_multilingual_v2.");
  }
  if (!input.language.trim()) {
    throw new Error("ExistingVoiceReference: language is required.");
  }
  if (!input.voiceConfigIdRedacted.startsWith("el-voice:")) {
    throw new Error("ExistingVoiceReference: voiceConfigIdRedacted must use el-voice: prefix.");
  }
  if (/[0-9a-zA-Z]{16,}/.test(input.voiceConfigIdRedacted.replace(/^el-voice:/, ""))) {
    throw new Error("ExistingVoiceReference: raw provider voice id is forbidden.");
  }
  const draft: ExistingVoiceReference = {
    referenceVersion: EXISTING_VOICE_REFERENCE_VERSION,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    speakerKind: input.speakerKind,
    characterId: input.characterId,
    narratorId: input.narratorId,
    voiceProvider: "elevenlabs",
    voiceConfigIdRedacted: input.voiceConfigIdRedacted,
    expectedModelId: "eleven_multilingual_v2",
    language: input.language,
    configSource: input.configSource,
    consentStatus: input.consentStatus,
    usageRestrictions: Object.freeze([...input.usageRestrictions]),
    provenanceFingerprint: "",
  };
  draft.provenanceFingerprint = fingerprintExistingVoiceReference(draft);
  assertNoSensitiveLeak(draft);
  return Object.freeze(draft);
}

export function assertVoiceConsentAllowsProductionTts(reference: ExistingVoiceReference): void {
  if (reference.consentStatus !== "authorized") {
    throw new Error("ExistingVoiceReference: Voice consent is insufficient for Production TTS.");
  }
}

export function assertVoiceReferenceExplicit(reference: ExistingVoiceReference | null | undefined): ExistingVoiceReference {
  if (!reference) {
    throw new Error("ExistingVoiceReference: explicit voice reference is required.");
  }
  return reference;
}
