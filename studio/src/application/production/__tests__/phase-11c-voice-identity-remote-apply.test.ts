/**
 * Phase 11C — Voice identity catalog remote apply post-checks (no second apply, no seed).
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PHASE_11C_VOICE_IDENTITY_MIGRATION } from "../phase-11c-voice-identity-catalog";
import {
  PHASE_11C_APPLIED_MIGRATION_NAME,
  PHASE_11C_APPLIED_MIGRATION_VERSION,
  PHASE_11C_POST_APPLY_INVARIANT_COUNTS,
  PHASE_11C_POST_APPLY_MIGRATION_COUNT,
  PHASE_11C_POST_APPLY_VOICE_ROW_COUNTS,
  PHASE_11C_SERVICE_ROLE_DEFAULT_OVERLAY,
  PHASE_11C_VOICE_IDENTITY_REMOTE_APPLY_AUTH,
  PHASE_11C_VOICE_IDENTITY_REMOTE_APPLY_NEXT_AUTH,
  PHASE_11C_VOICE_IDENTITY_REMOTE_APPLY_VERDICT,
  assertClientGrantsDenied,
  assertInvariantCountsUnchanged,
  assertNoSecondApply,
  assertVoiceIdentityPostApplyAligned,
  assertVoiceTablesEmpty,
  voiceIdentityApplyChecksums,
} from "../phase-11c-voice-identity-remote-apply";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..", "..");
const localFiles = readdirSync(join(repoRoot, "studio", "supabase", "migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();

test("11C-RA — auth, verdict, no second apply", () => {
  assert.equal(
    PHASE_11C_VOICE_IDENTITY_REMOTE_APPLY_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLY_ONCE",
  );
  assert.equal(
    PHASE_11C_VOICE_IDENTITY_REMOTE_APPLY_VERDICT,
    "VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLIED_EMPTY_RUNTIME_OFF",
  );
  assert.equal(
    PHASE_11C_VOICE_IDENTITY_REMOTE_APPLY_NEXT_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT",
  );
  assert.equal(PHASE_11C_APPLIED_MIGRATION_VERSION, "20260815195207");
  assert.equal(PHASE_11C_APPLIED_MIGRATION_NAME, "vhs_11c_voice_identity_catalog");
  assertNoSecondApply(true);
  assert.throws(() => assertNoSecondApply(false), /do not guess/);
});

test("11C-RA — checksum and blob unchanged after rename", () => {
  const checksums = voiceIdentityApplyChecksums();
  assert.equal(checksums.sha256, "58069e22849afd82546200be0b6afb4d61c57d962d767830faced2910b77f8ce");
  assert.equal(checksums.gitBlob, "103d5b93adafa3e97b264ffe6370e18244965174");
  assert.equal(PHASE_11C_VOICE_IDENTITY_MIGRATION, "20260815195207_vhs_11c_voice_identity_catalog.sql");
  assert.deepEqual([...checksums.tables], [
    "voice_identities",
    "voice_consent_attestations",
    "project_voice_bindings",
  ]);
});

test("11C-RA — local/remote 31/31 aligned", () => {
  assert.equal(localFiles.length, PHASE_11C_POST_APPLY_MIGRATION_COUNT);
  assertVoiceIdentityPostApplyAligned({
    localFiles,
    remoteVersions: localFiles,
  });
  assert.throws(
    () =>
      assertVoiceIdentityPostApplyAligned({
        localFiles,
        remoteVersions: localFiles.filter((file) => file !== PHASE_11C_VOICE_IDENTITY_MIGRATION),
      }),
    /31\/31|count/,
  );
});

test("11C-RA — Voice tables empty and invariants unchanged", () => {
  assertVoiceTablesEmpty(PHASE_11C_POST_APPLY_VOICE_ROW_COUNTS);
  assertInvariantCountsUnchanged(PHASE_11C_POST_APPLY_INVARIANT_COUNTS);
  assert.throws(
    () => assertVoiceTablesEmpty({ ...PHASE_11C_POST_APPLY_VOICE_ROW_COUNTS, voice_identities: 1 }),
    /empty/,
  );
});

test("11C-RA — client grants denied; default overlay documented", () => {
  assertClientGrantsDenied({ anonSelect: false, authenticatedSelect: false });
  assert.throws(
    () => assertClientGrantsDenied({ anonSelect: true, authenticatedSelect: false }),
    /client grant/,
  );
  assert.ok(PHASE_11C_SERVICE_ROLE_DEFAULT_OVERLAY.includes("DELETE"));
  assert.ok(PHASE_11C_SERVICE_ROLE_DEFAULT_OVERLAY.includes("TRUNCATE"));
});
