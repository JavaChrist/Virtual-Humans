/**
 * Phase 11C — explicit narrator binding. Append-only in-memory contract.
 * Production persist is refused without a dedicated artifact type migration.
 */
import { createHash } from "node:crypto";
import {
  PHASE_11C_MODEL,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_PROVIDER,
  PHASE_11C_SUPPORTED_LANGUAGE,
  PHASE_11C_WORKSPACE_ID,
} from "./phase-11c-voice-allowlist";
import { PHASE_11C_CANONICAL_SCRIPT_ID } from "./phase-11c-spoken-segment";
import {
  PHASE_11C_VOICE_SECRET_LOCATOR,
  type Phase11CVoiceSecretLocator,
} from "./phase-11c-voice-secret-locator";

export const PHASE_11C_NARRATOR_BINDING_AUTH =
  "AUTH_11C_VOICE_NARRATOR_BINDING_AND_CONSENT" as const;
export const PHASE_11C_NARRATOR_BINDING_VERDICT =
  "BLOCKED_VOICE_NARRATOR_BINDING_CONFIG_UNAVAILABLE" as const;
export const PHASE_11C_NEXT_IDENTITY_AUTH =
  "AUTH_11C_VOICE_NARRATOR_IDENTITY_DECISION" as const;

export const PHASE_11C_NARRATOR_BINDING_VERSION = "narrator-binding-1.0.0" as const;
export const PHASE_11C_NARRATOR_ID = "narrator:project" as const;
export const PHASE_11C_LIVE_CONFIG_FINGERPRINT_PREFIX = "1a398f86b113" as const;

export type NarratorBinding = {
  bindingVersion: typeof PHASE_11C_NARRATOR_BINDING_VERSION;
  workspaceId: string;
  projectId: string;
  narratorId: typeof PHASE_11C_NARRATOR_ID;
  role: "narrator";
  allowedContentKinds: readonly ["voice_over"];
  locale: "fr";
  provider: "elevenlabs";
  model: "eleven_multilingual_v2";
  voiceSecretLocator: Phase11CVoiceSecretLocator;
  voiceFingerprint: string;
  voiceFingerprintPrefix: string;
  source: "christian_elevenlabs_subscription";
  status: "authorized" | "refused";
  scriptArtifactId: typeof PHASE_11C_CANONICAL_SCRIPT_ID;
  scriptRevision: 1;
  coversVoiceOverSegments: readonly ["segment-1", "segment-2", "segment-3", "segment-4", "segment-5"];
  revocable: true;
  activeForProviderExecution: false;
  createdBy: string;
  createdAt: string;
  expectedRevision: number;
};

export type NarratorBindingStore = {
  records: NarratorBinding[];
};

export function createNarratorBindingStore(): NarratorBindingStore {
  return { records: [] };
}

export function fingerprintNarratorBinding(
  input: Pick<
    NarratorBinding,
    "workspaceId" | "projectId" | "narratorId" | "voiceSecretLocator" | "voiceFingerprint" | "scriptArtifactId"
  >,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: PHASE_11C_NARRATOR_BINDING_VERSION,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        narratorId: input.narratorId,
        locator: input.voiceSecretLocator,
        voiceFingerprint: input.voiceFingerprint,
        scriptArtifactId: input.scriptArtifactId,
      }),
    )
    .digest("hex");
}

export function assertNarratorBindingScope(input: {
  workspaceId: string;
  projectId: string;
  contentKind: string;
  locale: string;
  provider: string;
  model: string;
  characterId?: string;
}): void {
  if (input.workspaceId !== PHASE_11C_WORKSPACE_ID) {
    throw new Error("Phase 11C binding: workspace not in scope.");
  }
  if (input.projectId !== PHASE_11C_PROJECT_ID) {
    throw new Error("Phase 11C binding: project not in scope.");
  }
  if (input.contentKind !== "voice_over") {
    throw new Error("Phase 11C binding: only voice_over is allowed.");
  }
  if (input.locale !== PHASE_11C_SUPPORTED_LANGUAGE) {
    throw new Error("Phase 11C binding: locale must be fr.");
  }
  if (input.provider !== PHASE_11C_PROVIDER || input.model !== PHASE_11C_MODEL) {
    throw new Error("Phase 11C binding: provider/model mismatch.");
  }
  if (input.characterId === "tom" || input.characterId === "mei") {
    throw new Error("Phase 11C binding: Tom/Mei substitution is forbidden.");
  }
}

export function persistNarratorBinding(
  store: NarratorBindingStore,
  input: {
    voiceFingerprint: string;
    createdBy: string;
    createdAt: string;
    expectedRevision: number;
    status?: NarratorBinding["status"];
  },
): { result: "created" | "existing"; binding: NarratorBinding } {
  const existing = store.records[store.records.length - 1];
  const next: NarratorBinding = {
    bindingVersion: PHASE_11C_NARRATOR_BINDING_VERSION,
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    narratorId: PHASE_11C_NARRATOR_ID,
    role: "narrator",
    allowedContentKinds: ["voice_over"],
    locale: "fr",
    provider: PHASE_11C_PROVIDER,
    model: PHASE_11C_MODEL,
    voiceSecretLocator: PHASE_11C_VOICE_SECRET_LOCATOR,
    voiceFingerprint: input.voiceFingerprint,
    voiceFingerprintPrefix: input.voiceFingerprint.slice(0, 12),
    source: "christian_elevenlabs_subscription",
    status: input.status ?? "authorized",
    scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
    scriptRevision: 1,
    coversVoiceOverSegments: ["segment-1", "segment-2", "segment-3", "segment-4", "segment-5"],
    revocable: true,
    activeForProviderExecution: false,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
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
      return { result: "existing", binding: existing };
    }
    if (existing.expectedRevision !== input.expectedRevision) {
      throw new Error("Phase 11C binding: optimistic lock conflict.");
    }
    throw new Error("Phase 11C binding: duplicate contradictory binding forbidden.");
  }
  store.records.push(next);
  return { result: "created", binding: next };
}
