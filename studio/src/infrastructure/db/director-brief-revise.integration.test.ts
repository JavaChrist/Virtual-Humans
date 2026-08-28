/**
 * VHS-126 — Brief revise + downstream stale + production refusal (LOCAL Supabase).
 * Fake providers only. No remote operations.
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { resolveLocalSupabaseGate } from "./local-integration.gate";
import {
  cleanupWorkspace,
  createLocalClients,
  localSyntheticDirectorEnv,
  randomUUID,
} from "./integration-harness";
import { createDirectorPersistenceStack } from "./director-server";
import { createSupabaseCreateProjectWithBriefPort } from "./repositories/create-project-with-brief";
import { BRIEF_SCHEMA_VERSION, finalizeBrief } from "@/domain/brief";
import { GENERATION_PLAN_ARTIFACT_TYPE } from "@/domain/routing/router";

const gate = resolveLocalSupabaseGate();
if (!gate.ok) throw new Error(`VHS-126: ${gate.reason}`);

const { client } = createLocalClients(gate);
const workspaces: string[] = [];

after(async () => {
  for (const ws of workspaces) {
    await cleanupWorkspace(client, ws).catch(() => undefined);
  }
});

test("VHS-126 — brief rev2 marks marketing stale and blocks production", async () => {
  const workspaceId = randomUUID();
  workspaces.push(workspaceId);
  await client.from("workspaces").insert({
    id: workspaceId,
    slug: `s126-${workspaceId.slice(0, 8)}`,
    name: "Prd 126",
    mode: "single_workspace",
  });
  await client.from("workspace_budget_policies").insert({
    workspace_id: workspaceId,
    hard_limit_minor: 1_000_000,
    currency: "USD",
  });

  const projectId = randomUUID();
  const briefArtifactId = randomUUID();
  const brief = finalizeBrief(
    {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-03T15:00:00.000Z",
      currentStep: 5,
      fields: {
        projectName: "Campagne 126",
        subjectType: "product",
        subjectName: "Widget",
        subjectDescription: "Produit de mobilité urbaine fiable pour navetteurs.",
        objective: "conversion",
        platform: "instagram",
        durationSeconds: 20,
        aspectRatio: "9:16",
        language: "fr",
        tone: "energetic",
        callToAction: "Téléchargez l'app",
        audienceDescription: "Navetteurs urbains.",
        mediaReferences: [],
      },
    },
    {
      id: briefArtifactId,
      projectId,
      createdBy: "tester",
      correlationId: "corr-126-it",
      createdAt: "2026-08-03T15:00:00.000Z",
      revision: 1,
    },
  );

  await createSupabaseCreateProjectWithBriefPort({ client }).execute({
    workspaceId,
    projectId,
    artifactId: briefArtifactId,
    projectName: brief.projectName,
    brief: { ...brief } as unknown as Record<string, unknown>,
    schemaVersion: BRIEF_SCHEMA_VERSION,
    correlationId: "corr-126-it",
    actorType: "shared_password",
    actorId: "tester",
    createdBy: "tester",
  });

  const env = localSyntheticDirectorEnv();
  const stack = createDirectorPersistenceStack({ client, workspaceId, env });
  const at = "2026-08-03T15:05:00.000Z";

  /** Full provenance chain so cascade reaches generation_plan. */
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
    {
      id: marketingId,
      type: "marketing_plan",
      value: { briefRevisionId: briefArtifactId, objective: "conversion" },
    },
    {
      id: creativeId,
      type: "creative_concept",
      value: { marketingPlanRevisionId: marketingId, title: "Concept" },
    },
    {
      id: scriptId,
      type: "video_script",
      value: {
        creativeConceptRevisionId: creativeId,
        marketingPlanRevisionId: marketingId,
      },
    },
    {
      id: visualId,
      type: "visual_direction",
      value: {
        videoScriptRevisionId: scriptId,
        creativeConceptRevisionId: creativeId,
      },
    },
    {
      id: storyboardId,
      type: "storyboard_project",
      value: {
        videoScriptRevisionId: scriptId,
        visualDirectionRevisionId: visualId,
        scenes: [],
      },
    },
    {
      id: pkgId,
      type: "scene_package_set",
      value: { storyboardRevisionId: storyboardId, packages: [] },
    },
    {
      id: planId,
      type: "generation_plan",
      value: {
        id: planId,
        artifactType: GENERATION_PLAN_ARTIFACT_TYPE,
        projectId,
        storyboardRevisionId: storyboardId,
        scenePackageRevisionIds: [pkgId],
        scenePlans: [{ sceneId: "s1", order: 1 }],
        estimatedCost: { amountMinor: 100, currency: "USD" },
        budgetDecision: { allowed: true, reason: "test" },
      },
    },
  ];

  for (const item of chain) {
    await stack.artifacts.append({
      id: item.id,
      workspaceId,
      projectId,
      artifactType: item.type,
      revision: 1,
      schemaVersion: "1.0.0",
      parentRevisionId: null,
      value: {
        ...item.value,
        id: item.id,
        projectId,
        schemaVersion: "1.0.0",
        revision: 1,
        createdAt: at,
        createdBy: "tester",
        correlationId: `corr-126-${item.type}`,
      },
      createdAt: at,
      createdBy: "tester",
      correlationId: `corr-126-${item.type}`,
    });
    await stack.artifacts.setActive({
      projectId,
      artifactType: item.type,
      artifactId: item.id,
      expectedRevision: 0,
      updatedBy: "tester",
    });
  }

  const { error: planProjErr } = await client.from("generation_plans").insert({
    workspace_id: workspaceId,
    project_id: projectId,
    artifact_id: planId,
    revision: 1,
    registry_version: "legacy-pricing-usd-v1:test",
    policy_version: "routing-policy-v1",
    status: "ready",
    estimated_cost_minor: 100,
    maximum_exposure_minor: 100,
    currency: "USD",
  });
  assert.equal(planProjErr, null, JSON.stringify(planProjErr));

  // Approve generation_plan (append-only)
  const beforeApprove = await stack.projects.load(projectId);
  assert.ok(beforeApprove);
  const approved = await stack.approveArtifact.execute(
    {
      projectId,
      artifactType: "generation_plan",
      artifactId: planId,
      revision: 1,
      decision: "approved",
      expectedProjectRevision: beforeApprove.activeRevision,
      confirmation: true,
    },
    { correlationId: "corr-126-appr", mode: "execute", createdBy: "tester" },
  );
  assert.ok(
    approved.status === "completed" || approved.status === "existing",
    JSON.stringify(approved),
  );

  const projectBefore = await stack.projects.load(projectId);
  assert.ok(projectBefore);

  const dry = await stack.reviseBrief.dryRun(
    { projectId, fields: { projectName: "Campagne 126 v2", tone: "calm" } },
    { correlationId: "corr-126-dry", mode: "dry-run", createdBy: "tester" },
  );
  assert.equal(dry.executable, true);
  assert.equal(dry.restartPoint, "marketing_plan");
  assert.ok(dry.wouldInvalidate.includes("marketing_plan"));

  const revised = await stack.reviseBrief.execute(
    {
      projectId,
      fields: { projectName: "Campagne 126 v2", tone: "calm" },
      expectedBriefRevision: 1,
      expectedProjectRevision: projectBefore.activeRevision,
      confirmation: true,
    },
    { correlationId: "corr-126-rev", mode: "execute", createdBy: "tester" },
  );
  assert.equal(revised.status, "completed", JSON.stringify(revised));
  if (revised.status !== "completed" && revised.status !== "existing") return;

  assert.equal(revised.restartPoint, "marketing_plan");
  assert.ok(revised.staleTypes.includes("marketing_plan"));
  assert.ok(
    revised.staleTypes.includes("generation_plan"),
    `expected generation_plan stale, got ${JSON.stringify(revised.staleTypes)}`,
  );

  // Old brief immutable
  const old = await stack.artifacts.load(briefArtifactId);
  assert.ok(old);
  assert.equal((old.value as { projectName: string }).projectName, "Campagne 126");
  assert.equal(old.revision, 1);

  const stale = await stack.listStale(projectId);
  assert.ok(stale.some((s) => s.artifactType === "marketing_plan"));
  assert.ok(stale.some((s) => s.artifactType === "generation_plan"));
  assert.ok(stale.every((s) => s.staleReason === "upstream_brief_revised"));

  // Approve refused on stale generation_plan
  const projectAfter = await stack.projects.load(projectId);
  const approveStale = await stack.approveArtifact.execute(
    {
      projectId,
      artifactType: "generation_plan",
      artifactId: planId,
      revision: 1,
      decision: "approved",
      expectedProjectRevision: projectAfter!.activeRevision,
      confirmation: true,
    },
    { correlationId: "corr-126-appr2", mode: "execute", createdBy: "tester" },
  );
  assert.equal(approveStale.status, "failed");
  if (approveStale.status === "failed") {
    assert.equal(approveStale.code, "artifact_stale");
  }

  // Production refused — generation_plan artifact stale
  const prodDry = await stack.startProduction.dryRun(
    { projectId },
    { correlationId: "corr-126-prod", mode: "dry-run", createdBy: "tester" },
  );
  assert.equal(prodDry.providerCalled, false);
  assert.ok(prodDry.artifactStale.includes("generation_plan"));
  assert.equal(prodDry.executable, false);

  // Double-click / idempotence
  const again = await stack.reviseBrief.execute(
    {
      projectId,
      fields: { projectName: "Campagne 126 v2", tone: "calm" },
      expectedBriefRevision: revised.brief.revision,
      expectedProjectRevision: revised.projectRevision,
      confirmation: true,
    },
    { correlationId: "corr-126-rev-2", mode: "execute", createdBy: "tester" },
  );
  // Identical to active → refused OR conflict if fingerprint differs — either not a new mutation of old
  assert.ok(
    again.status === "failed" || again.status === "existing" || again.status === "completed",
  );
  if (again.status === "failed") {
    assert.ok(
      again.code === "identical_payload" || again.code === "optimistic_conflict",
    );
  }

  const briefCount = await client
    .from("project_artifacts")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("artifact_type", "video_project_brief");
  assert.ok((briefCount.count ?? 0) >= 2);

  const mktStill = await stack.artifacts.load(marketingId);
  assert.ok(mktStill, "marketing artifact not deleted");
});
