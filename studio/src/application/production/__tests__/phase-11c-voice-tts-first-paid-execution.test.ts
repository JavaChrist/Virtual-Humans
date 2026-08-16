/**
 * Phase 11C — first paid Voice/TTS guards. No ElevenLabs call.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyPhase11CVoiceAttemptOutcome,
  createPhase11CVoiceAttemptStore,
  createPhase11CVoiceJobState,
  markPhase11CVoiceSubmissionUnknown,
  persistPhase11CVoiceSubmitIntent,
  recordPhase11CVoiceSyntheticCompletion,
} from "../phase-11c-voice-worker";
import { hashSpokenText } from "../phase-11c-spoken-segment";
import { hashVoiceSecret } from "../phase-11c-voice-secret-locator";
import { HISTORICAL_GLOBAL_VOICE_ENV, NARRATOR_FEMALE_VOICE_ENV } from "../phase-11c-voice-identity-catalog";
import {
  PHASE_11C_VOICE_TTS_FIRST_PAID_AUTH,
  PHASE_11C_VOICE_TTS_FIRST_PAID_NEXT_AUTH,
  PHASE_11C_VOICE_TTS_FIRST_PAID_VERDICT,
  PHASE_11C_VOICE_TTS_PAID_CAP_MINOR,
  PHASE_11C_VOICE_TTS_PAID_ESTIMATE_MINOR,
  PHASE_11C_VOICE_TTS_PAID_FLAG_CLOSE_ORDER,
  PHASE_11C_VOICE_TTS_PAID_FLAG_OPEN_ORDER,
  PHASE_11C_VOICE_TTS_PAID_SCRIPT_AUTH_CONSUMED,
  applyPhase11CVoiceTtsFlagWindow,
  assertCallTimeNarratorFemaleLocator,
  assertCanonicalSpokenFingerprint,
  assertPhase11CVoiceMpegMagic,
  assertPhase11CVoiceTtsPaidBudgetSufficient,
  assertPhase11CVoiceTtsPaidCap,
  assertPhase11CVoiceTtsPaidNarrator,
  assertPhase11CVoiceTtsPaidNoDownstream,
  assertPhase11CVoiceTtsPaidPayloadRedacted,
  assertPhase11CVoiceTtsPaidPreflightAuth,
  assertPhase11CVoiceTtsPaidScriptMustNotResubmit,
  buildPhase11CVoiceTtsPaidIdempotencyKey,
  buildPhase11CVoiceTtsPaidJobIntent,
  evaluatePhase11CVoiceTtsPaidOutput,
  extractSegmentVoiceOverCandidate,
  incrementPhase11CVoiceTtsSubmitCount,
  phase11CVoiceTtsPaidActivationContract,
  phase11CVoiceTtsPaidDeterministicIds,
  planPhase11CVoiceTtsPaidExecution,
  redactPhase11CVoiceTtsPaidError,
  refuseHistoricalVoiceEnvFallback,
  settlePhase11CVoiceTtsPaid,
} from "../phase-11c-voice-tts-first-paid-execution";
import { PHASE_11C_CANONICAL_TEXT_SHA256 } from "../phase-11c-spoken-segment";

const FIXTURE_TEXT = "Fixture VO scene-2. Hash only. Not Production copy.";

test("auth, cap, estimate and next gate stay bounded", () => {
  assert.equal(PHASE_11C_VOICE_TTS_FIRST_PAID_AUTH, "AUTH_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION");
  assert.equal(PHASE_11C_VOICE_TTS_FIRST_PAID_NEXT_AUTH, "AUTH_11C_VOICE_TTS_PRIVATE_PREVIEW_AND_HUMAN_DECISION");
  assert.equal(PHASE_11C_VOICE_TTS_FIRST_PAID_VERDICT, "VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING");
  assert.equal(PHASE_11C_VOICE_TTS_PAID_CAP_MINOR, 2);
  assert.equal(PHASE_11C_VOICE_TTS_PAID_ESTIMATE_MINOR, 1);
  assert.equal(PHASE_11C_VOICE_TTS_PAID_SCRIPT_AUTH_CONSUMED, true);
  assertPhase11CVoiceTtsPaidPreflightAuth();
  assert.equal(phase11CVoiceTtsPaidActivationContract(), "C");
  assertPhase11CVoiceTtsPaidCap(2);
  assertPhase11CVoiceTtsPaidBudgetSufficient(48);
  assert.throws(() => assertPhase11CVoiceTtsPaidCap(3));
  assert.throws(() => assertPhase11CVoiceTtsPaidBudgetSufficient(1));
});

test("reservation settlement is conservative and never exceeds 2¢", () => {
  assert.deepEqual(settlePhase11CVoiceTtsPaid({ demonstratedMinor: null }), {
    amountMinor: 2,
    costKind: "provisional",
    remainderReleasedMinor: 0,
  });
  assert.deepEqual(settlePhase11CVoiceTtsPaid({ demonstratedMinor: 1 }), {
    amountMinor: 1,
    costKind: "committed",
    remainderReleasedMinor: 1,
  });
  assert.throws(() => settlePhase11CVoiceTtsPaid({ demonstratedMinor: 0 }));
  assert.throws(() => settlePhase11CVoiceTtsPaid({ demonstratedMinor: 3 }));
});

test("planner creates once then refuses a second submit", () => {
  const first = planPhase11CVoiceTtsPaidExecution(null);
  assert.equal(first.outcome, "created");
  assert.equal(first.maySubmit, true);
  assert.equal(first.reservationCreated, true);
  const replay = planPhase11CVoiceTtsPaidExecution({
    submitCount: 1,
    reservationActive: false,
  });
  assert.equal(replay.outcome, "existing");
  assert.equal(replay.maySubmit, false);
  assert.equal(replay.reservationCreated, false);
  assert.equal(replay.runCreated, false);
  assert.equal(replay.jobCreated, false);
  assert.equal(replay.attemptCreated, false);
  assert.equal(replay.outputCreated, false);
  const unknown = planPhase11CVoiceTtsPaidExecution({
    submitCount: 0,
    reservationActive: true,
    submissionUnknown: true,
  });
  assert.equal(unknown.maySubmit, false);
});

test("submitCount increment is atomic and forbids a second call", () => {
  const intent = buildPhase11CVoiceTtsPaidJobIntent();
  assert.equal(intent.submitCount, 0);
  const first = incrementPhase11CVoiceTtsSubmitCount(intent);
  assert.equal(first.submitCount, 1);
  assert.throws(() => incrementPhase11CVoiceTtsSubmitCount(first));
  const audio = {
    mimeType: "audio/mpeg" as const,
    byteLength: 32,
    checksum: "a".repeat(64),
    persisted: true as const,
  };
  assert.throws(() => recordPhase11CVoiceSyntheticCompletion(first, audio));
});

test("ambiguous timeout marks submission_unknown and never resubmits", () => {
  const unknown = markPhase11CVoiceSubmissionUnknown(persistPhase11CVoiceSubmitIntent(createPhase11CVoiceJobState()));
  assert.equal(unknown.status, "submission_unknown");
  assert.equal(unknown.submissionUnknown, true);
  assert.throws(() =>
    recordPhase11CVoiceSyntheticCompletion(unknown, {
      mimeType: "audio/mpeg",
      byteLength: 8,
      checksum: "b".repeat(64),
      persisted: true,
    }),
  );
  const replay = planPhase11CVoiceTtsPaidExecution({
    submitCount: unknown.submitCount,
    reservationActive: true,
    submissionUnknown: unknown.submissionUnknown,
  });
  assert.equal(replay.maySubmit, false);
});

test("flags open the C window then close in finally even on throw", () => {
  const store: Record<string, string> = {};
  const opened: string[] = [];
  const closed: string[] = [];
  assert.throws(() =>
    applyPhase11CVoiceTtsFlagWindow({
      env: {},
      open: (keys) => {
        opened.push(...keys);
        for (const key of keys) store[key] = "1";
      },
      close: (keys) => {
        closed.push(...keys);
        for (const key of keys) store[key] = "0";
      },
      keepOff: (keys) => {
        for (const key of keys) store[key] = "0";
      },
      run: () => {
        throw new Error("forced failure after open");
      },
    }),
  );
  assert.deepEqual(opened, [...PHASE_11C_VOICE_TTS_PAID_FLAG_OPEN_ORDER]);
  assert.deepEqual(closed, [...PHASE_11C_VOICE_TTS_PAID_FLAG_CLOSE_ORDER]);
  for (const key of PHASE_11C_VOICE_TTS_PAID_FLAG_CLOSE_ORDER) {
    assert.equal(store[key], "0");
  }
});

test("attempt becomes terminal before job and run", () => {
  const store = createPhase11CVoiceAttemptStore({
    attemptId: "11111111-1111-4111-8111-111111111111",
    runId: "22222222-2222-4222-8222-222222222222",
    workspaceId: "3c308f57-f448-40ba-aaca-bc0d8d546d01",
    projectId: "984507af-a89e-4644-8ea3-344797baa974",
  });
  const applied = applyPhase11CVoiceAttemptOutcome({
    outcome: "success",
    store,
    nowIso: "2026-08-16T00:00:00.000Z",
  });
  assert.equal(applied.store.attempt.status, "completed");
  assert.ok(applied.store.attempt.completedAt);
  assert.notEqual(applied.store.job.status, "completed");
  assert.notEqual(applied.store.run.status, "completed");
});

test("output QC stays private pending_review without downstream", () => {
  const bytes = Uint8Array.from([0x49, 0x44, 0x33, 0x04, 0x00]);
  assertPhase11CVoiceMpegMagic(bytes);
  const qc = evaluatePhase11CVoiceTtsPaidOutput({ mime: "audio/mpeg", bytes });
  assert.equal(qc.autoApprove, false);
  assert.equal(qc.humanReviewRequired, true);
  assert.equal(qc.technicalStatus, "needs_review");
  assert.equal(qc.perceptualStatus, "unavailable_humanOnly");
  assertPhase11CVoiceTtsPaidNoDownstream({});
  assert.throws(() => assertPhase11CVoiceTtsPaidNoDownstream({ lipsyncRequested: true }));
  assert.throws(() => assertPhase11CVoiceMpegMagic(Uint8Array.from([0x00, 0x01, 0x02])));
});

test("voiceId, spoken text and API key stay redacted", () => {
  const fixture = {
    segments: [
      { id: "segment-1", speaker: "voice_over", voiceOver: "aaa" },
      { id: "segment-2", speaker: "voice_over", voiceOver: FIXTURE_TEXT },
    ],
  };
  const extracted = extractSegmentVoiceOverCandidate(fixture);
  assert.equal(extracted.length, FIXTURE_TEXT.length);
  assert.equal(extracted.textSha256, hashSpokenText(FIXTURE_TEXT));
  assert.notEqual(extracted.textSha256, PHASE_11C_CANONICAL_TEXT_SHA256);
  assert.throws(() => assertCanonicalSpokenFingerprint(extracted));
  assertCanonicalSpokenFingerprint({ length: 81, textSha256: PHASE_11C_CANONICAL_TEXT_SHA256 });
  assert.throws(() =>
    assertPhase11CVoiceTtsPaidPayloadRedacted({ voiceId: "sk-should-not-persist" }),
  );
  assert.throws(() =>
    assertPhase11CVoiceTtsPaidPayloadRedacted({ header: "xi-api-key: secret" }),
  );
  assertPhase11CVoiceTtsPaidPayloadRedacted({
    narrator: "narrator_female",
    textSha256: PHASE_11C_CANONICAL_TEXT_SHA256,
    charCount: 81,
  });
  const redacted = redactPhase11CVoiceTtsPaidError("xi-api-key: secretvalue and https://api.elevenlabs.io/v1/x");
  assert.doesNotMatch(redacted, /secretvalue/);
  assert.doesNotMatch(redacted, /https:\/\//);
  assert.throws(() => refuseHistoricalVoiceEnvFallback(HISTORICAL_GLOBAL_VOICE_ENV));
  assert.throws(() => assertCallTimeNarratorFemaleLocator({}));
  assert.throws(() =>
    assertCallTimeNarratorFemaleLocator({
      [NARRATOR_FEMALE_VOICE_ENV]: "synthetic-wrong-prefix",
    }),
  );
  assert.equal(hashVoiceSecret("synthetic-narrator-female-paid-locator").length, 64);
  assert.throws(() => assertPhase11CVoiceTtsPaidNarrator("narrator_male"));
  assert.throws(() => assertPhase11CVoiceTtsPaidNarrator("character_mei"));
  assert.throws(() => assertPhase11CVoiceTtsPaidNarrator("character_tom"));
  assertPhase11CVoiceTtsPaidNarrator("narrator_female");
});

test("consumed auth and idempotent ids stay deterministic", () => {
  assert.throws(() => assertPhase11CVoiceTtsPaidScriptMustNotResubmit(true));
  assert.throws(() => assertPhase11CVoiceTtsPaidScriptMustNotResubmit(PHASE_11C_VOICE_TTS_PAID_SCRIPT_AUTH_CONSUMED));
  const a = phase11CVoiceTtsPaidDeterministicIds();
  const b = phase11CVoiceTtsPaidDeterministicIds();
  assert.deepEqual(a, b);
  assert.match(a.runId, /^[0-9a-f-]{36}$/);
  assert.equal(buildPhase11CVoiceTtsPaidIdempotencyKey().length, 64);
});
