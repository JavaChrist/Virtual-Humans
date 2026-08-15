/**
 * Phase 11C — GenerationPlan Voice identity references. No raw voiceId. No auto-generate.
 */
import { createHash } from "node:crypto";
import { fingerprintCatalogSelection, type VoiceIdentityStableKey } from "./phase-11c-voice-identity-catalog";
import type { VoiceIdentityResolution } from "./phase-11c-voice-identity-resolver";

export const PHASE_11C_VOICE_IDENTITY_PLAN_VERSION = "voice-identity-plan-1.0.0" as const;

export type VoiceIdentityPlanRef = {
  planVersion: typeof PHASE_11C_VOICE_IDENTITY_PLAN_VERSION;
  voiceIdentityStableKey: VoiceIdentityStableKey;
  bindingId: string | null;
  consentAttestationId: string | null;
  locator: string;
  expectedFingerprint: string;
  role: "character" | "narrator";
  scriptArtifactId: string;
  scriptRevision: number;
  segmentId: string;
  spokenKind: "dialogue" | "voice_over";
  speaker: string;
  locale: "fr";
  selectionRevision: number;
  provenanceFingerprint: string;
  stale: false;
  autoGenerate: false;
  persistedToProduction: false;
};

export function buildVoiceIdentityPlanRef(input: {
  resolution: VoiceIdentityResolution;
  bindingId?: string | null;
  consentAttestationId?: string | null;
  scriptArtifactId: string;
  scriptRevision: number;
  segmentId: string;
  spokenKind: "dialogue" | "voice_over";
  speaker: string;
  selectionRevision: number;
}): VoiceIdentityPlanRef {
  const provenanceFingerprint = fingerprintCatalogSelection({
    stableKey: input.resolution.stableKey,
    scriptArtifactId: input.scriptArtifactId,
    scriptRevision: input.scriptRevision,
    selectionRevision: input.selectionRevision,
    expectedFingerprint: input.resolution.expectedFingerprint,
  });
  return {
    planVersion: PHASE_11C_VOICE_IDENTITY_PLAN_VERSION,
    voiceIdentityStableKey: input.resolution.stableKey,
    bindingId: input.bindingId ?? null,
    consentAttestationId: input.consentAttestationId ?? null,
    locator: input.resolution.locator,
    expectedFingerprint: input.resolution.expectedFingerprint,
    role: input.resolution.role,
    scriptArtifactId: input.scriptArtifactId,
    scriptRevision: input.scriptRevision,
    segmentId: input.segmentId,
    spokenKind: input.spokenKind,
    speaker: input.speaker,
    locale: "fr",
    selectionRevision: input.selectionRevision,
    provenanceFingerprint,
    stale: false,
    autoGenerate: false,
    persistedToProduction: false,
  };
}

export function voiceIdentityPlanIsStale(input: {
  plan: VoiceIdentityPlanRef;
  bindingId?: string | null;
  consentDecision?: "authorized" | "revoked" | "refused" | "insufficient" | "missing";
  currentFingerprint?: string | null;
  scriptArtifactId?: string;
  scriptRevision?: number;
  speaker?: string;
  selectionRevision?: number;
  narratorStableKey?: VoiceIdentityStableKey;
}): boolean {
  if (input.bindingId != null && input.bindingId !== input.plan.bindingId) return true;
  if (input.consentDecision && input.consentDecision !== "authorized") return true;
  if (input.currentFingerprint && input.currentFingerprint !== input.plan.expectedFingerprint) return true;
  if (input.scriptArtifactId && input.scriptArtifactId !== input.plan.scriptArtifactId) return true;
  if (input.scriptRevision != null && input.scriptRevision !== input.plan.scriptRevision) return true;
  if (input.speaker && input.speaker !== input.plan.speaker) return true;
  if (input.selectionRevision != null && input.selectionRevision !== input.plan.selectionRevision) return true;
  if (input.narratorStableKey && input.narratorStableKey !== input.plan.voiceIdentityStableKey) return true;
  return false;
}

export function assertNoVoiceIdInPlan(value: unknown): void {
  const blob = JSON.stringify(value);
  if (/voiceId["']?\s*:/i.test(blob) || /ELEVENLABS_[A-Z_]*VOICE_ID\s*=\s*\S+/.test(blob)) {
    throw new Error("Phase 11C identity plan: raw voiceId must not appear.");
  }
}

export function fingerprintVoiceIdentityPlan(plan: VoiceIdentityPlanRef): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: plan.planVersion,
        key: plan.voiceIdentityStableKey,
        locator: plan.locator,
        fingerprint: plan.expectedFingerprint,
        script: plan.scriptArtifactId,
        rev: plan.scriptRevision,
        segment: plan.segmentId,
        kind: plan.spokenKind,
        speaker: plan.speaker,
        selection: plan.selectionRevision,
        provenance: plan.provenanceFingerprint,
      }),
    )
    .digest("hex");
}
