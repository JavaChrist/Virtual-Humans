/**
 * Phase 11C — bounded Voice consent attestation. Append-only. Never stores a voiceId.
 */
import {
  PHASE_11C_MODEL,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_PROVIDER,
  PHASE_11C_WORKSPACE_ID,
} from "./phase-11c-voice-allowlist";
import { PHASE_11C_NARRATOR_ID } from "./phase-11c-narrator-binding";

export const PHASE_11C_VOICE_CONSENT_VERSION = "voice-consent-1.0.0" as const;

export type VoiceConsentAttestation = {
  consentVersion: typeof PHASE_11C_VOICE_CONSENT_VERSION;
  id: string;
  workspaceId: string;
  projectId: string;
  narratorId: typeof PHASE_11C_NARRATOR_ID;
  decidedBy: "christian";
  decidedAt: string;
  provider: "elevenlabs";
  model: "eleven_multilingual_v2";
  voiceFingerprint: string;
  voiceFingerprintPrefix: string;
  allowedUsage: "tts_voice_over";
  locale: "fr";
  rightsSource: "christian_elevenlabs_subscription_attestation";
  projectScoped: true;
  globalConsent: false;
  cloningAuthorized: false;
  lipsyncAuthorized: false;
  publicationAuthorized: false;
  providerCallAuthorized: false;
  revocable: true;
  status: "authorized" | "revoked" | "refused" | "contradictory";
  expectedRevision: number;
};

export type VoiceConsentStore = {
  records: VoiceConsentAttestation[];
};

export function createVoiceConsentStore(): VoiceConsentStore {
  return { records: [] };
}

export function persistVoiceConsent(
  store: VoiceConsentStore,
  input: {
    id: string;
    voiceFingerprint: string;
    decidedAt: string;
    expectedRevision: number;
    status?: VoiceConsentAttestation["status"];
  },
): { result: "created" | "existing"; consent: VoiceConsentAttestation } {
  const existing = store.records[store.records.length - 1];
  const next: VoiceConsentAttestation = {
    consentVersion: PHASE_11C_VOICE_CONSENT_VERSION,
    id: input.id,
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    narratorId: PHASE_11C_NARRATOR_ID,
    decidedBy: "christian",
    decidedAt: input.decidedAt,
    provider: PHASE_11C_PROVIDER,
    model: PHASE_11C_MODEL,
    voiceFingerprint: input.voiceFingerprint,
    voiceFingerprintPrefix: input.voiceFingerprint.slice(0, 12),
    allowedUsage: "tts_voice_over",
    locale: "fr",
    rightsSource: "christian_elevenlabs_subscription_attestation",
    projectScoped: true,
    globalConsent: false,
    cloningAuthorized: false,
    lipsyncAuthorized: false,
    publicationAuthorized: false,
    providerCallAuthorized: false,
    revocable: true,
    status: input.status ?? "authorized",
    expectedRevision: input.expectedRevision + 1,
  };
  if (existing) {
    if (
      existing.workspaceId === next.workspaceId &&
      existing.projectId === next.projectId &&
      existing.narratorId === next.narratorId &&
      existing.voiceFingerprint === next.voiceFingerprint &&
      existing.status === next.status
    ) {
      return { result: "existing", consent: existing };
    }
    if (existing.expectedRevision !== input.expectedRevision) {
      throw new Error("Phase 11C consent: optimistic lock conflict.");
    }
    if (existing.status === "revoked" && next.status === "authorized") {
      throw new Error("Phase 11C consent: historical consent cannot be mutated.");
    }
    if (existing.status === "contradictory" || next.status === "contradictory") {
      throw new Error("Phase 11C consent: contradictory consent refused.");
    }
    throw new Error("Phase 11C consent: historical consent cannot be mutated.");
  }
  store.records.push(next);
  return { result: "created", consent: next };
}

export type VoiceConsentAdmissibilityInput = Omit<
  VoiceConsentAttestation,
  "globalConsent" | "cloningAuthorized"
> & {
  globalConsent: boolean;
  cloningAuthorized: boolean;
};

export function assertVoiceConsentAdmissible(consent: VoiceConsentAdmissibilityInput | undefined): void {
  if (!consent) {
    throw new Error("Phase 11C consent: attestation is missing.");
  }
  if (consent.status === "revoked") {
    throw new Error("Phase 11C consent: revoked consent refused.");
  }
  if (consent.status === "contradictory" || consent.status === "refused") {
    throw new Error("Phase 11C consent: contradictory consent refused.");
  }
  if (consent.globalConsent) {
    throw new Error("Phase 11C consent: global consent must not be inferred.");
  }
  if (consent.cloningAuthorized) {
    throw new Error("Phase 11C consent: cloning is not authorized.");
  }
  if (consent.status !== "authorized") {
    throw new Error("Phase 11C consent: attestation is not authorized.");
  }
}
