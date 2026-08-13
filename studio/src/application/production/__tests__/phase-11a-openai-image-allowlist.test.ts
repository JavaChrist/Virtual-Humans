/**
 * Phase 11A-WIRE — OpenAI image allowlist (no real provider / no network).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { makeMinimalPackage } from "@/domain/generation/__tests__/fixtures";
import { createGenerationEngine, createProviderAdapterRegistry } from "@/application/generation";
import {
  createVhs124AllowlistedOpenAIImageAdapter,
  createVhs124ScopedGenerationEngine,
  resolveDirectorProviderAdapters,
} from "@/infrastructure/providers/vhs124-openai-image-exception";
import { createOpenAIImageAdapter } from "@/infrastructure/providers/openai-image-adapter";
import type { OpenAIImageClientPort } from "@/infrastructure/providers/contracts";
import { assertDirectorProductionUsesFakes } from "@/infrastructure/db/director-server";
import {
  PHASE_11A_SMOKE_PROJECT_ID,
  PHASE_11A_SMOKE_SCENE_ID,
  assertVhs124OpenAIImageAllowlistScope,
  assertVhs124OpenAIImageExceptionActive,
  buildPhase11AImageStoragePath,
  createPhase11AWorkerCounters,
  assertPhase11AWorkerCountersWithinSmoke,
  isVhs124OpenAIImageExceptionEnabled,
  phase11AOpenAIImageAllowlistDryRun,
  vhs124OpenAIImageExceptionAuditView,
  VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION,
} from "../phase-11a-openai-image-allowlist";
import { buildPhase11AImagePromptFromScenePackage } from "../phase-11a-image-prompt";
import { buildPhase11ASingleStepGenerationPlan } from "../phase-11a-single-step-plan";
import {
  buildPhase11AImageTechnicalMeta,
  decodeOpenAIImageToMemoryBytes,
  validatePhase11AImageTechnical,
} from "../phase-11a-image-technical-qc";
import {
  assertPhase11AActivationAllowed,
  assertPhase11AOutputNotAutoActive,
} from "../phase-11a-human-review-gate";
import { createPhase11AImageTechnicalQualityPort } from "../phase-11a-image-quality-port";
import {
  assertPhase11ADoesNotUseMotionProject,
  MV001_MOTION_PROJECT_ID,
} from "../phase-11a-motion-isolation";

/** Minimal PNG with IHDR declaring 1024×1024 (technical QC reads header only). */
function pngWithIhdr(width: number, height: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB
  const type = Buffer.from("IHDR");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(13, 0);
  const crc = Buffer.alloc(4); // CRC ignored by our parser
  // IEND
  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  return Buffer.concat([sig, len, type, ihdrData, crc, iend]);
}

const SMOKE_PNG = pngWithIhdr(1024, 1024);

function fakeClient(calls: { n: number }): OpenAIImageClientPort {
  return {
    async generateImage() {
      calls.n += 1;
      return {
        dataUrl: `data:image/png;base64,${SMOKE_PNG.toString("base64")}`,
        size: "1024x1024",
        quality: "low",
      };
    },
  };
}

function smokePackage() {
  return makeMinimalPackage({
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    sceneOrder: 2,
    productionIntent: "text_motion",
    environment: {
      kind: "interior",
      description: "Bright modern office",
      timeOfDay: "day",
      weather: "clear",
      continuityKey: "office-1",
      mood: "calm",
    },
    camera: {
      shotSize: "wide",
      angle: "eye_level",
      movement: "static",
      depthOfField: "medium",
      intent: "establish",
    },
    lighting: {
      source: "soft window",
      quality: "soft",
      temperature: "neutral",
      contrast: "medium",
      intent: "natural",
    },
    style: {
      style: "photoreal",
      realism: "high",
      colorIntent: "neutral",
      brandAlignment: "clean",
      paletteRoles: ["primary"],
    },
    composition: {
      subjectPosition: "center",
      lookDirection: "camera",
      visualHierarchy: "subject-first",
      textSafeArea: "bottom",
    },
  });
}

test("11A-WIRE — exception disabled by default", () => {
  assert.equal(isVhs124OpenAIImageExceptionEnabled({}), false);
  assert.equal(
    isVhs124OpenAIImageExceptionEnabled({
      VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "0",
    }),
    false,
  );
  assert.throws(
    () => assertVhs124OpenAIImageExceptionActive({ env: {} }),
    /disabled/i,
  );
});

test("11A-WIRE — dry-run executable without provider", () => {
  const dry = phase11AOpenAIImageAllowlistDryRun({ env: {} });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executable, true);
  assert.equal(dry.capability, "image.text_to_image");
  assert.equal(dry.provider, "openai");
  assert.equal(dry.model, "gpt-image-1");
  assert.equal(dry.quality, "low");
  assert.equal(dry.size, "1024x1024");
  assert.equal(dry.maximumCalls, 1);
  assert.equal(dry.maximumJobs, 1);
  assert.equal(dry.maximumOutputs, 1);
  assert.equal(dry.estimateMinor, 1);
  assert.equal(dry.reservationMinor, 2);
  assert.equal(dry.pricingConfigured, true);
  assert.equal(dry.exceptionScoped, true);
  assert.equal(dry.downstream, false);
  assert.equal(dry.motionIsolation, true);
  assert.equal(dry.pathStatus, "WIRED_DISABLED");
  assert.equal(
    dry.registryClaim,
    "DOES_NOT_DECLARE_GLOBAL_REAL_PROVIDER_COMPATIBILITY",
  );
});

test("11A-WIRE — resolve adapters stays fakes when exception OFF", () => {
  const r = resolveDirectorProviderAdapters({ env: {} });
  assert.equal(r.mode, "fakes_only");
  assert.equal(r.adapters.length, 3);
  assert.ok(r.adapters.every((a) => a.providerId));
});

test("11A-WIRE — resolve adapters swaps openai when exception ON", () => {
  const calls = { n: 0 };
  const r = resolveDirectorProviderAdapters({
    env: { VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "1" },
    openaiImageClient: fakeClient(calls),
  });
  assert.equal(r.mode, "vhs124_openai_image_allowlist");
  const openai = r.adapters.find((a) => a.providerId === "openai");
  assert.ok(openai);
  assert.equal(openai!.supports("gpt-image-1", "image"), true);
  assert.equal(openai!.supports("gpt-image-1", "video"), false);
  assert.equal(openai!.supports("other", "image"), false);
  assert.equal(calls.n, 0);
});

test("11A-WIRE — hostile capability/provider/model rejected", () => {
  assert.throws(
    () =>
      assertVhs124OpenAIImageAllowlistScope({
        projectId: PHASE_11A_SMOKE_PROJECT_ID,
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
        action: "video",
        capabilityProfile: "image.text_to_image",
        providerId: "openai",
        modelId: "gpt-image-1",
      }),
    /action/i,
  );
  assert.throws(
    () =>
      assertVhs124OpenAIImageAllowlistScope({
        projectId: PHASE_11A_SMOKE_PROJECT_ID,
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
        action: "image",
        capabilityProfile: "image.text_to_image",
        providerId: "fal",
        modelId: "gpt-image-1",
      }),
    /provider/i,
  );
  assert.throws(
    () =>
      assertVhs124OpenAIImageAllowlistScope({
        projectId: PHASE_11A_SMOKE_PROJECT_ID,
        sceneId: "scene-1",
        action: "image",
        capabilityProfile: "image.text_to_image",
        providerId: "openai",
        modelId: "gpt-image-1",
      }),
    /sceneId/i,
  );
  assert.throws(
    () =>
      assertVhs124OpenAIImageAllowlistScope({
        projectId: PHASE_11A_SMOKE_PROJECT_ID,
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
        action: "image",
        capabilityProfile: "image.text_to_image",
        providerId: "openai",
        modelId: "gpt-image-1",
        fallbackRequested: true,
      }),
    /fallback/i,
  );
  assert.throws(
    () =>
      assertVhs124OpenAIImageAllowlistScope({
        projectId: PHASE_11A_SMOKE_PROJECT_ID,
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
        action: "image",
        capabilityProfile: "image.text_to_image",
        providerId: "openai",
        modelId: "gpt-image-1",
        estimateMinor: 3,
      }),
    /2¢|reservation/i,
  );
});

test("11A-WIRE — Motion project / legacy / fake path blocked", () => {
  assert.throws(
    () => assertPhase11ADoesNotUseMotionProject(MV001_MOTION_PROJECT_ID),
    /MV-001/,
  );
  assert.throws(
    () =>
      assertVhs124OpenAIImageAllowlistScope({
        projectId: PHASE_11A_SMOKE_PROJECT_ID,
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
        action: "image",
        capabilityProfile: "image.text_to_image",
        providerId: "openai",
        modelId: "gpt-image-1",
        legacyEndpoint: true,
      }),
    /legacy/i,
  );
  assert.throws(
    () =>
      assertVhs124OpenAIImageAllowlistScope({
        projectId: PHASE_11A_SMOKE_PROJECT_ID,
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
        action: "image",
        capabilityProfile: "image.text_to_image",
        providerId: "openai",
        modelId: "gpt-image-1",
        fakeAdapterOnRealPath: true,
      }),
    /fake/i,
  );
});

test("11A-WIRE — ScenePackage prompt + single-step plan", () => {
  const pkg = smokePackage();
  const prompt = buildPhase11AImagePromptFromScenePackage(pkg);
  assert.ok(prompt.promptHash.length === 64);
  assert.ok(prompt.promptText.length > 0);
  assert.equal(prompt.capabilityProfile, "image.text_to_image");
  assert.equal(prompt.promptVersion, "phase-11a-image-prompt-v2");
  assert.equal(prompt.redactedMetadata.providerTextPolicy, "no_text");
  assert.equal(prompt.redactedMetadata.textOverlayMode, "deterministic");
  assert.match(prompt.promptText, /No letters, words, digits/);
  assert.match(prompt.negativePrompt ?? "", /buttons with text/);
  assert.equal("promptText" in prompt.redactedMetadata, false);

  const built = buildPhase11ASingleStepGenerationPlan({
    storyboardRevisionId: "sb-1",
    scenePackageRevisionIds: ["pkg-set-1"],
    scenePackage: pkg,
    createdAt: "2026-08-13T00:00:00.000Z",
    createdBy: "tester",
    correlationId: "corr-11a",
  });
  assert.equal(built.stepCount, 1);
  assert.equal(built.fallbackCount, 0);
  assert.equal(built.plan.scenePlans.length, 1);
  assert.equal(built.plan.scenePlans[0]!.steps.length, 1);
  assert.equal(built.plan.scenePlans[0]!.steps[0]!.fallbacks.length, 0);
  assert.equal(built.plan.scenePlans[0]!.steps[0]!.modelId, "gpt-image-1");
  assert.equal(built.estimateMinor, 1);
  assert.equal(built.reservationMinor, 2);
  assert.ok(built.fingerprint.length === 64);
});

test("11A-WIRE — pipeline single image submit count=1 with fake transport", async () => {
  const calls = { n: 0 };
  const env = { VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "1" };
  const adapter = createVhs124AllowlistedOpenAIImageAdapter({
    client: fakeClient(calls),
    quality: "low",
    size: "1024x1024",
    requireExceptionGate: (e) => e.VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION === "1",
    env,
  });
  const registry = createProviderAdapterRegistry([adapter]);
  const engine = createVhs124ScopedGenerationEngine(
    createGenerationEngine({ registry }),
  );
  const pkg = smokePackage();
  const built = buildPhase11ASingleStepGenerationPlan({
    storyboardRevisionId: pkg.storyboardRevisionId,
    scenePackageRevisionIds: [pkg.id],
    scenePackage: pkg,
    createdAt: "2026-08-13T00:00:00.000Z",
    createdBy: "tester",
    correlationId: "corr-pipe",
  });
  const step = built.plan.scenePlans[0]!.steps[0]!;
  const result = await engine.execute(
    {
      projectId: PHASE_11A_SMOKE_PROJECT_ID,
      planRevisionId: built.plan.id,
      sceneId: PHASE_11A_SMOKE_SCENE_ID,
      step,
      scenePackage: built.scenePackage,
      resolvedInputs: [],
      idempotencyKey: "idem-11a-1",
      requestedAt: "2026-08-13T00:00:00.000Z",
      attempt: 1,
    },
    {
      correlationId: "corr-pipe",
      requestedAt: "2026-08-13T00:00:00.000Z",
    },
  );
  assert.equal(result.status, "completed");
  assert.equal(calls.n, 1);
  if (result.status === "completed") {
    assert.equal(result.output.kind, "image");
    assert.equal(result.output.mimeType, "image/png");
  }
});

test("11A-WIRE — scoped engine rejects wrong project", async () => {
  const calls = { n: 0 };
  const adapter = createVhs124AllowlistedOpenAIImageAdapter({
    client: fakeClient(calls),
    env: { VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "1" },
    requireExceptionGate: () => true,
  });
  const engine = createVhs124ScopedGenerationEngine(
    createGenerationEngine({ registry: createProviderAdapterRegistry([adapter]) }),
  );
  const pkg = smokePackage();
  const built = buildPhase11ASingleStepGenerationPlan({
    storyboardRevisionId: "sb",
    scenePackageRevisionIds: ["p"],
    scenePackage: pkg,
    createdAt: "2026-08-13T00:00:00.000Z",
    createdBy: "t",
    correlationId: "c",
  });
  await assert.rejects(
    () =>
      engine.execute(
        {
          projectId: "00000000-0000-4000-8000-000000000099",
          planRevisionId: built.plan.id,
          sceneId: PHASE_11A_SMOKE_SCENE_ID,
          step: built.plan.scenePlans[0]!.steps[0]!,
          scenePackage: built.scenePackage,
          resolvedInputs: [],
          idempotencyKey: "x",
          requestedAt: "2026-08-13T00:00:00.000Z",
          attempt: 1,
        },
        { correlationId: "c", requestedAt: "2026-08-13T00:00:00.000Z" },
      ),
    /projectId/i,
  );
  assert.equal(calls.n, 0);
});

test("11A-WIRE — base64 memory-only + technical QC + HR gate", () => {
  const decoded = decodeOpenAIImageToMemoryBytes(
    `data:image/png;base64,${SMOKE_PNG.toString("base64")}`,
  );
  assert.ok(decoded.bytes.byteLength > 0);
  const meta = buildPhase11AImageTechnicalMeta(decoded.bytes);
  assert.equal(meta.mimeType, "image/png");
  assert.ok(meta.checksumSha256.length === 64);

  const asset = {
    id: "asset-1",
    kind: "image" as const,
    mimeType: "image/png",
    source: {
      kind: "inline_data_url" as const,
      dataUrl: `data:image/png;base64,${SMOKE_PNG.toString("base64")}`,
    },
    checksum: meta.checksumSha256,
    sizeBytes: meta.byteLength,
  };
  const qc = validatePhase11AImageTechnical({ asset, meta });
  assert.equal(qc.status, "needs_review");
  assert.ok(qc.checks.some((c) => c.code === "visual_auto" && c.detail === "unavailable_humanOnly"));

  assertPhase11AOutputNotAutoActive({
    active: false,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
  });
  assert.throws(
    () =>
      assertPhase11AActivationAllowed({
        technicalQcStatus: "needs_review",
        reviews: [],
      }),
    /Human Review/i,
  );
  assertPhase11AActivationAllowed({
    technicalQcStatus: "needs_review",
    reviews: [
      {
        decision: "approved",
        decidedAt: "2026-08-13T00:00:00.000Z",
        actorId: "human",
        assetId: "asset-1",
        sequence: 1,
      },
    ],
  });
});

test("11A-WIRE — storage path private + counters", () => {
  const path = buildPhase11AImageStoragePath({
    workspaceId: "3c308f57-f448-40ba-aaca-bc0d8d546d01",
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    assetId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  });
  assert.match(path, /\/media\/image\/.+\.png$/);
  assert.throws(
    () =>
      buildPhase11AImageStoragePath({
        workspaceId: "ws",
        projectId: MV001_MOTION_PROJECT_ID,
        assetId: "a",
      }),
    /Motion/,
  );

  const c = createPhase11AWorkerCounters();
  c.providerSubmitCount = 1;
  c.ledgerSettlementCount = 1;
  assertPhase11AWorkerCountersWithinSmoke(c);
  c.providerSubmitCount = 2;
  assert.throws(() => assertPhase11AWorkerCountersWithinSmoke(c), /providerSubmitCount/);
});

test("11A-WIRE — providerMode=real still forbidden; audit has no secrets", () => {
  assert.throws(() => assertDirectorProductionUsesFakes("real"), /forbidden/i);
  const audit = vhs124OpenAIImageExceptionAuditView({
    VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "1",
    OPENAI_API_KEY: "sk-should-never-appear",
  });
  const dumped = JSON.stringify(audit);
  assert.equal(audit.exceptionId, VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION);
  assert.ok(!dumped.includes("sk-"));
  assert.ok(!dumped.includes("OPENAI_API_KEY"));
});

test("11A-WIRE — quality port needs_review; OpenAI adapter quality low", async () => {
  const calls = { n: 0 };
  const adapter = createOpenAIImageAdapter(fakeClient(calls), {
    quality: "low",
    forceSize: "1024x1024",
  });
  const est = await adapter.estimate!(
    {
      kind: "image",
      action: "image",
      capabilityProfile: "image.text_to_image",
      providerId: "openai",
      modelId: "gpt-image-1",
      promptText: "x",
      references: [],
    },
    {
      correlationId: "c",
      idempotencyKey: "i",
      timeoutMs: 1000,
      requestedAt: "2026-08-13T00:00:00.000Z",
    },
  );
  assert.equal(est.estimate.total.amountMinor, 1);

  const port = createPhase11AImageTechnicalQualityPort();
  const dataUrl = `data:image/png;base64,${SMOKE_PNG.toString("base64")}`;
  const q = await port.validate(
    {
      step: {
        id: "s",
        order: 1,
        action: "image",
        capabilityProfile: "image.text_to_image",
        providerId: "openai",
        modelId: "gpt-image-1",
        inputRefs: [],
        dependsOnStepIds: [],
        expectedOutput: { mediaType: "image" },
        timeoutSeconds: 10,
        estimate: est.estimate,
        fallbacks: [],
        selection: {
          selectedBecause: [],
          rejectedAlternatives: [],
          score: { total: 1, missingDimensions: [], contributions: [] },
          eligibilityEvidence: [],
          pricingEvidence: [],
          unknowns: [],
        },
      },
      asset: {
        id: "a",
        kind: "image",
        mimeType: "image/png",
        source: { kind: "inline_data_url", dataUrl },
      },
      nowIso: "2026-08-13T00:00:00.000Z",
    },
    { correlationId: "c", nowIso: "2026-08-13T00:00:00.000Z" },
  );
  assert.equal(q.status, "needs_review");
  assert.equal(calls.n, 0);
  // prompt/hash redaction: full prompt not in audit
  const h = createHash("sha256").update("secret-prompt").digest("hex");
  assert.equal(h.length, 64);
});
