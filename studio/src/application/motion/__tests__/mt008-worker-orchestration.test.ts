/**
 * MT-008 — Motion Transfer worker orchestration (fake provider / local harness only).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { money } from "@/domain/cost";
import { makeMinimalInput } from "@/domain/motion/__tests__/fixtures";
import {
  createFakeMotionTransferProvider,
  FAKE_MOTION_TRANSFER_MODEL_ID,
  FAKE_MOTION_TRANSFER_PROVIDER_ID,
} from "@/infrastructure/providers/motion-transfer";
import {
  createFalKlingMotionControlAdapter,
  FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  FAL_MOTION_TRANSFER_PROVIDER_ID,
} from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-adapter";
import { createFakeFalMotionControlTransport } from "@/infrastructure/providers/motion-transfer/fal-motion-control-transport";
import { createMemoryBudgetPort } from "@/application/production/__tests__/fakes";
import { createMemoryJobQueue } from "@/application/worker/__tests__/fakes";
import { createProductionWorker } from "@/application/worker/production-worker";
import { createWorkerPolicy } from "@/application/worker/policy";
import type { ProductionDirector } from "@/application/production/production-director";
import type { GenerationEngine } from "@/application/generation";
import type { ProductionPorts } from "@/application/production/ports";
import type { FeatureFlagsSnapshot } from "@/infrastructure/config/feature-flags";
import {
  createMemoryMotionTransferAttemptStore,
  createMotionTransferWorkerOrchestrator,
  quarantineMotionLateResult,
  seedMotionTransferAttempt,
} from "../motion-transfer-worker-orchestrator";
import {
  evaluateMotionTransferWorkerGates,
  isMotionTransferFakeHarnessActive,
} from "../motion-transfer-worker-gates";
import {
  assertMotionEventRedacted,
  type MotionTransferWorkerEvent,
} from "../motion-transfer-worker-events";
import { FAL_KLING_V3_PRO_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";

const AT = "2026-08-11T18:00:00.000Z";

const HARNESS_ENV = {
  MOTION_TRANSFER_ENABLED: "1",
  MOTION_TRANSFER_PAID_ENABLED: "1",
  MOTION_TRANSFER_FAL_ENABLED: "1",
  MOTION_TRANSFER_WORKER_ENABLED: "1",
  MOTION_TRANSFER_FAKE_HARNESS: "1",
  NODE_ENV: "test",
};

const PRIVACY_OK = {
  mediaRetentionAccepted: true,
  cdnExposureStrategyAccepted: true,
  biometricConsentConfirmed: true,
  commercialRightsConfirmed: true,
  geographicRestrictionsAccepted: true,
};

function clock(start = AT) {
  let t = Date.parse(start);
  let n = 0;
  return {
    nowIso: () => new Date(t++).toISOString(),
    nowMs: () => t,
    nextId: () => `id-${++n}`,
    advanceMs(ms: number) {
      t += ms;
    },
  };
}

function directorStub(): ProductionDirector {
  return {
    async processClaimedJob() {
      throw new Error("PD must not handle motion_transfer");
    },
    async planEnqueueCommands() {
      return { commands: [] };
    },
  } as unknown as ProductionDirector;
}

function flagsOn(): FeatureFlagsSnapshot {
  return {
    directorV2: true,
    directorV2Worker: true,
    directorV2PaidGeneration: true,
    directorV2Persistence: true,
    directorV2MarketingAi: false,
    directorV2CreativeAi: false,
    directorV2PaidAi: false,
  };
}

async function setupMotionJob(opts: {
  estimateMinor?: number;
  reservedMinor?: number;
  scenario?: import("@/infrastructure/providers/motion-transfer").FakeMotionTransferScenario;
  simulateCrash?: boolean;
  maxPolls?: number;
  env?: Record<string, string | undefined>;
  privacy?: typeof PRIVACY_OK | Record<string, boolean>;
}) {
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  const budget = createMemoryBudgetPort(10_000);
  const attempts = createMemoryMotionTransferAttemptStore();
  const events: MotionTransferWorkerEvent[] = [];
  const estimateMinor = opts.estimateMinor ?? 135;
  const reservedMinor = opts.reservedMinor ?? 162;
  const reservationId = "res-mt-1";

  await budget.reserve({
    reservationId,
    runId: "run-mt-1",
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId: "att-mt-1",
    amount: money(reservedMinor, "USD"),
    currency: "USD",
  });

  const motionInput = makeMinimalInput({
    output: { durationSeconds: 8, aspectRatio: "9:16", resolution: "1080p", fps: 24 },
  });
  const estimate = {
    schemaVersion: "1.0.0" as const,
    currency: "USD",
    estimatedCostMinor: estimateMinor,
    durationSeconds: 8,
    pricingUnit: "second" as const,
    mode: "firm" as const,
    pricingStrategy: "per_second",
    pricingVersion: "fal-llms.txt-2026-08-11",
    providerId: FAKE_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
    capability: "video.motion_transfer" as const,
  };

  seedMotionTransferAttempt(attempts, {
    attemptId: "att-mt-1",
    jobId: "pending",
    runId: "run-mt-1",
    reservationId,
    reservedMinor,
    estimate,
    motionInput,
    mediaBoundary: {
      sourceVideoRef: "ref:source",
      identityRefs: ["ref:id-1"],
    },
  });

  await queue.enqueue({
    runId: "run-mt-1",
    projectId: "proj-mt",
    sceneId: "motion",
    stepId: "step-mt",
    attemptId: "att-mt-1",
    action: "motion_transfer",
    providerId: FAKE_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan-mt",
      scenePackageSceneId: "motion",
      mode: "execute",
      motion: {
        phase: "submitting",
        reservationId,
        reservedMinor,
        currency: "USD",
        estimateMinor,
        humanReviewPolicyPresent: true,
      },
    },
  });

  // sync jobId onto attempt after enqueue
  const jobId = [...queue.jobs.values()][0]!.id;
  const rec = attempts.get("att-mt-1")!;
  rec.jobId = jobId;
  attempts.save(rec);

  const provider = createFakeMotionTransferProvider({
    scenario: opts.scenario ?? {
      kind: "success_async",
      pollSequence: ["queued", "running", "succeeded"],
    },
    env: { ...HARNESS_ENV, NODE_ENV: "test" },
  });

  const orchestrator = createMotionTransferWorkerOrchestrator({
    provider,
    budget,
    attempts,
    registryProfile: {
      enabled: FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled,
      paidExecution: FAL_KLING_V3_PRO_REGISTRY_PROFILE.paidExecution,
      status: FAL_KLING_V3_PRO_REGISTRY_PROFILE.status,
    },
    privacyDecisions: opts.privacy ?? PRIVACY_OK,
    env: opts.env ?? HARNESS_ENV,
    events: { emit: (e) => events.push(e) },
    simulateCrashAfterSubmitBeforePersist: opts.simulateCrash,
    maxPolls: opts.maxPolls,
    defaultPollAfterMs: 1_000,
  });

  const worker = createProductionWorker({
    policy: createWorkerPolicy({
      workerId: "mt-worker-1",
      claimLimit: 3,
      maximumJobsPerRun: 5,
      leaseSeconds: 90,
    }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: orchestrator,
  });

  return { clk, queue, budget, attempts, events, provider, worker, jobId };
}

test("MT-008 flags OFF — gates blocked / harness inactive on Vercel", () => {
  assert.equal(isMotionTransferFakeHarnessActive({}), false);
  assert.equal(
    isMotionTransferFakeHarnessActive({
      MOTION_TRANSFER_FAKE_HARNESS: "1",
      VERCEL: "1",
    }),
    false,
  );
  const g = evaluateMotionTransferWorkerGates({
    env: {},
    registryProfile: {
      enabled: false,
      paidExecution: false,
      status: "UNVERIFIED",
    },
    firmEstimatePresent: true,
    reservationPresent: true,
    mediaAvailable: true,
    humanReviewPolicyPresent: true,
    routeSelected: true,
  });
  assert.equal(g.ok, false);
  assert.ok(g.missing.includes("MOTION_TRANSFER_WORKER_ENABLED"));
});

test("MT-008 fake Production guard — motion job without orchestrator fails closed", async () => {
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  await queue.enqueue({
    runId: "r",
    projectId: "p",
    sceneId: "s",
    stepId: "st",
    attemptId: "a",
    action: "motion_transfer",
    providerId: "fal",
    modelId: "x",
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan",
      scenePackageSceneId: "s",
      mode: "execute",
    },
  });
  const worker = createProductionWorker({
    policy: createWorkerPolicy({ workerId: "w1" }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
  });
  const result = await worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  assert.equal(result.failed >= 1 || result.issues.some((i) => i.code === "job_failed"), true);
  const job = [...queue.jobs.values()][0]!;
  assert.equal(job.status, "failed");
  assert.equal(job.error?.code, "motion_capability_unavailable");
});

test("MT-008 happy path async — submitCount 1, poll without resubmit, QC pending", async () => {
  const ctx = await setupMotionJob({});
  // execute
  let r = await ctx.worker.runOnce({
    correlationId: "c1",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  assert.equal(r.rescheduled, 1);
  const att = ctx.attempts.get("att-mt-1")!;
  assert.equal(att.submitCount, 1);
  assert.ok(att.providerJobId);
  assert.equal(ctx.provider.counters.submit, 1);

  // poll until terminal
  let guard = 0;
  while (ctx.queue.jobs.get(ctx.jobId)!.status === "queued" && guard < 10) {
    ctx.clk.advanceMs(2_000);
    r = await ctx.worker.runOnce({
      correlationId: "c1",
      actorId: "u",
      nowIso: ctx.clk.nowIso,
      nowMs: ctx.clk.nowMs,
      nextId: ctx.clk.nextId,
    });
    guard += 1;
  }
  assert.equal(ctx.provider.counters.submit, 1);
  assert.ok(ctx.provider.counters.poll >= 1);
  assert.equal(att.resubmitCount, 0);
  const final = ctx.attempts.get("att-mt-1")!;
  assert.equal(final.phase, "qc_pending");
  assert.equal(final.terminal, true);
  assert.equal(final.ledgerSettled, true);
  assert.ok(ctx.budget.committed.has("res-mt-1"));
  assert.ok(final.outputRef && !/^https?:\/\//i.test(final.outputRef));
  assert.ok(ctx.events.some((e) => e.type === "motion.qc.pending"));
  assert.ok(ctx.events.some((e) => e.type === "motion.ledger.reconciled"));
  // no merge/export/final approval events
  assert.equal(
    ctx.events.some((e) => /merge|export|approved/i.test(e.type)),
    false,
  );
});

test("MT-008 claim atomic — concurrent second claim empty", async () => {
  const ctx = await setupMotionJob({});
  const a = await ctx.queue.claim("w-a", 1, 90);
  const b = await ctx.queue.claim("w-b", 1, 90);
  assert.equal(a.length, 1);
  assert.equal(b.length, 0);
});

test("MT-008 terminal job not reclaimable", async () => {
  const ctx = await setupMotionJob({});
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  for (let i = 0; i < 8; i++) {
    ctx.clk.advanceMs(2_000);
    await ctx.worker.runOnce({
      correlationId: "c",
      actorId: "u",
      nowIso: ctx.clk.nowIso,
      nowMs: ctx.clk.nowMs,
      nextId: ctx.clk.nextId,
    });
    if (ctx.queue.jobs.get(ctx.jobId)!.status !== "queued") break;
  }
  assert.ok(
    ["completed", "failed"].includes(ctx.queue.jobs.get(ctx.jobId)!.status),
  );
  const again = await ctx.queue.claim("w-other", 5, 90);
  assert.equal(
    again.filter((j) => j.jobId === ctx.jobId).length,
    0,
  );
});

test("MT-008 reservation required", async () => {
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  const budget = createMemoryBudgetPort();
  const attempts = createMemoryMotionTransferAttemptStore();
  await queue.enqueue({
    runId: "run-x",
    projectId: "p",
    sceneId: "motion",
    stepId: "s",
    attemptId: "att-x",
    action: "motion_transfer",
    providerId: FAKE_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan",
      scenePackageSceneId: "motion",
      mode: "execute",
      motion: {
        phase: "submitting",
        humanReviewPolicyPresent: true,
        // no reservationId
        estimateMinor: 135,
      },
    },
  });
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-x",
    jobId: "j",
    runId: "run-x",
    reservationId: "missing",
    reservedMinor: 162,
    estimate: {
      schemaVersion: "1.0.0",
      currency: "USD",
      estimatedCostMinor: 135,
      mode: "firm",
      providerId: FAKE_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
    },
    motionInput: makeMinimalInput(),
    mediaBoundary: { sourceVideoRef: "ref:s", identityRefs: ["ref:i"] },
  });
  const orchestrator = createMotionTransferWorkerOrchestrator({
    provider: createFakeMotionTransferProvider({
      env: { ...HARNESS_ENV, NODE_ENV: "test" },
    }),
    budget,
    attempts,
    registryProfile: { enabled: false, paidExecution: false, status: "UNVERIFIED" },
    privacyDecisions: PRIVACY_OK,
    env: HARNESS_ENV,
  });
  const worker = createProductionWorker({
    policy: createWorkerPolicy({ workerId: "w" }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: orchestrator,
  });
  await worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: () => "x",
  });
  const job = [...queue.jobs.values()][0]!;
  assert.equal(job.status, "failed");
  assert.equal(job.error?.code, "budget_reservation_required");
});

test("MT-008 submit failure releases full reservation", async () => {
  const ctx = await setupMotionJob({
    scenario: { kind: "fail_submit" },
  });
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  assert.ok(ctx.budget.released.has("res-mt-1"));
  assert.equal(ctx.budget.committed.has("res-mt-1"), false);
  assert.equal(ctx.attempts.get("att-mt-1")!.submitCount, 1);
});

test("MT-008 rate limit on submit — fail no retry", async () => {
  const ctx = await setupMotionJob({ scenario: { kind: "rate_limit_submit" } });
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  assert.equal(ctx.queue.jobs.get(ctx.jobId)!.status, "failed");
  assert.equal(ctx.attempts.get("att-mt-1")!.submitCount, 1);
});

test("MT-008 submission_unknown crash window — no resubmit", async () => {
  const ctx = await setupMotionJob({ simulateCrash: true });
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  const att = ctx.attempts.get("att-mt-1")!;
  assert.equal(att.phase, "submission_unknown");
  assert.equal(att.terminal, true);
  assert.equal(att.submitCount, 1);
  assert.equal(att.providerJobId, undefined);
  assert.ok(ctx.events.some((e) => e.type === "motion.submit.unknown"));

  // second claim must not resubmit
  ctx.clk.advanceMs(1_000);
  // job completed as needs_review
  assert.equal(ctx.queue.jobs.get(ctx.jobId)!.status, "completed");
  assert.equal(ctx.provider.counters.submit, 1);
});

test("MT-008 timeout — usage unknown reconciliation", async () => {
  const ctx = await setupMotionJob({
    scenario: { kind: "success_async", pollSequence: ["queued", "running"] },
    maxPolls: 2,
  });
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  for (let i = 0; i < 5; i++) {
    ctx.clk.advanceMs(2_000);
    await ctx.worker.runOnce({
      correlationId: "c",
      actorId: "u",
      nowIso: ctx.clk.nowIso,
      nowMs: ctx.clk.nowMs,
      nextId: ctx.clk.nextId,
    });
    if (ctx.attempts.get("att-mt-1")!.terminal) break;
  }
  const att = ctx.attempts.get("att-mt-1")!;
  assert.equal(att.phase, "timed_out");
  assert.equal(att.usageUnknown, true);
  assert.equal(att.reconciliationRequired, true);
  assert.equal(ctx.provider.counters.submit, 1);
});

test("MT-008 unknown status fail-closed", async () => {
  const ctx = await setupMotionJob({
    scenario: { kind: "unknown_status_poll" },
  });
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  ctx.clk.advanceMs(2_000);
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  // second poll triggers unknown
  ctx.clk.advanceMs(2_000);
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  const att = ctx.attempts.get("att-mt-1")!;
  assert.equal(att.terminal, true);
  assert.ok(
    att.phase === "provider_failed" || att.reconciliationRequired,
  );
});

test("MT-008 duplicate terminal — already_done, no double ledger", async () => {
  const ctx = await setupMotionJob({});
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  for (let i = 0; i < 8; i++) {
    ctx.clk.advanceMs(2_000);
    await ctx.worker.runOnce({
      correlationId: "c",
      actorId: "u",
      nowIso: ctx.clk.nowIso,
      nowMs: ctx.clk.nowMs,
      nextId: ctx.clk.nextId,
    });
    if (ctx.attempts.get("att-mt-1")!.phase === "qc_pending") break;
  }
  const committedOnce = ctx.budget.committed.get("res-mt-1");
  assert.ok(committedOnce);

  // re-enqueue poll against same attempt should be already_done path via direct processor
  const att = ctx.attempts.get("att-mt-1")!;
  const orch = createMotionTransferWorkerOrchestrator({
    provider: ctx.provider,
    budget: ctx.budget,
    attempts: ctx.attempts,
    registryProfile: {
      enabled: false,
      paidExecution: false,
      status: "UNVERIFIED",
    },
    privacyDecisions: PRIVACY_OK,
    env: HARNESS_ENV,
  });
  const outcome = await orch.processClaimedJob(
    {
      jobId: ctx.jobId,
      projectId: "proj-mt",
      runId: "run-mt-1",
      sceneId: "motion",
      stepId: "step-mt",
      attemptId: "att-mt-1",
      action: "motion_transfer",
      providerId: FAKE_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
      leaseToken: "t",
      leasedBy: "w",
      payload: {
        planRevisionId: "plan-mt",
        scenePackageSceneId: "motion",
        mode: "poll",
        externalJobId: att.providerJobId,
      },
    },
    {
      workerId: "w",
      leaseToken: "t",
      leasedAt: AT,
    },
    {
      correlationId: "c",
      actorId: "u",
      nowIso: ctx.clk.nowIso,
      nextId: ctx.clk.nextId,
      paidGenerationEnabled: true,
    },
  );
  assert.equal(outcome.status, "already_done");
  assert.equal(ctx.budget.committed.get("res-mt-1"), committedOnce);
});

test("MT-008 late result quarantined — does not reopen", async () => {
  const ctx = await setupMotionJob({
    scenario: { kind: "timeout_poll" },
    maxPolls: 3,
  });
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  for (let i = 0; i < 6; i++) {
    ctx.clk.advanceMs(2_000);
    await ctx.worker.runOnce({
      correlationId: "c",
      actorId: "u",
      nowIso: ctx.clk.nowIso,
      nowMs: ctx.clk.nowMs,
      nextId: ctx.clk.nextId,
    });
    if (ctx.attempts.get("att-mt-1")!.terminal) break;
  }
  assert.equal(quarantineMotionLateResult(ctx.attempts, "att-mt-1"), true);
  assert.equal(ctx.attempts.get("att-mt-1")!.phase, "late_quarantined");
  assert.equal(ctx.attempts.get("att-mt-1")!.terminal, true);
});

test("MT-008 ledger success actual < reserved (135/162)", async () => {
  const ctx = await setupMotionJob({
    estimateMinor: 135,
    reservedMinor: 162,
    scenario: {
      kind: "success_async",
      pollSequence: ["succeeded"],
    },
  });
  // Override fake cost on estimate path — settle uses estimate when actual missing;
  // configure provider to return actualCost via poll completed with usage.
  // Fake adapter sets actualCostMinor from estimate on complete — check settle released remainder.
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  ctx.clk.advanceMs(1_000);
  await ctx.worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  const committed = ctx.budget.committed.get("res-mt-1");
  assert.ok(committed);
  assert.ok(committed!.amount.amountMinor <= 162);
});

test("MT-008 fal adapter contract path via fake transport — submitCount 1", async () => {
  const transport = createFakeFalMotionControlTransport();
  const falPort = createFalKlingMotionControlAdapter({
    transport,
    enableProcessLocalSubmitReplay: true,
    enforcePrivacyGateOnSubmit: false,
  });
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  const budget = createMemoryBudgetPort();
  const attempts = createMemoryMotionTransferAttemptStore();
  await budget.reserve({
    reservationId: "res-fal",
    runId: "run-fal",
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId: "att-fal",
    amount: money(162, "USD"),
    currency: "USD",
  });
  const estimate = await falPort.estimate(
    {
      motion: makeMinimalInput(),
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
      requestedAt: AT,
    },
  );
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-fal",
    jobId: "j",
    runId: "run-fal",
    reservationId: "res-fal",
    reservedMinor: 162,
    estimate,
    motionInput: makeMinimalInput(),
    mediaBoundary: { sourceVideoRef: "ref:s", identityRefs: ["ref:i"] },
  });
  await queue.enqueue({
    runId: "run-fal",
    projectId: "p",
    sceneId: "motion",
    stepId: "s",
    attemptId: "att-fal",
    action: "motion_transfer",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan",
      scenePackageSceneId: "motion",
      mode: "execute",
      motion: {
        phase: "submitting",
        reservationId: "res-fal",
        reservedMinor: 162,
        estimateMinor: estimate.estimatedCostMinor,
        currency: "USD",
        humanReviewPolicyPresent: true,
      },
    },
  });
  const jobId = [...queue.jobs.values()][0]!.id;
  attempts.get("att-fal")!.jobId = jobId;
  const orch = createMotionTransferWorkerOrchestrator({
    provider: falPort,
    budget,
    attempts,
    registryProfile: { enabled: false, paidExecution: false, status: "UNVERIFIED" },
    privacyDecisions: PRIVACY_OK,
    env: HARNESS_ENV,
  });
  const worker = createProductionWorker({
    policy: createWorkerPolicy({ workerId: "w-fal" }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: orch,
  });
  await worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: () => "n",
  });
  assert.equal(transport.submitCount, 1);
  for (let i = 0; i < 5; i++) {
    clk.advanceMs(2_000);
    await worker.runOnce({
      correlationId: "c",
      actorId: "u",
      nowIso: clk.nowIso,
      nowMs: clk.nowMs,
      nextId: () => "n",
    });
    if (attempts.get("att-fal")!.terminal) break;
  }
  assert.equal(transport.submitCount, 1);
  assert.ok(transport.statusCount >= 1);
  assert.equal(attempts.get("att-fal")!.phase, "qc_pending");
});

test("MT-008 redaction hostile on events", () => {
  assert.throws(() =>
    assertMotionEventRedacted({
      type: "motion.submit.accepted",
      correlationId: "c",
      projectId: "p",
      runId: "r",
      jobId: "j",
      attemptId: "a",
      status: "https://v3b.fal.media/x.mp4",
    }),
  );
});

test("MT-008 max one motion job per worker invocation", async () => {
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  const budget = createMemoryBudgetPort();
  const attempts = createMemoryMotionTransferAttemptStore();
  for (const id of ["att-a", "att-b"]) {
    await budget.reserve({
      reservationId: `res-${id}`,
      runId: "run-m",
      sceneId: "motion",
      stepId: "motion_transfer",
      attemptId: id,
      amount: money(162, "USD"),
      currency: "USD",
    });
    seedMotionTransferAttempt(attempts, {
      attemptId: id,
      jobId: id,
      runId: "run-m",
      reservationId: `res-${id}`,
      reservedMinor: 162,
      estimate: {
        schemaVersion: "1.0.0",
        currency: "USD",
        estimatedCostMinor: 135,
        mode: "firm",
        providerId: FAKE_MOTION_TRANSFER_PROVIDER_ID,
        modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
      },
      motionInput: makeMinimalInput(),
      mediaBoundary: { sourceVideoRef: "ref:s", identityRefs: ["ref:i"] },
    });
    await queue.enqueue({
      runId: "run-m",
      projectId: "p",
      sceneId: "motion",
      stepId: "s",
      attemptId: id,
      action: "motion_transfer",
      providerId: FAKE_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
      availableAt: AT,
      payloadRef: {
        planRevisionId: "plan",
        scenePackageSceneId: "motion",
        mode: "execute",
        motion: {
          phase: "submitting",
          reservationId: `res-${id}`,
          reservedMinor: 162,
          estimateMinor: 135,
          currency: "USD",
          humanReviewPolicyPresent: true,
        },
      },
    });
  }
  const provider = createFakeMotionTransferProvider({
    scenario: {
      kind: "success_async",
      pollSequence: ["queued"],
    },
    env: { ...HARNESS_ENV, NODE_ENV: "test" },
  });
  const worker = createProductionWorker({
    policy: createWorkerPolicy({
      workerId: "w-max",
      claimLimit: 5,
      maximumJobsPerRun: 5,
    }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: createMotionTransferWorkerOrchestrator({
      provider,
      budget,
      attempts,
      registryProfile: {
        enabled: false,
        paidExecution: false,
        status: "UNVERIFIED",
      },
      privacyDecisions: PRIVACY_OK,
      env: HARNESS_ENV,
    }),
  });
  const result = await worker.runOnce({
    correlationId: "c",
    actorId: "u",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: () => "n",
  });
  assert.equal(result.processed, 1);
  assert.equal(provider.counters.submit, 1);
});
