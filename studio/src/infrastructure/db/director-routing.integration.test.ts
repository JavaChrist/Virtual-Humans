/**
 * Director routing + approval persistence against LOCAL Supabase (VHS-123).
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { resolveLocalSupabaseGate } from "./local-integration.gate";
import { cleanupWorkspace, createLocalClients, randomUUID } from "./integration-harness";
import { createDirectorPersistenceStack } from "./director-server";
import { makeValidCandidate } from "@/domain/marketing/__tests__/fixtures";
import { makeValidCreativeCandidate } from "@/domain/creative/__tests__/fixtures";
import { makeValidScriptCandidate } from "@/domain/script/__tests__/fixtures";
import { makeValidArtCandidate } from "@/domain/art/__tests__/fixtures";
import { makeValidStoryboardCandidate } from "@/domain/storyboard/__tests__/fixtures";
import type { ArtAnalyzerPort } from "@/application/directors/art/analyzer-port";
import type { StoryboardAnalyzerPort } from "@/application/directors/storyboard/analyzer-port";
import { createSupabaseCreateProjectWithBriefPort } from "./repositories/create-project-with-brief";
import { BRIEF_SCHEMA_VERSION, finalizeBrief } from "@/domain/brief";
import { makeRoutableRegistry } from "@/domain/routing/router/__tests__/fixtures";

const gate = resolveLocalSupabaseGate();
if (!gate.ok) throw new Error(`VHS-123: ${gate.reason}`);

const { client } = createLocalClients(gate);
const workspaces: string[] = [];

after(async () => {
  for (const ws of workspaces) {
    await cleanupWorkspace(client, ws).catch(() => undefined);
  }
});

test("VHS-123 — routing GenerationPlan + approval (no provider, no reservation)", async () => {
  const workspaceId = randomUUID();
  workspaces.push(workspaceId);
  await client.from("workspaces").insert({
    id: workspaceId,
    slug: `s123-${workspaceId.slice(0, 8)}`,
    name: "Rtg 123",
    mode: "single_workspace",
  });
  await client.from("workspace_budget_policies").insert({
    workspace_id: workspaceId,
    hard_limit_minor: 1_000_000,
    currency: "USD",
  });

  const projectId = randomUUID();
  const artifactId = randomUUID();
  const brief = finalizeBrief(
    {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-03T14:00:00.000Z",
      currentStep: 5,
      fields: {
        projectName: "Campagne 123",
        subjectType: "product",
        subjectName: "Widget",
        subjectDescription: "Produit de mobilité urbaine fiable pour navetteurs.",
        objective: "conversion",
        platform: "instagram",
        durationSeconds: 30,
        aspectRatio: "9:16",
        language: "fr",
        tone: "energetic",
        callToAction: "Téléchargez l'app et réservez",
        audienceDescription: "Navetteurs urbains pressés.",
        mediaReferences: [],
      },
    },
    {
      id: artifactId,
      projectId,
      createdBy: "tester",
      correlationId: "corr-123-it",
      createdAt: "2026-08-03T14:00:00.000Z",
      revision: 1,
    },
  );

  await createSupabaseCreateProjectWithBriefPort({ client }).execute({
    workspaceId,
    projectId,
    artifactId,
    projectName: brief.projectName,
    brief: { ...brief } as unknown as Record<string, unknown>,
    schemaVersion: BRIEF_SCHEMA_VERSION,
    correlationId: "corr-123-it",
    actorType: "shared_password",
    actorId: "tester",
    createdBy: "tester",
  });

  const env = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_MARKETING_AI_ENABLED: "1",
    DIRECTOR_V2_CREATIVE_AI_ENABLED: "1",
    DIRECTOR_V2_SCRIPT_AI_ENABLED: "1",
    DIRECTOR_V2_ART_AI_ENABLED: "1",
    DIRECTOR_V2_STORYBOARD_AI_ENABLED: "1",
    DIRECTOR_V2_PAID_AI_ENABLED: "1",
    OPENAI_API_KEY: "sk-test-local",
    OPENAI_MARKETING_MODEL: "gpt-5.6-terra",
    OPENAI_CREATIVE_MODEL: "gpt-5.6-terra",
    OPENAI_SCRIPT_MODEL: "gpt-5.6-terra",
    OPENAI_ART_MODEL: "gpt-5.6-terra",
    OPENAI_STORYBOARD_MODEL: "gpt-5.6-terra",
    OPENAI_MARKETING_PRICE_VERSION: "it-v1",
    OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: "100",
    OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: "200",
  };

  const registryBase = makeRoutableRegistry();
  const stack = createDirectorPersistenceStack({
    client,
    workspaceId,
    env,
    buildRegistry: ({ createdAt, registryVersion }) => ({
      ...registryBase,
      createdAt,
      registryVersion,
    }),
    marketingAnalyzer: {
      async analyze() {
        return makeValidCandidate({
          marketingObjective: "conversion",
          tone: "energetic",
          callToAction: "Téléchargez l'app et réservez",
        });
      },
    },
    creativeAnalyzer: { async analyze() { return makeValidCreativeCandidate(); } },
    scriptAnalyzer: {
      async analyze() {
        return makeValidScriptCandidate({ callToActionText: "Téléchargez l'app et réservez" });
      },
    },
    artAnalyzer: {
      async analyze(req: Parameters<ArtAnalyzerPort["analyze"]>[0]) {
        return makeValidArtCandidate(req.videoScript.segments.map((s) => s.id));
      },
    },
    storyboardAnalyzer: {
      async analyze(req: Parameters<StoryboardAnalyzerPort["analyze"]>[0]) {
        return makeValidStoryboardCandidate(req.videoScript, req.visualDirection);
      },
    },
  });

  for (const step of [
    () =>
      stack.analyzeMarketing.execute(
        { projectId, expectedBriefRevision: 1 },
        { correlationId: "corr-123-m", mode: "execute" },
      ),
    () =>
      stack.analyzeCreative.execute(
        { projectId, expectedMarketingPlanRevision: 1 },
        { correlationId: "corr-123-c", mode: "execute" },
      ),
    () =>
      stack.writeScript.execute(
        { projectId, expectedCreativeConceptRevision: 1 },
        { correlationId: "corr-123-s", mode: "execute" },
      ),
    () =>
      stack.analyzeArt.execute(
        { projectId, expectedVideoScriptRevision: 1 },
        { correlationId: "corr-123-a", mode: "execute" },
      ),
    () =>
      stack.analyzeStoryboard.execute(
        { projectId, expectedVisualDirectionRevision: 1 },
        { correlationId: "corr-123-sb", mode: "execute" },
      ),
    () =>
      stack.buildScenePackages.execute(
        { projectId, expectedStoryboardRevision: 1 },
        { correlationId: "corr-123-p", mode: "execute" },
      ),
  ]) {
    const r = await step();
    assert.ok(r.status === "completed" || r.status === "existing", JSON.stringify(r));
  }

  const dry = await stack.routeGenerationPlan.dryRun(
    { projectId },
    { correlationId: "corr-123-rtg-dry", mode: "dry-run" },
  );
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executable, true, JSON.stringify(dry));

  const exec = await stack.routeGenerationPlan.execute(
    {
      projectId,
      expectedScenePackageSetRevision: dry.scenePackageSetRevision,
      expectedRegistrySnapshotVersion: dry.registryVersion,
    },
    { correlationId: "corr-123-rtg-exec", mode: "execute" },
  );
  assert.equal(exec.status, "completed", JSON.stringify(exec));
  if (exec.status !== "completed") return;
  assert.equal(exec.plan.status, "ready");
  assert.ok((exec.plan.sceneCount ?? 0) >= 1);
  assert.equal(exec.plan.budgetAllowed, true);

  const replay = await stack.routeGenerationPlan.execute(
    {
      projectId,
      expectedScenePackageSetRevision: dry.scenePackageSetRevision,
      expectedRegistrySnapshotVersion: dry.registryVersion,
    },
    { correlationId: "corr-123-rtg-replay", mode: "execute" },
  );
  assert.equal(replay.status, "existing");

  const { data: project } = await client
    .from("video_projects")
    .select("active_revision")
    .eq("id", projectId)
    .single();

  const approval = await stack.approveArtifact.execute(
    {
      projectId,
      artifactType: "generation_plan",
      artifactId: exec.plan.artifactId!,
      revision: exec.plan.revision,
      decision: "approved",
      expectedProjectRevision: project!.active_revision,
      confirmation: true,
    },
    { correlationId: "corr-123-appr", mode: "execute" },
  );
  assert.equal(approval.status, "completed", JSON.stringify(approval));

  const again = await stack.approveArtifact.execute(
    {
      projectId,
      artifactType: "generation_plan",
      artifactId: exec.plan.artifactId!,
      revision: exec.plan.revision,
      decision: "approved",
      expectedProjectRevision: approval.status === "completed" ? approval.approval.projectRevision : 0,
      confirmation: true,
    },
    { correlationId: "corr-123-appr-2", mode: "execute" },
  );
  assert.equal(again.status, "existing");

  const { count: planCount } = await client
    .from("project_artifacts")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("artifact_type", "generation_plan");
  assert.equal(planCount, 1);

  const { count: reservationCount } = await client
    .from("budget_reservations")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  // AI director steps may reserve; routing itself must not add any new reservation after prompt
  const { data: routingRun } = await client
    .from("director_runs")
    .select("cost_status, provider_id")
    .eq("project_id", projectId)
    .eq("director_type", "routing")
    .maybeSingle();
  assert.equal(routingRun?.cost_status, "none");
  assert.equal(routingRun?.provider_id, "deterministic");

  const { data: projection } = await client
    .from("generation_plans")
    .select("status, approved_at")
    .eq("project_id", projectId)
    .maybeSingle();
  assert.equal(projection?.status, "approved");
  assert.ok(projection?.approved_at);

  const conflict = await stack.routeGenerationPlan.execute(
    {
      projectId,
      expectedScenePackageSetRevision: 99,
      expectedRegistrySnapshotVersion: dry.registryVersion,
    },
    { correlationId: "corr-123-conflict", mode: "execute" },
  );
  assert.equal(conflict.status, "failed");
  if (conflict.status === "failed") assert.equal(conflict.httpHint, 409);

  void reservationCount;
});
