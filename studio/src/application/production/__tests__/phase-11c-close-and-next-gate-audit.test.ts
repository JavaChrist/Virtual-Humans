/**
 * Phase 11C close audit — no provider, no Storage, no Production write.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID,
  PHASE_11B_ACTIVE_QUALITY_REPORT_ID,
} from "../phase-11b-artifact-pointer-coherence";
import {
  PHASE_11C_CLOSE_AUTH,
  PHASE_11C_CLOSE_DECISION_ID_PREFIX,
  PHASE_11C_CLOSE_NOTES,
  PHASE_11C_CLOSE_VERDICT,
  PHASE_11C_CLOSE_VOICE_PR_ID_PREFIX,
  PHASE_11C_CLOSE_VOICE_PR_REVISION,
  PHASE_11C_CLOSE_VOICE_QR_ID_PREFIX,
  PHASE_11C_CLOSE_VOICE_QR_REVISION,
  PHASE_11C_NEXT_AUTH,
  assertPhase11CCloseAuthMatchesHrNext,
  assertPhase11CCloseI2vPointersFrozen,
  assertPhase11CCloseKeepsAudioInactive,
  assertPhase11CCloseNoSideEffects,
  choosePhase11CNextAuth,
  classifyPhase11CRideCloudReadiness,
  classifyPhase11CSecondSubmitDebt,
  evaluatePhase11CCloseOptions,
  phase11CCloseScopedArtifactIds,
} from "../phase-11c-close-and-next-gate-audit";

test("11C-CLOSE — auth, verdict, next RideCloud gate, prefixes", () => {
  assertPhase11CCloseAuthMatchesHrNext();
  assert.equal(PHASE_11C_CLOSE_AUTH, "AUTH_11C_CLOSE_AND_NEXT_MEDIA_GATE_AUDIT");
  assert.equal(PHASE_11C_CLOSE_VERDICT, "PHASE_11C_CLOSED_PASS_WITH_NOTES");
  assert.equal(
    PHASE_11C_NEXT_AUTH,
    "AUTH_RIDECLOUD_SEPARATE_PROJECT_INPUT_COLLECTION_PREFLIGHT_NO_PROVIDER",
  );
  assert.equal(PHASE_11C_CLOSE_DECISION_ID_PREFIX, "068a2b25");
  const ids = phase11CCloseScopedArtifactIds();
  assert.equal(ids.qualityReportId.startsWith(PHASE_11C_CLOSE_VOICE_QR_ID_PREFIX), true);
  assert.equal(ids.productionResultId.startsWith(PHASE_11C_CLOSE_VOICE_PR_ID_PREFIX), true);
  assert.equal(PHASE_11C_CLOSE_VOICE_QR_REVISION, 6);
  assert.equal(PHASE_11C_CLOSE_VOICE_PR_REVISION, 11);
  assert.equal(PHASE_11C_CLOSE_NOTES.length >= 5, true);
});

test("11C-CLOSE — submitCount=1 and maySubmit=false keep second submit impossible", () => {
  const debt = classifyPhase11CSecondSubmitDebt({
    submitCount: 1,
    maySubmit: false,
    jobStatus: "completed",
    runStatus: "completed",
    attemptStatus: "completed",
    flagsOff: true,
  });
  assert.equal(debt.severity, "P2");
  assert.equal(debt.secondSubmitPossible, false);
});

test("11C-CLOSE — maySubmit or extra submit is P0", () => {
  const debt = classifyPhase11CSecondSubmitDebt({
    submitCount: 1,
    maySubmit: true,
    jobStatus: "completed",
    runStatus: "completed",
    attemptStatus: "completed",
    flagsOff: true,
  });
  assert.equal(debt.severity, "P0");
  assert.equal(debt.secondSubmitPossible, true);
});

test("11C-CLOSE — RideCloud inputs missing is P1 and next is preflight", () => {
  const ready = classifyPhase11CRideCloudReadiness({
    technicalProofsPrivateInactive: true,
    rideCloudProjectExists: false,
    rideCloudInputsPresent: false,
  });
  assert.equal(ready.severity, "P1");
  assert.equal(ready.nextIsRideCloudPreflight, true);
});

test("11C-CLOSE — options, frozen pointers, inactive audio, no side effects", () => {
  const options = evaluatePhase11CCloseOptions();
  assert.equal(options.ridecloud_separate_project_inputs, "chosen");
  assert.equal(options.keep_validation_assets_private_inactive, "conserved");
  assert.equal(options.lipsync_only_if_on_camera_character, "deferred");
  assert.equal(options.merge_export_after_distinct_architecture_auth, "deferred");
  assertPhase11CCloseKeepsAudioInactive({
    lifecycle: "approved",
    humanReviewDecision: "approved",
    active: false,
    published: false,
  });
  assert.throws(
    () =>
      assertPhase11CCloseKeepsAudioInactive({
        lifecycle: "approved",
        humanReviewDecision: "approved",
        active: true,
        published: false,
      }),
    /PRIVATE_INACTIVE/,
  );
  assertPhase11CCloseI2vPointersFrozen({
    activeQualityReportId: PHASE_11B_ACTIVE_QUALITY_REPORT_ID,
    activeProductionResultId: PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID,
    voiceQualityReportActive: false,
    voiceProductionResultActive: false,
  });
  assertPhase11CCloseNoSideEffects({
    providerCalls: 0,
    elevenLabsCalls: 0,
    signedUrlCount: 0,
    mediaReads: 0,
    mediaWrites: 0,
    humanReviewWrites: 0,
    productionWrites: 0,
    budgetWrites: 0,
    flagsWritten: 0,
    deploymentsTriggered: 0,
  });
  assert.equal(
    choosePhase11CNextAuth({
      audioApprovedInactive: true,
      secondSubmitPossible: false,
      i2vPointersFrozen: true,
    }),
    PHASE_11C_NEXT_AUTH,
  );
});
