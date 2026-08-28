/**
 * Phase 189 — durable Director persistence recheck against LOCAL Supabase only.
 * Isolated fixtures: vhs-persistence-recheck-189 + random UUIDs.
 * No Production, no provider, no media, no flag write.
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { buildIsolatedPersistenceEnv } from "@/application/director/persistence-production-enablement-preflight";
import {
  DIRECTOR_PROJECT_QUOTA,
  DIRECTOR_PROJECT_QUOTA_EXCEEDED_CODE,
  DIRECTOR_PROJECT_QUOTA_MAX_ACTIVE,
} from "@/application/director/director-project-quota";
import { GENERATION_PLAN_ARTIFACT_TYPE } from "@/domain/routing/router";
import { createDirectorPersistenceStack } from "./director-server";
import { cleanupWorkspace, createLocalClients, randomUUID } from "./integration-harness";
import { resolveLocalSupabaseGate } from "./local-integration.gate";

const PHASE = "vhs-persistence-recheck-189";
const gate = resolveLocalSupabaseGate();
if (!gate.ok) throw new Error(`189: ${gate.reason}`);

const { client, clientB } = createLocalClients(gate);
const isolated = buildIsolatedPersistenceEnv();
const workspaces: string[] = [];
const counters = {
  workspacesCreated: 0,
  projectsCreated: 0,
  projectReplays: 0,
  projectConflicts: 0,
  revisionsCreated: 0,
  revisionReplays: 0,
  casConflicts: 0,
  crossWorkspaceRefusals: 0,
  quotaRefusals: 0,
  raceCreated: 0,
  raceRefused: 0,
};

after(async () => {
  const ids = [...workspaces];
  for (const ws of ids) {
    await cleanupWorkspace(client, ws).catch(() => undefined);
  }
  console.log(
    JSON.stringify({
      PHASE,
      LOCAL_DB_INTEGRATION_AVAILABLE: 1,
      LOCAL_MIGRATIONS_VISIBLE: readdirSync(
        join(process.cwd(), "supabase", "migrations"),
      ).filter((f) => f.endsWith(".sql")).length,
      LOCAL_WORKSPACES_CREATED: counters.workspacesCreated,
      LOCAL_PROJECTS_CREATED: counters.projectsCreated,
      LOCAL_PROJECT_REPLAYS: counters.projectReplays,
      LOCAL_PROJECT_CONFLICTS: counters.projectConflicts,
      LOCAL_REVISIONS_CREATED: counters.revisionsCreated,
      LOCAL_REVISION_REPLAYS: counters.revisionReplays,
      LOCAL_CAS_CONFLICTS: counters.casConflicts,
      LOCAL_CROSS_WORKSPACE_REFUSALS: counters.crossWorkspaceRefusals,
      LOCAL_QUOTA_REFUSALS: counters.quotaRefusals,
      DIRECTOR_PROJECT_QUOTA: DIRECTOR_PROJECT_QUOTA_MAX_ACTIVE,
      QUOTA_ATOMIC: DIRECTOR_PROJECT_QUOTA.atomic,
      QUOTA_BLOCKS_SINGLE_TENANT: DIRECTOR_PROJECT_QUOTA.blocksSingleTenantActivation,
      CONCURRENT_RACE_CREATED: counters.raceCreated,
      CONCURRENT_RACE_REFUSED: counters.raceRefused,
    }),
  );
});

function fields(name: string) {
  return {
    projectName: name,
    subjectType: "product" as const,
    subjectName: "Widget 189",
    subjectDescription: "Texte synthétique minimal pour le recheck persistence 189.",
    objective: "awareness" as const,
    platform: "instagram" as const,
    durationSeconds: 30 as const,
    aspectRatio: "9:16" as const,
    language: "fr",
    tone: "warm" as const,
    mediaReferences: [] as [],
  };
}

async function seedWorkspace(label: string) {
  const workspaceId = randomUUID();
  workspaces.push(workspaceId);
  counters.workspacesCreated += 1;
  const { error } = await client.from("workspaces").insert({
    id: workspaceId,
    slug: `${PHASE}-${label}-${workspaceId.slice(0, 8)}`,
    name: `${PHASE} ${label}`,
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

function stackFor(workspaceId: string, db = client) {
  return createDirectorPersistenceStack({
    client: db,
    workspaceId,
    env: isolated,
    nowIso: () => "2026-08-28T09:00:00.000Z",
  });
}

async function createNamed(
  stack: ReturnType<typeof stackFor>,
  workspaceId: string,
  name: string,
  projectId = randomUUID(),
) {
  return stack.createProject.execute({
    projectId,
    artifactId: randomUUID(),
    workspaceId,
    expectedBriefRevision: 1,
    correlationId: `${PHASE}-${projectId.slice(0, 8)}`,
    actor: { type: "shared_password", id: "tester-189" },
    draft: {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-28T09:00:00.000Z",
      currentStep: 5,
      fields: fields(name),
    },
  });
}

async function countSentinels(workspaceId: string) {
  const tables = [
    "budget_reservations",
    "production_runs",
    "production_jobs",
    "generation_attempts",
    "director_runs",
  ] as const;
  const out: Record<string, number> = {};
  for (const t of tables) {
    const { count, error } = await client
      .from(t)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(`${t}: ${error.message}`);
    out[t] = count ?? 0;
  }
  return out;
}

test("189 — schéma local Director + catalogue migrations", async () => {
  const files = readdirSync(join(process.cwd(), "supabase", "migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  assert.equal(files.length, 33);
  assert.ok(files.includes("20260827133000_vhs_ridecloud_bind_artifact_kinds.sql"));

  for (const table of [
    "workspaces",
    "video_projects",
    "project_artifacts",
    "active_artifact_revisions",
    "director_runs",
    "production_runs",
    "production_jobs",
    "budget_reservations",
  ]) {
    const { error } = await client.from(table).select("*").limit(0);
    assert.equal(error, null, table);
  }

  const missingCreate = await client.rpc("create_director_project_with_brief", {
    p_workspace_id: randomUUID(),
    p_project_id: randomUUID(),
    p_artifact_id: randomUUID(),
    p_project_name: "probe",
    p_brief: {},
    p_schema_version: "1.0.0",
    p_correlation_id: "corr-189-rpc-probe",
    p_actor_type: "shared_password",
    p_actor_id: "tester-189",
    p_created_by: "tester-189",
  });
  assert.ok(missingCreate.error, "RPC create must reject an invalid probe");
  assert.match(missingCreate.error.message, /workspace_not_found|invalid_/i);

  const missingRevise = await client.rpc("revise_project_brief", {
    p_workspace_id: randomUUID(),
    p_project_id: randomUUID(),
    p_new_artifact_id: randomUUID(),
    p_brief: {},
    p_schema_version: "1.0.0",
    p_expected_brief_revision: 1,
    p_expected_project_revision: 1,
    p_idempotency_key: randomUUID(),
    p_command_fingerprint: "probe",
    p_correlation_id: "corr-189-rpc-revise",
    p_created_by: "tester-189",
    p_actor_type: "shared_password",
    p_actor_id: "tester-189",
  });
  assert.ok(missingRevise.error, "RPC revise must reject an invalid probe");
  assert.doesNotMatch(missingRevise.error.message, /Could not find the function/i);
});

test("189 — scénario durable create/replay/CAS/isolation/pipeline/quota", async () => {
  const wsA = await seedWorkspace("a");
  const wsB = await seedWorkspace("b");
  const stackA = stackFor(wsA);
  const stackB = stackFor(wsB);
  const before = await countSentinels(wsA);

  const projectId = randomUUID();
  const created = await createNamed(stackA, wsA, "Projet 189 A", projectId);
  assert.equal(created.status, "created", JSON.stringify(created));
  counters.projectsCreated += 1;

  const loaded = await stackA.getProject.execute(projectId, wsA);
  assert.equal(loaded.status, "ok");
  if (loaded.status === "ok") {
    assert.equal(loaded.view.project.name, "Projet 189 A");
    assert.equal(loaded.view.brief.revision, 1);
    assert.equal(loaded.view.nextStep.enabled, false);
    const serialized = JSON.stringify(loaded.view);
    assert.doesNotMatch(serialized, /data:image|https?:\/\/|sk-|Bearer /);
  }

  const replay = await createNamed(stackA, wsA, "Projet 189 A", projectId);
  assert.equal(replay.status, "existing", JSON.stringify(replay));
  counters.projectReplays += 1;

  const conflict = await stackA.createProject.execute({
    projectId,
    artifactId: randomUUID(),
    workspaceId: wsA,
    expectedBriefRevision: 1,
    correlationId: `${PHASE}-conflict`,
    actor: { type: "shared_password", id: "tester-189" },
    draft: {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-28T09:00:00.000Z",
      currentStep: 5,
      fields: { ...fields("Projet 189 A"), platform: "tiktok" },
    },
  });
  assert.equal(conflict.status, "failed");
  if (conflict.status === "failed") assert.equal(conflict.code, "conflict");
  counters.projectConflicts += 1;

  const listed = await stackA.listProjects.execute(20);
  assert.equal(listed.status, "ok");
  if (listed.status === "ok") {
    const item = listed.items.find((i) => i.id === projectId);
    assert.ok(item);
    assert.equal(item?.name, "Projet 189 A");
    assert.equal("prompt" in (item ?? {}), false);
    assert.equal("mediaReferences" in (item ?? {}), false);
    assert.equal("value" in (item ?? {}), false);
  }

  const refresh = await stackA.getProject.execute(projectId, wsA);
  assert.equal(refresh.status, "ok");

  const projectBefore = await stackA.projects.load(projectId);
  assert.ok(projectBefore);
  const revised = await stackA.reviseBrief.execute(
    {
      projectId,
      fields: { subjectName: "Widget 189 rev2" },
      expectedBriefRevision: 1,
      expectedProjectRevision: projectBefore.activeRevision,
      confirmation: true,
    },
    { correlationId: `${PHASE}-rev`, mode: "execute", createdBy: "tester-189" },
  );
  assert.equal(revised.status, "completed", JSON.stringify(revised));
  if (revised.status === "completed" || revised.status === "existing") {
    assert.equal(revised.brief.revision, 2);
  }
  counters.revisionsCreated += 1;

  const replayRev = await stackA.reviseBrief.execute(
    {
      projectId,
      fields: { subjectName: "Widget 189 rev2" },
      expectedBriefRevision: 2,
      expectedProjectRevision:
        revised.status === "completed" || revised.status === "existing"
          ? revised.projectRevision
          : projectBefore.activeRevision + 1,
      confirmation: true,
    },
    { correlationId: `${PHASE}-rev-replay`, mode: "execute", createdBy: "tester-189" },
  );
  assert.ok(
    replayRev.status === "existing" ||
      replayRev.status === "completed" ||
      replayRev.status === "failed",
    JSON.stringify(replayRev),
  );
  if (replayRev.status === "failed") {
    assert.ok(
      replayRev.code === "identical_payload" || replayRev.code === "optimistic_conflict",
    );
  }
  counters.revisionReplays += 1;
  const briefCount = await client
    .from("project_artifacts")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("artifact_type", "video_project_brief");
  assert.equal(briefCount.count, 2);

  const stale = await stackA.reviseBrief.execute(
    {
      projectId,
      fields: { subjectName: "stale 189" },
      expectedBriefRevision: 1,
      expectedProjectRevision: 1,
      confirmation: true,
    },
    { correlationId: `${PHASE}-stale`, mode: "execute", createdBy: "tester-189" },
  );
  assert.equal(stale.status, "failed");
  counters.casConflicts += 1;

  const active = await stackA.artifacts.getActive(projectId, "video_project_brief");
  assert.ok(active);
  assert.equal(active.revision, 2);

  const fromB = await stackB.getProject.execute(projectId, wsB);
  assert.equal(fromB.status, "not_found");
  counters.crossWorkspaceRefusals += 1;

  const massId = randomUUID();
  const mass = await stackA.createProject.execute({
    projectId: massId,
    artifactId: randomUUID(),
    workspaceId: wsA,
    expectedBriefRevision: 1,
    correlationId: `${PHASE}-mass`,
    actor: { type: "shared_password", id: "tester-189" },
    draft: {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-28T09:00:00.000Z",
      currentStep: 5,
      fields: {
        ...fields("Mass 189"),
        workspace_id: wsB,
        status: "published",
        lifecycle: "active",
        published: true,
      } as never,
    },
  });
  assert.ok(mass.status === "created" || mass.status === "failed", JSON.stringify(mass));
  if (mass.status === "created") {
    counters.projectsCreated += 1;
    const massLoaded = await stackA.projects.load(massId);
    assert.ok(massLoaded);
    assert.equal(massLoaded.workspaceId, wsA);
    assert.notEqual(massLoaded.status, "published");
    const massFromB = await stackB.getProject.execute(massId, wsB);
    assert.equal(massFromB.status, "not_found");
    counters.crossWorkspaceRefusals += 1;
    const massArt = await stackA.artifacts.getActive(massId, "video_project_brief");
    assert.ok(massArt);
    const massValue = await stackA.artifacts.load(massArt.artifactId);
    const dumped = JSON.stringify(massValue?.value ?? {});
    assert.doesNotMatch(dumped, /"workspace_id"/);
    assert.doesNotMatch(dumped, /"published":true/);
    assert.doesNotMatch(dumped, /"lifecycle"/);
  }

  const historicalId = randomUUID();
  const histCreated = await createNamed(stackA, wsA, "Historique 189", historicalId);
  assert.equal(histCreated.status, "created");
  counters.projectsCreated += 1;
  const at = "2026-08-28T09:05:00.000Z";
  const marketingId = randomUUID();
  const creativeId = randomUUID();
  const scriptId = randomUUID();
  const visualId = randomUUID();
  const storyboardId = randomUUID();
  const pkgId = randomUUID();
  const planId = randomUUID();
  const chain: Array<{
    id: string;
    type:
      | "marketing_plan"
      | "creative_concept"
      | "video_script"
      | "visual_direction"
      | "storyboard_project"
      | "scene_package_set"
      | "generation_plan";
    value: Record<string, unknown>;
  }> = [
    { id: marketingId, type: "marketing_plan", value: { objective: "awareness" } },
    { id: creativeId, type: "creative_concept", value: { marketingPlanRevisionId: marketingId } },
    { id: scriptId, type: "video_script", value: { creativeConceptRevisionId: creativeId } },
    { id: visualId, type: "visual_direction", value: { videoScriptRevisionId: scriptId } },
    {
      id: storyboardId,
      type: "storyboard_project",
      value: { videoScriptRevisionId: scriptId, visualDirectionRevisionId: visualId, scenes: [] },
    },
    { id: pkgId, type: "scene_package_set", value: { storyboardRevisionId: storyboardId, packages: [] } },
    {
      id: planId,
      type: "generation_plan",
      value: {
        id: planId,
        artifactType: GENERATION_PLAN_ARTIFACT_TYPE,
        projectId: historicalId,
        scenePlans: [],
      },
    },
  ];
  for (const item of chain) {
    await stackA.artifacts.append({
      id: item.id,
      workspaceId: wsA,
      projectId: historicalId,
      artifactType: item.type,
      revision: 1,
      schemaVersion: "1.0.0",
      parentRevisionId: null,
      value: {
        ...item.value,
        id: item.id,
        projectId: historicalId,
        schemaVersion: "1.0.0",
        revision: 1,
        createdAt: at,
        createdBy: "tester-189",
        correlationId: `${PHASE}-${item.type}`,
      },
      createdAt: at,
      createdBy: "tester-189",
      correlationId: `${PHASE}-${item.type}`,
    });
    await stackA.artifacts.setActive({
      projectId: historicalId,
      artifactType: item.type,
      artifactId: item.id,
      expectedRevision: 0,
      updatedBy: "tester-189",
    });
  }

  const histList = await stackA.listProjects.execute(20);
  assert.equal(histList.status, "ok");
  if (histList.status === "ok") {
    assert.ok(histList.items.some((i) => i.id === historicalId));
  }
  const histGet = await stackA.getProject.execute(historicalId, wsA);
  assert.equal(histGet.status, "ok");

  const ctx = { correlationId: `${PHASE}-exec`, mode: "execute" as const, createdBy: "tester-189" };
  const marketing = await stackA.analyzeMarketing.execute(
    { projectId: historicalId, expectedBriefRevision: 1 },
    ctx,
  );
  assert.equal(marketing.status, "failed");
  const prompt = await stackA.buildScenePackages.execute(
    { projectId: historicalId, expectedStoryboardRevision: 1 },
    ctx,
  );
  assert.equal(prompt.status, "failed");
  const routing = await stackA.routeGenerationPlan.execute(
    {
      projectId: historicalId,
      expectedScenePackageSetRevision: 1,
      expectedRegistrySnapshotVersion: "v",
    },
    ctx,
  );
  assert.equal(routing.status, "failed");
  const approve = await stackA.approveArtifact.execute(
    {
      projectId: historicalId,
      artifactType: "generation_plan",
      artifactId: planId,
      revision: 1,
      decision: "approved",
      expectedProjectRevision: 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(approve.status, "failed");
  const production = await stackA.startProduction.execute(
    { projectId: historicalId, expectedGenerationPlanRevision: 1, confirmation: true },
    ctx,
  );
  assert.equal(production.status, "failed");
  const merge = await stackA.executeMerge.execute(
    { projectId: historicalId, confirmation: true },
    ctx,
  );
  assert.equal(merge.status, "failed");
  const exp = await stackA.prepareExport.execute(
    { projectId: historicalId, confirmation: true, destinationId: "download" },
    ctx,
  );
  assert.equal(exp.status, "failed");
  const qc = await stackA.evaluateQuality.execute(
    { projectId: historicalId, confirmation: true },
    ctx,
  );
  assert.equal(qc.status, "failed");
  const hr = await stackA.recordQualityReview.execute(
    {
      projectId: historicalId,
      confirmation: true,
      decision: "approved",
      reviewedIssueCodes: [],
      expectedQualityReportRevision: 1,
      expectedProductionResultRevision: 1,
    },
    ctx,
  );
  assert.equal(hr.status, "failed");
  const dl = await stackA.downloadFinalAsset.execute({ projectId: historicalId });
  assert.equal(dl.status, "failed");
  if (dl.status === "failed") {
    assert.equal(dl.httpHint, 404);
  }

  const after = await countSentinels(wsA);
  assert.deepEqual(after, before);

  const current = await stackA.projects.countActiveNonArchived!();
  const to49 = 49 - current;
  for (let i = 0; i < to49; i += 1) {
    const r = await createNamed(stackA, wsA, `Quota 189 ${i}`);
    assert.equal(r.status, "created", `fill ${i}: ${JSON.stringify(r)}`);
    counters.projectsCreated += 1;
  }
  assert.equal(await stackA.projects.countActiveNonArchived!(), 49);

  const fiftiethId = randomUUID();
  const fiftieth = await createNamed(stackA, wsA, "Quota 189 50", fiftiethId);
  assert.equal(fiftieth.status, "created", JSON.stringify(fiftieth));
  counters.projectsCreated += 1;
  const replayAtQuota = await createNamed(stackA, wsA, "Quota 189 50", fiftiethId);
  assert.equal(replayAtQuota.status, "existing");
  counters.projectReplays += 1;
  const fiftyFirst = await createNamed(stackA, wsA, "Quota 189 51");
  assert.equal(fiftyFirst.status, "failed");
  if (fiftyFirst.status === "failed") {
    assert.equal(fiftyFirst.code, DIRECTOR_PROJECT_QUOTA_EXCEEDED_CODE);
  }
  counters.quotaRefusals += 1;
  assert.equal(await stackA.projects.countActiveNonArchived!(), 50);

  const archived = await stackA.projects.saveStatus(
    fiftiethId,
    "archived",
    (await stackA.projects.load(fiftiethId))!.activeRevision,
    "2026-08-28T09:10:00.000Z",
  );
  assert.equal(archived.archivedAt != null, true);
  assert.equal(await stackA.projects.countActiveNonArchived!(), 49);
  const afterArchive = await createNamed(stackA, wsA, "Quota 189 after-archive");
  assert.equal(afterArchive.status, "created");
  counters.projectsCreated += 1;

  const independent = await createNamed(stackB, wsB, "Workspace B 189");
  assert.equal(independent.status, "created");
  counters.projectsCreated += 1;

  const raceWs = await seedWorkspace("race");
  const raceStack = stackFor(raceWs, client);
  const raceStackB = stackFor(raceWs, clientB);
  for (let i = 0; i < 49; i += 1) {
    const r = await createNamed(raceStack, raceWs, `Race fill ${i}`);
    assert.equal(r.status, "created");
    counters.projectsCreated += 1;
  }
  const raceResults = await Promise.allSettled([
    createNamed(raceStack, raceWs, "Race A"),
    createNamed(raceStackB, raceWs, "Race B"),
  ]);
  const fulfilled = raceResults
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createNamed>>> => r.status === "fulfilled")
    .map((r) => r.value);
  assert.equal(fulfilled.length, 2);
  for (const v of fulfilled) {
    if (v.status === "created") {
      counters.raceCreated += 1;
      counters.projectsCreated += 1;
    } else if (v.status === "failed" && v.code === DIRECTOR_PROJECT_QUOTA_EXCEEDED_CODE) {
      counters.raceRefused += 1;
      counters.quotaRefusals += 1;
    }
  }
  const raceCount = await raceStack.projects.countActiveNonArchived!();
  assert.ok(raceCount >= 50 && raceCount <= 51, `race count ${raceCount}`);
  assert.ok(
    counters.raceCreated + counters.raceRefused === 2,
    `race statuses ${JSON.stringify(fulfilled)}`,
  );
  assert.equal(DIRECTOR_PROJECT_QUOTA.blocksSingleTenantActivation, false);
  assert.equal(DIRECTOR_PROJECT_QUOTA.atomic, false);
});
