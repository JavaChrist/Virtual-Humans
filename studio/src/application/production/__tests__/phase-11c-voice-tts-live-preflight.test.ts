/**
 * Phase 11C — Voice/TTS live preflight (disabled, no provider, no mutation).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { hashVoiceSecret } from "../phase-11c-voice-secret-locator";
import {
  PHASE_11C_LIVE_BUDGET,
  PHASE_11C_MODEL,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_VOICE_CAPABILITY_FLAG_ENV,
  PHASE_11C_VOICE_PAID_FLAG_ENV,
  assertVhs11CVoiceAllowlistScope,
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
import {
  createPhase11CVoiceJobState,
  persistPhase11CVoiceSubmitIntent,
  recordPhase11CVoiceSyntheticCompletion,
} from "../phase-11c-voice-worker";
import { checksumPhase11CVoiceBuffer } from "../phase-11c-voice-ingest";
import {
  PHASE_11C_BOUND_NARRATOR_BINDING_ID,
  PHASE_11C_I2V_NARRATOR_BINDING_APPLY_NEXT_AUTH,
} from "../phase-11c-i2v-narrator-binding-apply";
import {
  bindingPlanToProjectVoiceBinding,
  buildI2vNarratorFemaleBindingPlan,
  resolveI2vVoiceOverFromPreparedBinding,
} from "../phase-11c-i2v-narrator-binding-preflight";
import {
  PHASE_11C_FUTURE_FLAG_CLOSE_ORDER,
  PHASE_11C_FUTURE_FLAG_OPEN_ORDER,
  PHASE_11C_INSPECTED_PRODUCTION_SHA,
  PHASE_11C_REQUIRED_BINDING_APPLY_COMMIT,
  PHASE_11C_REQUIRED_WIRING_COMMIT,
  PHASE_11C_VERIFIED_LIVE_VOICE_FACTS,
  PHASE_11C_VOICE_PRICING_INTERNAL_USD_PER_1K,
  PHASE_11C_VOICE_PRICING_PUBLIC_RETRIEVED_ON,
  PHASE_11C_VOICE_PRICING_PUBLIC_USD_PER_1K,
  PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_AUTH,
  PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_NEXT_AUTH,
  PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_READY_VERDICT,
  assertPhase11CFutureActivationStaysClosed,
  assertPhase11CStopsBeforeProviderCall,
  assertPhase11CWiredModelUnchanged,
  auditPhase11CExecutionActivationContract,
  buildPhase11CBoundNarratorVoiceReference,
  decidePhase11CVoiceTtsLivePreflightVerdict,
  estimatePhase11CVoiceLivePreflightPricing,
  fingerprintPhase11CVoiceTtsLivePreflight,
  recommendPhase11CVoiceBudgetHardLimit,
  refusePhase11CHistoricalVoiceFallback,
  refusePhase11CIncoherentActivePointers,
  refusePhase11CNarratorSubstitution,
  resolvePhase11CLiveVoiceOverFromFacts,
  runPhase11CVoiceTtsLivePreflightNoProvider,
} from "../phase-11c-voice-tts-live-preflight";

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

test("11C-TTS-LIVE — auth, READY, flags OFF, counters zero, replay stable", () => {
  const { catalog, consentMap } = seededResolverInputs();
  const first = runPhase11CVoiceTtsLivePreflightNoProvider({
    identities: catalog.identities,
    consents: consentMap,
  });
  const second = runPhase11CVoiceTtsLivePreflightNoProvider({
    identities: catalog.identities,
    consents: consentMap,
  });
  assert.equal(first.auth, PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_AUTH);
  assert.equal(first.previousAuth, PHASE_11C_I2V_NARRATOR_BINDING_APPLY_NEXT_AUTH);
  assert.equal(first.verdict, PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_READY_VERDICT);
  assert.equal(first.nextAuth, PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_NEXT_AUTH);
  assert.equal(first.sourceAdmissible, true);
  assert.equal(first.narratorSelected, "narrator_female");
  assert.equal(first.narratorMaleSelected, false);
  assert.equal(first.meiSubstituted, false);
  assert.equal(first.tomSubstituted, false);
  assert.equal(first.consentAdmissible, true);
  assert.equal(first.providerMode, "disabled");
  assert.equal(first.providerCallAllowed, false);
  assert.equal(first.mutationAllowed, false);
  assert.equal(first.reservationCreated, false);
  assert.equal(first.runCreated, false);
  assert.equal(first.jobCreated, false);
  assert.equal(first.attemptCreated, false);
  assert.equal(first.outputCreated, false);
  assert.equal(first.rawVoiceIdResolved, false);
  assert.equal(first.signedUrlCount, 0);
  assert.equal(first.elevenLabsCalls, 0);
  assert.equal(first.otherProviderCalls, 0);
  assert.equal(first.mediaReads, 0);
  assert.equal(first.mediaWrites, 0);
  assert.equal(first.budgetWrites, 0);
  assert.equal(first.flagsWritten, 0);
  assert.equal(first.productionWrites, 0);
  assert.equal(first.phaseCost, 0);
  assert.equal(first.voiceRuntime, "OFF");
  assert.equal(first.videoActive, false);
  assert.equal(first.videoPublished, false);
  assert.equal(first.activationMechanism, "C");
  assert.equal(first.catalogExecutionStaysFalse, true);
  assert.equal(first.modelId, PHASE_11C_MODEL);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(fingerprintPhase11CVoiceTtsLivePreflight(first), first.fingerprint);
  assert.equal(first.futurePlan.ttsCalls, 1);
  assert.equal(first.futurePlan.retries, 0);
  assert.equal(first.futurePlan.lipsync, false);
  assert.equal(first.futurePlan.outputLifecycle, "pending_review");
  assert.throws(
    () => runPhase11CVoiceTtsLivePreflightNoProvider({
      env: { [PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]: "1" },
    }),
    /flag|OFF|disabled|remain/i,
  );
  assert.throws(
    () => runPhase11CVoiceTtsLivePreflightNoProvider({
      env: { [PHASE_11C_VOICE_PAID_FLAG_ENV]: "1" },
    }),
    /flag|OFF|disabled|remain/i,
  );
});

test("11C-TTS-LIVE — live facts, binding female, model, deployment SHA", () => {
  const facts = PHASE_11C_VERIFIED_LIVE_VOICE_FACTS;
  assert.equal(facts.bindings, 1);
  assert.equal(facts.identities, 4);
  assert.equal(facts.consents, 4);
  assert.equal(facts.providerActiveIdentities, 0);
  assert.equal(facts.bindingId, PHASE_11C_BOUND_NARRATOR_BINDING_ID);
  assert.ok(facts.bindingId.startsWith("e3a1cc87"));
  assert.ok(facts.identityId.startsWith("bc1c8046"));
  assert.ok(PHASE_11C_PROJECT_ID.startsWith("984507af"));
  assert.equal(facts.locator, "env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID");
  assert.equal(facts.fingerprintPrefix, "99db51be34bc");
  assert.equal(facts.consentScope, "workspace_voice_over");
  assert.equal(facts.activeForProviderExecution, false);
  assert.equal(facts.modelId, "eleven_multilingual_v2");
  assert.equal(facts.deploymentSha, PHASE_11C_INSPECTED_PRODUCTION_SHA);
  assert.equal(PHASE_11C_REQUIRED_WIRING_COMMIT, "770e844");
  assert.equal(PHASE_11C_REQUIRED_BINDING_APPLY_COMMIT, "abaec84");
  assert.equal(facts.includesWiringCommit, true);
  assert.equal(facts.includesBindingCommit, true);
  assert.equal(facts.manualDeploy, false);
  assertPhase11CWiredModelUnchanged(PHASE_11C_MODEL);
  assert.throws(() => assertPhase11CWiredModelUnchanged("eleven_flash_v2"), /eleven_multilingual_v2/);
});

test("11C-TTS-LIVE — pricing internal catalogue, public corroboration, budget sufficient", () => {
  const pricing = estimatePhase11CVoiceLivePreflightPricing({
    characterCount: 81,
    availableMinor: PHASE_11C_LIVE_BUDGET.available,
  });
  assert.equal(pricing.units, "characters");
  assert.equal(pricing.internalUsdPer1k, PHASE_11C_VOICE_PRICING_INTERNAL_USD_PER_1K);
  assert.equal(pricing.publicUsdPer1k, PHASE_11C_VOICE_PRICING_PUBLIC_USD_PER_1K);
  assert.equal(pricing.publicRetrievedOn, PHASE_11C_VOICE_PRICING_PUBLIC_RETRIEVED_ON);
  assert.equal(pricing.chosenSource, "internal_versioned_catalogue");
  assert.equal(pricing.estimateMinor, 1);
  assert.equal(pricing.capMinor, 2);
  assert.equal(pricing.marginMinor, 1);
  assert.equal(pricing.availableMinor, 48);
  assert.equal(pricing.budgetSufficient, true);
  assert.equal(pricing.firm, false);
  assert.equal(pricing.planKnown, false);
  assert.equal(pricing.personalPlanMarginalCostKnown, false);
  assert.equal(pricing.subscriptionInclusionUnproven, true);
  assert.equal(pricing.demonstratedUsd, null);
  assert.equal(pricing.reservationCreated, false);
  const unknown = estimatePhase11CVoiceLivePreflightPricing({
    characterCount: 81,
    availableMinor: 48,
    pricingContractPresent: false,
  });
  assert.equal(unknown.capMinor, 0);
  const short = estimatePhase11CVoiceLivePreflightPricing({
    characterCount: 81,
    availableMinor: 1,
  });
  assert.equal(short.budgetSufficient, false);
  assert.equal(short.shortfallMinor, 1);
  const rec = recommendPhase11CVoiceBudgetHardLimit({
    committed: 389,
    reserved: 0,
    capMinor: 2,
  });
  assert.equal(rec.minimalHard, 391);
  assert.equal(rec.prudentHard, 401);
});

test("11C-TTS-LIVE — activation contract C, catalog stays false", () => {
  const contract = auditPhase11CExecutionActivationContract();
  assert.equal(contract.selected, "C");
  assert.equal(contract.A.supported, false);
  assert.equal(contract.B.supported, false);
  assert.equal(contract.C.supported, true);
  assert.equal(contract.D.supported, false);
  assert.equal(contract.catalogColumnMustStayFalse, true);
  assert.equal(contract.thisGateActivates, false);
  assertPhase11CFutureActivationStaysClosed({
    activeForProviderExecution: false,
    flagsOpened: false,
    identityUpdated: false,
    bindingUpdated: false,
  });
  assert.throws(
    () => assertPhase11CFutureActivationStaysClosed({
      activeForProviderExecution: true,
      flagsOpened: false,
      identityUpdated: false,
      bindingUpdated: false,
    }),
    /activation must stay closed/,
  );
  assert.equal(PHASE_11C_FUTURE_FLAG_CLOSE_ORDER[0], PHASE_11C_FUTURE_FLAG_OPEN_ORDER[PHASE_11C_FUTURE_FLAG_OPEN_ORDER.length - 1]);
});

test("11C-TTS-LIVE — resolver female via binding, refuse male/Mei/Tom/historical", () => {
  const { catalog, consentMap } = seededResolverInputs();
  const resolved = resolvePhase11CLiveVoiceOverFromFacts({
    identities: catalog.identities,
    consents: consentMap,
  });
  assert.equal(resolved.stableKey, "narrator_female");
  assert.equal(resolved.executionAuthorized, false);
  assert.equal(resolved.providerCallAllowed, false);
  assert.equal(resolved.usedHistoricalGlobalFallback, false);
  assert.throws(() => refusePhase11CNarratorSubstitution("narrator_male"), /narrator_male/);
  assert.throws(() => refusePhase11CNarratorSubstitution("character_mei"), /Mei/);
  assert.throws(() => refusePhase11CNarratorSubstitution("character_tom"), /Tom/);
  assert.throws(() => refusePhase11CHistoricalVoiceFallback(HISTORICAL_GLOBAL_VOICE_LOCATOR), /historical|fallback/i);
  const binding = bindingPlanToProjectVoiceBinding(buildI2vNarratorFemaleBindingPlan());
  assert.throws(
    () => resolveI2vVoiceOverFromPreparedBinding({
      identities: catalog.identities,
      consents: consentMap,
      binding: { ...binding, voiceIdentityStableKey: "narrator_male" },
    }),
    /narrator_male/,
  );
  assert.throws(
    () => resolveVoiceIdentityForSegment({
      workspaceId: catalog.identities.narrator_female.workspaceId,
      projectId: PHASE_11C_PROJECT_ID,
      spokenKind: "voice_over",
      speakerKind: "narrator",
      identities: catalog.identities,
      consents: consentMap,
    }),
    /explicit narrator|choice/i,
  );
  refusePhase11CIncoherentActivePointers();
});

test("11C-TTS-LIVE — consent revoked/absent and identity unavailable refused", () => {
  const { catalog, consentMap } = seededResolverInputs();
  assert.throws(
    () => resolvePhase11CLiveVoiceOverFromFacts({
      identities: catalog.identities,
      consents: { ...consentMap, narrator_female: undefined },
    }),
    /missing|attestation/i,
  );
  const revoked = { ...consentMap.narrator_female!, decision: "revoked" as const, revokedAt: "2026-08-16T00:00:00.000Z" };
  assert.throws(
    () => resolvePhase11CLiveVoiceOverFromFacts({
      identities: catalog.identities,
      consents: { ...consentMap, narrator_female: revoked },
    }),
    /revoked/i,
  );
  const unavailable = {
    ...catalog.identities,
    narrator_female: { ...catalog.identities.narrator_female, status: "unavailable" as const },
  };
  assert.throws(
    () => resolvePhase11CLiveVoiceOverFromFacts({
      identities: unavailable,
      consents: consentMap,
    }),
    /absent|unavailable/i,
  );
});

test("11C-TTS-LIVE — verdicts blocked for deploy, pricing, budget, activation, drift", () => {
  const ready = runPhase11CVoiceTtsLivePreflightNoProvider();
  const activation = auditPhase11CExecutionActivationContract();
  assert.equal(
    decidePhase11CVoiceTtsLivePreflightVerdict({
      facts: { ...PHASE_11C_VERIFIED_LIVE_VOICE_FACTS, includesWiringCommit: false },
      pricing: ready.pricing,
      activation,
      providerMode: "disabled",
      mutationAllowed: false,
    }),
    "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_DEPLOYMENT_NOT_READY",
  );
  assert.equal(
    decidePhase11CVoiceTtsLivePreflightVerdict({
      facts: { ...PHASE_11C_VERIFIED_LIVE_VOICE_FACTS, pricingContractPresent: false },
      pricing: { ...ready.pricing, capMinor: 0 },
      activation,
      providerMode: "disabled",
      mutationAllowed: false,
    }),
    "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_PRICING_CONTRACT",
  );
  assert.equal(
    decidePhase11CVoiceTtsLivePreflightVerdict({
      facts: {
        ...PHASE_11C_VERIFIED_LIVE_VOICE_FACTS,
        budget: { ...PHASE_11C_LIVE_BUDGET, available: 1 },
      },
      pricing: { ...ready.pricing, budgetSufficient: false, availableMinor: 1, shortfallMinor: 1 },
      activation,
      providerMode: "disabled",
      mutationAllowed: false,
    }),
    "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_PENDING_BUDGET_AUTH",
  );
  assert.equal(
    decidePhase11CVoiceTtsLivePreflightVerdict({
      facts: PHASE_11C_VERIFIED_LIVE_VOICE_FACTS,
      pricing: ready.pricing,
      activation: { ...activation, selected: "C", C: { ...activation.C, supported: false } },
      providerMode: "disabled",
      mutationAllowed: false,
    }),
    "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_EXECUTION_ACTIVATION_CONTRACT_REQUIRED",
  );
  assert.equal(
    decidePhase11CVoiceTtsLivePreflightVerdict({
      facts: { ...PHASE_11C_VERIFIED_LIVE_VOICE_FACTS, bindings: 2 },
      pricing: ready.pricing,
      activation,
      providerMode: "disabled",
      mutationAllowed: false,
    }),
    "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_STATE_DRIFT",
  );
  const budgetBlocked = runPhase11CVoiceTtsLivePreflightNoProvider({
    facts: {
      ...PHASE_11C_VERIFIED_LIVE_VOICE_FACTS,
      budget: { ...PHASE_11C_LIVE_BUDGET, available: 1 },
    },
  });
  assert.equal(budgetBlocked.verdict, "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_PENDING_BUDGET_AUTH");
  assert.equal(budgetBlocked.nextAuth, null);
  assert.equal(budgetBlocked.recommendedHard, 401);
  assert.equal(budgetBlocked.reservationCreated, false);
});

test("11C-TTS-LIVE — retry, fallback, second submit, duplicate fingerprint refused", () => {
  assert.throws(
    () => assertVhs11CVoiceAllowlistScope({
      projectId: PHASE_11C_PROJECT_ID,
      sceneId: "scene-2",
      action: "voice",
      capabilityProfile: "audio.voice",
      providerId: "elevenlabs",
      modelId: PHASE_11C_MODEL,
      retryRequested: true,
    }),
    /forbidden|retry|fallback/i,
  );
  assert.throws(
    () => assertVhs11CVoiceAllowlistScope({
      projectId: PHASE_11C_PROJECT_ID,
      sceneId: "scene-2",
      action: "voice",
      capabilityProfile: "audio.voice",
      providerId: "elevenlabs",
      modelId: PHASE_11C_MODEL,
      fallbackRequested: true,
    }),
    /forbidden|retry|fallback/i,
  );
  const audio = {
    mimeType: "audio/mpeg" as const,
    byteLength: 8,
    checksum: checksumPhase11CVoiceBuffer(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
    persisted: true as const,
  };
  let job = persistPhase11CVoiceSubmitIntent(createPhase11CVoiceJobState());
  job = recordPhase11CVoiceSyntheticCompletion(job, audio);
  assert.throws(() => recordPhase11CVoiceSyntheticCompletion(job, audio), /second TTS|forbidden/i);
  const first = runPhase11CVoiceTtsLivePreflightNoProvider();
  const replay = runPhase11CVoiceTtsLivePreflightNoProvider();
  assert.equal(first.fingerprint, replay.fingerprint);
  assert.equal(first.idempotencyKey, replay.idempotencyKey);
  assert.notEqual(first.fingerprint, first.idempotencyKey);
});

test("11C-TTS-LIVE — no voiceId leak, no ingest, providerMode disabled", () => {
  const result = runPhase11CVoiceTtsLivePreflightNoProvider();
  const blob = JSON.stringify(result);
  assert.equal(/"voiceId"\s*:/i.test(blob), false);
  assert.equal(/sk-[A-Za-z0-9]{8,}/.test(blob), false);
  assert.equal(result.mediaWrites, 0);
  const voice = buildPhase11CBoundNarratorVoiceReference();
  assert.match(voice.voiceConfigIdRedacted, /^el-voice:\*+$/);
  assert.throws(
    () => assertPhase11CStopsBeforeProviderCall({
      rawVoiceIdResolved: true,
      signedUrlCount: 0,
      reservationCreated: false,
      runCreated: false,
      jobCreated: false,
      attemptCreated: false,
      outputCreated: false,
      elevenLabsCalls: 0,
      mediaReads: 0,
      mediaWrites: 0,
    }),
    /forbidden provider/,
  );
});
