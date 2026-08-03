import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCreateDirectorProject,
  type CreateDirectorProjectCommand,
} from "../create-director-project";
import type {
  CreateProjectWithBriefPort,
  CreateProjectWithBriefRpcResult,
} from "@/infrastructure/db/repositories/create-project-with-brief";
import { PersistenceError } from "@/infrastructure/db/errors";

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
  overrides: Partial<CreateDirectorProjectCommand> = {}
): CreateDirectorProjectCommand {
  return {
    projectId: "11111111-1111-4111-8111-111111111111",
    artifactId: "22222222-2222-4222-8222-222222222222",
    workspaceId: "33333333-3333-4333-8333-333333333333",
    expectedBriefRevision: 1,
    correlationId: "corr-create-test-01",
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

function fakePort(
  impl: (input: unknown) => Promise<CreateProjectWithBriefRpcResult>
): CreateProjectWithBriefPort {
  return { execute: impl as CreateProjectWithBriefPort["execute"] };
}

test("create — commande valide appelle le port avec brief finalisé", async () => {
  const calls: unknown[] = [];
  const svc = createCreateDirectorProject({
    port: fakePort(async (input) => {
      calls.push(input);
      return {
        status: "created",
        projectId: "11111111-1111-4111-8111-111111111111",
        artifactId: "22222222-2222-4222-8222-222222222222",
        revision: 1,
        createdAt: "2026-08-02T12:00:00.000Z",
        updatedAt: "2026-08-02T12:00:00.000Z",
      };
    }),
    nowIso: () => "2026-08-02T12:00:00.000Z",
  });

  const cmd = baseCommand();
  const frozenFields = { ...cmd.draft.fields };
  const result = await svc.execute(cmd);
  assert.equal(result.status, "created");
  if (result.status !== "created" && result.status !== "existing") return;
  assert.equal(result.projectId, cmd.projectId);
  assert.equal(result.projectName, "Lancement App");
  assert.equal(calls.length, 1);
  const sent = calls[0] as { brief: Record<string, unknown>; projectId: string };
  assert.equal(sent.projectId, cmd.projectId);
  assert.equal(sent.brief.projectName, "Lancement App");
  assert.equal(sent.brief.revision, 1);
  // draft not mutated
  assert.deepEqual(cmd.draft.fields, frozenFields);
});

test("create — brief invalide ne touche pas le port", async () => {
  let called = false;
  const svc = createCreateDirectorProject({
    port: fakePort(async () => {
      called = true;
      throw new Error("should not");
    }),
    nowIso: () => "2026-08-02T12:00:00.000Z",
  });
  const result = await svc.execute(
    baseCommand({
      draft: {
        draftVersion: "1.0.0",
        updatedAt: "2026-08-02T12:00:00.000Z",
        currentStep: 5,
        fields: { projectName: "" },
      },
    })
  );
  assert.equal(result.status, "failed");
  if (result.status === "failed") assert.equal(result.code, "invalid_brief");
  assert.equal(called, false);
});

test("create — révision autre que 1 refusée", async () => {
  const svc = createCreateDirectorProject({
    port: fakePort(async () => {
      throw new Error("no");
    }),
    nowIso: () => "2026-08-02T12:00:00.000Z",
  });
  const result = await svc.execute(
    baseCommand({ expectedBriefRevision: 2 as unknown as 1 })
  );
  assert.equal(result.status, "failed");
  if (result.status === "failed") assert.equal(result.code, "invalid_revision");
});

test("create — erreur port normalisée", async () => {
  const svc = createCreateDirectorProject({
    port: fakePort(async () => {
      throw new PersistenceError(
        "not_found",
        "Workspace V2 introuvable. Vérifiez DIRECTOR_V2_WORKSPACE_ID."
      );
    }),
    nowIso: () => "2026-08-02T12:00:00.000Z",
  });
  const result = await svc.execute(baseCommand());
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.code, "not_found");
    assert.match(result.publicMessage, /Workspace/);
  }
});

test("create — existing rejoué", async () => {
  const svc = createCreateDirectorProject({
    port: fakePort(async () => ({
      status: "existing",
      projectId: "11111111-1111-4111-8111-111111111111",
      artifactId: "22222222-2222-4222-8222-222222222222",
      revision: 1,
      createdAt: "2026-08-02T11:00:00.000Z",
      updatedAt: "2026-08-02T11:00:00.000Z",
    })),
    nowIso: () => "2026-08-02T12:00:00.000Z",
  });
  const result = await svc.execute(baseCommand());
  assert.equal(result.status, "existing");
});
