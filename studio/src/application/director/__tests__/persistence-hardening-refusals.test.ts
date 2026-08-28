import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIsolatedPersistenceEnv } from "../persistence-production-enablement-preflight";
import { DIRECTOR_CAPABILITY_DISABLED_CODE } from "../director-action-policy";
import { createBuildScenePackagesForProject } from "@/application/directors/prompt/build-for-project";
import { createRouteGenerationPlanForProject } from "@/application/directors/routing/route-for-project";
import { createStartProductionForProject } from "@/application/directors/production/start-for-project";
import { createApproveArtifactForProject } from "@/application/directors/routing/approve-for-project";
import { createDownloadFinalAssetForProject } from "@/application/directors/delivery/download-final-asset";
import {
  createExecuteMergeForProject,
  createPrepareExportForProject,
  createRecordQualityReviewForProject,
} from "@/application/directors/delivery/delivery-for-project";
import { phase11EMergeExportFlagsAuditView } from "@/application/production/phase-11e-merge-export-allowlist";
import type {
  ArtifactRepository,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";

const isolated = buildIsolatedPersistenceEnv();
const ctx = { correlationId: "corr-hard-187", mode: "execute" as const };

function project(id = "p1"): PersistedVideoProject {
  return {
    id,
    workspaceId: "ws-1",
    name: "P",
    status: "draft",
    activeRevision: 1,
    schemaVersion: "1.0.0",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    archivedAt: null,
    correlationId: "corr",
  };
}

function repos(): { projects: ProjectRepository; artifacts: ArtifactRepository } {
  return {
    projects: {
      async create() {},
      async load(id) {
        return id === "p1" ? project() : null;
      },
      async saveStatus() {
        throw new Error("no status write");
      },
    },
    artifacts: {
      async append() {
        throw new Error("no artifact write");
      },
      async load() {
        return null;
      },
      async loadByRevision() {
        return null;
      },
      async getActive() {
        return null;
      },
      async setActive() {
        throw new Error("no setActive");
      },
    },
  };
}

test("prompt execute — persistence seule refusée, zéro artifact", async () => {
  let artifacts = 0;
  const { projects, artifacts: arts } = repos();
  const svc = createBuildScenePackagesForProject({
    workspaceId: "ws-1",
    projects,
    artifacts: {
      ...arts,
      async append() {
        artifacts += 1;
      },
    },
    directorRuns: {
      async beginOrGet() {
        artifacts += 1;
        throw new Error("beginOrGet");
      },
      async persistScenePackageSet() {
        artifacts += 1;
        throw new Error("persist");
      },
      async failRun() {},
      async loadActiveScenePackageSet() {
        return null;
      },
    },
    env: isolated,
  });
  const result = await svc.execute(
    { projectId: "p1", expectedStoryboardRevision: 1 },
    ctx,
  );
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.code, DIRECTOR_CAPABILITY_DISABLED_CODE);
    assert.equal(result.httpHint, 503);
  }
  assert.equal(artifacts, 0);
});

test("routing execute + approve generation_plan — refusés, zéro artifact", async () => {
  const { projects, artifacts } = repos();
  let persist = 0;
  const route = createRouteGenerationPlanForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    directorRuns: {
      async beginOrGet() {
        persist += 1;
        throw new Error("begin");
      },
      async persistGenerationPlan() {
        persist += 1;
        throw new Error("persist");
      },
      async failRun() {},
      async loadActiveGenerationPlan() {
        return null;
      },
      async loadLatestApproval() {
        return null;
      },
    },
    budget: {
      async loadSnapshot() {
        persist += 1;
        throw new Error("budget");
      },
    },
    buildRegistry: () => {
      throw new Error("registry");
    },
    env: isolated,
  });
  const routed = await route.execute(
    {
      projectId: "p1",
      expectedScenePackageSetRevision: 1,
      expectedRegistrySnapshotVersion: "v",
    },
    ctx,
  );
  assert.equal(routed.status, "failed");
  if (routed.status === "failed") {
    assert.equal(routed.code, DIRECTOR_CAPABILITY_DISABLED_CODE);
  }
  assert.equal(persist, 0);

  const approve = createApproveArtifactForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    approvals: {
      async persistApproval() {
        persist += 1;
        throw new Error("approval");
      },
    },
    env: isolated,
  });
  const approved = await approve.execute(
    {
      projectId: "p1",
      artifactType: "generation_plan",
      artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      revision: 1,
      decision: "approved",
      expectedProjectRevision: 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(approved.status, "failed");
  if (approved.status === "failed") {
    assert.equal(approved.code, DIRECTOR_CAPABILITY_DISABLED_CODE);
  }
  assert.equal(persist, 0);
});

test("production start — refus avant budget / run / job / enqueue", async () => {
  let budget = 0;
  let runs = 0;
  let jobs = 0;
  let enqueue = 0;
  const { projects, artifacts } = repos();
  const unused = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined;
        throw new Error(`unexpected production dep access: ${String(prop)}`);
      },
    },
  );
  const svc = createStartProductionForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    directorRuns: unused as never,
    budget: {
      async loadSnapshot() {
        budget += 1;
        throw new Error("budget snapshot");
      },
    },
    productionDirector: unused as never,
    jobQueue: {
      async enqueue() {
        enqueue += 1;
        jobs += 1;
        throw new Error("enqueue");
      },
    } as never,
    registry: unused as never,
    productionPorts: {
      budget: {
        async reserve() {
          budget += 1;
          throw new Error("reserve");
        },
      },
      runStore: {
        async save() {
          runs += 1;
          throw new Error("save");
        },
      },
    } as never,
    env: isolated,
  });
  const result = await svc.execute(
    {
      projectId: "p1",
      expectedGenerationPlanRevision: 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.code, DIRECTOR_CAPABILITY_DISABLED_CODE);
  }
  assert.equal(budget, 0);
  assert.equal(runs, 0);
  assert.equal(jobs, 0);
  assert.equal(enqueue, 0);
});

test("merge/export/quality/HR — refusés, mergeExportAuthorized false", async () => {
  const { projects, artifacts } = repos();
  const unused = {} as never;
  const merge = createExecuteMergeForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    deliveryRuns: unused,
    mergeEngine: unused,
    env: isolated,
  });
  const merged = await merge.execute({ projectId: "p1", confirmation: true }, ctx);
  assert.equal(merged.status, "failed");

  const exp = createPrepareExportForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    deliveryRuns: unused,
    postProductionDirector: unused,
    env: isolated,
  });
  const exported = await exp.execute(
    { projectId: "p1", confirmation: true, destinationId: "download" },
    ctx,
  );
  assert.equal(exported.status, "failed");

  const review = createRecordQualityReviewForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    deliveryRuns: unused,
    postProductionDirector: unused,
    env: isolated,
  });
  const reviewed = await review.execute(
    {
      projectId: "p1",
      confirmation: true,
      decision: "approved",
      reviewedIssueCodes: [],
      expectedQualityReportRevision: 1,
      expectedProductionResultRevision: 1,
    },
    ctx,
  );
  assert.equal(reviewed.status, "failed");
  if (reviewed.status === "failed") {
    assert.equal(reviewed.code, DIRECTOR_CAPABILITY_DISABLED_CODE);
  }
  assert.equal(phase11EMergeExportFlagsAuditView(isolated).mergeExportAuthorized, false);
});

test("download — refus 404, zéro lecture Storage, aucun header média", async () => {
  let reads = 0;
  const { projects, artifacts } = repos();
  const download = createDownloadFinalAssetForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    assetContent: {
      configured: true,
      async put() {
        throw new Error("put");
      },
      async get() {
        reads += 1;
        throw new Error("get should not run");
      },
    },
    env: isolated,
  });
  const result = await download.execute({ projectId: "p1" });
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.httpHint, 404);
    assert.equal(result.code, DIRECTOR_CAPABILITY_DISABLED_CODE);
  }
  assert.equal(reads, 0);
});
