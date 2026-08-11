/**
 * MT-007A — static spike tests (no network, no secrets, no adapter).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { isMotionTransferDomainError } from "@/domain/motion";
import {
  MT007A_REGISTRY_DESIGN,
  MT007A_RECOMMENDED_MODEL_ID,
  designFalKlingV3ProMotionTransferCaps,
} from "@/domain/routing/capabilities/__tests__/mt007a-fal-kling-registry-design";
import { MotionTransferModelCapabilitiesSchema } from "@/domain/routing/capabilities/motion-transfer";
import { createFalAdapter } from "../../fal-adapter";
import {
  FAL_KLING_CONTRACT_SUITE_FEASIBILITY,
  FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
  VHS_FAL_FALSE_POSITIVE_VIDEO_ENDPOINTS,
  assertNotI2vFalsePositive,
  buildFalKlingV3ProRequestPlan,
  estimateFalKlingIndicativeCostMinor,
  isFalKlingMotionControlEndpoint,
  mapFalQueueStatusToMotionJobStatus,
} from "../fal-kling-motion-control-mapping";

test("MT-007A recommended endpoint is official Kling motion-control v3 pro", () => {
  assert.equal(
    MT007A_RECOMMENDED_MODEL_ID,
    FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
  );
  assert.equal(isFalKlingMotionControlEndpoint(MT007A_RECOMMENDED_MODEL_ID), true);
});

test("MT-007A registry design is disabled / unpaid / schema-valid", () => {
  assert.equal(MT007A_REGISTRY_DESIGN.enabled, false);
  assert.equal(MT007A_REGISTRY_DESIGN.paidExecution, false);
  assert.equal(MT007A_REGISTRY_DESIGN.status, "UNVERIFIED");
  const caps = designFalKlingV3ProMotionTransferCaps();
  const parsed = MotionTransferModelCapabilitiesSchema.safeParse(caps);
  assert.equal(parsed.success, true, parsed.success ? "" : String(parsed.error));
  assert.equal(caps.sourceVideo, "SUPPORTED");
  assert.equal(caps.characterReference, "SUPPORTED");
  assert.equal(caps.cancellationSupported, false);
  assert.equal(caps.motionFidelityLevels.critical, "UNVERIFIED");
});

test("MT-007A mapping plan has no secrets / no live URLs", () => {
  const plan = buildFalKlingV3ProRequestPlan("video");
  const blob = JSON.stringify(plan);
  assert.equal(plan.authBoundary, "server_only_FAL_KEY");
  assert.equal(plan.fields.video_url, "[boundary:source_motion_video]");
  assert.equal(plan.fields.image_url, "[boundary:identity_or_character_image]");
  assert.equal(/https:\/\//i.test(blob), false);
  assert.equal(/FAL_KEY\s*=/i.test(blob), false);
  assert.ok(Object.isFrozen(plan));
});

test("MT-007A fal queue status mapping + unknown fail-closed", () => {
  assert.equal(mapFalQueueStatusToMotionJobStatus("IN_QUEUE"), "queued");
  assert.equal(mapFalQueueStatusToMotionJobStatus("IN_PROGRESS"), "processing");
  assert.equal(mapFalQueueStatusToMotionJobStatus("COMPLETED"), "completed");
  assert.equal(mapFalQueueStatusToMotionJobStatus("FAILED"), "failed");
  assert.throws(
    () => mapFalQueueStatusToMotionJobStatus("WEIRD"),
    (e: unknown) =>
      isMotionTransferDomainError(e) && e.code === "provider_status_unknown",
  );
});

test("MT-007A MV-001 indicative cost from official $/s (no reservation)", () => {
  const smallest = estimateFalKlingIndicativeCostMinor({
    endpointId: FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
    durationSeconds: 1,
  });
  assert.equal(smallest.estimatedCostMinor, 17); // ceil(16.8)
  assert.equal(smallest.mode, "indicative");

  const recommended = estimateFalKlingIndicativeCostMinor({
    endpointId: FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
    durationSeconds: 8,
  });
  // 8 * 0.168 = 1.344 → 135 cents
  assert.equal(recommended.estimatedCostMinor, 135);
  assert.equal(recommended.currency, "USD");
});

test("MT-007A contract-suite feasibility — cancel NOT_SUPPORTED, core DIRECT", () => {
  assert.equal(FAL_KLING_CONTRACT_SUITE_FEASIBILITY.submit, "DIRECT");
  assert.equal(FAL_KLING_CONTRACT_SUITE_FEASIBILITY.poll, "DIRECT");
  assert.equal(FAL_KLING_CONTRACT_SUITE_FEASIBILITY.cancel, "NOT_SUPPORTED");
  assert.equal(FAL_KLING_CONTRACT_SUITE_FEASIBILITY.estimate, "ADAPTER_DERIVED");
});

test("MT-007A anti-I2V — false positives rejected; motion-control accepted", () => {
  for (const id of VHS_FAL_FALSE_POSITIVE_VIDEO_ENDPOINTS) {
    assert.throws(
      () => assertNotI2vFalsePositive(id),
      (e: unknown) =>
        isMotionTransferDomainError(e) && e.code === "model_not_supported",
    );
  }
  assert.doesNotThrow(() =>
    assertNotI2vFalsePositive(FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT),
  );
});

test("MT-007A future adapter absent — fal ProviderAdapter does not support motion_transfer endpoints", () => {
  const adapter = createFalAdapter({
    async submitJob() {
      throw new Error("network_forbidden_in_mt007a");
    },
    async checkJob() {
      throw new Error("network_forbidden_in_mt007a");
    },
  });
  assert.equal(
    adapter.supports(FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT, "motion_transfer"),
    false,
  );
  assert.equal(
    adapter.supports(FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT, "video"),
    false,
  );
  // Existing I2V remains video-only — still not motion_transfer
  assert.equal(
    adapter.supports("fal-ai/kling-video/v2/master/image-to-video", "motion_transfer"),
    false,
  );
});
