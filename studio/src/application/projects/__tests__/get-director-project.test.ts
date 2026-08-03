import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGetDirectorProject,
  mapDirectorProjectView,
} from "../get-director-project";
import type {
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "../ports";
import type { VideoProjectBrief } from "@/domain/brief";

const WS = "33333333-3333-4333-8333-333333333333";
const PID = "11111111-1111-4111-8111-111111111111";
const AID = "22222222-2222-4222-8222-222222222222";

const project: PersistedVideoProject = {
  id: PID,
  workspaceId: WS,
  name: "Lancement App",
  status: "draft",
  activeRevision: 1,
  schemaVersion: "1.0.0",
  createdAt: "2026-08-02T12:00:00.000Z",
  updatedAt: "2026-08-02T12:00:00.000Z",
  archivedAt: null,
  correlationId: "corr-1",
};

const briefValue = {
  id: AID,
  projectId: PID,
  schemaVersion: "1.0.0",
  revision: 1,
  createdAt: "2026-08-02T12:00:00.000Z",
  createdBy: "tester",
  correlationId: "corr-1",
  projectName: "Lancement App",
  subjectType: "product",
  subjectName: "RideCloud",
  subjectDescription: "Application de mobilité partagée pour les villes.",
  objective: "awareness",
  platform: "instagram",
  durationSeconds: 30,
  aspectRatio: "9:16",
  language: "fr",
  tone: "warm",
  mediaReferences: [],
};

function projectsRepo(p: PersistedVideoProject | null): ProjectRepository {
  return {
    create: async () => undefined,
    load: async () => p,
    saveStatus: async () => p!,
  };
}

function artifactsRepo(opts: {
  active?: { artifactId: string; revision: number } | null;
  artifact?: PersistedArtifact | null;
}): ArtifactRepository {
  return {
    append: async () => undefined,
    load: async () => opts.artifact ?? null,
    loadByRevision: async () => opts.artifact ?? null,
    getActive: async () =>
      opts.active
        ? {
            projectId: PID,
            artifactType: "video_project_brief",
            artifactId: opts.active.artifactId,
            revision: opts.active.revision,
            updatedAt: "2026-08-02T12:00:00.000Z",
            updatedBy: "tester",
          }
        : null,
    setActive: async () => ({
      projectId: PID,
      artifactType: "video_project_brief",
      artifactId: AID,
      revision: 1,
      updatedAt: "2026-08-02T12:00:00.000Z",
      updatedBy: "tester",
    }),
  };
}

test("mapDirectorProjectView — view model sans ligne DB brute", () => {
  const view = mapDirectorProjectView(
    project,
    briefValue as VideoProjectBrief,
    1,
    AID
  );
  assert.equal(view.project.name, "Lancement App");
  assert.equal(view.brief.platform, "instagram");
  assert.equal(view.nextStep.enabled, false);
  assert.equal("workspaceId" in view.project, false);
});

test("get — projet absent", async () => {
  const svc = createGetDirectorProject({
    projects: projectsRepo(null),
    artifacts: artifactsRepo({}),
  });
  const r = await svc.execute(PID, WS);
  assert.equal(r.status, "not_found");
});

test("get — workspace incorrect", async () => {
  const svc = createGetDirectorProject({
    projects: projectsRepo({ ...project, workspaceId: "99999999-9999-4999-8999-999999999999" }),
    artifacts: artifactsRepo({}),
  });
  const r = await svc.execute(PID, WS);
  assert.equal(r.status, "not_found");
});

test("get — artifact invalide", async () => {
  const svc = createGetDirectorProject({
    projects: projectsRepo(project),
    artifacts: artifactsRepo({
      active: { artifactId: AID, revision: 1 },
      artifact: {
        id: AID,
        workspaceId: WS,
        projectId: PID,
        artifactType: "video_project_brief",
        revision: 1,
        schemaVersion: "1.0.0",
        parentRevisionId: null,
        value: { broken: true },
        createdAt: "2026-08-02T12:00:00.000Z",
        createdBy: "tester",
        correlationId: "corr-1",
      },
    }),
  });
  const r = await svc.execute(PID, WS);
  assert.equal(r.status, "invalid_artifact");
});

test("get — happy path", async () => {
  const svc = createGetDirectorProject({
    projects: projectsRepo(project),
    artifacts: artifactsRepo({
      active: { artifactId: AID, revision: 1 },
      artifact: {
        id: AID,
        workspaceId: WS,
        projectId: PID,
        artifactType: "video_project_brief",
        revision: 1,
        schemaVersion: "1.0.0",
        parentRevisionId: null,
        value: briefValue,
        createdAt: "2026-08-02T12:00:00.000Z",
        createdBy: "tester",
        correlationId: "corr-1",
      },
    }),
  });
  const r = await svc.execute(PID, WS);
  assert.equal(r.status, "ok");
  if (r.status === "ok") {
    assert.equal(r.view.brief.durationSeconds, 30);
    assert.equal(r.view.nextStep.id, "marketing_analysis");
  }
});
