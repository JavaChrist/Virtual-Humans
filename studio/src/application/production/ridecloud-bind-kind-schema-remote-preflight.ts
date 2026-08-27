/**
 * RideCloud bind kind schema remote preflight — read-only.
 * Confirms the local CHECK migration can be applied later. No apply, DML, RPC, or persist.
 */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPhase11CVoiceFlagsRemainOff } from "./phase-11c-voice-allowlist";
import { assertRideCloudNoSideEffects } from "./ridecloud-input-preflight";
import {
  RIDECLOUD_BIND_KIND_SCHEMA_CONSTRAINT,
  RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION,
  RIDECLOUD_BIND_KIND_SCHEMA_NEXT_AUTH,
  RIDECLOUD_BIND_KIND_SCHEMA_TABLE,
  RIDECLOUD_BIND_KIND_ACTIVE_CONSTRAINT,
  RIDECLOUD_HISTORICAL_ARTIFACT_KINDS,
  RIDECLOUD_LOCAL_MIGRATION_COUNT,
  RIDECLOUD_REMOTE_LAST_MIGRATION,
  RIDECLOUD_REMOTE_MIGRATION_COUNT,
  assertRideCloudBindKindSchemaMigrationSafe,
  readRideCloudBindKindSchemaMigration,
  rideCloudBindKindSchemaMigrationSha256,
} from "./ridecloud-bind-kind-schema-preflight";
import {
  RIDECLOUD_MEDIA_MANIFEST_KIND,
  RIDECLOUD_STORYBOARD_CONTRACT_KIND,
  resolveRideCloudBindIdentity,
} from "./ridecloud-separate-project-bind-preflight";
import {
  RIDECLOUD_SUPABASE_HOST_SUFFIX,
  RIDECLOUD_SUPABASE_PROJECT_REF,
} from "./ridecloud-separate-project-create-apply";
import {
  RIDECLOUD_DOCUMENTED_BUDGET,
  RIDECLOUD_PROJECT_DISPLAY_NAME,
  RIDECLOUD_VOICE_MAY_SUBMIT,
  RIDECLOUD_VOICE_SUBMIT_COUNT,
  assertRideCloudCreateBudget,
  redactRideCloudId,
} from "./ridecloud-separate-project-create-preflight";

export const RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_NO_PROVIDER" as const;

export const RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_VERDICT =
  "RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_READY_FOR_APPLY_AUTH" as const;

export const RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_NEXT_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_APPLY_ONCE_NO_PROVIDER" as const;

export const RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION_SHA256_PREFIX = "6409a520979a382b" as const;
export const RIDECLOUD_BIND_KIND_SCHEMA_LOCAL_ONLY_VERSION = "20260827133000" as const;

const FORBIDDEN_WRITE = /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP\s+TABLE|CREATE\s+|GRANT|REVOKE|APPLY|PUSH|RESET|REPAIR)\b/i;
const MUTATING_COMMAND = /\b(db\s+push|migration\s+up|apply_migration)\b/i;

export const RIDECLOUD_EXPECTED_REMOTE_CHECK_KINDS = RIDECLOUD_HISTORICAL_ARTIFACT_KINDS;

export const RIDECLOUD_EXPECTED_ARTIFACT_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "artifact_type",
  "revision",
  "schema_version",
  "parent_revision_id",
  "value",
  "created_at",
  "created_by",
  "correlation_id",
] as const;

export type RideCloudBindKindSchemaRemoteFacts = {
  supabaseProjectRef: string;
  supabaseHostAllowlisted: boolean;
  region: string;
  projectName: string;
  status: string;
  remoteVersions: readonly string[];
  localFiles: readonly string[];
  tablePresent: boolean;
  constraintName: string;
  checkDefinition: string;
  typeCheckCount: number;
  historicalKinds: readonly string[];
  hasStoryboardContract: boolean;
  hasMediaInputManifest: boolean;
  columns: readonly string[];
  uniqueRev: boolean;
  indexPresent: boolean;
  triggerInsert: boolean;
  triggerUpdateDelete: boolean;
  rls: boolean;
  policies: number;
  anonWriteGrants: number;
  authenticatedWriteGrants: number;
  serviceRoleSelect: boolean;
  activeConstraintUnchanged: boolean;
  functionsMentionNewKinds: number;
  artifactTotal: number;
  unknownOrNewKinds: number;
  storyboardContractRows: number;
  mediaInputManifestRows: number;
  tableBytes: number;
  indexBytes: number;
  artifactLocks: number;
  rideCloudProjectCount: number;
  rideCloudStatus: string;
  rideCloudBriefCount: number;
  rideCloudBriefRevision: number;
  rideCloudBindArtifacts: number;
  rideCloudStoryboardProjects: number;
  rideCloudGenerationPlans: number;
  rideCloudRuns: number;
  rideCloudJobs: number;
  rideCloudAttempts: number;
  rideCloudAssets: number;
  rideCloudActivePointers: number;
  rideCloudActivePointerType: string;
  budgetHard: number;
  budgetCommitted: number;
  budgetReserved: number;
  budgetAvailable: number;
  activeReservations: number;
  voiceRuntimeProof: "documentary_and_local";
  paidMediaProof: "documentary_and_local";
  remoteSchemaReads: number;
  writeAttempted: boolean;
};

export const RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_FACTS: RideCloudBindKindSchemaRemoteFacts = {
  supabaseProjectRef: RIDECLOUD_SUPABASE_PROJECT_REF,
  supabaseHostAllowlisted: true,
  region: "eu-west-3",
  projectName: "Virtual Humans Studio",
  status: "ACTIVE_HEALTHY",
  remoteVersions: [
    "20260723203021",
    "20260728210808",
    "20260804134311",
    "20260804134410",
    "20260804134443",
    "20260804134500",
    "20260804134537",
    "20260804134814",
    "20260804135019",
    "20260804135045",
    "20260804135120",
    "20260804135149",
    "20260804135227",
    "20260804135342",
    "20260804135608",
    "20260804135702",
    "20260804135742",
    "20260804140056",
    "20260804140143",
    "20260804140225",
    "20260804140309",
    "20260804140422",
    "20260804141000",
    "20260805002706",
    "20260805140000",
    "20260805143000",
    "20260806120000",
    "20260807213624",
    "20260807213803",
    "20260811211757",
    "20260815195207",
    "20260815215407",
  ],
  localFiles: [],
  tablePresent: true,
  constraintName: RIDECLOUD_BIND_KIND_SCHEMA_CONSTRAINT,
  checkDefinition:
    "CHECK ((artifact_type = ANY (ARRAY['video_project_brief'::text, 'marketing_plan'::text, 'creative_concept'::text, 'video_script'::text, 'visual_direction'::text, 'storyboard_project'::text, 'scene_package'::text, 'scene_package_set'::text, 'generation_plan'::text, 'production_result'::text, 'quality_report'::text, 'merge_plan'::text, 'export_package'::text])))",
  typeCheckCount: 1,
  historicalKinds: RIDECLOUD_HISTORICAL_ARTIFACT_KINDS,
  hasStoryboardContract: false,
  hasMediaInputManifest: false,
  columns: RIDECLOUD_EXPECTED_ARTIFACT_COLUMNS,
  uniqueRev: true,
  indexPresent: true,
  triggerInsert: false,
  triggerUpdateDelete: true,
  rls: true,
  policies: 0,
  anonWriteGrants: 0,
  authenticatedWriteGrants: 0,
  serviceRoleSelect: true,
  activeConstraintUnchanged: true,
  functionsMentionNewKinds: 0,
  artifactTotal: 39,
  unknownOrNewKinds: 0,
  storyboardContractRows: 0,
  mediaInputManifestRows: 0,
  tableBytes: 40960,
  indexBytes: 49152,
  artifactLocks: 0,
  rideCloudProjectCount: 1,
  rideCloudStatus: "draft",
  rideCloudBriefCount: 1,
  rideCloudBriefRevision: 1,
  rideCloudBindArtifacts: 0,
  rideCloudStoryboardProjects: 0,
  rideCloudGenerationPlans: 0,
  rideCloudRuns: 0,
  rideCloudJobs: 0,
  rideCloudAttempts: 0,
  rideCloudAssets: 0,
  rideCloudActivePointers: 1,
  rideCloudActivePointerType: "video_project_brief",
  budgetHard: RIDECLOUD_DOCUMENTED_BUDGET.hard,
  budgetCommitted: RIDECLOUD_DOCUMENTED_BUDGET.committed,
  budgetReserved: RIDECLOUD_DOCUMENTED_BUDGET.reserved,
  budgetAvailable: RIDECLOUD_DOCUMENTED_BUDGET.available,
  activeReservations: 0,
  voiceRuntimeProof: "documentary_and_local",
  paidMediaProof: "documentary_and_local",
  remoteSchemaReads: 22,
  writeAttempted: false,
};

export function listRideCloudLocalMigrationFiles(fromFile = import.meta.url): string[] {
  const here = dirname(fileURLToPath(fromFile));
  return readdirSync(join(here, "..", "..", "..", "supabase", "migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export function extractKindsFromCheckDefinition(definition: string): string[] {
  return [...definition.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
}

export function compareRideCloudBindKindSchemaDrift(input: {
  localFiles: readonly string[];
  remoteVersions: readonly string[];
}): {
  localCount: number;
  remoteCount: number;
  localOnly: string[];
  remoteUnknown: string[];
  lastRemote: string | undefined;
  ordered: boolean;
  duplicates: boolean;
} {
  const localVersions = input.localFiles.map((file) => file.slice(0, 14));
  const remote = [...input.remoteVersions];
  const localOnly = localVersions.filter((version) => !remote.includes(version));
  const remoteUnknown = remote.filter((version) => !localVersions.includes(version));
  const ordered = remote.every((version, index) => index === 0 || version > remote[index - 1]!);
  const duplicates = new Set(remote).size !== remote.length;
  return {
    localCount: localVersions.length,
    remoteCount: remote.length,
    localOnly,
    remoteUnknown,
    lastRemote: remote[remote.length - 1],
    ordered,
    duplicates,
  };
}

export function assertRideCloudBindKindSchemaRemoteQuerySafe(query: string): void {
  if (FORBIDDEN_WRITE.test(query) || MUTATING_COMMAND.test(query)) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_WRITE");
  }
}

export function assertRideCloudBindKindSchemaRemoteAuthChain(): void {
  if (RIDECLOUD_BIND_KIND_SCHEMA_NEXT_AUTH !== RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_AUTH) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_AUTH_CHAIN");
  }
}

export function assertRideCloudBindKindSchemaRemoteFacts(
  facts: RideCloudBindKindSchemaRemoteFacts,
): void {
  if (facts.writeAttempted) throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_WRITE");
  if (!facts.supabaseHostAllowlisted || facts.supabaseProjectRef !== RIDECLOUD_SUPABASE_PROJECT_REF) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  if (facts.region !== "eu-west-3" || facts.status !== "ACTIVE_HEALTHY") {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  const localFiles = facts.localFiles.length > 0 ? facts.localFiles : listRideCloudLocalMigrationFiles();
  const drift = compareRideCloudBindKindSchemaDrift({
    localFiles,
    remoteVersions: facts.remoteVersions,
  });
  if (
    drift.localCount !== RIDECLOUD_LOCAL_MIGRATION_COUNT
    || drift.remoteCount !== RIDECLOUD_REMOTE_MIGRATION_COUNT
    || drift.lastRemote !== RIDECLOUD_REMOTE_LAST_MIGRATION
    || drift.localOnly.length !== 1
    || drift.localOnly[0] !== RIDECLOUD_BIND_KIND_SCHEMA_LOCAL_ONLY_VERSION
    || drift.remoteUnknown.length > 0
    || !drift.ordered
    || drift.duplicates
  ) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  if (!facts.tablePresent || facts.constraintName !== RIDECLOUD_BIND_KIND_SCHEMA_CONSTRAINT) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  const kinds = extractKindsFromCheckDefinition(facts.checkDefinition);
  if (kinds.join(",") !== RIDECLOUD_HISTORICAL_ARTIFACT_KINDS.join(",")) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  if (facts.hasStoryboardContract || facts.hasMediaInputManifest || facts.typeCheckCount !== 1) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  if (facts.columns.join(",") !== RIDECLOUD_EXPECTED_ARTIFACT_COLUMNS.join(",")) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  if (!facts.uniqueRev || !facts.indexPresent || facts.triggerInsert || !facts.triggerUpdateDelete) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  if (!facts.rls || facts.policies !== 0 || facts.anonWriteGrants !== 0 || facts.authenticatedWriteGrants !== 0) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  if (!facts.serviceRoleSelect || !facts.activeConstraintUnchanged || facts.functionsMentionNewKinds !== 0) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  if (
    facts.unknownOrNewKinds !== 0
    || facts.storyboardContractRows !== 0
    || facts.mediaInputManifestRows !== 0
    || facts.artifactTotal < 1
  ) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  if (
    facts.rideCloudProjectCount !== 1
    || facts.rideCloudStatus !== "draft"
    || facts.rideCloudBriefCount !== 1
    || facts.rideCloudBriefRevision !== 1
    || facts.rideCloudBindArtifacts !== 0
    || facts.rideCloudStoryboardProjects !== 0
    || facts.rideCloudGenerationPlans !== 0
    || facts.rideCloudRuns !== 0
    || facts.rideCloudJobs !== 0
    || facts.rideCloudAttempts !== 0
    || facts.rideCloudAssets !== 0
    || facts.rideCloudActivePointers !== 1
    || facts.rideCloudActivePointerType !== "video_project_brief"
  ) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  assertRideCloudCreateBudget({
    hard: facts.budgetHard,
    committed: facts.budgetCommitted,
    reserved: facts.budgetReserved,
    available: facts.budgetAvailable,
  });
  if (facts.activeReservations !== 0) throw new Error("BLOCKED_REMOTE_DRIFT");
}

export function assertRideCloudBindKindSchemaFutureApplyStop(facts: RideCloudBindKindSchemaRemoteFacts): void {
  if (facts.artifactLocks > 0) throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_LOCKS");
}

export function proposedRideCloudBindKindSchemaApplyPlan() {
  return {
    migration: RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION,
    version: RIDECLOUD_BIND_KIND_SCHEMA_LOCAL_ONLY_VERSION,
    appliedInThisGate: false,
    maxRemoteMigrations: 1,
    transaction: "single_begin_commit",
    lock: "ACCESS EXCLUSIVE during DROP+ADD CHECK",
    lockTimeoutInMigration: false,
    lockTimeoutConvention: "none_in_repo",
    dataChanges: 0,
    rpcCreated: 0,
    postApply: [
      "revalidate_remote_33",
      "revalidate_check_includes_two_new_kinds",
      "revalidate_historical_kinds",
      "revalidate_active_constraint_unchanged",
      "revalidate_rls_grants",
      "revalidate_zero_bind_rows",
    ],
    rollback: "transaction abort if CHECK fail; no reverse migration executed",
  } as const;
}

export function buildRideCloudBindKindSchemaRemotePreflight(
  facts: RideCloudBindKindSchemaRemoteFacts = RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_FACTS,
) {
  assertRideCloudBindKindSchemaRemoteAuthChain();
  assertRideCloudBindKindSchemaMigrationSafe();
  const sha = rideCloudBindKindSchemaMigrationSha256();
  if (!sha.startsWith(RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION_SHA256_PREFIX)) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  assertRideCloudBindKindSchemaRemoteFacts(facts);
  assertRideCloudBindKindSchemaFutureApplyStop(facts);
  assertPhase11CVoiceFlagsRemainOff();
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
  const identity = resolveRideCloudBindIdentity();
  const sql = readRideCloudBindKindSchemaMigration();
  if (!sql.includes(RIDECLOUD_STORYBOARD_CONTRACT_KIND) || !sql.includes(RIDECLOUD_MEDIA_MANIFEST_KIND)) {
    throw new Error("BLOCKED_REMOTE_DRIFT");
  }
  return {
    auth: RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_AUTH,
    verdict: RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_VERDICT,
    nextAuth: RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_NEXT_AUTH,
    host: RIDECLOUD_SUPABASE_HOST_SUFFIX,
    table: RIDECLOUD_BIND_KIND_SCHEMA_TABLE,
    constraint: RIDECLOUD_BIND_KIND_SCHEMA_CONSTRAINT,
    activeConstraint: RIDECLOUD_BIND_KIND_ACTIVE_CONSTRAINT,
    migration: RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION,
    migrationSha256Prefix: sha.slice(0, 16),
    localMigrationCount: RIDECLOUD_LOCAL_MIGRATION_COUNT,
    remoteMigrationCount: RIDECLOUD_REMOTE_MIGRATION_COUNT,
    remoteLastMigration: RIDECLOUD_REMOTE_LAST_MIGRATION,
    remoteDrift: "REMOTE_DRIFT_EXPECTED_LOCAL_AHEAD_1" as const,
    historicalKinds: RIDECLOUD_HISTORICAL_ARTIFACT_KINDS,
    addedKindsAbsentRemotely: [RIDECLOUD_STORYBOARD_CONTRACT_KIND, RIDECLOUD_MEDIA_MANIFEST_KIND],
    rls: "on" as const,
    policies: 0,
    grants: "service_role_only" as const,
    lockAssessment: {
      tableBytes: facts.tableBytes,
      indexBytes: facts.indexBytes,
      rows: facts.artifactTotal,
      locks: facts.artifactLocks,
      expectedWindow: "milliseconds_to_low_seconds",
      stopIfLocks: true,
    },
    rideCloud: {
      projectIdPrefix: redactRideCloudId(identity.projectId),
      briefIdPrefix: redactRideCloudId(identity.briefId),
      name: RIDECLOUD_PROJECT_DISPLAY_NAME,
      status: facts.rideCloudStatus,
    },
    budget: RIDECLOUD_DOCUMENTED_BUDGET,
    runtime: {
      voice: "OFF",
      paidMedia: "OFF",
      voiceProof: facts.voiceRuntimeProof,
      paidMediaProof: facts.paidMediaProof,
      maySubmit: RIDECLOUD_VOICE_MAY_SUBMIT,
      submitCount: RIDECLOUD_VOICE_SUBMIT_COUNT,
    },
    apply: proposedRideCloudBindKindSchemaApplyPlan(),
    counters: {
      remoteSchemaReads: facts.remoteSchemaReads,
      remoteDdlWrites: 0,
      remoteDmlWrites: 0,
      migrationsApplied: 0,
      rpcFunctionsCreated: 0,
      supabaseMutations: 0,
      productionWrites: 0,
      artifactsCreated: 0,
      providerCalls: 0,
      phaseCostCents: 0,
    },
  };
}
