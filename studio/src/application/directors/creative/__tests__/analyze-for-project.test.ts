import assert from "node:assert/strict";
import { test } from "node:test";
import {
  makeCreativeBrief,
  makeMarketingPlan,
  makeValidCreativeCandidate,
} from "@/domain/creative/__tests__/fixtures";
import type { CreativeAnalyzerPort } from "../analyzer-port";
import {
  createAnalyzeCreativeForProject,
  mapCreativeConceptView,
  type CreativeDirectorRunPort,
} from "../analyze-for-project";
import type {
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";
import type { AiTokenPricingPort } from "@/infrastructure/ai/openai/marketing/pricing";
import { MarketingAnalyzerError } from "@/application/directors/marketing/failures";
import { finalizeCreativeConcept } from "@/domain/creative";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const brief = makeCreativeBrief({ id: BID, projectId: PID });
const plan = makeMarketingPlan(brief, { id: MID });

const project: PersistedVideoProject = {
  id: PID,
  workspaceId: WS,
  name: brief.projectName,
  status: "draft",
  activeRevision: 1,
  schemaVersion: "1.0.0",
  createdAt: "2026-08-03T12:00:00.000Z",
  updatedAt: "2026-08-03T12:00:00.000Z",
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

function artifactsRepo(opts?: { marketing?: boolean }): ArtifactRepository {
  const briefArt: PersistedArtifact = {
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
  const planArt: PersistedArtifact = {
    id: MID,
    workspaceId: WS,
    projectId: PID,
    artifactType: "marketing_plan",
    revision: 1,
    schemaVersion: "1.0.0",
    parentRevisionId: null,
    value: plan,
    createdAt: plan.createdAt,
    createdBy: "tester",
    correlationId: plan.correlationId,
  };
  const includeMarketing = opts?.marketing !== false;
  return {
    append: async () => undefined,
    load: async (id) => {
      if (id === BID) return briefArt;
      if (id === MID && includeMarketing) return planArt;
      return null;
    },
    loadByRevision: async () => briefArt,
    getActive: async (_pid, type) => {
      if (type === "video_project_brief") {
        return {
          projectId: PID,
          artifactType: "video_project_brief",
          artifactId: BID,
          revision: 1,
          updatedAt: "2026-08-03T12:00:00.000Z",
          updatedBy: "tester",
        };
      }
      if (type === "marketing_plan" && includeMarketing) {
        return {
          projectId: PID,
          artifactType: "marketing_plan",
          artifactId: MID,
          revision: 1,
          updatedAt: "2026-08-03T12:00:00.000Z",
          updatedBy: "tester",
        };
      }
      return null;
    },
    setActive: async () => ({
      projectId: PID,
      artifactType: "video_project_brief",
      artifactId: BID,
      revision: 1,
      updatedAt: "2026-08-03T12:00:00.000Z",
      updatedBy: "tester",
    }),
  };
}

function fakeAnalyzer(): CreativeAnalyzerPort {
  return {
    async analyze() {
      return makeValidCreativeCandidate();
    },
  };
}

function directorPort(opts?: {
  beginStatus?: "created" | "existing" | "already_running";
}): CreativeDirectorRunPort & { calls: string[] } {
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
          outputArtifactId: "concept-1",
        };
      }
      return { status: "created", directorRunId: "run-1", revision };
    },
    async reserveBudget() {
      calls.push("reserve");
      revision += 1;
    },
    async persistConcept(input) {
      calls.push("persist");
      return { status: "created", artifactId: input.artifactId, revision: 1 };
    },
    async failRun() {
      calls.push("fail");
    },
    async loadActiveCreativeConcept() {
      return null;
    },
  };
}

const enabledEnv = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  OPENAI_API_KEY: "sk-test",
  OPENAI_CREATIVE_MODEL: "gpt-5.6-terra",
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

test("creative dry-run — providerCalled false, flags off → execution unavailable", async () => {
  const svc = createAnalyzeCreativeForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: directorPort(),
    analyzer: fakeAnalyzer(),
    pricing,
    env: { ...enabledEnv, DIRECTOR_V2_CREATIVE_AI_ENABLED: "0" },
  });
  const dry = await svc.dryRun(
    { projectId: PID },
    { correlationId: "c1", mode: "dry-run" }
  );
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executionAvailable, false);
});

test("creative dry-run — marketing absent", async () => {
  const svc = createAnalyzeCreativeForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo({ marketing: false }),
    directorRuns: directorPort(),
    analyzer: fakeAnalyzer(),
    pricing,
    env: enabledEnv,
  });
  const dry = await svc.dryRun(
    { projectId: PID },
    { correlationId: "c1b", mode: "dry-run" }
  );
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "marketing_plan_missing"));
});

test("creative execute — flags off → 503", async () => {
  const svc = createAnalyzeCreativeForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: directorPort(),
    analyzer: fakeAnalyzer(),
    pricing,
    env: { ...enabledEnv, DIRECTOR_V2_PAID_AI_ENABLED: "0" },
  });
  const r = await svc.execute(
    { projectId: PID, expectedMarketingPlanRevision: 1 },
    { correlationId: "c2", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") assert.equal(r.httpHint, 503);
});

test("creative execute — happy path fake analyzer, single call", async () => {
  let analyzeCalls = 0;
  const analyzer: CreativeAnalyzerPort = {
    async analyze() {
      analyzeCalls += 1;
      return makeValidCreativeCandidate();
    },
  };
  const port = directorPort();
  const svc = createAnalyzeCreativeForProject({
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
  const planCopy = JSON.stringify(plan);
  const r = await svc.execute(
    { projectId: PID, expectedMarketingPlanRevision: 1 },
    { correlationId: "c3", mode: "execute" }
  );
  assert.equal(JSON.stringify(plan), planCopy);
  assert.equal(analyzeCalls, 1);
  assert.ok(port.calls.includes("reserve"));
  assert.ok(port.calls.includes("persist"));
  assert.equal(r.status, "completed");
});

test("creative execute — already_running", async () => {
  const svc = createAnalyzeCreativeForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: directorPort({ beginStatus: "already_running" }),
    analyzer: fakeAnalyzer(),
    pricing,
    env: enabledEnv,
  });
  const r = await svc.execute(
    { projectId: PID, expectedMarketingPlanRevision: 1 },
    { correlationId: "c4", mode: "execute" }
  );
  assert.equal(r.status, "already_running");
});

test("creative execute — marketing revision conflict", async () => {
  const svc = createAnalyzeCreativeForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: directorPort(),
    analyzer: fakeAnalyzer(),
    pricing,
    env: enabledEnv,
  });
  const r = await svc.execute(
    { projectId: PID, expectedMarketingPlanRevision: 99 },
    { correlationId: "c5", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") assert.equal(r.httpHint, 409);
});

test("creative execute — rate_limited preserved, no persist", async () => {
  const port = directorPort();
  const svc = createAnalyzeCreativeForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: port,
    analyzer: {
      async analyze() {
        throw new MarketingAnalyzerError({
          code: "rate_limited",
          retryable: true,
          publicMessage: "Le fournisseur IA est temporairement saturé.",
          provider: "openai",
          retryAfterSeconds: 30,
        });
      },
    },
    pricing,
    env: enabledEnv,
    idFactory: () => "00000000-0000-4000-8000-000000000099",
  });
  const r = await svc.execute(
    { projectId: PID, expectedMarketingPlanRevision: 1 },
    { correlationId: "c6", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "rate_limited");
    assert.equal(r.httpHint, 429);
  }
  assert.ok(port.calls.includes("fail"));
  assert.equal(port.calls.includes("persist"), false);
});

test("mapCreativeConceptView — no technical fields", () => {
  const concept = finalizeCreativeConcept({
    brief,
    marketingPlan: plan,
    candidate: makeValidCreativeCandidate(),
    metadata: {
      id: "11111111-1111-4111-8111-111111111111",
      createdBy: "tester",
      correlationId: "corr-map",
    },
  });
  const view = mapCreativeConceptView(concept, 1);
  assert.equal(view.status, "ready");
  assert.equal("evidence" in view, false);
  assert.equal("rationale" in view, false);
  assert.ok(view.title);
});
