/**
 * Phase 11C — read-only remote preflight for the Voice identity catalog migration.
 * No apply, no seed, no provider, no Production write.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PHASE_11C_VOICE_IDENTITY_MIGRATION } from "./phase-11c-voice-identity-catalog";
import { redactVoiceSecret } from "./phase-11c-voice-secret-locator";
import { assertPhase11CVoiceFlagsRemainOff } from "./phase-11c-voice-allowlist";

export const PHASE_11C_VOICE_IDENTITY_REMOTE_PREFLIGHT_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT" as const;
export const PHASE_11C_VOICE_IDENTITY_REMOTE_PREFLIGHT_VERDICT =
  "VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT_READY_FOR_APPLY_AUTH" as const;
export const PHASE_11C_VOICE_IDENTITY_REMOTE_PREFLIGHT_NEXT_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLY_ONCE" as const;

export const PHASE_11C_VOICE_IDENTITY_MIGRATION_SHA256 =
  "58069e22849afd82546200be0b6afb4d61c57d962d767830faced2910b77f8ce" as const;
export const PHASE_11C_VOICE_IDENTITY_MIGRATION_GIT_BLOB =
  "103d5b93adafa3e97b264ffe6370e18244965174" as const;

export const PHASE_11C_REMOTE_MIGRATION_COUNT = 30 as const;
export const PHASE_11C_LOCAL_MIGRATION_COUNT = 31 as const;
export const PHASE_11C_REMOTE_LAST_MIGRATION =
  "20260811211757_vhs_mt005_human_review_decision_extend" as const;

export const PHASE_11C_VOICE_TABLES = [
  "voice_identities",
  "voice_consent_attestations",
  "project_voice_bindings",
] as const;

export type VoiceIdentityRemoteFacts = {
  projectIdRedacted: "ejdb…nmvi";
  region: "eu-west-3";
  status: "ACTIVE_HEALTHY";
  remoteMigrationCount: number;
  remoteLastMigration: string;
  voiceTablesPresent: boolean;
  voiceConstraintCollisions: number;
  voiceIndexCollisions: number;
  voiceFunctionCollisions: number;
  voiceTriggerCollisions: number;
  voiceTypeCollisions: number;
  voiceViewsPresent: number;
  v2RlsEnabled: boolean;
  v2PoliciesOnComparedTables: number;
  fkTargetsUuid: boolean;
  productionWrites: number;
};

export const PHASE_11C_VOICE_IDENTITY_REMOTE_FACTS: VoiceIdentityRemoteFacts = {
  projectIdRedacted: "ejdb…nmvi",
  region: "eu-west-3",
  status: "ACTIVE_HEALTHY",
  remoteMigrationCount: 30,
  remoteLastMigration: PHASE_11C_REMOTE_LAST_MIGRATION,
  voiceTablesPresent: false,
  voiceConstraintCollisions: 0,
  voiceIndexCollisions: 0,
  voiceFunctionCollisions: 0,
  voiceTriggerCollisions: 0,
  voiceTypeCollisions: 0,
  voiceViewsPresent: 0,
  v2RlsEnabled: true,
  v2PoliciesOnComparedTables: 0,
  fkTargetsUuid: true,
  productionWrites: 0,
};

export const PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES = {
  narrator_female: "99db51be34bc",
  narrator_male: "84af11a65704",
  character_mei: "1a398f86b113",
  character_tom: "456769a82a84",
} as const;

export type VoiceIdentityGrantMatrix = {
  table: (typeof PHASE_11C_VOICE_TABLES)[number];
  rls: true;
  policies: 0;
  public: "REVOKE ALL";
  anon: "REVOKE ALL";
  authenticated: "REVOKE ALL";
  serviceRole: readonly string[];
};

export const PHASE_11C_VOICE_GRANT_MATRIX: readonly VoiceIdentityGrantMatrix[] = [
  {
    table: "voice_identities",
    rls: true,
    policies: 0,
    public: "REVOKE ALL",
    anon: "REVOKE ALL",
    authenticated: "REVOKE ALL",
    serviceRole: ["SELECT", "INSERT", "UPDATE"],
  },
  {
    table: "voice_consent_attestations",
    rls: true,
    policies: 0,
    public: "REVOKE ALL",
    anon: "REVOKE ALL",
    authenticated: "REVOKE ALL",
    serviceRole: ["SELECT", "INSERT"],
  },
  {
    table: "project_voice_bindings",
    rls: true,
    policies: 0,
    public: "REVOKE ALL",
    anon: "REVOKE ALL",
    authenticated: "REVOKE ALL",
    serviceRole: ["SELECT", "INSERT", "UPDATE"],
  },
];

export type VoiceIdentityMigrationDrift = {
  remoteCount: number;
  localCount: number;
  remoteUnknownLocally: string[];
  localUnapplied: string[];
  holes: string[];
  extraLocalOnly: string[];
  expectedLocalOnly: typeof PHASE_11C_VOICE_IDENTITY_MIGRATION;
};

export function inspectVoiceIdentityMigrationSql(sql: string): {
  createsVoiceIdentities: boolean;
  createsConsent: boolean;
  createsBindings: boolean;
  enablesRls: boolean;
  createsPolicy: boolean;
  grantsAnonOrAuthenticated: boolean;
  seedsRows: boolean;
  containsVoiceIdAssignment: boolean;
  containsSecurityDefiner: boolean;
  executionForcedOff: boolean;
  oneActiveNarratorIndex: boolean;
} {
  return {
    createsVoiceIdentities: /CREATE TABLE public\.voice_identities/i.test(sql),
    createsConsent: /CREATE TABLE public\.voice_consent_attestations/i.test(sql),
    createsBindings: /CREATE TABLE public\.project_voice_bindings/i.test(sql),
    enablesRls: /ENABLE ROW LEVEL SECURITY/i.test(sql),
    createsPolicy: /CREATE POLICY/i.test(sql),
    grantsAnonOrAuthenticated: /GRANT[\s\S]*TO (anon|authenticated)/i.test(sql),
    seedsRows: /^\s*INSERT\s+INTO/im.test(sql),
    containsVoiceIdAssignment: /ELEVENLABS_[A-Z_]*VOICE_ID\s*=/.test(sql),
    containsSecurityDefiner: /SECURITY DEFINER/i.test(sql),
    executionForcedOff: /active_for_provider_execution boolean NOT NULL DEFAULT false/i.test(sql)
      && /voice_identities_execution_off_default CHECK \(active_for_provider_execution = false\)/i.test(sql),
    oneActiveNarratorIndex: /project_voice_bindings_one_active_narrator_idx/i.test(sql),
  };
}

export function readVoiceIdentityMigrationSql(repoRoot: string): string {
  return readFileSync(
    join(repoRoot, "studio", "supabase", "migrations", PHASE_11C_VOICE_IDENTITY_MIGRATION),
    "utf8",
  );
}

export function hashVoiceIdentityMigrationSql(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

export function migrationVersionKey(name: string): string {
  const match = name.replace(/\.sql$/, "").match(/^(\d{14})/);
  return match?.[1] ?? name.replace(/\.sql$/, "");
}

export function compareVoiceIdentityMigrationDrift(input: {
  localFiles: string[];
  remoteVersions: string[];
}): VoiceIdentityMigrationDrift {
  const localVersions = input.localFiles
    .filter((file) => file.endsWith(".sql") || /^\d{14}/.test(file))
    .map(migrationVersionKey)
    .sort();
  const remote = input.remoteVersions.map(migrationVersionKey).sort();
  const remoteUnknownLocally = remote.filter((version) => !localVersions.includes(version));
  const localUnapplied = localVersions.filter((version) => !remote.includes(version));
  return {
    remoteCount: remote.length,
    localCount: localVersions.length,
    remoteUnknownLocally,
    localUnapplied,
    holes: [],
    extraLocalOnly: localUnapplied.filter((version) => version !== "20260815182203"),
    expectedLocalOnly: PHASE_11C_VOICE_IDENTITY_MIGRATION,
  };
}

export function assertVoiceIdentityMigrationDriftAdmissible(drift: VoiceIdentityMigrationDrift): void {
  if (drift.remoteCount !== PHASE_11C_REMOTE_MIGRATION_COUNT) {
    throw new Error("Phase 11C remote preflight: unexpected remote migration count.");
  }
  if (drift.localCount !== PHASE_11C_LOCAL_MIGRATION_COUNT) {
    throw new Error("Phase 11C remote preflight: unexpected local migration count.");
  }
  if (drift.remoteUnknownLocally.length > 0) {
    throw new Error("Phase 11C remote preflight: remote migration unknown locally.");
  }
  if (drift.localUnapplied.length !== 1 || drift.localUnapplied[0] !== "20260815182203") {
    throw new Error("Phase 11C remote preflight: local-only migration drift.");
  }
  if (drift.extraLocalOnly.length > 0) {
    throw new Error("Phase 11C remote preflight: more than one local-only migration.");
  }
}

export function assertVoiceIdentityRemoteFactsSafe(facts: VoiceIdentityRemoteFacts): void {
  if (facts.voiceTablesPresent) {
    throw new Error("Phase 11C remote preflight: Voice tables already exist.");
  }
  if (
    facts.voiceConstraintCollisions
    || facts.voiceIndexCollisions
    || facts.voiceFunctionCollisions
    || facts.voiceTriggerCollisions
    || facts.voiceTypeCollisions
    || facts.voiceViewsPresent
  ) {
    throw new Error("Phase 11C remote preflight: name collision.");
  }
  if (!facts.v2RlsEnabled || facts.v2PoliciesOnComparedTables !== 0) {
    throw new Error("Phase 11C remote preflight: unexpected V2 RLS/policy baseline.");
  }
  if (!facts.fkTargetsUuid) {
    throw new Error("Phase 11C remote preflight: FK target type mismatch.");
  }
  if (facts.productionWrites !== 0) {
    throw new Error("Phase 11C remote preflight: production write is forbidden.");
  }
}

export const PHASE_11C_APPLICATION_ONLY_GUARDS = [
  "mei_cannot_be_narrator",
  "tom_cannot_be_narrator",
  "no_historical_global_fallback",
  "no_auto_generate_on_selection",
  "call_time_fingerprint_match",
  "script_artifact_belongs_to_project",
  "consent_role_matches_identity",
] as const;

export type VoiceIdentityApplyPlan = {
  steps: readonly string[];
  seedInSameOperation: false;
  migrationApplyAllowed: false;
};

export function buildVoiceIdentityApplyPlan(): VoiceIdentityApplyPlan {
  return {
    steps: [
      "revalidate_git",
      "revalidate_drift",
      "backup_or_checkpoint",
      "apply_single_migration",
      "verify_remote_version",
      "verify_three_tables",
      "verify_rls",
      "verify_policies",
      "verify_grants",
      "verify_constraints_indexes",
      "verify_tables_empty",
      "verify_voice_runtime_off",
      "verify_budget_and_assets_unchanged",
      "update_docs",
    ],
    seedInSameOperation: false,
    migrationApplyAllowed: false,
  };
}

export type VoiceIdentityRollbackPlan = {
  automatic: false;
  requiresEmptyTables: true;
  dropOrder: readonly typeof PHASE_11C_VOICE_TABLES[number][];
  restorePreferredIfDataExists: true;
  executed: false;
};

export function buildVoiceIdentityRollbackPlan(): VoiceIdentityRollbackPlan {
  return {
    automatic: false,
    requiresEmptyTables: true,
    dropOrder: ["project_voice_bindings", "voice_consent_attestations", "voice_identities"],
    restorePreferredIfDataExists: true,
    executed: false,
  };
}

export type VoiceIdentitySeedPlan = {
  identities: 4;
  consents: 4;
  projectBindings: 0;
  narratorSelectedForCurrentProject: false;
  activeForProviderExecution: false;
  persistVoiceId: false;
  executed: false;
};

export function buildVoiceIdentitySeedPlan(): VoiceIdentitySeedPlan {
  return {
    identities: 4,
    consents: 4,
    projectBindings: 0,
    narratorSelectedForCurrentProject: false,
    activeForProviderExecution: false,
    persistVoiceId: false,
    executed: false,
  };
}

export type VoiceIdentityRemotePreflightDryRun = {
  localMigration: typeof PHASE_11C_VOICE_IDENTITY_MIGRATION;
  migrationSha256: typeof PHASE_11C_VOICE_IDENTITY_MIGRATION_SHA256;
  remote: VoiceIdentityRemoteFacts;
  driftAdmissible: true;
  grantMatrix: typeof PHASE_11C_VOICE_GRANT_MATRIX;
  localFingerprintPrefixes: typeof PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES;
  applyPlan: VoiceIdentityApplyPlan;
  rollbackPlan: VoiceIdentityRollbackPlan;
  seedPlan: VoiceIdentitySeedPlan;
  migrationApplyAllowed: false;
  productionWrites: 0;
  providerCalls: 0;
  fingerprint: string;
};

export function runVoiceIdentityRemotePreflightDryRun(input?: {
  env?: Record<string, string | undefined>;
  sql?: string;
  localFiles?: string[];
  remoteVersions?: string[];
  facts?: VoiceIdentityRemoteFacts;
}): VoiceIdentityRemotePreflightDryRun {
  assertPhase11CVoiceFlagsRemainOff(input?.env ?? {});
  const sql = input?.sql;
  if (sql) {
    const inspected = inspectVoiceIdentityMigrationSql(sql);
    if (!inspected.createsVoiceIdentities || !inspected.createsConsent || !inspected.createsBindings) {
      throw new Error("Phase 11C remote preflight: migration missing required tables.");
    }
    if (!inspected.enablesRls || inspected.createsPolicy || inspected.grantsAnonOrAuthenticated) {
      throw new Error("Phase 11C remote preflight: RLS/grants insufficient.");
    }
    if (inspected.seedsRows || inspected.containsVoiceIdAssignment || inspected.containsSecurityDefiner) {
      throw new Error("Phase 11C remote preflight: seed, secret, or SECURITY DEFINER forbidden.");
    }
    if (hashVoiceIdentityMigrationSql(sql) !== PHASE_11C_VOICE_IDENTITY_MIGRATION_SHA256) {
      throw new Error("Phase 11C remote preflight: migration checksum mismatch.");
    }
  }
  const facts = input?.facts ?? PHASE_11C_VOICE_IDENTITY_REMOTE_FACTS;
  assertVoiceIdentityRemoteFactsSafe(facts);
  if (input?.localFiles && input.remoteVersions) {
    assertVoiceIdentityMigrationDriftAdmissible(
      compareVoiceIdentityMigrationDrift({
        localFiles: input.localFiles,
        remoteVersions: input.remoteVersions,
      }),
    );
  }
  const applyPlan = buildVoiceIdentityApplyPlan();
  const rollbackPlan = buildVoiceIdentityRollbackPlan();
  const seedPlan = buildVoiceIdentitySeedPlan();
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        v: "voice-identity-remote-preflight-1.0.0",
        migration: PHASE_11C_VOICE_IDENTITY_MIGRATION,
        sha256: PHASE_11C_VOICE_IDENTITY_MIGRATION_SHA256,
        remoteCount: facts.remoteMigrationCount,
        last: facts.remoteLastMigration,
        collisions: 0,
        applyAllowed: false,
      }),
    )
    .digest("hex");
  return {
    localMigration: PHASE_11C_VOICE_IDENTITY_MIGRATION,
    migrationSha256: PHASE_11C_VOICE_IDENTITY_MIGRATION_SHA256,
    remote: facts,
    driftAdmissible: true,
    grantMatrix: PHASE_11C_VOICE_GRANT_MATRIX,
    localFingerprintPrefixes: PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES,
    applyPlan,
    rollbackPlan,
    seedPlan,
    migrationApplyAllowed: false,
    productionWrites: 0,
    providerCalls: 0,
    fingerprint,
  };
}

export function redactVoiceIdentityPreflightError(message: string): string {
  return redactVoiceSecret(message);
}
