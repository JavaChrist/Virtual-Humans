/**
 * Phase 11C — narrator binding and bounded Voice consent (fakes only, 0 provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PHASE_11C_MODEL,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_PROVIDER,
  PHASE_11C_VOICE_CAPABILITY_FLAG_ENV,
  PHASE_11C_WORKSPACE_ID,
  assertPhase11CVoiceFlagsRemainOff,
  redactPhase11CError,
} from "../phase-11c-voice-allowlist";
import {
  PHASE_11C_NARRATOR_BINDING_AUTH,
  PHASE_11C_NARRATOR_BINDING_VERDICT,
  PHASE_11C_NARRATOR_ID,
  PHASE_11C_NEXT_IDENTITY_AUTH,
  assertNarratorBindingScope,
  createNarratorBindingStore,
  persistNarratorBinding,
} from "../phase-11c-narrator-binding";
import {
  assertVoiceConsentAdmissible,
  createVoiceConsentStore,
  persistVoiceConsent,
} from "../phase-11c-voice-consent";
import {
  assertNoVoiceIdInPublicArtifact,
  evaluateLiveNarratorBindingAttempt,
  resolveExistingVoiceReferenceFromBinding,
  resolveSyntheticNarratorBinding,
} from "../phase-11c-narrator-resolver";
import {
  PHASE_11C_VOICE_SECRET_LOCATOR,
  detectCharacterVoiceCollision,
  hashVoiceSecret,
  redactVoiceSecret,
  verifyConfiguredVoiceFingerprint,
} from "../phase-11c-voice-secret-locator";

const SYNTHETIC = "synthetic-narrator-voice-fixture";
const SYNTHETIC_FP = hashVoiceSecret(SYNTHETIC);
const TOM_FP = hashVoiceSecret("synthetic-tom-voice-fixture");
const MEI_FP = hashVoiceSecret("synthetic-mei-voice-fixture");
const ACTOR = "christian";
const WHEN = "2026-08-15T16:00:00.000Z";

function seedAuthorized() {
  const bindings = createNarratorBindingStore();
  const consents = createVoiceConsentStore();
  const binding = persistNarratorBinding(bindings, {
    voiceFingerprint: SYNTHETIC_FP,
    createdBy: ACTOR,
    createdAt: WHEN,
    expectedRevision: 0,
  });
  const consent = persistVoiceConsent(consents, {
    id: "dddddddd-eeee-4fff-8aaa-bbbbbbbbbbbb",
    voiceFingerprint: SYNTHETIC_FP,
    decidedAt: WHEN,
    expectedRevision: 0,
  });
  return { bindings, consents, binding: binding.binding, consent: consent.consent };
}

test("11C-BIND — auth, flags OFF, execution disabled", () => {
  assert.equal(PHASE_11C_NARRATOR_BINDING_AUTH, "AUTH_11C_VOICE_NARRATOR_BINDING_AND_CONSENT");
  assert.equal(PHASE_11C_NARRATOR_BINDING_VERDICT, "BLOCKED_VOICE_NARRATOR_BINDING_CONFIG_UNAVAILABLE");
  assert.equal(PHASE_11C_NEXT_IDENTITY_AUTH, "AUTH_11C_VOICE_NARRATOR_IDENTITY_DECISION");
  assertPhase11CVoiceFlagsRemainOff({});
  assert.throws(
    () => assertPhase11CVoiceFlagsRemainOff({ [PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]: "1" }),
    /OFF/,
  );
});

test("11C-BIND — 1/2/3/4/5 binding narrateur, projet, voice_over, fr, provider/model", () => {
  const { binding } = seedAuthorized();
  assert.equal(binding.narratorId, PHASE_11C_NARRATOR_ID);
  assert.equal(binding.role, "narrator");
  assert.deepEqual(binding.allowedContentKinds, ["voice_over"]);
  assert.equal(binding.locale, "fr");
  assert.equal(binding.provider, PHASE_11C_PROVIDER);
  assert.equal(binding.model, PHASE_11C_MODEL);
  assert.equal(binding.workspaceId, PHASE_11C_WORKSPACE_ID);
  assert.equal(binding.projectId, PHASE_11C_PROJECT_ID);
  assert.equal(binding.activeForProviderExecution, false);
  assertNarratorBindingScope({
    workspaceId: binding.workspaceId,
    projectId: binding.projectId,
    contentKind: "voice_over",
    locale: "fr",
    provider: PHASE_11C_PROVIDER,
    model: PHASE_11C_MODEL,
  });
});

test("11C-BIND — 6/7/8/9/10 voiceId absent, fingerprint, locator, mismatch, absent", () => {
  const { binding } = seedAuthorized();
  assertNoVoiceIdInPublicArtifact(binding);
  assert.equal(binding.voiceSecretLocator, PHASE_11C_VOICE_SECRET_LOCATOR);
  assert.equal(binding.voiceFingerprint, SYNTHETIC_FP);
  const ok = verifyConfiguredVoiceFingerprint({
    locator: PHASE_11C_VOICE_SECRET_LOCATOR,
    env: { ELEVENLABS_VOICE_ID: SYNTHETIC },
    expectedFingerprint: SYNTHETIC_FP,
  });
  assert.equal(ok.present, true);
  assert.equal(ok.matches, true);
  assert.equal(ok.valueExposed, false);
  const mismatch = resolveSyntheticNarratorBinding({
    binding,
    consent: seedAuthorized().consent,
    env: { ELEVENLABS_VOICE_ID: "other-configured-voice" },
    expectedFingerprint: SYNTHETIC_FP,
  });
  assert.equal(mismatch.refuseCode, "fingerprint_mismatch");
  const absent = resolveSyntheticNarratorBinding({
    binding,
    consent: seedAuthorized().consent,
    env: {},
    expectedFingerprint: SYNTHETIC_FP,
  });
  assert.equal(absent.refuseCode, "configured_voice_absent");
});

test("11C-BIND — 11/12/13/14/15 Tom, Mei, autre projet, dialogue, autre langue", () => {
  assert.equal(detectCharacterVoiceCollision(TOM_FP, { tom: TOM_FP, mei: MEI_FP }), "tom");
  assert.equal(detectCharacterVoiceCollision(MEI_FP, { tom: TOM_FP, mei: MEI_FP }), "mei");
  assert.throws(
    () =>
      assertNarratorBindingScope({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: PHASE_11C_PROJECT_ID,
        contentKind: "voice_over",
        locale: "fr",
        provider: PHASE_11C_PROVIDER,
        model: PHASE_11C_MODEL,
        characterId: "tom",
      }),
    /Tom\/Mei/,
  );
  assert.throws(
    () =>
      assertNarratorBindingScope({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: PHASE_11C_PROJECT_ID,
        contentKind: "voice_over",
        locale: "fr",
        provider: PHASE_11C_PROVIDER,
        model: PHASE_11C_MODEL,
        characterId: "mei",
      }),
    /Tom\/Mei/,
  );
  assert.throws(
    () =>
      assertNarratorBindingScope({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: "00000000-0000-4000-8000-000000000099",
        contentKind: "voice_over",
        locale: "fr",
        provider: PHASE_11C_PROVIDER,
        model: PHASE_11C_MODEL,
      }),
    /project/,
  );
  assert.throws(
    () =>
      assertNarratorBindingScope({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: PHASE_11C_PROJECT_ID,
        contentKind: "dialogue",
        locale: "fr",
        provider: PHASE_11C_PROVIDER,
        model: PHASE_11C_MODEL,
      }),
    /voice_over/,
  );
  assert.throws(
    () =>
      assertNarratorBindingScope({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: PHASE_11C_PROJECT_ID,
        contentKind: "voice_over",
        locale: "en",
        provider: PHASE_11C_PROVIDER,
        model: PHASE_11C_MODEL,
      }),
    /locale/,
  );
});

test("11C-BIND — 16/17/18/19/20 consentement présent, contradictoire, révoqué, non global, no clone", () => {
  const { consent } = seedAuthorized();
  assertVoiceConsentAdmissible(consent);
  assert.equal(consent.globalConsent, false);
  assert.equal(consent.cloningAuthorized, false);
  const revokedStore = createVoiceConsentStore();
  const revoked = persistVoiceConsent(revokedStore, {
    id: "eeeeeeee-ffff-4aaa-8bbb-cccccccccccc",
    voiceFingerprint: SYNTHETIC_FP,
    decidedAt: WHEN,
    expectedRevision: 0,
    status: "revoked",
  });
  assert.throws(() => assertVoiceConsentAdmissible(revoked.consent), /revoked/);
  const conflictStore = createVoiceConsentStore();
  persistVoiceConsent(conflictStore, {
    id: "ffffffff-aaaa-4bbb-8ccc-dddddddddddd",
    voiceFingerprint: SYNTHETIC_FP,
    decidedAt: WHEN,
    expectedRevision: 0,
    status: "contradictory",
  });
  assert.throws(
    () =>
      persistVoiceConsent(conflictStore, {
        id: "ffffffff-aaaa-4bbb-8ccc-dddddddddddd",
        voiceFingerprint: SYNTHETIC_FP,
        decidedAt: WHEN,
        expectedRevision: 1,
        status: "authorized",
      }),
    /contradictory/,
  );
  const globalish = { ...consent, globalConsent: true as const };
  assert.throws(() => assertVoiceConsentAdmissible(globalish), /global/);
  const cloned = { ...consent, cloningAuthorized: true as const };
  assert.throws(() => assertVoiceConsentAdmissible(cloned), /clon/);
});

test("11C-BIND — 21/22/23/24 persist created, replay existing, duplicate, optimistic conflict", () => {
  const store = createNarratorBindingStore();
  const first = persistNarratorBinding(store, {
    voiceFingerprint: SYNTHETIC_FP,
    createdBy: ACTOR,
    createdAt: WHEN,
    expectedRevision: 0,
  });
  assert.equal(first.result, "created");
  const replay = persistNarratorBinding(store, {
    voiceFingerprint: SYNTHETIC_FP,
    createdBy: ACTOR,
    createdAt: WHEN,
    expectedRevision: 0,
  });
  assert.equal(replay.result, "existing");
  assert.equal(store.records.length, 1);
  assert.throws(
    () =>
      persistNarratorBinding(store, {
        voiceFingerprint: hashVoiceSecret("another-voice"),
        createdBy: ACTOR,
        createdAt: WHEN,
        expectedRevision: 1,
      }),
    /duplicate|contradictory/,
  );
  assert.throws(
    () =>
      persistNarratorBinding(store, {
        voiceFingerprint: hashVoiceSecret("conflicting-voice"),
        createdBy: ACTOR,
        createdAt: WHEN,
        expectedRevision: 99,
      }),
    /optimistic/,
  );
});

test("11C-BIND — 25/26/27/28/29 resolver disabled, no reservation, no downstream", () => {
  const seeded = seedAuthorized();
  const resolved = resolveSyntheticNarratorBinding({
    binding: seeded.binding,
    consent: seeded.consent,
    env: { ELEVENLABS_VOICE_ID: SYNTHETIC },
    expectedFingerprint: SYNTHETIC_FP,
  });
  assert.equal(resolved.bindingAdmissible, true);
  assert.equal(resolved.consentAdmissible, true);
  assert.equal(resolved.executionAuthorized, false);
  assert.equal(resolved.providerCallAllowed, false);
  assert.equal(resolved.reservationCreated, false);
  assert.equal(resolved.productionPersisted, false);
  assert.equal(resolved.reference?.configSource, "project_narrator_binding");
  const reference = resolveExistingVoiceReferenceFromBinding({
    binding: seeded.binding,
    consent: seeded.consent,
  });
  assert.equal(reference.narratorId, PHASE_11C_NARRATOR_ID);
  assert.ok(reference.usageRestrictions.includes("no_downstream_auto"));
});

test("11C-BIND — 30 redaction + live Mei collision refuse persist", () => {
  assert.match(redactVoiceSecret("voice ABCDEFGHIJKLMNOPQRST"), /\[redacted-voice\]/);
  assert.match(redactPhase11CError("xi-api-key=secret"), /redacted/);
  const live = evaluateLiveNarratorBindingAttempt({
    env: { ELEVENLABS_VOICE_ID: "synthetic-mei-voice-fixture" },
    characterFingerprints: { tom: TOM_FP, mei: MEI_FP },
  });
  assert.equal(live.refuseCode, "character_substitution_mei");
  assert.equal(live.executionAuthorized, false);
  assert.equal(live.providerCallAllowed, false);
  assert.equal(live.productionPersisted, false);
  assert.equal(live.verdict, "BLOCKED_VOICE_NARRATOR_BINDING_CONFIG_UNAVAILABLE");
  const tom = evaluateLiveNarratorBindingAttempt({
    env: { ELEVENLABS_VOICE_ID: "synthetic-tom-voice-fixture" },
    characterFingerprints: { tom: TOM_FP, mei: MEI_FP },
  });
  assert.equal(tom.refuseCode, "character_substitution_tom");
});
