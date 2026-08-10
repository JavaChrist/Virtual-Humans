/**
 * Phase 10F-PREP guards — Storyboard text-only matrix;
 * Marketing/Creative/Script/Art/media/worker blocked.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  makeStoryboardChain,
  makeValidStoryboardCandidate,
} from "@/domain/storyboard/__tests__/fixtures";
import {
  StoryboardAnalysisCandidateSchema,
  validateCandidateAgainstSources,
} from "@/domain/storyboard";
import {
  canExecuteCreativeAi,
  canExecuteMarketingAi,
  canExecuteScriptAi,
  canExecuteArtAi,
  canExecuteStoryboardAi,
  canExecutePaidGeneration,
  isDirectorV2WorkerEnabled,
  isDirectorV2PaidGenerationEnabled,
} from "@/infrastructure/config/feature-flags";
import { runOpenAIStoryboardDryRun } from "@/infrastructure/ai/openai/storyboard/dry-run";
import { STORYBOARD_ANALYZER_PROMPT_VERSION } from "@/infrastructure/ai/openai/storyboard/prompt";
import { createEnvAiTokenPricing } from "@/infrastructure/ai/openai/marketing/pricing";
import {
  createAnalyzeStoryboardForProject,
  type StoryboardDirectorRunPort,
} from "../analyze-for-project";
import type { StoryboardAnalyzerPort } from "../analyzer-port";
import type {
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const SID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const VID = "11111111-1111-4111-8111-111111111111";

const chain = makeStoryboardChain({ withCharacter: false });
const brief = { ...chain.brief, id: BID, projectId: PID };
const plan = {
  ...chain.marketingPlan,
  id: MID,
  projectId: PID,
  briefRevisionId: BID,
};
const concept = {
  ...chain.creativeConcept,
  id: CID,
  projectId: PID,
  marketingPlanRevisionId: MID,
};
const script = {
  ...chain.videoScript,
  id: SID,
  projectId: PID,
  creativeConceptRevisionId: CID,
};
const visual = {
  ...chain.visualDirection,
  id: VID,
  projectId: PID,
  videoScriptRevisionId: SID,
  creativeConceptRevisionId: CID,
};

/** Minimal Production-like smoke matrix for 10F (Storyboard text only). */
const smokeMatrix = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "1",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
  DIRECTOR_V2_ART_AI_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
  OPENAI_API_KEY: "sk-test-not-used",
  OPENAI_STORYBOARD_MODEL: "gpt-5.6",
  OPENAI_STORYBOARD_REASONING_EFFORT: "medium",
  OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS: "4096",
  OPENAI_MARKETING_PRICE_VERSION: "prep-test",
  OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: "500",
  OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: "3000",
};

const prepOffMatrix = {
  ...smokeMatrix,
  DIRECTOR_V2_ENABLED: "0",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "0",
  DIRECTOR_V2_PAID_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
};

const mediaOnMatrix = {
  ...smokeMatrix,
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
  DIRECTOR_V2_WORKER_ENABLED: "1",
};

test("10F matrix — only Storyboard executable; upstream/media/worker blocked", () => {
  assert.equal(canExecuteStoryboardAi(smokeMatrix), true);
  assert.equal(canExecuteMarketingAi(smokeMatrix), false);
  assert.equal(canExecuteCreativeAi(smokeMatrix), false);
  assert.equal(canExecuteScriptAi(smokeMatrix), false);
  assert.equal(canExecuteArtAi(smokeMatrix), false);
  assert.equal(isDirectorV2WorkerEnabled(smokeMatrix), false);
  assert.equal(isDirectorV2PaidGenerationEnabled(smokeMatrix), false);
  assert.equal(canExecutePaidGeneration(smokeMatrix), false);
});

test("10F smoke eligibility forbids PAID_GENERATION or worker ON", () => {
  assert.equal(canExecutePaidGeneration(mediaOnMatrix), true);
  assert.equal(isDirectorV2WorkerEnabled(mediaOnMatrix), true);
  const storyboardOkButMediaOn =
    canExecuteStoryboardAi(mediaOnMatrix) &&
    (canExecutePaidGeneration(mediaOnMatrix) ||
      isDirectorV2WorkerEnabled(mediaOnMatrix));
  assert.equal(storyboardOkButMediaOn, true);
});

test("10F-PREP off matrix — Storyboard provider path impossible", () => {
  assert.equal(canExecuteStoryboardAi(prepOffMatrix), false);
});

test("Storyboard dry-run never calls provider (PREP invariant)", () => {
  const dry = runOpenAIStoryboardDryRun(brief, plan, concept, script, visual, {
    env: smokeMatrix,
    pricing: createEnvAiTokenPricing(smokeMatrix),
  });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.pricingConfigured, true);
  assert.ok((dry.approximateInputTokens ?? 0) > 0);
  assert.ok(dry.maxOutputTokens > 0);
  assert.equal(dry.model, "gpt-5.6");
  assert.equal(dry.reasoningEffort, "medium");
  assert.equal(dry.maxOutputTokens, 4096);
  assert.equal(dry.promptVersion, "storyboard-analyzer-v2");
  assert.equal(STORYBOARD_ANALYZER_PROMPT_VERSION, "storyboard-analyzer-v2");
});

test("Storyboard dry-run exposes knobs and does not mutate upstream artifacts", () => {
  const planCopy = JSON.stringify(plan);
  const conceptCopy = JSON.stringify(concept);
  const scriptCopy = JSON.stringify(script);
  const visualCopy = JSON.stringify(visual);
  const dry = runOpenAIStoryboardDryRun(brief, plan, concept, script, visual, {
    env: smokeMatrix,
    pricing: createEnvAiTokenPricing(smokeMatrix),
  });
  assert.equal(typeof dry.reasoningEffort, "string");
  assert.ok(dry.maxOutputTokens > 0);
  assert.equal(JSON.stringify(plan), planCopy);
  assert.equal(JSON.stringify(concept), conceptCopy);
  assert.equal(JSON.stringify(script), scriptCopy);
  assert.equal(JSON.stringify(visual), visualCopy);
});

test("Production-pattern knobs yield 12¢ output share at 500/3000 price book", () => {
  const dry = runOpenAIStoryboardDryRun(brief, plan, concept, script, visual, {
    env: smokeMatrix,
    pricing: createEnvAiTokenPricing(smokeMatrix),
  });
  const book = createEnvAiTokenPricing(smokeMatrix).getPriceBook(dry.model)!;
  const outShare = Math.floor(
    (dry.maxOutputTokens * book.outputPerMillionMinor) / 1_000_000
  );
  assert.equal(outShare, 12);
});

test("code-default Storyboard knobs (terra/3200) are distinct from Production pattern", () => {
  const codeDefaultEnv = {
    ...smokeMatrix,
    OPENAI_STORYBOARD_MODEL: "gpt-5.6-terra",
    OPENAI_STORYBOARD_REASONING_EFFORT: "low",
    OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS: "3200",
  };
  const dry = runOpenAIStoryboardDryRun(brief, plan, concept, script, visual, {
    env: codeDefaultEnv,
    pricing: createEnvAiTokenPricing(codeDefaultEnv),
  });
  const book = createEnvAiTokenPricing(codeDefaultEnv).getPriceBook(dry.model)!;
  const outShare = Math.floor(
    (dry.maxOutputTokens * book.outputPerMillionMinor) / 1_000_000
  );
  assert.equal(dry.model, "gpt-5.6-terra");
  assert.equal(dry.maxOutputTokens, 3200);
  assert.equal(outShare, 9);
});

test("fixture chain covers five script segments aligned with VisualDirection", () => {
  assert.equal(script.segments.length, 5);
  assert.equal(visual.segments.length, 5);
  const covered = new Set(visual.segments.map((s) => s.scriptSegmentId));
  for (const seg of script.segments) {
    assert.ok(covered.has(seg.id), `visual missing script segment ${seg.id}`);
  }
});

test("Zod candidate OK can still fail métier validation (coverage)", () => {
  const candidate = makeValidStoryboardCandidate(script, visual);
  candidate.scenes[0]!.scriptSegmentId = "ghost-segment-id";
  const zod = StoryboardAnalysisCandidateSchema.safeParse(candidate);
  assert.equal(zod.success, true);
  const { issues } = validateCandidateAgainstSources(
    candidate,
    brief,
    plan,
    concept,
    script,
    visual,
  );
  assert.ok(issues.some((i) => i.code === "coverage_violation"));
});

test("Storyboard execute with PREP-off flags fails before analyzer", async () => {
  let analyzeCalls = 0;
  const analyzer: StoryboardAnalyzerPort = {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
    correlationId: "corr-project",
  };
  const now = new Date().toISOString();
  const projects: ProjectRepository = {
    async create() {},
    async load(id) {
      return id === PID ? project : null;
    },
    async saveStatus() {
      return project;
    },
  };
  const artifacts: ArtifactRepository = {
    async append() {},
    async getActive(_projectId, type) {
      const map = {
        video_project_brief: {
          projectId: PID,
          artifactType: "video_project_brief" as const,
          artifactId: BID,
          revision: 1,
          updatedAt: now,
          updatedBy: "test",
        },
        marketing_plan: {
          projectId: PID,
          artifactType: "marketing_plan" as const,
          artifactId: MID,
          revision: 1,
          updatedAt: now,
          updatedBy: "test",
        },
        creative_concept: {
          projectId: PID,
          artifactType: "creative_concept" as const,
          artifactId: CID,
          revision: 1,
          updatedAt: now,
          updatedBy: "test",
        },
        video_script: {
          projectId: PID,
          artifactType: "video_script" as const,
          artifactId: SID,
          revision: 1,
          updatedAt: now,
          updatedBy: "test",
        },
        visual_direction: {
          projectId: PID,
          artifactType: "visual_direction" as const,
          artifactId: VID,
          revision: 1,
          updatedAt: now,
          updatedBy: "test",
        },
      };
      return map[type as keyof typeof map] ?? null;
    },
    async load(id) {
      const values: Record<string, unknown> = {
        [BID]: brief,
        [MID]: plan,
        [CID]: concept,
        [SID]: script,
        [VID]: visual,
      };
      if (!values[id]) return null;
      const artifactType =
        id === BID
          ? ("video_project_brief" as const)
          : id === MID
            ? ("marketing_plan" as const)
            : id === CID
              ? ("creative_concept" as const)
              : id === SID
                ? ("video_script" as const)
                : ("visual_direction" as const);
      return {
        id,
        workspaceId: WS,
        projectId: PID,
        artifactType,
        revision: 1,
        schemaVersion: "1.0.0",
        parentRevisionId: null,
        value: values[id],
        createdBy: "test",
        correlationId: "corr",
        createdAt: now,
      } satisfies PersistedArtifact;
    },
    async loadByRevision() {
      return null;
    },
    async setActive() {
      throw new Error("unused");
    },
  };
  const directorRuns: StoryboardDirectorRunPort = {
    async beginOrGet() {
      throw new Error("must not begin");
    },
    async reserveBudget() {},
    async persistStoryboardProject() {
      throw new Error("unused");
    },
    async failRun() {},
    async loadActiveStoryboardProject() {
      return null;
    },
  };
  const svc = createAnalyzeStoryboardForProject({
    workspaceId: WS,
    projects,
    artifacts,
    directorRuns,
    analyzer,
    pricing: createEnvAiTokenPricing(smokeMatrix),
    env: prepOffMatrix,
  });
  const r = await svc.execute(
    { projectId: PID, expectedVisualDirectionRevision: 1 },
    { correlationId: "corr-10f-prep", mode: "execute" }
  );
  assert.equal(r.status, "failed");
  assert.equal(analyzeCalls, 0);
});

test("application dry-run exposes provider/knobs/idempotency without provider call", async () => {
  const analyzer: StoryboardAnalyzerPort = {
    async analyze() {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
    correlationId: "corr-project",
  };
  const now = new Date().toISOString();
  const projects: ProjectRepository = {
    async create() {},
    async load(id) {
      return id === PID ? project : null;
    },
    async saveStatus() {
      return project;
    },
  };
  const artifacts: ArtifactRepository = {
    async append() {},
    async getActive(_projectId, type) {
      const map = {
        video_project_brief: {
          projectId: PID,
          artifactType: "video_project_brief" as const,
          artifactId: BID,
          revision: 1,
          updatedAt: now,
          updatedBy: "test",
        },
        marketing_plan: {
          projectId: PID,
          artifactType: "marketing_plan" as const,
          artifactId: MID,
          revision: 1,
          updatedAt: now,
          updatedBy: "test",
        },
        creative_concept: {
          projectId: PID,
          artifactType: "creative_concept" as const,
          artifactId: CID,
          revision: 1,
          updatedAt: now,
          updatedBy: "test",
        },
        video_script: {
          projectId: PID,
          artifactType: "video_script" as const,
          artifactId: SID,
          revision: 1,
          updatedAt: now,
          updatedBy: "test",
        },
        visual_direction: {
          projectId: PID,
          artifactType: "visual_direction" as const,
          artifactId: VID,
          revision: 1,
          updatedAt: now,
          updatedBy: "test",
        },
      };
      return map[type as keyof typeof map] ?? null;
    },
    async load(id) {
      const values: Record<string, unknown> = {
        [BID]: brief,
        [MID]: plan,
        [CID]: concept,
        [SID]: script,
        [VID]: visual,
      };
      if (!values[id]) return null;
      const artifactType =
        id === BID
          ? ("video_project_brief" as const)
          : id === MID
            ? ("marketing_plan" as const)
            : id === CID
              ? ("creative_concept" as const)
              : id === SID
                ? ("video_script" as const)
                : ("visual_direction" as const);
      return {
        id,
        workspaceId: WS,
        projectId: PID,
        artifactType,
        revision: 1,
        schemaVersion: "1.0.0",
        parentRevisionId: null,
        value: values[id],
        createdBy: "test",
        correlationId: "corr",
        createdAt: now,
      } satisfies PersistedArtifact;
    },
    async loadByRevision() {
      return null;
    },
    async setActive() {
      throw new Error("unused");
    },
  };
  const directorRuns: StoryboardDirectorRunPort = {
    async beginOrGet() {
      throw new Error("must not begin");
    },
    async reserveBudget() {},
    async persistStoryboardProject() {
      throw new Error("unused");
    },
    async failRun() {},
    async loadActiveStoryboardProject() {
      return null;
    },
  };
  const svc = createAnalyzeStoryboardForProject({
    workspaceId: WS,
    projects,
    artifacts,
    directorRuns,
    analyzer,
    pricing: createEnvAiTokenPricing(smokeMatrix),
    env: {
      ...smokeMatrix,
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    },
  });
  const dry = await svc.dryRun(
    { projectId: PID },
    { correlationId: "corr-10f-dry", mode: "dry-run" }
  );
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.provider, "openai");
  assert.equal(dry.model, "gpt-5.6");
  assert.equal(dry.reasoningEffort, "medium");
  assert.equal(dry.maxOutputTokens, 4096);
  assert.equal(dry.promptVersion, "storyboard-analyzer-v2");
  assert.equal(dry.schemaVersion, "1.0.0");
  assert.equal(dry.idempotencyKeyVersion, "storyboard-analyzer-v2:1.0.0");
  assert.equal(dry.existingStoryboard, undefined);
});
