/**
 * MT-006 — fake adapter scenarios + Production guard + redaction hostiles.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MotionTransferDomainError,
  isMotionTransferDomainError,
  mapProviderLifecycleStatus,
  createProviderErrorEvidence,
} from "@/domain/motion";
import { makeMinimalInput } from "@/domain/motion/__tests__/fixtures";
import { assertMotionTransferFakeAdapterAllowed } from "../assert-fake-allowed";
import {
  FAKE_MOTION_TRANSFER_MODEL_ID,
  FAKE_MOTION_TRANSFER_PROVIDER_ID,
  createFakeMotionTransferProvider,
} from "../fake-adapter";
import { runMotionTransferProviderContractSuite } from "../contract-suite";

const AT = "2026-08-11T15:00:00.000Z";

function ctx(idempotencyKey: string) {
  return {
    correlationId: "corr-fake",
    workspaceId: "ws-1",
    projectId: "proj-1",
    attempt: 1,
    idempotencyKey,
    providerId: FAKE_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
    timeoutMs: 30_000,
    requestedAt: AT,
  };
}

runMotionTransferProviderContractSuite({
  name: "FakeMotionTransferProvider",
  createHappyPathPort: () =>
    createFakeMotionTransferProvider({
      scenario: {
        kind: "success_async",
        pollSequence: ["queued", "running", "succeeded"],
      },
      nowIso: () => AT,
      env: { NODE_ENV: "test" },
    }),
  createDuplicateSubmitPort: () =>
    createFakeMotionTransferProvider({
      scenario: { kind: "success_async" },
      nowIso: () => AT,
      env: { NODE_ENV: "test" },
    }),
  createCancelUnsupportedPort: () =>
    createFakeMotionTransferProvider({
      scenario: { kind: "cancel_unsupported" },
      nowIso: () => AT,
      env: { NODE_ENV: "test" },
    }),
  createUnknownStatusPort: () =>
    createFakeMotionTransferProvider({
      scenario: { kind: "unknown_status_poll" },
      nowIso: () => AT,
      env: { NODE_ENV: "test" },
    }),
});

test("mapProviderLifecycleStatus — running/succeeded/timed_out", () => {
  assert.equal(mapProviderLifecycleStatus("running"), "processing");
  assert.equal(mapProviderLifecycleStatus("succeeded"), "completed");
  assert.equal(mapProviderLifecycleStatus("timed_out"), "timed_out");
  assert.throws(
    () => mapProviderLifecycleStatus("??"),
    (e: unknown) =>
      isMotionTransferDomainError(e) && e.code === "provider_status_unknown",
  );
});

test("fake Production/Vercel guard — construction forbidden", () => {
  assert.equal(
    assertMotionTransferFakeAdapterAllowed({ VERCEL: "1" }).ok,
    false,
  );
  assert.throws(
    () =>
      createFakeMotionTransferProvider({
        env: { VERCEL: "1" },
      }),
    (e: unknown) =>
      isMotionTransferDomainError(e) && e.code === "provider_not_configured",
  );
  assert.throws(
    () =>
      createFakeMotionTransferProvider({
        env: { NODE_ENV: "production" },
      }),
    (e: unknown) =>
      isMotionTransferDomainError(e) && e.code === "provider_not_configured",
  );
});

test("fake sync success — pollingRequired false", async () => {
  const port = createFakeMotionTransferProvider({
    scenario: { kind: "success_sync" },
    nowIso: () => AT,
    env: { NODE_ENV: "test" },
  });
  const estimate = await port.estimate(
    { motion: makeMinimalInput(), billableDurationSeconds: 5, currency: "USD" },
    ctx("idem-sync"),
  );
  const sub = await port.submit(
    {
      motion: makeMinimalInput(),
      providerId: port.providerId,
      modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
      estimate,
      attempt: 1,
      mediaBoundary: { sourceVideoRef: "s", identityRefs: ["i"] },
      outputConstraints: makeMinimalInput().output,
    },
    ctx("idem-sync"),
  );
  assert.equal(sub.pollingRequired, false);
  assert.equal(sub.syncOrAsync, "sync");
  const status = await port.poll({ providerJobId: sub.providerJobId }, ctx("idem-sync"));
  assert.equal(status.status, "completed");
  assert.equal(port.counters.network, 0);
});

test("fake rate limit / quota / timeout poll", async () => {
  const rate = createFakeMotionTransferProvider({
    scenario: { kind: "rate_limit_submit" },
    nowIso: () => AT,
    env: { NODE_ENV: "test" },
  });
  const est = await rate.estimate(
    { motion: makeMinimalInput(), billableDurationSeconds: 5, currency: "USD" },
    ctx("idem-rl"),
  );
  await assert.rejects(
    () =>
      rate.submit(
        {
          motion: makeMinimalInput(),
          providerId: rate.providerId,
          modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
          estimate: est,
          attempt: 1,
          mediaBoundary: { sourceVideoRef: "s", identityRefs: ["i"] },
          outputConstraints: makeMinimalInput().output,
        },
        ctx("idem-rl"),
      ),
    (e: unknown) =>
      isMotionTransferDomainError(e) && e.code === "provider_rate_limited",
  );

  const quota = createFakeMotionTransferProvider({
    scenario: { kind: "quota_submit" },
    nowIso: () => AT,
    env: { NODE_ENV: "test" },
  });
  const qEst = await quota.estimate(
    { motion: makeMinimalInput(), billableDurationSeconds: 5, currency: "USD" },
    ctx("idem-q"),
  );
  await assert.rejects(
    () =>
      quota.submit(
        {
          motion: makeMinimalInput(),
          providerId: quota.providerId,
          modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
          estimate: qEst,
          attempt: 1,
          mediaBoundary: { sourceVideoRef: "s", identityRefs: ["i"] },
          outputConstraints: makeMinimalInput().output,
        },
        ctx("idem-q"),
      ),
    (e: unknown) =>
      isMotionTransferDomainError(e) && e.code === "provider_quota_exceeded",
  );

  const to = createFakeMotionTransferProvider({
    scenario: { kind: "timeout_poll" },
    nowIso: () => AT,
    env: { NODE_ENV: "test" },
  });
  const tEst = await to.estimate(
    { motion: makeMinimalInput(), billableDurationSeconds: 5, currency: "USD" },
    ctx("idem-to"),
  );
  const sub = await to.submit(
    {
      motion: makeMinimalInput(),
      providerId: to.providerId,
      modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
      estimate: tEst,
      attempt: 1,
      mediaBoundary: { sourceVideoRef: "s", identityRefs: ["i"] },
      outputConstraints: makeMinimalInput().output,
    },
    ctx("idem-to"),
  );
  let status = await to.poll({ providerJobId: sub.providerJobId }, ctx("idem-to"));
  status = await to.poll({ providerJobId: sub.providerJobId }, ctx("idem-to"));
  status = await to.poll({ providerJobId: sub.providerJobId }, ctx("idem-to"));
  assert.equal(status.status, "timed_out");
  assert.equal(status.errorCode, "provider_timeout");
});

test("late result after cancel — quarantine signal", async () => {
  const port = createFakeMotionTransferProvider({
    scenario: { kind: "late_after_cancel" },
    nowIso: () => AT,
    env: { NODE_ENV: "test" },
  });
  const estimate = await port.estimate(
    { motion: makeMinimalInput(), billableDurationSeconds: 5, currency: "USD" },
    ctx("idem-late"),
  );
  const sub = await port.submit(
    {
      motion: makeMinimalInput(),
      providerId: port.providerId,
      modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
      estimate,
      attempt: 1,
      mediaBoundary: { sourceVideoRef: "s", identityRefs: ["i"] },
      outputConstraints: makeMinimalInput().output,
    },
    ctx("idem-late"),
  );
  const cancel = await port.cancel!({ providerJobId: sub.providerJobId }, ctx("idem-late"));
  assert.equal(cancel.status, "cancelled");
  assert.equal(cancel.lateResultExpected, true);
  const late = await port.poll({ providerJobId: sub.providerJobId }, ctx("idem-late"));
  assert.equal(late.errorCode, "late_result_ignored");
});

test("error evidence redacts secrets / URLs", () => {
  const ev = createProviderErrorEvidence({
    code: "provider_auth_failed",
    publicMessage: "boom https://evil.example/signed?X-Amz-Signature=abc sk-abcdefghijklmnopqrstuv",
    providerErrorCode: "Bearer tokensecretvalue",
    providerRequestId: "https://leak.example/x",
    stage: "submit",
    httpStatus: 401,
    networkAttempts: 1,
  });
  assert.equal(/https:\/\//i.test(ev.publicMessage), false);
  assert.equal(/\bsk-[a-z]/i.test(ev.publicMessage), false);
  assert.equal(/https:\/\//i.test(ev.providerRequestId ?? ""), false);
  assert.match(ev.providerErrorCode ?? "", /Bearer \[redacted\]/i);
  assert.ok(!(ev instanceof MotionTransferDomainError));
});

test("refuseEstimate — no invented Production price", async () => {
  const port = createFakeMotionTransferProvider({
    refuseEstimate: true,
    nowIso: () => AT,
    env: { NODE_ENV: "test" },
  });
  await assert.rejects(
    () =>
      port.estimate(
        { motion: makeMinimalInput(), billableDurationSeconds: 5, currency: "USD" },
        ctx("idem-refuse"),
      ),
    (e: unknown) =>
      isMotionTransferDomainError(e) && e.code === "provider_not_configured",
  );
});

test("submit=1 across multi-poll (counters)", async () => {
  const port = createFakeMotionTransferProvider({
    scenario: {
      kind: "success_async",
      pollSequence: ["queued", "running", "succeeded"],
    },
    nowIso: () => AT,
    env: { NODE_ENV: "test" },
  });
  const estimate = await port.estimate(
    { motion: makeMinimalInput(), billableDurationSeconds: 8, currency: "USD" },
    ctx("idem-count"),
  );
  const sub = await port.submit(
    {
      motion: makeMinimalInput(),
      providerId: port.providerId,
      modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
      estimate,
      attempt: 1,
      mediaBoundary: { sourceVideoRef: "s", identityRefs: ["i"] },
      outputConstraints: makeMinimalInput().output,
    },
    ctx("idem-count"),
  );
  await port.poll({ providerJobId: sub.providerJobId }, ctx("idem-count"));
  await port.poll({ providerJobId: sub.providerJobId }, ctx("idem-count"));
  await port.poll({ providerJobId: sub.providerJobId }, ctx("idem-count"));
  assert.equal(port.counters.submit, 1);
  assert.equal(port.counters.poll, 3);
  assert.equal(port.counters.network, 0);
});
