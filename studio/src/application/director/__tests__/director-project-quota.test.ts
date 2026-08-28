import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIRECTOR_PROJECT_QUOTA,
  DIRECTOR_PROJECT_QUOTA_EXCEEDED_CODE,
  DIRECTOR_PROJECT_QUOTA_MAX_ACTIVE,
  evaluateDirectorProjectQuota,
} from "../director-project-quota";
import {
  createCreateDirectorProject,
  type CreateDirectorProjectCommand,
} from "@/application/projects/create-director-project";
import type { CreateProjectWithBriefPort } from "@/infrastructure/db/repositories/create-project-with-brief";

const validFields = {
  projectName: "Lancement App",
  subjectType: "product" as const,
  subjectName: "RideCloud",
  subjectDescription: "Application de mobilité partagée pour les villes.",
  objective: "awareness" as const,
  platform: "instagram" as const,
  durationSeconds: 30 as const,
  aspectRatio: "9:16" as const,
  language: "fr",
  tone: "warm" as const,
  mediaReferences: [],
};

function baseCommand(
  overrides: Partial<CreateDirectorProjectCommand> = {},
): CreateDirectorProjectCommand {
  return {
    projectId: "11111111-1111-4111-8111-111111111111",
    artifactId: "22222222-2222-4222-8222-222222222222",
    workspaceId: "33333333-3333-4333-8333-333333333333",
    expectedBriefRevision: 1,
    correlationId: "corr-quota-01",
    actor: { type: "shared_password", id: "shared-password-user" },
    draft: {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-02T12:00:00.000Z",
      currentStep: 5,
      fields: { ...validFields },
    },
    ...overrides,
  };
}

test("quota — constante 50, non atomique, archivés exclus, replay autorisé", () => {
  assert.equal(DIRECTOR_PROJECT_QUOTA_MAX_ACTIVE, 50);
  assert.equal(DIRECTOR_PROJECT_QUOTA.atomic, false);
  assert.equal(DIRECTOR_PROJECT_QUOTA.archivedExcluded, true);
  assert.equal(DIRECTOR_PROJECT_QUOTA.replayAllowedAtQuota, true);
  assert.equal(DIRECTOR_PROJECT_QUOTA.blocksSingleTenantActivation, false);
});

test("quota — create sous quota / replay au quota / nouveau refusé", () => {
  assert.equal(
    evaluateDirectorProjectQuota({
      existingInWorkspace: false,
      activeNonArchivedCount: 49,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateDirectorProjectQuota({
      existingInWorkspace: true,
      activeNonArchivedCount: 50,
    }).allowed,
    true,
  );
  const denied = evaluateDirectorProjectQuota({
    existingInWorkspace: false,
    activeNonArchivedCount: 50,
  });
  assert.equal(denied.allowed, false);
  if (denied.allowed) return;
  assert.equal(denied.code, DIRECTOR_PROJECT_QUOTA_EXCEEDED_CODE);
});

test("create — refus avant RPC au quota ; replay au quota autorisé", async () => {
  let rpcCalls = 0;
  const port: CreateProjectWithBriefPort = {
    async execute() {
      rpcCalls += 1;
      return {
        status: "created",
        projectId: "11111111-1111-4111-8111-111111111111",
        artifactId: "22222222-2222-4222-8222-222222222222",
        revision: 1,
        createdAt: "2026-08-02T12:00:00.000Z",
        updatedAt: "2026-08-02T12:00:00.000Z",
      };
    },
  };
  const denied = createCreateDirectorProject({
    port,
    nowIso: () => "2026-08-02T12:00:00.000Z",
    loadExisting: async () => null,
    countActiveNonArchived: async () => 50,
  });
  const fail = await denied.execute(baseCommand());
  assert.equal(fail.status, "failed");
  if (fail.status === "failed") {
    assert.equal(fail.code, DIRECTOR_PROJECT_QUOTA_EXCEEDED_CODE);
  }
  assert.equal(rpcCalls, 0);

  const replay = createCreateDirectorProject({
    port,
    nowIso: () => "2026-08-02T12:00:00.000Z",
    loadExisting: async () => ({
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "33333333-3333-4333-8333-333333333333",
      name: "Lancement App",
      status: "draft",
      activeRevision: 1,
      schemaVersion: "1.0.0",
      createdAt: "2026-08-02T11:00:00.000Z",
      updatedAt: "2026-08-02T11:00:00.000Z",
      archivedAt: null,
      correlationId: "corr",
    }),
    countActiveNonArchived: async () => 50,
  });
  const ok = await replay.execute(baseCommand());
  assert.equal(ok.status, "created");
  assert.equal(rpcCalls, 1);
});

test("create — workspace scoped : autre workspace ne compte pas comme replay", async () => {
  let rpcCalls = 0;
  const svc = createCreateDirectorProject({
    port: {
      async execute() {
        rpcCalls += 1;
        throw new Error("should not");
      },
    },
    nowIso: () => "2026-08-02T12:00:00.000Z",
    loadExisting: async () => ({
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "other-workspace",
      name: "X",
      status: "draft",
      activeRevision: 1,
      schemaVersion: "1.0.0",
      createdAt: "2026-08-02T11:00:00.000Z",
      updatedAt: "2026-08-02T11:00:00.000Z",
      archivedAt: null,
      correlationId: "corr",
    }),
    countActiveNonArchived: async () => 50,
  });
  const result = await svc.execute(baseCommand());
  assert.equal(result.status, "failed");
  assert.equal(rpcCalls, 0);
});

test("quota — course check-then-act documentée (deux comptes à 49)", () => {
  const a = evaluateDirectorProjectQuota({
    existingInWorkspace: false,
    activeNonArchivedCount: 49,
  });
  const b = evaluateDirectorProjectQuota({
    existingInWorkspace: false,
    activeNonArchivedCount: 49,
  });
  assert.equal(a.allowed, true);
  assert.equal(b.allowed, true);
});
