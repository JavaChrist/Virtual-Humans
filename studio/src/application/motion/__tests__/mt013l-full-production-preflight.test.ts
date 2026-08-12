/**
 * MT-013L — full Production preflight contract (zero network / zero FAL_KEY).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateMv001FullProductionPreflight,
  MV001_FULL_PRODUCTION_PREFLIGHT_SOURCE_COMMIT,
} from "../mv001/mv001-full-production-preflight";
import { MV001_PRIVACY_EXPIRES_AT } from "../mv001/mv001-benchmark-profile";

const NOW = "2026-08-12T16:00:00.000Z";

test("MT-013L READY_FOR_FINAL_PAID_AUTH when composition + budget + counters green", () => {
  const r = evaluateMv001FullProductionPreflight({
    expectedSourceCommit: MV001_FULL_PRODUCTION_PREFLIGHT_SOURCE_COMMIT,
    observedSourceCommit: MV001_FULL_PRODUCTION_PREFLIGHT_SOURCE_COMMIT,
    observedDeployCommit: "39a79d2",
    privacyAccepted5of5: true,
    privacyExpiresAt: MV001_PRIVACY_EXPIRES_AT,
    nowIso: NOW,
    budget: {
      hardMinor: 274,
      committedMinor: 112,
      reservedMinor: 0,
      availableMinor: 162,
    },
    providerCalled: false,
    reservationCount: 0,
    runCount: 0,
    jobCount: 0,
    assetCount: 0,
    workerExecuted: false,
    falKeyPresent: true,
    falTransportConfigured: true,
    privateBucketOk: true,
    assetsExact2: true,
    migrationsCount: 30,
    resultFetchCount: 0,
    mediaDownloadCount: 0,
    submitCount: 0,
    pollCount: 0,
    signedOrFalUrlGenerated: false,
    idempotencyFingerprint: "mt013l-test-fp-001",
    workerEnabledObserved: false,
    exceptionActiveObserved: true,
  });
  assert.equal(r.verdict, "READY_FOR_FINAL_PAID_AUTH");
  assert.equal(r.providerCalled, false);
  assert.equal(r.executable, true);
  assert.equal(r.composition.drainConsumer, true);
  assert.equal(r.composition.resultFetchByProviderJobId, true);
  assert.equal(r.composition.ssrfAllowlist, true);
  assert.equal(r.composition.fakeMotionQcAbsentInProduction, true);
  assert.equal(r.counters.resultFetchCount, 0);
  assert.equal(r.counters.mediaDownloadCount, 0);
});

test("MT-013L NOT_READY when resultFetchCount non-zero", () => {
  const r = evaluateMv001FullProductionPreflight({
    expectedSourceCommit: MV001_FULL_PRODUCTION_PREFLIGHT_SOURCE_COMMIT,
    observedSourceCommit: MV001_FULL_PRODUCTION_PREFLIGHT_SOURCE_COMMIT,
    observedDeployCommit: "39a79d2",
    privacyAccepted5of5: true,
    privacyExpiresAt: MV001_PRIVACY_EXPIRES_AT,
    nowIso: NOW,
    budget: {
      hardMinor: 274,
      committedMinor: 112,
      reservedMinor: 0,
      availableMinor: 162,
    },
    providerCalled: false,
    reservationCount: 0,
    runCount: 0,
    jobCount: 0,
    assetCount: 0,
    workerExecuted: false,
    falKeyPresent: true,
    falTransportConfigured: true,
    privateBucketOk: true,
    assetsExact2: true,
    migrationsCount: 30,
    resultFetchCount: 1,
    mediaDownloadCount: 0,
    submitCount: 0,
    pollCount: 0,
    signedOrFalUrlGenerated: false,
    idempotencyFingerprint: "mt013l-test-fp-002",
    workerEnabledObserved: false,
    exceptionActiveObserved: true,
  });
  assert.equal(r.verdict, "NOT_READY");
  assert.ok(r.checks.some((c) => c.id === "counters_zero" && !c.pass));
});
