/**
 * Phase 11C — Voice seed/consent preflight (in-memory only, no Production write).
 */
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { hashVoiceSecret } from "../phase-11c-voice-secret-locator";
import {
  PHASE_11C_VOICE_CAPABILITY_FLAG_ENV,
  PHASE_11C_WORKSPACE_ID,
  assertPhase11CVoiceFlagsRemainOff,
} from "../phase-11c-voice-allowlist";
import {
  VOICE_IDENTITY_LOCATORS,
  VOICE_IDENTITY_STABLE_KEYS,
} from "../phase-11c-voice-identity-catalog";
import { syntheticLocator } from "../phase-11c-voice-identity-dry-run";
import { PHASE_11C_ACTUAL_VOICE_GRANTS, PHASE_11C_TARGET_VOICE_GRANTS } from "../phase-11c-voice-identity-grant-hardening-preflight";
import { PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES } from "../phase-11c-voice-identity-remote-preflight";
import {
  PHASE_11C_SEED_EXPECTED_ROWS,
  PHASE_11C_VOICE_CATALOG_VERSION,
  PHASE_11C_VOICE_SEED_AUTHORIZATION_SOURCE,
  PHASE_11C_VOICE_SEED_PREFLIGHT_AUTH,
  PHASE_11C_VOICE_SEED_PREFLIGHT_NEXT_AUTH,
  PHASE_11C_VOICE_SEED_PREFLIGHT_VERDICT,
  assertLiveCharacterPrefixes,
  assertNoVoiceIdInSeedPayload,
  assertSeedAclHardened,
  assertSeedTablesReady,
  buildVoiceSeedConsentPlan,
  buildVoiceSeedIdentityPlan,
  evaluateSeedCas,
  resolveLiveSeedLocatorsRedacted,
  runVoiceSeedPreflightDryRun,
  simulateVoiceSeedTransaction,
  voiceConsentDeterministicId,
  voiceConsentIdempotencyKey,
  voiceIdentityDeterministicId,
  voiceIdentityIdempotencyKey,
} from "../phase-11c-voice-identity-seed-preflight";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..", "..");

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

test("11C-SEED — auth, flags OFF, seed forbidden, next Auth", () => {
  assert.equal(
    PHASE_11C_VOICE_SEED_PREFLIGHT_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT",
  );
  assert.equal(
    PHASE_11C_VOICE_SEED_PREFLIGHT_VERDICT,
    "VOICE_IDENTITY_CATALOG_SEED_PREFLIGHT_READY_FOR_SINGLE_TRANSACTION_AUTH",
  );
  assert.equal(
    PHASE_11C_VOICE_SEED_PREFLIGHT_NEXT_AUTH,
    "AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_SINGLE_TRANSACTION",
  );
  assertPhase11CVoiceFlagsRemainOff({});
  assert.throws(
    () => assertPhase11CVoiceFlagsRemainOff({ [PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]: "1" }),
    /OFF/,
  );
  assert.deepEqual(PHASE_11C_SEED_EXPECTED_ROWS, {
    identities: 4,
    consents: 4,
    bindings: 0,
    providerActiveIdentities: 0,
  });
});

test("11C-SEED — four identities, IDs and idempotency keys deterministic", () => {
  const first = VOICE_IDENTITY_STABLE_KEYS.map((key) => buildVoiceSeedIdentityPlan(key, RESOLUTIONS[key]));
  const second = VOICE_IDENTITY_STABLE_KEYS.map((key) => buildVoiceSeedIdentityPlan(key, RESOLUTIONS[key]));
  assert.equal(first.length, 4);
  assert.equal(new Set(first.map((row) => row.id)).size, 4);
  assert.equal(new Set(first.map((row) => row.idempotencyKey)).size, 4);
  assert.deepEqual(first.map((row) => row.id), second.map((row) => row.id));
  assert.equal(first[0]?.id, voiceIdentityDeterministicId("character_mei"));
  assert.equal(first[0]?.idempotencyKey, voiceIdentityIdempotencyKey("character_mei"));
  assert.ok(first[0]?.id.includes(PHASE_11C_WORKSPACE_ID.slice(0, 0)) || first[0]?.workspaceId === PHASE_11C_WORKSPACE_ID);
  assert.equal(first[0]?.status, "available");
  assert.equal(first[0]?.activeForProviderExecution, false);
  assert.equal(first[0]?.characterId, "mei");
  assert.equal(first[1]?.characterId, "tom");
  assert.equal(first[2]?.characterId, null);
  assert.equal(first[3]?.characterId, null);
  assert.ok(!JSON.stringify(first).includes(PHASE_11C_VOICE_CATALOG_VERSION) || first[0]?.metadata.catalogVersion === PHASE_11C_VOICE_CATALOG_VERSION);
});

test("11C-SEED — four bounded consents, distinct keys, no substitution", () => {
  const identities = VOICE_IDENTITY_STABLE_KEYS.map((key) => buildVoiceSeedIdentityPlan(key, RESOLUTIONS[key]));
  const consents = identities.map((row) => buildVoiceSeedConsentPlan(row.stableKey, row.id));
  assert.equal(consents.length, 4);
  assert.equal(new Set(consents.map((row) => row.id)).size, 4);
  assert.equal(consents[0]?.id, voiceConsentDeterministicId("character_mei"));
  assert.equal(consents[0]?.idempotencyKey, voiceConsentIdempotencyKey("character_mei"));
  assert.notEqual(consents[0]?.idempotencyKey, identities[0]?.idempotencyKey);
  assert.equal(consents[0]?.scope, "character_dialogue");
  assert.equal(consents[1]?.scope, "character_dialogue");
  assert.equal(consents[2]?.scope, "workspace_voice_over");
  assert.equal(consents[3]?.scope, "workspace_voice_over");
  assert.equal(consents[0]?.authorizationSource, PHASE_11C_VOICE_SEED_AUTHORIZATION_SOURCE);
  assert.ok(consents.every((row) => row.allowedProjectId === null));
  assert.ok(consents.every((row) => !row.substitutionAuthorized && !row.providerCallAuthorized));
});

test("11C-SEED — CAS created / existing / conflict", () => {
  const identity = buildVoiceSeedIdentityPlan("character_mei", RESOLUTIONS.character_mei);
  assert.equal(evaluateSeedCas({ existing: null, desired: identity }), "created");
  assert.equal(
    evaluateSeedCas({
      existing: {
        id: identity.id,
        idempotencyKey: identity.idempotencyKey,
        voiceFingerprint: identity.voiceFingerprint,
        secretLocator: identity.secretLocator,
      },
      desired: identity,
    }),
    "existing",
  );
  assert.equal(
    evaluateSeedCas({
      existing: {
        id: identity.id,
        idempotencyKey: identity.idempotencyKey,
        voiceFingerprint: hashVoiceSecret("other"),
        secretLocator: identity.secretLocator,
      },
      desired: identity,
    }),
    "conflict",
  );
});

test("11C-SEED — transaction created, replay existing, conflict rolls back", () => {
  const identities = VOICE_IDENTITY_STABLE_KEYS.map((key) => buildVoiceSeedIdentityPlan(key, RESOLUTIONS[key]));
  const consents = identities.map((row) => buildVoiceSeedConsentPlan(row.stableKey, row.id));
  const created = simulateVoiceSeedTransaction({
    existingIdentities: [],
    existingConsents: [],
    existingBindings: 0,
    identities,
    consents,
  });
  assert.equal(created.outcome, "created");
  assert.equal(created.productionWrites, 0);
  assert.equal(created.bindings, 0);
  const replay = simulateVoiceSeedTransaction({
    existingIdentities: identities.map((row) => ({
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      voiceFingerprint: row.voiceFingerprint,
      secretLocator: row.secretLocator,
    })),
    existingConsents: consents.map((row) => ({
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      decision: row.decision,
    })),
    existingBindings: 0,
    identities,
    consents,
  });
  assert.equal(replay.outcome, "existing");
  const conflict = simulateVoiceSeedTransaction({
    existingIdentities: identities.map((row, index) => ({
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      voiceFingerprint: index === 0 ? hashVoiceSecret("changed") : row.voiceFingerprint,
      secretLocator: row.secretLocator,
    })),
    existingConsents: [],
    existingBindings: 0,
    identities,
    consents,
  });
  assert.equal(conflict.outcome, "rollback");
  const binding = simulateVoiceSeedTransaction({
    existingIdentities: [],
    existingConsents: [],
    existingBindings: 1,
    identities,
    consents,
  });
  assert.equal(binding.outcome, "rollback");
});

test("11C-SEED — dry-run replay fingerprint stable, no binding, seedAllowed false", () => {
  const first = runVoiceSeedPreflightDryRun({ resolutions: RESOLUTIONS });
  const second = runVoiceSeedPreflightDryRun({ resolutions: RESOLUTIONS });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(first.seedAllowed, false);
  assert.equal(first.productionWrites, 0);
  assert.equal(first.bindings, 0);
  assert.equal(first.consents, 4);
  assert.equal(first.distinctFingerprints, 4);
  assert.equal(first.i2vNarratorSelected, false);
  assert.equal(first.migrationAlignment, "32/32");
  assert.equal(first.voiceIdExposed, false);
  assert.equal(new Set(Object.values(first.fingerprintPrefixes)).size, 4);
});

test("11C-SEED — refuses missing voice, collision, wrong kind, ACL, non-empty, voiceId", () => {
  const missing = {
    ...RESOLUTIONS,
    narrator_male: { ...RESOLUTIONS.narrator_male, present: false, fingerprint: null, fingerprintPrefix: null },
  };
  assert.throws(() => runVoiceSeedPreflightDryRun({ resolutions: missing }), /missing/);
  const collision = {
    ...RESOLUTIONS,
    narrator_female: syntheticLocator(FP.character_mei, VOICE_IDENTITY_LOCATORS.narrator_female),
  };
  assert.throws(() => runVoiceSeedPreflightDryRun({ resolutions: collision }), /collision/);
  assert.throws(() => assertSeedAclHardened(PHASE_11C_ACTUAL_VOICE_GRANTS), /ACL/);
  assertSeedAclHardened(PHASE_11C_TARGET_VOICE_GRANTS);
  assert.throws(
    () =>
      assertSeedTablesReady({
        voice_identities: 1,
        voice_consent_attestations: 0,
        project_voice_bindings: 0,
      }),
    /empty/,
  );
  assert.throws(() => assertNoVoiceIdInSeedPayload({ voiceId: "should-not-leak" }), /voiceId/);
  assert.throws(
    () =>
      runVoiceSeedPreflightDryRun({
        resolutions: RESOLUTIONS,
        env: { [PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]: "1" },
      }),
    /OFF/,
  );
});

test("11C-SEED — live character prefixes match 143, no value exposed", () => {
  assertLiveCharacterPrefixes(repoRoot);
  const live = resolveLiveSeedLocatorsRedacted({ repoRoot, env: {} });
  assert.equal(live.character_mei.present, true);
  assert.equal(live.character_tom.present, true);
  assert.equal(live.character_mei.fingerprintPrefix, PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES.character_mei);
  assert.equal(live.character_tom.fingerprintPrefix, PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES.character_tom);
  assert.equal(live.character_mei.valueExposed, false);
  assert.equal(live.narrator_female.present, false);
  assert.equal(new Set(Object.values(PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES)).size, 4);
});
