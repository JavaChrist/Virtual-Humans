import assert from "node:assert/strict";
import { test } from "node:test";
import { makeBrief, makeValidCandidate } from "@/domain/marketing/__tests__/fixtures";
import { finalizeMarketingPlan } from "@/domain/marketing";
import type { MarketingAnalyzerPort } from "../analyzer-port";
import {
  createAnalyzeMarketingForProject,
  mapMarketingPlanView,
  type MarketingDirectorRunPort,
} from "../analyze-for-project";
import type {
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";
import type { AiTokenPricingPort } from "@/infrastructure/ai/openai/marketing";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const brief = makeBrief({
  id: BID,
  projectId: PID,
});

const project: PersistedVideoProject = {
  id: PID,
  workspaceId: WS,
  name: brief.projectName,
  status: "draft",
  activeRevision: 1,
  schemaVersion: "1.0.0",
  createdAt: "2026-08-02T12:00:00.000Z",
  updatedAt: "2026-08-02T12:00:00.000Z",
  archivedAt: null,
  correlationId: "corr-p",
};

function projectsRepo(): ProjectRepository {
  return {
    create: async () => undefined,
    load: async (id) => (id === PID ? project : null),
    saveStatus: async () => project,
  };
}

function artifactsRepo(): ArtifactRepository {
  const art: PersistedArtifact = {
    id: BID,
    workspaceId: WS,
    projectId: PID,
    artifactType: "video_project_brief",
    revision: 1,
    schemaVersion: "1.0.0",
    parentRevisionId: null,
    value: brief,
    createdAt: brief.createdAt,
    createdBy: "tester",
    correlationId: brief.correlationId,
  };
  return {
    append: async () => undefined,
    load: async (id) => (id === BID ? art : null),
    loadByRevision: async () => art,
    getActive: async () => ({
      projectId: PID,
      artifactType: "video_project_brief",
      artifactId: BID,
      revision: 1,
      updatedAt: "2026-08-02T12:00:00.000Z",
      updatedBy: "tester",
    }),
    setActive: async () => ({
      projectId: PID,
      artifactType: "video_project_brief",
      artifactId: BID,
      revision: 1,
      updatedAt: "2026-08-02T12:00:00.000Z",
      updatedBy: "tester",
    }),
  };
}

function fakeAnalyzer(): MarketingAnalyzerPort {
  return {
    async analyze() {
      return makeValidCandidate({
        marketingObjective: brief.objective,
        tone: brief.tone,
        callToAction: brief.callToAction ?? "Téléchargez",
      });
    },
  };
}

function directorPort(opts?: {
  beginStatus?: "created" | "existing" | "already_running";
}): MarketingDirectorRunPort & { calls: string[] } {
  const calls: string[] = [];
  let revision = 1;
  return {
    calls,
    async beginOrGet() {
      calls.push("begin");
      if (opts?.beginStatus === "already_running") {
        return { status: "already_running", directorRunId: "run-1", revision: 1 };
      }
      if (opts?.beginStatus === "existing") {
        return {
          status: "existing",
          directorRunId: "run-1",
          revision: 1,
          outputArtifactId: "plan-1",
        };
      }
      return { status: "created", directorRunId: "run-1", revision };
    },
    async reserveBudget() {
      calls.push("reserve");
      revision += 1;
    },
    async persistPlan(input) {
      calls.push("persist");
      return { status: "created", artifactId: input.artifactId, revision: 1 };
    },
    async failRun() {
      calls.push("fail");
    },
    async loadActiveMarketingPlan() {
      return null;
    },
  };
}

const enabledEnv = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  OPENAI_API_KEY: "sk-test",
  OPENAI_MARKETING_MODEL: "gpt-5.6-terra",
};

const pricing: AiTokenPricingPort = {
  getPriceBook: () => ({
    modelId: "gpt-5.6-terra",
    pricingVersion: "test-v1",
    currency: "USD",
    inputPerMillionMinor: 100,
    outputPerMillionMinor: 200,
    confidence: "medium",
  }),
};

test("dry-run — providerCalled false, flags off → execution unavailable", async () => {
  const svc = createAnalyzeMarketingForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: directorPort(),
    analyzer: fakeAnalyzer(),
    pricing,
    env: {
      ...enabledEnv,
      DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
    },
  });
  const dry = await svc.dryRun(
    { projectId: PID },
    { correlationId: "c1", mode: "dry-run" }
  );
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executionAvailable, false);
});

test("execute — flags off → 503", async () => {
  const svc = createAnalyzeMarketingForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: directorPort(),
    analyzer: fakeAnalyzer(),
    pricing,
    env: { ...enabledEnv, DIRECTOR_V2_PAID_AI_ENABLED: "0" },
  });
  const r = await svc.execute(
    { projectId: PID, expectedBriefRevision: 1 },
    { correlationId: "c2", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") assert.equal(r.httpHint, 503);
});

test("execute — happy path with fake analyzer, no second call", async () => {
  let analyzeCalls = 0;
  const analyzer: MarketingAnalyzerPort = {
    async analyze() {
      analyzeCalls += 1;
      return makeValidCandidate({
        marketingObjective: brief.objective,
        tone: brief.tone,
        callToAction: brief.callToAction ?? "Téléchargez",
      });
    },
  };
  const port = directorPort();
  const svc = createAnalyzeMarketingForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: port,
    analyzer,
    pricing,
    env: enabledEnv,
    idFactory: (() => {
      let n = 0;
      return () => {
        n += 1;
        return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
      };
    })(),
  });
  const briefCopy = JSON.stringify(brief);
  const r = await svc.execute(
    { projectId: PID, expectedBriefRevision: 1 },
    { correlationId: "c3", mode: "execute" }
  );
  assert.equal(JSON.stringify(brief), briefCopy);
  assert.equal(analyzeCalls, 1);
  assert.ok(port.calls.includes("reserve"));
  assert.ok(port.calls.includes("persist"));
  assert.equal(r.status, "completed");
  if (r.status === "completed") {
    assert.equal(r.plan.status, "ready");
    assert.ok(r.plan.mainBenefit);
  }
});

test("execute — already_running", async () => {
  const svc = createAnalyzeMarketingForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: directorPort({ beginStatus: "already_running" }),
    analyzer: fakeAnalyzer(),
    pricing,
    env: enabledEnv,
  });
  const r = await svc.execute(
    { projectId: PID, expectedBriefRevision: 1 },
    { correlationId: "c4", mode: "execute" }
  );
  assert.equal(r.status, "already_running");
});

test("execute — revision conflict", async () => {
  const svc = createAnalyzeMarketingForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: directorPort(),
    analyzer: fakeAnalyzer(),
    pricing,
    env: enabledEnv,
  });
  const r = await svc.execute(
    { projectId: PID, expectedBriefRevision: 99 },
    { correlationId: "c5", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") assert.equal(r.httpHint, 409);
});

test("mapMarketingPlanView — no technical fields", () => {
  const plan = finalizeMarketingPlan({
    brief,
    candidate: makeValidCandidate({
      marketingObjective: brief.objective,
      tone: brief.tone,
      callToAction: brief.callToAction ?? "Go",
    }),
    metadata: {
      id: "11111111-1111-4111-8111-111111111111",
      createdBy: "tester",
      correlationId: "corr-map",
    },
  });
  const view = mapMarketingPlanView(plan, 1);
  assert.equal(view.status, "ready");
  assert.equal("evidence" in view, false);
  assert.equal("rationale" in view, false);
});
