/**
 * Phase 11C — Voice catalog grant hardening preflight (no Production write).
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PHASE_11C_VOICE_CAPABILITY_FLAG_ENV, assertPhase11CVoiceFlagsRemainOff } from "../phase-11c-voice-allowlist";
import { PHASE_11C_VOICE_IDENTITY_MIGRATION } from "../phase-11c-voice-identity-catalog";
import {
  ALL_TABLE_PRIVILEGES,
  NO_TABLE_PRIVILEGES,
  PHASE_11C_ACTUAL_VOICE_GRANTS,
  PHASE_11C_APPEND_ONLY_ASSESSMENT,
  PHASE_11C_CONSENT_WRITE_INVENTORY,
  PHASE_11C_GRANT_HARDENING_REMOTE_FACTS,
  PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES,
  PHASE_11C_TARGET_VOICE_GRANTS,
  PHASE_11C_VOICE_GRANT_HARDENING_AUTH,
  PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB,
  PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
  PHASE_11C_VOICE_GRANT_HARDENING_NEXT_AUTH,
  PHASE_11C_VOICE_GRANT_HARDENING_SHA256,
  PHASE_11C_VOICE_GRANT_HARDENING_VERDICT,
  assertVoiceGrantHardeningDriftAdmissible,
  assertVoiceGrantHardeningFactsSafe,
  assertVoiceGrantHardeningSqlAdmissible,
  compareVoiceGrantHardeningDrift,
  diffVoiceGrantMatrices,
  hashVoiceGrantHardeningSql,
  inspectVoiceGrantHardeningSql,
  readVoiceGrantHardeningSql,
  redactVoiceGrantHardeningError,
  runVoiceGrantHardeningDryRun,
} from "../phase-11c-voice-identity-grant-hardening-preflight";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..", "..");
const migrationsDir = join(repoRoot, "studio", "supabase", "migrations");

const LOCAL_MIGRATION_FILES = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const REMOTE_VERSIONS = LOCAL_MIGRATION_FILES.filter(
  (file) => file !== PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
);

const SQL = readVoiceGrantHardeningSql(repoRoot);

test("11C-GH — auth, flags OFF, apply and seed forbidden", () => {
  assert.equal(
    PHASE_11C_VOICE_GRANT_HARDENING_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_PREFLIGHT",
  );
  assert.equal(
    PHASE_11C_VOICE_GRANT_HARDENING_VERDICT,
    "VOICE_IDENTITY_CATALOG_GRANTS_HARDENING_READY_FOR_REMOTE_APPLY_PREFLIGHT",
  );
  assert.equal(
    PHASE_11C_VOICE_GRANT_HARDENING_NEXT_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_PREFLIGHT",
  );
  assert.equal(
    PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
    "20260815212100_vhs_11c_voice_identity_catalog_grant_hardening.sql",
  );
  assert.equal(PHASE_11C_VOICE_IDENTITY_MIGRATION, "20260815195207_vhs_11c_voice_identity_catalog.sql");
  assert.equal(PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB, "b0eb2eb50ba726df520fa60bb9008e725130bca9");
  assertPhase11CVoiceFlagsRemainOff({});
  assert.throws(
    () => assertPhase11CVoiceFlagsRemainOff({ [PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]: "1" }),
    /OFF/,
  );
});

test("11C-GH — ACL target matrix service_role only", () => {
  assert.equal(PHASE_11C_TARGET_VOICE_GRANTS.length, 3);
  for (const row of PHASE_11C_TARGET_VOICE_GRANTS) {
    assert.equal(row.rls, true);
    assert.equal(row.policies, 0);
    assert.deepEqual(row.public, NO_TABLE_PRIVILEGES);
    assert.deepEqual(row.anon, NO_TABLE_PRIVILEGES);
    assert.deepEqual(row.authenticated, NO_TABLE_PRIVILEGES);
    assert.equal(row.service_role.SELECT, true);
    assert.equal(row.service_role.INSERT, true);
    assert.equal(row.service_role.DELETE, false);
    assert.equal(row.service_role.TRUNCATE, false);
    assert.equal(row.service_role.REFERENCES, false);
    assert.equal(row.service_role.TRIGGER, false);
  }
  assert.equal(PHASE_11C_TARGET_VOICE_GRANTS[0]?.service_role.UPDATE, true);
  assert.equal(PHASE_11C_TARGET_VOICE_GRANTS[1]?.service_role.UPDATE, false);
  assert.equal(PHASE_11C_TARGET_VOICE_GRANTS[2]?.service_role.UPDATE, true);
});

test("11C-GH — actual overlay exceeds target; only REVOKEs required", () => {
  for (const row of PHASE_11C_ACTUAL_VOICE_GRANTS) {
    assert.deepEqual(row.service_role, ALL_TABLE_PRIVILEGES);
    assert.deepEqual(row.anon, NO_TABLE_PRIVILEGES);
  }
  const diffs = diffVoiceGrantMatrices();
  assert.equal(diffs.length, 3);
  assert.deepEqual(
    diffs.map((diff) => [diff.table, diff.role, [...diff.revoke], [...diff.grant]]),
    [
      ["voice_identities", "service_role", [...PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES.voice_identities], []],
      ["voice_consent_attestations", "service_role", [...PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES.voice_consent_attestations], []],
      ["project_voice_bindings", "service_role", [...PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES.project_voice_bindings], []],
    ],
  );
});

test("11C-GH — hardening SQL is grants-only, no DML, no default privileges", () => {
  const inspected = inspectVoiceGrantHardeningSql(SQL);
  assert.equal(inspected.revokesAllOnIdentities, true);
  assert.equal(inspected.revokesAllOnConsent, true);
  assert.equal(inspected.revokesAllOnBindings, true);
  assert.equal(inspected.grantsIdentities, true);
  assert.equal(inspected.grantsConsent, true);
  assert.equal(inspected.grantsBindings, true);
  assert.equal(inspected.explicitRevokeIdentities, true);
  assert.equal(inspected.explicitRevokeConsent, true);
  assert.equal(inspected.explicitRevokeBindings, true);
  assert.equal(inspected.altersDefaultPrivileges, false);
  assert.equal(inspected.hasDataDml, false);
  assert.equal(inspected.hasDropOrTruncateStatement, false);
  assert.equal(inspected.altersTable, false);
  assert.equal(inspected.touchesRls, false);
  assert.equal(inspected.createsPolicy, false);
  assert.equal(inspected.createsRole, false);
  assert.equal(inspected.securityDefiner, false);
  assert.equal(inspected.containsVoiceId, false);
  assert.equal(hashVoiceGrantHardeningSql(SQL), PHASE_11C_VOICE_GRANT_HARDENING_SHA256);
  assertVoiceGrantHardeningSqlAdmissible(SQL);
  assert.ok(!/voiceId/i.test(SQL));
  assert.ok(!/sk-[A-Za-z0-9]{10,}/.test(SQL));
  assert.ok(!/BEGIN PRIVATE/.test(SQL));
  assert.ok(!/data:[^;\s]+;base64,/.test(SQL));
  assert.ok(!/ALTER\s+DEFAULT\s+PRIVILEGES/i.test(SQL));
});

test("11C-GH — append-only consent has no Production writer", () => {
  assert.equal(PHASE_11C_APPEND_ONLY_ASSESSMENT.sufficientAfterHardening, true);
  assert.equal(PHASE_11C_APPEND_ONLY_ASSESSMENT.ownerPostgresRetainsAdmin, true);
  assert.equal(PHASE_11C_APPEND_ONLY_ASSESSMENT.seedBlockedUntilHardeningApplied, true);
  assert.equal(PHASE_11C_APPEND_ONLY_ASSESSMENT.revokeByNewAttestation, true);
  assert.equal(PHASE_11C_CONSENT_WRITE_INVENTORY.every((row) => row.persistsToProduction === false), true);
  assert.equal(PHASE_11C_GRANT_HARDENING_REMOTE_FACTS.securityDefinerVoiceFunctions, 0);
  assert.equal(PHASE_11C_GRANT_HARDENING_REMOTE_FACTS.destructiveTriggers, 0);
});

test("11C-GH — drift remote 31 / local 32 / one local-only", () => {
  assert.equal(LOCAL_MIGRATION_FILES.length, 32);
  assert.equal(REMOTE_VERSIONS.length, 31);
  const drift = compareVoiceGrantHardeningDrift({
    localFiles: LOCAL_MIGRATION_FILES,
    remoteVersions: REMOTE_VERSIONS,
  });
  assertVoiceGrantHardeningDriftAdmissible(drift);
  assert.deepEqual(drift.localUnapplied, ["20260815212100"]);
  assert.deepEqual(drift.remoteUnknownLocally, []);
  assert.throws(
    () =>
      assertVoiceGrantHardeningDriftAdmissible(
        compareVoiceGrantHardeningDrift({
          localFiles: [...LOCAL_MIGRATION_FILES, "20260816190000_extra.sql"],
          remoteVersions: REMOTE_VERSIONS,
        }),
      ),
    /unexpected local|local-only/,
  );
});

test("11C-GH — facts refuse missing table, seed, policy, client grant, write", () => {
  assertVoiceGrantHardeningFactsSafe(PHASE_11C_GRANT_HARDENING_REMOTE_FACTS);
  assert.throws(
    () => assertVoiceGrantHardeningFactsSafe({ ...PHASE_11C_GRANT_HARDENING_REMOTE_FACTS, voiceTablesPresent: false }),
    /missing/,
  );
  assert.throws(
    () =>
      assertVoiceGrantHardeningFactsSafe({
        ...PHASE_11C_GRANT_HARDENING_REMOTE_FACTS,
        rowCounts: { ...PHASE_11C_GRANT_HARDENING_REMOTE_FACTS.rowCounts, voice_identities: 1 },
      }),
    /seeded/,
  );
  assert.throws(
    () => assertVoiceGrantHardeningFactsSafe({ ...PHASE_11C_GRANT_HARDENING_REMOTE_FACTS, policies: 1 }),
    /policy/,
  );
  assert.throws(
    () => assertVoiceGrantHardeningFactsSafe({ ...PHASE_11C_GRANT_HARDENING_REMOTE_FACTS, clientGrants: 1 }),
    /client grant/,
  );
  assert.throws(
    () => assertVoiceGrantHardeningFactsSafe({ ...PHASE_11C_GRANT_HARDENING_REMOTE_FACTS, productionWrites: 1 }),
    /write is forbidden/,
  );
});

test("11C-GH — dry-run replay fingerprint stable, apply/seed false", () => {
  const first = runVoiceGrantHardeningDryRun({
    sql: SQL,
    localFiles: LOCAL_MIGRATION_FILES,
    remoteVersions: REMOTE_VERSIONS,
  });
  const second = runVoiceGrantHardeningDryRun({
    sql: SQL,
    localFiles: LOCAL_MIGRATION_FILES,
    remoteVersions: REMOTE_VERSIONS,
  });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(first.migrationApplyAllowed, false);
  assert.equal(first.seedAllowed, false);
  assert.equal(first.productionWrites, 0);
  assert.equal(first.providerCalls, 0);
  assert.equal(first.tablesEmpty, true);
  assert.equal(first.noDataToMigrate, true);
  assert.deepEqual(first.requiredGrants, []);
  assert.equal(first.catalogMigration, PHASE_11C_VOICE_IDENTITY_MIGRATION);
});

test("11C-GH — dry-run refuses default privileges, DML, DROP, RLS, policy, checksum", () => {
  assert.throws(
    () => runVoiceGrantHardeningDryRun({ sql: `${SQL}\nALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;\n` }),
    /default privileges|checksum/,
  );
  assert.throws(
    () => runVoiceGrantHardeningDryRun({ sql: `${SQL}\nINSERT INTO public.voice_identities DEFAULT VALUES;\n` }),
    /DML|checksum/,
  );
  assert.throws(
    () => runVoiceGrantHardeningDryRun({ sql: `${SQL}\nTRUNCATE public.voice_identities;\n` }),
    /DML|TRUNCATE|checksum/,
  );
  assert.throws(
    () => runVoiceGrantHardeningDryRun({ sql: `${SQL}\nALTER TABLE public.voice_identities ENABLE ROW LEVEL SECURITY;\n` }),
    /schema, RLS|checksum/,
  );
  assert.throws(
    () => runVoiceGrantHardeningDryRun({ sql: `${SQL}\nCREATE POLICY p ON public.voice_identities FOR SELECT TO anon USING (true);\n` }),
    /schema, RLS|checksum/,
  );
  assert.throws(
    () => runVoiceGrantHardeningDryRun({ sql: `${SQL}\n-- checksum-break\n` }),
    /checksum/,
  );
});

test("11C-GH — redaction never echoes a voice secret", () => {
  const redacted = redactVoiceGrantHardeningError("locator env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID value ABCDEFGHIJKLMNOPQRST");
  assert.match(redacted, /\[redacted-voice\]/);
  assert.ok(!/ABCDEFGHIJKLMNOPQRST/.test(redacted));
});
