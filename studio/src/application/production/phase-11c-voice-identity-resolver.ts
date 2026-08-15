/**
 * Phase 11C — fail-closed Voice identity resolver. No global env fallback.
 */
import { PHASE_11C_PROJECT_ID, PHASE_11C_WORKSPACE_ID } from "./phase-11c-voice-allowlist";
import {
  HISTORICAL_GLOBAL_VOICE_LOCATOR,
  MEI_CHARACTER_ID,
  TOM_CHARACTER_ID,
  type VoiceIdentityRecord,
  type VoiceIdentityStableKey,
} from "./phase-11c-voice-identity-catalog";
import {
  assertVoiceIdentityConsentAdmissible,
  type VoiceIdentityConsentAttestation,
} from "./phase-11c-voice-identity-consent";
import { type ProjectVoiceBinding } from "./phase-11c-voice-identity-binding";

export type VoiceIdentityResolution = {
  stableKey: VoiceIdentityStableKey;
  role: "character" | "narrator";
  locator: string;
  expectedFingerprint: string;
  expectedFingerprintPrefix: string;
  executionAuthorized: false;
  providerCallAllowed: false;
  usedHistoricalGlobalFallback: false;
};

export function resolveVoiceIdentityForSegment(input: {
  workspaceId: string;
  projectId: string;
  spokenKind: "dialogue" | "voice_over";
  speakerKind: "character" | "narrator";
  characterId?: string;
  identities: Record<VoiceIdentityStableKey, VoiceIdentityRecord>;
  consents: Partial<Record<VoiceIdentityStableKey, VoiceIdentityConsentAttestation | undefined>>;
  narratorBinding?: ProjectVoiceBinding;
  narratorChoices?: VoiceIdentityStableKey[];
}): VoiceIdentityResolution {
  if (input.workspaceId !== PHASE_11C_WORKSPACE_ID) {
    throw new Error("Phase 11C identity resolver: workspace not in scope.");
  }
  if (input.projectId !== PHASE_11C_PROJECT_ID) {
    throw new Error("Phase 11C identity resolver: project not in scope.");
  }
  if (input.spokenKind === "dialogue") {
    return resolveDialogue(input);
  }
  return resolveVoiceOver(input);
}

function requirePreparedIdentity(
  identities: Record<VoiceIdentityStableKey, VoiceIdentityRecord>,
  key: VoiceIdentityStableKey,
  consent: VoiceIdentityConsentAttestation | undefined,
): VoiceIdentityResolution {
  const identity = identities[key];
  if (!identity || identity.status === "unavailable") {
    throw new Error("Phase 11C identity resolver: locator is absent.");
  }
  if (!identity.voiceFingerprint) {
    throw new Error("Phase 11C identity resolver: locator is absent.");
  }
  assertVoiceIdentityConsentAdmissible(consent, key);
  return {
    stableKey: key,
    role: identity.role,
    locator: identity.secretLocator,
    expectedFingerprint: identity.voiceFingerprint,
    expectedFingerprintPrefix: identity.voiceFingerprintPrefix ?? identity.voiceFingerprint.slice(0, 12),
    executionAuthorized: false,
    providerCallAllowed: false,
    usedHistoricalGlobalFallback: false,
  };
}

function resolveDialogue(input: {
  speakerKind: "character" | "narrator";
  characterId?: string;
  identities: Record<VoiceIdentityStableKey, VoiceIdentityRecord>;
  consents: Partial<Record<VoiceIdentityStableKey, VoiceIdentityConsentAttestation | undefined>>;
}): VoiceIdentityResolution {
  if (input.speakerKind === "narrator") {
    throw new Error("Phase 11C identity resolver: narrator cannot speak a dialogue segment.");
  }
  if (input.characterId === MEI_CHARACTER_ID) {
    return requirePreparedIdentity(input.identities, "character_mei", input.consents.character_mei);
  }
  if (input.characterId === TOM_CHARACTER_ID) {
    return requirePreparedIdentity(input.identities, "character_tom", input.consents.character_tom);
  }
  throw new Error("Phase 11C identity resolver: unknown dialogue speaker is refused.");
}

function resolveVoiceOver(input: {
  identities: Record<VoiceIdentityStableKey, VoiceIdentityRecord>;
  consents: Partial<Record<VoiceIdentityStableKey, VoiceIdentityConsentAttestation | undefined>>;
  narratorBinding?: ProjectVoiceBinding;
  narratorChoices?: VoiceIdentityStableKey[];
}): VoiceIdentityResolution {
  const choices = input.narratorChoices ?? (input.narratorBinding ? [input.narratorBinding.voiceIdentityStableKey] : []);
  if (choices.length === 0) {
    throw new Error("Phase 11C identity resolver: voice_over requires an explicit narrator choice.");
  }
  if (choices.length > 1) {
    throw new Error("Phase 11C identity resolver: multiple narrator choices are forbidden.");
  }
  const key = choices[0];
  if (key === "character_mei") {
    throw new Error("Phase 11C identity resolver: Mei cannot be used as narrator.");
  }
  if (key === "character_tom") {
    throw new Error("Phase 11C identity resolver: Tom cannot be used as narrator.");
  }
  if (key !== "narrator_female" && key !== "narrator_male") {
    throw new Error("Phase 11C identity resolver: narrator choice is invalid.");
  }
  return requirePreparedIdentity(input.identities, key, input.consents[key]);
}

export function assertNoHistoricalGlobalFallback(locator: string): void {
  if (locator === HISTORICAL_GLOBAL_VOICE_LOCATOR) {
    throw new Error("Phase 11C identity resolver: historical global env fallback is forbidden.");
  }
}

export function verifyResolvedFingerprint(input: {
  expectedFingerprint: string;
  configuredFingerprint: string | null;
}): void {
  if (!input.configuredFingerprint) {
    throw new Error("Phase 11C identity resolver: locator is absent.");
  }
  if (input.configuredFingerprint !== input.expectedFingerprint) {
    throw new Error("Phase 11C identity resolver: fingerprint mismatch.");
  }
}
