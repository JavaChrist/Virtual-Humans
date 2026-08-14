/**
 * Phase 11B paid smoke final preflight — fakes only, 0 provider, 0 reserve, 0 signed URL.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PHASE_11B_I2V_PAID_FLAG_ENV,
  PHASE_11B_MODEL,
  PHASE_11B_PROJECT_ID,
  PHASE_11B_PROVIDER,
  PHASE_11B_RUNWAY_CANDIDATE,
  PHASE_11B_SCENE_ID,
  PHASE_11B_SOURCE_ASSET_ID,
  PHASE_11B_WORKSPACE_ID,
  assertVhs11BFalI2vAllowlistScope,
} from "../phase-11b-i2v-allowlist";
import { PHASE_11B_VERIFIED_LIVE_METADATA } from "../phase-11b-i2v-live-preflight";
import { assertPhase11BMayCreateSignedUrl, phase11BSignedUrlPolicy } from "../phase-11b-i2v-resolver";
import { assertPhase11BI2vResultHostAllowlist } from "../phase-11b-i2v-ingest";
import {
  PHASE_11B_NEXT_PAID_AUTH,
  PHASE_11B_PAID_EXECUTION_SEQUENCE,
  PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET,
  PHASE_11B_PAID_SMOKE_FINAL_PREFLIGHT_AUTH,
  PHASE_11B_PAID_SMOKE_FLAG_CLOSE_ORDER,
  PHASE_11B_PAID_SMOKE_FLAG_OPEN_ORDER,
  assertPhase11BFlagCloseFailedFailClosed,
  assertPhase11BPaidPreflightLiveBudget,
  assertPhase11BReservationNotCreated,
  phase11BPaidSmokeFlagPolicy,
  planPhase11BFutureReservation,
  provePhase11BPaidExecutionContractInMemory,
  redactPhase11BPaidPreflightError,
  replayPhase11BI2vPaidSmokeFinalPreflight,
  runPhase11BI2vPaidSmokeFinalPreflight,
  simulatePhase11BFlagWindow,
  simulatePhase11BReservationIdempotency,
} from "../phase-11b-i2v-paid-smoke-final-preflight";

test("11B paid preflight — reservation contract stays uncreated", () => {
  const contract = planPhase11BFutureReservation();
  assert.equal(contract.workspaceId, PHASE_11B_WORKSPACE_ID);
  assert.equal(contract.projectId, PHASE_11B_PROJECT_ID);
  assert.equal(contract.capability, "video.image_to_video");
  assert.equal(contract.provider, PHASE_11B_PROVIDER);
  assert.equal(contract.model, PHASE_11B_MODEL);
  assert.equal(contract.durationSeconds, 5);
  assert.equal(contract.estimateMinor, 140);
  assert.equal(contract.capMinor, 168);
  assert.equal(contract.futureMarginMinor, 20);
  assert.equal(contract.created, false);
  assert.equal(contract.settleAtMostOnce, true);
  assert.match(contract.idempotencyKey, new RegExp(`^${PHASE_11B_PROJECT_ID}:`));
  assertPhase11BReservationNotCreated(false);
  assert.throws(() => assertPhase11BReservationNotCreated(true), /must not create/);
});

test("11B paid preflight — budget 188¢ covers cap 168¢ with 20¢ margin", () => {
  assertPhase11BPaidPreflightLiveBudget(PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET);
  assert.equal(PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET.hard, 437);
  assert.equal(PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET.committed, 249);
  assert.equal(PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET.reserved, 0);
  assert.equal(PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET.available, 188);
  assert.equal(188 - 168, 20);
  assert.throws(
    () => assertPhase11BPaidPreflightLiveBudget({ ...PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET, available: 25 }),
    /DIVERGED|diverged/i,
  );
});

test("11B paid preflight — idempotency key refuses a concurrent create", () => {
  const key = planPhase11BFutureReservation().idempotencyKey;
  const store = new Map<string, true>();
  assert.equal(simulatePhase11BReservationIdempotency(store, key, "plan").created, false);
  assert.equal(store.size, 0);
  assert.equal(simulatePhase11BReservationIdempotency(store, key, "create").created, true);
  assert.throws(
    () => simulatePhase11BReservationIdempotency(store, key, "create"),
    /concurrent/,
  );
});

test("11B paid preflight — allowlist accepts only Kling I2V 5s", () => {
  const ok = {
    workspaceId: PHASE_11B_WORKSPACE_ID,
    projectId: PHASE_11B_PROJECT_ID,
    sceneId: PHASE_11B_SCENE_ID,
    action: "video" as const,
    capabilityProfile: "video.image_to_video",
    providerId: "fal",
    modelId: PHASE_11B_MODEL,
  };
  assertVhs11BFalI2vAllowlistScope(ok);
  assert.throws(
    () => assertVhs11BFalI2vAllowlistScope({ ...ok, modelId: PHASE_11B_RUNWAY_CANDIDATE }),
    /Kling/,
  );
  assert.throws(
    () => assertVhs11BFalI2vAllowlistScope({ ...ok, capabilityProfile: "video.text_to_video" }),
    /capability/,
  );
  assert.throws(
    () => assertVhs11BFalI2vAllowlistScope({ ...ok, motionRequested: true }),
    /forbidden/,
  );
  assert.throws(
    () => assertVhs11BFalI2vAllowlistScope({ ...ok, legacyEndpoint: true }),
    /forbidden/,
  );
});

test("11B paid preflight — 1/1/1 no retry no fallback no downstream", () => {
  const proven = provePhase11BPaidExecutionContractInMemory();
  assert.equal(proven.submits, 1);
  assert.equal(proven.jobs, 1);
  assert.equal(proven.outputs, 1);
  assert.equal(proven.retries, 0);
  assert.equal(proven.fallbacks, 0);
  assert.equal(proven.downstream, 0);
  assert.equal(proven.outputActive, false);
  assert.equal(proven.humanReviewRequired, true);
  assert.equal(PHASE_11B_PAID_EXECUTION_SEQUENCE.length, 20);
});

test("11B paid preflight — resolver stays unsigned and TTL is memory-only", () => {
  const policy = phase11BSignedUrlPolicy();
  assert.equal(policy.ttlSeconds, 60);
  assert.equal(policy.persist, false);
  assert.throws(
    () =>
      assertPhase11BMayCreateSignedUrl({
        reserved: false,
        immediatelyBeforeSubmit: true,
        authorized: true,
      }),
    /forbidden/,
  );
});

test("11B paid preflight — flags open/close in finally and stay unwritten", () => {
  const policy = phase11BPaidSmokeFlagPolicy();
  assert.equal(policy.writtenThisPhase, 0);
  assert.equal(policy.environment, "vercel-production");
  assert.deepEqual([...policy.openOrder], [...PHASE_11B_PAID_SMOKE_FLAG_OPEN_ORDER]);
  assert.deepEqual([...policy.closeOrder], [...PHASE_11B_PAID_SMOKE_FLAG_CLOSE_ORDER]);
  assert.ok(policy.alwaysOff.includes("VHS11B_I2V_DOWNSTREAM_ENABLED"));
  const window = simulatePhase11BFlagWindow({});
  assert.equal(window.closedInFinally, true);
  assert.equal(window.finalOff, true);
  assert.equal(window.downstreamStayedOff, true);
  assert.throws(() => assertPhase11BFlagCloseFailedFailClosed(false), /fail-closed/);
});

test("11B paid preflight — ingest host allowlist and SSRF", () => {
  assertPhase11BI2vResultHostAllowlist("https://v3.fal.media/files/example/output.mp4");
  assert.throws(() => assertPhase11BI2vResultHostAllowlist("http://127.0.0.1/x"), /hostile|https/);
  assert.throws(() => assertPhase11BI2vResultHostAllowlist("https://evil.example/video.mp4"), /allowlisted/);
});

test("11B paid preflight — dry-run theoretically sufficient but paid locked", () => {
  const result = runPhase11BI2vPaidSmokeFinalPreflight({
    liveFacts: PHASE_11B_VERIFIED_LIVE_METADATA,
    liveBudget: PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET,
    flags: {},
    providerMode: "disabled",
  });
  assert.equal(result.auth, PHASE_11B_PAID_SMOKE_FINAL_PREFLIGHT_AUTH);
  assert.equal(result.sourceAdmissible, true);
  assert.equal(result.sourceActive, false);
  assert.equal(result.theoreticallySufficient, true);
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.providerCallAllowed, false);
  assert.equal(result.reservationCreated, false);
  assert.equal(result.paidBlockedReason, "BLOCKED_PENDING_NEW_HUMAN_PAID_AUTH");
  assert.equal(result.providerCalled, false);
  assert.equal(result.signedUrlCount, 0);
  assert.equal(result.mediaReads, 0);
  assert.equal(result.productionWrites, 0);
  assert.equal(result.runsCreated, 0);
  assert.equal(result.jobsCreated, 0);
  assert.equal(result.flagsWritten, 0);
  assert.equal(result.estimateMinor, 140);
  assert.equal(result.reservationCapMinor, 168);
  assert.equal(result.availableMinor, 188);
  assert.equal(result.sourceAssetId, PHASE_11B_SOURCE_ASSET_ID);
  assert.equal(result.nextAuth, PHASE_11B_NEXT_PAID_AUTH);
  assert.match(result.fingerprint, /^[a-f0-9]{16,}$/i);
});

test("11B paid preflight — replay fingerprints are stable and side-effect free", () => {
  const replay = replayPhase11BI2vPaidSmokeFinalPreflight({
    liveFacts: PHASE_11B_VERIFIED_LIVE_METADATA,
    liveBudget: PHASE_11B_PAID_PREFLIGHT_LIVE_BUDGET,
  });
  assert.equal(replay.stable, true);
  assert.equal(replay.reservationKeyStable, true);
  assert.equal(replay.first.fingerprint, replay.second.fingerprint);
  assert.equal(replay.first.reservationIdempotencyKey, replay.second.reservationIdempotencyKey);
  assert.equal(replay.second.reservationCreated, false);
  assert.equal(replay.second.signedUrlCount, 0);
});

test("11B paid preflight — flags ON or budget divergence fail closed", () => {
  assert.throws(
    () =>
      runPhase11BI2vPaidSmokeFinalPreflight({
        flags: { [PHASE_11B_I2V_PAID_FLAG_ENV]: "1" },
      }),
    /OFF/,
  );
  assert.throws(
    () =>
      runPhase11BI2vPaidSmokeFinalPreflight({
        liveBudget: { hard: 437, committed: 249, reserved: 0, available: 25 },
      }),
    /BLOCKED_I2V_PAID_SMOKE_FINAL_PREFLIGHT/,
  );
});

test("11B paid preflight — errors redact URLs and tokens", () => {
  assert.match(
    redactPhase11BPaidPreflightError("failed https://db.example/x?token=supersecrettokenvalue"),
    /\[redacted-url\]/,
  );
});
