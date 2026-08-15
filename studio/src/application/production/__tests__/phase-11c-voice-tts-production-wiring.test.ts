/**
 * Phase 11C — Voice/TTS Production wiring preflight (fakes only, 0 provider, 0 media).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createUniversalFakeAdapter } from "@/infrastructure/providers/fake-universal-adapter";
import { createExistingVoiceReference } from "@/domain/generation/existing-voice-reference";
import {
  PHASE_11C_ACTION,
  PHASE_11C_CAPABILITY,
  PHASE_11C_LEGACY_VOICE_ROUTE,
  PHASE_11C_LIVE_BUDGET,
  PHASE_11C_MAX_TEXT_CHARS,
  PHASE_11C_MODEL,
  PHASE_11C_NEXT_AUTH,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_PROVIDER,
  PHASE_11C_SCENE_ID,
  PHASE_11C_VOICE_CAPABILITY_FLAG_ENV,
  PHASE_11C_VOICE_WIRING_AUTH,
  PHASE_11C_VOICE_WIRING_VERDICT,
  PHASE_11C_WORKSPACE_ID,
  assertPhase11CNotLegacyVoiceEndpoint,
  assertPhase11CRejectsUniversalFake,
  assertPhase11CVoiceFlagsRemainOff,
  assertVhs11CVoiceAllowlistScope,
  estimatePhase11CVoiceCatalogue,
  isVhs11CVoiceExceptionEnabled,
  phase11CVoiceFlagsAuditView,
  redactPhase11CError,
} from "../phase-11c-voice-allowlist";
import {
  PHASE_11C_CANONICAL_CHAR_COUNT,
  PHASE_11C_CANONICAL_SCRIPT_ID,
  PHASE_11C_CANONICAL_SEGMENT_ID,
  PHASE_11C_CANONICAL_SPOKEN_KIND,
  PHASE_11C_CANONICAL_TEXT_SHA256,
  assertSpokenTextAcceptable,
  buildSpokenSegmentFromExplicitText,
  fingerprintSpokenSegment,
  hashSpokenText,
  resolveCanonicalI2vSpokenSegment,
} from "../phase-11c-spoken-segment";
import {
  assertPhase11CVoiceReadyForFuturePaidCall,
  buildPhase11CFixtureVoiceReference,
  inspectPhase11CLiveVoiceConsent,
  resolvePhase11CLiveNarratorVoice,
} from "../phase-11c-voice-reference";
import {
  buildPhase11CIdempotencyKey,
  buildPhase11CSingleStepGenerationPlan,
} from "../phase-11c-single-step-plan";
import {
  applyPhase11CVoiceAttemptOutcome,
  createPhase11CVoiceAttemptStore,
  createPhase11CVoiceJobState,
  markPhase11CVoiceSubmissionUnknown,
  persistPhase11CVoiceSubmitIntent,
  recordPhase11CVoiceSyntheticCompletion,
  recoverPhase11CVoiceAfterSyncResponse,
} from "../phase-11c-voice-worker";
import {
  assertPhase11CVoiceNoDataUrl,
  checksumPhase11CVoiceBuffer,
  simulatePhase11CVoiceIngest,
} from "../phase-11c-voice-ingest";
import {
  assertPhase11CVoiceNoAutoApprove,
  evaluatePhase11CVoiceTechnicalQuality,
} from "../phase-11c-voice-qc";
import {
  applyPhase11CVoiceReviewDecision,
  assertPhase11CVoiceApproveDoesNotOpenLipsync,
  createPhase11CVoiceReviewHandoff,
} from "../phase-11c-voice-human-review";
import {
  PHASE_11C_DRY_RUN_FIXTURE_TEXT,
  createPhase11CSyntheticMp3Buffer,
  fingerprintPhase11CVoiceDryRun,
  runPhase11CVoiceWiringDryRun,
} from "../phase-11c-voice-dry-run";
import { PHASE_11B_I2V_GENERATION_PLAN_ID } from "../phase-11b-artifact-pointer-coherence";
import { PHASE_11B_LIVE_VIDEO_ASSET_ID } from "../phase-11b-i2v-attempt-terminal-state";
import { PHASE_11C_CANONICAL_SCENE_PACKAGE_SET_ID, PHASE_11C_CANONICAL_STORYBOARD_ID } from "../phase-11c-spoken-segment";

const PLAN_META = {
  createdAt: "2026-08-15T10:00:00.000Z",
  createdBy: "00000000-0000-4000-8000-000000000001",
  correlationId: "11c-voice-wiring-preflight",
  storyboardRevisionId: PHASE_11C_CANONICAL_STORYBOARD_ID,
  scenePackageRevisionIds: [PHASE_11C_CANONICAL_SCENE_PACKAGE_SET_ID],
};

function fixtureSegment(kind: "dialogue" | "voice_over", text: string) {
  return buildSpokenSegmentFromExplicitText({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    sceneId: PHASE_11C_SCENE_ID,
    scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
    scriptRevision: 1,
    segmentId: kind === "dialogue" ? "segment-dialogue-fixture" : PHASE_11C_CANONICAL_SEGMENT_ID,
    spokenKind: kind,
    speakerKind: kind === "dialogue" ? "character" : "narrator",
    characterId: kind === "dialogue" ? "character:fixture" : undefined,
    narratorId: kind === "voice_over" ? "narrator:fixture" : undefined,
    language: "fr",
    text,
    provenance: "phase-11c-test",
  });
}

test("11C — auth, flags OFF, capability distincte, budget inchangé", () => {
  assert.equal(PHASE_11C_VOICE_WIRING_AUTH, "AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT");
  assert.equal(PHASE_11C_VOICE_WIRING_VERDICT, "VOICE_TTS_PATH_WIRED_DISABLED_BLOCKED_VOICE_OR_CONSENT");
  assert.equal(PHASE_11C_NEXT_AUTH, "AUTH_11C_VOICE_NARRATOR_BINDING_AND_CONSENT");
  assert.equal(PHASE_11C_CAPABILITY, "audio.voice");
  assert.equal(PHASE_11C_ACTION, "voice");
  assert.notEqual(PHASE_11C_CAPABILITY, "audio.lipsync");
  assert.equal(isVhs11CVoiceExceptionEnabled({}), false);
  assertPhase11CVoiceFlagsRemainOff({});
  const flags = phase11CVoiceFlagsAuditView({});
  assert.equal(flags.capability, false);
  assert.equal(flags.paid, false);
  assert.equal(flags.provider, false);
  assert.equal(flags.worker, false);
  assert.equal(flags.exception, false);
  assert.equal(flags.downstream, false);
  assert.equal(flags.lipsync, false);
  assert.equal(PHASE_11C_LIVE_BUDGET.hard, 437);
  assert.equal(PHASE_11C_LIVE_BUDGET.committed, 389);
  assert.equal(PHASE_11C_LIVE_BUDGET.reserved, 0);
  assert.equal(PHASE_11C_LIVE_BUDGET.available, 48);
  assert.throws(
    () => assertPhase11CVoiceFlagsRemainOff({ [PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]: "1" }),
    /OFF/,
  );
});

test("11C — 1/16 résolution explicite projet+script, pas de pointeurs actifs mélangés", () => {
  const spoken = resolveCanonicalI2vSpokenSegment();
  assert.equal(spoken.workspaceId, PHASE_11C_WORKSPACE_ID);
  assert.equal(spoken.projectId, PHASE_11C_PROJECT_ID);
  assert.equal(spoken.sceneId, PHASE_11C_SCENE_ID);
  assert.equal(spoken.scriptArtifactId, PHASE_11C_CANONICAL_SCRIPT_ID);
  assert.equal(spoken.segmentId, PHASE_11C_CANONICAL_SEGMENT_ID);
  assert.equal(spoken.spokenKind, PHASE_11C_CANONICAL_SPOKEN_KIND);
  assert.equal(spoken.characterCount, PHASE_11C_CANONICAL_CHAR_COUNT);
  assert.equal(spoken.textSha256, PHASE_11C_CANONICAL_TEXT_SHA256);
  assert.equal(spoken.scriptArtifactId.startsWith("349e2792"), true);
});

test("11C — 2/3 segments dialogue et voice_over", () => {
  const dialogue = fixtureSegment("dialogue", "Bonjour, fixture dialogue.");
  const voiceOver = fixtureSegment("voice_over", "Fixture voice over.");
  assert.equal(dialogue.spokenKind, "dialogue");
  assert.equal(dialogue.speakerKind, "character");
  assert.equal(voiceOver.spokenKind, "voice_over");
  assert.equal(voiceOver.speakerKind, "narrator");
});

test("11C — 4/5 texte vide et trop long refusés", () => {
  assert.throws(() => assertSpokenTextAcceptable(""), /empty/);
  assert.throws(() => assertSpokenTextAcceptable("   "), /empty/);
  assert.throws(() => assertSpokenTextAcceptable("x".repeat(PHASE_11C_MAX_TEXT_CHARS + 1)), /max length/);
  assert.throws(
    () =>
      buildSpokenSegmentFromExplicitText({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: PHASE_11C_PROJECT_ID,
        sceneId: PHASE_11C_SCENE_ID,
        scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
        scriptRevision: 1,
        segmentId: "segment-2",
        spokenKind: "voice_over",
        speakerKind: "narrator",
        narratorId: "narrator:fixture",
        language: "fr",
        text: "",
        provenance: "test",
      }),
    /empty/,
  );
});

test("11C — 6 hash et fingerprint déterministes", () => {
  const a = fixtureSegment("voice_over", PHASE_11C_DRY_RUN_FIXTURE_TEXT);
  const b = fixtureSegment("voice_over", PHASE_11C_DRY_RUN_FIXTURE_TEXT);
  assert.equal(a.textSha256, b.textSha256);
  assert.equal(a.textSha256, hashSpokenText(PHASE_11C_DRY_RUN_FIXTURE_TEXT));
  assert.equal(fingerprintSpokenSegment(a), fingerprintSpokenSegment(b));
});

test("11C — 7/8/9 voix explicite, absence et consentement insuffisant", () => {
  const voice = buildPhase11CFixtureVoiceReference();
  assert.equal(voice.voiceProvider, "elevenlabs");
  assert.equal(voice.expectedModelId, PHASE_11C_MODEL);
  assert.match(voice.voiceConfigIdRedacted, /^el-voice:/);
  assert.throws(() => resolvePhase11CLiveNarratorVoice(), /no authorized narrator voice/);
  const consent = inspectPhase11CLiveVoiceConsent();
  assert.equal(consent.status, "insufficient");
  assert.equal(consent.benchmarkOnlyConsent, true);
  assert.equal(consent.voiceUsageAuthorized, false);
  const blocked = buildPhase11CFixtureVoiceReference({ consentStatus: "insufficient" });
  assert.throws(() => assertPhase11CVoiceReadyForFuturePaidCall(blocked), /consent/);
  assert.throws(
    () =>
      createExistingVoiceReference({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: PHASE_11C_PROJECT_ID,
        speakerKind: "narrator",
        narratorId: "narrator:fixture",
        voiceProvider: "elevenlabs",
        voiceConfigIdRedacted: "el-voice:SYNTHETICVOICEID00",
        expectedModelId: "eleven_multilingual_v2",
        language: "fr",
        configSource: "explicit_test_fixture",
        consentStatus: "authorized",
        usageRestrictions: [],
      }),
    /raw provider voice id/,
  );
});

test("11C — 10/11 mauvais workspace/projet et modèle non allowlisté", () => {
  assert.throws(
    () =>
      assertVhs11CVoiceAllowlistScope({
        workspaceId: "00000000-0000-4000-8000-000000000099",
        projectId: PHASE_11C_PROJECT_ID,
        sceneId: PHASE_11C_SCENE_ID,
        action: PHASE_11C_ACTION,
        capabilityProfile: PHASE_11C_CAPABILITY,
        providerId: PHASE_11C_PROVIDER,
        modelId: PHASE_11C_MODEL,
        textChars: 20,
      }),
    /workspace/,
  );
  assert.throws(
    () =>
      buildSpokenSegmentFromExplicitText({
        workspaceId: PHASE_11C_WORKSPACE_ID,
        projectId: "00000000-0000-4000-8000-000000000099",
        sceneId: PHASE_11C_SCENE_ID,
        scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
        scriptRevision: 1,
        segmentId: "segment-2",
        spokenKind: "voice_over",
        speakerKind: "narrator",
        narratorId: "narrator:x",
        language: "fr",
        text: "ok",
        provenance: "test",
      }),
    /mismatch/,
  );
  assert.throws(
    () =>
      assertVhs11CVoiceAllowlistScope({
        projectId: PHASE_11C_PROJECT_ID,
        sceneId: PHASE_11C_SCENE_ID,
        action: PHASE_11C_ACTION,
        capabilityProfile: PHASE_11C_CAPABILITY,
        providerId: PHASE_11C_PROVIDER,
        modelId: "eleven_turbo_v2",
        textChars: 20,
      }),
    /not allowlisted/,
  );
});

test("11C — 12 fake universel refusé en Production", () => {
  const fake = createUniversalFakeAdapter("elevenlabs");
  assert.equal(fake.providerId, "elevenlabs");
  assert.throws(() => assertPhase11CRejectsUniversalFake("fake"), /universal fake/);
  assert.throws(
    () =>
      assertVhs11CVoiceAllowlistScope({
        projectId: PHASE_11C_PROJECT_ID,
        sceneId: PHASE_11C_SCENE_ID,
        action: PHASE_11C_ACTION,
        capabilityProfile: PHASE_11C_CAPABILITY,
        providerId: PHASE_11C_PROVIDER,
        modelId: PHASE_11C_MODEL,
        textChars: 20,
        universalFake: true,
      }),
    /universal fake/,
  );
});

test("11C — 13/14/15/17/18 GenerationPlan single-step + bundle I2V + caps", () => {
  const segment = fixtureSegment("voice_over", PHASE_11C_DRY_RUN_FIXTURE_TEXT);
  const voice = buildPhase11CFixtureVoiceReference();
  const built = buildPhase11CSingleStepGenerationPlan({ spokenSegment: segment, voice, ...PLAN_META });
  assert.equal(built.stepCount, 1);
  assert.equal(built.fallbackCount, 0);
  assert.equal(built.retryCount, 0);
  assert.equal(built.downstreamCount, 0);
  assert.equal(built.plan.scenePlans[0]?.steps.length, 1);
  assert.equal(built.plan.scenePlans[0]?.steps[0]?.fallbacks.length, 0);
  assert.equal(built.plan.scenePlans[0]?.steps[0]?.capabilityProfile, "audio.voice");
  assert.equal(built.plan.scenePlans[0]?.steps[0]?.action, "voice");
  assert.equal(built.i2vContext.generationPlanId, PHASE_11B_I2V_GENERATION_PLAN_ID);
  assert.equal(built.i2vContext.videoAssetId, PHASE_11B_LIVE_VIDEO_ASSET_ID);
  assert.equal(built.i2vContext.mediaRead, false);
  assert.equal(built.i2vContext.videoMutated, false);
  assert.equal(built.plan.budgetDecision.allowed, false);
  assert.equal(built.persistedToProduction, false);
  assert.equal(built.planActive, false);
  assert.equal(built.humanReviewRequired, true);
});

test("11C — 19/20 submission_unknown sans second appel + attempt terminal", () => {
  let job = persistPhase11CVoiceSubmitIntent(createPhase11CVoiceJobState());
  job = markPhase11CVoiceSubmissionUnknown(job);
  assert.equal(job.status, "submission_unknown");
  assert.throws(
    () =>
      recordPhase11CVoiceSyntheticCompletion(job, {
        mimeType: "audio/mpeg",
        byteLength: 8,
        checksum: "a".repeat(64),
        persisted: true,
      }),
    /submission_unknown/,
  );
  const recovered = recoverPhase11CVoiceAfterSyncResponse(createPhase11CVoiceJobState());
  assert.equal(recovered.status, "submission_unknown");
  const store = createPhase11CVoiceAttemptStore({
    attemptId: "11111111-1111-4111-8111-111111111111",
    runId: "22222222-2222-4222-8222-222222222222",
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
  });
  const success = applyPhase11CVoiceAttemptOutcome({
    outcome: "success",
    store,
    nowIso: "2026-08-15T10:00:00.000Z",
  });
  assert.equal(success.store.attempt.status, "completed");
  assert.equal(success.store.attempt.retryable, false);
  const failed = applyPhase11CVoiceAttemptOutcome({
    outcome: "provider_failed",
    store,
    nowIso: "2026-08-15T10:00:00.000Z",
  });
  assert.equal(failed.store.attempt.status, "failed");
  assert.equal(failed.store.attempt.retryable, false);
  const unknown = applyPhase11CVoiceAttemptOutcome({
    outcome: "submission_unknown",
    store,
    nowIso: "2026-08-15T10:00:00.000Z",
  });
  assert.equal(unknown.result, "prudent_hold");
  assert.equal(unknown.store.attempt.retryable, false);
});

test("11C — 21/22/23 dataUrl jamais persistée + ingest MIME/size/checksum", () => {
  const bytes = createPhase11CSyntheticMp3Buffer();
  const ingest = simulatePhase11CVoiceIngest({
    outputAssetId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    bytes,
    mimeType: "audio/mpeg",
  });
  assert.equal(ingest.mimeType, "audio/mpeg");
  assert.equal(ingest.byteLength, bytes.byteLength);
  assert.equal(ingest.checksum, checksumPhase11CVoiceBuffer(bytes));
  assert.equal(ingest.active, false);
  assert.equal(ingest.persistedToProduction, false);
  assert.match(ingest.storagePath, /\/audio\/voice\/.+\.mp3$/);
  assert.throws(
    () => assertPhase11CVoiceNoDataUrl({ dataUrl: "data:audio/mpeg;base64,AAAA" }),
    /dataUrl/,
  );
});

test("11C — 24/25/26/27 QC + HR obligatoire + output inactif", () => {
  const qc = evaluatePhase11CVoiceTechnicalQuality({
    mime: "audio/mpeg",
    bytes: 8,
    checksum: "b".repeat(64),
    probeAvailable: false,
    provenanceOk: true,
    estimateOk: true,
  });
  assert.equal(qc.perceptualStatus, "unavailable_humanOnly");
  assert.equal(qc.humanReviewRequired, true);
  assert.equal(qc.autoApprove, false);
  assert.equal(qc.technicalStatus, "needs_review");
  assertPhase11CVoiceNoAutoApprove(qc);
  const review = createPhase11CVoiceReviewHandoff({
    outputAssetId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    qualityReportId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
    reviewRequestId: "cccccccc-dddd-4eee-8fff-000000000000",
    expectedRevision: 1,
  });
  assert.equal(review.decision, "pending");
  assert.equal(review.lipsyncAuthorized, false);
  const approved = applyPhase11CVoiceReviewDecision({
    current: review,
    decision: "approved",
    comment: "usable later",
    expectedRevision: 1,
  });
  assert.equal(approved.decision, "approved");
  assertPhase11CVoiceApproveDoesNotOpenLipsync(approved.lipsyncAuthorized);
  const replay = applyPhase11CVoiceReviewDecision({
    current: approved,
    decision: "approved",
    comment: "usable later",
    expectedRevision: approved.expectedRevision,
  });
  assert.equal(replay.decision, "approved");
});

test("11C — 28/29 isolation legacy/lipsync + flags", () => {
  assert.throws(() => assertPhase11CNotLegacyVoiceEndpoint(PHASE_11C_LEGACY_VOICE_ROUTE), /legacy/);
  assert.throws(
    () =>
      assertVhs11CVoiceAllowlistScope({
        projectId: PHASE_11C_PROJECT_ID,
        sceneId: PHASE_11C_SCENE_ID,
        action: "lipsync",
        capabilityProfile: "audio.lipsync",
        providerId: PHASE_11C_PROVIDER,
        modelId: PHASE_11C_MODEL,
        textChars: 20,
      }),
    /voice/,
  );
  assert.throws(
    () =>
      assertVhs11CVoiceAllowlistScope({
        projectId: PHASE_11C_PROJECT_ID,
        sceneId: PHASE_11C_SCENE_ID,
        action: PHASE_11C_ACTION,
        capabilityProfile: PHASE_11C_CAPABILITY,
        providerId: PHASE_11C_PROVIDER,
        modelId: PHASE_11C_MODEL,
        textChars: 20,
        lipsyncRequested: true,
      }),
    /forbidden/,
  );
});

test("11C — 30/31 budget compare-only et pricing non ferme", () => {
  const pricing = estimatePhase11CVoiceCatalogue(PHASE_11C_CANONICAL_CHAR_COUNT);
  assert.equal(pricing.firm, false);
  assert.equal(pricing.planKnown, false);
  assert.equal(pricing.budgetDecisionAllowed, false);
  assert.equal(pricing.reservationCreated, false);
  assert.equal(pricing.characterCount, 81);
  assert.equal(pricing.creditsPerCharacter, 1);
  assert.ok(pricing.catalogueEstimateMinor >= 1);
  assert.ok(pricing.reservationMinor >= pricing.catalogueEstimateMinor);
  assert.equal(pricing.shortfallMinor, 0);
});

test("11C — 32/33 dry-run replay + redaction", () => {
  const first = runPhase11CVoiceWiringDryRun();
  const second = runPhase11CVoiceWiringDryRun();
  assert.equal(first.planFingerprint, second.planFingerprint);
  assert.equal(first.idempotencyKey, second.idempotencyKey);
  assert.equal(fingerprintPhase11CVoiceDryRun(first), fingerprintPhase11CVoiceDryRun(second));
  assert.equal(first.providerCalls, 0);
  assert.equal(first.persistedToProduction, false);
  assert.equal(first.outputActive, false);
  assert.equal(first.lipsyncSteps, 0);
  assert.equal(first.i2vBundleCoherent, true);
  assert.equal(first.liveVoiceBlocked, true);
  assert.equal(first.consent, "insufficient");
  assert.equal(first.spoken.textSha256, PHASE_11C_CANONICAL_TEXT_SHA256);
  const keyA = buildPhase11CIdempotencyKey({
    spokenSegment: first.fixtureSegment,
    voice: first.voice,
  });
  assert.equal(keyA, first.idempotencyKey);
  assert.equal(
    redactPhase11CError("boom data:audio/mpeg;base64,AAAA xi-api-key=secret https://api.elevenlabs.io/v1"),
    "boom data:[redacted] xi-api-key:[redacted] [redacted-url]",
  );
});
