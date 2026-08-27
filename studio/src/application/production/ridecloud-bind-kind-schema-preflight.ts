/**
 * RideCloud bind kind schema preflight — local migration only.
 * Prepares CHECK expansion. No remote apply, DML, RPC, media, or persist.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CURRENT_PROJECT_ARTIFACT_KINDS,
  RIDECLOUD_BIND_FUTURE_RPC_CALLS,
  RIDECLOUD_BIND_FUTURE_WRITES,
  RIDECLOUD_BIND_NEXT_AUTH,
  RIDECLOUD_BIND_PREFLIGHT_AUTH,
  RIDECLOUD_MEDIA_MANIFEST_KIND,
  RIDECLOUD_STORYBOARD_CONTRACT_KIND,
  assertRideCloudBindLocatorSafe,
  assertRideCloudBindPayloadIsTextual,
  assertRideCloudBindRejectsAutoSubstitution,
  buildRideCloudSeparateProjectBindPreflight,
  plannedRideCloudMediaManifest,
  plannedRideCloudStoryboardContract,
  resolveRideCloudBindIdentity,
} from "./ridecloud-separate-project-bind-preflight";
import { assertRideCloudNoSideEffects } from "./ridecloud-input-preflight";
import { redactRideCloudId } from "./ridecloud-separate-project-create-preflight";

export const RIDECLOUD_BIND_KIND_SCHEMA_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_NO_PROVIDER" as const;

export const RIDECLOUD_BIND_KIND_SCHEMA_VERDICT =
  "RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_READY" as const;

export const RIDECLOUD_BIND_KIND_SCHEMA_NEXT_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_NO_PROVIDER" as const;

export const RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION =
  "20260827133000_vhs_ridecloud_bind_artifact_kinds.sql" as const;

export const RIDECLOUD_BIND_KIND_SCHEMA_CONSTRAINT = "project_artifacts_type_check" as const;
export const RIDECLOUD_BIND_KIND_SCHEMA_TABLE = "project_artifacts" as const;
export const RIDECLOUD_BIND_KIND_ACTIVE_CONSTRAINT = "active_artifact_revisions_type_check" as const;

export const RIDECLOUD_HISTORICAL_ARTIFACT_KINDS = CURRENT_PROJECT_ARTIFACT_KINDS;

export const RIDECLOUD_EXTENDED_ARTIFACT_KINDS = [
  ...RIDECLOUD_HISTORICAL_ARTIFACT_KINDS,
  RIDECLOUD_STORYBOARD_CONTRACT_KIND,
  RIDECLOUD_MEDIA_MANIFEST_KIND,
] as const;

export const RIDECLOUD_REMOTE_MIGRATION_COUNT = 32 as const;
export const RIDECLOUD_LOCAL_MIGRATION_COUNT = 33 as const;
export const RIDECLOUD_REMOTE_LAST_MIGRATION = "20260815215407" as const;

export const RIDECLOUD_FUTURE_BIND_RPC_NAME = "create_ridecloud_bind_artifacts" as const;

const DML = /^\s*(INSERT|UPDATE|DELETE|TRUNCATE)\b/im;
const GRANT_POLICY = /CREATE\s+POLICY|GRANT\s+.+\s+TO\s+(anon|authenticated)|SECURITY\s+DEFINER/i;
const ACTIVE_EXPAND = /active_artifact_revisions[\s\S]{0,220}storyboard_contract|active_artifact_revisions[\s\S]{0,220}media_input_manifest/i;

export function rideCloudBindKindSchemaMigrationPath(fromFile = import.meta.url): string {
  const here = dirname(fileURLToPath(fromFile));
  return join(here, "..", "..", "..", "supabase", "migrations", RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION);
}

export function readRideCloudBindKindSchemaMigration(): string {
  return readFileSync(rideCloudBindKindSchemaMigrationPath(), "utf8");
}

export function rideCloudBindKindSchemaMigrationSha256(): string {
  return createHash("sha256").update(readRideCloudBindKindSchemaMigration()).digest("hex");
}

export function assertRideCloudBindKindSchemaAuthChain(): void {
  if (RIDECLOUD_BIND_NEXT_AUTH !== RIDECLOUD_BIND_KIND_SCHEMA_AUTH) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_AUTH_CHAIN");
  }
  if (RIDECLOUD_BIND_PREFLIGHT_AUTH !== "AUTH_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT_NO_PROVIDER") {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_PREFLIGHT_AUTH");
  }
}

export function assertRideCloudBindKindSchemaMigrationSafe(sql = readRideCloudBindKindSchemaMigration()): void {
  if (!sql.includes(RIDECLOUD_BIND_KIND_SCHEMA_CONSTRAINT)) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_CONSTRAINT");
  }
  if (!sql.includes(RIDECLOUD_BIND_KIND_SCHEMA_TABLE)) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_TABLE");
  }
  for (const kind of RIDECLOUD_HISTORICAL_ARTIFACT_KINDS) {
    if (!sql.includes(`'${kind}'`)) {
      throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_HISTORICAL_MISSING");
    }
  }
  if (!sql.includes(`'${RIDECLOUD_STORYBOARD_CONTRACT_KIND}'`)) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_CONTRACT_MISSING");
  }
  if (!sql.includes(`'${RIDECLOUD_MEDIA_MANIFEST_KIND}'`)) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_MANIFEST_MISSING");
  }
  if (!sql.includes("DROP CONSTRAINT project_artifacts_type_check")) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_DROP_MISSING");
  }
  if (!sql.includes("ADD CONSTRAINT project_artifacts_type_check")) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_ADD_MISSING");
  }
  if (/\bNOT\s+VALID\b/i.test(sql.replace(/--[^\n]*/g, ""))) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_NOT_VALID");
  }
  if (DML.test(sql)) throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_DML");
  if (GRANT_POLICY.test(sql)) throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_GRANT");
  if (ACTIVE_EXPAND.test(sql)) throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_ACTIVE_POINTER");
  if (/CREATE\s+FUNCTION|CREATE\s+OR\s+REPLACE\s+FUNCTION/i.test(sql)) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_RPC");
  }
}

export function assertRideCloudBindKindUnknownRejected(kind: string): void {
  if ((RIDECLOUD_EXTENDED_ARTIFACT_KINDS as readonly string[]).includes(kind)) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_KNOWN_KIND");
  }
}

export function assertRideCloudBindKindActiveForbidden(active: boolean): void {
  if (active) throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_ACTIVE_POINTER");
}

export function assertRideCloudBindKindParentage(input: {
  contractParentId: string;
  briefId: string;
  manifestParentId: string;
  contractId: string;
  workspaceId: string;
  projectId: string;
  contractWorkspaceId: string;
  contractProjectId: string;
  manifestWorkspaceId: string;
  manifestProjectId: string;
}): void {
  if (input.contractParentId !== input.briefId) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_CROSSED_PARENT");
  }
  if (input.manifestParentId !== input.contractId) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_CROSSED_PARENT");
  }
  if (
    input.workspaceId !== input.contractWorkspaceId ||
    input.workspaceId !== input.manifestWorkspaceId ||
    input.projectId !== input.contractProjectId ||
    input.projectId !== input.manifestProjectId
  ) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_WORKSPACE_PROJECT");
  }
}

export function proposedRideCloudBindRpcContract() {
  return {
    name: RIDECLOUD_FUTURE_BIND_RPC_NAME,
    preparedInThisMigration: false,
    reason: "no_existing_rpc_fits_without_widening_privileges",
    existingRpcInspected: "create_director_project_with_brief",
    existingRpcFits: false,
    futureAuth: "AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_RPC_PREFLIGHT_NO_PROVIDER",
    inputs: [
      "workspace_id",
      "project_id",
      "brief_id",
      "storyboard_contract_id",
      "media_input_manifest_id",
      "storyboard_contract_value",
      "media_input_manifest_value",
      "correlation_id",
      "actor_type",
      "actor_id",
    ],
    maxInserts: RIDECLOUD_BIND_FUTURE_WRITES,
    maxRpcCalls: RIDECLOUD_BIND_FUTURE_RPC_CALLS,
    activePointers: 0,
    briefUpdates: 0,
    replayExact: "EXISTING",
    partialOrDivergent: "REFUSE",
    transaction: "single_atomic_rpc_after_remote_schema_apply",
    grants: "service_role_execute_only_when_created",
  } as const;
}

export function buildRideCloudBindKindSchemaPreflight() {
  assertRideCloudBindKindSchemaAuthChain();
  assertRideCloudBindKindSchemaMigrationSafe();
  assertRideCloudNoSideEffects({
    providerCalls: 0,
    elevenLabsCalls: 0,
    falCalls: 0,
    signedUrlCount: 0,
    mediaReads: 0,
    mediaWrites: 0,
    storageUploads: 0,
    productionWrites: 0,
    supabaseMutations: 0,
    flagWrites: 0,
    deploymentsTriggered: 0,
    productionProjectsCreated: 0,
    humanReviewWrites: 0,
  });
  const bind = buildRideCloudSeparateProjectBindPreflight();
  const identity = resolveRideCloudBindIdentity();
  const contract = plannedRideCloudStoryboardContract(identity);
  const manifest = plannedRideCloudMediaManifest(identity);
  assertRideCloudBindPayloadIsTextual(contract);
  assertRideCloudBindPayloadIsTextual(manifest);
  assertRideCloudBindKindParentage({
    contractParentId: contract.parentId,
    briefId: identity.briefId,
    manifestParentId: manifest.parentId,
    contractId: identity.contractId,
    workspaceId: identity.workspaceId,
    projectId: identity.projectId,
    contractWorkspaceId: contract.workspaceId,
    contractProjectId: contract.projectId,
    manifestWorkspaceId: manifest.workspaceId,
    manifestProjectId: manifest.projectId,
  });
  assertRideCloudBindKindActiveForbidden(false);
  assertRideCloudBindRejectsAutoSubstitution({ preferHd: true, replaceLocked720: false });
  assertRideCloudBindLocatorSafe(JSON.stringify(bind.identity));
  const report = {
    auth: RIDECLOUD_BIND_KIND_SCHEMA_AUTH,
    verdict: RIDECLOUD_BIND_KIND_SCHEMA_VERDICT,
    nextAuth: RIDECLOUD_BIND_KIND_SCHEMA_NEXT_AUTH,
    table: RIDECLOUD_BIND_KIND_SCHEMA_TABLE,
    constraint: RIDECLOUD_BIND_KIND_SCHEMA_CONSTRAINT,
    activeConstraintUnchanged: RIDECLOUD_BIND_KIND_ACTIVE_CONSTRAINT,
    migration: RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION,
    migrationSha256Prefix: rideCloudBindKindSchemaMigrationSha256().slice(0, 16),
    historicalKinds: RIDECLOUD_HISTORICAL_ARTIFACT_KINDS,
    addedKinds: [RIDECLOUD_STORYBOARD_CONTRACT_KIND, RIDECLOUD_MEDIA_MANIFEST_KIND],
    localMigrationCount: RIDECLOUD_LOCAL_MIGRATION_COUNT,
    remoteMigrationCount: RIDECLOUD_REMOTE_MIGRATION_COUNT,
    remoteLastMigration: RIDECLOUD_REMOTE_LAST_MIGRATION,
    remoteDrift: "REMOTE_DRIFT_EXPECTED_LOCAL_AHEAD_1" as const,
    rls: "unchanged" as const,
    grants: "unchanged" as const,
    rpc: proposedRideCloudBindRpcContract(),
    identity: {
      projectIdPrefix: redactRideCloudId(identity.projectId),
      briefIdPrefix: redactRideCloudId(identity.briefId),
      contractIdPrefix: redactRideCloudId(identity.contractId),
      manifestIdPrefix: redactRideCloudId(identity.manifestId),
    },
    counters: {
      remoteDdlWrites: 0,
      supabaseMutations: 0,
      productionWrites: 0,
      artifactsCreated: 0,
      projectsCreated: 0,
      briefsUpdated: 0,
      providerCalls: 0,
      phaseCostCents: 0,
    },
  };
  assertRideCloudBindPayloadIsTextual(report);
  return report;
}
