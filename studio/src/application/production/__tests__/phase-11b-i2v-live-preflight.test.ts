/**
 * Phase 11B live preflight — compare-only, 0 provider, 0 media, 0 write.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PHASE_11B_I2V_PAID_FLAG_ENV,
  PHASE_11B_LIVE_BUDGET,
  PHASE_11B_MODEL,
  PHASE_11B_SOURCE_ASSET_ID,
  assertPhase11BI2vFlagsRemainOff,
} from "../phase-11b-i2v-allowlist";
import {
  PHASE_11B_LIVE_PREFLIGHT_AUTH,
  PHASE_11B_VERIFIED_LIVE_METADATA,
  replayPhase11BI2vLivePreflightNoProvider,
  runPhase11BI2vLivePreflightNoProvider,
} from "../phase-11b-i2v-live-preflight";
import { assertPhase11BMayCreateSignedUrl } from "../phase-11b-i2v-resolver";
import { FAL_KLING_I2V_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-i2v-registry-profile";
import { FAL_KLING_V3_PRO_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";

test("11B live — compare-only dry-run fails closed before provider", () => {
  const result = runPhase11BI2vLivePreflightNoProvider({
    liveFacts: PHASE_11B_VERIFIED_LIVE_METADATA,
    liveBudget: PHASE_11B_LIVE_BUDGET,
    flags: {},
    providerMode: "disabled",
  });
  assert.equal(result.auth, PHASE_11B_LIVE_PREFLIGHT_AUTH);
  assert.equal(result.providerCalled, false);
  assert.equal(result.signedUrlCount, 0);
  assert.equal(result.mediaReads, 0);
  assert.equal(result.productionWrites, 0);
  assert.equal(result.budgetWrites, 0);
  assert.equal(result.reservationsCreated, 0);
  assert.equal(result.runsCreated, 0);
  assert.equal(result.jobsCreated, 0);
  assert.equal(result.persistedPlan, false);
  assert.equal(result.budgetDecisionAllowed, false);
  assert.equal(result.budgetDecisionReason, "insufficient_funds");
  assert.equal(result.model, PHASE_11B_MODEL);
  assert.equal(result.sourceAssetId, PHASE_11B_SOURCE_ASSET_ID);
  assert.equal(result.sourceActive, false);
  assert.equal(result.estimateMinor, 140);
  assert.equal(result.reservationMinor, 168);
  assert.equal(result.shortfallMinor, 143);
  assert.equal(result.availableMinor, 25);
});

test("11B live — replay is idempotent and side-effect free", () => {
  const replay = replayPhase11BI2vLivePreflightNoProvider({
    liveFacts: PHASE_11B_VERIFIED_LIVE_METADATA,
    liveBudget: PHASE_11B_LIVE_BUDGET,
  });
  assert.equal(replay.stable, true);
  assert.equal(replay.first.fingerprint, replay.second.fingerprint);
  assert.equal(replay.second.signedUrlCount, 0);
  assert.equal(replay.second.mediaReads, 0);
  assert.equal(replay.second.reservationsCreated, 0);
});

test("11B live — signature stays forbidden without reserve/submit/auth", () => {
  assert.throws(
    () =>
      assertPhase11BMayCreateSignedUrl({
        reserved: false,
        immediatelyBeforeSubmit: false,
        authorized: false,
      }),
    /forbidden/,
  );
  assert.throws(
    () =>
      runPhase11BI2vLivePreflightNoProvider({
        flags: { [PHASE_11B_I2V_PAID_FLAG_ENV]: "1" },
      }),
    /OFF/,
  );
  assertPhase11BI2vFlagsRemainOff({});
});

test("11B live — pending/rejected/active sources remain forbidden", () => {
  assert.throws(
    () =>
      runPhase11BI2vLivePreflightNoProvider({
        liveFacts: { ...PHASE_11B_VERIFIED_LIVE_METADATA, lifecycle: "pending_review" },
      }),
    /pending|approved/,
  );
  assert.throws(
    () =>
      runPhase11BI2vLivePreflightNoProvider({
        liveFacts: { ...PHASE_11B_VERIFIED_LIVE_METADATA, lifecycle: "rejected" },
      }),
    /rejected/,
  );
  assert.throws(
    () =>
      runPhase11BI2vLivePreflightNoProvider({
        liveFacts: { ...PHASE_11B_VERIFIED_LIVE_METADATA, active: true },
      }),
    /activation/,
  );
});

test("11B live — I2V stays isolated from Motion and remains disabled", () => {
  assert.equal(FAL_KLING_I2V_REGISTRY_PROFILE.enabled, false);
  assert.equal(FAL_KLING_I2V_REGISTRY_PROFILE.paidExecution, false);
  assert.equal(FAL_KLING_I2V_REGISTRY_PROFILE.globallyEligible, false);
  assert.equal(FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled, false);
  assert.notEqual(
    FAL_KLING_I2V_REGISTRY_PROFILE.modelId,
    FAL_KLING_V3_PRO_REGISTRY_PROFILE.modelId,
  );
});
