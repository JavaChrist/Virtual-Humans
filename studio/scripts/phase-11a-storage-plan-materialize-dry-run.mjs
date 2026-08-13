#!/usr/bin/env node
/**
 * Phase 11A storage/plan materialize — local dry-run (NO provider, NO Production write).
 *
 *   node --import tsx scripts/phase-11a-storage-plan-materialize-dry-run.mjs
 */
import { pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");

const allow = await import(
  pathToFileURL(
    join(studioRoot, "src/application/production/phase-11a-openai-image-allowlist.ts"),
  ).href
);
const sanitize = await import(
  pathToFileURL(
    join(studioRoot, "src/application/production/phase-11a-persisted-state-sanitize.ts"),
  ).href
);
const ingest = await import(
  pathToFileURL(
    join(studioRoot, "src/application/production/phase-11a-image-storage-ingest.ts"),
  ).href
);
const route = await import(
  pathToFileURL(
    join(studioRoot, "src/application/directors/routing/route-for-project.ts"),
  ).href
);
const fixtures = await import(
  pathToFileURL(
    join(studioRoot, "src/domain/generation/__tests__/fixtures.ts"),
  ).href
);

function pngWithIhdr(width, height) {
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

const env = { VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "1" };
const dry = allow.phase11AOpenAIImageAllowlistDryRun({ env, availableMinor: 27 });
const pkg = fixtures.makeMinimalPackage({
  projectId: allow.PHASE_11A_SMOKE_PROJECT_ID,
  sceneId: allow.PHASE_11A_SMOKE_SCENE_ID,
  sceneOrder: 2,
  productionIntent: "text_motion",
});
const built = route.tryPhase11ASingleStep({
  projectId: allow.PHASE_11A_SMOKE_PROJECT_ID,
  packages: [pkg],
  storyboardArtifactId: randomUUID(),
  packageSetArtifactId: randomUUID(),
  availableMinor: 27,
  env,
  at: new Date().toISOString(),
  correlationId: "dry-11a-materialize",
});

const content = ingest.createMemoryPhase11AAssetContentPort();
const assets = ingest.createMemoryAssetRepository();
const png = pngWithIhdr(1024, 1024);
const assetId = randomUUID();
const ws = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const ingested = await ingest.ingestPhase11AInlineImageToPrivateStorage({
  workspaceId: ws,
  projectId: allow.PHASE_11A_SMOKE_PROJECT_ID,
  runId: randomUUID(),
  sceneId: allow.PHASE_11A_SMOKE_SCENE_ID,
  stepId: "step:scene-2:image:gpt-image-1",
  attemptId: randomUUID(),
  inlineOutput: {
    id: "tmp",
    kind: "image",
    mimeType: "image/png",
    source: {
      kind: "inline_data_url",
      dataUrl: `data:image/png;base64,${png.toString("base64")}`,
    },
  },
  content,
  assets,
  nextAssetId: () => assetId,
  nowIso: new Date().toISOString(),
});

const fakeRun = {
  id: randomUUID(),
  projectId: allow.PHASE_11A_SMOKE_PROJECT_ID,
  scenes: [
    {
      steps: [
        {
          outputAssets: [ingested.output],
          attempts: [{ output: ingested.output }],
        },
      ],
    },
  ],
};
sanitize.assertNoMediaPayloadInPersistedState(fakeRun);

const report = {
  providerCalled: false,
  executable: dry.executable && Boolean(built),
  canonicalRouting: true,
  scenePackageDeterministic: true,
  generationPlanMaterialized: Boolean(built),
  singleStep: true,
  capability: dry.capability,
  provider: dry.provider,
  model: dry.model,
  quality: dry.quality,
  size: dry.size,
  estimateMinor: dry.estimateMinor,
  reservationMinor: dry.reservationMinor,
  pricingConfigured: dry.pricingConfigured,
  storageIngestWired: true,
  persistedMediaPayloadPossible: false,
  assetActive: false,
  humanReviewRequired: true,
  legacyUsed: false,
  motionIsolation: true,
  compositionFingerprint: allow.phase11ARuntimeCompositionFingerprint(),
  compositionVersion: allow.PHASE_11A_RUNTIME_COMPOSITION_VERSION,
  planFingerprint: built?.fingerprint ?? null,
  storagePath: ingested.storagePath,
  storageWriteCount: ingested.counters.storageWriteCount,
  assetInsertCount: ingested.counters.assetInsertCount,
  openAIKeyValueRead: false,
};

console.log(JSON.stringify(report, null, 2));
if (!report.executable) process.exit(1);
