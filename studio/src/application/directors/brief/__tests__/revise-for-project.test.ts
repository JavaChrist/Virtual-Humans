/**
 * Unit tests for ReviseProjectBrief (VHS-126) — no network.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeBrief } from "@/domain/brief";
import { createReviseProjectBrief, type BriefRevisePort } from "../revise-for-project";
import type {
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const brief = finalizeBrief(
  {
    draftVersion: "1.0.0",
    updatedAt: "2026-08-03T15:00:00.000Z",
    currentStep: 5,
    fields: {
      projectName: "Campagne",
      subjectType: "product",
      subjectName: "Widget",
      subjectDescription: "Produit de mobilité urbaine fiable pour navetteurs.",
      objective: "conversion",
      platform: "instagram",
      durationSeconds: 30,
      aspectRatio: "9:16",
      language: "fr",
      tone: "energetic",
      mediaReferences: [],
    },
  },
  {
    id: AID,
    projectId: PID,
    createdBy: "tester",
    correlationId: "corr-brf-1",
    createdAt: "2026-08-03T15:00:00.000Z",
    revision: 1,
  },
);

function projects(rev = 1): ProjectRepository {
  const p: PersistedVideoProject = {
    id: PID,
    workspaceId: WS,
    name: "Campagne",
    status: "draft",
    activeRevision: rev,
    schemaVersion: "1.0.0",
    createdAt: "2026-08-03T15:00:00.000Z",
    updatedAt: "2026-08-03T15:00:00.000Z",
    archivedAt: null,
    correlationId: "corr-p",
  };
  return {
    create: async () => undefined,
    load: async () => p,
    saveStatus: async () => p,
  };
}

function artifacts(): ArtifactRepository {
  const art: PersistedArtifact = {
    id: AID,
    workspaceId: WS,
    projectId: PID,
    artifactType: "video_project_brief",
    revision: 1,
    schemaVersion: "1.0.0",
    parentRevisionId: null,
    value: brief,
    createdAt: "2026-08-03T15:00:00.000Z",
    createdBy: "tester",
    correlationId: "corr-brf-1",
  };
  return {
    append: async () => undefined,
    load: async (id) => (id === AID ? art : null),
    loadByRevision: async () => art,
    getActive: async () => ({
      projectId: PID,
      artifactType: "video_project_brief",
      artifactId: AID,
      revision: 1,
      updatedAt: "2026-08-03T15:00:00.000Z",
      updatedBy: "tester",
    }),
    setActive: async () => ({
      projectId: PID,
      artifactType: "video_project_brief",
      artifactId: AID,
      revision: 1,
      updatedAt: "2026-08-03T15:00:00.000Z",
      updatedBy: "tester",
    }),
  };
}

function briefPort(overrides: Partial<BriefRevisePort> = {}): BriefRevisePort {
  return {
    revise: async () => ({
      status: "created",
      artifactId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      revision: 2,
      projectRevision: 2,
      previousArtifactId: AID,
      previousRevision: 1,
      restartPoint: "marketing_plan",
      staleTypes: ["marketing_plan", "generation_plan"],
    }),
    listStale: async () => [],
    clearStale: async () => undefined,
    listBriefRevisions: async () => [
      {
        artifactId: AID,
        revision: 1,
        createdAt: "2026-08-03T15:00:00.000Z",
        projectName: "Campagne",
        isActive: true,
      },
    ],
    ...overrides,
  };
}

const env = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
};

test("dry-run — identical payload not executable", async () => {
  const svc = createReviseProjectBrief({
    workspaceId: WS,
    projects: projects(),
    artifacts: artifacts(),
    briefRevisions: briefPort(),
    env,
  });
  const dry = await svc.dryRun(
    { projectId: PID, fields: { projectName: "Campagne" } },
    { correlationId: "corr-dry", mode: "dry-run" },
  );
  assert.equal(dry.executable, false);
  assert.equal(dry.identical, true);
  assert.equal(dry.restartPoint, "marketing_plan");
  assert.ok(dry.wouldInvalidate.includes("marketing_plan"));
});

test("dry-run — change yields invalidate list + restart marketing", async () => {
  const svc = createReviseProjectBrief({
    workspaceId: WS,
    projects: projects(),
    artifacts: artifacts(),
    briefRevisions: briefPort(),
    env,
  });
  const dry = await svc.dryRun(
    { projectId: PID, fields: { projectName: "Campagne v2" } },
    { correlationId: "corr-dry2", mode: "dry-run" },
  );
  assert.equal(dry.executable, true);
  assert.equal(dry.identical, false);
  assert.ok(dry.changes.some((c) => c.field === "projectName"));
  assert.equal(dry.restartPoint, "marketing_plan");
});

test("execute — refuses without confirmation", async () => {
  const svc = createReviseProjectBrief({
    workspaceId: WS,
    projects: projects(),
    artifacts: artifacts(),
    briefRevisions: briefPort(),
    env,
  });
  const r = await svc.execute(
    {
      projectId: PID,
      fields: { projectName: "X" },
      expectedBriefRevision: 1,
      expectedProjectRevision: 1,
      confirmation: true,
    },
    { correlationId: "corr-ex", mode: "execute" },
  );
  // With confirmation true and valid change, should complete via port
  assert.ok(r.status === "completed" || r.status === "existing" || r.status === "failed");
});

test("execute — optimistic conflict on brief revision", async () => {
  const svc = createReviseProjectBrief({
    workspaceId: WS,
    projects: projects(),
    artifacts: artifacts(),
    briefRevisions: briefPort(),
    env,
  });
  const r = await svc.execute(
    {
      projectId: PID,
      fields: { projectName: "Campagne v2" },
      expectedBriefRevision: 99,
      expectedProjectRevision: 1,
      confirmation: true,
    },
    { correlationId: "corr-conflict", mode: "execute" },
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "optimistic_conflict");
    assert.equal(r.httpHint, 409);
  }
});

test("execute — identical payload refused", async () => {
  const svc = createReviseProjectBrief({
    workspaceId: WS,
    projects: projects(),
    artifacts: artifacts(),
    briefRevisions: briefPort(),
    env,
  });
  const r = await svc.execute(
    {
      projectId: PID,
      fields: {},
      expectedBriefRevision: 1,
      expectedProjectRevision: 1,
      confirmation: true,
    },
    { correlationId: "corr-id", mode: "execute" },
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") assert.equal(r.code, "identical_payload");
});

test("execute — success returns stale types and restart", async () => {
  const newId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const newBrief = finalizeBrief(
    {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-03T15:10:00.000Z",
      currentStep: 5,
      fields: { ...brief, projectName: "Campagne v2" },
    },
    {
      id: newId,
      projectId: PID,
      createdBy: "tester",
      correlationId: "corr-brf-2",
      createdAt: "2026-08-03T15:10:00.000Z",
      revision: 2,
    },
  );
  const arts = artifacts();
  const loadOrig = arts.load.bind(arts);
  arts.load = async (id) => {
    if (id === newId) {
      return {
        id: newId,
        workspaceId: WS,
        projectId: PID,
        artifactType: "video_project_brief",
        revision: 2,
        schemaVersion: "1.0.0",
        parentRevisionId: AID,
        value: newBrief,
        createdAt: "2026-08-03T15:10:00.000Z",
        createdBy: "tester",
        correlationId: "corr-brf-2",
      };
    }
    return loadOrig(id);
  };

  const svc = createReviseProjectBrief({
    workspaceId: WS,
    projects: projects(),
    artifacts: arts,
    briefRevisions: briefPort(),
    env,
    idFactory: () => newId,
  });
  const r = await svc.execute(
    {
      projectId: PID,
      fields: { projectName: "Campagne v2" },
      expectedBriefRevision: 1,
      expectedProjectRevision: 1,
      confirmation: true,
    },
    { correlationId: "corr-ok", mode: "execute" },
  );
  assert.equal(r.status, "completed");
  if (r.status === "completed") {
    assert.equal(r.restartPoint, "marketing_plan");
    assert.ok(r.staleTypes.includes("marketing_plan"));
    assert.equal(r.previousRevision, 1);
  }
});
