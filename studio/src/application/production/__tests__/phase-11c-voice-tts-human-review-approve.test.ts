/**
 * Phase 11C Voice/TTS Human Review APPROVE — no provider, no Storage, no flags.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPhase11APayloadHasNoMediaLeak } from "../phase-11a-human-review-reject";
import {
  PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID,
  PHASE_11B_ACTIVE_QUALITY_REPORT_ID,
} from "../phase-11b-artifact-pointer-coherence";
import { PHASE_11B_LIVE_VIDEO_ASSET_ID } from "../phase-11b-i2v-attempt-terminal-state";
import {
  applyPhase11CVoiceApproveToAssetProvenance,
  applyPhase11CVoiceApproveToProductionResult,
  applyPhase11CVoiceApproveToQualityReport,
  applyPhase11CVoiceApproveToRunState,
  assertPhase11CVoiceApprovedRemainsInactive,
  assertPhase11CVoiceApproveAttestation,
  assertPhase11CVoiceI2vPointersFrozen,
  assertPhase11CVoiceQualityReportScope,
  assertPhase11CVoiceRequestedDecisionIsApprove,
  assertPhase11CVoiceTtsHrAuthMatchesResume,
  emptyPhase11CVoiceApproveStore,
  persistPhase11CVoiceHumanApproveOnce,
  phase11CVoiceApproveIdempotencyKey,
  phase11CVoiceScopedProductionResultId,
  phase11CVoiceScopedQualityReportId,
  resolvePhase11CVoiceReviewRequestId,
  PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
  PHASE_11C_VOICE_TTS_AUDIO_BYTES,
  PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM,
  PHASE_11C_VOICE_TTS_HR_APPROVE_AUTH,
  PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT,
  PHASE_11C_VOICE_TTS_HR_APPROVE_ISSUE_CODE,
  PHASE_11C_VOICE_TTS_HR_APPROVE_NEXT_AUTH,
  PHASE_11C_VOICE_TTS_HR_APPROVE_VERDICT,
  PHASE_11C_VOICE_TTS_HR_REVIEW_REQUEST_PREFIX,
  type Phase11CVoiceApproveFacts,
} from "../phase-11c-voice-tts-human-review-approve";

const DECISION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function facts(): Phase11CVoiceApproveFacts {
  return {
    audioAssetId: PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
    audioChecksumSha256: PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM,
    qualityReportId: phase11CVoiceScopedQualityReportId(PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID),
    productionResultId: phase11CVoiceScopedProductionResultId(PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID),
    reviewRequestId: resolvePhase11CVoiceReviewRequestId(PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID),
    decisionId: DECISION_ID,
    nowIso: "2026-08-26T20:50:00.000Z",
  };
}

function store() {
  return emptyPhase11CVoiceApproveStore({
    audioAssetId: PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
    audioChecksum: PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM,
    qualityReportRevision: 6,
    productionResultRevision: 11,
  });
}

test("11C-VOICE-HR-APPROVE — auth, target, attestation, request id", () => {
  assertPhase11CVoiceTtsHrAuthMatchesResume();
  assert.equal(PHASE_11C_VOICE_TTS_HR_APPROVE_AUTH, "AUTH_11C_VOICE_TTS_PRIVATE_PREVIEW_AND_HUMAN_DECISION");
  assert.equal(PHASE_11C_VOICE_TTS_HR_APPROVE_VERDICT, "VOICE_TTS_FIRST_PAID_AUDIO_HUMAN_APPROVED_PRIVATE_INACTIVE");
  assert.equal(PHASE_11C_VOICE_TTS_HR_APPROVE_NEXT_AUTH, "AUTH_11C_CLOSE_AND_NEXT_MEDIA_GATE_AUDIT");
  assert.equal(PHASE_11C_VOICE_TTS_HR_APPROVE_ISSUE_CODE, "human.voice_tts_audio_approved");
  assert.equal(PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID, "bc36bba7-c937-5e2e-88be-2d034e25a8aa");
  assert.equal(PHASE_11C_VOICE_TTS_AUDIO_BYTES, 80_710);
  assert.doesNotThrow(() => assertPhase11CVoiceApproveAttestation(PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT));
  assert.throws(() => assertPhase11CVoiceApproveAttestation("autre"), /ATTESTATION/);
  assert.doesNotThrow(() => assertPhase11CVoiceRequestedDecisionIsApprove("approved"));
  assert.throws(() => assertPhase11CVoiceRequestedDecisionIsApprove("rejected"), /CONFLICT/);
  const reviewRequestId = facts().reviewRequestId;
  assert.equal(reviewRequestId.startsWith(PHASE_11C_VOICE_TTS_HR_REVIEW_REQUEST_PREFIX), true);
  assertPhase11APayloadHasNoMediaLeak({ comment: PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT });
});

test("11C-VOICE-HR-APPROVE — persist created, replay existing, no double", () => {
  const s = store();
  const f = facts();
  const key = phase11CVoiceApproveIdempotencyKey(f.reviewRequestId);
  const created = persistPhase11CVoiceHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: f,
    idempotencyKey: key,
    comment: PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT,
  });
  assert.equal(created.status, "created");
  if (created.status !== "created") throw new Error("expected created");
  assert.equal(s.audio.status, "approved");
  assert.equal(s.audio.active, false);
  assert.equal(s.audio.published, false);
  assert.equal(s.decisions.length, 1);
  const replay = persistPhase11CVoiceHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: { ...f, decisionId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff" },
    idempotencyKey: key,
    comment: PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT,
  });
  assert.equal(replay.status, "existing");
  if (replay.status !== "existing") throw new Error("expected existing");
  assert.equal(replay.decisionId, DECISION_ID);
  assert.equal(s.decisions.length, 1);
  const second = persistPhase11CVoiceHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: {
      ...f,
      decisionId: "cccccccc-dddd-4eee-8fff-000000000000",
      reviewRequestId: `${PHASE_11C_VOICE_TTS_HR_REVIEW_REQUEST_PREFIX}:other`,
    },
    idempotencyKey: `${key}:other`,
    comment: PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT,
  });
  assert.equal(second.status, "conflict");
  if (second.status !== "conflict") throw new Error("expected conflict");
  assert.equal(second.reason, "audio_decision_already_present");
  assert.equal(s.decisions.length, 1);
});

test("11C-VOICE-HR-APPROVE — checksum/request/pointer divergence fail closed", () => {
  const s = store();
  const f = facts();
  const key = phase11CVoiceApproveIdempotencyKey(f.reviewRequestId);
  const checksum = persistPhase11CVoiceHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: { ...f, audioChecksumSha256: "0".repeat(64) },
    idempotencyKey: key,
    comment: PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT,
  });
  assert.equal(checksum.status, "conflict");
  const request = persistPhase11CVoiceHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: { ...f, reviewRequestId: "wrong-request" },
    idempotencyKey: "hr-decision:wrong-request",
    comment: PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT,
  });
  assert.equal(request.status, "conflict");
  s.activeQualityReportId = "00000000-0000-4000-8000-000000000000";
  const pointer = persistPhase11CVoiceHumanApproveOnce(s, {
    requestedDecision: "approved",
    facts: f,
    idempotencyKey: key,
    comment: PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT,
  });
  assert.equal(pointer.status, "conflict");
  if (pointer.status !== "conflict") throw new Error("expected pointer conflict");
  assert.equal(pointer.reason, "i2v_pointer_mutation");
  assert.equal(s.decisions.length, 0);
  assert.equal(s.audio.status, "pending_review");
});

test("11C-VOICE-HR-APPROVE — asset/run stay inactive, I2V pointers frozen, no merge auth", () => {
  const f = facts();
  const qr = applyPhase11CVoiceApproveToQualityReport({
    facts: f,
    technicalStatus: "needs_review",
  });
  assert.equal(qr.audioAssetId, PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID);
  assert.equal(qr.autoApprove, false);
  const nextPr = applyPhase11CVoiceApproveToProductionResult({ facts: f });
  const phase = nextPr.phase11c as {
    outputActive?: boolean;
    mergeExportAuthorized?: boolean;
    lipsyncAuthorized?: boolean;
    humanReviewDecision?: string;
  };
  assert.equal(nextPr.delivery && (nextPr.delivery as { status?: string }).status, "voice_approved_private");
  assert.equal(phase.outputActive, false);
  assert.equal(phase.mergeExportAuthorized, false);
  assert.equal(phase.lipsyncAuthorized, false);
  assert.equal(phase.humanReviewDecision, "approved");
  const prov = applyPhase11CVoiceApproveToAssetProvenance(
    { active: false, mediaRole: "voice_tts_output_audio" },
    { reviewRequestId: f.reviewRequestId, decisionId: f.decisionId },
  );
  assert.equal(prov.active, false);
  assert.equal(prov.published, false);
  assert.equal(prov.lifecycle, "approved");
  const run = applyPhase11CVoiceApproveToRunState(
    {
      waitingReason: "needs_review",
      status: "completed",
      reviewRequest: { pending: true, decision: null },
    },
    { nowIso: f.nowIso, reviewRequestId: f.reviewRequestId, decisionId: f.decisionId },
  );
  assert.equal(run.waitingReason, undefined);
  assert.equal((run.reviewRequest as { pending?: boolean; decision?: string }).pending, false);
  assert.equal((run.reviewRequest as { decision?: string }).decision, "approved");
  assertPhase11APayloadHasNoMediaLeak(nextPr);
  assertPhase11APayloadHasNoMediaLeak(prov);
  assertPhase11APayloadHasNoMediaLeak(run);
  assertPhase11CVoiceApprovedRemainsInactive({
    decision: "approved",
    active: false,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
    lipsyncRequested: false,
    providerCalls: 0,
  });
  assert.throws(
    () =>
      assertPhase11CVoiceApprovedRemainsInactive({
        decision: "approved",
        active: true,
        published: false,
        mergeRequested: false,
        exportRequested: false,
        downstreamRequested: false,
        lipsyncRequested: false,
        providerCalls: 0,
      }),
    /active/,
  );
  assert.doesNotThrow(() =>
    assertPhase11CVoiceI2vPointersFrozen({
      activeQualityReportId: PHASE_11B_ACTIVE_QUALITY_REPORT_ID,
      activeProductionResultId: PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID,
      videoActive: false,
      videoPublished: false,
    }),
  );
  assert.equal(PHASE_11B_LIVE_VIDEO_ASSET_ID.startsWith("9be6cb0c"), true);
});

test("11C-VOICE-HR-APPROVE — QC humanOnly, no auto-approve, no provider/downstream/budget", () => {
  assert.doesNotThrow(() =>
    assertPhase11CVoiceQualityReportScope(
      {
        audioAssetId: PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
        technicalStatus: "needs_review",
        perceptualStatus: "unavailable_humanOnly",
        autoApprove: false,
        checksum: PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM,
        bytes: PHASE_11C_VOICE_TTS_AUDIO_BYTES,
      },
      PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
    ),
  );
  assert.throws(
    () =>
      assertPhase11CVoiceQualityReportScope(
        {
          audioAssetId: PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
          technicalStatus: "fail",
          perceptualStatus: "unavailable_humanOnly",
          autoApprove: false,
        },
        PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
      ),
    /QC_REJECT/,
  );
  const s = store();
  assert.equal(s.video.status, "approved");
  assert.equal(s.video.active, false);
  assert.equal(s.providerCalls, 0);
  assert.equal(s.ledgerWrites, 0);
  assert.equal(s.storageWrites, 0);
  assert.equal(s.flagsWritten, 0);
  assert.equal(s.signedUrlCount, 0);
  assert.equal(s.mediaReads, 0);
});
