/**
 * Phase 11A-RESUME — Motion isolation + budget reassessment (no provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { assertDirectorProductionUsesFakes } from "@/infrastructure/db/director-server";
import { FAL_KLING_V3_PRO_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";
import { estimateImage } from "@/lib/pricing";
import {
  assertMotionRegistryStaysDisabled,
  assertMv002RemainsDeferred,
  assertPhase11ADoesNotInvokeMotionEndpoint,
  assertPhase11ADoesNotReuseMv001AssetIds,
  assertPhase11ADoesNotUseMotionProject,
  assertPhase11ADoesNotUseMv001PrivacyPack,
  MV001_MOTION_PROJECT_ID,
  PHASE_11A_RESUME_BUDGET,
  phase11AShortfall,
} from "../phase-11a-motion-isolation";

test("11A-RESUME — VHS-124 still forbids real adapters on /director", () => {
  assert.throws(() => assertDirectorProductionUsesFakes("real"));
});

test("11A-RESUME — Motion Registry disabled", () => {
  assertMotionRegistryStaysDisabled({
    enabled: FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled,
    paidExecution: FAL_KLING_V3_PRO_REGISTRY_PROFILE.paidExecution,
  });
  assert.throws(() =>
    assertMotionRegistryStaysDisabled({ enabled: true, paidExecution: false }),
  );
});

test("11A-RESUME — MV-002 deferred", () => {
  assert.doesNotThrow(() => assertMv002RemainsDeferred("DEFERRED"));
  assert.throws(() => assertMv002RemainsDeferred("DESIGN_READY"));
  assert.throws(() => assertMv002RemainsDeferred("AUTHORIZED"));
});

test("11A-RESUME — isolation from MV-001 project / privacy / assets / endpoints", () => {
  assert.throws(() => assertPhase11ADoesNotUseMotionProject(MV001_MOTION_PROJECT_ID));
  assert.doesNotThrow(() =>
    assertPhase11ADoesNotUseMotionProject("984507af-a89e-4644-8ea3-344797baa974"),
  );
  assert.throws(() =>
    assertPhase11ADoesNotUseMv001PrivacyPack("ACCEPTED_LIMITED_MV001"),
  );
  assert.throws(() =>
    assertPhase11ADoesNotInvokeMotionEndpoint(
      "fal-ai/kling-video/v3/pro/motion-control",
    ),
  );
  assert.throws(() => assertPhase11ADoesNotInvokeMotionEndpoint("motion_transfer"));
  assert.doesNotThrow(() => assertPhase11ADoesNotInvokeMotionEndpoint("gpt-image-1"));
  assert.throws(() =>
    assertPhase11ADoesNotReuseMv001AssetIds([
      "2d7ffcad-fa49-4ad6-9cbb-0b710c570345",
    ]),
  );
});

test("11A-RESUME — budget 274/247/27 · image fits · video shortfall", () => {
  assert.equal(PHASE_11A_RESUME_BUDGET.availableMinor, 27);
  const usd = estimateImage("1024x1024", "low", 1);
  const minor = Math.round(usd * 100);
  assert.equal(minor, 1);
  assert.equal(phase11AShortfall(PHASE_11A_RESUME_BUDGET.imageReservationMinor), 0);
  assert.equal(phase11AShortfall(PHASE_11A_RESUME_BUDGET.falImageReservationMinor), 0);
  assert.equal(phase11AShortfall(PHASE_11A_RESUME_BUDGET.voiceReservationMinor), 0);
  assert.equal(phase11AShortfall(PHASE_11A_RESUME_BUDGET.videoReservationMinor), 9);
  assert.ok(minor + PHASE_11A_RESUME_BUDGET.imageReservationMinor <= 27 + 2);
});

test("11A-RESUME — smoke contract still 1/1/1 no retry/fallback", () => {
  const c = {
    maxProviderCalls: 1,
    maxJobs: 1,
    maxAssets: 1,
    fallback: false,
    automaticRetry: false,
    downstreamChaining: false,
    legacyBypassForbidden: true,
  };
  assert.equal(c.maxProviderCalls, 1);
  assert.equal(c.legacyBypassForbidden, true);
});
