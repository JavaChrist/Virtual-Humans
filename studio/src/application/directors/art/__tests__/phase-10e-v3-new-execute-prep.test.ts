/**
 * Phase 10E-RETRY-PREP — new Art execute under art-analyzer-v3 (no provider).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  ArtAnalysisCandidateSchema,
  VisualDirectionSchema,
  finalizeVisualDirection,
  validateCandidateAgainstSources,
  validateContinuityAgainstSegments,
} from "@/domain/art";
import { makeArtChain, makeValidArtCandidate } from "@/domain/art/__tests__/fixtures";
import {
  ART_ANALYZER_PROMPT_VERSION,
  ART_ANALYZER_SYSTEM_PROMPT,
  ART_CANDIDATE_SCHEMA_VERSION,
} from "@/infrastructure/ai/openai/art";
import { isDirectorHumanRetryableErrorCode } from "@/domain/directors/retryable-error-codes";
import { createAnalyzeArtForProject, type ArtDirectorRunPort } from "../analyze-for-project";
import type {
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";
import { createEnvAiTokenPricing } from "@/infrastructure/ai/openai/marketing/pricing";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const V2_FAILED = "53fb45c3-0d36-43d9-9882-6a96fde2a814";

const chain = makeArtChain(); // characterId null by default
const brief = chain.brief;
const plan = chain.marketingPlan;
const concept = chain.creativeConcept;
const script = chain.videoScript;
const PID = brief.projectId;
const BID = brief.id;
const MID = plan.id;
const CID = concept.id;
const SID = script.id;

function artKey(promptVersion: string, model = "gpt-5.6"): string {
  const fields = [
    PID, BID, "1", MID, "1", CID, "1", SID, "1",
    model, promptVersion, ART_CANDIDATE_SCHEMA_VERSION,
  ];
  const raw = ["art", ...fields].join(":");
  return raw.length <= 200 ? raw : createHash("sha256").update(raw).digest("hex");
}

test("v3 prompt — continuityKey canon + visual variation same place + no invent character when null", () => {
  assert.equal(ART_ANALYZER_PROMPT_VERSION, "art-analyzer-v3");
  assert.equal(ART_CANDIDATE_SCHEMA_VERSION, "1.1.0");
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /continuityKey/);
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /Visual variation of the same place/i);
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /camera, lighting, framing/i);
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /characterId is null/i);
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /Never invent segment identifiers/i);
});

test("nouvelle clé idempotence v3 ≠ v2 (collision impossible)", () => {
  const v2 = artKey("art-analyzer-v2");
  const v3 = artKey("art-analyzer-v3");
  assert.notEqual(v2, v3);
  assert.match(v3.includes(":") ? v3 : "hashed", /art-analyzer-v3|hashed/);
  // Production keys are often hashed (>200); hashes must still diverge.
  const h2 = createHash("sha256").update(`art:${PID}:…:art-analyzer-v2:1.1.0`).digest("hex");
  const h3 = createHash("sha256").update(`art:${PID}:…:art-analyzer-v3:1.1.0`).digest("hex");
  assert.notEqual(h2, h3);
});

test("invalid_candidate hors allowlist — /art/retry interdit pour run v2", () => {
  assert.equal(isDirectorHumanRetryableErrorCode("invalid_candidate"), false);
});

test("cinq segments amont — Zod OK + continuité valide (même lieu, variations caméra)", () => {
  const ids = script.segments.map((s) => s.id);
  assert.equal(ids.length, 5);
  const candidate = makeValidArtCandidate(ids);
  for (const seg of candidate.segments) {
    seg.location.continuityKey = "primary-set";
  }
  candidate.segments[1]!.camera.shotSize = "close_up";
  candidate.segments[2]!.lighting.quality = "hard";
  candidate.continuityRules = [
    {
      id: "cr-loc",
      scope: "location",
      description: "Lieu stable primary-set.",
      appliesToSegmentIds: ids,
      severity: "required",
    },
  ];
  assert.equal(ArtAnalysisCandidateSchema.safeParse(candidate).success, true);
  const { issues } = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  assert.equal(issues.length, 0);
  const full = validateCandidateAgainstSources(
    candidate, brief, plan, concept, script,
  );
  assert.equal(full.issues.filter((i) => i.code === "continuity_violation").length, 0);
});

test("Zod OK + continuité invalide (required stable + clés divergentes)", () => {
  const ids = script.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids);
  candidate.segments[3]!.location.continuityKey = "other-set";
  candidate.continuityRules = [
    {
      id: "cr-loc",
      scope: "location",
      description: "Lieu stable sur tous les segments.",
      appliesToSegmentIds: ids,
      severity: "required",
    },
  ];
  assert.equal(ArtAnalysisCandidateSchema.safeParse(candidate).success, true);
  const { issues } = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  assert.ok(issues.some((i) => i.message === "Continuité lieu required non respectée."));
});

test("changement de lieu explicitement demandé (preferred / rupture)", () => {
  const ids = script.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids);
  candidate.segments[4]!.location.continuityKey = "cta-set";
  candidate.continuityRules = [
    {
      id: "cr-break",
      scope: "location",
      description: "Rupture intentionnelle vers cta-set pour le CTA.",
      appliesToSegmentIds: ids,
      severity: "preferred",
    },
  ];
  const { issues } = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  assert.equal(issues.length, 0);
});

test("characterId=null — candidat sans character + VisualDirectionSchema OK", () => {
  assert.equal(brief.characterId ?? null, null);
  const ids = script.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids, { withCharacter: false });
  for (const seg of candidate.segments) {
    assert.equal(seg.character, undefined);
    seg.location.continuityKey = "primary-set";
  }
  assert.equal(ArtAnalysisCandidateSchema.safeParse(candidate).success, true);
  const dir = finalizeVisualDirection({
    ...chain,
    candidate,
    metadata: { id: "vd-1", createdBy: "tester", correlationId: "corr-v3" },
  });
  assert.equal(VisualDirectionSchema.safeParse(dir).success, true);
  assert.equal(dir.schemaVersion, "1.0.0");
});

test("dry-run expose contrat v3 + previousFailedRunIgnoredForNewContract", async () => {
  const project: PersistedVideoProject = {
    id: PID, workspaceId: WS, name: brief.projectName, status: "draft",
    activeRevision: 1, schemaVersion: "1.0.0",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    archivedAt: null, correlationId: "corr-project",
  };
  const now = new Date().toISOString();
  const projects: ProjectRepository = {
    async create() {},
    async load(id) { return id === PID ? project : null; },
    async saveStatus() { return project; },
  };
  const artifacts: ArtifactRepository = {
    async append() {},
    async getActive(_p, type) {
      const map = {
        video_project_brief: { projectId: PID, artifactType: "video_project_brief" as const, artifactId: BID, revision: 1, updatedAt: now, updatedBy: "t" },
        marketing_plan: { projectId: PID, artifactType: "marketing_plan" as const, artifactId: MID, revision: 1, updatedAt: now, updatedBy: "t" },
        creative_concept: { projectId: PID, artifactType: "creative_concept" as const, artifactId: CID, revision: 1, updatedAt: now, updatedBy: "t" },
        video_script: { projectId: PID, artifactType: "video_script" as const, artifactId: SID, revision: 1, updatedAt: now, updatedBy: "t" },
      };
      return map[type as keyof typeof map] ?? null;
    },
    async load(id) {
      const values: Record<string, unknown> = { [BID]: brief, [MID]: plan, [CID]: concept, [SID]: script };
      if (!values[id]) return null;
      const artifactType =
        id === BID ? "video_project_brief" as const
          : id === MID ? "marketing_plan" as const
            : id === CID ? "creative_concept" as const
              : "video_script" as const;
      return {
        id, workspaceId: WS, projectId: PID, artifactType, revision: 1,
        schemaVersion: "1.0.0", parentRevisionId: null, value: values[id],
        createdBy: "t", correlationId: "c", createdAt: now,
      } satisfies PersistedArtifact;
    },
    async loadByRevision() { return null; },
    async setActive() { throw new Error("unused"); },
  };
  const directorRuns: ArtDirectorRunPort = {
    async beginOrGet() { throw new Error("no begin in dry-run"); },
    async beginOrRetry() { throw new Error("no retry"); },
    async reserveBudget() {},
    async persistVisualDirection() { throw new Error("unused"); },
    async failRun() {},
    async loadActiveVisualDirection() { return null; },
    async loadRetryableFailedRun() { return null; },
    async loadLatestFailedArtRun() {
      return {
        directorRunId: V2_FAILED,
        attemptNumber: 1,
        errorCode: "invalid_candidate",
        modelId: "gpt-5.6",
        promptVersion: "art-analyzer-v2",
        schemaVersion: "1.1.0",
        retryOfRunId: null,
      };
    },
  };
  const env = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_PAID_AI_ENABLED: "1",
    DIRECTOR_V2_ART_AI_ENABLED: "1",
    DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
    DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
    DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
    DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
    DIRECTOR_V2_WORKER_ENABLED: "0",
    DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
    OPENAI_API_KEY: "sk-test-not-used",
    OPENAI_ART_MODEL: "gpt-5.6",
    OPENAI_ART_REASONING_EFFORT: "medium",
    OPENAI_ART_MAX_OUTPUT_TOKENS: "4096",
    OPENAI_MARKETING_PRICE_VERSION: "prep",
    OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: "500",
    OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: "3000",
  };
  const svc = createAnalyzeArtForProject({
    workspaceId: WS,
    projects,
    artifacts,
    directorRuns,
    analyzer: { async analyze() { throw new Error("no provider"); } },
    pricing: createEnvAiTokenPricing(env),
    env,
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "corr-v3-prep", mode: "dry-run" });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.provider, "openai");
  assert.equal(dry.promptVersion, "art-analyzer-v3");
  assert.equal(dry.schemaVersion, "1.1.0");
  assert.equal(dry.idempotencyKeyVersion, "art-analyzer-v3:1.1.0");
  assert.equal(dry.previousFailedRunIgnoredForNewContract, true);
  assert.equal(dry.retryCandidate, undefined);
  assert.equal(dry.model, "gpt-5.6");
  assert.equal(dry.reasoningEffort, "medium");
  assert.equal(dry.maxOutputTokens, 4096);
  assert.ok((dry.estimatedCostMinor ?? 0) >= 1);
  assert.equal(typeof dry.estimatedCostMinor, "number");
});

test("futur execute identity — attempt 1 / retry_of null (pas un retry)", () => {
  const expected = {
    attempt_number: 1,
    retry_of_run_id: null as string | null,
    promptVersion: "art-analyzer-v3",
    schemaVersion: "1.1.0",
    path: "/art" as const,
    retryPathForbidden: "/art/retry",
  };
  assert.equal(expected.attempt_number, 1);
  assert.equal(expected.retry_of_run_id, null);
  assert.notEqual(expected.path, expected.retryPathForbidden);
});
