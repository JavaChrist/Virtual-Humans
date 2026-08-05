/**
 * Director marketing persistence against LOCAL Supabase (VHS-117B).
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
import type { MarketingAnalyzerPort } from "@/application/directors/marketing";
import { createSupabaseCreateProjectWithBriefPort } from "./repositories/create-project-with-brief";
import { BRIEF_SCHEMA_VERSION, finalizeBrief } from "@/domain/brief";

const gate = resolveLocalSupabaseGate();
if (!gate.ok) throw new Error(`VHS-117B: ${gate.reason}`);

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
    slug: `m117-${workspaceId.slice(0, 8)}`,
    name: "Mkt 117B",
    mode: "single_workspace",
  });
  await client.from("workspace_budget_policies").insert({
    workspace_id: workspaceId,
    hard_limit_minor: 100_000,
    currency: "USD",
  });
  return workspaceId;
}

test("VHS-117B — dry-run + execute fake + persist marketing_plan", async () => {
  const workspaceId = await seedWs();
  const projectId = randomUUID();
  const artifactId = randomUUID();
  const brief = finalizeBrief(
    {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-02T18:00:00.000Z",
      currentStep: 5,
      fields: {
        projectName: "Campagne 117B",
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
      correlationId: "corr-117b-it",
      createdAt: "2026-08-02T18:00:00.000Z",
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
    correlationId: "corr-117b-it",
    actorType: "shared_password",
    actorId: "tester",
    createdBy: "tester",
  });

  const analyzer: MarketingAnalyzerPort = {
    async analyze() {
      return { candidate: makeValidCandidate({
        marketingObjective: "conversion",
        tone: "energetic",
        callToAction: "Téléchargez l'app et réservez",
      }) };
    },
  };

  const env = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_MARKETING_AI_ENABLED: "1",
    DIRECTOR_V2_PAID_AI_ENABLED: "1",
    OPENAI_API_KEY: "sk-test-local",
    OPENAI_MARKETING_MODEL: "gpt-5.6-terra",
    OPENAI_MARKETING_PRICE_VERSION: "it-v1",
    OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: "100",
    OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: "200",
  };

  const stack = createDirectorPersistenceStack({
    client,
    workspaceId,
    marketingAnalyzer: analyzer,
    env,
  });

  const dry = await stack.analyzeMarketing.dryRun(
    { projectId },
    { correlationId: "corr-117b-dry", mode: "dry-run" }
  );
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executable, true);
  assert.equal(dry.executionAvailable, true);

  const exec = await stack.analyzeMarketing.execute(
    { projectId, expectedBriefRevision: 1 },
    { correlationId: "corr-117b-exec", mode: "execute" }
  );
  assert.equal(exec.status, "completed");
  if (exec.status !== "completed") return;
  assert.equal(exec.plan.status, "ready");

  const replay = await stack.analyzeMarketing.execute(
    { projectId, expectedBriefRevision: 1 },
    { correlationId: "corr-117b-replay", mode: "execute" }
  );
  assert.equal(replay.status, "existing");

  const { count } = await client
    .from("project_artifacts")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("artifact_type", "marketing_plan");
  assert.equal(count, 1);

  const { data: audit } = await client
    .from("audit_log")
    .select("action")
    .eq("project_id", projectId)
    .eq("action", "director.marketing.completed");
  assert.ok((audit?.length ?? 0) >= 1);
});

test("VHS-128 — attempt1 rate_limited → human retry attempt2 → completed", async () => {
  const workspaceId = await seedWs();
  const projectId = randomUUID();
  const artifactId = randomUUID();
  const brief = finalizeBrief(
    {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-02T18:00:00.000Z",
      currentStep: 5,
      fields: {
        projectName: "Campagne 128 retry",
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
      correlationId: "corr-128-it",
      createdAt: "2026-08-02T18:00:00.000Z",
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
    correlationId: "corr-128-it",
    actorType: "shared_password",
    actorId: "tester",
    createdBy: "tester",
  });

  let calls = 0;
  const analyzer: MarketingAnalyzerPort = {
    async analyze() {
      calls += 1;
      if (calls === 1) {
        const { MarketingAnalyzerError, marketingFailure } = await import(
          "@/application/directors/marketing/failures"
        );
        throw new MarketingAnalyzerError(
          marketingFailure("rate_limited", {
            retryable: true,
            provider: "openai",
            httpStatus: 429,
          })
        );
      }
      return { candidate: makeValidCandidate({
        marketingObjective: "conversion",
        tone: "energetic",
        callToAction: "Téléchargez l'app et réservez",
      }) };
    },
  };

  const env = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_MARKETING_AI_ENABLED: "1",
    DIRECTOR_V2_PAID_AI_ENABLED: "1",
    OPENAI_API_KEY: "sk-test-local",
    OPENAI_MARKETING_MODEL: "gpt-5.6-terra",
    OPENAI_MARKETING_PRICE_VERSION: "it-v1",
    OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: "100",
    OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: "200",
  };

  const stack = createDirectorPersistenceStack({
    client,
    workspaceId,
    marketingAnalyzer: analyzer,
    env,
  });

  const first = await stack.analyzeMarketing.execute(
    { projectId, expectedBriefRevision: 1 },
    { correlationId: "corr-128-a1", mode: "execute" }
  );
  assert.equal(first.status, "failed");
  if (first.status !== "failed") return;
  assert.equal(first.code, "rate_limited");
  assert.ok(first.directorRunId);

  const dry = await stack.analyzeMarketing.dryRun(
    { projectId },
    { correlationId: "corr-128-dry", mode: "dry-run" }
  );
  assert.ok(dry.retryCandidate?.retryAvailable);
  assert.equal(dry.retryCandidate?.previousAttemptNumber, 1);
  assert.equal(dry.retryCandidate?.nextAttemptNumber, 2);

  const retryRequestId = randomUUID();
  const second = await stack.analyzeMarketing.executeRetry(
    {
      projectId,
      previousRunId: first.directorRunId!,
      retryRequestId,
      expectedBriefRevision: 1,
    },
    { correlationId: "corr-128-a2", mode: "execute" }
  );
  assert.equal(second.status, "completed");
  assert.equal(calls, 2);

  const replay = await stack.analyzeMarketing.executeRetry(
    {
      projectId,
      previousRunId: first.directorRunId!,
      retryRequestId,
      expectedBriefRevision: 1,
    },
    { correlationId: "corr-128-replay", mode: "execute" }
  );
  assert.equal(replay.status, "existing");
  assert.equal(calls, 2);

  const { data: runs } = await client
    .from("director_runs" as never)
    .select("id, status, attempt_number, cost_status, retry_of_run_id")
    .eq("project_id", projectId)
    .eq("director_type", "marketing")
    .order("attempt_number", { ascending: true });
  const typed = (runs ?? []) as Array<{
    id: string;
    status: string;
    attempt_number: number;
    cost_status: string;
    retry_of_run_id: string | null;
  }>;
  assert.equal(typed.length, 2);
  assert.equal(typed[0]?.status, "failed");
  assert.equal(typed[0]?.cost_status, "released");
  assert.equal(typed[0]?.attempt_number, 1);
  assert.equal(typed[1]?.status, "completed");
  assert.equal(typed[1]?.cost_status, "committed");
  assert.equal(typed[1]?.attempt_number, 2);
  assert.equal(typed[1]?.retry_of_run_id, first.directorRunId);

  const { count } = await client
    .from("project_artifacts")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("artifact_type", "marketing_plan");
  assert.equal(count, 1);
});

test("VHS-129 — invalid_structured_output human retry attempt 3 + idempotence", async () => {
  const workspaceId = await seedWs();
  const projectId = randomUUID();
  const artifactId = randomUUID();
  const draft = {
    draftVersion: "1.0.0",
    updatedAt: new Date().toISOString(),
    currentStep: 5,
    fields: {
      projectName: "ISO Retry",
      subjectType: "product" as const,
      subjectName: "RideCloud",
      subjectDescription:
        "Application de mobilité partagée qui réduit le temps d'attente urbain.",
      objective: "conversion" as const,
      platform: "instagram" as const,
      durationSeconds: 30 as const,
      aspectRatio: "9:16" as const,
      language: "fr",
      tone: "energetic" as const,
      callToAction: "Téléchargez l'app et réservez",
      audienceDescription: "Navetteurs urbains pressés.",
      mediaReferences: [],
    },
  };
  const brief = finalizeBrief(draft, {
    id: artifactId,
    projectId,
    createdBy: "tester",
    correlationId: "corr-129-it",
    createdAt: "2026-08-05T00:00:00.000Z",
    revision: 1,
  });
  const createPort = createSupabaseCreateProjectWithBriefPort({ client });
  await createPort.execute({
    workspaceId,
    projectId,
    artifactId,
    projectName: brief.projectName,
    brief: { ...brief } as unknown as Record<string, unknown>,
    schemaVersion: BRIEF_SCHEMA_VERSION,
    correlationId: "corr-129-it",
    actorType: "shared_password",
    actorId: "tester",
    createdBy: "tester",
  });

  let calls = 0;
  const analyzer: MarketingAnalyzerPort = {
    async analyze() {
      calls += 1;
      const { MarketingAnalyzerError, marketingFailure } = await import(
        "@/application/directors/marketing/failures"
      );
      if (calls === 1) {
        throw new MarketingAnalyzerError(
          marketingFailure("rate_limited", {
            retryable: true,
            provider: "openai",
            httpStatus: 429,
          })
        );
      }
      if (calls === 2) {
        const fail = marketingFailure("invalid_structured_output");
        assert.equal(fail.retryable, false);
        throw new MarketingAnalyzerError(fail);
      }
      return { candidate: makeValidCandidate({
        marketingObjective: "conversion",
        tone: "energetic",
        callToAction: "Téléchargez l'app et réservez",
      }) };
    },
  };

  const env = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_MARKETING_AI_ENABLED: "1",
    DIRECTOR_V2_PAID_AI_ENABLED: "1",
    OPENAI_API_KEY: "sk-test-local",
    OPENAI_MARKETING_MODEL: "gpt-5.6-terra",
    OPENAI_MARKETING_PRICE_VERSION: "it-v1",
    OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: "100",
    OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: "200",
  };

  const stack = createDirectorPersistenceStack({
    client,
    workspaceId,
    marketingAnalyzer: analyzer,
    env,
  });

  const first = await stack.analyzeMarketing.execute(
    { projectId, expectedBriefRevision: 1 },
    { correlationId: "corr-129-a1", mode: "execute" }
  );
  assert.equal(first.status, "failed");
  if (first.status !== "failed") return;

  const second = await stack.analyzeMarketing.executeRetry(
    {
      projectId,
      previousRunId: first.directorRunId!,
      retryRequestId: randomUUID(),
      expectedBriefRevision: 1,
    },
    { correlationId: "corr-129-a2", mode: "execute" }
  );
  assert.equal(second.status, "failed");
  if (second.status !== "failed") return;
  assert.equal(second.code, "invalid_structured_output");
  assert.equal(second.retryable, false);

  const dry = await stack.analyzeMarketing.dryRun(
    { projectId },
    { correlationId: "corr-129-dry", mode: "dry-run" }
  );
  assert.equal(dry.retryCandidate?.errorCode, "invalid_structured_output");
  assert.equal(dry.retryCandidate?.previousAttemptNumber, 2);
  assert.equal(dry.retryCandidate?.nextAttemptNumber, 3);
  assert.equal(dry.retryCandidate?.retryAvailable, true);

  const retryRequestId = randomUUID();
  const third = await stack.analyzeMarketing.executeRetry(
    {
      projectId,
      previousRunId: second.directorRunId!,
      retryRequestId,
      expectedBriefRevision: 1,
    },
    { correlationId: "corr-129-a3", mode: "execute" }
  );
  assert.equal(third.status, "completed");
  assert.equal(calls, 3);

  const replay = await stack.analyzeMarketing.executeRetry(
    {
      projectId,
      previousRunId: second.directorRunId!,
      retryRequestId,
      expectedBriefRevision: 1,
    },
    { correlationId: "corr-129-replay", mode: "execute" }
  );
  assert.equal(replay.status, "existing");
  assert.equal(calls, 3);

  const concurrent = await stack.analyzeMarketing.executeRetry(
    {
      projectId,
      previousRunId: second.directorRunId!,
      retryRequestId: randomUUID(),
      expectedBriefRevision: 1,
    },
    { correlationId: "corr-129-concurrent", mode: "execute" }
  );
  assert.equal(concurrent.status, "failed");
  if (concurrent.status === "failed") {
    assert.ok(
      concurrent.code === "retry_not_allowed" ||
        concurrent.code === "retry_conflict"
    );
  }
  assert.equal(calls, 3);

  const { data: runs } = await client
    .from("director_runs" as never)
    .select("id, status, attempt_number, cost_status, error_code")
    .eq("project_id", projectId)
    .eq("director_type", "marketing")
    .order("attempt_number", { ascending: true });
  const typed = (runs ?? []) as Array<{
    status: string;
    attempt_number: number;
    cost_status: string;
    error_code: string | null;
  }>;
  assert.equal(typed.length, 3);
  assert.equal(typed[0]?.attempt_number, 1);
  assert.equal(typed[0]?.cost_status, "released");
  assert.equal(typed[1]?.attempt_number, 2);
  assert.equal(typed[1]?.error_code, "invalid_structured_output");
  assert.equal(typed[1]?.cost_status, "released");
  assert.equal(typed[2]?.attempt_number, 3);
  assert.equal(typed[2]?.status, "completed");
  assert.equal(typed[2]?.cost_status, "committed");
});
