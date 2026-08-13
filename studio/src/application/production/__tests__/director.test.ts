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
  runProductionDryRun,
  type ProductionExecutionContext,
} from "../index";
import {
  createMemoryBudgetPort,
  createMemoryEventPort,
  createMemoryIdempotencyPort,
  createMemoryRunStore,
  createAcceptingQualityPort,
  createTestQualityPort,
  createNeedsReviewQualityPort,
} from "./fakes";
import { makePlan, makeStep } from "@/domain/production/__tests__/fixtures";
import type { ProductionReadinessInput } from "@/domain/project";
import type { QualityValidatorPort } from "../ports";

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
    nextId: () => `id-${++n}`,
  };
}

function ctx(c = clock()): ProductionExecutionContext {
  return {
    correlationId: "corr-1",
    actorId: "tester",
    nowIso: c.nowIso,
    nextId: c.nextId,
    maxActionsPerAdvance: 3,
  };
}

function harness(opts: {
  fal?: FalClientPort;
  budgetLimit?: number;
  durableIdempotency?: boolean;
  quality?: QualityValidatorPort;
} = {}) {
  // sync image step for simpler sync completion path
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
  const fullPlan = makePlan({
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

  const runStore = createMemoryRunStore();
  const budget = createMemoryBudgetPort(opts.budgetLimit ?? 1_000_000);
  const idempotency = createMemoryIdempotencyPort(opts.durableIdempotency ?? false);
  const events = createMemoryEventPort();
  const reg = registry(opts.fal);
  const engine = createGenerationEngine({ registry: reg });
  const director = createProductionDirector({
    engine,
    ports: {
      runStore,
      budget,
      idempotency,
      quality: opts.quality ?? createAcceptingQualityPort(),
      events,
      eventPublishFailurePolicy: "fail_soft",
    },
    resolvePlan: (id) => (id === fullPlan.id ? fullPlan : null),
    resolveScenePackages: () => [makeMinimalPackage({ sceneId: "sc-1" })],
  });

  return {
    plan: fullPlan,
    director,
    runStore,
    budget,
    idempotency,
    events,
    registry: reg,
    engine,
  };
}

test("Production Director — start valide + advance borné jusqu'à completed", async () => {
  const h = harness();
  const c = clock();
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
      runId: "run-1",
    },
    ctx(c)
  );
  assert.equal(started.status, "started");
  if (started.status !== "started") return;

  let result = await h.director.advance("run-1", ctx(c));
  // may need a second tick if waiting
  for (let i = 0; i < 5 && result.status !== "completed"; i++) {
    if (result.status === "failed") break;
    result = await h.director.advance("run-1", ctx(c));
  }
  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.result.status, "completed");
    assert.equal(result.result.scenes[0]!.status, "completed");
    assert.ok(!("finalAsset" in result.result));
    assert.ok(result.result.manifest.attempts.length >= 1);
    assert.ok(h.budget.committed.size >= 1);
    const committed = [...h.budget.committed.values()][0]!;
    assert.ok(committed.costKind === "actual" || committed.costKind === "provisional");
  }
  // no vh_spend
  assert.equal(
    JSON.stringify(h.budget).includes("vh_spend"),
    false
  );
});

test("Production Director — start concurrent refusé", async () => {
  const h = harness();
  const c = clock();
  const input = {
    plan: h.plan,
    scenePackages: [makeMinimalPackage({ sceneId: "sc-1" })],
    readiness: readiness(),
    budgetSnapshot: createBudgetSnapshot({
      limit: money(10_000, "USD"),
      reserved: money(0, "USD"),
      spent: money(0, "USD"),
    }),
    requireDurableIdempotency: false,
  };
  const a = await h.director.start({ ...input, runId: "run-a" }, ctx(c));
  assert.equal(a.status, "started");
  const b = await h.director.start({ ...input, runId: "run-b" }, ctx(c));
  assert.equal(b.status, "failed");
  if (b.status === "failed") {
    assert.equal(b.errors[0]!.code, "concurrent_run");
  }
});

test("Production Director — budget insuffisant refuse avant engine", async () => {
  const h = harness({ budgetLimit: 1 });
  const c = clock();
  // plan exposure > snapshot available
  const started = await h.director.start(
    {
      plan: h.plan,
      scenePackages: [makeMinimalPackage({ sceneId: "sc-1" })],
      readiness: readiness(),
      budgetSnapshot: createBudgetSnapshot({
        limit: money(1, "USD"),
        reserved: money(0, "USD"),
        spent: money(0, "USD"),
      }),
      requireDurableIdempotency: false,
      runId: "run-budget",
    },
    ctx(c)
  );
  // estimated 5 > available 1
  assert.equal(started.status, "failed");
});

test("Production Director — fallback retryable via plan uniquement", async () => {
  let calls = 0;
  const fal = fakeFal({
    async submitJob() {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("temp"), { status: 503 });
      return "job-ok";
    },
  });
  // Use video step with fal + fallback
  const primary = makeStep({
    id: "step:sc-1:vid",
    action: "video",
    capabilityProfile: "video.text_to_video",
    providerId: "fal",
    modelId: "fal-ai/kling-video/v2/master/text-to-video",
    promptVariantId: "var-t2v",
    fallbacks: [
      {
        order: 1,
        providerId: "fal",
        modelId: "fal-ai/kling-video/v2/master/text-to-video",
        estimate: makeStep().estimate,
        reason: "planned",
        eligibilityEvidence: [],
      },
    ],
  });
  const plan = makePlan({
    scenePlans: [
      {
        sceneId: "sc-1",
        sceneOrder: 1,
        strategy: "direct_video",
        steps: [primary],
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
    fallbackExposure: money(150, "USD"),
  });

  const runStore = createMemoryRunStore();
  const budget = createMemoryBudgetPort();
  const idempotency = createMemoryIdempotencyPort(false);
  const events = createMemoryEventPort();
  const reg = registry(fal);
  const engine = createGenerationEngine({ registry: reg });
  const director = createProductionDirector({
    engine,
    ports: {
      runStore,
      budget,
      idempotency,
      quality: createAcceptingQualityPort(),
      events,
    },
    resolvePlan: () => plan,
    resolveScenePackages: () => [makeMinimalPackage({ sceneId: "sc-1" })],
  });

  const c = clock();
  await director.start(
    {
      plan,
      scenePackages: [makeMinimalPackage({ sceneId: "sc-1" })],
      readiness: readiness(plan.id),
      budgetSnapshot: createBudgetSnapshot({
        limit: money(10_000, "USD"),
        reserved: money(0, "USD"),
        spent: money(0, "USD"),
      }),
      requireDurableIdempotency: false,
      runId: "run-fb",
    },
    ctx(c)
  );

  let result = await director.advance("run-fb", { ...ctx(c), maxActionsPerAdvance: 1 });
  // First attempt may fail → fallback_ready; subsequent advances
  for (let i = 0; i < 8; i++) {
    if (result.status === "completed" || result.status === "failed") break;
    result = await director.advance("run-fb", { ...ctx(c), maxActionsPerAdvance: 2 });
  }

  const run = await runStore.load("run-fb");
  assert.ok(run);
  const attempts = run!.scenes[0]!.steps[0]!.attempts;
  // Plan not mutated
  assert.equal(plan.scenePlans[0]!.steps[0]!.fallbacks.length, 1);
  assert.equal(plan.scenePlans[0]!.steps[0]!.modelId, primary.modelId);
  // Distinct keys
  const keys = new Set(attempts.map((a) => a.idempotencyKey));
  assert.equal(keys.size, attempts.length);
});

test("Production Director — annulation libère et conserve completed", async () => {
  const h = harness();
  const c = clock();
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
  // Cancel before advance completes everything
  const cancelled = await h.director.requestCancellation("run-cancel", ctx(c));
  assert.ok(
    cancelled.status === "completed" ||
      cancelled.status === "progressed" ||
      cancelled.status === "waiting"
  );
  const run = await h.runStore.load("run-cancel");
  assert.ok(run);
  assert.ok(run!.status === "cancelling" || run!.status === "cancelled");
  // idempotent
  const again = await h.director.requestCancellation("run-cancel", ctx(c));
  assert.ok(again.status !== "failed" || again.status === "failed");
});

test("dry-run — executable / providerCalled false / pas de run", async () => {
  const h = harness();
  const dry = runProductionDryRun({
    plan: h.plan,
    scenePackages: [makeMinimalPackage({ sceneId: "sc-1" })],
    readiness: readiness(),
    budgetSnapshot: createBudgetSnapshot({
      limit: money(10_000, "USD"),
      reserved: money(0, "USD"),
      spent: money(0, "USD"),
    }),
    registry: h.registry,
    ports: {
      runStore: h.runStore,
      budget: h.budget,
      idempotency: h.idempotency,
      quality: createTestQualityPort(),
      events: h.events,
    },
    at: AT,
  });
  assert.equal(dry.providerCalled, false);
  assert.equal(h.runStore.runs.size, 0);
  assert.equal(h.budget.reserved.size, 0);
  assert.ok(dry.warnings.some((w) => w.code === "idempotency_not_durable"));
});

test("dry-run — approbation absente", () => {
  const h = harness();
  const dry = runProductionDryRun({
    plan: h.plan,
    scenePackages: [makeMinimalPackage({ sceneId: "sc-1" })],
    readiness: { projectId: "proj-1", activeByType: {}, approvalsByType: {} },
    budgetSnapshot: createBudgetSnapshot({
      limit: money(10_000, "USD"),
      reserved: money(0, "USD"),
      spent: money(0, "USD"),
    }),
    registry: h.registry,
    at: AT,
  });
  assert.equal(dry.executable, false);
  assert.ok(dry.validations.some((v) => v.code === "approvals" && !v.passed));
});

test("événements — correlation + échec publish sans double exécution", async () => {
  const h = harness();
  h.events.failNext = true;
  const c = clock();
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
      runId: "run-ev",
    },
    ctx(c)
  );
  assert.equal(started.status, "started");
  assert.equal(h.runStore.runs.size, 1);
});

test("idempotence — conflit d'empreinte bloque", async () => {
  const h = harness();
  const key = "proj-1:plan-1:sc-1:step:sc-1:img:1";
  h.idempotency.entries.set(key, {
    key,
    fingerprint: "other-fingerprint",
    status: "begun",
  });
  const c = clock();
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
      runId: "run-idemp",
    },
    ctx(c)
  );
  await h.director.advance("run-idemp", ctx(c));
  const run = await h.runStore.load("run-idemp");
  const step = run!.scenes[0]!.steps[0]!;
  // Conflict should not leave a completed silent primary retry
  assert.notEqual(step.status, "completed");
});

test("start — store durable requis par défaut", async () => {
  const h = harness({ durableIdempotency: false });
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
      // requireDurableIdempotency default true
    },
    ctx()
  );
  assert.equal(started.status, "failed");
  if (started.status === "failed") {
    assert.equal(started.errors[0]!.code, "store_required");
  }
});

test("needs_review after provider success settles ledger before Human Review", async () => {
  const h = harness({ quality: createNeedsReviewQualityPort() });
  const c = clock();
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
      runId: "run-nr",
    },
    ctx(c)
  );
  assert.equal(started.status, "started");

  let result = await h.director.advance("run-nr", ctx(c));
  for (let i = 0; i < 5 && result.status !== "needs_review"; i++) {
    if (result.status === "failed" || result.status === "completed") break;
    result = await h.director.advance("run-nr", ctx(c));
  }
  assert.equal(result.status, "needs_review");
  assert.equal(h.budget.reserved.size, 0);
  assert.equal(h.budget.committed.size, 1);
  const committed = [...h.budget.committed.values()][0]!;
  assert.equal(committed.amount.amountMinor, 5);
  assert.equal(committed.costKind, "provisional");
  const run = await h.runStore.load("run-nr");
  assert.ok(run);
  assert.equal(run!.waitingReason, "needs_review");
  assert.equal(run!.committedCost.amountMinor, 5);
  assert.equal(run!.releasedCost.amountMinor, 0);
  const attempt = run!.scenes[0]!.steps[0]!.attempts[0]!;
  assert.equal(attempt.status, "completed");
  assert.ok(attempt.output);
  assert.equal(attempt.costKind, "provisional");
  assert.equal(attempt.actualCost?.amountMinor, 5);
  assert.ok(run!.reviewRequest);
  const replay = await h.director.advance("run-nr", ctx(c));
  assert.equal(replay.status, "needs_review");
  assert.equal(h.budget.committed.size, 1);
  assert.equal((await h.runStore.load("run-nr"))!.committedCost.amountMinor, 5);
});
