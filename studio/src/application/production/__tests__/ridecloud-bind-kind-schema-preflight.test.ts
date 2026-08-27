/**
 * RideCloud bind kind schema preflight — local only. No remote apply.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PHASE_11A_SMOKE_PROJECT_ID } from "../phase-11a-openai-image-allowlist";
import { RIDECLOUD_REJECTED_UNSAFE_SOURCES } from "../ridecloud-input-preflight";
import {
  RIDECLOUD_BIND_NEXT_AUTH,
  assertRideCloudBindLocatorSafe,
  assertRideCloudBindPayloadIsTextual,
  assertRideCloudBindRejectsAutoSubstitution,
  assertRideCloudBindRejectsTechnicalDeliverable,
  resolveRideCloudBindIdentity,
} from "../ridecloud-separate-project-bind-preflight";
import {
  RIDECLOUD_BIND_KIND_SCHEMA_AUTH,
  RIDECLOUD_BIND_KIND_SCHEMA_CONSTRAINT,
  RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION,
  RIDECLOUD_BIND_KIND_SCHEMA_NEXT_AUTH,
  RIDECLOUD_BIND_KIND_SCHEMA_TABLE,
  RIDECLOUD_BIND_KIND_SCHEMA_VERDICT,
  RIDECLOUD_EXTENDED_ARTIFACT_KINDS,
  RIDECLOUD_FUTURE_BIND_RPC_NAME,
  RIDECLOUD_HISTORICAL_ARTIFACT_KINDS,
  RIDECLOUD_LOCAL_MIGRATION_COUNT,
  RIDECLOUD_REMOTE_MIGRATION_COUNT,
  assertRideCloudBindKindActiveForbidden,
  assertRideCloudBindKindParentage,
  assertRideCloudBindKindSchemaAuthChain,
  assertRideCloudBindKindSchemaMigrationSafe,
  assertRideCloudBindKindUnknownRejected,
  buildRideCloudBindKindSchemaPreflight,
  proposedRideCloudBindRpcContract,
  readRideCloudBindKindSchemaMigration,
} from "../ridecloud-bind-kind-schema-preflight";

test("RIDECLOUD-BIND-KIND-SCHEMA — READY plan and auth chain", () => {
  assertRideCloudBindKindSchemaAuthChain();
  assert.equal(RIDECLOUD_BIND_NEXT_AUTH, RIDECLOUD_BIND_KIND_SCHEMA_AUTH);
  const plan = buildRideCloudBindKindSchemaPreflight();
  assert.equal(plan.verdict, RIDECLOUD_BIND_KIND_SCHEMA_VERDICT);
  assert.equal(plan.nextAuth, RIDECLOUD_BIND_KIND_SCHEMA_NEXT_AUTH);
  assert.equal(plan.table, RIDECLOUD_BIND_KIND_SCHEMA_TABLE);
  assert.equal(plan.constraint, RIDECLOUD_BIND_KIND_SCHEMA_CONSTRAINT);
  assert.equal(plan.migration, RIDECLOUD_BIND_KIND_SCHEMA_MIGRATION);
  assert.equal(plan.historicalKinds.length, 13);
  assert.deepEqual([...plan.addedKinds], ["storyboard_contract", "media_input_manifest"]);
  assert.equal(plan.localMigrationCount, RIDECLOUD_LOCAL_MIGRATION_COUNT);
  assert.equal(plan.remoteMigrationCount, RIDECLOUD_REMOTE_MIGRATION_COUNT);
  assert.equal(plan.remoteDrift, "REMOTE_DRIFT_EXPECTED_LOCAL_AHEAD_1");
  assert.equal(plan.rls, "unchanged");
  assert.equal(plan.grants, "unchanged");
  assert.equal(plan.rpc.preparedInThisMigration, false);
  assert.equal(plan.rpc.name, RIDECLOUD_FUTURE_BIND_RPC_NAME);
  assert.equal(plan.rpc.maxInserts, 2);
});

test("RIDECLOUD-BIND-KIND-SCHEMA — migration keeps historical kinds and adds only two", () => {
  const sql = readRideCloudBindKindSchemaMigration();
  assertRideCloudBindKindSchemaMigrationSafe(sql);
  for (const kind of RIDECLOUD_HISTORICAL_ARTIFACT_KINDS) {
    assert.match(sql, new RegExp(`'${kind}'`));
  }
  assert.match(sql, /'storyboard_contract'/);
  assert.match(sql, /'media_input_manifest'/);
  assert.equal(RIDECLOUD_EXTENDED_ARTIFACT_KINDS.length, 15);
  assert.doesNotThrow(() => assertRideCloudBindKindUnknownRejected("storyboard_fanfic"));
  assert.throws(() => assertRideCloudBindKindUnknownRejected("video_project_brief"), /KNOWN_KIND/);
});

test("RIDECLOUD-BIND-KIND-SCHEMA — no DML, grants, RPC or active pointer expansion", () => {
  const sql = readRideCloudBindKindSchemaMigration();
  assert.ok(!/^\s*INSERT\s+/im.test(sql));
  assert.ok(!/^\s*UPDATE\s+/im.test(sql));
  assert.ok(!/^\s*DELETE\s+/im.test(sql));
  assert.ok(!/CREATE\s+POLICY/i.test(sql));
  assert.ok(!/GRANT\s+/i.test(sql));
  assert.ok(!/SECURITY\s+DEFINER/i.test(sql));
  assert.ok(!/CREATE\s+FUNCTION/i.test(sql));
  assert.ok(!/NOT VALID/i.test(sql));
  assert.ok(!/active_artifact_revisions[\s\S]{0,220}storyboard_contract/i.test(sql));
  assert.throws(
    () => assertRideCloudBindKindSchemaMigrationSafe(`${sql}\nINSERT INTO public.project_artifacts VALUES (1);`),
    /DML/,
  );
});

test("RIDECLOUD-BIND-KIND-SCHEMA — payloads, locators and HD substitution stay fail-closed", () => {
  const identity = resolveRideCloudBindIdentity();
  assert.equal(identity.projectId.startsWith("ba4a6021"), true);
  assert.throws(() => assertRideCloudBindLocatorSafe("studio/.tmp/ridecloud-pack/a.png"), /UNSAFE|SENSITIVE/);
  assert.throws(
    () => assertRideCloudBindLocatorSafe("https://example.com/file?X-Amz-Signature=abcdef123456"),
    /UNSAFE|SENSITIVE/,
  );
  assert.throws(() => assertRideCloudBindLocatorSafe("data:image/png;base64,AAAA"), /UNSAFE|SENSITIVE/);
  assert.throws(() => assertRideCloudBindPayloadIsTextual({ parent: "current" }), /AMBIGUOUS/);
  assert.throws(
    () => assertRideCloudBindRejectsTechnicalDeliverable(RIDECLOUD_REJECTED_UNSAFE_SOURCES[0]),
    /TECHNICAL_PROOF/,
  );
  assert.throws(
    () => assertRideCloudBindRejectsAutoSubstitution({ preferHd: true, replaceLocked720: true }),
    /AUTO_SUBSTITUTION/,
  );
  assert.throws(() => assertRideCloudBindKindActiveForbidden(true), /ACTIVE_POINTER/);
});

test("RIDECLOUD-BIND-KIND-SCHEMA — refuses crossed parentage and wrong workspace/project", () => {
  const identity = resolveRideCloudBindIdentity();
  assert.throws(
    () =>
      assertRideCloudBindKindParentage({
        contractParentId: identity.briefId,
        briefId: identity.briefId,
        manifestParentId: identity.briefId,
        contractId: identity.contractId,
        workspaceId: identity.workspaceId,
        projectId: identity.projectId,
        contractWorkspaceId: identity.workspaceId,
        contractProjectId: identity.projectId,
        manifestWorkspaceId: identity.workspaceId,
        manifestProjectId: identity.projectId,
      }),
    /CROSSED_PARENT/,
  );
  assert.throws(
    () =>
      assertRideCloudBindKindParentage({
        contractParentId: identity.briefId,
        briefId: identity.briefId,
        manifestParentId: identity.contractId,
        contractId: identity.contractId,
        workspaceId: identity.workspaceId,
        projectId: identity.projectId,
        contractWorkspaceId: identity.workspaceId,
        contractProjectId: PHASE_11A_SMOKE_PROJECT_ID,
        manifestWorkspaceId: identity.workspaceId,
        manifestProjectId: identity.projectId,
      }),
    /WORKSPACE_PROJECT/,
  );
});

test("RIDECLOUD-BIND-KIND-SCHEMA — future RPC stays uncreated and replay is exact-only", () => {
  const rpc = proposedRideCloudBindRpcContract();
  assert.equal(rpc.preparedInThisMigration, false);
  assert.equal(rpc.existingRpcFits, false);
  assert.equal(rpc.replayExact, "EXISTING");
  assert.equal(rpc.partialOrDivergent, "REFUSE");
  assert.equal(rpc.briefUpdates, 0);
  assert.equal(rpc.activePointers, 0);
});
