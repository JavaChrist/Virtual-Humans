/**
 * Phase 11C — I2V narrator_female binding apply (one INSERT, no provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { hashVoiceSecret } from "../phase-11c-voice-secret-locator";
import {
  PHASE_11C_PROJECT_ID,
  PHASE_11C_VOICE_CAPABILITY_FLAG_ENV,
  PHASE_11C_WORKSPACE_ID,
  assertPhase11CVoiceFlagsRemainOff,
} from "../phase-11c-voice-allowlist";
import {
  HISTORICAL_GLOBAL_VOICE_LOCATOR,
  VOICE_IDENTITY_LOCATORS,
  VOICE_IDENTITY_STABLE_KEYS,
  buildVoiceIdentityCatalog,
} from "../phase-11c-voice-identity-catalog";
import {
  createVoiceIdentityConsentStore,
  persistVoiceIdentityConsent,
} from "../phase-11c-voice-identity-consent";
import { syntheticLocator } from "../phase-11c-voice-identity-dry-run";
import { resolveVoiceIdentityForSegment } from "../phase-11c-voice-identity-resolver";
import { PHASE_11C_SEEDED_IDENTITY_IDS } from "../phase-11c-voice-identity-seed-apply";
import {
  bindingPlanToProjectVoiceBinding,
  buildI2vNarratorFemaleBindingPlan,
  i2vNarratorBindingDeterministicId,
  resolveI2vVoiceOverFromPreparedBinding,
  runI2vNarratorBindingPreflightDryRun,
} from "../phase-11c-i2v-narrator-binding-preflight";
import {
  PHASE_11C_BOUND_NARRATOR_BINDING_ID,
  PHASE_11C_I2V_NARRATOR_BINDING_APPLY_AUTH,
  PHASE_11C_I2V_NARRATOR_BINDING_APPLY_DELETES,
  PHASE_11C_I2V_NARRATOR_BINDING_APPLY_INSERTS,
  PHASE_11C_I2V_NARRATOR_BINDING_APPLY_INVOCATIONS,
  PHASE_11C_I2V_NARRATOR_BINDING_APPLY_NEXT_AUTH,
  PHASE_11C_I2V_NARRATOR_BINDING_APPLY_UPDATES,
  PHASE_11C_I2V_NARRATOR_BINDING_APPLY_VERDICT,
  PHASE_11C_I2V_NARRATOR_BINDING_PLAN_FINGERPRINT,
  PHASE_11C_POST_BINDING_VOICE_ROWS,
  PHASE_11C_PRE_BINDING_VOICE_ROWS,
  assertI2vNarratorBindingApplyNoSecondWrite,
  assertI2vNarratorBindingPlanFingerprint,
  assertI2vNarratorBindingReplayExisting,
  assertI2vNarratorBindingTransactionSqlAdmissible,
  i2vNarratorBindingApplyChecksums,
  inspectI2vNarratorBindingTransactionSql,
  liveI2vProjectHasPersistedNarratorFemaleBinding,
  renderI2vNarratorBindingTransactionSql,
  simulateI2vNarratorBindingApplyTransaction,
} from "../phase-11c-i2v-narrator-binding-apply";

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

function seededResolverInputs() {
  const catalog = buildVoiceIdentityCatalog({ env: {}, resolutions: RESOLUTIONS });
  const consents = createVoiceIdentityConsentStore();
  for (const key of VOICE_IDENTITY_STABLE_KEYS) {
    persistVoiceIdentityConsent(consents, {
      id: `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee${key === "character_mei" ? "1" : key === "character_tom" ? "2" : key === "narrator_female" ? "3" : "4"}`,
      voiceIdentityStableKey: key,
      createdAt: "2026-08-16T00:00:00.000Z",
      idempotencyKey: `consent-${key}`,
    });
  }
  return {
    catalog,
    consentMap: {
      character_mei: consents.records.find((row) => row.voiceIdentityStableKey === "character_mei"),
      character_tom: consents.records.find((row) => row.voiceIdentityStableKey === "character_tom"),
      narrator_female: consents.records.find((row) => row.voiceIdentityStableKey === "narrator_female"),
      narrator_male: consents.records.find((row) => row.voiceIdentityStableKey === "narrator_male"),
    },
  };
}

test("11C-I2V-BIND-APPLY — auth, one INSERT, flags OFF, no second write", () => {
  const checksums = i2vNarratorBindingApplyChecksums();
  assert.equal(checksums.auth, PHASE_11C_I2V_NARRATOR_BINDING_APPLY_AUTH);
  assert.equal(checksums.verdict, PHASE_11C_I2V_NARRATOR_BINDING_APPLY_VERDICT);
  assert.equal(checksums.nextAuth, PHASE_11C_I2V_NARRATOR_BINDING_APPLY_NEXT_AUTH);
  assert.equal(checksums.preflightNext, PHASE_11C_I2V_NARRATOR_BINDING_APPLY_AUTH);
  assert.equal(checksums.planFingerprint, PHASE_11C_I2V_NARRATOR_BINDING_PLAN_FINGERPRINT);
  assert.equal(PHASE_11C_I2V_NARRATOR_BINDING_APPLY_INVOCATIONS, 1);
  assert.equal(PHASE_11C_I2V_NARRATOR_BINDING_APPLY_INSERTS, 1);
  assert.equal(PHASE_11C_I2V_NARRATOR_BINDING_APPLY_UPDATES, 0);
  assert.equal(PHASE_11C_I2V_NARRATOR_BINDING_APPLY_DELETES, 0);
  assert.equal(liveI2vProjectHasPersistedNarratorFemaleBinding(), true);
  assertPhase11CVoiceFlagsRemainOff({});
  assert.throws(
    () => assertPhase11CVoiceFlagsRemainOff({ [PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]: "1" }),
    /flag|OFF|disabled|remain/i,
  );
  assertI2vNarratorBindingApplyNoSecondWrite(true);
  assert.throws(() => assertI2vNarratorBindingApplyNoSecondWrite(false), /second write/);
});

test("11C-I2V-BIND-APPLY — deterministic id and 150_ fingerprint stay exact", () => {
  const plan = buildI2vNarratorFemaleBindingPlan();
  const dry = runI2vNarratorBindingPreflightDryRun();
  assert.equal(plan.id, PHASE_11C_BOUND_NARRATOR_BINDING_ID);
  assert.equal(plan.id, i2vNarratorBindingDeterministicId());
  assert.ok(plan.id.startsWith("e3a1cc87"));
  assert.ok(plan.voiceIdentityId.startsWith("bc1c8046"));
  assert.ok(PHASE_11C_PROJECT_ID.startsWith("984507af"));
  assert.equal(plan.workspaceId, PHASE_11C_WORKSPACE_ID);
  assert.notEqual(plan.id, plan.voiceIdentityId);
  assertI2vNarratorBindingPlanFingerprint(dry.fingerprint);
  assert.throws(() => assertI2vNarratorBindingPlanFingerprint("0".repeat(64)), /fingerprint/);
});

test("11C-I2V-BIND-APPLY — SQL is one bounded INSERT, no upsert", () => {
  const plan = buildI2vNarratorFemaleBindingPlan();
  const sql = renderI2vNarratorBindingTransactionSql(plan);
  assertI2vNarratorBindingTransactionSqlAdmissible(sql);
  const inspected = inspectI2vNarratorBindingTransactionSql(sql);
  assert.equal(inspected.bindingInserts, 1);
  assert.equal(inspected.identityInserts, 0);
  assert.equal(inspected.consentInserts, 0);
  assert.equal(inspected.hasUpdate, false);
  assert.equal(inspected.hasUpsert, false);
  assert.equal(inspected.hasDelete, false);
  assert.equal(inspected.containsVoiceId, false);
  assert.match(sql, /christian_explicit_workspace_voice_authorization/);
  assert.match(sql, /active_for_provider_execution IS FALSE/);
  assert.match(sql, /status = 'prepared'/);
});

test("11C-I2V-BIND-APPLY — CAS created then existing replay is non-mutating", () => {
  const plan = buildI2vNarratorFemaleBindingPlan();
  const created = simulateI2vNarratorBindingApplyTransaction({ existingBindings: [], desired: plan });
  assert.equal(created.outcome, "created");
  assert.equal(created.productionWrites, 1);
  assert.equal(created.projectBindingsCreated, 1);
  assert.equal(created.inserts, 1);
  assert.equal(created.updates, 0);
  assert.equal(created.deletes, 0);
  assertI2vNarratorBindingReplayExisting(plan);
  assert.deepEqual(PHASE_11C_PRE_BINDING_VOICE_ROWS.project_voice_bindings, 0);
  assert.deepEqual(PHASE_11C_POST_BINDING_VOICE_ROWS, {
    voice_identities: 4,
    voice_consent_attestations: 4,
    project_voice_bindings: 1,
    providerActiveIdentities: 0,
  });
});

test("11C-I2V-BIND-APPLY — refuses narrator_male, Mei, Tom and conflict rollback", () => {
  const plan = buildI2vNarratorFemaleBindingPlan();
  const male = simulateI2vNarratorBindingApplyTransaction({
    existingBindings: [{
      id: plan.id,
      idempotencyKey: plan.idempotencyKey,
      projectId: plan.projectId,
      voiceIdentityId: PHASE_11C_SEEDED_IDENTITY_IDS.narrator_male,
      voiceIdentityStableKey: "narrator_male",
      allowedContentKind: "voice_over",
    }],
    desired: plan,
  });
  const concurrent = simulateI2vNarratorBindingApplyTransaction({
    existingBindings: [
      {
        id: plan.id,
        idempotencyKey: plan.idempotencyKey,
        projectId: plan.projectId,
        voiceIdentityId: plan.voiceIdentityId,
        voiceIdentityStableKey: plan.voiceIdentityStableKey,
        allowedContentKind: plan.allowedContentKind,
      },
      {
        id: "ffffffff-ffff-5fff-8fff-ffffffffffff",
        idempotencyKey: "other-binding",
        projectId: plan.projectId,
        voiceIdentityId: PHASE_11C_SEEDED_IDENTITY_IDS.character_mei,
        voiceIdentityStableKey: "character_mei",
        allowedContentKind: "dialogue",
      },
    ],
    desired: plan,
  });
  assert.equal(male.outcome, "rollback");
  assert.equal(male.productionWrites, 0);
  assert.equal(concurrent.outcome, "rollback");
  assert.equal(plan.narratorMaleSelected, false);
  assert.equal(plan.meiSubstituted, false);
  assert.equal(plan.tomSubstituted, false);
});

test("11C-I2V-BIND-APPLY — resolver uses explicit female binding only", () => {
  const { catalog, consentMap } = seededResolverInputs();
  const plan = buildI2vNarratorFemaleBindingPlan();
  const binding = bindingPlanToProjectVoiceBinding(plan);
  const resolved = resolveI2vVoiceOverFromPreparedBinding({
    identities: catalog.identities,
    consents: consentMap,
    binding,
  });
  assert.equal(resolved.stableKey, "narrator_female");
  assert.equal(resolved.usedHistoricalGlobalFallback, false);
  assert.equal(resolved.executionAuthorized, false);
  assert.throws(
    () => resolveVoiceIdentityForSegment({
      workspaceId: PHASE_11C_WORKSPACE_ID,
      projectId: PHASE_11C_PROJECT_ID,
      spokenKind: "voice_over",
      speakerKind: "narrator",
      identities: catalog.identities,
      consents: consentMap,
    }),
    /explicit narrator choice/,
  );
  assert.throws(
    () => resolveI2vVoiceOverFromPreparedBinding({
      identities: catalog.identities,
      consents: consentMap,
      binding: { ...binding, voiceIdentityStableKey: "narrator_male" },
    }),
    /narrator_male/,
  );
  assert.throws(
    () => resolveI2vVoiceOverFromPreparedBinding({
      identities: {
        ...catalog.identities,
        narrator_female: {
          ...catalog.identities.narrator_female,
          secretLocator: HISTORICAL_GLOBAL_VOICE_LOCATOR as typeof catalog.identities.narrator_female.secretLocator,
        },
      },
      consents: consentMap,
      binding,
    }),
    /historical global/,
  );
});
