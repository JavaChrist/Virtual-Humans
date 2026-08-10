/**
 * Phase 10C-PREP guards — prove Creative path cannot call Marketing / media / other directors,
 * and that PREP-style flag matrices make provider execution impossible.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  makeCreativeBrief,
  makeMarketingPlan,
} from "@/domain/creative/__tests__/fixtures";
import {
  canExecuteCreativeAi,
  canExecuteMarketingAi,
  canExecuteScriptAi,
  canExecuteArtAi,
  canExecuteStoryboardAi,
  isDirectorV2WorkerEnabled,
  isDirectorV2PaidGenerationEnabled,
} from "@/infrastructure/config/feature-flags";
import { runOpenAICreativeDryRun } from "@/infrastructure/ai/openai/creative/dry-run";
import { createEnvAiTokenPricing } from "@/infrastructure/ai/openai/marketing/pricing";
import {
  createAnalyzeCreativeForProject,
  type CreativeDirectorRunPort,
} from "../analyze-for-project";
import type { CreativeAnalyzerPort } from "../analyzer-port";
import type {
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";
import type { AiTokenPricingPort } from "@/infrastructure/ai/openai/marketing/pricing";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const brief = makeCreativeBrief({ id: BID, projectId: PID });
const plan = makeMarketingPlan(brief, { id: MID });

/** Minimal Production-like smoke matrix for 10C (Creative only). */
const smokeMatrix = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "1",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
  DIRECTOR_V2_ART_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
  OPENAI_API_KEY: "sk-test-not-used",
  OPENAI_CREATIVE_MODEL: "gpt-5.6-terra",
  OPENAI_MARKETING_PRICE_VERSION: "prep-test",
  OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: "200",
  OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: "800",
};

/** Runtime expected after PREP / close-out. */
const prepOffMatrix = {
  ...smokeMatrix,
  DIRECTOR_V2_ENABLED: "0",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "0",
  DIRECTOR_V2_PAID_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
};

test("10C matrix — Marketing/Script/Art/Storyboard/worker/media impossible", () => {
  assert.equal(canExecuteCreativeAi(smokeMatrix), true);
  assert.equal(canExecuteMarketingAi(smokeMatrix), false);
  assert.equal(canExecuteScriptAi(smokeMatrix), false);
  assert.equal(canExecuteArtAi(smokeMatrix), false);
  assert.equal(canExecuteStoryboardAi(smokeMatrix), false);
  assert.equal(isDirectorV2WorkerEnabled(smokeMatrix), false);
  assert.equal(isDirectorV2PaidGenerationEnabled(smokeMatrix), false);
});

test("10C-PREP off matrix — Creative provider path impossible", () => {
  assert.equal(canExecuteCreativeAi(prepOffMatrix), false);
  assert.equal(canExecuteMarketingAi(prepOffMatrix), false);
});

test("Creative dry-run never calls provider (PREP invariant)", () => {
  const pricing = createEnvAiTokenPricing(smokeMatrix);
  const dry = runOpenAICreativeDryRun(brief, plan, {
    env: smokeMatrix,
    pricing,
  });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.pricingConfigured, true);
  assert.ok((dry.approximateInputTokens ?? 0) > 0);
  assert.ok(dry.maxOutputTokens > 0);
});

test("Creative execute with PREP-off flags fails before analyzer", async () => {
  let analyzeCalls = 0;
  const analyzer: CreativeAnalyzerPort = {
    async analyze() {
      analyzeCalls += 1;
      throw new Error("analyzer must not run");
    },
  };
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
  const projects: ProjectRepository = {
    create: async () => undefined,
    load: async (id) => (id === PID ? project : null),
    saveStatus: async () => project,
  };
  const artifacts: ArtifactRepository = {
    append: async () => undefined,
    load: async (id) => {
      if (id === BID) return briefArt;
      if (id === MID) return planArt;
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
      if (type === "marketing_plan") {
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
  const directorRuns: CreativeDirectorRunPort = {
    beginOrGet: async () => {
      throw new Error("beginOrGet must not run when flags off");
    },
    reserveBudget: async () => undefined,
    persistConcept: async () => ({
      status: "created",
      artifactId: "x",
      revision: 1,
    }),
    failRun: async () => undefined,
    loadActiveCreativeConcept: async () => null,
  };
  const pricing: AiTokenPricingPort = createEnvAiTokenPricing(smokeMatrix);
  const svc = createAnalyzeCreativeForProject({
    workspaceId: WS,
    projects,
    artifacts,
    directorRuns,
    analyzer,
    pricing,
    env: prepOffMatrix,
  });
  const r = await svc.execute(
    { projectId: PID, expectedMarketingPlanRevision: 1 },
    { correlationId: "corr-10c-prep", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  assert.equal(analyzeCalls, 0);
});

test("Creative happy path does not mutate MarketingPlan input", async () => {
  const planCopy = JSON.stringify(plan);
  const dry = runOpenAICreativeDryRun(brief, plan, {
    env: smokeMatrix,
    pricing: createEnvAiTokenPricing(smokeMatrix),
  });
  assert.equal(JSON.stringify(plan), planCopy);
  assert.equal(dry.providerCalled, false);
});
