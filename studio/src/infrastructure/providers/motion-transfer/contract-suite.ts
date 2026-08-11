/**
 * Reusable Motion Transfer provider contract suite (MT-006).
 * Mandatory gate for MT-007 real adapters — pass with a factory that builds the port.
 *
 * Usage:
 *   runMotionTransferProviderContractSuite(() => createFakeMotionTransferProvider(...))
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MotionTransferCancelResultSchema,
  MotionTransferEstimateSchema,
  MotionTransferStatusSchema,
  MotionTransferSubmissionSchema,
  assertNoSignedUrlLeak,
  isMotionTransferDomainError,
  type MotionTransferProviderContext,
  type MotionTransferProviderPort,
  type MotionTransferProviderSubmitInput,
} from "@/domain/motion";
import { makeMinimalInput } from "@/domain/motion/__tests__/fixtures";

export type MotionTransferContractSuiteOptions = {
  /** Suite label prefix. */
  name?: string;
  /**
   * Factory must return a fresh port configured for happy-path async success
   * with cancel supported, unless overridden by specialized factories.
   */
  createHappyPathPort: () => MotionTransferProviderPort;
  createDuplicateSubmitPort?: () => MotionTransferProviderPort;
  createCancelUnsupportedPort?: () => MotionTransferProviderPort;
  createUnknownStatusPort?: () => MotionTransferProviderPort;
};

function baseContext(
  over: Partial<MotionTransferProviderContext> = {},
): MotionTransferProviderContext {
  return {
    correlationId: "corr-mt006-contract",
    workspaceId: "ws-mt006",
    projectId: "proj-mt006",
    attempt: 1,
    idempotencyKey: over.idempotencyKey ?? "idem-mt006-contract-1",
    providerId: over.providerId ?? "fake-motion-transfer",
    modelId: over.modelId ?? "synthetic-motion-v1",
    timeoutMs: 30_000,
    requestedAt: "2026-08-11T12:00:00.000Z",
    ...over,
  };
}

function submitInput(
  port: MotionTransferProviderPort,
  estimate: Awaited<ReturnType<MotionTransferProviderPort["estimate"]>>,
): MotionTransferProviderSubmitInput {
  const motion = makeMinimalInput();
  return {
    motion,
    providerId: port.providerId,
    modelId: port.supportedModelIds[0]!,
    estimate,
    attempt: 1,
    mediaBoundary: {
      sourceVideoRef: "ref:source",
      identityRefs: ["ref:id-1"],
      outfitRef: "ref:outfit",
    },
    outputConstraints: motion.output,
    reviewPolicyProvenance: { humanValidationRequired: true },
  };
}

/**
 * Registers node:test cases. Call from a test file (side-effect registration).
 */
export function runMotionTransferProviderContractSuite(
  options: MotionTransferContractSuiteOptions,
): void {
  const label = options.name ?? "MotionTransferProviderPort";

  test(`${label} — estimate firm deterministic shape`, async () => {
    const port = options.createHappyPathPort();
    const estimate = await port.estimate(
      {
        motion: makeMinimalInput(),
        billableDurationSeconds: 8,
        currency: "USD",
      },
      baseContext({ providerId: port.providerId, modelId: port.supportedModelIds[0] }),
    );
    const parsed = MotionTransferEstimateSchema.safeParse(estimate);
    assert.equal(parsed.success, true);
    assert.equal(estimate.mode, "firm");
    assert.ok(Number.isInteger(estimate.estimatedCostMinor));
    assert.ok(estimate.estimatedCostMinor >= 0);
    assert.equal(estimate.currency.length, 3);
    assertNoSignedUrlLeak(estimate);
    assert.ok(Object.isFrozen(estimate));
  });

  test(`${label} — submit returns stable providerJobId`, async () => {
    const port = options.createHappyPathPort();
    const ctx = baseContext({
      providerId: port.providerId,
      modelId: port.supportedModelIds[0],
      idempotencyKey: "idem-submit-1",
    });
    const estimate = await port.estimate(
      { motion: makeMinimalInput(), billableDurationSeconds: 8, currency: "USD" },
      ctx,
    );
    const sub = await port.submit(submitInput(port, estimate), ctx);
    const parsed = MotionTransferSubmissionSchema.safeParse(sub);
    assert.equal(parsed.success, true);
    assert.ok(sub.providerJobId.length > 0);
    assert.equal(sub.status, "submitted");
    assertNoSignedUrlLeak(sub);
    assert.ok(Object.isFrozen(sub));
  });

  test(`${label} — duplicate submit is idempotent (same providerJobId)`, async () => {
    const factory =
      options.createDuplicateSubmitPort ?? options.createHappyPathPort;
    const port = factory();
    const ctx = baseContext({
      providerId: port.providerId,
      modelId: port.supportedModelIds[0],
      idempotencyKey: "idem-dup-1",
    });
    const estimate = await port.estimate(
      { motion: makeMinimalInput(), billableDurationSeconds: 8, currency: "USD" },
      ctx,
    );
    const a = await port.submit(submitInput(port, estimate), ctx);
    const b = await port.submit(submitInput(port, estimate), ctx);
    assert.equal(a.providerJobId, b.providerJobId);
  });

  test(`${label} — poll advances without resubmit; terminal has descriptors`, async () => {
    const port = options.createHappyPathPort();
    const counters = (
      port as MotionTransferProviderPort & {
        counters?: { submit: number; poll: number };
      }
    ).counters;
    const ctx = baseContext({
      providerId: port.providerId,
      modelId: port.supportedModelIds[0],
      idempotencyKey: "idem-poll-1",
    });
    const estimate = await port.estimate(
      { motion: makeMinimalInput(), billableDurationSeconds: 8, currency: "USD" },
      ctx,
    );
    const sub = await port.submit(submitInput(port, estimate), ctx);
    const submitCountAfter = counters?.submit;

    let status = await port.poll({ providerJobId: sub.providerJobId }, ctx);
    let guard = 0;
    while (
      status.status === "queued" ||
      status.status === "processing"
    ) {
      status = await port.poll({ providerJobId: sub.providerJobId }, ctx);
      guard += 1;
      assert.ok(guard < 10, "poll loop runaway");
    }
    const parsed = MotionTransferStatusSchema.safeParse(status);
    assert.equal(parsed.success, true);
    assert.equal(status.status, "completed");
    assert.ok(status.output);
    assert.ok(!/^https?:\/\//i.test(status.output!.providerOutputRef));
    assertNoSignedUrlLeak(status);
    if (counters && submitCountAfter != null) {
      assert.equal(counters.submit, submitCountAfter, "poll must not resubmit");
      assert.ok(counters.poll >= 1);
    }
  });

  test(`${label} — cancel supported or typed unsupported`, async () => {
    const port = options.createHappyPathPort();
    if (!port.cancel) {
      assert.ok(true, "cancel optional — absent is typed unsupported at adapter level");
      return;
    }
    const ctx = baseContext({
      providerId: port.providerId,
      modelId: port.supportedModelIds[0],
      idempotencyKey: "idem-cancel-1",
    });
    const estimate = await port.estimate(
      { motion: makeMinimalInput(), billableDurationSeconds: 8, currency: "USD" },
      ctx,
    );
    const sub = await port.submit(submitInput(port, estimate), ctx);
    const result = await port.cancel!({ providerJobId: sub.providerJobId }, ctx);
    const parsed = MotionTransferCancelResultSchema.safeParse(result);
    assert.equal(parsed.success, true);
    assert.ok(
      ["cancelled", "cancel_unsupported", "already_terminal", "cancel_failed"].includes(
        result.status,
      ),
    );
    assertNoSignedUrlLeak(result);
  });

  test(`${label} — cancel unsupported is typed (not false success)`, async () => {
    if (!options.createCancelUnsupportedPort) return;
    const port = options.createCancelUnsupportedPort();
    if (!port.cancel) return;
    const ctx = baseContext({
      providerId: port.providerId,
      modelId: port.supportedModelIds[0],
      idempotencyKey: "idem-cancel-unsup",
    });
    const estimate = await port.estimate(
      { motion: makeMinimalInput(), billableDurationSeconds: 8, currency: "USD" },
      ctx,
    );
    const sub = await port.submit(submitInput(port, estimate), ctx);
    const result = await port.cancel!({ providerJobId: sub.providerJobId }, ctx);
    assert.equal(result.status, "cancel_unsupported");
  });

  test(`${label} — unknown provider status fail-closed`, async () => {
    if (!options.createUnknownStatusPort) return;
    const port = options.createUnknownStatusPort();
    const ctx = baseContext({
      providerId: port.providerId,
      modelId: port.supportedModelIds[0],
      idempotencyKey: "idem-unknown-status",
    });
    const estimate = await port.estimate(
      { motion: makeMinimalInput(), billableDurationSeconds: 8, currency: "USD" },
      ctx,
    );
    const sub = await port.submit(submitInput(port, estimate), ctx);
    await port.poll({ providerJobId: sub.providerJobId }, ctx);
    await assert.rejects(
      () => port.poll({ providerJobId: sub.providerJobId }, ctx),
      (e: unknown) =>
        isMotionTransferDomainError(e) && e.code === "provider_status_unknown",
    );
  });

  test(`${label} — no media / signed URL leak in public surfaces`, async () => {
    const port = options.createHappyPathPort();
    const ctx = baseContext({
      providerId: port.providerId,
      modelId: port.supportedModelIds[0],
      idempotencyKey: "idem-redact-1",
    });
    const estimate = await port.estimate(
      { motion: makeMinimalInput(), billableDurationSeconds: 8, currency: "USD" },
      ctx,
    );
    const sub = await port.submit(submitInput(port, estimate), ctx);
    const blob = JSON.stringify({ estimate, sub });
    assert.equal(/https:\/\//i.test(blob), false);
    assert.equal(/data:[^;]+;base64,/i.test(blob), false);
    assert.equal(/\bsk-[A-Za-z0-9]{10,}/i.test(blob), false);
  });
}
