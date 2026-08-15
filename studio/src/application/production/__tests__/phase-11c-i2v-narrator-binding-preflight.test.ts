/**
 * Phase 11C — I2V narrator_female binding preflight (no write, no provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { hashVoiceSecret } from "../phase-11c-voice-secret-locator";
import {
  PHASE_11C_PROJECT_ID,
  PHASE_11C_VOICE_CAPABILITY_FLAG_ENV,
  PHASE_11C_WORKSPACE_ID,
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
import { currentI2vProjectHasNarratorSelection } from "../phase-11c-voice-identity-binding";
import { syntheticLocator } from "../phase-11c-voice-identity-dry-run";
import { resolveVoiceIdentityForSegment } from "../phase-11c-voice-identity-resolver";
import { PHASE_11C_SEEDED_IDENTITY_IDS } from "../phase-11c-voice-identity-seed-apply";
import {
  PHASE_11C_EXPECTED_LIVE_VOICE_ROWS,
  PHASE_11C_I2V_CHOSEN_NARRATOR,
  PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_AUTH,
  PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_NEXT_AUTH,
  PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_VERDICT,
  PHASE_11C_I2V_NARRATOR_DECISION_SOURCE,
  assertChosenNarratorIsFemale,
  assertI2vBundleResolvedExplicitly,
  assertNoVoiceIdInBindingPayload,
  bindingPlanToProjectVoiceBinding,
  buildI2vNarratorFemaleBindingPlan,
  evaluateBindingCas,
  i2vNarratorBindingDeterministicId,
  resolveI2vVoiceOverFromPreparedBinding,
  runI2vNarratorBindingPreflightDryRun,
  simulateI2vNarratorBindingTransaction,
} from "../phase-11c-i2v-narrator-binding-preflight";

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
  const consentMap = {
    character_mei: consents.records.find((row) => row.voiceIdentityStableKey === "character_mei"),
    character_tom: consents.records.find((row) => row.voiceIdentityStableKey === "character_tom"),
    narrator_female: consents.records.find((row) => row.voiceIdentityStableKey === "narrator_female"),
    narrator_male: consents.records.find((row) => row.voiceIdentityStableKey === "narrator_male"),
  };
  return { catalog, consentMap };
}

test("11C-I2V-BIND — auth, female choice, no write, flags OFF", () => {
  const dry = runI2vNarratorBindingPreflightDryRun();
  assert.equal(dry.auth, PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_AUTH);
  assert.equal(dry.verdict, PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_VERDICT);
  assert.equal(dry.nextAuth, PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_NEXT_AUTH);
  assert.equal(dry.seedNextAuth, PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_AUTH);
  assert.equal(dry.narratorSelected, "narrator_female");
  assert.equal(dry.narratorMaleSelected, false);
  assert.equal(dry.bindingAllowed, false);
  assert.equal(dry.productionWrites, 0);
  assert.equal(dry.projectBindingsCreated, 0);
  assert.equal(dry.providerCalls, 0);
  assert.equal(dry.activeForProviderExecution, false);
  assert.equal(dry.voiceRuntime, "OFF");
  assert.equal(dry.liveBindingPresent, false);
  assert.equal(currentI2vProjectHasNarratorSelection(), false);
  assert.throws(
    () => runI2vNarratorBindingPreflightDryRun({
      env: { [PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]: "1" },
    }),
    /flag|OFF|disabled|remain/i,
  );
});

test("11C-I2V-BIND — deterministic ID is not derived from a voiceId", () => {
  const first = i2vNarratorBindingDeterministicId();
  const second = i2vNarratorBindingDeterministicId();
  const plan = buildI2vNarratorFemaleBindingPlan();
  assert.equal(first, second);
  assert.equal(plan.id, first);
  assert.equal(plan.voiceIdentityId, PHASE_11C_SEEDED_IDENTITY_IDS.narrator_female);
  assert.equal(plan.workspaceId, PHASE_11C_WORKSPACE_ID);
  assert.equal(plan.projectId, PHASE_11C_PROJECT_ID);
  assert.ok(PHASE_11C_PROJECT_ID.startsWith("984507af"));
  assert.equal(plan.decisionSource, PHASE_11C_I2V_NARRATOR_DECISION_SOURCE);
  assert.equal(plan.secretLocator, "env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID");
  assert.notEqual(plan.id, plan.voiceIdentityId);
  assertNoVoiceIdInBindingPayload({
    id: plan.id,
    stableKey: plan.voiceIdentityStableKey,
    identityId: plan.voiceIdentityId,
    locator: plan.secretLocator,
    prefix: plan.voiceFingerprintPrefix,
  });
  assert.throws(() => assertNoVoiceIdInBindingPayload({ voiceId: "should-not-leak" }), /voiceId/);
});

test("11C-I2V-BIND — refuses Mei, Tom and narrator_male substitution", () => {
  assertChosenNarratorIsFemale("narrator_female");
  assert.throws(() => assertChosenNarratorIsFemale("narrator_male"), /narrator_male/);
  assert.throws(() => assertChosenNarratorIsFemale("character_mei"), /Mei/);
  assert.throws(() => assertChosenNarratorIsFemale("character_tom"), /Tom/);
  const plan = buildI2vNarratorFemaleBindingPlan();
  assert.equal(plan.narratorMaleSelected, false);
  assert.equal(plan.meiSubstituted, false);
  assert.equal(plan.tomSubstituted, false);
  assert.equal(plan.allowedContentKind, "voice_over");
});

test("11C-I2V-BIND — CAS created / existing / conflict / concurrent rollback", () => {
  const plan = buildI2vNarratorFemaleBindingPlan();
  assert.equal(evaluateBindingCas({ existing: null, desired: plan }), "created");
  assert.equal(evaluateBindingCas({
    existing: {
      id: plan.id,
      idempotencyKey: plan.idempotencyKey,
      projectId: plan.projectId,
      voiceIdentityId: plan.voiceIdentityId,
      voiceIdentityStableKey: plan.voiceIdentityStableKey,
      allowedContentKind: plan.allowedContentKind,
      secretLocator: plan.secretLocator,
    },
    desired: plan,
  }), "existing");
  assert.equal(evaluateBindingCas({
    existing: {
      id: plan.id,
      idempotencyKey: plan.idempotencyKey,
      projectId: plan.projectId,
      voiceIdentityId: PHASE_11C_SEEDED_IDENTITY_IDS.narrator_male,
      voiceIdentityStableKey: "narrator_male",
      allowedContentKind: "voice_over",
    },
    desired: plan,
  }), "conflict");
  const created = simulateI2vNarratorBindingTransaction({ existingBindings: [], desired: plan });
  const replay = simulateI2vNarratorBindingTransaction({
    existingBindings: [{
      id: plan.id,
      idempotencyKey: plan.idempotencyKey,
      projectId: plan.projectId,
      voiceIdentityId: plan.voiceIdentityId,
      voiceIdentityStableKey: plan.voiceIdentityStableKey,
      allowedContentKind: plan.allowedContentKind,
      secretLocator: plan.secretLocator,
    }],
    desired: plan,
  });
  const concurrent = simulateI2vNarratorBindingTransaction({
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
        voiceIdentityId: PHASE_11C_SEEDED_IDENTITY_IDS.narrator_male,
        voiceIdentityStableKey: "narrator_male",
        allowedContentKind: "voice_over",
      },
    ],
    desired: plan,
  });
  assert.equal(created.outcome, "created");
  assert.equal(replay.outcome, "existing");
  assert.equal(concurrent.outcome, "rollback");
  assert.equal(created.productionWrites, 0);
  assert.equal(replay.projectBindingsCreated, 0);
});

test("11C-I2V-BIND — dry-run fingerprint is stable and live rows stay 4/4/0", () => {
  const first = runI2vNarratorBindingPreflightDryRun();
  const second = runI2vNarratorBindingPreflightDryRun();
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/);
  assert.deepEqual(first.liveRows, {
    voice_identities: 4,
    voice_consent_attestations: 4,
    project_voice_bindings: 0,
    providerActiveIdentities: 0,
  });
  assert.deepEqual(PHASE_11C_EXPECTED_LIVE_VOICE_ROWS, first.liveRows);
  assert.throws(
    () => runI2vNarratorBindingPreflightDryRun({ liveBindingCount: 1 }),
    /live binding/,
  );
});

test("11C-I2V-BIND — resolver uses explicit female binding, never fallback or substitution", () => {
  const { catalog, consentMap } = seededResolverInputs();
  const plan = buildI2vNarratorFemaleBindingPlan();
  const binding = bindingPlanToProjectVoiceBinding(plan);
  const resolved = resolveI2vVoiceOverFromPreparedBinding({
    identities: catalog.identities,
    consents: consentMap,
    binding,
  });
  assert.equal(resolved.stableKey, PHASE_11C_I2V_CHOSEN_NARRATOR);
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
    () => resolveVoiceIdentityForSegment({
      workspaceId: PHASE_11C_WORKSPACE_ID,
      projectId: PHASE_11C_PROJECT_ID,
      spokenKind: "voice_over",
      speakerKind: "narrator",
      identities: catalog.identities,
      consents: consentMap,
      narratorChoices: ["character_mei"],
    }),
    /Mei/,
  );
  assert.throws(
    () => resolveVoiceIdentityForSegment({
      workspaceId: PHASE_11C_WORKSPACE_ID,
      projectId: PHASE_11C_PROJECT_ID,
      spokenKind: "voice_over",
      speakerKind: "narrator",
      identities: catalog.identities,
      consents: consentMap,
      narratorChoices: ["character_tom"],
    }),
    /Tom/,
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

test("11C-I2V-BIND — I2V bundle is explicit, not the mixed active pointers", () => {
  const bundle = assertI2vBundleResolvedExplicitly();
  assert.equal(bundle.projectIdPrefix, "984507af");
  assert.equal(bundle.scriptIdPrefix, "349e2792");
  assert.equal(bundle.spokenKind, "voice_over");
  assert.equal(bundle.segmentId, "segment-2");
  assert.equal(bundle.charCount, 81);
  assert.equal(bundle.textHashPrefix, "f228654f");
  assert.equal(bundle.i2vGenerationPlanIdPrefix, "3d1858eb");
  assert.equal(bundle.i2vGenerationPlanRevision, 3);
  assert.equal(bundle.activeGenerationPlanIdPrefix, "a55bd426");
  assert.equal(bundle.usedMixedActivePointers, false);
  assert.equal(bundle.i2vPlanActivated, false);
  assert.equal(bundle.videoIdPrefix, "9be6cb0c");
});
