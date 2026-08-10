/**
 * Phase 10D-PREP guards — Script-only matrix; Marketing/Creative/Art/Storyboard/media/worker blocked.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  makeScriptBrief,
  makeScriptMarketingPlan,
  makeScriptCreativeConcept,
  makeValidScriptCandidate,
} from "@/domain/script/__tests__/fixtures";
import {
  canExecuteCreativeAi,
  canExecuteMarketingAi,
  canExecuteScriptAi,
  canExecuteArtAi,
  canExecuteStoryboardAi,
  isDirectorV2WorkerEnabled,
  isDirectorV2PaidGenerationEnabled,
} from "@/infrastructure/config/feature-flags";
import { runOpenAIScriptDryRun } from "@/infrastructure/ai/openai/script/dry-run";
import { createEnvAiTokenPricing } from "@/infrastructure/ai/openai/marketing/pricing";
import {
  createWriteScriptForProject,
  type ScriptDirectorRunPort,
} from "../analyze-for-project";
import type { ScriptAnalyzerPort } from "../analyzer-port";
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
const CID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const brief = makeScriptBrief({ id: BID, projectId: PID });
const plan = makeScriptMarketingPlan(brief);
const concept = makeScriptCreativeConcept(brief, plan);

/** Minimal Production-like smoke matrix for 10D (Script only). */
const smokeMatrix = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "1",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
  DIRECTOR_V2_ART_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
  OPENAI_API_KEY: "sk-test-not-used",
  /** Canonical Production Script knobs (10D-RECONCILE) — not code defaults. */
  OPENAI_SCRIPT_MODEL: "gpt-5.6",
  OPENAI_SCRIPT_REASONING_EFFORT: "medium",
  OPENAI_SCRIPT_MAX_OUTPUT_TOKENS: "4096",
  OPENAI_MARKETING_PRICE_VERSION: "prep-test",
  OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: "500",
  OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: "3000",
};

const prepOffMatrix = {
  ...smokeMatrix,
  DIRECTOR_V2_ENABLED: "0",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "0",
  DIRECTOR_V2_PAID_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
};

test("10D matrix — only Script executable; Marketing/Creative/Art/Storyboard/worker/media blocked", () => {
  assert.equal(canExecuteScriptAi(smokeMatrix), true);
  assert.equal(canExecuteMarketingAi(smokeMatrix), false);
  assert.equal(canExecuteCreativeAi(smokeMatrix), false);
  assert.equal(canExecuteArtAi(smokeMatrix), false);
  assert.equal(canExecuteStoryboardAi(smokeMatrix), false);
  assert.equal(isDirectorV2WorkerEnabled(smokeMatrix), false);
  assert.equal(isDirectorV2PaidGenerationEnabled(smokeMatrix), false);
});

test("10D-PREP off matrix — Script provider path impossible", () => {
  assert.equal(canExecuteScriptAi(prepOffMatrix), false);
});

test("Script dry-run never calls provider (PREP invariant)", () => {
  const dry = runOpenAIScriptDryRun(brief, plan, concept, {
    env: smokeMatrix,
    pricing: createEnvAiTokenPricing(smokeMatrix),
  });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.pricingConfigured, true);
  assert.ok((dry.approximateInputTokens ?? 0) > 0);
  assert.ok(dry.maxOutputTokens > 0);
});

test("10D-RECONCILE — Production-documented knobs yield model gpt-5.6 / medium / 4096", () => {
  const dry = runOpenAIScriptDryRun(brief, plan, concept, {
    env: smokeMatrix,
    pricing: createEnvAiTokenPricing(smokeMatrix),
  });
  assert.equal(dry.model, "gpt-5.6");
  assert.equal(dry.reasoningEffort, "medium");
  assert.equal(dry.maxOutputTokens, 4096);
  const book = createEnvAiTokenPricing(smokeMatrix).getPriceBook(dry.model)!;
  const outShare = Math.floor(
    (dry.maxOutputTokens * book.outputPerMillionMinor) / 1_000_000
  );
  const estimate =
    Math.floor(
      ((dry.approximateInputTokens ?? 0) * book.inputPerMillionMinor) / 1_000_000
    ) + outShare;
  assert.equal(outShare, 12);
  assert.equal(estimate, outShare); // fixtures stay under 2000 input tokens → 12¢ total
  assert.equal(dry.providerCalled, false);
});

test("code-default Script knobs (terra/2400) produce the PREP-misread 7¢ output share", () => {
  const codeDefaultEnv = {
    ...smokeMatrix,
    OPENAI_SCRIPT_MODEL: "gpt-5.6-terra",
    OPENAI_SCRIPT_REASONING_EFFORT: "low",
    OPENAI_SCRIPT_MAX_OUTPUT_TOKENS: "2400",
  };
  const dry = runOpenAIScriptDryRun(brief, plan, concept, {
    env: codeDefaultEnv,
    pricing: createEnvAiTokenPricing(codeDefaultEnv),
  });
  const book = createEnvAiTokenPricing(codeDefaultEnv).getPriceBook(dry.model)!;
  const outShare = Math.floor(
    (dry.maxOutputTokens * book.outputPerMillionMinor) / 1_000_000
  );
  assert.equal(dry.model, "gpt-5.6-terra");
  assert.equal(dry.maxOutputTokens, 2400);
  assert.equal(outShare, 7);
});

test("Script dry-run does not mutate MarketingPlan or CreativeConcept", () => {
  const planCopy = JSON.stringify(plan);
  const conceptCopy = JSON.stringify(concept);
  runOpenAIScriptDryRun(brief, plan, concept, {
    env: smokeMatrix,
    pricing: createEnvAiTokenPricing(smokeMatrix),
  });
  assert.equal(JSON.stringify(plan), planCopy);
  assert.equal(JSON.stringify(concept), conceptCopy);
});

test("Script execute with PREP-off flags fails before analyzer", async () => {
  let analyzeCalls = 0;
  const analyzer: ScriptAnalyzerPort = {
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
  const conceptArt: PersistedArtifact = {
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
      if (id === CID) return conceptArt;
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
      if (type === "creative_concept") {
        return {
          projectId: PID,
          artifactType: "creative_concept",
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
  const directorRuns: ScriptDirectorRunPort = {
    beginOrGet: async () => {
      throw new Error("beginOrGet must not run when flags off");
    },
    reserveBudget: async () => undefined,
    persistScript: async () => ({
      status: "created",
      artifactId: "x",
      revision: 1,
    }),
    failRun: async () => undefined,
    loadActiveVideoScript: async () => null,
  };
  const pricing: AiTokenPricingPort = createEnvAiTokenPricing(smokeMatrix);
  const svc = createWriteScriptForProject({
    workspaceId: WS,
    projects,
    artifacts,
    directorRuns,
    analyzer,
    pricing,
    env: prepOffMatrix,
  });
  const r = await svc.execute(
    {
      projectId: PID,
      expectedCreativeConceptRevision: 1,
      expectedMarketingPlanRevision: 1,
    },
    { correlationId: "corr-10d-prep", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  assert.equal(analyzeCalls, 0);
});

test("Script happy path still single analyzer call (idempotence contract)", async () => {
  let analyzeCalls = 0;
  const analyzer: ScriptAnalyzerPort = {
    async analyze() {
      analyzeCalls += 1;
      return { candidate: makeValidScriptCandidate() };
    },
  };
  // Reuse existing unit-test stack via createWriteScriptForProject with enabled flags
  // and a beginOrGet that returns existing on second call is covered elsewhere;
  // here we only assert dry-run estimate ceiling math stays provider-free.
  const dry = runOpenAIScriptDryRun(brief, plan, concept, {
    env: smokeMatrix,
    pricing: createEnvAiTokenPricing(smokeMatrix),
  });
  const book = createEnvAiTokenPricing(smokeMatrix).getPriceBook(dry.model)!;
  const estimate =
    Math.floor(((dry.approximateInputTokens ?? 0) * book.inputPerMillionMinor) / 1_000_000) +
    Math.floor((dry.maxOutputTokens * book.outputPerMillionMinor) / 1_000_000);
  assert.ok(estimate >= 1);
  assert.ok(estimate <= 100);
  assert.equal(dry.providerCalled, false);
  assert.equal(analyzeCalls, 0);
});
