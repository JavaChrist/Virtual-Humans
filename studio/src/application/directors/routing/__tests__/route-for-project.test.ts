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
  makeRoutableRegistry,
  makeRouterChain,
  tinyBudget,
} from "@/domain/routing/router/__tests__/fixtures";
import type { ArtifactRepository, ProjectRepository, PersistedArtifact, PersistedVideoProject } from "@/application/projects/ports";
import {
  createRouteGenerationPlanForProject,
  resolveRegistrySnapshotVersion,
  type RoutingBudgetPort,
  type RoutingDirectorRunPort,
} from "../route-for-project";
import { createApproveArtifactForProject, type ArtifactApprovalPort } from "../approve-for-project";

function makeProject(id: string, workspaceId: string, revision = 1): PersistedVideoProject {
  return {
    id,
    workspaceId,
    name: "P",
    status: "draft",
    activeRevision: revision,
    schemaVersion: "1.0.0",
    createdAt: CREATED,
    updatedAt: CREATED,
    archivedAt: null,
    correlationId: "corr-project-rtg",
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

function harness(options?: { tiny?: boolean; registryMutator?: (r: ReturnType<typeof makeRoutableRegistry>) => ReturnType<typeof makeRoutableRegistry> }) {
  const chain = makeRouterChain({ withCharacter: true });
  const workspaceId = "ws-rtg";
  const projectId = chain.brief.projectId;
  const packageSet = wrapSet(projectId, chain.storyboard.id, chain.packages);
  let stored: { artifactId: string; revision: number; value: unknown } | null = null;
  let beginCount = 0;
  let persistCount = 0;
  let budgetCalls = 0;
  const failCodes: string[] = [];
  let projectRevision = 1;
  const approvals: Array<{
    artifactId: string;
    revision: number;
    status: "approved" | "rejected";
    decidedAt: string;
    decidedBy: string;
  }> = [];

  const registryBase = options?.registryMutator
    ? options.registryMutator(makeRoutableRegistry())
    : makeRoutableRegistry();

  const artifacts: ArtifactRepository = {
    async append() {},
    async load(id) {
      if (stored && id === stored.artifactId) {
        return {
          id,
          workspaceId,
          projectId,
          artifactType: "generation_plan",
          revision: stored.revision,
          schemaVersion: "1.0.0",
          parentRevisionId: null,
          value: stored.value,
          createdAt: CREATED,
          createdBy: "t",
          correlationId: "corr-out",
        } as PersistedArtifact;
      }
      const map: Record<string, unknown> = {
        "a-brief": chain.brief,
        "a-sb": chain.storyboard,
        "a-pkg": packageSet,
      };
      const value = map[id];
      if (!value) return null;
      return {
        id,
        workspaceId,
        projectId,
        artifactType: "scene_package_set",
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
        generation_plan: stored?.artifactId ?? "",
      };
      const artifactId = ids[type];
      if (!artifactId) return null;
      return {
        projectId,
        artifactType: type,
        artifactId,
        revision: type === "generation_plan" ? (stored?.revision ?? 1) : 1,
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
      return id === projectId ? makeProject(projectId, workspaceId, projectRevision) : null;
    },
    async saveStatus() {
      throw new Error("no");
    },
  };

  const directorRuns: RoutingDirectorRunPort = {
    async beginOrGet(input) {
      beginCount += 1;
      if (stored && beginCount > 1) {
        return {
          status: "existing",
          directorRunId: "run-1",
          revision: 2,
          outputArtifactId: stored.artifactId,
        };
      }
      return { status: "created", directorRunId: "run-1", revision: 1 };
      void input;
    },
    async persistGenerationPlan(input) {
      persistCount += 1;
      stored = { artifactId: input.artifactId, revision: 1, value: input.plan };
      return { status: "created", artifactId: input.artifactId, revision: 1 };
    },
    async failRun(input) {
      failCodes.push(input.errorCode);
    },
    async loadActiveGenerationPlan() {
      return stored
        ? { artifactId: stored.artifactId, revision: stored.revision, value: stored.value }
        : null;
    },
    async loadLatestApproval() {
      const latest = approvals[approvals.length - 1];
      return latest ?? null;
    },
  };

  const budget: RoutingBudgetPort = {
    async loadSnapshot() {
      budgetCalls += 1;
      return (options?.tiny ? tinyBudget(1) : ampleBudget()).budgetSnapshot;
    },
  };

  const approvalPort: ArtifactApprovalPort = {
    async persistApproval(input) {
      const existing = approvals.find(
        (a) =>
          a.artifactId === input.artifactId &&
          a.revision === input.revision &&
          a.status === input.status,
      );
      if (existing) {
        return {
          status: "existing",
          approvalId: "appr-existing",
          projectRevision,
          artifactRevision: input.revision,
        };
      }
      approvals.push({
        artifactId: input.artifactId,
        revision: input.revision,
        status: input.status,
        decidedAt: AT,
        decidedBy: input.decidedBy,
      });
      projectRevision += 1;
      return {
        status: "created",
        approvalId: input.id,
        projectRevision,
        artifactRevision: input.revision,
      };
    },
  };

  const svc = createRouteGenerationPlanForProject({
    workspaceId,
    projects,
    artifacts,
    directorRuns,
    budget,
    buildRegistry: ({ createdAt, registryVersion }) => ({
      ...registryBase,
      createdAt,
      registryVersion,
    }),
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

  const approve = createApproveArtifactForProject({
    workspaceId,
    projects,
    artifacts,
    approvals: approvalPort,
    env: {
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
      DIRECTOR_V2_E2E_FAKE_MODE: "1",
      DIRECTOR_V2_E2E_HARNESS: "1",
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    idFactory: () => "11111111-1111-4111-8111-111111111111",
  });

  return {
    svc,
    approve,
    chain,
    packageSet,
    projectId,
    get stored() {
      return stored;
    },
    get beginCount() {
      return beginCount;
    },
    get persistCount() {
      return persistCount;
    },
    get budgetCalls() {
      return budgetCalls;
    },
    get failCodes() {
      return failCodes;
    },
    get projectRevision() {
      return projectRevision;
    },
    setStored(next: typeof stored) {
      stored = next;
    },
    bumpStoredRevision() {
      if (stored) stored = { ...stored, revision: stored.revision + 1 };
    },
  };
}

test("routing dry-run — providerCalled false, zéro provider, budget lu", async () => {
  const h = harness();
  const dry = await h.svc.dryRun(
    { projectId: h.projectId },
    { correlationId: "corr-rtg-dry", mode: "dry-run" },
  );
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executable, true);
  assert.equal(dry.executionAvailable, true);
  assert.ok(dry.registryVersion.includes("legacy-pricing-usd-v1"));
  assert.ok(dry.registryVersion.includes(":"));
  assert.equal(h.persistCount, 0);
  assert.equal(h.beginCount, 0);
  assert.ok(h.budgetCalls >= 1);
});

test("routing execute — plan déterministe, idempotent, aucun ledger", async () => {
  const h = harness();
  const dry = await h.svc.dryRun(
    { projectId: h.projectId },
    { correlationId: "corr-rtg-1", mode: "dry-run" },
  );
  const first = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedScenePackageSetRevision: dry.scenePackageSetRevision,
      expectedRegistrySnapshotVersion: dry.registryVersion,
    },
    { correlationId: "corr-rtg-1", mode: "execute" },
  );
  assert.equal(first.status, "completed");
  if (first.status !== "completed" && first.status !== "existing") assert.fail("expected plan");
  assert.ok(first.plan.scenes?.length);
  assert.equal(first.plan.budgetAllowed, true);
  assert.ok((first.plan.estimatedCostMinor ?? 0) > 0);
  // Fallbacks must not inflate primary estimate in the safe view path
  assert.ok((first.plan.maximumExposureMinor ?? 0) >= (first.plan.estimatedCostMinor ?? 0));

  const second = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedScenePackageSetRevision: dry.scenePackageSetRevision,
      expectedRegistrySnapshotVersion: dry.registryVersion,
    },
    { correlationId: "corr-rtg-2", mode: "execute" },
  );
  assert.equal(second.status, "existing");
  assert.equal(h.persistCount, 1);
});

test("routing — conflit révision Prompt / Registry", async () => {
  const h = harness();
  const dry = await h.svc.dryRun(
    { projectId: h.projectId },
    { correlationId: "corr-rtg-c", mode: "dry-run" },
  );
  const stalePkg = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedScenePackageSetRevision: dry.scenePackageSetRevision + 1,
      expectedRegistrySnapshotVersion: dry.registryVersion,
    },
    { correlationId: "corr-rtg-c1", mode: "execute" },
  );
  assert.equal(stalePkg.status, "failed");
  if (stalePkg.status === "failed") {
    assert.equal(stalePkg.code, "scene_package_set_revision_conflict");
    assert.equal(stalePkg.httpHint, 409);
  }

  const staleReg = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedScenePackageSetRevision: dry.scenePackageSetRevision,
      expectedRegistrySnapshotVersion: "other-registry",
    },
    { correlationId: "corr-rtg-c2", mode: "execute" },
  );
  assert.equal(staleReg.status, "failed");
  if (staleReg.status === "failed") {
    assert.equal(staleReg.code, "registry_snapshot_conflict");
  }
});

test("routing — budget insuffisant bloque", async () => {
  const h = harness({ tiny: true });
  const dry = await h.svc.dryRun(
    { projectId: h.projectId },
    { correlationId: "corr-rtg-b", mode: "dry-run" },
  );
  assert.equal(dry.executable, false);
  const result = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedScenePackageSetRevision: dry.scenePackageSetRevision,
      expectedRegistrySnapshotVersion: dry.registryVersion,
    },
    { correlationId: "corr-rtg-b", mode: "execute" },
  );
  assert.ok(result.status === "needs_input" || result.status === "failed");
});

test("registry snapshot version — déterministe, sans secrets", () => {
  const a = makeRoutableRegistry();
  const b = makeRoutableRegistry();
  assert.equal(resolveRegistrySnapshotVersion(a), resolveRegistrySnapshotVersion(b));
  const json = JSON.stringify(a);
  assert.equal(json.includes("sk-"), false);
  assert.equal(json.includes("apiKey"), false);
  assert.equal(json.includes("OPENAI"), false);
});

test("approbation — active ok, historique refusée, double-clic idempotent, stale", async () => {
  const h = harness();
  const dry = await h.svc.dryRun(
    { projectId: h.projectId },
    { correlationId: "corr-appr-d", mode: "dry-run" },
  );
  const created = await h.svc.execute(
    {
      projectId: h.projectId,
      expectedScenePackageSetRevision: dry.scenePackageSetRevision,
      expectedRegistrySnapshotVersion: dry.registryVersion,
    },
    { correlationId: "corr-appr-e", mode: "execute" },
  );
  assert.ok(created.status === "completed" || created.status === "existing");
  if (created.status !== "completed" && created.status !== "existing") assert.fail();

  const ok = await h.approve.execute(
    {
      projectId: h.projectId,
      artifactType: "generation_plan",
      artifactId: created.plan.artifactId!,
      revision: created.plan.revision,
      decision: "approved",
      expectedProjectRevision: 1,
      confirmation: true,
    },
    { correlationId: "corr-appr-1", mode: "execute" },
  );
  assert.equal(ok.status, "completed");

  const again = await h.approve.execute(
    {
      projectId: h.projectId,
      artifactType: "generation_plan",
      artifactId: created.plan.artifactId!,
      revision: created.plan.revision,
      decision: "approved",
      expectedProjectRevision: h.projectRevision,
      confirmation: true,
    },
    { correlationId: "corr-appr-2", mode: "execute" },
  );
  assert.equal(again.status, "existing");

  const historical = await h.approve.execute(
    {
      projectId: h.projectId,
      artifactType: "generation_plan",
      artifactId: created.plan.artifactId!,
      revision: created.plan.revision + 1,
      decision: "approved",
      expectedProjectRevision: h.projectRevision,
      confirmation: true,
    },
    { correlationId: "corr-appr-3", mode: "execute" },
  );
  assert.equal(historical.status, "failed");
  if (historical.status === "failed") {
    assert.equal(historical.code, "approval_revision_not_active");
  }

  // After a new plan revision becomes active, prior approval is stale in dry-run view
  h.bumpStoredRevision();
  const after = await h.svc.dryRun(
    { projectId: h.projectId },
    { correlationId: "corr-appr-stale", mode: "dry-run" },
  );
  assert.equal(after.existingPlan?.approval?.status, "stale");
});
