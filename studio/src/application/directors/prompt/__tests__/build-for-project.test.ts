import assert from "node:assert/strict";
import { test } from "node:test";
import { makePromptChain } from "@/domain/prompt/__tests__/fixtures";
import {
  createBuildScenePackagesForProject,
  createDeterministicPromptAnalyzer,
  type PromptDirectorRunPort,
} from "../build-for-project";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import type { PersistedArtifact, PersistedVideoProject } from "@/application/projects/ports";

function makeProject(id: string, workspaceId: string): PersistedVideoProject {
  return {
    id,
    workspaceId,
    name: "P",
    status: "draft",
    activeRevision: 1,
    schemaVersion: "1.0.0",
    createdAt: "2026-08-03T12:00:00.000Z",
    updatedAt: "2026-08-03T12:00:00.000Z",
    archivedAt: null,
    correlationId: "corr-project-01",
  };
}

test("dry-run — providerCalled false, zéro écriture", async () => {
  const chain = makePromptChain({ withCharacter: true });
  const workspaceId = "ws-1";
  const projectId = chain.brief.projectId;
  let writes = 0;
  const artifacts: ArtifactRepository = {
    async append() {
      writes += 1;
    },
    async load(id) {
      const map: Record<string, unknown> = {
        "a-brief": chain.brief,
        "a-plan": chain.marketingPlan,
        "a-concept": chain.creativeConcept,
        "a-script": chain.videoScript,
        "a-visual": chain.visualDirection,
        "a-sb": chain.storyboard,
      };
      const value = map[id];
      if (!value) return null;
      return {
        id,
        workspaceId,
        projectId,
        artifactType: "video_project_brief",
        revision: 1,
        schemaVersion: "1.0.0",
        parentRevisionId: null,
        value,
        createdAt: "2026-08-03T12:00:00.000Z",
        createdBy: "t",
        correlationId: "corr-art-01",
      } as PersistedArtifact;
    },
    async loadByRevision() {
      return null;
    },
    async getActive(_pid, type) {
      const ids: Record<string, string> = {
        video_project_brief: "a-brief",
        marketing_plan: "a-plan",
        creative_concept: "a-concept",
        video_script: "a-script",
        visual_direction: "a-visual",
        storyboard_project: "a-sb",
      };
      const artifactId = ids[type];
      if (!artifactId) return null;
      return {
        projectId,
        artifactType: type,
        artifactId,
        revision: 1,
        updatedAt: "2026-08-03T12:00:00.000Z",
        updatedBy: "t",
      };
    },
    async setActive() {
      throw new Error("no write");
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
  const directorRuns: PromptDirectorRunPort = {
    async beginOrGet() {
      throw new Error("no begin on dry-run");
    },
    async persistScenePackageSet() {
      throw new Error("no persist on dry-run");
    },
    async failRun() {},
    async loadActiveScenePackageSet() {
      return null;
    },
  };
  const svc = createBuildScenePackagesForProject({
    workspaceId,
    projects,
    artifacts,
    directorRuns,
    analyzer: createDeterministicPromptAnalyzer(),
    env: { DIRECTOR_V2_ENABLED: "1", DIRECTOR_V2_PERSISTENCE_ENABLED: "1" },
  });
  const dry = await svc.dryRun(
    { projectId },
    { correlationId: "corr-prompt-dry", mode: "dry-run" },
  );
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executable, true);
  assert.equal(dry.executionAvailable, true);
  assert.equal(writes, 0);
  assert.equal(dry.storyboardRevision, 1);
});

test("execute — lot atomique + replay idempotent + conflit révision", async () => {
  const chain = makePromptChain({ withCharacter: true });
  const workspaceId = "ws-1";
  const projectId = chain.brief.projectId;
  let stored: { revision: number; value: unknown } | null = null;
  let beginCount = 0;
  const artifacts: ArtifactRepository = {
    async append() {},
    async load(id) {
      if (stored && id === "out-1") {
        return {
          id,
          workspaceId,
          projectId,
          artifactType: "scene_package_set",
          revision: stored.revision,
          schemaVersion: "1.0.0",
          parentRevisionId: null,
          value: stored.value,
          createdAt: "2026-08-03T12:00:00.000Z",
          createdBy: "t",
          correlationId: "corr-out",
        } as PersistedArtifact;
      }
      const map: Record<string, unknown> = {
        "a-brief": chain.brief,
        "a-plan": chain.marketingPlan,
        "a-concept": chain.creativeConcept,
        "a-script": chain.videoScript,
        "a-visual": chain.visualDirection,
        "a-sb": chain.storyboard,
      };
      const value = map[id];
      if (!value) return null;
      return {
        id,
        workspaceId,
        projectId,
        artifactType: "storyboard_project",
        revision: 1,
        schemaVersion: "1.0.0",
        parentRevisionId: null,
        value,
        createdAt: "2026-08-03T12:00:00.000Z",
        createdBy: "t",
        correlationId: "corr-art-01",
      } as PersistedArtifact;
    },
    async loadByRevision() {
      return null;
    },
    async getActive(_pid, type) {
      const ids: Record<string, string> = {
        video_project_brief: "a-brief",
        marketing_plan: "a-plan",
        creative_concept: "a-concept",
        video_script: "a-script",
        visual_direction: "a-visual",
        storyboard_project: "a-sb",
      };
      const artifactId = ids[type];
      if (!artifactId) return null;
      return {
        projectId,
        artifactType: type,
        artifactId,
        revision: 1,
        updatedAt: "2026-08-03T12:00:00.000Z",
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
  const directorRuns: PromptDirectorRunPort = {
    async beginOrGet(input) {
      beginCount += 1;
      if (stored) {
        return {
          status: "existing",
          directorRunId: "run-1",
          revision: 1,
          outputArtifactId: "out-1",
        };
      }
      assert.equal(input.storyboardRevision, 1);
      return { status: "created", directorRunId: "run-1", revision: 1 };
    },
    async persistScenePackageSet(input) {
      const packages = (input.packageSet as { packages?: Array<{ sceneOrder: number }> }).packages;
      if (!Array.isArray(packages)) throw new Error("missing packages array");
      if (packages.length !== chain.storyboard.scenes.length) {
        throw new Error(`package count ${packages.length} != ${chain.storyboard.scenes.length}`);
      }
      const orders = packages.map((p) => p.sceneOrder);
      if (orders.join(",") !== [...orders].sort((a, b) => a - b).join(",")) {
        throw new Error(`packages unordered: ${orders.join(",")}`);
      }
      stored = { revision: 1, value: input.packageSet };
      return { status: "created", artifactId: input.artifactId || "out-1", revision: 1 };
    },
    async failRun() {},
    async loadActiveScenePackageSet() {
      return stored;
    },
  };
  const svc = createBuildScenePackagesForProject({
    workspaceId,
    projects,
    artifacts,
    directorRuns,
    env: { DIRECTOR_V2_ENABLED: "1", DIRECTOR_V2_PERSISTENCE_ENABLED: "1" },
  });
  const first = await svc.execute(
    { projectId, expectedStoryboardRevision: 1 },
    { correlationId: "corr-prompt-exec", mode: "execute" },
  );
  assert.equal(first.status, "completed", JSON.stringify(first));
  if (first.status !== "completed") return;
  assert.equal(first.packageSet.sceneCount, chain.storyboard.scenes.length);
  assert.ok((first.packageSet.packages?.[0]?.capabilityProfiles.length ?? 0) >= 1);

  const replay = await svc.execute(
    { projectId, expectedStoryboardRevision: 1 },
    { correlationId: "corr-prompt-replay", mode: "execute" },
  );
  assert.equal(replay.status, "existing");
  assert.equal(beginCount, 2);

  const conflict = await svc.execute(
    { projectId, expectedStoryboardRevision: 99 },
    { correlationId: "corr-prompt-conflict", mode: "execute" },
  );
  assert.equal(conflict.status, "failed");
  if (conflict.status === "failed") {
    assert.equal(conflict.code, "storyboard_revision_conflict");
    assert.equal(conflict.httpHint, 409);
  }
});
