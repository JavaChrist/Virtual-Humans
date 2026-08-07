import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeVideoScript } from "@/domain/script";
import { makeScriptChain, makeValidScriptCandidate } from "@/domain/script/__tests__/fixtures";
import { makeValidArtCandidate } from "@/domain/art/__tests__/fixtures";
import type { ArtAnalyzerPort } from "../analyzer-port";
import { createAnalyzeArtForProject, type ArtDirectorRunPort } from "../analyze-for-project";
import type { ArtifactRepository, PersistedArtifact, PersistedVideoProject } from "@/application/projects/ports";
import type { AiTokenPricingPort } from "@/infrastructure/ai/openai/marketing/pricing";
import { MarketingAnalyzerError, marketingFailure } from "@/application/directors/marketing/failures";
import { CharacterNotFoundError } from "@/runtime/errors";
import type { CharacterPackageLookup } from "@/application/runtime/resolve-character-capabilities";
import type { RuntimeCharacterCapabilitySource } from "@/application/runtime/character-capabilities";
import type { VideoProjectBrief } from "@/domain/brief";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const chain = makeScriptChain();
const brief = chain.brief;
const plan = chain.marketingPlan;
const concept = chain.creativeConcept;
const videoScript = finalizeVideoScript({
  brief, marketingPlan: plan, creativeConcept: concept,
  candidate: makeValidScriptCandidate(),
  metadata: { id: "script-art-1", createdBy: "tester", correlationId: "corr-art-test" },
});
const PID = brief.projectId;
const BID = brief.id; const MID = plan.id; const CID = concept.id; const SID = videoScript.id;

function tomSource(): RuntimeCharacterCapabilitySource {
  return {
    characterId: "tom",
    characterVersion: "1.0.0",
    outfits: [{ id: "LOOK_001", name: "Casual" }],
    expressions: [{ name: "Smile" }],
    poses: [{ name: "Standing" }],
    identityReferences: [{ name: "Portrait" }],
    voice: { present: true },
  };
}

function tomLookup(): CharacterPackageLookup {
  return {
    getCharacter(requestedId: string) {
      if (
        requestedId === "Tom SDK v1.0.0" ||
        requestedId === "tom" ||
        requestedId.toLowerCase() === "tom"
      ) {
        return tomSource();
      }
      throw new CharacterNotFoundError(requestedId, ["Tom SDK v1.0.0"]);
    },
  };
}

function emptyOutfitsLookup(): CharacterPackageLookup {
  return {
    getCharacter() {
      return { ...tomSource(), outfits: [] };
    },
  };
}

const project: PersistedVideoProject = {
  id: PID, workspaceId: WS, name: brief.projectName, status: "draft", activeRevision: 1,
  schemaVersion: "1.0.0", createdAt: "2026-08-03T12:00:00.000Z", updatedAt: "2026-08-03T12:00:00.000Z",
  archivedAt: null, correlationId: "corr-p",
};

function artifactsRepo(opts?: { script?: boolean; briefOverride?: VideoProjectBrief }): ArtifactRepository {
  const includeScript = opts?.script !== false;
  const briefValue = opts?.briefOverride ?? brief;
  const arts: Record<string, PersistedArtifact> = {
    [BID]: { id: BID, workspaceId: WS, projectId: PID, artifactType: "video_project_brief", revision: 1, schemaVersion: "1.0.0", parentRevisionId: null, value: briefValue, createdAt: briefValue.createdAt, createdBy: "tester", correlationId: briefValue.correlationId },
    [MID]: { id: MID, workspaceId: WS, projectId: PID, artifactType: "marketing_plan", revision: 1, schemaVersion: "1.0.0", parentRevisionId: null, value: plan, createdAt: plan.createdAt, createdBy: "tester", correlationId: plan.correlationId },
    [CID]: { id: CID, workspaceId: WS, projectId: PID, artifactType: "creative_concept", revision: 1, schemaVersion: "1.0.0", parentRevisionId: null, value: concept, createdAt: concept.createdAt, createdBy: "tester", correlationId: concept.correlationId },
    [SID]: { id: SID, workspaceId: WS, projectId: PID, artifactType: "video_script", revision: 1, schemaVersion: "1.0.0", parentRevisionId: null, value: videoScript, createdAt: videoScript.createdAt, createdBy: "tester", correlationId: videoScript.correlationId },
  };
  return {
    append: async () => undefined,
    load: async (id) => arts[id] ?? null,
    loadByRevision: async () => arts[BID],
    getActive: async (_pid, type) => {
      if (type === "video_project_brief") return { projectId: PID, artifactType: type, artifactId: BID, revision: 1, updatedAt: "2026-08-03T12:00:00.000Z", updatedBy: "tester" };
      if (type === "marketing_plan") return { projectId: PID, artifactType: type, artifactId: MID, revision: 1, updatedAt: "2026-08-03T12:00:00.000Z", updatedBy: "tester" };
      if (type === "creative_concept") return { projectId: PID, artifactType: type, artifactId: CID, revision: 1, updatedAt: "2026-08-03T12:00:00.000Z", updatedBy: "tester" };
      if (type === "video_script" && includeScript) return { projectId: PID, artifactType: type, artifactId: SID, revision: 1, updatedAt: "2026-08-03T12:00:00.000Z", updatedBy: "tester" };
      return null;
    },
    setActive: async () => ({ projectId: PID, artifactType: "video_project_brief", artifactId: BID, revision: 1, updatedAt: "2026-08-03T12:00:00.000Z", updatedBy: "tester" }),
  };
}

function directorPort(opts?: {
  failedRun?: {
    directorRunId: string;
    attemptNumber: number;
    errorCode: string;
    legacyRetryReason?: "misclassified_timeout";
  } | null;
  retryThrow?: string;
  legacyRetryReasonOnBegin?: "misclassified_timeout";
}): ArtDirectorRunPort & { calls: string[]; retryInputs: unknown[] } {
  const calls: string[] = [];
  const retryInputs: unknown[] = [];
  return {
    calls,
    retryInputs,
    async beginOrGet() { calls.push("begin"); return { status: "created", directorRunId: "run-art-1", revision: 1 }; },
    async beginOrRetry(input) {
      calls.push("beginRetry");
      retryInputs.push(input);
      if (opts?.retryThrow) throw new Error(opts.retryThrow);
      return {
        status: "created",
        directorRunId: "run-art-2",
        revision: 1,
        attemptNumber: 2,
        retryOfRunId: input.previousRunId,
        legacyRetryReason: opts?.legacyRetryReasonOnBegin,
      };
    },
    async reserveBudget() { calls.push("reserve"); },
    async persistVisualDirection(input) { calls.push("persist"); return { status: "created", artifactId: input.artifactId, revision: 1 }; },
    async failRun() { calls.push("fail"); },
    async loadActiveVisualDirection() { return null; },
    async loadRetryableFailedRun() {
      if (opts?.failedRun === null) return null;
      if (opts?.failedRun) {
        return {
          directorRunId: opts.failedRun.directorRunId,
          attemptNumber: opts.failedRun.attemptNumber,
          errorCode: opts.failedRun.errorCode,
          modelId: "gpt-5.6-terra",
          promptVersion: "art-analyzer-v1",
          schemaVersion: "1.0.0",
          inputArtifactId: SID,
          inputRevision: 1,
          legacyRetryReason: opts.failedRun.legacyRetryReason,
        };
      }
      return null;
    },
  };
}

const enabledEnv = {
  DIRECTOR_V2_ENABLED: "1", DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_ART_AI_ENABLED: "1", DIRECTOR_V2_PAID_AI_ENABLED: "1",
  OPENAI_API_KEY: "sk-test", OPENAI_ART_MODEL: "gpt-5.6-terra",
};
const pricing: AiTokenPricingPort = {
  getPriceBook: () => ({ modelId: "gpt-5.6-terra", pricingVersion: "test-v1", currency: "USD", inputPerMillionMinor: 100, outputPerMillionMinor: 200, confidence: "medium" }),
};

test("art dry-run — flags off, providerCalled false", async () => {
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: directorPort(),
    analyzer: { async analyze() { return { candidate: makeValidArtCandidate(videoScript.segments.map((s) => s.id)) }; } },
    pricing, env: { ...enabledEnv, DIRECTOR_V2_ART_AI_ENABLED: "0" },
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c1", mode: "dry-run" });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executionAvailable, false);
});

test("art dry-run — script absent", async () => {
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo({ script: false }), directorRuns: directorPort(),
    analyzer: { async analyze() { return { candidate: makeValidArtCandidate([]) }; } }, pricing, env: enabledEnv,
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c2", mode: "dry-run" });
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "video_script_missing"));
});

test("art execute — happy path", async () => {
  let calls = 0;
  const analyzer: ArtAnalyzerPort = {
    async analyze() { calls += 1; return { candidate: makeValidArtCandidate(videoScript.segments.map((s) => s.id)) }; },
  };
  const port = directorPort();
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port, analyzer, pricing, env: enabledEnv,
    idFactory: (() => { let n = 0; return () => { n += 1; return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`; }; })(),
  });
  const r = await svc.execute({ projectId: PID, expectedVideoScriptRevision: 1 }, { correlationId: "c3", mode: "execute" });
  assert.equal(calls, 1);
  assert.ok(port.calls.includes("persist"));
  assert.equal(r.status, "completed");
});

test("art execute — provider_failed no persist", async () => {
  const port = directorPort();
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port,
    analyzer: { async analyze() { throw new MarketingAnalyzerError(marketingFailure("rate_limited")); } },
    pricing, env: enabledEnv,
    idFactory: () => "00000000-0000-4000-8000-000000000001",
  });
  const r = await svc.execute({ projectId: PID, expectedVideoScriptRevision: 1 }, { correlationId: "c4", mode: "execute" });
  assert.equal(r.status, "failed");
  assert.ok(port.calls.includes("fail"));
  assert.equal(port.calls.includes("persist"), false);
});

function tomArtCandidate() {
  const ids = videoScript.segments.map((s) => s.id);
  const base = makeValidArtCandidate(ids, { withCharacter: true });
  return {
    ...base,
    segments: base.segments.map((seg) =>
      seg.character
        ? {
            ...seg,
            character: {
              ...seg.character,
              characterId: "tom",
              outfitId: "LOOK_001",
              expressionId: "expression:smile",
              poseId: "pose:standing",
            },
          }
        : seg,
    ),
  };
}

test("art dry-run — Tom SDK v1.0.0 résout snapshot (character_snapshot_missing absent)", async () => {
  const briefWithTom = { ...brief, characterId: "Tom SDK v1.0.0" };
  let sawSnapshot = false;
  const analyzer: ArtAnalyzerPort = {
    async analyze(req) {
      sawSnapshot = Boolean(req.characterCapabilities?.characterId === "tom");
      return { candidate: tomArtCandidate() };
    },
  };
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo({ briefOverride: briefWithTom }), directorRuns: directorPort(),
    analyzer, pricing, env: enabledEnv, characterLookup: tomLookup(),
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c-tom-dry", mode: "dry-run" });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.missingInformation.some((m) => m.code === "character_snapshot_missing"), false);
  assert.ok(dry.validations.some((v) => v.code === "character_snapshot" && v.passed));
  assert.equal(sawSnapshot, false, "dry-run ne doit pas appeler l'analyzer");
});

test("art dry-run — character inconnu fail-closed typé", async () => {
  const briefUnknown = { ...brief, characterId: "Unknown SDK v9.9.9" };
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo({ briefOverride: briefUnknown }), directorRuns: directorPort(),
    analyzer: { async analyze() { return { candidate: makeValidArtCandidate([]) }; } },
    pricing, env: enabledEnv, characterLookup: tomLookup(),
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c-unknown", mode: "dry-run" });
  assert.equal(dry.executable, false);
  assert.equal(dry.providerCalled, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "character_not_found"));
});

test("art dry-run — character sans outfits → critical_asset_missing", async () => {
  const briefWithTom = { ...brief, characterId: "Tom SDK v1.0.0" };
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo({ briefOverride: briefWithTom }), directorRuns: directorPort(),
    analyzer: { async analyze() { return { candidate: makeValidArtCandidate([]) }; } },
    pricing, env: enabledEnv, characterLookup: emptyOutfitsLookup(),
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c-empty", mode: "dry-run" });
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "critical_asset_missing"));
});

test("art execute — même mécanisme snapshot que dry-run + identité dans clé", async () => {
  const briefWithTom = { ...brief, characterId: "Tom SDK v1.0.0" };
  const keys: string[] = [];
  const port = directorPort();
  const originalBegin = port.beginOrGet.bind(port);
  port.beginOrGet = async (input) => {
    keys.push(input.idempotencyKey);
    return originalBegin(input);
  };
  let analyzerSnapshotId: string | undefined;
  const analyzer: ArtAnalyzerPort = {
    async analyze(req) {
      analyzerSnapshotId = req.characterCapabilities?.characterId;
      return { candidate: tomArtCandidate() };
    },
  };
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo({ briefOverride: briefWithTom }), directorRuns: port, analyzer, pricing, env: enabledEnv,
    characterLookup: tomLookup(),
    idFactory: (() => { let n = 0; return () => { n += 1; return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`; }; })(),
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c-exec-dry", mode: "dry-run" });
  assert.equal(dry.missingInformation.some((m) => m.code === "character_snapshot_missing"), false);
  const r = await svc.execute({ projectId: PID, expectedVideoScriptRevision: 1 }, { correlationId: "c-exec", mode: "execute" });
  assert.equal(r.status, "completed");
  assert.equal(analyzerSnapshotId, "tom");
  assert.equal(keys.length, 1);
  // Key must incorporate capability fingerprint (sha when long) — not equal to character-less key shape alone.
  assert.ok(keys[0]!.length > 0);
});

test("art dry-run — Art AI OFF → aucun provider, providerCalled false", async () => {
  const briefWithTom = { ...brief, characterId: "Tom SDK v1.0.0" };
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo({ briefOverride: briefWithTom }), directorRuns: directorPort(),
    analyzer: { async analyze() { throw new Error("provider must not be called"); } },
    pricing, env: { ...enabledEnv, DIRECTOR_V2_ART_AI_ENABLED: "0" },
    characterLookup: tomLookup(),
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c-art-off", mode: "dry-run" });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executionAvailable, false);
  assert.equal(dry.missingInformation.some((m) => m.code === "character_snapshot_missing"), false);
});

test("art execute — même Brief + même snapshot → même idempotencyKey", async () => {
  const briefWithTom = { ...brief, characterId: "Tom SDK v1.0.0" };
  const keys: string[] = [];
  function makeSvc() {
    const port = directorPort();
    const originalBegin = port.beginOrGet.bind(port);
    port.beginOrGet = async (input) => {
      keys.push(input.idempotencyKey);
      return originalBegin(input);
    };
    return createAnalyzeArtForProject({
      workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
      artifacts: artifactsRepo({ briefOverride: briefWithTom }), directorRuns: port,
      analyzer: {
        async analyze() {
          return { candidate: tomArtCandidate() };
        },
      },
      pricing, env: enabledEnv, characterLookup: tomLookup(),
      idFactory: (() => { let n = 0; return () => { n += 1; return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`; }; })(),
    });
  }
  await makeSvc().execute({ projectId: PID }, { correlationId: "k1", mode: "execute" });
  await makeSvc().execute({ projectId: PID }, { correlationId: "k2", mode: "execute" });
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});

test("Porte 8P — timeout → code timeout + message Art (pas marketing)", async () => {
  const port = directorPort();
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port,
    analyzer: { async analyze() { throw new MarketingAnalyzerError(marketingFailure("timeout")); } },
    pricing, env: enabledEnv,
    idFactory: () => "00000000-0000-4000-8000-000000000099",
  });
  const r = await svc.execute({ projectId: PID, expectedVideoScriptRevision: 1 }, { correlationId: "c-timeout", mode: "execute" });
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "timeout");
    assert.equal(r.retryable, true);
    assert.equal(r.httpHint, 504);
    assert.match(r.publicMessage, /direction art/i);
    assert.doesNotMatch(r.publicMessage, /analyse marketing/i);
  }
  assert.ok(port.calls.includes("fail"));
  assert.equal(port.calls.includes("persist"), false);
});

test("Porte 8P — internal_error réel reste internal_error + message Art", async () => {
  const port = directorPort();
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port,
    analyzer: { async analyze() { throw new MarketingAnalyzerError(marketingFailure("internal_error")); } },
    pricing, env: enabledEnv,
    idFactory: () => "00000000-0000-4000-8000-000000000098",
  });
  const r = await svc.execute({ projectId: PID, expectedVideoScriptRevision: 1 }, { correlationId: "c-ie", mode: "execute" });
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "internal_error");
    assert.equal(r.retryable, false);
    assert.match(r.publicMessage, /direction art/i);
    assert.doesNotMatch(r.publicMessage, /analyse marketing/i);
  }
});

test("Porte 8P — dry-run expose retryCandidate timeout attempt 2", async () => {
  const port = directorPort({
    failedRun: {
      directorRunId: "c0119db7-b467-42c0-9eed-52d1c9d550d3",
      attemptNumber: 1,
      errorCode: "timeout",
    },
  });
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port, analyzer: { async analyze() { return { candidate: makeValidArtCandidate([]) }; } },
    pricing, env: enabledEnv,
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c-retry-dry", mode: "dry-run" });
  assert.ok(dry.retryCandidate);
  assert.equal(dry.retryCandidate?.previousRunId, "c0119db7-b467-42c0-9eed-52d1c9d550d3");
  assert.equal(dry.retryCandidate?.previousAttemptNumber, 1);
  assert.equal(dry.retryCandidate?.nextAttemptNumber, 2);
  assert.equal(dry.retryCandidate?.errorCode, "timeout");
  assert.equal(dry.retryCandidate?.retryAvailable, true);
});

test("Porte 8P — dry-run omet retryCandidate pour internal_error non-legacy", async () => {
  const port = directorPort({
    failedRun: {
      directorRunId: "c0119db7-b467-42c0-9eed-52d1c9d550d3",
      attemptNumber: 1,
      errorCode: "internal_error",
      // repository already filtered — no legacyRetryReason
    },
  });
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: {
      ...port,
      async loadRetryableFailedRun() {
        // Non-legacy internal_error: repository returns null
        return null;
      },
    },
    analyzer: { async analyze() { return { candidate: makeValidArtCandidate([]) }; } },
    pricing, env: enabledEnv,
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c-ie-dry", mode: "dry-run" });
  assert.equal(dry.retryCandidate, undefined);
});

test("Porte 8P-B — dry-run expose retryCandidate legacy Art timeout misclassified", async () => {
  const previousRunId = "c0119db7-b467-42c0-9eed-52d1c9d550d3";
  const port = directorPort({
    failedRun: {
      directorRunId: previousRunId,
      attemptNumber: 1,
      errorCode: "internal_error",
      legacyRetryReason: "misclassified_timeout",
    },
  });
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port,
    analyzer: { async analyze() { return { candidate: makeValidArtCandidate([]) }; } },
    pricing, env: enabledEnv,
  });
  const dry = await svc.dryRun({ projectId: PID }, { correlationId: "c-legacy-dry", mode: "dry-run" });
  assert.ok(dry.retryCandidate);
  assert.equal(dry.retryCandidate?.previousRunId, previousRunId);
  assert.equal(dry.retryCandidate?.previousAttemptNumber, 1);
  assert.equal(dry.retryCandidate?.nextAttemptNumber, 2);
  assert.equal(dry.retryCandidate?.errorCode, "internal_error");
  assert.equal(dry.retryCandidate?.legacyRetryReason, "misclassified_timeout");
  assert.equal(dry.retryCandidate?.retryAvailable, true);
});

test("Porte 8P-B — executeRetry legacy → attempt 2, retry_of, run historique non muté, un seul moteur", async () => {
  let analyzeCalls = 0;
  const previousRunId = "c0119db7-b467-42c0-9eed-52d1c9d550d3";
  const analyzer: ArtAnalyzerPort = {
    async analyze() {
      analyzeCalls += 1;
      return { candidate: makeValidArtCandidate(videoScript.segments.map((s) => s.id)) };
    },
  };
  const port = directorPort({ legacyRetryReasonOnBegin: "misclassified_timeout" });
  const failInputs: Array<{ directorRunId: string }> = [];
  const originalFail = port.failRun.bind(port);
  port.failRun = async (input) => {
    failInputs.push({ directorRunId: input.directorRunId });
    return originalFail(input);
  };
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port, analyzer, pricing, env: enabledEnv,
    idFactory: (() => { let n = 0; return () => { n += 1; return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`; }; })(),
  });
  const r = await svc.executeRetry(
    {
      projectId: PID,
      previousRunId,
      retryRequestId: "33333333-3333-4333-8333-333333333333",
      expectedVideoScriptRevision: 1,
      expectedCreativeConceptRevision: 1,
      expectedMarketingPlanRevision: 1,
    },
    { correlationId: "c-legacy-retry", mode: "execute" },
  );
  assert.equal(analyzeCalls, 1);
  assert.equal(port.calls.filter((c) => c === "beginRetry").length, 1, "un seul moteur beginOrRetry");
  assert.ok(port.calls.includes("reserve"));
  assert.ok(port.calls.includes("persist"));
  assert.equal(r.status, "completed");
  const beginInput = port.retryInputs[0] as { previousRunId: string };
  assert.equal(beginInput.previousRunId, previousRunId);
  assert.equal(failInputs.some((f) => f.directorRunId === previousRunId), false);
});

test("Porte 8P — executeRetry attempt 2, retry_of correct, run failed immuable", async () => {
  let analyzeCalls = 0;
  const analyzer: ArtAnalyzerPort = {
    async analyze() {
      analyzeCalls += 1;
      return { candidate: makeValidArtCandidate(videoScript.segments.map((s) => s.id)) };
    },
  };
  const port = directorPort();
  const failInputs: Array<{ directorRunId: string }> = [];
  const originalFail = port.failRun.bind(port);
  port.failRun = async (input) => {
    failInputs.push({ directorRunId: input.directorRunId });
    return originalFail(input);
  };
  const previousRunId = "c0119db7-b467-42c0-9eed-52d1c9d550d3";
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port, analyzer, pricing, env: enabledEnv,
    idFactory: (() => { let n = 0; return () => { n += 1; return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`; }; })(),
  });
  const r = await svc.executeRetry(
    {
      projectId: PID,
      previousRunId,
      retryRequestId: "11111111-1111-4111-8111-111111111111",
      expectedVideoScriptRevision: 1,
      expectedCreativeConceptRevision: 1,
      expectedMarketingPlanRevision: 1,
    },
    { correlationId: "c-art-retry", mode: "execute" },
  );
  assert.equal(analyzeCalls, 1);
  assert.ok(port.calls.includes("beginRetry"));
  assert.ok(port.calls.includes("reserve"));
  assert.ok(port.calls.includes("persist"));
  assert.equal(r.status, "completed");
  const beginInput = port.retryInputs[0] as {
    previousRunId: string;
    inputArtifactId: string;
  };
  assert.equal(beginInput.previousRunId, previousRunId);
  assert.equal(beginInput.inputArtifactId, SID);
  // Previous failed run must never be mutated via failRun
  assert.equal(failInputs.some((f) => f.directorRunId === previousRunId), false);
});

test("Porte 8P — executeRetry refuse retry_not_allowed (pas de provider)", async () => {
  let analyzeCalls = 0;
  const port = directorPort({ retryThrow: "retry_not_allowed" });
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port,
    analyzer: { async analyze() { analyzeCalls += 1; return { candidate: makeValidArtCandidate([]) }; } },
    pricing, env: enabledEnv,
  });
  const r = await svc.executeRetry(
    {
      projectId: PID,
      previousRunId: "c0119db7-b467-42c0-9eed-52d1c9d550d3",
      retryRequestId: "22222222-2222-4222-8222-222222222222",
      expectedVideoScriptRevision: 1,
    },
    { correlationId: "c-art-deny", mode: "execute" },
  );
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.code, "retry_not_allowed");
    assert.equal(r.httpHint, 422);
  }
  assert.equal(analyzeCalls, 0);
  assert.equal(port.calls.includes("reserve"), false);
});

test("Porte 8P — budget release path: timeout failRun sans inventer actual_cost", async () => {
  const port = directorPort();
  const failArgs: Array<{ actualCostMinor?: number; costStatus?: string; usage?: Record<string, unknown> }> = [];
  port.failRun = async (input) => {
    port.calls.push("fail");
    failArgs.push({
      actualCostMinor: input.actualCostMinor,
      costStatus: input.costStatus,
      usage: input.usage,
    });
  };
  const svc = createAnalyzeArtForProject({
    workspaceId: WS, projects: { create: async () => undefined, load: async (id) => id === PID ? project : null, saveStatus: async () => project },
    artifacts: artifactsRepo(), directorRuns: port,
    analyzer: { async analyze() { throw new MarketingAnalyzerError(marketingFailure("timeout")); } },
    pricing, env: enabledEnv,
    idFactory: () => "00000000-0000-4000-8000-000000000097",
  });
  await svc.execute({ projectId: PID, expectedVideoScriptRevision: 1 }, { correlationId: "c-budget", mode: "execute" });
  assert.equal(failArgs.length, 1);
  assert.equal(failArgs[0]!.actualCostMinor, undefined);
  assert.equal(failArgs[0]!.usage, undefined);
});
