/**
 * Director storyboard persistence against LOCAL Supabase (VHS-121B).
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
import type { VideoScript } from "@/domain/script";
import type { VisualDirection } from "@/domain/art";

const gate = resolveLocalSupabaseGate();
if (!gate.ok) throw new Error(`VHS-121B: ${gate.reason}`);

const { client } = createLocalClients(gate);
const workspaces: string[] = [];

after(async () => {
  for (const ws of workspaces) {
    await cleanupWorkspace(client, ws).catch(() => undefined);
  }
});

test("VHS-121B — chain through storyboard_project + storyboard_scenes", async () => {
  const workspaceId = randomUUID();
  workspaces.push(workspaceId);
  await client.from("workspaces").insert({ id: workspaceId, slug: `s121-${workspaceId.slice(0, 8)}`, name: "Stb 121B", mode: "single_workspace" });
  await client.from("workspace_budget_policies").insert({ workspace_id: workspaceId, hard_limit_minor: 100_000, currency: "USD" });

  const projectId = randomUUID();
  const artifactId = randomUUID();
  const brief = finalizeBrief({
    draftVersion: "1.0.0", updatedAt: "2026-08-03T14:00:00.000Z", currentStep: 5,
    fields: {
      projectName: "Campagne 121B", subjectType: "product", subjectName: "Widget",
      subjectDescription: "Produit de mobilité urbaine fiable pour navetteurs.",
      objective: "conversion", platform: "instagram", durationSeconds: 30, aspectRatio: "9:16",
      language: "fr", tone: "energetic", callToAction: "Téléchargez l'app et réservez",
      audienceDescription: "Navetteurs urbains pressés.", mediaReferences: [],
    },
  }, { id: artifactId, projectId, createdBy: "tester", correlationId: "corr-121b-it", createdAt: "2026-08-03T14:00:00.000Z", revision: 1 });

  await createSupabaseCreateProjectWithBriefPort({ client }).execute({
    workspaceId, projectId, artifactId, projectName: brief.projectName,
    brief: { ...brief } as unknown as Record<string, unknown>, schemaVersion: BRIEF_SCHEMA_VERSION,
    correlationId: "corr-121b-it", actorType: "shared_password", actorId: "tester", createdBy: "tester",
  });

  let capturedScript: VideoScript | null = null;
  let capturedVisual: VisualDirection | null = null;

  const env = {
    DIRECTOR_V2_ENABLED: "1", DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_MARKETING_AI_ENABLED: "1", DIRECTOR_V2_CREATIVE_AI_ENABLED: "1",
    DIRECTOR_V2_SCRIPT_AI_ENABLED: "1", DIRECTOR_V2_ART_AI_ENABLED: "1",
    DIRECTOR_V2_STORYBOARD_AI_ENABLED: "1", DIRECTOR_V2_PAID_AI_ENABLED: "1",
    OPENAI_API_KEY: "sk-test-local",
    OPENAI_MARKETING_MODEL: "gpt-5.6-terra", OPENAI_CREATIVE_MODEL: "gpt-5.6-terra",
    OPENAI_SCRIPT_MODEL: "gpt-5.6-terra", OPENAI_ART_MODEL: "gpt-5.6-terra",
    OPENAI_STORYBOARD_MODEL: "gpt-5.6-terra",
    OPENAI_MARKETING_PRICE_VERSION: "it-v1",
    OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: "100",
    OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: "200",
  };

  const stack = createDirectorPersistenceStack({
    client, workspaceId, env,
    marketingAnalyzer: { async analyze() { return { candidate: makeValidCandidate({ marketingObjective: "conversion", tone: "energetic", callToAction: "Téléchargez l'app et réservez" }) }; } },
    creativeAnalyzer: { async analyze() { return { candidate: makeValidCreativeCandidate() }; } },
    scriptAnalyzer: { async analyze() { return { candidate: makeValidScriptCandidate({ callToActionText: "Téléchargez l'app et réservez" }) }; } },
    artAnalyzer: {
      async analyze(req: Parameters<ArtAnalyzerPort["analyze"]>[0]) {
        return { candidate: makeValidArtCandidate(req.videoScript.segments.map((s) => s.id)) };
      },
    },
    storyboardAnalyzer: {
      async analyze(req: Parameters<StoryboardAnalyzerPort["analyze"]>[0]) {
        capturedScript = req.videoScript;
        capturedVisual = req.visualDirection;
        return { candidate: makeValidStoryboardCandidate(req.videoScript, req.visualDirection) };
      },
    },
  });

  const marketing = await stack.analyzeMarketing.execute({ projectId, expectedBriefRevision: 1 }, { correlationId: "corr-121b-marketing", mode: "execute" });
  assert.equal(marketing.status, "completed", JSON.stringify(marketing));
  assert.equal((await stack.analyzeCreative.execute({ projectId, expectedMarketingPlanRevision: 1 }, { correlationId: "corr-121b-creative", mode: "execute" })).status, "completed");
  assert.equal((await stack.writeScript.execute({ projectId, expectedCreativeConceptRevision: 1 }, { correlationId: "corr-121b-script", mode: "execute" })).status, "completed");
  assert.equal((await stack.analyzeArt.execute({ projectId, expectedVideoScriptRevision: 1 }, { correlationId: "corr-121b-art", mode: "execute" })).status, "completed");

  const dry = await stack.analyzeStoryboard.dryRun({ projectId }, { correlationId: "corr-121b-storyboard-dry", mode: "dry-run" });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executable, true);

  const exec = await stack.analyzeStoryboard.execute({ projectId, expectedVisualDirectionRevision: 1 }, { correlationId: "corr-121b-storyboard-exec", mode: "execute" });
  assert.equal(exec.status, "completed", JSON.stringify(exec));
  if (exec.status !== "completed") return;
  assert.equal(exec.storyboard.status, "ready");
  assert.ok((exec.storyboard.sceneCount ?? 0) > 0);

  const replay = await stack.analyzeStoryboard.execute({ projectId, expectedVisualDirectionRevision: 1 }, { correlationId: "corr-121b-storyboard-replay", mode: "execute" });
  assert.equal(replay.status, "existing");

  const { count } = await client.from("project_artifacts").select("*", { count: "exact", head: true })
    .eq("project_id", projectId).eq("artifact_type", "storyboard_project");
  assert.equal(count, 1);

  const { count: sceneCount } = await client.from("storyboard_scenes").select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  assert.ok((sceneCount ?? 0) >= 1);

  const { data: audit } = await client.from("audit_log").select("action")
    .eq("project_id", projectId).eq("action", "director.storyboard.completed");
  assert.ok((audit?.length ?? 0) >= 1);
  assert.ok(capturedScript);
  assert.ok(capturedVisual);

  await cleanupWorkspace(client, workspaceId).catch(() => undefined);
});
