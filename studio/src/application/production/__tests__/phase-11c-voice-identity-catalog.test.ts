/**
 * Phase 11C — Voice identity catalog, selection rules, consent, plan (fakes only).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { hashVoiceSecret } from "../phase-11c-voice-secret-locator";
import {
  PHASE_11C_VOICE_CAPABILITY_FLAG_ENV,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_WORKSPACE_ID,
  assertPhase11CVoiceFlagsRemainOff,
} from "../phase-11c-voice-allowlist";
import {
  HISTORICAL_GLOBAL_VOICE_LOCATOR,
  PHASE_11C_VOICE_IDENTITY_AUTH,
  PHASE_11C_VOICE_IDENTITY_MIGRATION,
  PHASE_11C_VOICE_IDENTITY_NEXT_AUTH,
  PHASE_11C_VOICE_IDENTITY_VERDICT_MISSING,
  PHASE_11C_VOICE_IDENTITY_VERDICT_READY,
  VOICE_IDENTITY_LOCATORS,
  VOICE_IDENTITY_STABLE_KEYS,
  assertDistinctVoiceFingerprints,
  buildVoiceIdentityCatalog,
  decideVoiceIdentityCatalogVerdict,
  inspectHistoricalGlobalVoice,
  redactVoiceIdentityError,
} from "../phase-11c-voice-identity-catalog";
import {
  assertVoiceIdentityConsentAdmissible,
  createVoiceIdentityConsentStore,
  persistVoiceIdentityConsent,
} from "../phase-11c-voice-identity-consent";
import {
  activeNarratorBinding,
  createProjectVoiceBindingStore,
  currentI2vProjectHasNarratorSelection,
  persistProjectVoiceBinding,
} from "../phase-11c-voice-identity-binding";
import {
  assertNoHistoricalGlobalFallback,
  resolveVoiceIdentityForSegment,
  verifyResolvedFingerprint,
} from "../phase-11c-voice-identity-resolver";
import {
  assertNoVoiceIdInPlan,
  buildVoiceIdentityPlanRef,
  fingerprintVoiceIdentityPlan,
  voiceIdentityPlanIsStale,
} from "../phase-11c-voice-identity-plan";
import { runVoiceIdentityCatalogDryRun, syntheticLocator } from "../phase-11c-voice-identity-dry-run";
import { PHASE_11C_CANONICAL_SCRIPT_ID } from "../phase-11c-spoken-segment";
import {
  applyNarratorSelection,
  buildVoiceNarratorSelectorView,
} from "../../../app/director/_components/voice-narrator-selector-view";

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

const WHEN = "2026-08-15T18:00:00.000Z";

function seededCatalog() {
  const catalog = buildVoiceIdentityCatalog({ env: {}, resolutions: RESOLUTIONS });
  const consents = createVoiceIdentityConsentStore();
  for (const key of VOICE_IDENTITY_STABLE_KEYS) {
    persistVoiceIdentityConsent(consents, {
      id: `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee${key === "character_mei" ? "1" : key === "character_tom" ? "2" : key === "narrator_female" ? "3" : "4"}`,
      voiceIdentityStableKey: key,
      createdAt: WHEN,
      idempotencyKey: `consent-${key}`,
    });
  }
  const consentMap = {
    character_mei: consents.records.find((row) => row.voiceIdentityStableKey === "character_mei"),
    character_tom: consents.records.find((row) => row.voiceIdentityStableKey === "character_tom"),
    narrator_female: consents.records.find((row) => row.voiceIdentityStableKey === "narrator_female"),
    narrator_male: consents.records.find((row) => row.voiceIdentityStableKey === "narrator_male"),
  };
  return { catalog, consents, consentMap };
}

test("11C-ID — auth, flags OFF, verdicts, no execution", () => {
  assert.equal(PHASE_11C_VOICE_IDENTITY_AUTH, "AUTH_11C_VOICE_IDENTITY_CATALOG_AND_BINDING_MIGRATION_PREP");
  assert.equal(PHASE_11C_VOICE_IDENTITY_NEXT_AUTH, "AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT");
  assert.equal(PHASE_11C_VOICE_IDENTITY_MIGRATION, "20260815182203_vhs_11c_voice_identity_catalog.sql");
  assertPhase11CVoiceFlagsRemainOff({});
  assert.throws(
    () => assertPhase11CVoiceFlagsRemainOff({ [PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]: "1" }),
    /OFF/,
  );
  assert.equal(currentI2vProjectHasNarratorSelection(), false);
});

test("11C-ID — 1/2 four keys and four distinct fingerprints", () => {
  const { catalog } = seededCatalog();
  assert.deepEqual(Object.keys(catalog.identities), [...VOICE_IDENTITY_STABLE_KEYS]);
  const fps = VOICE_IDENTITY_STABLE_KEYS.map((key) => catalog.identities[key].voiceFingerprint);
  assert.equal(new Set(fps).size, 4);
  assert.equal(decideVoiceIdentityCatalogVerdict(catalog), PHASE_11C_VOICE_IDENTITY_VERDICT_READY);
  assert.equal(catalog.executionAuthorized, false);
  assert.equal(catalog.providerCallAllowed, false);
  assert.equal(catalog.productionPersisted, false);
});

test("11C-ID — 3/4/5/6 role guards Mei/Tom/narrators", () => {
  const { catalog, consentMap } = seededCatalog();
  assert.equal(catalog.identities.character_mei.usableAsNarrator, false);
  assert.equal(catalog.identities.character_tom.usableAsNarrator, false);
  assert.equal(catalog.identities.narrator_female.usableAsCharacterDialogue, false);
  assert.equal(catalog.identities.narrator_male.usableAsCharacterDialogue, false);
  assert.throws(
    () =>
      resolveVoiceIdentityForSegment({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: PHASE_11C_PROJECT_ID,
        spokenKind: "voice_over",
        speakerKind: "narrator",
        identities: catalog.identities,
        consents: consentMap,
        narratorChoices: ["character_mei"],
      }),
    /Mei cannot be used as narrator/,
  );
  assert.throws(
    () =>
      resolveVoiceIdentityForSegment({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: PHASE_11C_PROJECT_ID,
        spokenKind: "voice_over",
        speakerKind: "narrator",
        identities: catalog.identities,
        consents: consentMap,
        narratorChoices: ["character_tom"],
      }),
    /Tom cannot be used as narrator/,
  );
  assert.throws(
    () =>
      persistProjectVoiceBinding(createProjectVoiceBindingStore(), {
        id: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
        bindingRole: "character",
        voiceIdentityStableKey: "narrator_female",
        selectedBy: "christian",
        createdAt: WHEN,
        idempotencyKey: "bad-female-as-mei",
        expectedRevision: 0,
      }),
    /narrator identity cannot speak as a character/,
  );
  assert.throws(
    () =>
      persistProjectVoiceBinding(createProjectVoiceBindingStore(), {
        id: "cccccccc-dddd-4eee-8fff-000000000000",
        bindingRole: "character",
        voiceIdentityStableKey: "narrator_male",
        selectedBy: "christian",
        createdAt: WHEN,
        idempotencyKey: "bad-male-as-tom",
        expectedRevision: 0,
      }),
    /narrator identity cannot speak as a character/,
  );
});

test("11C-ID — 7/8/9/10 dialogue and voice-over resolution", () => {
  const { catalog, consentMap } = seededCatalog();
  const mei = resolveVoiceIdentityForSegment({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    spokenKind: "dialogue",
    speakerKind: "character",
    characterId: "mei",
    identities: catalog.identities,
    consents: consentMap,
  });
  const tom = resolveVoiceIdentityForSegment({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    spokenKind: "dialogue",
    speakerKind: "character",
    characterId: "tom",
    identities: catalog.identities,
    consents: consentMap,
  });
  const female = resolveVoiceIdentityForSegment({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    spokenKind: "voice_over",
    speakerKind: "narrator",
    identities: catalog.identities,
    consents: consentMap,
    narratorChoices: ["narrator_female"],
  });
  const male = resolveVoiceIdentityForSegment({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    spokenKind: "voice_over",
    speakerKind: "narrator",
    identities: catalog.identities,
    consents: consentMap,
    narratorChoices: ["narrator_male"],
  });
  assert.equal(mei.stableKey, "character_mei");
  assert.equal(tom.stableKey, "character_tom");
  assert.equal(female.stableKey, "narrator_female");
  assert.equal(male.stableKey, "narrator_male");
  assert.equal(mei.executionAuthorized, false);
  assert.equal(female.providerCallAllowed, false);
});

test("11C-ID — 11/12/13/14 missing choice, double choice, other workspace/project", () => {
  const { catalog, consentMap } = seededCatalog();
  assert.throws(
    () =>
      resolveVoiceIdentityForSegment({
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
    () =>
      resolveVoiceIdentityForSegment({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: PHASE_11C_PROJECT_ID,
        spokenKind: "voice_over",
        speakerKind: "narrator",
        identities: catalog.identities,
        consents: consentMap,
        narratorChoices: ["narrator_female", "narrator_male"],
      }),
    /multiple narrator/,
  );
  assert.throws(
    () =>
      resolveVoiceIdentityForSegment({
        workspaceId: "00000000-0000-4000-8000-000000000099",
        projectId: PHASE_11C_PROJECT_ID,
        spokenKind: "dialogue",
        speakerKind: "character",
        characterId: "mei",
        identities: catalog.identities,
        consents: consentMap,
      }),
    /workspace not in scope/,
  );
  assert.throws(
    () =>
      resolveVoiceIdentityForSegment({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: "00000000-0000-4000-8000-000000000098",
        spokenKind: "dialogue",
        speakerKind: "character",
        characterId: "mei",
        identities: catalog.identities,
        consents: consentMap,
      }),
    /project not in scope/,
  );
});

test("11C-ID — 15/16/17/18 consent, locator, mismatch, no global fallback", () => {
  const { catalog, consentMap, consents } = seededCatalog();
  assert.throws(
    () =>
      resolveVoiceIdentityForSegment({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: PHASE_11C_PROJECT_ID,
        spokenKind: "dialogue",
        speakerKind: "character",
        characterId: "mei",
        identities: catalog.identities,
        consents: {},
      }),
    /attestation is missing/,
  );
  persistVoiceIdentityConsent(consents, {
    id: "dddddddd-eeee-4fff-8aaa-bbbbbbbbbbbb",
    voiceIdentityStableKey: "narrator_female",
    createdAt: WHEN,
    idempotencyKey: "consent-narrator_female-revoked",
    decision: "revoked",
    revokedAt: WHEN,
  });
  assert.throws(
    () => assertVoiceIdentityConsentAdmissible(consents.records.at(-1), "narrator_female"),
    /revoked/,
  );
  const missing = buildVoiceIdentityCatalog({
    env: {},
    resolutions: {
      ...RESOLUTIONS,
      narrator_female: {
        locator: VOICE_IDENTITY_LOCATORS.narrator_female,
        present: false,
        fingerprint: null,
        fingerprintPrefix: null,
        valueExposed: false,
      },
    },
  });
  assert.equal(decideVoiceIdentityCatalogVerdict(missing), PHASE_11C_VOICE_IDENTITY_VERDICT_MISSING);
  assert.throws(
    () =>
      resolveVoiceIdentityForSegment({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: PHASE_11C_PROJECT_ID,
        spokenKind: "voice_over",
        speakerKind: "narrator",
        identities: missing.identities,
        consents: consentMap,
        narratorChoices: ["narrator_female"],
      }),
    /locator is absent/,
  );
  assert.throws(
    () =>
      verifyResolvedFingerprint({
        expectedFingerprint: FP.narrator_female,
        configuredFingerprint: FP.narrator_male,
      }),
    /fingerprint mismatch/,
  );
  assert.throws(() => assertNoHistoricalGlobalFallback(HISTORICAL_GLOBAL_VOICE_LOCATOR), /fallback is forbidden/);
  const historical = inspectHistoricalGlobalVoice({
    env: { ELEVENLABS_VOICE_ID: "synthetic-mei-voice-fixture" },
    meiFingerprint: FP.character_mei,
  });
  assert.equal(historical.matchesMei, true);
  assert.equal(historical.usableAsFallback, false);
});

test("11C-ID — 19/20/21 new revision, stale plan, no generate on select", () => {
  const { catalog, consentMap } = seededCatalog();
  const store = createProjectVoiceBindingStore();
  const first = persistProjectVoiceBinding(store, {
    id: "eeeeeeee-ffff-4aaa-8bbb-cccccccccccc",
    bindingRole: "narrator",
    voiceIdentityStableKey: "narrator_female",
    selectedBy: "christian",
    createdAt: WHEN,
    idempotencyKey: "bind-female",
    expectedRevision: 0,
  });
  assert.equal(first.result, "created");
  const replay = persistProjectVoiceBinding(store, {
    id: "eeeeeeee-ffff-4aaa-8bbb-cccccccccccc",
    bindingRole: "narrator",
    voiceIdentityStableKey: "narrator_female",
    selectedBy: "christian",
    createdAt: WHEN,
    idempotencyKey: "bind-female",
    expectedRevision: 0,
  });
  assert.equal(replay.result, "existing");
  const second = persistProjectVoiceBinding(store, {
    id: "ffffffff-aaaa-4bbb-8ccc-dddddddddddd",
    bindingRole: "narrator",
    voiceIdentityStableKey: "narrator_male",
    selectedBy: "christian",
    createdAt: WHEN,
    idempotencyKey: "bind-male",
    expectedRevision: 1,
  });
  assert.equal(second.result, "created");
  assert.equal(second.binding.revision, 2);
  assert.equal(store.records[0].status, "superseded");
  assert.equal(activeNarratorBinding(store, {
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
    scriptRevision: 1,
  })?.voiceIdentityStableKey, "narrator_male");
  assert.throws(
    () =>
      persistProjectVoiceBinding(store, {
        id: "99999999-aaaa-4bbb-8ccc-dddddddddddd",
        bindingRole: "narrator",
        voiceIdentityStableKey: "narrator_female",
        selectedBy: "christian",
        createdAt: WHEN,
        idempotencyKey: "bind-conflict",
        expectedRevision: 0,
      }),
    /optimistic lock/,
  );

  const female = resolveVoiceIdentityForSegment({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    spokenKind: "voice_over",
    speakerKind: "narrator",
    identities: catalog.identities,
    consents: consentMap,
    narratorChoices: ["narrator_female"],
  });
  const plan = buildVoiceIdentityPlanRef({
    resolution: female,
    bindingId: first.binding.id,
    consentAttestationId: consentMap.narrator_female?.id ?? null,
    scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
    scriptRevision: 1,
    segmentId: "segment-2",
    spokenKind: "voice_over",
    speaker: "narrator",
    selectionRevision: 1,
  });
  assert.equal(voiceIdentityPlanIsStale({ plan, narratorStableKey: "narrator_male", selectionRevision: 2 }), true);
  assert.equal(plan.autoGenerate, false);
  assertNoVoiceIdInPlan(plan);
  const view = buildVoiceNarratorSelectorView();
  const applied = applyNarratorSelection(view, "narrator_female");
  assert.equal(applied.generated, false);
  assert.equal(applied.persisted, false);
  assert.equal(applied.view.generatesOnSelect, false);
});

test("11C-ID — 22/23/24/25 no provider, no Production write, RLS static, redaction", () => {
  const dry = runVoiceIdentityCatalogDryRun({ resolutions: RESOLUTIONS });
  assert.equal(dry.meiDialogue, "character_mei");
  assert.equal(dry.tomDialogue, "character_tom");
  assert.equal(dry.voiceOverFemale, "narrator_female");
  assert.equal(dry.voiceOverMale, "narrator_male");
  assert.equal(dry.voiceOverWithoutChoiceBlocked, true);
  assert.equal(dry.collisionBlocked, true);
  assert.equal(dry.providerCalls, 0);
  assert.equal(dry.productionWrites, 0);
  assert.equal(dry.voiceIdExposed, false);
  assert.equal(dry.autoGenerate, false);
  assert.notEqual(dry.femalePlanFingerprint, dry.malePlanFingerprint);
  assert.equal(dry.selectionChangeCreatesNewFingerprint, true);
  assert.throws(
    () =>
      assertDistinctVoiceFingerprints([
        { key: "character_mei", fingerprint: FP.character_mei },
        { key: "narrator_female", fingerprint: FP.character_mei },
      ]),
    /collision/,
  );
  const redacted = redactVoiceIdentityError("xi-api-key=secret syntheticVoiceTokenABCDEF");
  assert.match(redacted, /redacted/);
  assert.doesNotMatch(redacted, /syntheticVoiceTokenABCDEF/);
  const femalePlan = fingerprintVoiceIdentityPlan(
    buildVoiceIdentityPlanRef({
      resolution: {
        stableKey: "narrator_female",
        role: "narrator",
        locator: VOICE_IDENTITY_LOCATORS.narrator_female,
        expectedFingerprint: FP.narrator_female,
        expectedFingerprintPrefix: FP.narrator_female.slice(0, 12),
        executionAuthorized: false,
        providerCallAllowed: false,
        usedHistoricalGlobalFallback: false,
      },
      scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
      scriptRevision: 1,
      segmentId: "segment-2",
      spokenKind: "voice_over",
      speaker: "narrator",
      selectionRevision: 1,
    }),
  );
  assert.match(femalePlan, /^[0-9a-f]{64}$/);
});
