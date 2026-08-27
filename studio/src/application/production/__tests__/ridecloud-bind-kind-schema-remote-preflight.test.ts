/**
 * RideCloud bind kind schema remote preflight — local assertions on recorded read-only facts.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RIDECLOUD_BIND_KIND_SCHEMA_NEXT_AUTH,
  RIDECLOUD_HISTORICAL_ARTIFACT_KINDS,
  RIDECLOUD_LOCAL_MIGRATION_COUNT,
  RIDECLOUD_REMOTE_LAST_MIGRATION,
  RIDECLOUD_REMOTE_MIGRATION_COUNT,
} from "../ridecloud-bind-kind-schema-preflight";
import {
  RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION_SHA256_PREFIX,
  RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_FACTS,
  RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_AUTH,
  RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_NEXT_AUTH,
  RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_VERDICT,
  assertRideCloudBindKindSchemaFutureApplyStop,
  assertRideCloudBindKindSchemaRemoteFacts,
  assertRideCloudBindKindSchemaRemoteQuerySafe,
  buildRideCloudBindKindSchemaRemotePreflight,
  compareRideCloudBindKindSchemaDrift,
  extractKindsFromCheckDefinition,
  listRideCloudLocalMigrationFiles,
  proposedRideCloudBindKindSchemaApplyPlan,
} from "../ridecloud-bind-kind-schema-remote-preflight";

test("RIDECLOUD-BIND-KIND-SCHEMA-REMOTE — READY recorded facts and auth chain", () => {
  const localFiles = listRideCloudLocalMigrationFiles();
  const plan = buildRideCloudBindKindSchemaRemotePreflight({
    ...RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_FACTS,
    localFiles,
  });
  assert.equal(plan.auth, RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_AUTH);
  assert.equal(plan.verdict, RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_VERDICT);
  assert.equal(plan.nextAuth, RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_NEXT_AUTH);
  assert.equal(RIDECLOUD_BIND_KIND_SCHEMA_NEXT_AUTH, RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_AUTH);
  assert.equal(plan.localMigrationCount, RIDECLOUD_LOCAL_MIGRATION_COUNT);
  assert.equal(plan.remoteMigrationCount, RIDECLOUD_REMOTE_MIGRATION_COUNT);
  assert.equal(plan.remoteLastMigration, RIDECLOUD_REMOTE_LAST_MIGRATION);
  assert.equal(plan.migrationSha256Prefix, RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION_SHA256_PREFIX);
  assert.equal(plan.apply.appliedInThisGate, false);
  assert.equal(plan.counters.migrationsApplied, 0);
  assert.equal(plan.counters.remoteDdlWrites, 0);
});

test("RIDECLOUD-BIND-KIND-SCHEMA-REMOTE — drift is exactly one local-only migration", () => {
  const localFiles = listRideCloudLocalMigrationFiles();
  const drift = compareRideCloudBindKindSchemaDrift({
    localFiles,
    remoteVersions: RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_FACTS.remoteVersions,
  });
  assert.equal(drift.localCount, 33);
  assert.equal(drift.remoteCount, 32);
  assert.deepEqual(drift.localOnly, ["20260827133000"]);
  assert.deepEqual(drift.remoteUnknown, []);
  assert.equal(drift.ordered, true);
  assert.equal(drift.duplicates, false);
  assert.equal(localFiles.at(-1), "20260827133000_vhs_ridecloud_bind_artifact_kinds.sql");
});

test("RIDECLOUD-BIND-KIND-SCHEMA-REMOTE — CHECK kinds match historical list and omit bind kinds", () => {
  const kinds = extractKindsFromCheckDefinition(RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_FACTS.checkDefinition);
  assert.equal(kinds.join(","), RIDECLOUD_HISTORICAL_ARTIFACT_KINDS.join(","));
  assert.equal(RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_FACTS.checkDefinition.includes("storyboard_contract"), false);
  assert.equal(RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_FACTS.checkDefinition.includes("media_input_manifest"), false);
  assert.equal(kinds.length, 13);
});

test("RIDECLOUD-BIND-KIND-SCHEMA-REMOTE — refuses unknown, missing, duplicate or unordered remote versions", () => {
  const localFiles = listRideCloudLocalMigrationFiles();
  const base = { ...RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_FACTS, localFiles };
  assert.throws(
    () =>
      assertRideCloudBindKindSchemaRemoteFacts({
        ...base,
        remoteVersions: [...base.remoteVersions, "20260828111111"],
      }),
    /BLOCKED_REMOTE_DRIFT/,
  );
  assert.throws(
    () =>
      assertRideCloudBindKindSchemaRemoteFacts({
        ...base,
        remoteVersions: base.remoteVersions.slice(0, -1),
      }),
    /BLOCKED_REMOTE_DRIFT/,
  );
  assert.throws(
    () =>
      assertRideCloudBindKindSchemaRemoteFacts({
        ...base,
        remoteVersions: [...base.remoteVersions, base.remoteVersions[0]!],
      }),
    /BLOCKED_REMOTE_DRIFT/,
  );
  assert.throws(
    () =>
      assertRideCloudBindKindSchemaRemoteFacts({
        ...base,
        remoteVersions: [base.remoteVersions[1]!, base.remoteVersions[0]!, ...base.remoteVersions.slice(2)],
      }),
    /BLOCKED_REMOTE_DRIFT/,
  );
});

test("RIDECLOUD-BIND-KIND-SCHEMA-REMOTE — refuses CHECK, data, RLS or RideCloud divergence", () => {
  const localFiles = listRideCloudLocalMigrationFiles();
  const base = { ...RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_FACTS, localFiles };
  assert.throws(
    () => assertRideCloudBindKindSchemaRemoteFacts({ ...base, hasStoryboardContract: true }),
    /BLOCKED_REMOTE_DRIFT/,
  );
  assert.throws(
    () => assertRideCloudBindKindSchemaRemoteFacts({ ...base, unknownOrNewKinds: 1 }),
    /BLOCKED_REMOTE_DRIFT/,
  );
  assert.throws(
    () => assertRideCloudBindKindSchemaRemoteFacts({ ...base, rls: false }),
    /BLOCKED_REMOTE_DRIFT/,
  );
  assert.throws(
    () => assertRideCloudBindKindSchemaRemoteFacts({ ...base, anonWriteGrants: 1 }),
    /BLOCKED_REMOTE_DRIFT/,
  );
  assert.throws(
    () => assertRideCloudBindKindSchemaRemoteFacts({ ...base, rideCloudBindArtifacts: 1 }),
    /BLOCKED_REMOTE_DRIFT/,
  );
  assert.throws(
    () => assertRideCloudBindKindSchemaRemoteFacts({ ...base, rideCloudStatus: "active" }),
    /BLOCKED_REMOTE_DRIFT/,
  );
  assert.throws(
    () => assertRideCloudBindKindSchemaRemoteFacts({ ...base, policies: 1 }),
    /BLOCKED_REMOTE_DRIFT/,
  );
});

test("RIDECLOUD-BIND-KIND-SCHEMA-REMOTE — future apply stays unexecuted and stops on locks", () => {
  const apply = proposedRideCloudBindKindSchemaApplyPlan();
  assert.equal(apply.appliedInThisGate, false);
  assert.equal(apply.maxRemoteMigrations, 1);
  assert.equal(apply.dataChanges, 0);
  assert.equal(apply.rpcCreated, 0);
  const localFiles = listRideCloudLocalMigrationFiles();
  assert.throws(
    () =>
      assertRideCloudBindKindSchemaFutureApplyStop({
        ...RIDECLOUD_BIND_KIND_SCHEMA_REMOTE_FACTS,
        localFiles,
        artifactLocks: 2,
      }),
    /LOCKS/,
  );
});

test("RIDECLOUD-BIND-KIND-SCHEMA-REMOTE — refuses mutating SQL in this gate", () => {
  assert.doesNotThrow(() =>
    assertRideCloudBindKindSchemaRemoteQuerySafe(
      "SELECT conname FROM pg_constraint WHERE conname = 'project_artifacts_type_check'",
    ),
  );
  assert.throws(
    () => assertRideCloudBindKindSchemaRemoteQuerySafe("ALTER TABLE public.project_artifacts DROP CONSTRAINT x"),
    /REMOTE_WRITE/,
  );
  assert.throws(
    () => assertRideCloudBindKindSchemaRemoteQuerySafe("INSERT INTO public.project_artifacts DEFAULT VALUES"),
    /REMOTE_WRITE/,
  );
  assert.throws(
    () => assertRideCloudBindKindSchemaRemoteQuerySafe("SELECT 1; apply_migration"),
    /REMOTE_WRITE/,
  );
});
