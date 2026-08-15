/**
 * Phase 11C — post-apply facts for Voice catalog grant hardening.
 * No seed, no provider, no second apply.
 */
import {
  PHASE_11C_ACTUAL_VOICE_GRANTS,
  PHASE_11C_APPEND_ONLY_ASSESSMENT,
  PHASE_11C_TARGET_VOICE_GRANTS,
  PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB,
  PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
  PHASE_11C_VOICE_GRANT_HARDENING_SHA256,
  compareVoiceGrantHardeningDrift,
  diffVoiceGrantMatrices,
  type RolePrivilegeRow,
  type VoiceTableGrantSnapshot,
} from "./phase-11c-voice-identity-grant-hardening-preflight";
import { assertPhase11CVoiceFlagsRemainOff } from "./phase-11c-voice-allowlist";

export const PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_APPLY_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_ONCE" as const;
export const PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_APPLY_VERDICT =
  "VOICE_IDENTITY_CATALOG_GRANTS_HARDENED_REMOTE_TABLES_EMPTY_RUNTIME_OFF" as const;
export const PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_APPLY_NEXT_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT" as const;

export const PHASE_11C_GRANT_HARDENING_APPLIED_VERSION = "20260815215407" as const;
export const PHASE_11C_GRANT_HARDENING_APPLIED_NAME =
  "vhs_11c_voice_identity_catalog_grant_hardening" as const;
export const PHASE_11C_GRANT_HARDENING_POST_APPLY_MIGRATION_COUNT = 32 as const;
export const PHASE_11C_GRANT_HARDENING_APPLY_INVOCATIONS = 1 as const;

export const PHASE_11C_GRANT_HARDENING_POST_APPLY_INVARIANT_COUNTS = {
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

export const PHASE_11C_GRANT_HARDENING_POST_APPLY_VOICE_ROWS = {
  voice_identities: 0,
  voice_consent_attestations: 0,
  project_voice_bindings: 0,
} as const;

export function assertVoiceGrantHardeningPostApplyAligned(input: {
  localFiles: string[];
  remoteVersions: string[];
}): void {
  const drift = compareVoiceGrantHardeningDrift({
    localFiles: input.localFiles,
    remoteVersions: input.remoteVersions,
  });
  if (
    drift.remoteCount !== PHASE_11C_GRANT_HARDENING_POST_APPLY_MIGRATION_COUNT
    || drift.localCount !== PHASE_11C_GRANT_HARDENING_POST_APPLY_MIGRATION_COUNT
  ) {
    throw new Error("Phase 11C grant apply: migration count is not 32/32.");
  }
  if (drift.localUnapplied.length > 0 || drift.remoteUnknownLocally.length > 0) {
    throw new Error("Phase 11C grant apply: migration alignment is not 32/32.");
  }
  if (!input.remoteVersions.some((version) => version.includes(PHASE_11C_GRANT_HARDENING_APPLIED_VERSION))) {
    throw new Error("Phase 11C grant apply: applied version missing remotely.");
  }
  if (!input.localFiles.includes(PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION)) {
    throw new Error("Phase 11C grant apply: local filename is not aligned to remote version.");
  }
}

export function assertVoiceGrantHardeningTargetAcl(actual: readonly VoiceTableGrantSnapshot[]): void {
  const diffs = diffVoiceGrantMatrices(actual, PHASE_11C_TARGET_VOICE_GRANTS);
  if (diffs.length > 0) {
    throw new Error("Phase 11C grant apply: ACL target mismatch.");
  }
}

export function assertVoiceGrantHardeningNoSecondApply(alreadyApplied: boolean): void {
  if (alreadyApplied) return;
  throw new Error("Phase 11C grant apply: remote version missing; do not guess a second apply.");
}

export function assertVoiceGrantHardeningReplay(input: {
  migrationNeeded: boolean;
  secondApply: boolean;
}): void {
  if (input.migrationNeeded || input.secondApply) {
    throw new Error("Phase 11C grant apply: replay is forbidden.");
  }
}

export function assertVoiceGrantHardeningInvariantsUnchanged(
  counts: typeof PHASE_11C_GRANT_HARDENING_POST_APPLY_INVARIANT_COUNTS,
): void {
  for (const [key, expected] of Object.entries(PHASE_11C_GRANT_HARDENING_POST_APPLY_INVARIANT_COUNTS)) {
    if (counts[key as keyof typeof counts] !== expected) {
      throw new Error(`Phase 11C grant apply: invariant count changed for ${key}.`);
    }
  }
}

export function voiceGrantHardeningApplyChecksums(): {
  sha256: typeof PHASE_11C_VOICE_GRANT_HARDENING_SHA256;
  gitBlob: typeof PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB;
  migration: typeof PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION;
  sourceOverlay: typeof PHASE_11C_ACTUAL_VOICE_GRANTS;
  target: typeof PHASE_11C_TARGET_VOICE_GRANTS;
  appendOnly: typeof PHASE_11C_APPEND_ONLY_ASSESSMENT;
} {
  assertPhase11CVoiceFlagsRemainOff({});
  return {
    sha256: PHASE_11C_VOICE_GRANT_HARDENING_SHA256,
    gitBlob: PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB,
    migration: PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
    sourceOverlay: PHASE_11C_ACTUAL_VOICE_GRANTS,
    target: PHASE_11C_TARGET_VOICE_GRANTS,
    appendOnly: PHASE_11C_APPEND_ONLY_ASSESSMENT,
  };
}

export function serviceRoleRow(snapshot: VoiceTableGrantSnapshot): RolePrivilegeRow {
  return snapshot.service_role;
}
