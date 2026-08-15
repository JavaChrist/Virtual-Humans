/**
 * Phase 11C — Voice identity catalog remote migration preflight (no Production write).
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PHASE_11C_VOICE_CAPABILITY_FLAG_ENV, assertPhase11CVoiceFlagsRemainOff } from "../phase-11c-voice-allowlist";
import { PHASE_11C_VOICE_IDENTITY_MIGRATION } from "../phase-11c-voice-identity-catalog";
import {
  PHASE_11C_APPLICATION_ONLY_GUARDS,
  PHASE_11C_LOCAL_MIGRATION_COUNT,
  PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES,
  PHASE_11C_REMOTE_LAST_MIGRATION,
  PHASE_11C_REMOTE_MIGRATION_COUNT,
  PHASE_11C_VOICE_GRANT_MATRIX,
  PHASE_11C_VOICE_IDENTITY_MIGRATION_GIT_BLOB,
  PHASE_11C_VOICE_IDENTITY_MIGRATION_SHA256,
  PHASE_11C_VOICE_IDENTITY_REMOTE_FACTS,
  PHASE_11C_VOICE_IDENTITY_REMOTE_PREFLIGHT_AUTH,
  PHASE_11C_VOICE_IDENTITY_REMOTE_PREFLIGHT_NEXT_AUTH,
  PHASE_11C_VOICE_IDENTITY_REMOTE_PREFLIGHT_VERDICT,
  PHASE_11C_VOICE_TABLES,
  assertVoiceIdentityMigrationDriftAdmissible,
  assertVoiceIdentityRemoteFactsSafe,
  buildVoiceIdentityApplyPlan,
  buildVoiceIdentityRollbackPlan,
  buildVoiceIdentitySeedPlan,
  compareVoiceIdentityMigrationDrift,
  hashVoiceIdentityMigrationSql,
  inspectVoiceIdentityMigrationSql,
  readVoiceIdentityMigrationSql,
  redactVoiceIdentityPreflightError,
  runVoiceIdentityRemotePreflightDryRun,
} from "../phase-11c-voice-identity-remote-preflight";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..", "..");
const migrationsDir = join(repoRoot, "studio", "supabase", "migrations");

const LOCAL_MIGRATION_FILES = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const REMOTE_VERSIONS = LOCAL_MIGRATION_FILES.filter(
  (file) => file !== PHASE_11C_VOICE_IDENTITY_MIGRATION,
);

const SQL = readVoiceIdentityMigrationSql(repoRoot);

test("11C-RP — auth, flags OFF, apply forbidden", () => {
  assert.equal(
    PHASE_11C_VOICE_IDENTITY_REMOTE_PREFLIGHT_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT",
  );
  assert.equal(
    PHASE_11C_VOICE_IDENTITY_REMOTE_PREFLIGHT_VERDICT,
    "VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT_READY_FOR_APPLY_AUTH",
  );
  assert.equal(
    PHASE_11C_VOICE_IDENTITY_REMOTE_PREFLIGHT_NEXT_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLY_ONCE",
  );
  assert.equal(PHASE_11C_VOICE_IDENTITY_MIGRATION, "20260815182203_vhs_11c_voice_identity_catalog.sql");
  assert.equal(PHASE_11C_VOICE_IDENTITY_MIGRATION_GIT_BLOB, "103d5b93adafa3e97b264ffe6370e18244965174");
  assertPhase11CVoiceFlagsRemainOff({});
  assert.throws(
    () => assertPhase11CVoiceFlagsRemainOff({ [PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]: "1" }),
    /OFF/,
  );
  assert.equal(buildVoiceIdentityApplyPlan().migrationApplyAllowed, false);
});

test("11C-RP — SQL static: tables, RLS, grants, no seed, no voiceId", () => {
  const inspected = inspectVoiceIdentityMigrationSql(SQL);
  assert.equal(inspected.createsVoiceIdentities, true);
  assert.equal(inspected.createsConsent, true);
  assert.equal(inspected.createsBindings, true);
  assert.equal(inspected.enablesRls, true);
  assert.equal(inspected.createsPolicy, false);
  assert.equal(inspected.grantsAnonOrAuthenticated, false);
  assert.equal(inspected.seedsRows, false);
  assert.equal(inspected.containsVoiceIdAssignment, false);
  assert.equal(inspected.containsSecurityDefiner, false);
  assert.equal(inspected.executionForcedOff, true);
  assert.equal(inspected.oneActiveNarratorIndex, true);
  assert.equal(hashVoiceIdentityMigrationSql(SQL), PHASE_11C_VOICE_IDENTITY_MIGRATION_SHA256);
  assert.ok(!/voiceId/i.test(SQL));
  assert.match(SQL, /NOT \(metadata \? 'xiApiKey'\)/);
  assert.ok(!/sk-[A-Za-z0-9]{10,}/.test(SQL));
  assert.ok(!/BEGIN PRIVATE/.test(SQL));
  assert.ok(!/data:[^;\s]+;base64,/.test(SQL));
  assert.deepEqual([...PHASE_11C_VOICE_TABLES], [
    "voice_identities",
    "voice_consent_attestations",
    "project_voice_bindings",
  ]);
});

test("11C-RP — grant matrix service_role only", () => {
  assert.equal(PHASE_11C_VOICE_GRANT_MATRIX.length, 3);
  for (const row of PHASE_11C_VOICE_GRANT_MATRIX) {
    assert.equal(row.rls, true);
    assert.equal(row.policies, 0);
    assert.equal(row.public, "REVOKE ALL");
    assert.equal(row.anon, "REVOKE ALL");
    assert.equal(row.authenticated, "REVOKE ALL");
    assert.ok(!row.serviceRole.includes("DELETE"));
    assert.ok(!row.serviceRole.includes("TRUNCATE"));
  }
  assert.deepEqual(PHASE_11C_VOICE_GRANT_MATRIX[1]?.serviceRole, ["SELECT", "INSERT"]);
});

test("11C-RP — drift admissible: 30 remote, 1 local-only", () => {
  assert.equal(LOCAL_MIGRATION_FILES.length, PHASE_11C_LOCAL_MIGRATION_COUNT);
  assert.equal(REMOTE_VERSIONS.length, PHASE_11C_REMOTE_MIGRATION_COUNT);
  assert.equal(REMOTE_VERSIONS.at(-1), `${PHASE_11C_REMOTE_LAST_MIGRATION}.sql`);
  const drift = compareVoiceIdentityMigrationDrift({
    localFiles: LOCAL_MIGRATION_FILES,
    remoteVersions: REMOTE_VERSIONS,
  });
  assertVoiceIdentityMigrationDriftAdmissible(drift);
  assert.deepEqual(drift.localUnapplied, ["20260815182203"]);
  assert.deepEqual(drift.extraLocalOnly, []);
  assert.deepEqual(drift.remoteUnknownLocally, []);
});

test("11C-RP — drift refuses extra local-only or remote unknown", () => {
  assert.throws(
    () =>
      assertVoiceIdentityMigrationDriftAdmissible(
        compareVoiceIdentityMigrationDrift({
          localFiles: [...LOCAL_MIGRATION_FILES, "20260816190000_extra.sql"],
          remoteVersions: REMOTE_VERSIONS,
        }),
      ),
    /more than one local-only|local-only migration drift|unexpected local/,
  );
  assert.throws(
    () =>
      assertVoiceIdentityMigrationDriftAdmissible(
        compareVoiceIdentityMigrationDrift({
          localFiles: LOCAL_MIGRATION_FILES,
          remoteVersions: [...REMOTE_VERSIONS, "20260816190000_unknown"],
        }),
      ),
    /unknown locally|unexpected remote/,
  );
});

test("11C-RP — remote facts refuse preexisting table or write", () => {
  assertVoiceIdentityRemoteFactsSafe(PHASE_11C_VOICE_IDENTITY_REMOTE_FACTS);
  assert.throws(
    () => assertVoiceIdentityRemoteFactsSafe({ ...PHASE_11C_VOICE_IDENTITY_REMOTE_FACTS, voiceTablesPresent: true }),
    /already exist/,
  );
  assert.throws(
    () => assertVoiceIdentityRemoteFactsSafe({ ...PHASE_11C_VOICE_IDENTITY_REMOTE_FACTS, productionWrites: 1 }),
    /write is forbidden/,
  );
  assert.throws(
    () =>
      assertVoiceIdentityRemoteFactsSafe({
        ...PHASE_11C_VOICE_IDENTITY_REMOTE_FACTS,
        voiceConstraintCollisions: 1,
      }),
    /collision/,
  );
});

test("11C-RP — dry-run replay fingerprint stable, applyAllowed false", () => {
  const first = runVoiceIdentityRemotePreflightDryRun({
    sql: SQL,
    localFiles: LOCAL_MIGRATION_FILES,
    remoteVersions: REMOTE_VERSIONS,
  });
  const second = runVoiceIdentityRemotePreflightDryRun({
    sql: SQL,
    localFiles: LOCAL_MIGRATION_FILES,
    remoteVersions: REMOTE_VERSIONS,
  });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(first.migrationApplyAllowed, false);
  assert.equal(first.productionWrites, 0);
  assert.equal(first.providerCalls, 0);
  assert.equal(first.driftAdmissible, true);
  assert.equal(first.localFingerprintPrefixes.narrator_female, "99db51be34bc");
  assert.equal(first.localFingerprintPrefixes.character_mei, "1a398f86b113");
  assert.equal(new Set(Object.values(PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES)).size, 4);
});

test("11C-RP — dry-run refuses policy, grant, seed, voiceId, checksum", () => {
  assert.throws(
    () => runVoiceIdentityRemotePreflightDryRun({ sql: `${SQL}\nCREATE POLICY p ON public.voice_identities FOR SELECT TO anon USING (true);\n` }),
    /RLS\/grants|checksum/,
  );
  assert.throws(
    () => runVoiceIdentityRemotePreflightDryRun({ sql: `${SQL}\nGRANT SELECT ON TABLE public.voice_identities TO anon;\n` }),
    /RLS\/grants|checksum/,
  );
  assert.throws(
    () => runVoiceIdentityRemotePreflightDryRun({ sql: `${SQL}\nINSERT INTO public.voice_identities DEFAULT VALUES;\n` }),
    /seed|checksum/,
  );
  assert.throws(
    () => runVoiceIdentityRemotePreflightDryRun({ sql: `${SQL}\n-- ELEVENLABS_VOICE_ID=sk_test\n` }),
    /seed, secret|checksum/,
  );
  assert.throws(
    () => runVoiceIdentityRemotePreflightDryRun({ sql: `${SQL}\n-- checksum-break\n` }),
    /checksum/,
  );
});

test("11C-RP — rollback and seed plans are documentary only", () => {
  const rollback = buildVoiceIdentityRollbackPlan();
  const seed = buildVoiceIdentitySeedPlan();
  assert.equal(rollback.automatic, false);
  assert.equal(rollback.executed, false);
  assert.equal(rollback.requiresEmptyTables, true);
  assert.deepEqual(rollback.dropOrder, [
    "project_voice_bindings",
    "voice_consent_attestations",
    "voice_identities",
  ]);
  assert.equal(seed.executed, false);
  assert.equal(seed.identities, 4);
  assert.equal(seed.consents, 4);
  assert.equal(seed.projectBindings, 0);
  assert.equal(seed.narratorSelectedForCurrentProject, false);
  assert.equal(seed.persistVoiceId, false);
  assert.equal(seed.activeForProviderExecution, false);
  assert.ok(PHASE_11C_APPLICATION_ONLY_GUARDS.includes("no_historical_global_fallback"));
  assert.ok(PHASE_11C_APPLICATION_ONLY_GUARDS.includes("mei_cannot_be_narrator"));
});

test("11C-RP — redaction never echoes a voice secret", () => {
  const redacted = redactVoiceIdentityPreflightError("locator env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID value ABCDEFGHIJKLMNOPQRST");
  assert.match(redacted, /\[redacted-voice\]/);
  assert.ok(!/ABCDEFGHIJKLMNOPQRST/.test(redacted));
});
