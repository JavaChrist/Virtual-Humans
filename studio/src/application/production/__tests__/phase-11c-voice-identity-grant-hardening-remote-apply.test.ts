/**
 * Phase 11C — Voice grant hardening remote apply post-checks (no second apply, no seed).
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PHASE_11C_VOICE_IDENTITY_MIGRATION } from "../phase-11c-voice-identity-catalog";
import {
  PHASE_11C_TARGET_VOICE_GRANTS,
  PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB,
  PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION,
  PHASE_11C_VOICE_GRANT_HARDENING_SHA256,
  hashVoiceGrantHardeningSql,
  readVoiceGrantHardeningSql,
} from "../phase-11c-voice-identity-grant-hardening-preflight";
import {
  PHASE_11C_GRANT_HARDENING_APPLIED_NAME,
  PHASE_11C_GRANT_HARDENING_APPLIED_VERSION,
  PHASE_11C_GRANT_HARDENING_APPLY_INVOCATIONS,
  PHASE_11C_GRANT_HARDENING_POST_APPLY_INVARIANT_COUNTS,
  PHASE_11C_GRANT_HARDENING_POST_APPLY_MIGRATION_COUNT,
  PHASE_11C_GRANT_HARDENING_POST_APPLY_VOICE_ROWS,
  PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_APPLY_AUTH,
  PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_APPLY_NEXT_AUTH,
  PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_APPLY_VERDICT,
  assertVoiceGrantHardeningInvariantsUnchanged,
  assertVoiceGrantHardeningNoSecondApply,
  assertVoiceGrantHardeningPostApplyAligned,
  assertVoiceGrantHardeningReplay,
  assertVoiceGrantHardeningTargetAcl,
  voiceGrantHardeningApplyChecksums,
} from "../phase-11c-voice-identity-grant-hardening-remote-apply";
import { assertVoiceTablesEmpty } from "../phase-11c-voice-identity-remote-apply";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..", "..");
const localFiles = readdirSync(join(repoRoot, "studio", "supabase", "migrations"))
  .filter((file) => file.endsWith(".sql") && file.slice(0, 14) <= "20260815215407")
  .sort();

test("11C-GHA — auth, verdict, one apply, no second apply", () => {
  assert.equal(
    PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_APPLY_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_ONCE",
  );
  assert.equal(
    PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_APPLY_VERDICT,
    "VOICE_IDENTITY_CATALOG_GRANTS_HARDENED_REMOTE_TABLES_EMPTY_RUNTIME_OFF",
  );
  assert.equal(
    PHASE_11C_VOICE_GRANT_HARDENING_REMOTE_APPLY_NEXT_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT",
  );
  assert.equal(PHASE_11C_GRANT_HARDENING_APPLIED_VERSION, "20260815215407");
  assert.equal(PHASE_11C_GRANT_HARDENING_APPLIED_NAME, "vhs_11c_voice_identity_catalog_grant_hardening");
  assert.equal(PHASE_11C_GRANT_HARDENING_APPLY_INVOCATIONS, 1);
  assertVoiceGrantHardeningNoSecondApply(true);
  assert.throws(() => assertVoiceGrantHardeningNoSecondApply(false), /do not guess/);
  assertVoiceGrantHardeningReplay({ migrationNeeded: false, secondApply: false });
  assert.throws(
    () => assertVoiceGrantHardeningReplay({ migrationNeeded: true, secondApply: false }),
    /replay/,
  );
});

test("11C-GHA — checksum and blob unchanged after rename", () => {
  const checksums = voiceGrantHardeningApplyChecksums();
  const sql = readVoiceGrantHardeningSql(repoRoot);
  assert.equal(checksums.sha256, "4db521b8165cf870b6d07dcf93f93783bc4fa26fb0beced2cfd2860011937b24");
  assert.equal(checksums.gitBlob, "b0eb2eb50ba726df520fa60bb9008e725130bca9");
  assert.equal(hashVoiceGrantHardeningSql(sql), PHASE_11C_VOICE_GRANT_HARDENING_SHA256);
  assert.equal(PHASE_11C_VOICE_GRANT_HARDENING_GIT_BLOB, checksums.gitBlob);
  assert.equal(PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION, "20260815215407_vhs_11c_voice_identity_catalog_grant_hardening.sql");
  assert.equal(PHASE_11C_VOICE_IDENTITY_MIGRATION, "20260815195207_vhs_11c_voice_identity_catalog.sql");
});

test("11C-GHA — local/remote 32/32 aligned", () => {
  assert.equal(localFiles.length, PHASE_11C_GRANT_HARDENING_POST_APPLY_MIGRATION_COUNT);
  assertVoiceGrantHardeningPostApplyAligned({
    localFiles,
    remoteVersions: localFiles,
  });
  assert.throws(
    () =>
      assertVoiceGrantHardeningPostApplyAligned({
        localFiles,
        remoteVersions: localFiles.filter((file) => file !== PHASE_11C_VOICE_GRANT_HARDENING_MIGRATION),
      }),
    /32\/32|count/,
  );
});

test("11C-GHA — target ACL, empty tables, invariants unchanged", () => {
  assertVoiceGrantHardeningTargetAcl(PHASE_11C_TARGET_VOICE_GRANTS);
  assertVoiceTablesEmpty(PHASE_11C_GRANT_HARDENING_POST_APPLY_VOICE_ROWS);
  assertVoiceGrantHardeningInvariantsUnchanged(PHASE_11C_GRANT_HARDENING_POST_APPLY_INVARIANT_COUNTS);
  assert.equal(PHASE_11C_TARGET_VOICE_GRANTS[1]?.service_role.UPDATE, false);
  assert.equal(PHASE_11C_TARGET_VOICE_GRANTS[1]?.service_role.DELETE, false);
  assert.equal(PHASE_11C_TARGET_VOICE_GRANTS[0]?.service_role.UPDATE, true);
  assert.equal(PHASE_11C_TARGET_VOICE_GRANTS[0]?.service_role.DELETE, false);
});
