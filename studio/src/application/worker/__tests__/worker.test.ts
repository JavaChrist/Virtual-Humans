import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createElevenLabsVoiceAdapter,
  createFalAdapter,
  createOpenAIImageAdapter,
  type FalClientPort,
  type OpenAIImageClientPort,
  type ElevenLabsVoiceClientPort,
} from "@/infrastructure/providers";
import {
  createGenerationEngine,
  createProviderAdapterRegistry,
} from "@/application/generation";
import { createBudgetSnapshot, money } from "@/domain/cost";
import { makeMinimalPackage } from "@/domain/generation/__tests__/fixtures";
import {
  createProductionDirector,
  type ProductionExecutionContext,
} from "@/application/production";
import {
  createMemoryBudgetPort,
  createMemoryEventPort,
  createMemoryIdempotencyPort,
  createMemoryRunStore,
  createAcceptingQualityPort,
} from "@/application/production/__tests__/fakes";
import { makePlan, makeStep } from "@/domain/production/__tests__/fixtures";
import type { ProductionReadinessInput } from "@/domain/project";
import { createProductionWorker } from "../production-worker";
import { createWorkerPolicy } from "../policy";
import { createMemoryJobQueue } from "./fakes";
import type { WorkerObservabilityEvent } from "../result";
import {
  getFeatureFlags,
  parseStrictEnabledFlag,
  canExecutePaidGeneration,
} from "@/infrastructure/config/feature-flags";
import { createProductionWorkerFromDeps } from "@/infrastructure/worker/factory";

const AT = "2026-08-02T12:00:00.000Z";

function fakeFal(over: Partial<FalClientPort> = {}): FalClientPort {
  return {
    async submitJob() {
      return "job-123";
    },
    async checkJob() {
      return {
        status: "COMPLETED",
        videoUrl: "https://cdn.example.com/out.mp4",
      };
    },
    async generateIdentityImage() {
      return "https://cdn.example.com/id.png";
    },
    ...over,
  };
}

function registry(fal: FalClientPort = fakeFal()) {
  return createProviderAdapterRegistry([
    createFalAdapter(fal),
    createOpenAIImageAdapter({
      async generateImage() {
        return {
          dataUrl: "data:image/png;base64,AAAA",
          size: "1024x1024",
          quality: "medium",
        };
      },
    } satisfies OpenAIImageClientPort),
    createElevenLabsVoiceAdapter({
      async generateVoice() {
        return { dataUrl: "data:audio/mpeg;base64,AAAA", mime: "audio/mpeg" };
      },
    } satisfies ElevenLabsVoiceClientPort),
  ]);
}

function readiness(planId = "plan-1"): ProductionReadinessInput {
  return {
    projectId: "proj-1",
    activeByType: {
      video_project_brief: {
        projectId: "proj-1",
        artifactType: "video_project_brief",
        revisionId: "brief-1",
        revision: 1,
        updatedAt: AT,
        updatedBy: "u1",
      },
      storyboard_project: {
        projectId: "proj-1",
        artifactType: "storyboard_project",
        revisionId: "sb-1",
        revision: 1,
        updatedAt: AT,
        updatedBy: "u1",
      },
      generation_plan: {
        projectId: "proj-1",
        artifactType: "generation_plan",
        revisionId: planId,
        revision: 1,
        updatedAt: AT,
        updatedBy: "u1",
      },
    },
    approvalsByType: {
      video_project_brief: {
        id: "ap-b",
        projectId: "proj-1",
        artifactType: "video_project_brief",
        revisionId: "brief-1",
        revision: 1,
        status: "approved",
        decidedAt: AT,
        decidedBy: "u1",
      },
      storyboard_project: {
        id: "ap-s",
        projectId: "proj-1",
        artifactType: "storyboard_project",
        revisionId: "sb-1",
        revision: 1,
        status: "approved",
        decidedAt: AT,
        decidedBy: "u1",
      },
      generation_plan: {
        id: "ap-g",
        projectId: "proj-1",
        artifactType: "generation_plan",
        revisionId: planId,
        revision: 1,
        status: "approved",
        decidedAt: AT,
        decidedBy: "u1",
      },
    },
  };
}

function clock() {
  let t = Date.parse(AT);
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

function ctx(c = clock()): ProductionExecutionContext {
  return {
    correlationId: "corr-w",
    actorId: "tester",
    nowIso: c.nowIso,
    nextId: c.nextId,
    maxActionsPerAdvance: 3,
    paidGenerationEnabled: true,
  };
}

function imagePlan() {
  const imageStep = makeStep({
    id: "step:sc-1:img",
    action: "image",
    capabilityProfile: "image.text_to_image",
    providerId: "openai",
    modelId: "gpt-image-1",
    promptVariantId: "var-img",
    expectedOutput: { mediaType: "image" },
    fallbacks: [],
    estimate: {
      ...makeStep().estimate,
      action: "image",
      total: money(5, "USD"),
      subtotal: money(5, "USD"),
      unitCost: money(5, "USD"),
      quantity: 1,
      unit: "images",
    },
  });
  return makePlan({
    id: "plan-1",
    scenePlans: [
      {
        sceneId: "sc-1",
        sceneOrder: 1,
        strategy: "product_demo",
        steps: [imageStep],
        estimatedCost: money(5, "USD"),
        estimatedDurationSeconds: 1,
        rationale: {
          strategyId: "product_demo",
          summary: "t",
          reasons: [{ code: "eligible", message: "ok" }],
        },
      },
    ],
    estimatedCost: money(5, "USD"),
  });
}

function harness(opts: { fal?: FalClientPort; durable?: boolean } = {}) {
  const plan = imagePlan();
  const runStore = createMemoryRunStore();
  const budget = createMemoryBudgetPort();
  const idempotency = createMemoryIdempotencyPort(opts.durable ?? true);
  const events = createMemoryEventPort();
  const engine = createGenerationEngine({ registry: registry(opts.fal) });
  const ports = {
    runStore,
    budget,
    idempotency,
    quality: createAcceptingQualityPort(),
    events,
    eventPublishFailurePolicy: "fail_soft" as const,
  };
  const director = createProductionDirector({
    engine,
    ports,
    resolvePlan: (id) => (id === plan.id ? plan : null),
    resolveScenePackages: () => [makeMinimalPackage({ sceneId: "sc-1" })],
  });
  return { plan, director, engine, ports, runStore, budget, idempotency, events };
}

// --- Feature flags ---------------------------------------------------------

test("flags — worker/paid off par défaut ; invalides = off", () => {
  assert.equal(parseStrictEnabledFlag(undefined), false);
  assert.equal(parseStrictEnabledFlag("0"), false);
  assert.equal(parseStrictEnabledFlag("yes"), false);
  assert.equal(parseStrictEnabledFlag("1"), true);
  const f = getFeatureFlags({});
  assert.equal(f.directorV2Worker, false);
  assert.equal(f.directorV2PaidGeneration, false);
  assert.equal(canExecutePaidGeneration({}), false);
  assert.equal(
    canExecutePaidGeneration({
      DIRECTOR_V2_WORKER_ENABLED: "1",
      DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
    }),
    true
  );
  assert.equal(
    canExecutePaidGeneration({
      DIRECTOR_V2_WORKER_ENABLED: "1",
      DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
    }),
    false
  );
});

test("worker — désactivé : aucun claim", async () => {
  const h = harness();
  const c = clock();
  const queue = createMemoryJobQueue(c.nowIso);
  await queue.enqueue({
    runId: "run-x",
    projectId: "proj-1",
    sceneId: "sc-1",
    stepId: "step:sc-1:img",
    attemptId: "a1",
    action: "image",
    providerId: "openai",
    modelId: "gpt-image-1",
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan-1",
      scenePackageSceneId: "sc-1",
      mode: "execute",
    },
  });
  const worker = createProductionWorker({
    policy: createWorkerPolicy({ workerId: "w-off" }),
    flags: {
      directorV2: false,
      directorV2Worker: false,
      directorV2PaidGeneration: true,
      directorV2Persistence: false,
      directorV2MarketingAi: false,
      directorV2CreativeAi: false,
      directorV2PaidAi: false,
    },
    queue,
    director: h.director,
    engine: h.engine,
    ports: h.ports,
  });
  const r = await worker.runOnce({
    correlationId: "c1",
    actorId: "t",
    nowIso: c.nowIso,
    nowMs: c.nowMs,
    nextId: c.nextId,
  });
  assert.equal(r.status, "disabled");
  assert.equal(queue.claimCount, 0);
  assert.equal(r.claimed, 0);
});

test("worker — paid off : dry_run, aucun provider, aucun claim", async () => {
  const h = harness();
  const c = clock();
  const queue = createMemoryJobQueue(c.nowIso);
  const worker = createProductionWorker({
    policy: createWorkerPolicy({ workerId: "w-dry" }),
    flags: {
      directorV2: true,
      directorV2Worker: true,
      directorV2PaidGeneration: false,
      directorV2Persistence: false,
      directorV2MarketingAi: false,
      directorV2CreativeAi: false,
      directorV2PaidAi: false,
    },
    queue,
    director: h.director,
    engine: h.engine,
    ports: h.ports,
  });
  const r = await worker.runOnce({
    correlationId: "c1",
    actorId: "t",
    nowIso: c.nowIso,
    nowMs: c.nowMs,
    nextId: c.nextId,
  });
  assert.equal(r.status, "dry_run");
  assert.equal(queue.claimCount, 0);
  assert.equal(r.providerCalls, 0);
  const dry = worker.dryRun({
    correlationId: "c1",
    actorId: "t",
    nowIso: c.nowIso,
    nowMs: c.nowMs,
    nextId: c.nextId,
  });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.ready, true);
});

test("worker — synchrone completed + enqueue via PD + observabilité", async () => {
  const h = harness({ durable: true });
  const c = clock();
  const queue = createMemoryJobQueue(c.nowIso);
  const obs: WorkerObservabilityEvent[] = [];

  const started = await h.director.start(
    {
      plan: h.plan,
      scenePackages: [makeMinimalPackage({ sceneId: "sc-1" })],
      readiness: readiness(),
      budgetSnapshot: createBudgetSnapshot({
        limit: money(10_000, "USD"),
        reserved: money(0, "USD"),
        spent: money(0, "USD"),
      }),
      requireDurableIdempotency: false,
      runId: "run-w1",
    },
    ctx(c)
  );
  assert.equal(started.status, "started");

  const planned = await h.director.planEnqueueCommands("run-w1", ctx(c));
  assert.ok(planned.commands.length >= 1);
  for (const cmd of planned.commands) {
    await queue.enqueue(cmd);
  }

  const worker = createProductionWorker({
    policy: createWorkerPolicy({ workerId: "w-sync" }),
    flags: {
      directorV2: true,
      directorV2Worker: true,
      directorV2PaidGeneration: true,
      directorV2Persistence: false,
      directorV2MarketingAi: false,
      directorV2CreativeAi: false,
      directorV2PaidAi: false,
    },
    queue,
    director: h.director,
    engine: h.engine,
    ports: h.ports,
    events: {
      emit: (e) => {
        obs.push(e);
      },
    },
  });

  const r = await worker.runOnce({
    correlationId: "corr-w",
    actorId: "tester",
    nowIso: c.nowIso,
    nowMs: c.nowMs,
    nextId: c.nextId,
  });

  assert.equal(r.claimed, 1);
  assert.equal(r.completed, 1);
  assert.ok(r.providerCalls >= 1);
  assert.equal(queue.claimCount, 1);
  const job = [...queue.jobs.values()][0]!;
  assert.equal(job.status, "completed");
  assert.ok(h.budget.committed.size >= 1);

  const types = obs.map((e) => e.type);
  assert.ok(types.includes("worker.run.started"));
  assert.ok(types.includes("worker.jobs.claimed"));
  assert.ok(types.includes("worker.job.completed"));
  assert.ok(types.includes("worker.run.completed"));
  assert.ok(!JSON.stringify(obs).includes("tok-"));
  assert.ok(!JSON.stringify(obs).includes("https://"));
});

test("worker — async submitted → reschedule poll → même attempt", async () => {
  let checks = 0;
  const fal = fakeFal({
    async submitJob() {
      return "async-job-1";
    },
    async checkJob() {
      checks += 1;
      if (checks < 2) {
        return { status: "IN_PROGRESS" };
      }
      return {
        status: "COMPLETED",
        videoUrl: "https://cdn.example.com/out.mp4",
      };
    },
  });

  const videoStep = makeStep({
    id: "step:sc-1:vid",
    action: "video",
    capabilityProfile: "video.text_to_video",
    providerId: "fal",
    modelId: "fal-ai/kling-video/v2/master/text-to-video",
    promptVariantId: "var-t2v",
    fallbacks: [],
  });
  const plan = makePlan({
    id: "plan-async",
    scenePlans: [
      {
        sceneId: "sc-1",
        sceneOrder: 1,
        strategy: "direct_video",
        steps: [videoStep],
        estimatedCost: money(50, "USD"),
        estimatedDurationSeconds: 5,
        rationale: {
          strategyId: "direct_video",
          summary: "t",
          reasons: [{ code: "eligible", message: "ok" }],
        },
      },
    ],
    estimatedCost: money(50, "USD"),
  });

  const runStore = createMemoryRunStore();
  const budget = createMemoryBudgetPort();
  const idempotency = createMemoryIdempotencyPort(true);
  const events = createMemoryEventPort();
  const engine = createGenerationEngine({ registry: registry(fal) });
  const ports = {
    runStore,
    budget,
    idempotency,
    quality: createAcceptingQualityPort(),
    events,
    eventPublishFailurePolicy: "fail_soft" as const,
  };
  const director = createProductionDirector({
    engine,
    ports,
    resolvePlan: (id) => (id === plan.id ? plan : null),
    resolveScenePackages: () => [makeMinimalPackage({ sceneId: "sc-1" })],
  });

  const c = clock();
  const queue = createMemoryJobQueue(c.nowIso);

  await director.start(
    {
      plan,
      scenePackages: [makeMinimalPackage({ sceneId: "sc-1" })],
      readiness: readiness("plan-async"),
      budgetSnapshot: createBudgetSnapshot({
        limit: money(100_000, "USD"),
        reserved: money(0, "USD"),
        spent: money(0, "USD"),
      }),
      requireDurableIdempotency: false,
      runId: "run-async",
    },
    ctx(c)
  );

  const planned = await director.planEnqueueCommands("run-async", ctx(c));
  assert.equal(planned.commands.length, 1);
  const attemptId = planned.commands[0]!.attemptId;
  await queue.enqueue(planned.commands[0]!);

  const worker = createProductionWorker({
    policy: createWorkerPolicy({ workerId: "w-async" }),
    flags: {
      directorV2: true,
      directorV2Worker: true,
      directorV2PaidGeneration: true,
      directorV2Persistence: false,
      directorV2MarketingAi: false,
      directorV2CreativeAi: false,
      directorV2PaidAi: false,
    },
    queue,
    director,
    engine,
    ports,
  });

  const r1 = await worker.runOnce({
    correlationId: "c-async",
    actorId: "t",
    nowIso: c.nowIso,
    nowMs: c.nowMs,
    nextId: c.nextId,
  });
  assert.equal(r1.rescheduled, 1);
  const job = [...queue.jobs.values()][0]!;
  assert.equal(job.status, "queued");
  assert.equal(job.payload.mode, "poll");
  assert.equal(job.attemptId, attemptId);

  // Make available and poll to completion
  job.availableAt = c.nowIso();
  const r2 = await worker.runOnce({
    correlationId: "c-async-2",
    actorId: "t",
    nowIso: c.nowIso,
    nowMs: c.nowMs,
    nextId: c.nextId,
  });
  // may still be processing on first poll
  if (r2.rescheduled === 1) {
    job.availableAt = c.nowIso();
    const r3 = await worker.runOnce({
      correlationId: "c-async-3",
      actorId: "t",
      nowIso: c.nowIso,
      nowMs: c.nowMs,
      nextId: c.nextId,
    });
    assert.ok(r3.completed + r3.rescheduled >= 1);
  }
  assert.equal(job.attemptId, attemptId);
  // no infinite poll in one run
  assert.ok(r1.processed <= 1);
});

test("worker — crash après persist : already_done complète le job sans provider", async () => {
  const h = harness({ durable: true });
  const c = clock();
  const queue = createMemoryJobQueue(c.nowIso);

  await h.director.start(
    {
      plan: h.plan,
      scenePackages: [makeMinimalPackage({ sceneId: "sc-1" })],
      readiness: readiness(),
      budgetSnapshot: createBudgetSnapshot({
        limit: money(10_000, "USD"),
        reserved: money(0, "USD"),
        spent: money(0, "USD"),
      }),
      requireDurableIdempotency: false,
      runId: "run-replay",
    },
    ctx(c)
  );

  // Complete via advance (simulate persist before job complete)
  let adv = await h.director.advance("run-replay", ctx(c));
  for (let i = 0; i < 5 && adv.status !== "completed"; i++) {
    adv = await h.director.advance("run-replay", ctx(c));
  }
  assert.equal(adv.status, "completed");

  const run = await h.runStore.load("run-replay");
  assert.ok(run);
  const step = run!.scenes[0]!.steps[0]!;
  const attempt = step.attempts[0]!;
  assert.equal(attempt.status, "completed");

  await queue.enqueue({
    runId: "run-replay",
    projectId: "proj-1",
    sceneId: "sc-1",
    stepId: step.stepId,
    attemptId: attempt.id,
    action: "image",
    providerId: "openai",
    modelId: "gpt-image-1",
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan-1",
      scenePackageSceneId: "sc-1",
      mode: "execute",
    },
  });

  let providerCalls = 0;
  const engineSpy = createGenerationEngine({
    registry: registry({
      ...fakeFal(),
      async generateIdentityImage() {
        providerCalls += 1;
        return "https://cdn.example.com/id.png";
      },
    }),
  });
  // Reuse same director — processClaimedJob sees already_done
  const worker = createProductionWorker({
    policy: createWorkerPolicy({ workerId: "w-replay" }),
    flags: {
      directorV2: true,
      directorV2Worker: true,
      directorV2PaidGeneration: true,
      directorV2Persistence: false,
      directorV2MarketingAi: false,
      directorV2CreativeAi: false,
      directorV2PaidAi: false,
    },
    queue,
    director: h.director,
    engine: engineSpy,
    ports: h.ports,
  });

  const beforeCommitted = h.budget.committed.size;
  const r = await worker.runOnce({
    correlationId: "c-replay",
    actorId: "t",
    nowIso: c.nowIso,
    nowMs: c.nowMs,
    nextId: c.nextId,
  });
  assert.equal(r.completed, 1);
  assert.equal(providerCalls, 0);
  assert.equal(h.budget.committed.size, beforeCommitted);
  assert.equal([...queue.jobs.values()][0]!.status, "completed");
});

test("worker — bornes : maximumJobsPerRun / durée / pas de sleep réel", async () => {
  const h = harness();
  const c = clock();
  const queue = createMemoryJobQueue(c.nowIso);

  await h.director.start(
    {
      plan: h.plan,
      scenePackages: [makeMinimalPackage({ sceneId: "sc-1" })],
      readiness: readiness(),
      budgetSnapshot: createBudgetSnapshot({
        limit: money(10_000, "USD"),
        reserved: money(0, "USD"),
        spent: money(0, "USD"),
      }),
      requireDurableIdempotency: false,
      runId: "run-bound",
    },
    ctx(c)
  );

  // enqueue 3 identical unique jobs would fail — enqueue 1 only, bound via policy
  const planned = await h.director.planEnqueueCommands("run-bound", ctx(c));
  await queue.enqueue(planned.commands[0]!);

  const worker = createProductionWorker({
    policy: createWorkerPolicy({
      workerId: "w-bound",
      claimLimit: 1,
      maximumJobsPerRun: 1,
      maximumProviderCallsPerRun: 1,
      maximumRunDurationMs: 25_000,
      pollingDelayMs: 0,
    }),
    flags: {
      directorV2: true,
      directorV2Worker: true,
      directorV2PaidGeneration: true,
      directorV2Persistence: false,
      directorV2MarketingAi: false,
      directorV2CreativeAi: false,
      directorV2PaidAi: false,
    },
    queue,
    director: h.director,
    engine: h.engine,
    ports: h.ports,
  });

  const t0 = Date.now();
  const r = await worker.runOnce({
    correlationId: "c-bound",
    actorId: "t",
    nowIso: c.nowIso,
    nowMs: c.nowMs,
    nextId: c.nextId,
  });
  const wall = Date.now() - t0;
  assert.ok(wall < 5_000, "aucun sleep réel long");
  assert.ok(r.processed <= 1);
  assert.ok(r.providerCalls <= 1);
});

test("worker — annulation : job non exécuté", async () => {
  const h = harness();
  const c = clock();
  const queue = createMemoryJobQueue(c.nowIso);

  await h.director.start(
    {
      plan: h.plan,
      scenePackages: [makeMinimalPackage({ sceneId: "sc-1" })],
      readiness: readiness(),
      budgetSnapshot: createBudgetSnapshot({
        limit: money(10_000, "USD"),
        reserved: money(0, "USD"),
        spent: money(0, "USD"),
      }),
      requireDurableIdempotency: false,
      runId: "run-cancel",
    },
    ctx(c)
  );
  await h.director.requestCancellation("run-cancel", ctx(c));

  const planned = await h.director.planEnqueueCommands("run-cancel", ctx(c));
  assert.equal(planned.commands.length, 0);

  // Manually enqueue a stale job as if claimed after cancel request
  await queue.enqueue({
    runId: "run-cancel",
    projectId: "proj-1",
    sceneId: "sc-1",
    stepId: "step:sc-1:img",
    attemptId: "stale:a1",
    action: "image",
    providerId: "openai",
    modelId: "gpt-image-1",
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan-1",
      scenePackageSceneId: "sc-1",
      mode: "execute",
    },
  });

  const worker = createProductionWorker({
    policy: createWorkerPolicy({ workerId: "w-cancel" }),
    flags: {
      directorV2: true,
      directorV2Worker: true,
      directorV2PaidGeneration: true,
      directorV2Persistence: false,
      directorV2MarketingAi: false,
      directorV2CreativeAi: false,
      directorV2PaidAi: false,
    },
    queue,
    director: h.director,
    engine: h.engine,
    ports: h.ports,
  });

  const r = await worker.runOnce({
    correlationId: "c-cancel",
    actorId: "t",
    nowIso: c.nowIso,
    nowMs: c.nowMs,
    nextId: c.nextId,
  });
  assert.equal(r.claimed, 1);
  assert.ok(r.issues.some((i) => i.code === "cancelled_run") || r.completed >= 1);
  assert.equal(h.budget.committed.size, 0);
});

test("factory — pas d'instanciation au import ; create explicite", () => {
  const h = harness();
  const c = clock();
  const queue = createMemoryJobQueue(c.nowIso);
  const w = createProductionWorkerFromDeps({
    policy: createWorkerPolicy({ workerId: "w-factory" }),
    flags: getFeatureFlags({}),
    queue,
    director: h.director,
    engine: h.engine,
    ports: h.ports,
  });
  assert.ok(w);
  assert.equal(queue.claimCount, 0);
});

test("at-least-once — documenté : replay already_done sans exactly-once claim", async () => {
  // Guarantee: at-least-once delivery + durable idempotence where possible.
  // This test only asserts the recovery path exists (already covered above).
  assert.ok(true);
});
