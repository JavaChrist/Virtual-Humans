/**
 * MT-007B — fal Kling motion-control adapter (fake transport only).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { isMotionTransferDomainError } from "@/domain/motion";
import { makeMinimalInput as makeMotion } from "@/domain/motion/__tests__/fixtures";
import { FAL_KLING_V3_PRO_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";
import {
  computeFalKlingV3ProCostMinorUnchecked,
  createFalKlingMotionControlAdapter,
  FAL_KLING_V3_PRO_MAX_DURATION_VIDEO_SECONDS,
  FAL_KLING_V3_PRO_MIN_DURATION_SECONDS,
  FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  FAL_MOTION_TRANSFER_PROVIDER_ID,
  mapFalTransportErrorToEvidence,
} from "../fal-kling-motion-control-adapter";
import { runMotionTransferProviderContractSuite } from "../contract-suite";
import { createFakeFalMotionControlTransport } from "../fal-motion-control-transport";
import { resolveFalKlingMotionControlAdapter } from "../fal-kling-motion-control-resolver";
import {
  evaluateMotionTransferPrivacyGate,
  isMotionTransferPrivacyGateBlocked,
} from "../privacy-gate";
import {
  canResolveFalMotionTransferAdapter,
  getMotionTransferFlags,
} from "../motion-transfer-flags";
import { createFalAdapter } from "@/infrastructure/providers/fal-adapter";

function makePort(
  transport = createFakeFalMotionControlTransport(),
) {
  return createFalKlingMotionControlAdapter({
    transport,
    enableProcessLocalSubmitReplay: true,
    enforcePrivacyGateOnSubmit: false,
  });
}

runMotionTransferProviderContractSuite({
  name: "FalKlingMotionControlAdapter",
  createHappyPathPort: () => makePort(),
  createDuplicateSubmitPort: () => makePort(),
  createCancelUnsupportedPort: () => makePort(),
  createUnknownStatusPort: () =>
    makePort(
      createFakeFalMotionControlTransport({
        statusSequence: ["IN_QUEUE", "IN_PROGRESS"],
        unknownStatusAfterCalls: 2,
      }),
    ),
});

test("MT-007B pricing formula — 1s/8s/10s/30s without float drift", () => {
  assert.equal(computeFalKlingV3ProCostMinorUnchecked(1), 17);
  assert.equal(computeFalKlingV3ProCostMinorUnchecked(8), 135);
  assert.equal(computeFalKlingV3ProCostMinorUnchecked(10), 168);
  assert.equal(
    computeFalKlingV3ProCostMinorUnchecked(
      FAL_KLING_V3_PRO_MAX_DURATION_VIDEO_SECONDS,
    ),
    504,
  );
});

test("MT-007B estimate refuses below official min duration (3s)", async () => {
  const port = makePort();
  await assert.rejects(
    () =>
      port.estimate(
        {
          motion: makeMotion(),
          billableDurationSeconds: 1,
          currency: "USD",
        },
        {
          correlationId: "c",
          workspaceId: "w",
          projectId: "p",
          attempt: 1,
          idempotencyKey: "i",
          providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
          modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
          timeoutMs: 30_000,
          requestedAt: "2026-08-11T12:00:00.000Z",
        },
      ),
    (e: unknown) =>
      isMotionTransferDomainError(e) && e.code === "provider_invalid_request",
  );
  assert.equal(FAL_KLING_V3_PRO_MIN_DURATION_SECONDS, 3);
});

test("MT-007B estimate firm 8s = 135¢", async () => {
  const port = makePort();
  const estimate = await port.estimate(
    {
      motion: makeMotion(),
      billableDurationSeconds: 8,
      currency: "USD",
    },
    {
      correlationId: "c",
      workspaceId: "w",
      projectId: "p",
      attempt: 1,
      idempotencyKey: "i",
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      timeoutMs: 30_000,
      requestedAt: "2026-08-11T12:00:00.000Z",
    },
  );
  assert.equal(estimate.mode, "firm");
  assert.equal(estimate.estimatedCostMinor, 135);
  assert.equal(estimate.pricingVersion, "fal-llms.txt-2026-08-11");
});

test("MT-007B outfitLock=required blocks submit", async () => {
  const port = makePort();
  const ctx = {
    correlationId: "c",
    workspaceId: "w",
    projectId: "p",
    attempt: 1,
    idempotencyKey: "outfit-req",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    timeoutMs: 30_000,
    requestedAt: "2026-08-11T12:00:00.000Z",
  };
  const estimate = await port.estimate(
    { motion: makeMotion(), billableDurationSeconds: 8, currency: "USD" },
    ctx,
  );
  const motion = makeMotion({
    character: {
      characterId: "mei",
      identityReferences: makeMotion().character.identityReferences,
      identityLock: "required",
      outfitLock: "required",
      outfitReference: makeMotion().character.outfitReference,
    },
  });
  await assert.rejects(
    () =>
      port.submit(
        {
          motion,
          providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
          modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
          estimate,
          attempt: 1,
          mediaBoundary: {
            sourceVideoRef: "ref:source",
            identityRefs: ["ref:id-1"],
            outfitRef: "ref:outfit",
          },
          outputConstraints: motion.output,
        },
        ctx,
      ),
    (e: unknown) =>
      isMotionTransferDomainError(e) && e.code === "provider_invalid_request",
  );
});

test("MT-007B data URL boundary rejected", async () => {
  const port = makePort();
  const ctx = {
    correlationId: "c",
    workspaceId: "w",
    projectId: "p",
    attempt: 1,
    idempotencyKey: "data-url",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    timeoutMs: 30_000,
    requestedAt: "2026-08-11T12:00:00.000Z",
  };
  const estimate = await port.estimate(
    { motion: makeMotion(), billableDurationSeconds: 8, currency: "USD" },
    ctx,
  );
  await assert.rejects(
    () =>
      port.submit(
        {
          motion: makeMotion(),
          providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
          modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
          estimate,
          attempt: 1,
          mediaBoundary: {
            sourceVideoRef: "data:video/mp4;base64,AAAA",
            identityRefs: ["ref:id-1"],
          },
          outputConstraints: makeMotion().output,
        },
        ctx,
      ),
    (e: unknown) =>
      isMotionTransferDomainError(e) && e.code === "provider_invalid_request",
  );
});

test("MT-007B no fallback to alternate endpoints", async () => {
  const port = makePort();
  const ctx = {
    correlationId: "c",
    workspaceId: "w",
    projectId: "p",
    attempt: 1,
    idempotencyKey: "no-fallback",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: "fal-ai/kling-video/v2.6/standard/motion-control",
    timeoutMs: 30_000,
    requestedAt: "2026-08-11T12:00:00.000Z",
  };
  const estimate = await port.estimate(
    { motion: makeMotion(), billableDurationSeconds: 8, currency: "USD" },
    ctx,
  );
  await assert.rejects(
    () =>
      port.submit(
        {
          motion: makeMotion(),
          providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
          modelId: "fal-ai/kling-video/v2.6/standard/motion-control",
          estimate,
          attempt: 1,
          mediaBoundary: {
            sourceVideoRef: "ref:source",
            identityRefs: ["ref:id-1"],
          },
          outputConstraints: makeMotion().output,
        },
        ctx,
      ),
    (e: unknown) =>
      isMotionTransferDomainError(e) && e.code === "model_not_supported",
  );
});

test("MT-007B poll does not resubmit — submitCount stays 1", async () => {
  const transport = createFakeFalMotionControlTransport();
  const port = makePort(transport);
  const ctx = {
    correlationId: "c",
    workspaceId: "w",
    projectId: "p",
    attempt: 1,
    idempotencyKey: "poll-once",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    timeoutMs: 30_000,
    requestedAt: "2026-08-11T12:00:00.000Z",
  };
  const estimate = await port.estimate(
    { motion: makeMotion(), billableDurationSeconds: 8, currency: "USD" },
    ctx,
  );
  const sub = await port.submit(
    {
      motion: makeMotion(),
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      estimate,
      attempt: 1,
      mediaBoundary: {
        sourceVideoRef: "ref:source",
        identityRefs: ["ref:id-1"],
      },
      outputConstraints: makeMotion().output,
    },
    ctx,
  );
  assert.equal(transport.submitCount, 1);
  let status = await port.poll({ providerJobId: sub.providerJobId }, ctx);
  while (status.status === "queued" || status.status === "processing") {
    status = await port.poll({ providerJobId: sub.providerJobId }, ctx);
  }
  assert.equal(status.status, "completed");
  assert.equal(transport.submitCount, 1);
  assert.ok(status.output?.providerOutputRef.startsWith("fal-out:"));
  assert.equal(/^https?:\/\//i.test(status.output!.providerOutputRef), false);
  const blob = JSON.stringify(status);
  assert.equal(/v3b\.fal\.media/i.test(blob), false);
});

test("MT-007B cancel → cancel_unsupported + lateResultExpected", async () => {
  const port = makePort();
  const ctx = {
    correlationId: "c",
    workspaceId: "w",
    projectId: "p",
    attempt: 1,
    idempotencyKey: "cancel",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    timeoutMs: 30_000,
    requestedAt: "2026-08-11T12:00:00.000Z",
  };
  const estimate = await port.estimate(
    { motion: makeMotion(), billableDurationSeconds: 8, currency: "USD" },
    ctx,
  );
  const sub = await port.submit(
    {
      motion: makeMotion(),
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      estimate,
      attempt: 1,
      mediaBoundary: {
        sourceVideoRef: "ref:source",
        identityRefs: ["ref:id-1"],
      },
      outputConstraints: makeMotion().output,
    },
    ctx,
  );
  const cancel = await port.cancel!({ providerJobId: sub.providerJobId }, ctx);
  assert.equal(cancel.status, "cancel_unsupported");
  assert.equal(cancel.lateResultExpected, true);
});

test("MT-007B hostile error evidence redacts URLs and secrets", () => {
  const ev = mapFalTransportErrorToEvidence(
    {
      falTransportError: {
        httpStatus: 401,
        message:
          "auth failed https://v3b.fal.media/secret.mp4 sk-TESTONLYFAKEKEYVALUE000 Bearer tok123",
        providerErrorCode: "unauthorized",
      },
    },
    "submit",
    1,
  );
  const blob = JSON.stringify(ev);
  assert.equal(/https?:\/\//i.test(blob), false);
  assert.equal(/\bsk-[A-Za-z0-9]{10,}/i.test(blob), false);
  assert.equal(ev.code, "provider_auth_failed");
});

test("MT-007B rate limit / quota mapping", () => {
  assert.equal(
    mapFalTransportErrorToEvidence(
      { falTransportError: { httpStatus: 429, message: "slow down" } },
      "submit",
      1,
    ).code,
    "provider_rate_limited",
  );
  assert.equal(
    mapFalTransportErrorToEvidence(
      { falTransportError: { httpStatus: 402, message: "quota" } },
      "submit",
      1,
    ).code,
    "provider_quota_exceeded",
  );
});

test("MT-007B flags default OFF — resolver unavailable", () => {
  const flags = getMotionTransferFlags({});
  assert.equal(flags.motionTransferEnabled, false);
  assert.equal(flags.motionTransferPaidEnabled, false);
  assert.equal(flags.motionTransferFalEnabled, false);
  assert.equal(canResolveFalMotionTransferAdapter({}), false);

  const resolved = resolveFalKlingMotionControlAdapter({
    env: {},
    requireLiveGates: true,
  });
  assert.equal(resolved.ok, false);
  if (!resolved.ok) assert.equal(resolved.reason, "flags_incomplete");
});

test("MT-007B privacy gate default blocked", () => {
  assert.equal(isMotionTransferPrivacyGateBlocked({}), true);
  const ev = evaluateMotionTransferPrivacyGate({});
  assert.equal(ev.status, "blocked");
  assert.ok(ev.missing.length >= 5);
});

test("MT-007B resolver requires privacy even with flags", () => {
  const resolved = resolveFalKlingMotionControlAdapter({
    env: {
      MOTION_TRANSFER_ENABLED: "1",
      MOTION_TRANSFER_PAID_ENABLED: "true",
      MOTION_TRANSFER_FAL_ENABLED: "1",
      FAL_KEY: "fake-not-used",
    },
    privacyDecisions: {},
    requireLiveGates: true,
  });
  assert.equal(resolved.ok, false);
  if (!resolved.ok) assert.equal(resolved.reason, "privacy_gate_blocked");
});

test("MT-007B Registry profile disabled / UNVERIFIED / not Production", () => {
  assert.equal(FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled, false);
  assert.equal(FAL_KLING_V3_PRO_REGISTRY_PROFILE.paidExecution, false);
  assert.equal(FAL_KLING_V3_PRO_REGISTRY_PROFILE.status, "UNVERIFIED");
  assert.equal(
    FAL_KLING_V3_PRO_REGISTRY_PROFILE.motionTransfer.outfitReference,
    "NOT_SUPPORTED",
  );
  assert.equal(
    FAL_KLING_V3_PRO_REGISTRY_PROFILE.motionTransfer.cancellationSupported,
    false,
  );
});

test("MT-007B existing fal ProviderAdapter still does not support motion_transfer", () => {
  const adapter = createFalAdapter({
    submitJob: async () => "x",
    checkJob: async () => ({ status: "IN_QUEUE" }),
  });
  assert.equal(
    adapter.supports(FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID, "motion_transfer"),
    false,
  );
});

test("MT-007B submit maps video_url + image_url on transport", async () => {
  const transport = createFakeFalMotionControlTransport();
  const port = makePort(transport);
  const ctx = {
    correlationId: "c",
    workspaceId: "w",
    projectId: "p",
    attempt: 1,
    idempotencyKey: "map-fields",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    timeoutMs: 30_000,
    requestedAt: "2026-08-11T12:00:00.000Z",
  };
  const estimate = await port.estimate(
    { motion: makeMotion(), billableDurationSeconds: 8, currency: "USD" },
    ctx,
  );
  await port.submit(
    {
      motion: makeMotion({ motion: { ...makeMotion().motion, preserveCamera: true } }),
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      estimate,
      attempt: 1,
      mediaBoundary: {
        sourceVideoRef: "ref:source-vid",
        identityRefs: ["ref:id-1"],
      },
      outputConstraints: makeMotion().output,
    },
    ctx,
  );
  assert.equal(transport.lastSubmitInput?.video_url, "ref:source-vid");
  assert.equal(transport.lastSubmitInput?.image_url, "ref:id-1");
  assert.equal(transport.lastSubmitInput?.character_orientation, "video");
  assert.equal(transport.lastSubmitInput?.keep_original_sound, false);
});
