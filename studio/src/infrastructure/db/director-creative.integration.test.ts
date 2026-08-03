/**
 * Director creative persistence against LOCAL Supabase (VHS-118B).
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { resolveLocalSupabaseGate } from "./local-integration.gate";
import {
  cleanupWorkspace,
  createLocalClients,
  randomUUID,
} from "./integration-harness";
import { createDirectorPersistenceStack } from "./director-server";
import { makeValidCandidate } from "@/domain/marketing/__tests__/fixtures";
import { makeValidCreativeCandidate } from "@/domain/creative/__tests__/fixtures";
import type { MarketingAnalyzerPort } from "@/application/directors/marketing";
import type { CreativeAnalyzerPort } from "@/application/directors/creative/analyzer-port";
import { createSupabaseCreateProjectWithBriefPort } from "./repositories/create-project-with-brief";
import { BRIEF_SCHEMA_VERSION, finalizeBrief } from "@/domain/brief";

const gate = resolveLocalSupabaseGate();
if (!gate.ok) throw new Error(`VHS-118B: ${gate.reason}`);

const { client } = createLocalClients(gate);
const workspaces: string[] = [];

after(async () => {
  for (const ws of workspaces) {
    await cleanupWorkspace(client, ws).catch(() => undefined);
  }
});

async function seedWs() {
  const workspaceId = randomUUID();
  workspaces.push(workspaceId);
  await client.from("workspaces").insert({
    id: workspaceId,
    slug: `c118-${workspaceId.slice(0, 8)}`,
    name: "Cre 118B",
    mode: "single_workspace",
  });
  await client.from("workspace_budget_policies").insert({
    workspace_id: workspaceId,
    hard_limit_minor: 100_000,
    currency: "USD",
  });
  return workspaceId;
}

test("VHS-118B — dry-run + execute fake + persist creative_concept", async () => {
  const workspaceId = await seedWs();
  const projectId = randomUUID();
  const artifactId = randomUUID();
  const brief = finalizeBrief(
    {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-03T12:00:00.000Z",
      currentStep: 5,
      fields: {
        projectName: "Campagne 118B",
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
      correlationId: "corr-118b-it",
      createdAt: "2026-08-03T12:00:00.000Z",
      revision: 1,
    }
  );

  const createPort = createSupabaseCreateProjectWithBriefPort({ client });
  await createPort.execute({
    workspaceId,
    projectId,
    artifactId,
    projectName: brief.projectName,
    brief: { ...brief } as unknown as Record<string, unknown>,
    schemaVersion: BRIEF_SCHEMA_VERSION,
    correlationId: "corr-118b-it",
    actorType: "shared_password",
    actorId: "tester",
    createdBy: "tester",
  });

  const marketingAnalyzer: MarketingAnalyzerPort = {
    async analyze() {
      return makeValidCandidate({
        marketingObjective: "conversion",
        tone: "energetic",
        callToAction: "Téléchargez l'app et réservez",
      });
    },
  };
  const creativeAnalyzer: CreativeAnalyzerPort = {
    async analyze() {
      return makeValidCreativeCandidate();
    },
  };

  const env = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_MARKETING_AI_ENABLED: "1",
    DIRECTOR_V2_CREATIVE_AI_ENABLED: "1",
    DIRECTOR_V2_PAID_AI_ENABLED: "1",
    OPENAI_API_KEY: "sk-test-local",
    OPENAI_MARKETING_MODEL: "gpt-5.6-terra",
    OPENAI_CREATIVE_MODEL: "gpt-5.6-terra",
    OPENAI_MARKETING_PRICE_VERSION: "it-v1",
    OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: "100",
    OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: "200",
    OPENAI_CREATIVE_PRICE_VERSION: "it-v1",
    OPENAI_CREATIVE_PRICE_INPUT_PER_MILLION_MINOR: "100",
    OPENAI_CREATIVE_PRICE_OUTPUT_PER_MILLION_MINOR: "200",
  };

  const stack = createDirectorPersistenceStack({
    client,
    workspaceId,
    marketingAnalyzer,
    creativeAnalyzer,
    env,
  });

  const mkt = await stack.analyzeMarketing.execute(
    { projectId, expectedBriefRevision: 1 },
    { correlationId: "corr-118b-mkt", mode: "execute" }
  );
  assert.equal(mkt.status, "completed");

  const dry = await stack.analyzeCreative.dryRun(
    { projectId },
    { correlationId: "corr-118b-dry", mode: "dry-run" }
  );
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executable, true);
  assert.equal(dry.executionAvailable, true);

  const { count: spendBefore } = await client
    .from("vh_spend")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  const exec = await stack.analyzeCreative.execute(
    { projectId, expectedMarketingPlanRevision: 1 },
    { correlationId: "corr-118b-exec", mode: "execute" }
  );
  assert.equal(exec.status, "completed");
  if (exec.status !== "completed") return;
  assert.equal(exec.concept.status, "ready");

  const replay = await stack.analyzeCreative.execute(
    { projectId, expectedMarketingPlanRevision: 1 },
    { correlationId: "corr-118b-replay", mode: "execute" }
  );
  assert.equal(replay.status, "existing");

  const { count } = await client
    .from("project_artifacts")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("artifact_type", "creative_concept");
  assert.equal(count, 1);

  const { data: audit } = await client
    .from("audit_log")
    .select("action")
    .eq("project_id", projectId)
    .eq("action", "director.creative.completed");
  assert.ok((audit?.length ?? 0) >= 1);

  const { count: spendAfter } = await client
    .from("vh_spend")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  assert.equal(spendAfter ?? 0, spendBefore ?? 0);
});
