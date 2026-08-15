/**
 * Phase 11C — Voice seed/consent apply post-checks (no second write, no provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { hashVoiceSecret } from "../phase-11c-voice-secret-locator";
import { VOICE_IDENTITY_LOCATORS, VOICE_IDENTITY_STABLE_KEYS } from "../phase-11c-voice-identity-catalog";
import { syntheticLocator } from "../phase-11c-voice-identity-dry-run";
import {
  buildVoiceSeedConsentPlan,
  buildVoiceSeedIdentityPlan,
  voiceConsentDeterministicId,
  voiceIdentityDeterministicId,
} from "../phase-11c-voice-identity-seed-preflight";
import {
  PHASE_11C_POST_SEED_VOICE_ROWS,
  PHASE_11C_SEEDED_CONSENT_IDS,
  PHASE_11C_SEEDED_IDENTITY_IDS,
  PHASE_11C_VOICE_SEED_APPLY_AUTH,
  PHASE_11C_VOICE_SEED_APPLY_INSERTS,
  PHASE_11C_VOICE_SEED_APPLY_INVOCATIONS,
  PHASE_11C_VOICE_SEED_PLAN_FINGERPRINT,
  assertVoiceSeedApplyNoSecondWrite,
  assertVoiceSeedReplayExisting,
  assertVoiceSeedTransactionSqlAdmissible,
  inspectVoiceSeedTransactionSql,
  renderVoiceSeedTransactionSql,
  voiceSeedApplyChecksums,
} from "../phase-11c-voice-identity-seed-apply";

const FP = {
  character_mei: hashVoiceSecret("synthetic-mei-voice-fixture"),
  character_tom: hashVoiceSecret("synthetic-tom-voice-fixture"),
  narrator_female: hashVoiceSecret("synthetic-narrator-female-fixture"),
  narrator_male: hashVoiceSecret("synthetic-narrator-male-fixture"),
} as const;

const RESOLUTIONS = {
  character_mei: syntheticLocator(FP.character_mei, VOICE_IDENTITY_LOCATORS.character_mei),
  character_tom: syntheticLocator(FP.character_tom, VOICE_IDENTITY_LOCATORS.character_tom),
  narrator_female: syntheticLocator(FP.narrator_female, VOICE_IDENTITY_LOCATORS.narrator_female),
  narrator_male: syntheticLocator(FP.narrator_male, VOICE_IDENTITY_LOCATORS.narrator_male),
};

function plan() {
  const identities = VOICE_IDENTITY_STABLE_KEYS.map((key) => buildVoiceSeedIdentityPlan(key, RESOLUTIONS[key]));
  const consents = identities.map((row) => buildVoiceSeedConsentPlan(row.stableKey, row.id));
  return { identities, consents };
}

test("11C-SEED-APPLY — auth, verdict, one write, no second write", () => {
  const checksums = voiceSeedApplyChecksums();
  assert.equal(checksums.auth, "AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_SINGLE_TRANSACTION");
  assert.equal(checksums.verdict, "VOICE_IDENTITY_CATALOG_SEEDED_CONSENTED_RUNTIME_OFF_NO_BINDING");
  assert.equal(checksums.nextAuth, "AUTH_11C_I2V_NARRATOR_BINDING_PREFLIGHT");
  assert.equal(checksums.preflightNext, PHASE_11C_VOICE_SEED_APPLY_AUTH);
  assert.equal(PHASE_11C_VOICE_SEED_PLAN_FINGERPRINT, "f2b738919970ebffde4b8bb9fe0e423ec6da6a37d0d206c4b9a0f44182011696");
  assert.equal(PHASE_11C_VOICE_SEED_APPLY_INVOCATIONS, 1);
  assert.equal(PHASE_11C_VOICE_SEED_APPLY_INSERTS, 8);
  assertVoiceSeedApplyNoSecondWrite(true);
  assert.throws(() => assertVoiceSeedApplyNoSecondWrite(false), /second write/);
});

test("11C-SEED-APPLY — deterministic IDs match 148_", () => {
  assert.equal(voiceIdentityDeterministicId("character_mei"), PHASE_11C_SEEDED_IDENTITY_IDS.character_mei);
  assert.equal(voiceIdentityDeterministicId("character_tom"), PHASE_11C_SEEDED_IDENTITY_IDS.character_tom);
  assert.equal(voiceIdentityDeterministicId("narrator_female"), PHASE_11C_SEEDED_IDENTITY_IDS.narrator_female);
  assert.equal(voiceIdentityDeterministicId("narrator_male"), PHASE_11C_SEEDED_IDENTITY_IDS.narrator_male);
  assert.equal(voiceConsentDeterministicId("character_mei"), PHASE_11C_SEEDED_CONSENT_IDS.character_mei);
  assert.equal(voiceConsentDeterministicId("narrator_male"), PHASE_11C_SEEDED_CONSENT_IDS.narrator_male);
  assert.deepEqual(PHASE_11C_POST_SEED_VOICE_ROWS, {
    voice_identities: 4,
    voice_consent_attestations: 4,
    project_voice_bindings: 0,
    providerActiveIdentities: 0,
  });
});

test("11C-SEED-APPLY — SQL is one bounded transaction, no upsert", () => {
  const { identities, consents } = plan();
  const sql = renderVoiceSeedTransactionSql({ identities, consents });
  assertVoiceSeedTransactionSqlAdmissible(sql);
  const inspected = inspectVoiceSeedTransactionSql(sql);
  assert.equal(inspected.identityInserts, 1);
  assert.equal(inspected.consentInserts, 1);
  assert.equal(inspected.bindingInserts, 0);
  assert.equal(inspected.hasUpdate, false);
  assert.equal(inspected.hasUpsert, false);
  assert.equal(inspected.containsVoiceId, false);
  assert.match(sql, /active_for_provider_execution/);
  assert.match(sql, /christian_explicit_workspace_voice_authorization/);
});

test("11C-SEED-APPLY — replay existing is non-mutating", () => {
  const { identities, consents } = plan();
  assertVoiceSeedReplayExisting({ identities, consents });
});
