/**
 * Director persistence integration against LOCAL Supabase (VHS-116).
 * Requires: Docker + supabase start + SUPABASE_LOCAL_* env.
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { PersistenceError } from "./errors";
import { resolveLocalSupabaseGate } from "./local-integration.gate";
import {
  cleanupWorkspace,
  createLocalClients,
  randomUUID,
} from "./integration-harness";
import { createSupabaseCreateProjectWithBriefPort } from "./repositories/create-project-with-brief";
import { createCreateDirectorProject } from "@/application/projects/create-director-project";
import { createGetDirectorProject } from "@/application/projects/get-director-project";
import { createListDirectorProjects } from "@/application/projects/list-director-projects";
import { createSupabaseArtifactRepository } from "./repositories/artifact-repository";
import { createSupabaseProjectRepository } from "./repositories/project-repository";

const gate = resolveLocalSupabaseGate();
if (!gate.ok) {
  throw new Error(`VHS-116: ${gate.reason}`);
}

const { client, clientB } = createLocalClients(gate);
const workspaces: string[] = [];

async function seedWorkspace() {
  const workspaceId = randomUUID();
  workspaces.push(workspaceId);
  const { error } = await client.from("workspaces").insert({
    id: workspaceId,
    slug: `d116-${workspaceId.slice(0, 8)}`,
    name: "Director 116",
    mode: "single_workspace",
  });
  if (error) throw new Error(error.message);
  await client.from("workspace_budget_policies").insert({
    workspace_id: workspaceId,
    hard_limit_minor: 50_000,
    currency: "USD",
  });
  return workspaceId;
}

function fields(name = "Projet Integration") {
  return {
    projectName: name,
    subjectType: "product" as const,
    subjectName: "Widget",
    subjectDescription: "Description produit pour tests d'intégration locaux.",
    objective: "awareness" as const,
    platform: "instagram" as const,
    durationSeconds: 30 as const,
    aspectRatio: "9:16" as const,
    language: "fr",
    tone: "warm" as const,
    mediaReferences: [] as [],
  };
}

function stackFor(workspaceId: string, db = client) {
  const projects = createSupabaseProjectRepository({ client: db, workspaceId });
  const artifacts = createSupabaseArtifactRepository({ client: db, workspaceId });
  const createProject = createCreateDirectorProject({
    port: createSupabaseCreateProjectWithBriefPort({ client: db }),
    nowIso: () => "2026-08-02T15:00:00.000Z",
  });
  return {
    createProject,
    getProject: createGetDirectorProject({ projects, artifacts }),
    listProjects: createListDirectorProjects({ projects, artifacts }),
  };
}

after(async () => {
  for (const ws of workspaces) {
    await cleanupWorkspace(client, ws).catch(() => undefined);
  }
});

test("VHS-116 — create / get / list", async () => {
  const workspaceId = await seedWorkspace();
  const stack = stackFor(workspaceId);
  const projectId = randomUUID();
  const artifactId = randomUUID();

  const created = await stack.createProject.execute({
    projectId,
    artifactId,
    workspaceId,
    expectedBriefRevision: 1,
    correlationId: "corr-116-it-create",
    actor: { type: "shared_password", id: "tester" },
    draft: {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-02T15:00:00.000Z",
      currentStep: 5,
      fields: fields("Création IT"),
    },
  });
  assert.equal(created.status, "created");
  if (created.status !== "created") return;

  const loaded = await stack.getProject.execute(projectId, workspaceId);
  assert.equal(loaded.status, "ok");
  if (loaded.status === "ok") {
    assert.equal(loaded.view.project.name, "Création IT");
    assert.equal(loaded.view.brief.platform, "instagram");
    assert.equal(loaded.view.nextStep.enabled, false);
  }

  const listed = await stack.listProjects.execute(10);
  assert.equal(listed.status, "ok");
  if (listed.status === "ok") {
    assert.ok(listed.items.some((i) => i.id === projectId));
  }

  const { data: audit } = await client
    .from("audit_log")
    .select("action")
    .eq("project_id", projectId)
    .eq("action", "director.project.created");
  assert.ok((audit?.length ?? 0) >= 1);

  const { data: events } = await client
    .from("domain_events")
    .select("event_type")
    .eq("project_id", projectId)
    .eq("event_type", "director.project.created");
  assert.ok((events?.length ?? 0) >= 1);
});

test("VHS-116 — double création concurrente idempotente", async () => {
  const workspaceId = await seedWorkspace();
  const projectId = randomUUID();
  const a1 = randomUUID();
  const a2 = randomUUID();
  const stackA = stackFor(workspaceId, client);
  const stackB = stackFor(workspaceId, clientB);
  const draft = {
    draftVersion: "1.0.0" as const,
    updatedAt: "2026-08-02T15:00:00.000Z",
    currentStep: 5,
    fields: fields("Concurrent"),
  };
  const cmd = (artifactId: string) => ({
    projectId,
    artifactId,
    workspaceId,
    expectedBriefRevision: 1 as const,
    correlationId: `corr-116-conc-${artifactId.slice(0, 8)}`,
    actor: { type: "shared_password" as const, id: "tester" },
    draft,
  });

  const results = await Promise.allSettled([
    stackA.createProject.execute(cmd(a1)),
    stackB.createProject.execute(cmd(a2)),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  const values = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof stackA.createProject.execute>>> => r.status === "fulfilled")
    .map((r) => r.value);
  for (const v of values) {
    assert.ok(v.status === "created" || v.status === "existing");
  }
  const { count } = await client
    .from("project_artifacts")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("artifact_type", "video_project_brief")
    .eq("revision", 1);
  assert.equal(count, 1);
});

test("VHS-116 — conflit brief différent", async () => {
  const workspaceId = await seedWorkspace();
  const stack = stackFor(workspaceId);
  const projectId = randomUUID();
  const first = await stack.createProject.execute({
    projectId,
    artifactId: randomUUID(),
    workspaceId,
    expectedBriefRevision: 1,
    correlationId: "corr-116-conflict-a",
    actor: { type: "shared_password", id: "tester" },
    draft: {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-02T15:00:00.000Z",
      currentStep: 5,
      fields: fields("A"),
    },
  });
  assert.equal(first.status, "created");

  const second = await stack.createProject.execute({
    projectId,
    artifactId: randomUUID(),
    workspaceId,
    expectedBriefRevision: 1,
    correlationId: "corr-116-conflict-b",
    actor: { type: "shared_password", id: "tester" },
    draft: {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-02T15:00:00.000Z",
      currentStep: 5,
      fields: { ...fields("B"), platform: "tiktok" },
    },
  });
  assert.equal(second.status, "failed");
  if (second.status === "failed") {
    assert.equal(second.code, "conflict");
  }
});

test("VHS-116 — isolation workspace + projet absent", async () => {
  const wsA = await seedWorkspace();
  const wsB = await seedWorkspace();
  const stackA = stackFor(wsA);
  const stackB = stackFor(wsB);
  const projectId = randomUUID();
  const created = await stackA.createProject.execute({
    projectId,
    artifactId: randomUUID(),
    workspaceId: wsA,
    expectedBriefRevision: 1,
    correlationId: "corr-116-iso",
    actor: { type: "shared_password", id: "tester" },
    draft: {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-02T15:00:00.000Z",
      currentStep: 5,
      fields: fields("Iso"),
    },
  });
  assert.equal(created.status, "created");

  const fromB = await stackB.getProject.execute(projectId, wsB);
  assert.equal(fromB.status, "not_found");

  const missing = await stackA.getProject.execute(randomUUID(), wsA);
  assert.equal(missing.status, "not_found");
});

test("VHS-116 — workspace inexistant via port", async () => {
  const port = createSupabaseCreateProjectWithBriefPort({ client });
  await assert.rejects(
    () =>
      port.execute({
        workspaceId: randomUUID(),
        projectId: randomUUID(),
        artifactId: randomUUID(),
        projectName: "Ghost",
        brief: { projectName: "Ghost" },
        schemaVersion: "1.0.0",
        correlationId: "corr-116-ghost-ws",
        actorType: "shared_password",
        actorId: "tester",
        createdBy: "tester",
      }),
    (e: unknown) => e instanceof PersistenceError && e.code === "not_found"
  );
});
