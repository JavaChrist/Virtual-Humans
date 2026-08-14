import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PHASE_11B_CLOSE_AUTH,
  PHASE_11B_CLOSE_VERDICT,
  PHASE_11B_FOLLOW_ON_VOICE_AUTH,
  PHASE_11B_I2V_ATTEMPT_ID_PREFIX,
  PHASE_11B_NEXT_AUTH,
  assertPhase11BCloseKeepsVideoInactive,
  assertPhase11BCloseNoSideEffects,
  choosePhase11BNextAuth,
  classifyPhase11BArtifactPointerDebt,
  classifyPhase11BAttemptDebt,
} from "../phase-11b-close-and-next-gate-audit";

test("11B-CLOSE — auth, verdict, next gate, attempt prefix", () => {
  assert.equal(PHASE_11B_CLOSE_AUTH, "AUTH_11B_CLOSE_AND_NEXT_MEDIA_GATE_AUDIT");
  assert.equal(PHASE_11B_CLOSE_VERDICT, "PHASE_11B_CLOSED_PASS_WITH_NOTES");
  assert.equal(PHASE_11B_NEXT_AUTH, "AUTH_11B_I2V_ATTEMPT_TERMINAL_STATE_HARDENING");
  assert.equal(PHASE_11B_FOLLOW_ON_VOICE_AUTH, "AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT");
  assert.equal(PHASE_11B_I2V_ATTEMPT_ID_PREFIX, "6be95728");
});

test("11B-CLOSE — started attempt with completed job is P1, resubmit impossible", () => {
  const debt = classifyPhase11BAttemptDebt({
    attemptStatus: "started",
    jobStatus: "completed",
    runStatus: "completed",
    submitCount: 1,
    providerJobIdPresent: true,
    uniqueIdempotencyKey: true,
    startedAttemptCountInWorkspace: 1,
    resubmitConsumerExists: false,
    flagsOff: true,
  });
  assert.equal(debt.severity, "P1");
  assert.equal(debt.resubmitPossible, false);
  assert.equal(
    choosePhase11BNextAuth({
      attemptSeverity: debt.severity,
      resubmitPossible: debt.resubmitPossible,
    }),
    PHASE_11B_NEXT_AUTH,
  );
});

test("11B-CLOSE — missing submit guard is P0 and blocks close-as-pass path", () => {
  const debt = classifyPhase11BAttemptDebt({
    attemptStatus: "started",
    jobStatus: "completed",
    runStatus: "completed",
    submitCount: 0,
    providerJobIdPresent: false,
    uniqueIdempotencyKey: true,
    startedAttemptCountInWorkspace: 1,
    resubmitConsumerExists: false,
    flagsOff: true,
  });
  assert.equal(debt.severity, "P0");
  assert.equal(debt.resubmitPossible, true);
});

test("11B-CLOSE — QR/PR I2V + GP 11A is P1 when merge stays unauthorized", () => {
  const debt = classifyPhase11BArtifactPointerDebt({
    qualityReportActiveIsI2v: true,
    productionResultActiveIsI2v: true,
    generationPlanActiveIs11A: true,
    i2vGenerationPlanPersistedNotActive: true,
    mergeExportAuthorized: false,
    outputActive: false,
  });
  assert.equal(debt.severity, "P1");
  assert.equal(debt.coherentForNewProduction, false);
});

test("11B-CLOSE — video stays private inactive and audit has no side effects", () => {
  assertPhase11BCloseKeepsVideoInactive({
    lifecycle: "approved",
    active: false,
    published: false,
  });
  assertPhase11BCloseNoSideEffects({
    providerCalls: 0,
    signedUrlCount: 0,
    mediaReads: 0,
    productionWrites: 0,
    budgetWrites: 0,
    flagsWritten: 0,
  });
  assert.throws(() =>
    assertPhase11BCloseKeepsVideoInactive({
      lifecycle: "approved",
      active: true,
      published: false,
    }),
  );
});
