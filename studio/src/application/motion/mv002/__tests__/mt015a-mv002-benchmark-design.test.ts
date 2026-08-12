/**
 * MT-015A — MV-002 design guards (non-paid / no media / no provider).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateFalKlingIndicativeCostMinor } from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-mapping";
import { FAL_KLING_V3_PRO_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";
import {
  assertMv001PrivacyPackDoesNotCoverMv002,
  assertMv002DesignConstantsMatchMv001Baseline,
  assertMv002DoesNotReuseMv001Assets,
  assertMv002IdempotencyIsolated,
  assertMv002RegistryRemainsDisabled,
  buildMv002DesignProfile,
  MV002_BENCHMARK_ID,
  MV002_CONTROLLED_VARIABLE,
  MV002_HUMAN_DECISIONS,
  MV002_OBSERVED_AVAILABLE_MINOR,
  MV002_PRIVACY_PENDING_KEYS,
  MV002_RESERVATION_MINOR,
  MV002_SHORTFALL_MINOR,
  mv002ReservationShortfallMinor,
} from "../mv002-benchmark-design";

test("MT-015A estimate 8s = 135¢", () => {
  const e = estimateFalKlingIndicativeCostMinor({
    endpointId: "fal-ai/kling-video/v3/pro/motion-control",
    durationSeconds: 8,
  });
  assert.equal(e.estimatedCostMinor, 135);
});

test("MT-015A design profile — constants + budget shortfall", () => {
  assertMv002DesignConstantsMatchMv001Baseline();
  const p = buildMv002DesignProfile();
  assert.equal(p.benchmarkId, MV002_BENCHMARK_ID);
  assert.equal(p.controlledVariable, MV002_CONTROLLED_VARIABLE);
  assert.equal(p.estimateMinor, 135);
  assert.equal(p.reservationMinor, 162);
  assert.equal(p.observedBudget.availableMinor, 27);
  assert.equal(p.shortfallMinor, MV002_SHORTFALL_MINOR);
  assert.equal(p.shortfallMinor, 135);
  assert.equal(p.privacy, "PENDING");
  assert.equal(p.media, "NOT_SELECTED");
  assert.equal(p.budgetAuth, "NOT_AUTHORIZED");
  assert.equal(p.providerAuth, "NOT_AUTHORIZED");
  assert.equal(p.opsStatus, "DEFERRED");
  assert.equal(p.reusesMv001PrivacyPack, false);
  assert.equal(p.reusesMv001PrivateAssets, false);
  assert.equal(p.productionRegistryEnabled, false);
  assert.equal(p.productionPaidExecution, false);
  assert.equal(mv002ReservationShortfallMinor(MV002_OBSERVED_AVAILABLE_MINOR), 135);
  assert.equal(mv002ReservationShortfallMinor(MV002_RESERVATION_MINOR), 0);
});

test("MT-015A Privacy scope isolation — MV-001 pack cannot cover MV-002", () => {
  assert.throws(() =>
    assertMv001PrivacyPackDoesNotCoverMv002({
      privacyBenchmarkScope: "ACCEPTED_LIMITED_MV001",
      targetBenchmarkId: "MV-002",
    }),
  );
  assert.throws(() =>
    assertMv001PrivacyPackDoesNotCoverMv002({
      privacyBenchmarkScope: "MV-001",
      targetBenchmarkId: "MV-002",
    }),
  );
  assert.doesNotThrow(() =>
    assertMv001PrivacyPackDoesNotCoverMv002({
      privacyBenchmarkScope: "PENDING_MV002",
      targetBenchmarkId: "MV-002",
    }),
  );
  assert.ok(MV002_PRIVACY_PENDING_KEYS.includes("sourceMotionReuseForMv002Authorized"));
  assert.ok(MV002_PRIVACY_PENDING_KEYS.includes("virtualIdentityRightsConfirmed"));
});

test("MT-015A asset isolation — no MV-001 private asset reuse", () => {
  assert.throws(() =>
    assertMv002DoesNotReuseMv001Assets({
      sourceAssetProjectBenchmark: "MV-001",
      identityAssetProjectBenchmark: "MV-002",
    }),
  );
  assert.doesNotThrow(() =>
    assertMv002DoesNotReuseMv001Assets({
      sourceAssetProjectBenchmark: "MV-002",
      identityAssetProjectBenchmark: "MV-002",
    }),
  );
});

test("MT-015A idempotency separation", () => {
  assert.throws(() =>
    assertMv002IdempotencyIsolated({
      mv001CorrelationId: "corr-mv001-paid",
      mv002CorrelationId: "corr-mv001-paid",
      mv001IdempotencyKey: "idem-mv001",
      mv002IdempotencyKey: "idem-mv001",
    }),
  );
  assert.doesNotThrow(() =>
    assertMv002IdempotencyIsolated({
      mv001CorrelationId: "corr-mv001-paid",
      mv002CorrelationId: "corr-mv002-design",
      mv001IdempotencyKey: "idem-mv001",
      mv002IdempotencyKey: "idem-mv002",
    }),
  );
});

test("MT-015A Registry remains disabled / UNVERIFIED", () => {
  assertMv002RegistryRemainsDisabled();
  assert.equal(FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled, false);
  assert.equal(FAL_KLING_V3_PRO_REGISTRY_PROFILE.paidExecution, false);
  assert.equal(FAL_KLING_V3_PRO_REGISTRY_PROFILE.status, "UNVERIFIED");
});

test("MT-015A human decisions allow-list — no implicit retry", () => {
  assert.deepEqual([...MV002_HUMAN_DECISIONS], [
    "APPROVE",
    "REJECT",
    "RETRY_WITH_UPDATED_CONSTRAINTS",
    "REQUEST_NEW_REFERENCE",
  ]);
  assert.equal(MV002_HUMAN_DECISIONS.includes("RETRY_SAME_REFERENCE" as never), false);
});
