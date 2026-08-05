import assert from "node:assert/strict";
import { test } from "node:test";
import {
  makeScriptChain,
  makeValidScriptCandidate,
} from "@/domain/script/__tests__/fixtures";
import type { ScriptAnalyzerPort } from "../analyzer-port";
import {
  createWriteScriptForProject,
  type ScriptDirectorRunPort,
} from "../analyze-for-project";
import type {
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";
import type { AiTokenPricingPort } from "@/infrastructure/ai/openai/marketing/pricing";
import { MarketingAnalyzerError } from "@/application/directors/marketing/failures";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const chain = makeScriptChain();
const brief = chain.brief;
const plan = chain.marketingPlan;
const concept = chain.creativeConcept;
const PID = brief.projectId;
const BID = brief.id;
const MID = plan.id;
const CID = concept.id;

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

function artifactsRepo(opts?: { creative?: boolean }): ArtifactRepository {
  const includeCreative = opts?.creative !== false;
  const arts: Record<string, PersistedArtifact> = {
    [BID]: {
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
    },
    [MID]: {
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
    },
    [CID]: {
      id: CID,
      workspaceId: WS,
      projectId: PID,
      artifactType: "creative_concept",
      revision: 1,
      schemaVersion: "1.0.0",
      parentRevisionId: null,
      value: concept,
      createdAt: concept.createdAt,
      createdBy: "tester",
      correlationId: concept.correlationId,
    },
  };
  return {
    append: async () => undefined,
    load: async (id) => arts[id] ?? null,
    loadByRevision: async () => arts[BID],
    getActive: async (_pid, type) => {
      if (type === "video_project_brief") {
        return {
          projectId: PID,
          artifactType: type,
          artifactId: BID,
          revision: 1,
          updatedAt: "2026-08-03T12:00:00.000Z",
          updatedBy: "tester",
        };
      }
      if (type === "marketing_plan") {
        return {
          projectId: PID,
          artifactType: type,
          artifactId: MID,
          revision: 1,
          updatedAt: "2026-08-03T12:00:00.000Z",
          updatedBy: "tester",
        };
      }
      if (type === "creative_concept" && includeCreative) {
        return {
          projectId: PID,
          artifactType: type,
          artifactId: CID,
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

function directorPort(opts?: {
  beginStatus?: "created" | "existing" | "already_running";
}): ScriptDirectorRunPort & { calls: string[] } {
  const calls: string[] = [];
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
          outputArtifactId: "script-1",
        };
      }
      return { status: "created", directorRunId: "run-1", revision: 1 };
    },
    async reserveBudget() {
      calls.push("reserve");
    },
    async persistScript(input) {
      calls.push("persist");
      return { status: "created", artifactId: input.artifactId, revision: 1 };
    },
    async failRun() {
      calls.push("fail");
    },
    async loadActiveVideoScript() {
      return null;
    },
  };
}

const enabledEnv = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  OPENAI_API_KEY: "sk-test",
  OPENAI_SCRIPT_MODEL: "gpt-5.6-terra",
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

test("script dry-run — providerCalled false, flags off", async () => {
  const svc = createWriteScriptForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: directorPort(),
    analyzer: { async analyze() { return { candidate: makeValidScriptCandidate() }; } },
    pricing,
    env: { ...enabledEnv, DIRECTOR_V2_SCRIPT_AI_ENABLED: "0" },
  });
  const dry = await svc.dryRun(
    { projectId: PID },
    { correlationId: "c1", mode: "dry-run" }
  );
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executionAvailable, false);
});

test("script dry-run — creative absent", async () => {
  const svc = createWriteScriptForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo({ creative: false }),
    directorRuns: directorPort(),
    analyzer: { async analyze() { return { candidate: makeValidScriptCandidate() }; } },
    pricing,
    env: enabledEnv,
  });
  const dry = await svc.dryRun(
    { projectId: PID },
    { correlationId: "c1b", mode: "dry-run" }
  );
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "creative_concept_missing"));
});

test("script execute — happy path single analyzer call", async () => {
  let calls = 0;
  const analyzer: ScriptAnalyzerPort = {
    async analyze() {
      calls += 1;
      return { candidate: makeValidScriptCandidate() };
    },
  };
  const port = directorPort();
  const svc = createWriteScriptForProject({
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
  const r = await svc.execute(
    { projectId: PID, expectedCreativeConceptRevision: 1 },
    { correlationId: "c3", mode: "execute" }
  );
  assert.equal(calls, 1);
  assert.ok(port.calls.includes("reserve"));
  assert.ok(port.calls.includes("persist"));
  assert.equal(r.status, "completed");
  if (r.status === "completed") {
    assert.ok(r.script.calculatedDuration != null);
    assert.ok(r.script.toleranceStatus);
  }
});

test("script execute — rate_limited preserved, no persist", async () => {
  const port = directorPort();
  const svc = createWriteScriptForProject({
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
    { projectId: PID, expectedCreativeConceptRevision: 1 },
    { correlationId: "c6", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "rate_limited");
    assert.equal(r.httpHint, 429);
  }
  assert.equal(port.calls.includes("persist"), false);
});

test("script execute — creative revision conflict", async () => {
  const svc = createWriteScriptForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: directorPort(),
    analyzer: { async analyze() { return { candidate: makeValidScriptCandidate() }; } },
    pricing,
    env: enabledEnv,
  });
  const r = await svc.execute(
    { projectId: PID, expectedCreativeConceptRevision: 99 },
    { correlationId: "c5", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") assert.equal(r.httpHint, 409);
});
