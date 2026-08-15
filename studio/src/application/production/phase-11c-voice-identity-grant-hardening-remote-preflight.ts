/**
 * Phase 11C — read-only remote apply preflight for Voice grant hardening.
 * Confirms the local GRANT/REVOKE migration can be applied alone. No apply, no seed.
 */
import { createHash } from "node:crypto";
import {
  PHASE_11C_ACTUAL_VOICE_GRANTS,
  PHASE_11C_APPEND_ONLY_ASSESSMENT,
  PHASE_11C_GRANT_HARDENING_LOCAL_MIGRATION_COUNT,
  PHASE_11C_GRANT_HARDENING_REMOTE_FACTS,
  PHASE_11C_GRANT_HARDENING_REMOTE_LAST_MIGRATION,
  PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES,
  PHASE_11C_TARGET_VOICE_GRANTS,
  PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB,
  PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
  PHASE_11C_VOICE_GRANT_HARDENING_SHA256,
  assertVoiceGrantHardeningDriftAdmissible,
  assertVoiceGrantHardeningFactsSafe,
  assertVoiceGrantHardeningSqlAdmissible,
  compareVoiceGrantHardeningDrift,
  diffVoiceGrantMatrices,
  hashVoiceGrantHardeningSql,
  inspectVoiceGrantHardeningSql,
  type PrivilegeDiff,
  type VoiceGrantHardeningRemoteFacts,
  type VoiceTableGrantSnapshot,
} from "./phase-11c-voice-identity-grant-hardening-preflight";
import { assertPhase11CVoiceFlagsRemainOff } from "./phase-11c-voice-allowlist";
import { redactVoiceSecret } from "./phase-11c-voice-secret-locator";

export const PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_PREFLIGHT" as const;
export const PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_VERDICT =
  "VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_PREFLIGHT_READY_FOR_APPLY_AUTH" as const;
export const PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_NEXT_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_ONCE" as const;

export function inspectVoiceGrantHardeningApplySql(sql: string): {
  beginCommit: boolean;
  createsOrDrops: boolean;
  scopedToVoiceTables: boolean;
} {
  const inspected = inspectVoiceGrantHardeningSql(sql);
  const mentionsOtherPublicTable = /ON TABLE public\.(?!voice_identities\b|voice_consent_attestations\b|project_voice_bindings\b)\w+/i.test(sql);
  return {
    beginCommit: /^\s*BEGIN\s*;/m.test(sql) && /^\s*COMMIT\s*;/m.test(sql),
    createsOrDrops: /^\s*(CREATE|DROP)\b/im.test(sql),
    scopedToVoiceTables:
      inspected.revokesAllOnIdentities
      && inspected.revokesAllOnConsent
      && inspected.revokesAllOnBindings
      && !mentionsOtherPublicTable,
  };
}

export function assertVoiceGrantHardeningApplySqlAdmissible(sql: string): void {
  assertVoiceGrantHardeningSqlAdmissible(sql);
  const extra = inspectVoiceGrantHardeningApplySql(sql);
  if (!extra.beginCommit || extra.createsOrDrops || !extra.scopedToVoiceTables) {
    throw new Error("Phase 11C grant hardening remote preflight: SQL out of scope.");
  }
}

export function assertVoiceGrantHardeningDeltaMatches145(diffs: PrivilegeDiff[]): void {
  const expected = [
    ["voice_identities", [...PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES.voice_identities]],
    ["voice_consent_attestations", [...PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES.voice_consent_attestations]],
    ["project_voice_bindings", [...PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES.project_voice_bindings]],
  ] as const;
  if (diffs.length !== 3 || diffs.some((diff) => diff.role !== "service_role" || diff.grant.length > 0)) {
    throw new Error("Phase 11C grant hardening remote preflight: ACL delta mismatch.");
  }
  for (const [table, revoke] of expected) {
    const row = diffs.find((diff) => diff.table === table);
    if (!row || row.revoke.join(",") !== revoke.join(",")) {
      throw new Error("Phase 11C grant hardening remote preflight: ACL delta mismatch.");
    }
  }
}

export type VoiceGrantHardeningApplyPlan = {
  steps: readonly string[];
  singleMigration: typeof PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION;
  secondInvocationForbidden: true;
  seedInSameOperation: false;
  migrationApplyAllowed: false;
  executed: false;
};

export function buildVoiceGrantHardeningApplyPlan(): VoiceGrantHardeningApplyPlan {
  return {
    steps: [
      "revalidate_git_checksum_blob",
      "revalidate_remote_31_local_32",
      "verify_tables_empty",
      "verify_source_acl",
      "apply_single_grant_hardening_migration",
      "forbid_second_invocation",
      "verify_remote_32_local_32",
      "verify_target_acl",
      "verify_rls_and_policies",
      "verify_tables_still_empty",
      "verify_voice_runtime_off",
      "verify_budget_and_assets_unchanged",
      "update_docs",
    ],
    singleMigration: PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
    secondInvocationForbidden: true,
    seedInSameOperation: false,
    migrationApplyAllowed: false,
    executed: false,
  };
}

export type VoiceGrantHardeningUncertaintyPlan = {
  replayForbidden: true;
  rereadRemoteHistory: true;
  rereadAcl: true;
  automaticRepairForbidden: true;
  inscribedAndTargetAclMeansSuccess: true;
  absentWithPartialAclMeansHumanDecision: true;
  executed: false;
};

export function buildVoiceGrantHardeningUncertaintyPlan(): VoiceGrantHardeningUncertaintyPlan {
  return {
    replayForbidden: true,
    rereadRemoteHistory: true,
    rereadAcl: true,
    automaticRepairForbidden: true,
    inscribedAndTargetAclMeansSuccess: true,
    absentWithPartialAclMeansHumanDecision: true,
    executed: false,
  };
}

export type VoiceGrantHardeningRollbackPlan = {
  automatic: false;
  restoreExcessPrivilegesForbidden: true;
  grantAllForbidden: true;
  prefer: readonly ["diagnose", "prove_required_privilege", "minimal_followup_migration", "distinct_human_auth"];
  executed: false;
};

export function buildVoiceGrantHardeningRollbackPlan(): VoiceGrantHardeningRollbackPlan {
  return {
    automatic: false,
    restoreExcessPrivilegesForbidden: true,
    grantAllForbidden: true,
    prefer: ["diagnose", "prove_required_privilege", "minimal_followup_migration", "distinct_human_auth"],
    executed: false,
  };
}

export type VoiceGrantHardeningRemoteApplyPreflightDryRun = {
  auth: typeof PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_AUTH;
  verdict: typeof PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_VERDICT;
  nextAuth: typeof PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_NEXT_AUTH;
  localMigration: typeof PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION;
  migrationSha256: typeof PHASE_11C_VOICE_GRANT_HARDENING_SHA256;
  gitBlob: typeof PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB;
  remoteLast: typeof PHASE_11C_GRANT_HARDENING_REMOTE_LAST_MIGRATION;
  remote: VoiceGrantHardeningRemoteFacts;
  actualGrants: typeof PHASE_11C_ACTUAL_VOICE_GRANTS;
  targetGrants: typeof PHASE_11C_TARGET_VOICE_GRANTS;
  diffs: PrivilegeDiff[];
  requiredRevokes: typeof PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES;
  requiredGrants: [];
  applyPlan: VoiceGrantHardeningApplyPlan;
  uncertaintyPlan: VoiceGrantHardeningUncertaintyPlan;
  rollbackPlan: VoiceGrantHardeningRollbackPlan;
  appendOnly: typeof PHASE_11C_APPEND_ONLY_ASSESSMENT;
  tablesEmpty: true;
  driftAdmissible: true;
  migrationApplyAllowed: false;
  seedAllowed: false;
  productionWrites: 0;
  providerCalls: 0;
  fingerprint: string;
};

export function runVoiceGrantHardeningRemoteApplyPreflightDryRun(input?: {
  env?: Record<string, string | undefined>;
  sql?: string;
  localFiles?: string[];
  remoteVersions?: string[];
  facts?: VoiceGrantHardeningRemoteFacts;
  actualGrants?: readonly VoiceTableGrantSnapshot[];
}): VoiceGrantHardeningRemoteApplyPreflightDryRun {
  assertPhase11CVoiceFlagsRemainOff(input?.env ?? {});
  if (input?.sql) {
    assertVoiceGrantHardeningApplySqlAdmissible(input.sql);
  }
  const facts = input?.facts ?? PHASE_11C_GRANT_HARDENING_REMOTE_FACTS;
  assertVoiceGrantHardeningFactsSafe(facts);
  if (input?.localFiles && input.remoteVersions) {
    assertVoiceGrantHardeningDriftAdmissible(
      compareVoiceGrantHardeningDrift({
        localFiles: input.localFiles,
        remoteVersions: input.remoteVersions,
      }),
    );
  }
  const diffs = diffVoiceGrantMatrices(input?.actualGrants ?? PHASE_11C_ACTUAL_VOICE_GRANTS);
  assertVoiceGrantHardeningDeltaMatches145(diffs);
  const applyPlan = buildVoiceGrantHardeningApplyPlan();
  const uncertaintyPlan = buildVoiceGrantHardeningUncertaintyPlan();
  const rollbackPlan = buildVoiceGrantHardeningRollbackPlan();
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        v: "voice-identity-grant-hardening-remote-apply-preflight-1.0.0",
        migration: PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
        sha256: PHASE_11C_VOICE_GRANT_HARDENING_SHA256,
        blob: PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB,
        remoteCount: facts.remoteMigrationCount,
        localCount: PHASE_11C_GRANT_HARDENING_LOCAL_MIGRATION_COUNT,
        last: facts.remoteLastMigration,
        revokes: PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES,
        grants: [],
        applyAllowed: false,
        seedAllowed: false,
      }),
    )
    .digest("hex");
  return {
    auth: PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_AUTH,
    verdict: PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_VERDICT,
    nextAuth: PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_NEXT_AUTH,
    localMigration: PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
    migrationSha256: PHASE_11C_VOICE_GRANT_HARDENING_SHA256,
    gitBlob: PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB,
    remoteLast: PHASE_11C_GRANT_HARDENING_REMOTE_LAST_MIGRATION,
    remote: facts,
    actualGrants: PHASE_11C_ACTUAL_VOICE_GRANTS,
    targetGrants: PHASE_11C_TARGET_VOICE_GRANTS,
    diffs,
    requiredRevokes: PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES,
    requiredGrants: [],
    applyPlan,
    uncertaintyPlan,
    rollbackPlan,
    appendOnly: PHASE_11C_APPEND_ONLY_ASSESSMENT,
    tablesEmpty: true,
    driftAdmissible: true,
    migrationApplyAllowed: false,
    seedAllowed: false,
    productionWrites: 0,
    providerCalls: 0,
    fingerprint,
  };
}

export function redactVoiceGrantHardeningRemotePreflightError(message: string): string {
  return redactVoiceSecret(message);
}

export { hashVoiceGrantHardeningSql };
