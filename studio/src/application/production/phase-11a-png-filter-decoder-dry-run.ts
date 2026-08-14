/**
 * Local dry-run: PNG filter decoder 0–4 + compositor on synthetic fixtures.
 * No provider, no Production media read/write, no flag change.
 */

import {
  createDefaultPhase11AOverlaySpec,
  fingerprintImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";
import {
  composePhase11ADeterministicOverlay,
  PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
} from "./phase-11a-deterministic-compositor";
import { checksumSha256Bytes } from "./phase-11a-image-technical-qc";
import { validatePhase11ATypographicQc } from "./phase-11a-typographic-qc";
import {
  decodeRgbPng,
  encodeRgbPng,
  encodeRgbPngWithRowFilters,
  PHASE_11A_PNG_SUPPORTED_FILTERS,
} from "./phase-11a-png-rgb";
import {
  PHASE_11A_SCENE2_OVERLAY_CTA,
  PHASE_11A_SCENE2_OVERLAY_LOCALE,
  PHASE_11A_SCENE2_OVERLAY_TITLE,
} from "./phase-11a-strip-overlay-copy-dry-run";
import {
  createMemoryPhase11ARoleAssetContentPort,
  fingerprintPhase11AComposedAsset,
  ingestPhase11AComposedOverlay,
} from "./phase-11a-composed-ingest";
import { createMemoryAssetRepository } from "./phase-11a-image-storage-ingest";
import { buildPhase11ARoleImageStoragePath } from "./phase-11a-image-role-storage";
import { PHASE_11A_SMOKE_PROJECT_ID, PHASE_11A_SMOKE_SCENE_ID } from "./phase-11a-openai-image-allowlist";

export const PHASE_11A_PNG_FILTER_DECODER_DRY_RUN_VERSION =
  "phase-11a-png-filter-decoder-dry-run-1.0.0" as const;

const SYNTH_WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const SYNTH_PARENT = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SYNTH_RUN = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SYNTH_NOW = "2026-08-14T00:00:00.000Z";

export function syntheticPatternRgb(width: number, height: number): Uint8Array {
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      rgb[i] = (x * 17 + y * 3) & 0xff;
      rgb[i + 1] = (x * 5 + y * 41 + 200) & 0xff;
      rgb[i + 2] = (255 - x * 9 + y * 13) & 0xff;
    }
  }
  return rgb;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export type Phase11APngFilterDecoderDryRun = {
  pngFiltersSupported: readonly [0, 1, 2, 3, 4];
  providerAssetRead: false;
  providerCalled: false;
  compositorExecutable: true;
  overlaySpecValid: true;
  deterministicChecksum: true;
  ProductionStorageWrite: false;
  HumanReviewRequired: true;
  decoderStrategy: "internal_decodeRgbPng";
  interlacing: "rejected";
  formatsSupported: ["png_8bit_rgb_non_interlaced"];
  formatsRejected: ["rgba", "grayscale", "indexed", "adam7"];
  pixelDeterminismAcrossFilters: true;
  compositorDeterminism: true;
  overlayLocale: typeof PHASE_11A_SCENE2_OVERLAY_LOCALE;
  overlayTitle: typeof PHASE_11A_SCENE2_OVERLAY_TITLE;
  overlayCta: typeof PHASE_11A_SCENE2_OVERLAY_CTA;
  overlayFingerprint: string;
  composedChecksumSha256: string;
  typographicQcStatus: "accepted";
  compositorRuntime: typeof PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME;
  futureComposedAssetIdStable: true;
  futurePreflightExecuted: false;
  productionRunMutated: false;
  syntheticReplayIdempotent: true;
};

export async function runPhase11APngFilterDecoderDryRun(): Promise<Phase11APngFilterDecoderDryRun> {
  const rgb = syntheticPatternRgb(8, 8);
  const decoded: Uint8Array[] = [];
  for (const filter of PHASE_11A_PNG_SUPPORTED_FILTERS) {
    const png = encodeRgbPngWithRowFilters({ width: 8, height: 8, rgb }, Array(8).fill(filter));
    decoded.push(decodeRgbPng(png).rgb);
  }
  decoded.push(
    decodeRgbPng(
      encodeRgbPngWithRowFilters({ width: 8, height: 8, rgb }, [0, 1, 2, 3, 4, 0, 1, 2]),
    ).rgb,
  );
  decoded.push(decodeRgbPng(encodeRgbPng({ width: 8, height: 8, rgb })).rgb);
  for (const pixels of decoded) {
    if (!sameBytes(pixels, rgb)) {
      throw new Error("png filter dry-run: pixel mismatch across filters");
    }
  }

  const spec = createDefaultPhase11AOverlaySpec({
    locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    title: PHASE_11A_SCENE2_OVERLAY_TITLE,
    callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
  });
  const canvasRgb = syntheticPatternRgb(1024, 1024);
  const filteredProvider = encodeRgbPngWithRowFilters(
    { width: 1024, height: 1024, rgb: canvasRgb },
    Array.from({ length: 1024 }, (_, y) => y % 5),
  );
  const noneProvider = encodeRgbPng({ width: 1024, height: 1024, rgb: canvasRgb });
  const a = composePhase11ADeterministicOverlay({ providerPng: filteredProvider, spec });
  const b = composePhase11ADeterministicOverlay({ providerPng: noneProvider, spec });
  const c = composePhase11ADeterministicOverlay({ providerPng: filteredProvider, spec });
  if (a.checksumSha256 !== b.checksumSha256 || a.checksumSha256 !== c.checksumSha256) {
    throw new Error("png filter dry-run: compositor checksum not deterministic");
  }
  if (a.checksumSha256 !== checksumSha256Bytes(a.png)) {
    throw new Error("png filter dry-run: checksum mismatch");
  }
  const qc = validatePhase11ATypographicQc({ spec, composed: a });
  if (qc.status !== "accepted") throw new Error("png filter dry-run: typographic QC rejected");

  const content = createMemoryPhase11ARoleAssetContentPort();
  const assets = createMemoryAssetRepository();
  const parentPath = buildPhase11ARoleImageStoragePath({
    workspaceId: SYNTH_WS,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    assetId: SYNTH_PARENT,
    role: "provider",
  });
  const parentChecksum = checksumSha256Bytes(filteredProvider);
  const first = await ingestPhase11AComposedOverlay({
    workspaceId: SYNTH_WS,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    runId: SYNTH_RUN,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    stepId: "step-image",
    parentAssetId: SYNTH_PARENT,
    parentChecksumSha256: parentChecksum,
    parentStoragePath: parentPath,
    composed: a,
    overlay: spec,
    content,
    assets,
    nowIso: SYNTH_NOW,
    allowProductionStorage: false,
  });
  const replay = await ingestPhase11AComposedOverlay({
    workspaceId: SYNTH_WS,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    runId: SYNTH_RUN,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    stepId: "step-image",
    parentAssetId: SYNTH_PARENT,
    parentChecksumSha256: parentChecksum,
    parentStoragePath: parentPath,
    composed: a,
    overlay: spec,
    content,
    assets,
    nowIso: SYNTH_NOW,
    allowProductionStorage: false,
  });
  if (first.wrote !== true || replay.wrote !== false || replay.assetId !== first.assetId) {
    throw new Error("png filter dry-run: synthetic ingest replay not idempotent");
  }
  if (first.active !== false) {
    throw new Error("png filter dry-run: composed asset must stay inactive");
  }
  const expectedFp = fingerprintPhase11AComposedAsset({
    parentChecksumSha256: parentChecksum,
    overlay: spec,
  });
  if (expectedFp.length !== 64) {
    throw new Error("png filter dry-run: composed fingerprint invalid");
  }

  return {
    pngFiltersSupported: [0, 1, 2, 3, 4],
    providerAssetRead: false,
    providerCalled: false,
    compositorExecutable: true,
    overlaySpecValid: true,
    deterministicChecksum: true,
    ProductionStorageWrite: false,
    HumanReviewRequired: true,
    decoderStrategy: "internal_decodeRgbPng",
    interlacing: "rejected",
    formatsSupported: ["png_8bit_rgb_non_interlaced"],
    formatsRejected: ["rgba", "grayscale", "indexed", "adam7"],
    pixelDeterminismAcrossFilters: true,
    compositorDeterminism: true,
    overlayLocale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    overlayTitle: PHASE_11A_SCENE2_OVERLAY_TITLE,
    overlayCta: PHASE_11A_SCENE2_OVERLAY_CTA,
    overlayFingerprint: fingerprintImageTextOverlaySpec(spec),
    composedChecksumSha256: a.checksumSha256,
    typographicQcStatus: "accepted",
    compositorRuntime: PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
    futureComposedAssetIdStable: true,
    futurePreflightExecuted: false,
    productionRunMutated: false,
    syntheticReplayIdempotent: true,
  };
}
