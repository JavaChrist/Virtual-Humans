/**
 * Phase 11A — storage ingest, sanitize, canonical routing single-step.
 * Fake OpenAI transport + memory Storage only. No network. No key read.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { money } from "@/domain/cost";
import { makeMinimalPackage } from "@/domain/generation/__tests__/fixtures";
import type { ProductionRun } from "@/domain/production";
import { tryPhase11ASingleStep } from "@/application/directors/routing/route-for-project";
import {
  createGenerationEngine,
  createProviderAdapterRegistry,
} from "@/application/generation";
import {
  createVhs124AllowlistedOpenAIImageAdapter,
  createVhs124ScopedGenerationEngine,
} from "@/infrastructure/providers/vhs124-openai-image-exception";
import {
  assertNoMediaPayloadInPersistedState,
  sanitizeProductionRunForPersistence,
  PHASE_11A_PROVIDER_RESULT_NOT_DURABLY_INGESTED,
} from "../phase-11a-persisted-state-sanitize";
import {
  assertSafePhase11AImageStoragePath,
  createMemoryAssetRepository,
  createMemoryPhase11AAssetContentPort,
  ingestPhase11AInlineImageToPrivateStorage,
} from "../phase-11a-image-storage-ingest";
import {
  assertPhase11AWorkerCountersWithinSmoke,
  buildPhase11AImageStoragePath,
  createPhase11AWorkerCounters,
  phase11AOpenAIImageAllowlistDryRun,
  phase11ARuntimeCompositionFingerprint,
  PHASE_11A_RUNTIME_COMPOSITION_VERSION,
  PHASE_11A_SMOKE_PROJECT_ID,
  PHASE_11A_SMOKE_SCENE_ID,
  VHS124_OPENAI_IMAGE_EXCEPTION_ENV,
} from "../phase-11a-openai-image-allowlist";
import {
  buildPhase11ASingleStepGenerationPlan,
  selectPhase11AScene2Package,
} from "../phase-11a-single-step-plan";
import { MV001_MOTION_PROJECT_ID } from "../phase-11a-motion-isolation";

function pngWithIhdr(width: number, height: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  const type = Buffer.from("IHDR");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(13, 0);
  const crc = Buffer.alloc(4);
  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  return Buffer.concat([sig, len, type, ihdrData, crc, iend]);
}

const SMOKE_PNG = pngWithIhdr(1024, 1024);

function dataUrlPng(buf: Buffer = SMOKE_PNG): string {
  return `data:image/png;base64,${buf.toString("base64")}`;
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

test("11A-MATERIALIZE — composition fingerprint stable", () => {
  const a = phase11ARuntimeCompositionFingerprint();
  const b = phase11ARuntimeCompositionFingerprint();
  assert.equal(a, b);
  assert.equal(a.length, 16);
  assert.ok(PHASE_11A_RUNTIME_COMPOSITION_VERSION.includes("storage-plan"));
});

test("11A-MATERIALIZE — dry-run local flags", () => {
  const dry = phase11AOpenAIImageAllowlistDryRun({
    env: { [VHS124_OPENAI_IMAGE_EXCEPTION_ENV]: "1" },
    availableMinor: 27,
  });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executable, true);
  assert.equal(dry.canonicalRouting, true);
  assert.equal(dry.generationPlanMaterialized, true);
  assert.equal(dry.singleStep, true);
  assert.equal(dry.capability, "image.text_to_image");
  assert.equal(dry.provider, "openai");
  assert.equal(dry.model, "gpt-image-1");
  assert.equal(dry.quality, "low");
  assert.equal(dry.size, "1024x1024");
  assert.equal(dry.estimateMinor, 1);
  assert.equal(dry.reservationMinor, 2);
  assert.equal(dry.pricingConfigured, true);
  assert.equal(dry.storageIngestWired, true);
  assert.equal(dry.persistedMediaPayloadPossible, false);
  assert.equal(dry.assetActive, false);
  assert.equal(dry.humanReviewRequired, true);
  assert.equal(dry.legacyIsolated, true);
  assert.equal(dry.motionIsolation, true);
});

test("11A-MATERIALIZE — tryPhase11ASingleStep requires exception", () => {
  const pkgs = [smokePackage()];
  assert.equal(
    tryPhase11ASingleStep({
      projectId: PHASE_11A_SMOKE_PROJECT_ID,
      packages: pkgs,
      storyboardArtifactId: randomUUID(),
      packageSetArtifactId: randomUUID(),
      availableMinor: 27,
      env: {},
      at: "2026-08-13T00:00:00.000Z",
      correlationId: "c",
    }),
    null,
  );
  const built = tryPhase11ASingleStep({
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    packages: pkgs,
    storyboardArtifactId: randomUUID(),
    packageSetArtifactId: randomUUID(),
    availableMinor: 27,
    env: { [VHS124_OPENAI_IMAGE_EXCEPTION_ENV]: "1" },
    at: "2026-08-13T00:00:00.000Z",
    correlationId: "c",
  });
  assert.ok(built);
  assert.equal(built!.stepCount, 1);
  assert.equal(built!.fallbackCount, 0);
  assert.equal(built!.plan.scenePlans[0]!.steps[0]!.providerId, "openai");
  assert.equal(built!.plan.scenePlans[0]!.steps[0]!.modelId, "gpt-image-1");
  assert.match(built!.plan.id, /^[0-9a-f-]{36}$/i);
});

test("11A-MATERIALIZE — plan deterministic + scene-2 only", () => {
  const pkg = smokePackage();
  const a = buildPhase11ASingleStepGenerationPlan({
    storyboardRevisionId: "sb",
    scenePackageRevisionIds: ["p"],
    scenePackage: pkg,
    createdAt: "2026-08-13T00:00:00.000Z",
    createdBy: "t",
    correlationId: "c",
  });
  const b = buildPhase11ASingleStepGenerationPlan({
    storyboardRevisionId: "sb",
    scenePackageRevisionIds: ["p"],
    scenePackage: pkg,
    createdAt: "2026-08-13T00:00:00.000Z",
    createdBy: "t",
    correlationId: "c",
  });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.plan.id, b.plan.id);
  assert.equal(selectPhase11AScene2Package({ packages: [pkg] }).sceneId, "scene-2");
});

test("11A-MATERIALIZE — sanitize strips base64 from run state", () => {
  const b64 = dataUrlPng();
  const run = {
    id: randomUUID(),
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    generationPlanRevisionId: randomUUID(),
    status: "running",
    revision: 1,
    currency: "USD",
    estimatedCost: money(1, "USD"),
    committedCost: money(0, "USD"),
    releasedCost: money(0, "USD"),
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
    correlationId: "c",
    policy: { version: "1" },
    scenes: [
      {
        sceneId: "scene-2",
        sceneOrder: 2,
        status: "running",
        estimatedCost: money(1, "USD"),
        committedCost: money(0, "USD"),
        steps: [
          {
            stepId: "s1",
            status: "validating",
            outputAssets: [
              {
                id: "a1",
                kind: "image",
                mimeType: "image/png",
                source: { kind: "inline_data_url", dataUrl: b64 },
              },
            ],
            attempts: [
              {
                id: "att1",
                attemptNumber: 1,
                kind: "primary",
                providerId: "openai",
                modelId: "gpt-image-1",
                status: "completed",
                estimate: { total: money(1, "USD") },
                output: {
                  id: "a1",
                  kind: "image",
                  mimeType: "image/png",
                  source: { kind: "inline_data_url", dataUrl: b64 },
                },
              },
            ],
          },
        ],
      },
    ],
  } as unknown as ProductionRun;

  const safe = sanitizeProductionRunForPersistence(run);
  const dumped = JSON.stringify(safe);
  assert.ok(!dumped.includes("base64,"));
  assert.ok(!dumped.includes(b64.slice(30, 70)));
  assertNoMediaPayloadInPersistedState(safe);
  assert.throws(
    () => assertNoMediaPayloadInPersistedState({ nested: { dataUrl: b64 } }),
    /media\/secret payload/,
  );
  assert.throws(
    () =>
      assertNoMediaPayloadInPersistedState({
        b64_json: "AAAA",
        promptText: "secret prompt",
      }),
    /forbidden_key/,
  );
});

test("11A-MATERIALIZE — storage path + ingest once + active=false + reconcile", async () => {
  const content = createMemoryPhase11AAssetContentPort();
  const assets = createMemoryAssetRepository();
  const assetId = randomUUID();
  const ws = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
  const path = buildPhase11AImageStoragePath({
    workspaceId: ws,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    assetId,
  });
  assertSafePhase11AImageStoragePath(path, {
    workspaceId: ws,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    assetId,
  });
  assert.throws(
    () =>
      buildPhase11AImageStoragePath({
        workspaceId: ws,
        projectId: MV001_MOTION_PROJECT_ID,
        assetId,
      }),
    /Motion/,
  );

  const result = await ingestPhase11AInlineImageToPrivateStorage({
    workspaceId: ws,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    runId: randomUUID(),
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    stepId: "step:scene-2:image:gpt-image-1",
    attemptId: randomUUID(),
    inlineOutput: {
      id: "tmp",
      kind: "image",
      mimeType: "image/png",
      source: { kind: "inline_data_url", dataUrl: dataUrlPng() },
    },
    content,
    assets,
    nextAssetId: () => assetId,
    nowIso: "2026-08-13T00:00:00.000Z",
  });

  assert.equal(result.active, false);
  assert.equal(result.qualityStatus, "needs_review");
  assert.equal(result.output.source.kind, "internal");
  assert.equal(result.counters.storageWriteCount, 1);
  assert.equal(result.counters.assetInsertCount, 1);
  assert.equal(result.counters.decodedImageCount, 1);
  assert.equal(content.store.size, 1);
  assert.equal(assets.rows.size, 1);
  assert.equal((assets.rows.get(assetId)!.provenance as { active: boolean }).active, false);
  assert.ok(!JSON.stringify(result.output).includes("base64"));

  const again = await ingestPhase11AInlineImageToPrivateStorage({
    workspaceId: ws,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    runId: randomUUID(),
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    stepId: "step:scene-2:image:gpt-image-1",
    attemptId: randomUUID(),
    inlineOutput: {
      id: "tmp2",
      kind: "image",
      mimeType: "image/png",
      source: { kind: "inline_data_url", dataUrl: dataUrlPng() },
    },
    content,
    assets,
    nextAssetId: () => assetId,
    nowIso: "2026-08-13T00:00:01.000Z",
    allowReconcileExisting: true,
  });
  assert.equal(again.assetId, assetId);
  assert.equal(content.store.size, 1);
  assert.equal(assets.rows.size, 1);
});

test("11A-MATERIALIZE — reject oversized payload", async () => {
  const content = createMemoryPhase11AAssetContentPort();
  const assets = createMemoryAssetRepository();
  await assert.rejects(
    () =>
      ingestPhase11AInlineImageToPrivateStorage({
        workspaceId: "3c308f57-f448-40ba-aaca-bc0d8d546d01",
        projectId: PHASE_11A_SMOKE_PROJECT_ID,
        runId: randomUUID(),
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
        stepId: "s",
        attemptId: randomUUID(),
        inlineOutput: {
          id: "t",
          kind: "image",
          mimeType: "image/png",
          source: {
            kind: "inline_data_url",
            dataUrl: `data:image/png;base64,${"A".repeat(12_000_001)}`,
          },
        },
        content,
        assets,
        nowIso: "2026-08-13T00:00:00.000Z",
      }),
    /memory bound|not_durably_ingested|Phase 11A/,
  );
  assert.equal(PHASE_11A_PROVIDER_RESULT_NOT_DURABLY_INGESTED, "provider_result_not_durably_ingested");
});

test("11A-MATERIALIZE — provider submit count=1 with fake transport", async () => {
  const calls = { n: 0 };
  const env = { [VHS124_OPENAI_IMAGE_EXCEPTION_ENV]: "1" };
  const adapter = createVhs124AllowlistedOpenAIImageAdapter({
    client: {
      async generateImage() {
        calls.n += 1;
        return {
          dataUrl: dataUrlPng(),
          size: "1024x1024",
          quality: "low",
        };
      },
    },
    quality: "low",
    size: "1024x1024",
    requireExceptionGate: (e) => e[VHS124_OPENAI_IMAGE_EXCEPTION_ENV] === "1",
    env,
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
  const step = built.plan.scenePlans[0]!.steps[0]!;
  const result = await engine.execute(
    {
      projectId: PHASE_11A_SMOKE_PROJECT_ID,
      planRevisionId: built.plan.id,
      sceneId: PHASE_11A_SMOKE_SCENE_ID,
      step,
      scenePackage: built.scenePackage,
      resolvedInputs: [],
      idempotencyKey: "idem-mat-1",
      requestedAt: "2026-08-13T00:00:00.000Z",
      attempt: 1,
    },
    { correlationId: "c", requestedAt: "2026-08-13T00:00:00.000Z" },
  );
  assert.equal(result.status, "completed");
  assert.equal(calls.n, 1);
  const c = createPhase11AWorkerCounters();
  c.providerSubmitCount = 1;
  assertPhase11AWorkerCountersWithinSmoke(c);
  c.providerSubmitCount = 2;
  assert.throws(() => assertPhase11AWorkerCountersWithinSmoke(c), /providerSubmitCount/);
});

test("11A-MATERIALIZE — Motion project never selects 11A plan", () => {
  assert.equal(
    tryPhase11ASingleStep({
      projectId: MV001_MOTION_PROJECT_ID,
      packages: [smokePackage()],
      storyboardArtifactId: randomUUID(),
      packageSetArtifactId: randomUUID(),
      availableMinor: 27,
      env: { [VHS124_OPENAI_IMAGE_EXCEPTION_ENV]: "1" },
      at: "2026-08-13T00:00:00.000Z",
      correlationId: "c",
    }),
    null,
  );
});

test("11A-MATERIALIZE — hostile nested secrets rejected", () => {
  assert.throws(
    () =>
      assertNoMediaPayloadInPersistedState({
        error: { nested: { authorization: "Bearer eyJabc.def.ghi.extra" } },
      }),
    /forbidden_key|secret|url/,
  );
});
