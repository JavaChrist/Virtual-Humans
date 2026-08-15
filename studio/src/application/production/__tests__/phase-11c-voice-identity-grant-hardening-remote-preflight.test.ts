/**
 * Phase 11C — Voice grant hardening remote apply preflight (no Production write).
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PHASE_11C_VOICE_CAPABILITY_FLAG_ENV, assertPhase11CVoiceFlagsRemainOff } from "../phase-11c-voice-allowlist";
import {
  PHASE_11C_GRANT_HARDENING_REMOTE_FACTS,
  PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES,
  PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB,
  PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
  PHASE_11C_VOICE_GRANT_HARDENING_SHA256,
  readVoiceGrantHardeningSql,
} from "../phase-11c-voice-identity-grant-hardening-preflight";
import {
  PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_AUTH,
  PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_NEXT_AUTH,
  PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_VERDICT,
  assertVoiceGrantHardeningApplySqlAdmissible,
  assertVoiceGrantHardeningDeltaMatches145,
  buildVoiceGrantHardeningApplyPlan,
  buildVoiceGrantHardeningRollbackPlan,
  buildVoiceGrantHardeningUncertaintyPlan,
  hashVoiceGrantHardeningSql,
  inspectVoiceGrantHardeningApplySql,
  redactVoiceGrantHardeningRemotePreflightError,
  runVoiceGrantHardeningRemoteApplyPreflightDryRun,
} from "../phase-11c-voice-identity-grant-hardening-remote-preflight";
import { diffVoiceGrantMatrices } from "../phase-11c-voice-identity-grant-hardening-preflight";

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

test("11C-GHRP — auth, flags OFF, apply and seed forbidden", () => {
  assert.equal(
    PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_PREFLIGHT",
  );
  assert.equal(
    PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_VERDICT,
    "VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_PREFLIGHT_READY_FOR_APPLY_AUTH",
  );
  assert.equal(
    PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_NEXT_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_ONCE",
  );
  assert.equal(PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION, "20260815212100_vhs_11c_voice_identity_catalog_grant_hardening.sql");
  assert.equal(PHASE_11C_VOICE_GRANT_HARDENING_SHA256, "4db521b8165cf870b6d07dcf93f93783bc4fa26fb0beced2cfd2860011937b24");
  assert.equal(PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB, "b0eb2eb50ba726df520fa60bb9008e725130bca9");
  assertPhase11CVoiceFlagsRemainOff({});
  assert.throws(
    () => assertPhase11CVoiceFlagsRemainOff({ [PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]: "1" }),
    /OFF/,
  );
  assert.equal(buildVoiceGrantHardeningApplyPlan().migrationApplyAllowed, false);
  assert.equal(buildVoiceGrantHardeningApplyPlan().executed, false);
  assert.equal(buildVoiceGrantHardeningApplyPlan().secondInvocationForbidden, true);
});

test("11C-GHRP — SQL static: BEGIN/COMMIT, grants-only, checksum/blob", () => {
  const extra = inspectVoiceGrantHardeningApplySql(SQL);
  assert.equal(extra.beginCommit, true);
  assert.equal(extra.createsOrDrops, false);
  assert.equal(extra.scopedToVoiceTables, true);
  assertVoiceGrantHardeningApplySqlAdmissible(SQL);
  assert.equal(hashVoiceGrantHardeningSql(SQL), PHASE_11C_VOICE_GRANT_HARDENING_SHA256);
  assert.ok(!/ALTER\s+DEFAULT\s+PRIVILEGES/i.test(SQL));
  assert.ok(!/^\s*INSERT\s+INTO/im.test(SQL));
  assert.ok(!/CREATE POLICY/i.test(SQL));
  assert.ok(!/voiceId/i.test(SQL));
});

test("11C-GHRP — source/target delta matches 145_", () => {
  const diffs = diffVoiceGrantMatrices();
  assertVoiceGrantHardeningDeltaMatches145(diffs);
  assert.deepEqual([...PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES.voice_identities], [
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
  ]);
  assert.deepEqual([...PHASE_11C_REQUIRED_SERVICE_ROLE_REVOKES.voice_consent_attestations], [
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
  ]);
});

test("11C-GHRP — append-only, uncertainty, no GRANT ALL rollback", () => {
  const uncertainty = buildVoiceGrantHardeningUncertaintyPlan();
  const rollback = buildVoiceGrantHardeningRollbackPlan();
  assert.equal(uncertainty.replayForbidden, true);
  assert.equal(uncertainty.automaticRepairForbidden, true);
  assert.equal(rollback.grantAllForbidden, true);
  assert.equal(rollback.restoreExcessPrivilegesForbidden, true);
  assert.equal(PHASE_11C_GRANT_HARDENING_REMOTE_FACTS.securityDefinerVoiceFunctions, 0);
});

test("11C-GHRP — dry-run replay fingerprint stable", () => {
  const first = runVoiceGrantHardeningRemoteApplyPreflightDryRun({
    sql: SQL,
    localFiles: LOCAL_MIGRATION_FILES,
    remoteVersions: REMOTE_VERSIONS,
  });
  const second = runVoiceGrantHardeningRemoteApplyPreflightDryRun({
    sql: SQL,
    localFiles: LOCAL_MIGRATION_FILES,
    remoteVersions: REMOTE_VERSIONS,
  });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(first.migrationApplyAllowed, false);
  assert.equal(first.seedAllowed, false);
  assert.equal(first.productionWrites, 0);
  assert.equal(first.tablesEmpty, true);
  assert.equal(first.driftAdmissible, true);
  assert.deepEqual(first.requiredGrants, []);
  assert.equal(LOCAL_MIGRATION_FILES.length, 32);
  assert.equal(REMOTE_VERSIONS.length, 31);
});

test("11C-GHRP — dry-run refuses seed, defaults, extra local-only, checksum", () => {
  assert.throws(
    () =>
      runVoiceGrantHardeningRemoteApplyPreflightDryRun({
        sql: `${SQL}\nINSERT INTO public.voice_identities DEFAULT VALUES;\n`,
      }),
    /DML|checksum|out of scope/,
  );
  assert.throws(
    () =>
      runVoiceGrantHardeningRemoteApplyPreflightDryRun({
        sql: `${SQL}\nALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;\n`,
      }),
    /default privileges|checksum|out of scope/,
  );
  assert.throws(
    () =>
      runVoiceGrantHardeningRemoteApplyPreflightDryRun({
        sql: SQL,
        localFiles: [...LOCAL_MIGRATION_FILES, "20260816190000_extra.sql"],
        remoteVersions: REMOTE_VERSIONS,
      }),
    /unexpected local|local-only/,
  );
  assert.throws(
    () =>
      runVoiceGrantHardeningRemoteApplyPreflightDryRun({
        facts: {
          ...PHASE_11C_GRANT_HARDENING_REMOTE_FACTS,
          rowCounts: { ...PHASE_11C_GRANT_HARDENING_REMOTE_FACTS.rowCounts, voice_identities: 1 },
        },
      }),
    /seeded/,
  );
  assert.throws(
    () => runVoiceGrantHardeningRemoteApplyPreflightDryRun({ sql: `${SQL}\n-- checksum-break\n` }),
    /checksum/,
  );
});

test("11C-GHRP — redaction never echoes a voice secret", () => {
  const redacted = redactVoiceGrantHardeningRemotePreflightError(
    "locator env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID value ABCDEFGHIJKLMNOPQRST",
  );
  assert.match(redacted, /\[redacted-voice\]/);
  assert.ok(!/ABCDEFGHIJKLMNOPQRST/.test(redacted));
});
