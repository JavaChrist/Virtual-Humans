/**
 * Phase 11C — post-apply facts for the Voice identity catalog migration.
 * No seed, no provider, no second apply.
 */
import { PHASE_11C_VOICE_IDENTITY_MIGRATION } from "./phase-11c-voice-identity-catalog";
import {
  PHASE_11C_VOICE_GRANT_MATRIX,
  PHASE_11C_VOICE_IDENTITY_MIGRATION_GIT_BLOB,
  PHASE_11C_VOICE_IDENTITY_MIGRATION_SHA256,
  PHASE_11C_VOICE_TABLES,
  compareVoiceIdentityMigrationDrift,
} from "./phase-11c-voice-identity-remote-preflight";
import { assertPhase11CVoiceFlagsRemainOff } from "./phase-11c-voice-allowlist";

export const PHASE_11C_VOICE_IDENTITY_REMOTE_APPLY_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLY_ONCE" as const;
export const PHASE_11C_VOICE_IDENTITY_REMOTE_APPLY_VERDICT =
  "VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLIED_EMPTY_RUNTIME_OFF" as const;
export const PHASE_11C_VOICE_IDENTITY_REMOTE_APPLY_NEXT_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT" as const;

export const PHASE_11C_APPLIED_MIGRATION_VERSION = "20260815195207" as const;
export const PHASE_11C_APPLIED_MIGRATION_NAME = "vhs_11c_voice_identity_catalog" as const;
export const PHASE_11C_POST_APPLY_MIGRATION_COUNT = 31 as const;

export const PHASE_11C_POST_APPLY_INVARIANT_COUNTS = {
  workspaces: 1,
  video_projects: 4,
  project_artifacts: 35,
  active_artifact_revisions: 17,
  assets: 9,
  human_review_decisions: 6,
  director_runs: 29,
  production_jobs: 4,
  generation_attempts: 2,
  cost_ledger: 69,
  budget_reservations: 26,
  workspace_budget_policies: 1,
} as const;

export const PHASE_11C_POST_APPLY_VOICE_ROW_COUNTS = {
  voice_identities: 0,
  voice_consent_attestations: 0,
  project_voice_bindings: 0,
} as const;

export const PHASE_11C_SERVICE_ROLE_DEFAULT_OVERLAY = [
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
] as const;

export function assertVoiceIdentityPostApplyAligned(input: {
  localFiles: string[];
  remoteVersions: string[];
}): void {
  const drift = compareVoiceIdentityMigrationDrift({
    localFiles: input.localFiles,
    remoteVersions: input.remoteVersions,
  });
  if (drift.remoteCount !== PHASE_11C_POST_APPLY_MIGRATION_COUNT) {
    throw new Error("Phase 11C apply: remote migration count is not 31.");
  }
  if (drift.localCount !== PHASE_11C_POST_APPLY_MIGRATION_COUNT) {
    throw new Error("Phase 11C apply: local migration count is not 31.");
  }
  if (drift.localUnapplied.length > 0 || drift.remoteUnknownLocally.length > 0) {
    throw new Error("Phase 11C apply: migration alignment is not 31/31.");
  }
  if (!input.remoteVersions.some((version) => version.includes(PHASE_11C_APPLIED_MIGRATION_VERSION))) {
    throw new Error("Phase 11C apply: applied version missing remotely.");
  }
  if (!input.localFiles.includes(PHASE_11C_VOICE_IDENTITY_MIGRATION)) {
    throw new Error("Phase 11C apply: local filename is not aligned to remote version.");
  }
}

export function assertVoiceTablesEmpty(counts: {
  voice_identities: number;
  voice_consent_attestations: number;
  project_voice_bindings: number;
}): void {
  if (
    counts.voice_identities !== 0
    || counts.voice_consent_attestations !== 0
    || counts.project_voice_bindings !== 0
  ) {
    throw new Error("Phase 11C apply: Voice tables must remain empty.");
  }
}

export function assertInvariantCountsUnchanged(counts: typeof PHASE_11C_POST_APPLY_INVARIANT_COUNTS): void {
  for (const [key, expected] of Object.entries(PHASE_11C_POST_APPLY_INVARIANT_COUNTS)) {
    if (counts[key as keyof typeof counts] !== expected) {
      throw new Error(`Phase 11C apply: invariant count changed for ${key}.`);
    }
  }
}

export function assertClientGrantsDenied(input: {
  anonSelect: boolean;
  authenticatedSelect: boolean;
}): void {
  if (input.anonSelect || input.authenticatedSelect) {
    throw new Error("Phase 11C apply: client grant detected.");
  }
}

export function assertNoSecondApply(alreadyApplied: boolean): void {
  if (alreadyApplied) return;
  throw new Error("Phase 11C apply: remote version missing; do not guess a second apply.");
}

export function voiceIdentityApplyChecksums(): {
  sha256: typeof PHASE_11C_VOICE_IDENTITY_MIGRATION_SHA256;
  gitBlob: typeof PHASE_11C_VOICE_IDENTITY_MIGRATION_GIT_BLOB;
  tables: typeof PHASE_11C_VOICE_TABLES;
  intendedGrants: typeof PHASE_11C_VOICE_GRANT_MATRIX;
} {
  assertPhase11CVoiceFlagsRemainOff({});
  return {
    sha256: PHASE_11C_VOICE_IDENTITY_MIGRATION_SHA256,
    gitBlob: PHASE_11C_VOICE_IDENTITY_MIGRATION_GIT_BLOB,
    tables: PHASE_11C_VOICE_TABLES,
    intendedGrants: PHASE_11C_VOICE_GRANT_MATRIX,
  };
}
