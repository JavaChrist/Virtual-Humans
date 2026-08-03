/**
 * VHS-117D — provider failure taxonomy through Director + AnalyzeMarketingForProject.
 * Fakes only — no network.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeBrief, makeValidCandidate } from "@/domain/marketing/__tests__/fixtures";
import type { MarketingAnalyzerPort } from "../analyzer-port";
import { createMarketingDirector } from "../marketing-director";
import {
  createAnalyzeMarketingForProject,
  type MarketingDirectorRunPort,
} from "../analyze-for-project";
import {
  MarketingAnalyzerError,
  marketingFailure,
} from "../failures";
import { mapMarketingFailureToHttp } from "../http-map";
import type {
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";
import type { AiTokenPricingPort } from "@/infrastructure/ai/openai/marketing";
import type { DirectorRunContext } from "../result";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const brief = makeBrief({ id: BID, projectId: PID });

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

function directorPort(): MarketingDirectorRunPort & {
  calls: string[];
  failCodes: string[];
} {
  const calls: string[] = [];
  const failCodes: string[] = [];
  let revision = 1;
  return {
    calls,
    failCodes,
    async beginOrGet() {
      calls.push("begin");
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
    async failRun(input) {
      calls.push("fail");
      failCodes.push(input.errorCode);
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

const execCtx = (): DirectorRunContext => ({
  correlationId: "corr-tax",
  mode: "execute",
  createdBy: "tester",
  planId: "plan-1",
});

test("Director — rate_limited reste provider_failed, jamais invalid_candidate", async () => {
  let calls = 0;
  const director = createMarketingDirector({
    analyzer: {
      async analyze() {
        calls += 1;
        throw new MarketingAnalyzerError(
          marketingFailure("rate_limited", {
            retryable: true,
            provider: "openai",
            httpStatus: 429,
            retryAfterSeconds: 20,
          })
        );
      },
    },
  });
  const result = await director.run({ brief: makeBrief() }, execCtx());
  assert.equal(calls, 1);
  assert.equal(result.status, "provider_failed");
  if (result.status === "provider_failed") {
    assert.equal(result.failure.code, "rate_limited");
    assert.equal(result.failure.retryable, true);
  }
});

test("Director — candidat domaine invalide reste invalid", async () => {
  const director = createMarketingDirector({
    analyzer: {
      async analyze() {
        return makeValidCandidate({
          callToAction: "Bonne soirée",
          emotionalHook: "Garantie 100% miracle sans risque",
        });
      },
    },
  });
  const result = await director.run({ brief: makeBrief() }, execCtx());
  assert.equal(result.status, "invalid");
});

test("VHS-117C régression — un appel rate_limited, zéro artifact, réserve libérée", async () => {
  let analyzeCalls = 0;
  const analyzer: MarketingAnalyzerPort = {
    async analyze() {
      analyzeCalls += 1;
      throw new MarketingAnalyzerError(
        marketingFailure("rate_limited", {
          retryable: true,
          provider: "openai",
          httpStatus: 429,
          retryAfterSeconds: 12,
        })
      );
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

  const r = await svc.execute(
    { projectId: PID, expectedBriefRevision: 1 },
    { correlationId: "corr-117c", mode: "execute" }
  );

  assert.equal(analyzeCalls, 1);
  assert.ok(port.calls.includes("reserve"));
  assert.ok(port.calls.includes("fail"));
  assert.equal(port.calls.includes("persist"), false);
  assert.deepEqual(port.failCodes, ["rate_limited"]);
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "rate_limited");
    assert.equal(r.retryable, true);
    assert.equal(r.httpHint, 429);
    assert.equal(r.retryAfterSeconds, 12);
    assert.notEqual(r.code, "invalid_candidate");
  }

  // Single execute → single analyzer call (no auto-retry)
  assert.equal(analyzeCalls, 1);
});

test("service — invalid_candidate inchangé pour vrai candidat invalide", async () => {
  const analyzer: MarketingAnalyzerPort = {
    async analyze() {
      return makeValidCandidate({
        callToAction: "Bonne soirée",
        emotionalHook: "Garantie 100% miracle sans risque",
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
    idFactory: () => "11111111-1111-4111-8111-111111111111",
  });
  const r = await svc.execute(
    { projectId: PID, expectedBriefRevision: 1 },
    { correlationId: "corr-inv", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "invalid_candidate");
    assert.equal(r.httpHint, 422);
    assert.equal(r.retryable, false);
  }
  assert.deepEqual(port.failCodes, ["invalid_candidate"]);
  assert.equal(port.calls.includes("persist"), false);
});

test("HTTP map — rate_limited 429 + Retry-After ; timeout 504 ; unavailable 503 ; invalid 422", () => {
  const rl = mapMarketingFailureToHttp(
    marketingFailure("rate_limited", { retryable: true, retryAfterSeconds: 9 })
  );
  assert.equal(rl.status, 429);
  assert.equal(rl.headers["Retry-After"], "9");
  assert.equal(rl.body.error.code, "rate_limited");
  assert.equal(rl.body.error.retryable, true);
  assert.equal(rl.body.error.message.includes("OpenAI"), false);

  const noRa = mapMarketingFailureToHttp(
    marketingFailure("rate_limited", { retryable: true, retryAfterSeconds: 99999 })
  );
  // constructor marketingFailure doesn't clamp — http map clamps
  assert.equal(noRa.headers["Retry-After"], undefined);

  assert.equal(
    mapMarketingFailureToHttp(marketingFailure("timeout")).status,
    504
  );
  assert.equal(
    mapMarketingFailureToHttp(marketingFailure("provider_unavailable")).status,
    503
  );
  assert.equal(
    mapMarketingFailureToHttp(marketingFailure("invalid_candidate")).status,
    422
  );

  const blob = JSON.stringify(rl.body);
  assert.equal(blob.includes("stack"), false);
  assert.equal(blob.includes("Authorization"), false);
});
