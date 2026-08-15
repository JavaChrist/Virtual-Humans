/**
 * Phase 11C — read-only grant hardening preflight for Voice catalog tables.
 * Prepares a local GRANT/REVOKE migration. No remote apply, no seed, no provider.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertPhase11CVoiceFlagsRemainOff } from "./phase-11c-voice-allowlist";
import { PHASE_11C_VOICE_IDENTITY_MIGRATION } from "./phase-11c-voice-identity-catalog";
import {
  PHASE_11C_VOICE_GRANT_MATRIX,
  PHASE_11C_VOICE_TABLES,
  migrationVersionKey,
} from "./phase-11c-voice-identity-remote-preflight";
import { redactVoiceSecret } from "./phase-11c-voice-secret-locator";

export const PHASE_11C_VOICE_GRANT_HARDENING_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_PREFLIGHT" as const;
export const PHASE_11C_VOICE_GRANT_HARDENING_VERDICT =
  "VOICE_IDENTITY_CATALOG_GRANTS_HARDENING_READY_FOR_REMOTE_APPLY_PREFLIGHT" as const;
export const PHASE_11C_VOICE_GRANT_HARDENING_NEXT_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_PREFLIGHT" as const;

export const PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION =
  "20260815215407_vhs_11c_voice_identity_catalog_grant_hardening.sql" as const;
export const PHASE_11C_VOICE_GRANT_HARDENING_SHA256 =
  "4db521b8165cf870b6d07dcf93f93783bc4fa26fb0beced2cfd2860011937b24" as const;
export const PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB =
  "b0eb2eb50ba726df520fa60bb9008e725130bca9" as const;

export const PHASE_11C_GRANT_HARDENING_REMOTE_MIGRATION_COUNT = 31 as const;
export const PHASE_11C_GRANT_HARDENING_LOCAL_MIGRATION_COUNT = 32 as const;
export const PHASE_11C_GRANT_HARDENING_REMOTE_LAST_MIGRATION =
  "20260815195207_vhs_11c_voice_identity_catalog" as const;

export const PHASE_11C_TABLE_PRIVILEGE_OPS = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
] as const;
export type TablePrivilegeOp = (typeof PHASE_11C_TABLE_PRIVILEGE_OPS)[number];
export type RolePrivilegeRow = Record<TablePrivilegeOp, boolean>;

export const NO_TABLE_PRIVILEGES: RolePrivilegeRow = {
  SELECT: false,
  INSERT: false,
  UPDATE: false,
  DELETE: false,
  TRUNCATE: false,
  REFERENCES: false,
  TRIGGER: false,
};

export const ALL_TABLE_PRIVILEGES: RolePrivilegeRow = {
  SELECT: true,
  INSERT: true,
  UPDATE: true,
  DELETE: true,
  TRUNCATE: true,
  REFERENCES: true,
  TRIGGER: true,
};

export const SERVICE_ROLE_IDENTITY_OR_BINDING_TARGET: RolePrivilegeRow = {
  SELECT: true,
  INSERT: true,
  UPDATE: true,
  DELETE: false,
  TRUNCATE: false,
  REFERENCES: false,
  TRIGGER: false,
};

export const SERVICE_ROLE_CONSENT_TARGET: RolePrivilegeRow = {
  SELECT: true,
  INSERT: true,
  UPDATE: false,
  DELETE: false,
  TRUNCATE: false,
  REFERENCES: false,
  TRIGGER: false,
};

export type VoiceTableGrantSnapshot = {
  table: (typeof PHASE_11C_VOICE_TABLES)[number];
  owner: "postgres";
  rls: true;
  forceRls: false;
  policies: 0;
  public: RolePrivilegeRow;
  anon: RolePrivilegeRow;
  authenticated: RolePrivilegeRow;
  service_role: RolePrivilegeRow;
};

function snapshot(table: VoiceTableGrantSnapshot["table"], serviceRole: RolePrivilegeRow): VoiceTableGrantSnapshot {
  return {
    table,
    owner: "postgres",
    rls: true,
    forceRls: false,
    policies: 0,
    public: { ...NO_TABLE_PRIVILEGES },
    anon: { ...NO_TABLE_PRIVILEGES },
    authenticated: { ...NO_TABLE_PRIVILEGES },
    service_role: { ...serviceRole },
  };
}

/** Live Production ACL snapshot (read-only audit, 2026-08-15). Overlay = DEFAULT PRIVILEGES. */
export const PHASE_11C_ACTUAL_VOICE_GRANTS: readonly VoiceTableGrantSnapshot[] = [
  snapshot("voice_identities", ALL_TABLE_PRIVILEGES),
  snapshot("voice_consent_attestations", ALL_TABLE_PRIVILEGES),
  snapshot("project_voice_bindings", ALL_TABLE_PRIVILEGES),
];

export const PHASE_11C_TARGET_VOICE_GRANTS: readonly VoiceTableGrantSnapshot[] = [
  snapshot("voice_identities", SERVICE_ROLE_IDENTITY_OR_BINDING_TARGET),
  snapshot("voice_consent_attestations", SERVICE_ROLE_CONSENT_TARGET),
  snapshot("project_voice_bindings", SERVICE_ROLE_IDENTITY_OR_BINDING_TARGET),
];

export type PrivilegeDiff = {
  table: VoiceTableGrantSnapshot["table"];
  role: "public" | "anon" | "authenticated" | "service_role";
  revoke: readonly TablePrivilegeOp[];
  grant: readonly TablePrivilegeOp[];
};

export function diffRolePrivileges(actual: RolePrivilegeRow, target: RolePrivilegeRow): {
  revoke: TablePrivilegeOp[];
  grant: TablePrivilegeOp[];
} {
  const revoke: TablePrivilegeOp[] = [];
  const grant: TablePrivilegeOp[] = [];
  for (const op of PHASE_11C_TABLE_PRIVILEGE_OPS) {
    if (actual[op] && !target[op]) revoke.push(op);
    if (!actual[op] && target[op]) grant.push(op);
  }
  return { revoke, grant };
}

export function diffVoiceGrantMatrices(
  actual: readonly VoiceTableGrantSnapshot[] = PHASE_11C_ACTUAL_VOICE_GRANTS,
  target: readonly VoiceTableGrantSnapshot[] = PHASE_11C_TARGET_VOICE_GRANTS,
): PrivilegeDiff[] {
  const diffs: PrivilegeDiff[] = [];
  for (const row of target) {
    const live = actual.find((item) => item.table === row.table);
    if (!live) {
      throw new Error("Phase 11C grant hardening: Voice table missing.");
    }
    for (const role of ["public", "anon", "authenticated", "service_role"] as const) {
      const { revoke, grant } = diffRolePrivileges(live[role], row[role]);
      if (revoke.length > 0 || grant.length > 0) {
        diffs.push({ table: row.table, role, revoke, grant });
      }
    }
  }
  return diffs;
}

export const PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES = {
  voice_identities: ["DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"],
  voice_consent_attestations: ["UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"],
  project_voice_bindings: ["DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"],
} as const;

export type VoiceGrantHardeningRemoteFacts = {
  projectIdRedacted: "ejdb…nmvi";
  region: "eu-west-3";
  status: "ACTIVE_HEALTHY";
  remoteMigrationCount: number;
  remoteLastMigration: string;
  voiceTablesPresent: boolean;
  rowCounts: {
    voice_identities: number;
    voice_consent_attestations: number;
    project_voice_bindings: number;
  };
  rlsOn: boolean;
  policies: number;
  clientGrants: number;
  securityDefinerVoiceFunctions: number;
  destructiveTriggers: number;
  overlaySource: "default_privileges_public_relations";
  productionWrites: number;
};

export const PHASE_11C_GRANT_HARDENING_REMOTE_FACTS: VoiceGrantHardeningRemoteFacts = {
  projectIdRedacted: "ejdb…nmvi",
  region: "eu-west-3",
  status: "ACTIVE_HEALTHY",
  remoteMigrationCount: 31,
  remoteLastMigration: PHASE_11C_GRANT_HARDENING_REMOTE_LAST_MIGRATION,
  voiceTablesPresent: true,
  rowCounts: {
    voice_identities: 0,
    voice_consent_attestations: 0,
    project_voice_bindings: 0,
  },
  rlsOn: true,
  policies: 0,
  clientGrants: 0,
  securityDefinerVoiceFunctions: 0,
  destructiveTriggers: 0,
  overlaySource: "default_privileges_public_relations",
  productionWrites: 0,
};

export type VoiceGrantHardeningSqlInspection = {
  revokesAllOnIdentities: boolean;
  revokesAllOnConsent: boolean;
  revokesAllOnBindings: boolean;
  grantsIdentities: boolean;
  grantsConsent: boolean;
  grantsBindings: boolean;
  explicitRevokeIdentities: boolean;
  explicitRevokeConsent: boolean;
  explicitRevokeBindings: boolean;
  altersDefaultPrivileges: boolean;
  hasDataDml: boolean;
  hasDropOrTruncateStatement: boolean;
  altersTable: boolean;
  touchesRls: boolean;
  createsPolicy: boolean;
  createsRole: boolean;
  securityDefiner: boolean;
  containsVoiceId: boolean;
};

export function inspectVoiceGrantHardeningSql(sql: string): VoiceGrantHardeningSqlInspection {
  return {
    revokesAllOnIdentities: /REVOKE ALL ON TABLE public\.voice_identities FROM PUBLIC, anon, authenticated, service_role/i.test(sql),
    revokesAllOnConsent: /REVOKE ALL ON TABLE public\.voice_consent_attestations FROM PUBLIC, anon, authenticated, service_role/i.test(sql),
    revokesAllOnBindings: /REVOKE ALL ON TABLE public\.project_voice_bindings FROM PUBLIC, anon, authenticated, service_role/i.test(sql),
    grantsIdentities: /GRANT SELECT, INSERT, UPDATE ON TABLE public\.voice_identities TO service_role/i.test(sql),
    grantsConsent: /GRANT SELECT, INSERT ON TABLE public\.voice_consent_attestations TO service_role/i.test(sql),
    grantsBindings: /GRANT SELECT, INSERT, UPDATE ON TABLE public\.project_voice_bindings TO service_role/i.test(sql),
    explicitRevokeIdentities: /REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public\.voice_identities FROM PUBLIC, anon, authenticated, service_role/i.test(sql),
    explicitRevokeConsent: /REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public\.voice_consent_attestations FROM PUBLIC, anon, authenticated, service_role/i.test(sql),
    explicitRevokeBindings: /REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public\.project_voice_bindings FROM PUBLIC, anon, authenticated, service_role/i.test(sql),
    altersDefaultPrivileges: /ALTER\s+DEFAULT\s+PRIVILEGES/i.test(sql),
    hasDataDml: /^\s*(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM)/im.test(sql),
    hasDropOrTruncateStatement: /^\s*(DROP|TRUNCATE)\b/im.test(sql),
    altersTable: /ALTER\s+TABLE/i.test(sql),
    touchesRls: /ROW\s+LEVEL\s+SECURITY/i.test(sql),
    createsPolicy: /CREATE\s+POLICY/i.test(sql),
    createsRole: /CREATE\s+ROLE/i.test(sql),
    securityDefiner: /SECURITY\s+DEFINER/i.test(sql),
    containsVoiceId: /voiceId/i.test(sql) || /ELEVENLABS_[A-Z_]*VOICE_ID\s*=/.test(sql),
  };
}

export function readVoiceGrantHardeningSql(repoRoot: string): string {
  return readFileSync(
    join(repoRoot, "studio", "supabase", "migrations", PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION),
    "utf8",
  );
}

export function hashVoiceGrantHardeningSql(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

export function assertVoiceGrantHardeningSqlAdmissible(sql: string): void {
  const inspected = inspectVoiceGrantHardeningSql(sql);
  if (
    !inspected.revokesAllOnIdentities
    || !inspected.revokesAllOnConsent
    || !inspected.revokesAllOnBindings
    || !inspected.grantsIdentities
    || !inspected.grantsConsent
    || !inspected.grantsBindings
    || !inspected.explicitRevokeIdentities
    || !inspected.explicitRevokeConsent
    || !inspected.explicitRevokeBindings
  ) {
    throw new Error("Phase 11C grant hardening: GRANT/REVOKE matrix incomplete.");
  }
  if (inspected.altersDefaultPrivileges) {
    throw new Error("Phase 11C grant hardening: global default privileges must not change.");
  }
  if (inspected.hasDataDml || inspected.hasDropOrTruncateStatement) {
    throw new Error("Phase 11C grant hardening: data DML, DROP, or TRUNCATE is forbidden.");
  }
  if (inspected.altersTable || inspected.touchesRls || inspected.createsPolicy || inspected.createsRole) {
    throw new Error("Phase 11C grant hardening: schema, RLS, policy, or role change is forbidden.");
  }
  if (inspected.securityDefiner || inspected.containsVoiceId) {
    throw new Error("Phase 11C grant hardening: SECURITY DEFINER or voiceId is forbidden.");
  }
  if (hashVoiceGrantHardeningSql(sql) !== PHASE_11C_VOICE_GRANT_HARDENING_SHA256) {
    throw new Error("Phase 11C grant hardening: migration checksum mismatch.");
  }
}

export type VoiceGrantHardeningDrift = {
  remoteCount: number;
  localCount: number;
  remoteUnknownLocally: string[];
  localUnapplied: string[];
};

export function compareVoiceGrantHardeningDrift(input: {
  localFiles: string[];
  remoteVersions: string[];
}): VoiceGrantHardeningDrift {
  const localVersions = input.localFiles
    .filter((file) => file.endsWith(".sql") || /^\d{14}/.test(file))
    .map(migrationVersionKey)
    .sort();
  const remote = input.remoteVersions.map(migrationVersionKey).sort();
  return {
    remoteCount: remote.length,
    localCount: localVersions.length,
    remoteUnknownLocally: remote.filter((version) => !localVersions.includes(version)),
    localUnapplied: localVersions.filter((version) => !remote.includes(version)),
  };
}

export function assertVoiceGrantHardeningDriftAdmissible(drift: VoiceGrantHardeningDrift): void {
  if (drift.remoteCount !== PHASE_11C_GRANT_HARDENING_REMOTE_MIGRATION_COUNT) {
    throw new Error("Phase 11C grant hardening: unexpected remote migration count.");
  }
  if (drift.localCount !== PHASE_11C_GRANT_HARDENING_LOCAL_MIGRATION_COUNT) {
    throw new Error("Phase 11C grant hardening: unexpected local migration count.");
  }
  if (drift.remoteUnknownLocally.length > 0) {
    throw new Error("Phase 11C grant hardening: remote migration unknown locally.");
  }
  if (drift.localUnapplied.length !== 1 || drift.localUnapplied[0] !== "20260815215407") {
    throw new Error("Phase 11C grant hardening: local-only migration drift.");
  }
}

export function assertVoiceGrantHardeningFactsSafe(facts: VoiceGrantHardeningRemoteFacts): void {
  if (!facts.voiceTablesPresent) {
    throw new Error("Phase 11C grant hardening: Voice table missing.");
  }
  if (
    facts.rowCounts.voice_identities !== 0
    || facts.rowCounts.voice_consent_attestations !== 0
    || facts.rowCounts.project_voice_bindings !== 0
  ) {
    throw new Error("Phase 11C grant hardening: Voice tables already seeded.");
  }
  if (!facts.rlsOn || facts.policies !== 0) {
    throw new Error("Phase 11C grant hardening: unexpected policy.");
  }
  if (facts.clientGrants !== 0) {
    throw new Error("Phase 11C grant hardening: client grant present.");
  }
  if (facts.securityDefinerVoiceFunctions !== 0 || facts.destructiveTriggers !== 0) {
    throw new Error("Phase 11C grant hardening: append-only bypass.");
  }
  if (facts.productionWrites !== 0) {
    throw new Error("Phase 11C grant hardening: production write is forbidden.");
  }
  if (facts.remoteMigrationCount !== PHASE_11C_GRANT_HARDENING_REMOTE_MIGRATION_COUNT) {
    throw new Error("Phase 11C grant hardening: unexpected remote migration count.");
  }
}

export const PHASE_11C_CONSENT_WRITE_INVENTORY = [
  { kind: "in_memory", name: "persistVoiceConsent", persistsToProduction: false },
  { kind: "in_memory", name: "persistVoiceIdentityConsent", persistsToProduction: false },
  { kind: "sql_function", name: "none", persistsToProduction: false },
  { kind: "rpc", name: "none", persistsToProduction: false },
  { kind: "edge_function", name: "none", persistsToProduction: false },
  { kind: "api_route", name: "none", persistsToProduction: false },
] as const;

export const PHASE_11C_APPEND_ONLY_ASSESSMENT = {
  noGrantUpdate: true,
  noGrantDelete: true,
  noGrantTruncate: true,
  noSecurityDefinerMutation: true,
  noDestructiveTrigger: true,
  noClientPolicy: true,
  uniqueIdempotencyKey: true,
  revokeByNewAttestation: true,
  ownerPostgresRetainsAdmin: true,
  runtimeServiceRoleNeedsHardening: true,
  sufficientAfterHardening: true,
  seedBlockedUntilHardeningApplied: true,
} as const;

export type VoiceGrantHardeningDryRun = {
  localMigration: typeof PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION;
  catalogMigration: typeof PHASE_11C_VOICE_IDENTITY_MIGRATION;
  migrationSha256: typeof PHASE_11C_VOICE_GRANT_HARDENING_SHA256;
  remote: VoiceGrantHardeningRemoteFacts;
  actualGrants: typeof PHASE_11C_ACTUAL_VOICE_GRANTS;
  targetGrants: typeof PHASE_11C_TARGET_VOICE_GRANTS;
  intendedGrants: typeof PHASE_11C_VOICE_GRANT_MATRIX;
  diffs: PrivilegeDiff[];
  requiredRevokes: typeof PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES;
  requiredGrants: [];
  tablesEmpty: true;
  noDataToMigrate: true;
  driftAdmissible: true;
  appendOnly: typeof PHASE_11C_APPEND_ONLY_ASSESSMENT;
  writeInventory: typeof PHASE_11C_CONSENT_WRITE_INVENTORY;
  migrationApplyAllowed: false;
  seedAllowed: false;
  productionWrites: 0;
  providerCalls: 0;
  fingerprint: string;
};

export function runVoiceGrantHardeningDryRun(input?: {
  env?: Record<string, string | undefined>;
  sql?: string;
  localFiles?: string[];
  remoteVersions?: string[];
  facts?: VoiceGrantHardeningRemoteFacts;
  actualGrants?: readonly VoiceTableGrantSnapshot[];
}): VoiceGrantHardeningDryRun {
  assertPhase11CVoiceFlagsRemainOff(input?.env ?? {});
  const sql = input?.sql;
  if (sql) {
    assertVoiceGrantHardeningSqlAdmissible(sql);
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
  if (diffs.some((diff) => diff.role !== "service_role" || diff.grant.length > 0)) {
    throw new Error("Phase 11C grant hardening: unexpected grant delta.");
  }
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        v: "voice-identity-grant-hardening-preflight-1.0.0",
        migration: PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
        sha256: PHASE_11C_VOICE_GRANT_HARDENING_SHA256,
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
    localMigration: PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
    catalogMigration: PHASE_11C_VOICE_IDENTITY_MIGRATION,
    migrationSha256: PHASE_11C_VOICE_GRANT_HARDENING_SHA256,
    remote: facts,
    actualGrants: PHASE_11C_ACTUAL_VOICE_GRANTS,
    targetGrants: PHASE_11C_TARGET_VOICE_GRANTS,
    intendedGrants: PHASE_11C_VOICE_GRANT_MATRIX,
    diffs,
    requiredRevokes: PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES,
    requiredGrants: [],
    tablesEmpty: true,
    noDataToMigrate: true,
    driftAdmissible: true,
    appendOnly: PHASE_11C_APPEND_ONLY_ASSESSMENT,
    writeInventory: PHASE_11C_CONSENT_WRITE_INVENTORY,
    migrationApplyAllowed: false,
    seedAllowed: false,
    productionWrites: 0,
    providerCalls: 0,
    fingerprint,
  };
}

export function redactVoiceGrantHardeningError(message: string): string {
  return redactVoiceSecret(message);
}
