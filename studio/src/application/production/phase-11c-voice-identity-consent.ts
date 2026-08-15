/**
 * Phase 11C — bounded Voice consent attestations for the four catalog identities.
 * Append-only in-memory. Never persisted to Production in this phase.
 */
import { PHASE_11C_WORKSPACE_ID } from "./phase-11c-voice-allowlist";
import {
  type VoiceIdentityStableKey,
} from "./phase-11c-voice-identity-catalog";

export const PHASE_11C_VOICE_IDENTITY_CONSENT_VERSION = "voice-identity-consent-1.0.0" as const;

export type VoiceIdentityConsentScope = "character_dialogue" | "project_voice_over";
export type VoiceIdentityConsentDecision = "authorized" | "refused" | "revoked" | "insufficient";

export type VoiceIdentityConsentAttestation = {
  consentVersion: typeof PHASE_11C_VOICE_IDENTITY_CONSENT_VERSION;
  id: string;
  workspaceId: typeof PHASE_11C_WORKSPACE_ID;
  voiceIdentityStableKey: VoiceIdentityStableKey;
  scope: VoiceIdentityConsentScope;
  allowedContentKinds: readonly ["dialogue"] | readonly ["voice_over"];
  allowedProjectId: string | null;
  allowedLocale: "fr";
  authorizationSource: "christian_elevenlabs_subscription_attestation";
  decision: VoiceIdentityConsentDecision;
  revocable: true;
  revokedAt: string | null;
  createdBy: "christian";
  createdAt: string;
  idempotencyKey: string;
  globalConsent: false;
  cloningAuthorized: false;
  substitutionAuthorized: false;
  lipsyncAuthorized: false;
  publicationAuthorized: false;
  providerCallAuthorized: false;
  otherWorkspaceAuthorized: false;
  derivedIdentityAuthorized: false;
};

export type VoiceIdentityConsentStore = {
  records: VoiceIdentityConsentAttestation[];
};

export function createVoiceIdentityConsentStore(): VoiceIdentityConsentStore {
  return { records: [] };
}

function scopeFor(key: VoiceIdentityStableKey): {
  scope: VoiceIdentityConsentScope;
  allowedContentKinds: VoiceIdentityConsentAttestation["allowedContentKinds"];
} {
  if (key === "character_mei" || key === "character_tom") {
    return { scope: "character_dialogue", allowedContentKinds: ["dialogue"] };
  }
  return { scope: "project_voice_over", allowedContentKinds: ["voice_over"] };
}

export function persistVoiceIdentityConsent(
  store: VoiceIdentityConsentStore,
  input: {
    id: string;
    voiceIdentityStableKey: VoiceIdentityStableKey;
    createdAt: string;
    idempotencyKey: string;
    decision?: VoiceIdentityConsentDecision;
    allowedProjectId?: string | null;
    revokedAt?: string | null;
  },
): { result: "created" | "existing"; consent: VoiceIdentityConsentAttestation } {
  const existing = store.records.find((row) => row.idempotencyKey === input.idempotencyKey);
  const scoped = scopeFor(input.voiceIdentityStableKey);
  const next: VoiceIdentityConsentAttestation = {
    consentVersion: PHASE_11C_VOICE_IDENTITY_CONSENT_VERSION,
    id: input.id,
    workspaceId: PHASE_11C_WORKSPACE_ID,
    voiceIdentityStableKey: input.voiceIdentityStableKey,
    scope: scoped.scope,
    allowedContentKinds: scoped.allowedContentKinds,
    allowedProjectId: input.allowedProjectId ?? null,
    allowedLocale: "fr",
    authorizationSource: "christian_elevenlabs_subscription_attestation",
    decision: input.decision ?? "authorized",
    revocable: true,
    revokedAt: input.revokedAt ?? null,
    createdBy: "christian",
    createdAt: input.createdAt,
    idempotencyKey: input.idempotencyKey,
    globalConsent: false,
    cloningAuthorized: false,
    substitutionAuthorized: false,
    lipsyncAuthorized: false,
    publicationAuthorized: false,
    providerCallAuthorized: false,
    otherWorkspaceAuthorized: false,
    derivedIdentityAuthorized: false,
  };
  if (existing) {
    if (
      existing.voiceIdentityStableKey === next.voiceIdentityStableKey &&
      existing.decision === next.decision
    ) {
      return { result: "existing", consent: existing };
    }
    throw new Error("Phase 11C identity consent: historical consent cannot be mutated.");
  }
  if (next.decision === "revoked" && !next.revokedAt) {
    throw new Error("Phase 11C identity consent: revocation requires revokedAt.");
  }
  store.records.push(next);
  return { result: "created", consent: next };
}

export function latestVoiceIdentityConsent(
  store: VoiceIdentityConsentStore,
  key: VoiceIdentityStableKey,
): VoiceIdentityConsentAttestation | undefined {
  return [...store.records].reverse().find((row) => row.voiceIdentityStableKey === key);
}

export function assertVoiceIdentityConsentAdmissible(
  consent: VoiceIdentityConsentAttestation | undefined,
  key: VoiceIdentityStableKey,
): void {
  if (!consent) {
    throw new Error("Phase 11C identity consent: attestation is missing.");
  }
  if (consent.voiceIdentityStableKey !== key) {
    throw new Error("Phase 11C identity consent: identity mismatch.");
  }
  if (consent.decision === "revoked") {
    throw new Error("Phase 11C identity consent: revoked consent refused.");
  }
  if (consent.decision !== "authorized") {
    throw new Error("Phase 11C identity consent: attestation is not authorized.");
  }
  if (consent.globalConsent || consent.cloningAuthorized || consent.substitutionAuthorized) {
    throw new Error("Phase 11C identity consent: unbounded consent refused.");
  }
}
