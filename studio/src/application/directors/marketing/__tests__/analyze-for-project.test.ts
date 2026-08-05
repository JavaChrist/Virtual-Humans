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
import { marketingFailure } from "../failures";

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
      return {
        candidate: makeValidCandidate({
          marketingObjective: brief.objective,
          tone: brief.tone,
          callToAction: brief.callToAction ?? "Téléchargez",
        }),
      };
    },
  };
}

function directorPort(opts?: {
  beginStatus?: "created" | "existing" | "already_running";
  retryStatus?:
    | "created"
    | "existing"
    | "already_running"
    | "terminal_replay"
    | "throw";
  retryThrow?: string;
  failedRun?: {
    directorRunId: string;
    attemptNumber: number;
    errorCode: string;
  } | null;
}): MarketingDirectorRunPort & { calls: string[]; retryInputs: unknown[] } {
  const calls: string[] = [];
  const retryInputs: unknown[] = [];
  let revision = 1;
  return {
    calls,
    retryInputs,
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
    async beginOrRetry(input) {
      calls.push("beginRetry");
      retryInputs.push(input);
      if (opts?.retryThrow) {
        throw new Error(opts.retryThrow);
      }
      if (opts?.retryStatus === "already_running") {
        return {
          status: "already_running",
          directorRunId: "run-2",
          revision: 1,
          attemptNumber: 2,
          retryOfRunId: input.previousRunId,
        };
      }
      if (opts?.retryStatus === "existing") {
        return {
          status: "existing",
          directorRunId: "run-2",
          revision: 1,
          attemptNumber: 2,
          retryOfRunId: input.previousRunId,
          outputArtifactId: "plan-1",
        };
      }
      if (opts?.retryStatus === "terminal_replay") {
        return {
          status: "terminal_replay",
          directorRunId: "run-2",
          revision: 3,
          attemptNumber: 2,
          retryOfRunId: input.previousRunId,
          runStatus: "failed",
          errorCode: "rate_limited",
        };
      }
      return {
        status: "created",
        directorRunId: "run-2",
        revision: 1,
        attemptNumber: 2,
        retryOfRunId: input.previousRunId,
      };
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
    async loadRetryableFailedRun() {
      if (opts?.failedRun === null) return null;
      if (opts?.failedRun) {
        return {
          directorRunId: opts.failedRun.directorRunId,
          attemptNumber: opts.failedRun.attemptNumber,
          errorCode: opts.failedRun.errorCode,
          modelId: "gpt-5.6-terra",
          promptVersion: "marketing-analyzer-v2",
          schemaVersion: "1.0.0",
          inputArtifactId: BID,
          inputRevision: 1,
        };
      }
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
      return {
        candidate: makeValidCandidate({
          marketingObjective: brief.objective,
          tone: brief.tone,
          callToAction: brief.callToAction ?? "Téléchargez",
        }),
      };
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

test("VHS-128 — dry-run exposes retryCandidate for failed retryable", async () => {
  const port = directorPort({
    failedRun: {
      directorRunId: "ed0b37b9-3225-4dc3-8837-21e8a2662095",
      attemptNumber: 1,
      errorCode: "rate_limited",
    },
  });
  const svc = createAnalyzeMarketingForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: port,
    analyzer: fakeAnalyzer(),
    pricing,
    env: enabledEnv,
  });
  const dry = await svc.dryRun(
    { projectId: PID },
    { correlationId: "c-retry-dry", mode: "dry-run" }
  );
  assert.ok(dry.retryCandidate);
  assert.equal(dry.retryCandidate?.previousAttemptNumber, 1);
  assert.equal(dry.retryCandidate?.nextAttemptNumber, 2);
  assert.equal(dry.retryCandidate?.retryAvailable, true);
});

test("VHS-129 — dry-run exposes attempt #3 for invalid_structured_output", async () => {
  const port = directorPort({
    failedRun: {
      directorRunId: "4c316d67-c97b-42e3-89ba-729730eb757c",
      attemptNumber: 2,
      errorCode: "invalid_structured_output",
    },
  });
  const svc = createAnalyzeMarketingForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: port,
    analyzer: fakeAnalyzer(),
    pricing,
    env: enabledEnv,
  });
  const dry = await svc.dryRun(
    { projectId: PID },
    { correlationId: "c-iso-dry", mode: "dry-run" }
  );
  assert.ok(dry.retryCandidate);
  assert.equal(dry.retryCandidate?.errorCode, "invalid_structured_output");
  assert.equal(dry.retryCandidate?.previousAttemptNumber, 2);
  assert.equal(dry.retryCandidate?.nextAttemptNumber, 3);
  assert.equal(dry.retryCandidate?.retryAvailable, true);
  assert.equal(
    marketingFailure("invalid_structured_output").retryable,
    false,
    "taxonomy auto-retry stays false"
  );
});

test("VHS-129 — dry-run omits retryCandidate for invalid_candidate", async () => {
  const port = directorPort({
    failedRun: {
      directorRunId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      attemptNumber: 1,
      errorCode: "invalid_candidate",
    },
  });
  const svc = createAnalyzeMarketingForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: port,
    analyzer: fakeAnalyzer(),
    pricing,
    env: enabledEnv,
  });
  const dry = await svc.dryRun(
    { projectId: PID },
    { correlationId: "c-bad-dry", mode: "dry-run" }
  );
  assert.equal(dry.retryCandidate, undefined);
});

test("VHS-128 — executeRetry happy path attempt 2, one analyzer call", async () => {
  let analyzeCalls = 0;
  const analyzer: MarketingAnalyzerPort = {
    async analyze() {
      analyzeCalls += 1;
      return {
        candidate: makeValidCandidate({
          marketingObjective: brief.objective,
          tone: brief.tone,
          callToAction: brief.callToAction ?? "Téléchargez",
        }),
      };
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
  const r = await svc.executeRetry(
    {
      projectId: PID,
      previousRunId: "ed0b37b9-3225-4dc3-8837-21e8a2662095",
      retryRequestId: "11111111-1111-4111-8111-111111111111",
      expectedBriefRevision: 1,
    },
    { correlationId: "c-retry", mode: "execute" }
  );
  assert.equal(analyzeCalls, 1);
  assert.ok(port.calls.includes("beginRetry"));
  assert.ok(port.calls.includes("reserve"));
  assert.ok(port.calls.includes("persist"));
  assert.equal(r.status, "completed");
  const beginInput = port.retryInputs[0] as { previousRunId: string };
  assert.equal(beginInput.previousRunId, "ed0b37b9-3225-4dc3-8837-21e8a2662095");
});

test("VHS-128 — executeRetry non-retryable → refus", async () => {
  const port = directorPort({ retryThrow: "retry_not_allowed" });
  const svc = createAnalyzeMarketingForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: port,
    analyzer: fakeAnalyzer(),
    pricing,
    env: enabledEnv,
  });
  const r = await svc.executeRetry(
    {
      projectId: PID,
      previousRunId: "ed0b37b9-3225-4dc3-8837-21e8a2662095",
      retryRequestId: "22222222-2222-4222-8222-222222222222",
      expectedBriefRevision: 1,
    },
    { correlationId: "c-retry-deny", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "retry_not_allowed");
    assert.equal(r.httpHint, 422);
  }
  assert.equal(port.calls.includes("reserve"), false);
});

test("VHS-129 — budget insuffisant bloque retry avant analyzer", async () => {
  let analyzeCalls = 0;
  const analyzer: MarketingAnalyzerPort = {
    async analyze() {
      analyzeCalls += 1;
      return { candidate: makeValidCandidate() };
    },
  };
  const port = directorPort();
  port.reserveBudget = async () => {
    port.calls.push("reserve");
    throw new Error("insufficient workspace budget");
  };
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
  const r = await svc.executeRetry(
    {
      projectId: PID,
      previousRunId: "4c316d67-c97b-42e3-89ba-729730eb757c",
      retryRequestId: "55555555-5555-4555-8555-555555555555",
      expectedBriefRevision: 1,
    },
    { correlationId: "c-budget", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "budget_exceeded");
    assert.equal(r.httpHint, 402);
  }
  assert.equal(analyzeCalls, 0);
  assert.ok(port.calls.includes("beginRetry"));
  assert.ok(port.calls.includes("reserve"));
});

test("VHS-128 — terminal_replay same retryRequestId → no provider call", async () => {
  let analyzeCalls = 0;
  const analyzer: MarketingAnalyzerPort = {
    async analyze() {
      analyzeCalls += 1;
      return { candidate: makeValidCandidate() };
    },
  };
  const port = directorPort({ retryStatus: "terminal_replay" });
  const svc = createAnalyzeMarketingForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: port,
    analyzer,
    pricing,
    env: enabledEnv,
  });
  const r = await svc.executeRetry(
    {
      projectId: PID,
      previousRunId: "ed0b37b9-3225-4dc3-8837-21e8a2662095",
      retryRequestId: "33333333-3333-4333-8333-333333333333",
      expectedBriefRevision: 1,
    },
    { correlationId: "c-replay", mode: "execute" }
  );
  assert.equal(analyzeCalls, 0);
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "rate_limited");
    assert.equal(r.directorRunId, "run-2");
  }
});

test("VHS-128 — execute maps terminal_reuse → retry_required", async () => {
  const port = directorPort();
  port.beginOrGet = async () => {
    throw new Error("director_run_terminal_reuse");
  };
  const svc = createAnalyzeMarketingForProject({
    workspaceId: WS,
    projects: projectsRepo(),
    artifacts: artifactsRepo(),
    directorRuns: port,
    analyzer: fakeAnalyzer(),
    pricing,
    env: enabledEnv,
  });
  const r = await svc.execute(
    { projectId: PID, expectedBriefRevision: 1 },
    { correlationId: "c-term", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "retry_required");
    assert.equal(r.httpHint, 409);
  }
});
