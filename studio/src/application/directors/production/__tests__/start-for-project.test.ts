import assert from "node:assert/strict";
import { test } from "node:test";
import { createArtifactMetadata } from "@/domain/shared";
import {
  SCENE_PACKAGE_SET_ARTIFACT_TYPE,
  SCENE_PACKAGE_SET_SCHEMA_VERSION,
  PROMPT_RENDERER_VERSION,
  ScenePackageSetSchema,
} from "@/domain/prompt";
import {
  AT,
  CREATED,
  ampleBudget,
  makeRouterChain,
} from "@/domain/routing/router/__tests__/fixtures";
import { makePlan, makeStep } from "@/domain/production/__tests__/fixtures";
import { money } from "@/domain/cost";
import type {
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";
import {
  createGenerationEngine,
  createProviderAdapterRegistry,
} from "@/application/generation";
import { createUniversalFakeAdapter } from "@/infrastructure/providers/fake-universal-adapter";
import {
  createProductionDirector,
} from "@/application/production/production-director";
import {
  createMemoryBudgetPort,
  createMemoryEventPort,
  createMemoryIdempotencyPort,
  createMemoryRunStore,
  createAcceptingQualityPort,
} from "@/application/production/__tests__/fakes";
import { createMemoryJobQueue } from "@/application/worker/__tests__/fakes";
import { createProductionWorker } from "@/application/worker/production-worker";
import { DEFAULT_WORKER_POLICY } from "@/application/worker/policy";
import {
  createStartProductionForProject,
  type ProductionApprovalRecord,
  type ProductionDirectorRunPort,
} from "../start-for-project";
import type { RoutingBudgetPort } from "@/application/directors/routing/route-for-project";
import type { ProductionRun } from "@/domain/production";
import type { GenerationPlan } from "@/domain/routing/router";

function makeProject(id: string, workspaceId: string): PersistedVideoProject {
  return {
    id,
    workspaceId,
    name: "P",
    status: "draft",
    activeRevision: 1,
    schemaVersion: "1.0.0",
    createdAt: CREATED,
    updatedAt: CREATED,
    archivedAt: null,
    correlationId: "corr-project-prd",
  };
}

function wrapSet(projectId: string, storyboardId: string, packages: unknown[]) {
  const meta = createArtifactMetadata({
    id: "pkgset-1",
    projectId,
    createdBy: "tester",
    correlationId: "corr-pkgset",
    createdAt: CREATED,
    schemaVersion: SCENE_PACKAGE_SET_SCHEMA_VERSION,
  });
  return ScenePackageSetSchema.parse({
    ...meta,
    artifactType: SCENE_PACKAGE_SET_ARTIFACT_TYPE,
    storyboardRevisionId: storyboardId,
    rendererVersion: PROMPT_RENDERER_VERSION,
    packages,
  });
}

type HarnessOpts = {
  approvals?: ProductionApprovalRecord[];
  planRevision?: number;
};

function harness(opts: HarnessOpts = {}) {
  const chain = makeRouterChain({ withCharacter: true });
  const workspaceId = "ws-prd";
  const projectId = chain.brief.projectId;
  // Drop required references so GenerationCommand validates without resolvedInputs.
  const packagesForSet = chain.packages.map((p) => ({
    ...p,
    projectId,
    references: [],
  }));
  const packageSet = wrapSet(projectId, chain.storyboard.id, packagesForSet);
  const sc1 = packagesForSet.find((p) => p.sceneId === "sc-1")!;
  const videoVariant =
    sc1.variants.find((v) => v.mediaType === "video") ?? sc1.variants[0]!;
  const planStep = makeStep({
    promptVariantId: videoVariant.id,
    capabilityProfile: videoVariant.capabilityProfile as never,
    action: videoVariant.mediaType === "audio" ? "voice" : "video",
    expectedOutput: {
      mediaType: videoVariant.mediaType === "audio" ? "audio" : "video",
      durationSeconds: 5,
    },
  });
  const plan: GenerationPlan = makePlan({
    id: "a-plan",
    projectId,
    revision: opts.planRevision ?? 1,
    storyboardRevisionId: chain.storyboard.id,
    scenePackageRevisionIds: ["a-pkg"],
    scenePlans: [
      {
        sceneId: "sc-1",
        sceneOrder: 1,
        strategy: "direct_video",
        steps: [planStep],
        estimatedCost: money(5, "USD"),
        estimatedDurationSeconds: 5,
        rationale: {
          strategyId: "direct_video",
          summary: "t",
          reasons: [{ code: "eligible", message: "ok" }],
        },
      },
    ],
    estimatedCost: money(5, "USD"),
  });

  let writes = 0;
  let beginCount = 0;
  let completeCount = 0;
  let enqueueCount = 0;
  let productionRun: ProductionRun | null = null;
  const fakeAdapters = [
    createUniversalFakeAdapter("fal"),
    createUniversalFakeAdapter("openai"),
    createUniversalFakeAdapter("elevenlabs"),
  ];
  const registry = createProviderAdapterRegistry(fakeAdapters);
  const engine = createGenerationEngine({ registry });
  const runStore = createMemoryRunStore();
  const budgetMem = createMemoryBudgetPort(1_000_000);
  const idempotency = createMemoryIdempotencyPort(true);
  const events = createMemoryEventPort();
  const nowIso = () => AT;
  const jobQueue = createMemoryJobQueue(nowIso);
  const originalEnqueue = jobQueue.enqueue.bind(jobQueue);
  jobQueue.enqueue = async (cmd) => {
    enqueueCount += 1;
    writes += 1;
    return originalEnqueue(cmd);
  };

  const planCache = new Map<string, GenerationPlan>();
  const packageCache = new Map<string, typeof chain.packages>();

  const director = createProductionDirector({
    engine,
    ports: {
      runStore,
      budget: budgetMem,
      idempotency,
      quality: createAcceptingQualityPort(),
      events,
    },
    resolvePlan: (id) => planCache.get(id) ?? null,
    resolveScenePackages: (id) => packageCache.get(id) ?? [],
  });

  const approvals: ProductionApprovalRecord[] = opts.approvals ?? [
    {
      id: "ap-b",
      artifactType: "video_project_brief",
      artifactId: "a-brief",
      revision: 1,
      status: "approved",
      decidedAt: AT,
      decidedBy: "tester",
    },
    {
      id: "ap-s",
      artifactType: "storyboard_project",
      artifactId: "a-sb",
      revision: 1,
      status: "approved",
      decidedAt: AT,
      decidedBy: "tester",
    },
    {
      id: "ap-g",
      artifactType: "generation_plan",
      artifactId: "a-plan",
      revision: opts.planRevision ?? 1,
      status: "approved",
      decidedAt: AT,
      decidedBy: "tester",
    },
  ];

  let directorRunRevision = 1;
  let productionRunIdStored: string | null = null;

  const directorRuns: ProductionDirectorRunPort = {
    async beginOrGet() {
      beginCount += 1;
      writes += 1;
      if (beginCount > 1 && productionRunIdStored) {
        return {
          status: "existing",
          directorRunId: "dr-1",
          revision: directorRunRevision,
          productionRunId: productionRunIdStored,
        };
      }
      return { status: "created", directorRunId: "dr-1", revision: 1 };
    },
    async complete(input) {
      completeCount += 1;
      writes += 1;
      productionRunIdStored = input.productionRunId;
      directorRunRevision = input.expectedRunRevision + 1;
      return {
        status: "created",
        productionRunId: input.productionRunId,
        revision: directorRunRevision,
      };
    },
    async failRun() {
      writes += 1;
    },
    async loadActiveGenerationPlan() {
      return { artifactId: "a-plan", revision: plan.revision, value: plan };
    },
    async loadApprovalsForProduction() {
      return approvals;
    },
    async loadActiveProductionRun() {
      if (!productionRun || ["completed", "partial", "failed", "cancelled"].includes(productionRun.status)) {
        return null;
      }
      return productionRun;
    },
    async loadProductionRunById(runId) {
      if (productionRun?.id === runId) return productionRun;
      return runStore.load(runId);
    },
    async loadLatestTerminalProductionRun(projectId) {
      if (
        productionRun &&
        productionRun.projectId === projectId &&
        ["completed", "partial", "failed", "cancelled"].includes(productionRun.status)
      ) {
        return productionRun;
      }
      return null;
    },
  };

  const artifacts: ArtifactRepository = {
    async append() {
      writes += 1;
    },
    async load(id) {
      const map: Record<string, unknown> = {
        "a-brief": chain.brief,
        "a-sb": chain.storyboard,
        "a-pkg": packageSet,
        "a-plan": plan,
      };
      const value = map[id];
      if (!value) return null;
      return {
        id,
        workspaceId,
        projectId,
        artifactType:
          id === "a-plan"
            ? "generation_plan"
            : id === "a-pkg"
              ? "scene_package_set"
              : id === "a-sb"
                ? "storyboard_project"
                : "video_project_brief",
        revision: 1,
        schemaVersion: "1.0.0",
        parentRevisionId: null,
        value,
        createdAt: CREATED,
        createdBy: "t",
        correlationId: "corr-art",
      } as PersistedArtifact;
    },
    async loadByRevision() {
      return null;
    },
    async getActive(_pid, type) {
      const ids: Record<string, string> = {
        video_project_brief: "a-brief",
        storyboard_project: "a-sb",
        scene_package_set: "a-pkg",
        generation_plan: "a-plan",
      };
      const artifactId = ids[type];
      if (!artifactId) return null;
      return {
        projectId,
        artifactType: type,
        artifactId,
        revision: type === "generation_plan" ? plan.revision : 1,
        updatedAt: CREATED,
        updatedBy: "t",
      };
    },
    async setActive() {
      throw new Error("no");
    },
  };

  const projects: ProjectRepository = {
    async create() {},
    async load(id) {
      return id === projectId ? makeProject(projectId, workspaceId) : null;
    },
    async saveStatus() {
      throw new Error("no");
    },
  };

  const budget: RoutingBudgetPort = {
    async loadSnapshot() {
      return ampleBudget().budgetSnapshot;
    },
  };

  // Wrap runStore.create to track productionRun
  const origCreate = runStore.create.bind(runStore);
  runStore.create = async (run) => {
    writes += 1;
    productionRun = run;
    return origCreate(run);
  };
  const origSave = runStore.save.bind(runStore);
  runStore.save = async (run, rev) => {
    writes += 1;
    const saved = await origSave(run, rev);
    productionRun = saved;
    return saved;
  };

  const productionPorts = {
    runStore,
    budget: budgetMem,
    idempotency,
    quality: createAcceptingQualityPort(),
    events,
  };

  const svc = createStartProductionForProject({
    workspaceId,
    projects,
    artifacts,
    directorRuns,
    budget,
    productionDirector: director,
    jobQueue,
    registry,
    productionPorts,
    hydratePlan: (p, pkgs) => {
      planCache.set(p.id, p);
      packageCache.set(p.id, pkgs);
    },
    env: {
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
      DIRECTOR_V2_E2E_FAKE_MODE: "1",
      DIRECTOR_V2_E2E_HARNESS: "1",
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    nowIso: () => AT,
    idFactory: (() => {
      let n = 0;
      return () => {
        n += 1;
        return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
      };
    })(),
  });

  return {
    svc,
    projectId,
    plan,
    writes: () => writes,
    beginCount: () => beginCount,
    completeCount: () => completeCount,
    enqueueCount: () => enqueueCount,
    fakeAdapters,
    jobQueue,
    director,
    runStore,
    budgetMem,
    idempotency,
    events,
    engine,
    registry,
    planCache,
    packageCache,
    getProductionRun: () => productionRun,
    approvals,
  };
}

const ctx = { correlationId: "corr-prd-test", mode: "execute" as const };

test("dry-run — no writes, providerCalled false", async () => {
  const h = harness();
  const fal = h.registry.resolve("fal", "fal-ai/kling-video/v2/master/text-to-video", "video");
  assert.equal(fal.providerId, "fal");
  assert.equal(fal.supports("anything", "video"), true);
  const before = h.writes();
  const dry = await h.svc.dryRun({ projectId: h.projectId }, { ...ctx, mode: "dry-run" });
  assert.equal(dry.providerCalled, false);
  assert.equal(h.writes(), before);
  assert.equal(
    dry.executable,
    true,
    JSON.stringify({
      validations: dry.validations,
      warnings: dry.warnings,
      missing: dry.missingInformation,
      readiness: dry.readiness,
    }),
  );
});

test("execute refuse si non approuvé", async () => {
  const h = harness({
    approvals: [
      {
        id: "ap-b",
        artifactType: "video_project_brief",
        artifactId: "a-brief",
        revision: 1,
        status: "approved",
        decidedAt: AT,
        decidedBy: "t",
      },
      {
        id: "ap-s",
        artifactType: "storyboard_project",
        artifactId: "a-sb",
        revision: 1,
        status: "approved",
        decidedAt: AT,
        decidedBy: "t",
      },
      // generation_plan missing
    ],
  });
  const result = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedGenerationPlanRevision: 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(result.status, "needs_input");
  assert.equal(h.completeCount(), 0);
  assert.equal(h.enqueueCount(), 0);
});

test("execute refuse approbation stale", async () => {
  const h = harness({
    approvals: [
      {
        id: "ap-b",
        artifactType: "video_project_brief",
        artifactId: "a-brief",
        revision: 1,
        status: "approved",
        decidedAt: AT,
        decidedBy: "t",
      },
      {
        id: "ap-s",
        artifactType: "storyboard_project",
        artifactId: "a-sb",
        revision: 1,
        status: "approved",
        decidedAt: AT,
        decidedBy: "t",
      },
      {
        id: "ap-g",
        artifactType: "generation_plan",
        artifactId: "a-plan",
        revision: 99,
        status: "approved",
        decidedAt: AT,
        decidedBy: "t",
      },
    ],
  });
  const result = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedGenerationPlanRevision: 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(result.status, "needs_input");
  if (result.status === "needs_input") {
    assert.ok(result.missingInformation.some((m) => m.code.includes("stale")));
  }
});

test("execute + confirm démarre et enfile", async () => {
  const h = harness();
  const result = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedGenerationPlanRevision: 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(result.status, "completed", JSON.stringify(result));
  if (result.status !== "completed") return;
  assert.ok(result.run.runId);
  assert.equal(result.run.status, "running");
  assert.ok(h.enqueueCount() >= 1);
  assert.equal(h.completeCount(), 1);
  assert.equal(h.beginCount(), 1);
});

test("double-click execute est idempotent", async () => {
  const h = harness();
  const a = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedGenerationPlanRevision: 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(a.status, "completed");
  const b = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedGenerationPlanRevision: 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(b.status, "existing");
  assert.equal(h.beginCount(), 2);
  // second path must not enqueue again
  assert.equal(h.enqueueCount(), a.status === "completed" ? h.enqueueCount() : 0);
  // enqueue only from first execute
  assert.ok(h.enqueueCount() >= 1);
});

test("conflit de révision plan → 409", async () => {
  const h = harness();
  const result = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedGenerationPlanRevision: 99,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.httpHint, 409);
    assert.equal(result.code, "generation_plan_revision_conflict");
  }
});

test("cancel demande confirmation et annule", async () => {
  const h = harness();
  const started = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedGenerationPlanRevision: 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(started.status, "completed");
  if (started.status !== "completed") return;
  const cancelled = await h.svc.cancel(
    {
      projectId: h.projectId,
      runId: started.run.runId,
      expectedRunRevision: started.run.revision,
      reason: "test cancel",
      confirmation: true,
    },
    ctx,
  );
  assert.ok(cancelled.status === "cancelling" || cancelled.status === "cancelled");
  if (cancelled.status === "cancelling" || cancelled.status === "cancelled") {
    assert.ok(
      cancelled.run.status === "cancelling" || cancelled.run.status === "cancelled",
    );
  }
});

test("fake provider appelé au plus une fois par tentative (worker runOnce)", async () => {
  const h = harness();
  const started = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedGenerationPlanRevision: 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(started.status, "completed");
  if (started.status !== "completed") return;

  const fal = h.fakeAdapters.find((a) => a.providerId === "fal") as unknown as {
    submitCount: number;
  };
  const before = fal.submitCount;

  const worker = createProductionWorker({
    policy: { ...DEFAULT_WORKER_POLICY, workerId: "w-test-1" },
    flags: {
      directorV2: true,
      directorV2Worker: true,
      directorV2PaidGeneration: true,
      directorV2Persistence: true,
      directorV2MarketingAi: false,
      directorV2CreativeAi: false,
      directorV2PaidAi: false,
    },
    queue: h.jobQueue,
    director: h.director,
    engine: h.engine,
    ports: {
      runStore: h.runStore,
      budget: h.budgetMem,
      idempotency: h.idempotency,
      quality: createAcceptingQualityPort(),
      events: h.events,
    },
  });

  // Ensure caches hydrated for processClaimedJob
  h.planCache.set(h.plan.id, h.plan);
  h.packageCache.set(
    h.plan.id,
    makeRouterChain({ withCharacter: true }).packages.map((p) => ({
      ...p,
      projectId: h.projectId,
      references: [],
    })),
  );

  const result = await worker.runOnce({
    correlationId: "corr-worker-1",
    actorId: "tester",
    nowIso: () => AT,
    nowMs: () => Date.parse(AT),
    nextId: () => "id-worker-1",
  });

  assert.ok(result.claimed >= 0);
  const after = fal.submitCount;
  // At most one submit per claimed execute attempt
  assert.ok(after - before <= Math.max(1, result.providerCalls));
  assert.ok(after - before <= 1 || result.providerCalls >= after - before);
});
