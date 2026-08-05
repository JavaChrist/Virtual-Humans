import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeVisualDirection } from "@/domain/art";
import { makeArtChain, makeValidArtCandidate } from "@/domain/art/__tests__/fixtures";
import { makeValidStoryboardCandidate } from "@/domain/storyboard/__tests__/fixtures";
import type { StoryboardAnalyzerPort } from "../analyzer-port";
import { createAnalyzeStoryboardForProject, type StoryboardDirectorRunPort } from "../analyze-for-project";
import type { ArtifactRepository, PersistedArtifact, PersistedVideoProject } from "@/application/projects/ports";
import type { AiTokenPricingPort } from "@/infrastructure/ai/openai/marketing/pricing";
import { MarketingAnalyzerError, marketingFailure } from "@/application/directors/marketing/failures";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const artChain = makeArtChain();
const { brief, marketingPlan, creativeConcept, videoScript } = artChain;
const visualDirection = finalizeVisualDirection({
  brief, marketingPlan, creativeConcept, videoScript,
  candidate: makeValidArtCandidate(videoScript.segments.map((s) => s.id)),
  metadata: { id: "vd-test-1", createdBy: "tester", correlationId: "corr-vd-test" },
});
const PID = brief.projectId;
const BID = brief.id; const MID = marketingPlan.id; const CID = creativeConcept.id;
const SID = videoScript.id; const VID = visualDirection.id;

const project: PersistedVideoProject = {
  id: PID, workspaceId: WS, name: brief.projectName, status: "draft", activeRevision: 1,
  schemaVersion: "1.0.0", createdAt: "2026-08-03T12:00:00.000Z", updatedAt: "2026-08-03T12:00:00.000Z",
  archivedAt: null, correlationId: "corr-p",
};

function artifactsRepo(opts?: { visual?: boolean }): ArtifactRepository {
  const includeVisual = opts?.visual !== false;
  const arts: Record<string, PersistedArtifact> = {
    [BID]: { id: BID, workspaceId: WS, projectId: PID, artifactType: "video_project_brief", revision: 1, schemaVersion: "1.0.0", parentRevisionId: null, value: brief, createdAt: brief.createdAt, createdBy: "tester", correlationId: brief.correlationId },
    [MID]: { id: MID, workspaceId: WS, projectId: PID, artifactType: "marketing_plan", revision: 1, schemaVersion: "1.0.0", parentRevisionId: null, value: marketingPlan, createdAt: marketingPlan.createdAt, createdBy: "tester", correlationId: marketingPlan.correlationId },
    [CID]: { id: CID, workspaceId: WS, projectId: PID, artifactType: "creative_concept", revision: 1, schemaVersion: "1.0.0", parentRevisionId: null, value: creativeConcept, createdAt: creativeConcept.createdAt, createdBy: "tester", correlationId: creativeConcept.correlationId },
    [SID]: { id: SID, workspaceId: WS, projectId: PID, artifactType: "video_script", revision: 1, schemaVersion: "1.0.0", parentRevisionId: null, value: videoScript, createdAt: videoScript.createdAt, createdBy: "tester", correlationId: videoScript.correlationId },
    [VID]: { id: VID, workspaceId: WS, projectId: PID, artifactType: "visual_direction", revision: 1, schemaVersion: "1.0.0", parentRevisionId: null, value: visualDirection, createdAt: visualDirection.createdAt, createdBy: "tester", correlationId: visualDirection.correlationId },
  };
  return {
    append: async () => undefined,
    load: async (id) => arts[id] ?? null,
    loadByRevision: async () => arts[BID],
    getActive: async (_pid, type) => {
      const map: Record<string, { artifactId: string }> = {
        video_project_brief: { artifactId: BID },
        marketing_plan: { artifactId: MID },
        creative_concept: { artifactId: CID },
        video_script: { artifactId: SID },
        visual_direction: { artifactId: VID },
      };
      if (type === "visual_direction" && !includeVisual) return null;
      const entry = map[type];
      return entry ? { projectId: PID, artifactType: type, artifactId: entry.artifactId, revision: 1, updatedAt: "2026-08-03T12:00:00.000Z", updatedBy: "tester" } : null;
    },
    setActive: async () => ({ projectId: PID, artifactType: "video_project_brief", artifactId: BID, revision: 1, updatedAt: "2026-08-03T12:00:00.000Z", updatedBy: "tester" }),
  };
}

function directorPort(): StoryboardDirectorRunPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async beginOrGet() { calls.push("begin"); return { status: "created", directorRunId: "run-stb-1", revision: 1 }; },
    async reserveBudget() { calls.push("reserve"); },
    async persistStoryboardProject(input) { calls.push("persist"); return { status: "created", artifactId: input.artifactId, revision: 1 }; },
    async failRun() { calls.push("fail"); },
    async loadActiveStoryboardProject() { return null; },
  };
}

const enabledEnv = {
  DIRECTOR_V2_ENABLED: "1", DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "1", DIRECTOR_V2_PAID_AI_ENABLED: "1",
  OPENAI_API_KEY: "sk-test", OPENAI_STORYBOARD_MODEL: "gpt-5.6-terra",
};
const pricing: AiTokenPricingPort = {
  getPriceBook: () => ({ modelId: "gpt-5.6-terra", pricingVersion: "test-v1", currency: "USD", inputPerMillionMinor: 100, outputPerMillionMinor: 200, confidence: "medium" }),
};

test("storyboard dry-run — flags off", async () => {
  const svc = createAnalyzeStoryboardForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: directorPort(),
    analyzer: { async analyze() { return { candidate: makeValidStoryboardCandidate(videoScript, visualDirection) }; } },
    pricing, env: { ...enabledEnv, DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0" },
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c1", mode: "dry-run" });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executionAvailable, false);
});

test("storyboard dry-run — visual_direction absent", async () => {
  const svc = createAnalyzeStoryboardForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo({ visual: false }), directorRuns: directorPort(),
    analyzer: { async analyze() { return { candidate: makeValidStoryboardCandidate(videoScript, visualDirection) }; } }, pricing, env: enabledEnv,
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c2", mode: "dry-run" });
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "visual_direction_missing"));
});

test("storyboard execute — happy path", async () => {
  let calls = 0;
  const analyzer: StoryboardAnalyzerPort = {
    async analyze() { calls += 1; return { candidate: makeValidStoryboardCandidate(videoScript, visualDirection) }; },
  };
  const port = directorPort();
  const svc = createAnalyzeStoryboardForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port, analyzer, pricing, env: enabledEnv,
    idFactory: (() => { let n = 0; return () => { n += 1; return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`; }; })(),
  });
  const r = await svc.execute({ projectId: PID, expectedVisualDirectionRevision: 1 }, { correlationId: "c3", mode: "execute" });
  assert.equal(calls, 1);
  assert.ok(port.calls.includes("persist"));
  assert.equal(r.status, "completed");
});

test("storyboard execute — provider_failed", async () => {
  const port = directorPort();
  const svc = createAnalyzeStoryboardForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port,
    analyzer: { async analyze() { throw new MarketingAnalyzerError(marketingFailure("rate_limited")); } },
    pricing, env: enabledEnv, idFactory: () => "00000000-0000-4000-8000-000000000001",
  });
  const r = await svc.execute({ projectId: PID, expectedVisualDirectionRevision: 1 }, { correlationId: "c4", mode: "execute" });
  assert.equal(r.status, "failed");
  assert.equal(port.calls.includes("persist"), false);
});
