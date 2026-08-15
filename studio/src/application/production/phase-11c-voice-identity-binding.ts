/**
 * Phase 11C — explicit per-project Voice bindings. Append-only in-memory.
 * No Production persist. Current I2V project has no narrator selection yet.
 */
import { PHASE_11C_PROJECT_ID, PHASE_11C_WORKSPACE_ID } from "./phase-11c-voice-allowlist";
import { PHASE_11C_CANONICAL_SCRIPT_ID } from "./phase-11c-spoken-segment";
import {
  type VoiceIdentityStableKey,
} from "./phase-11c-voice-identity-catalog";

export const PHASE_11C_VOICE_BINDING_VERSION = "voice-identity-binding-1.0.0" as const;

export type ProjectVoiceBinding = {
  bindingVersion: typeof PHASE_11C_VOICE_BINDING_VERSION;
  id: string;
  workspaceId: string;
  projectId: string;
  scriptArtifactId: string;
  scriptRevision: number;
  bindingRole: "character" | "narrator";
  voiceIdentityStableKey: VoiceIdentityStableKey;
  allowedContentKind: "dialogue" | "voice_over";
  locale: "fr";
  status: "prepared" | "active" | "superseded" | "blocked";
  selectedBy: string;
  idempotencyKey: string;
  createdAt: string;
  revision: number;
};

export type ProjectVoiceBindingStore = {
  records: ProjectVoiceBinding[];
};

export function createProjectVoiceBindingStore(): ProjectVoiceBindingStore {
  return { records: [] };
}

export function persistProjectVoiceBinding(
  store: ProjectVoiceBindingStore,
  input: {
    id: string;
    workspaceId?: string;
    projectId?: string;
    scriptArtifactId?: string;
    scriptRevision?: number;
    bindingRole: ProjectVoiceBinding["bindingRole"];
    voiceIdentityStableKey: VoiceIdentityStableKey;
    selectedBy: string;
    createdAt: string;
    idempotencyKey: string;
    expectedRevision: number;
    status?: ProjectVoiceBinding["status"];
  },
): { result: "created" | "existing"; binding: ProjectVoiceBinding } {
  const existingSameKey = store.records.find((row) => row.idempotencyKey === input.idempotencyKey);
  if (existingSameKey) {
    return { result: "existing", binding: existingSameKey };
  }

  const workspaceId = input.workspaceId ?? PHASE_11C_WORKSPACE_ID;
  const projectId = input.projectId ?? PHASE_11C_PROJECT_ID;
  const scriptArtifactId = input.scriptArtifactId ?? PHASE_11C_CANONICAL_SCRIPT_ID;
  const scriptRevision = input.scriptRevision ?? 1;
  const allowedContentKind = input.bindingRole === "narrator" ? "voice_over" : "dialogue";

  if (input.bindingRole === "narrator") {
    if (input.voiceIdentityStableKey === "character_mei" || input.voiceIdentityStableKey === "character_tom") {
      throw new Error("Phase 11C binding: character identity cannot be selected as narrator.");
    }
  } else if (
    input.voiceIdentityStableKey === "narrator_female" ||
    input.voiceIdentityStableKey === "narrator_male"
  ) {
    throw new Error("Phase 11C binding: narrator identity cannot speak as a character.");
  }

  const latest = store.records
    .filter(
      (row) =>
        row.workspaceId === workspaceId &&
        row.projectId === projectId &&
        row.scriptArtifactId === scriptArtifactId &&
        row.scriptRevision === scriptRevision &&
        row.bindingRole === input.bindingRole,
    )
    .at(-1);
  if (latest && latest.revision !== input.expectedRevision) {
    throw new Error("Phase 11C binding: optimistic lock conflict.");
  }

  if (input.bindingRole === "narrator" && (input.status ?? "active") === "active") {
    const active = store.records.filter(
      (row) =>
        row.workspaceId === workspaceId &&
        row.projectId === projectId &&
        row.scriptArtifactId === scriptArtifactId &&
        row.scriptRevision === scriptRevision &&
        row.bindingRole === "narrator" &&
        row.status === "active",
    );
    if (active.length > 0) {
      for (const row of active) row.status = "superseded";
    }
  }

  const next: ProjectVoiceBinding = {
    bindingVersion: PHASE_11C_VOICE_BINDING_VERSION,
    id: input.id,
    workspaceId,
    projectId,
    scriptArtifactId,
    scriptRevision,
    bindingRole: input.bindingRole,
    voiceIdentityStableKey: input.voiceIdentityStableKey,
    allowedContentKind,
    locale: "fr",
    status: input.status ?? "active",
    selectedBy: input.selectedBy,
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt,
    revision: input.expectedRevision + 1,
  };
  store.records.push(next);
  return { result: "created", binding: next };
}

export function activeNarratorBinding(
  store: ProjectVoiceBindingStore,
  input: { workspaceId: string; projectId: string; scriptArtifactId: string; scriptRevision: number },
): ProjectVoiceBinding | undefined {
  const active = store.records.filter(
    (row) =>
      row.workspaceId === input.workspaceId &&
      row.projectId === input.projectId &&
      row.scriptArtifactId === input.scriptArtifactId &&
      row.scriptRevision === input.scriptRevision &&
      row.bindingRole === "narrator" &&
      row.status === "active",
  );
  if (active.length > 1) {
    throw new Error("Phase 11C binding: multiple active narrator choices are forbidden.");
  }
  return active[0];
}

export function currentI2vProjectHasNarratorSelection(): false {
  return false;
}
