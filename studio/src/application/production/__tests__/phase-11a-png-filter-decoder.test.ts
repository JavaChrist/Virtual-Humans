/**
 * Phase 11A-HARDEN-PNG — synthetic PNG filter decoder + compositor.
 * No Production media, no provider.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import {
  createDefaultPhase11AOverlaySpec,
  fingerprintImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";
import { composePhase11ADeterministicOverlay } from "../phase-11a-deterministic-compositor";
import { checksumSha256Bytes } from "../phase-11a-image-technical-qc";
import { validatePhase11ATypographicQc } from "../phase-11a-typographic-qc";
import { runPhase11APngFilterDecoderDryRun } from "../phase-11a-png-filter-decoder-dry-run";
import { syntheticPatternRgb } from "../phase-11a-png-filter-decoder-dry-run";
import {
  decodeRgbPng,
  encodeRgbPng,
  encodeRgbPngWithRowFilters,
  isPhase11APngError,
  paethPredictor,
  PHASE_11A_PNG_MAX_ENCODED_BYTES,
  PHASE_11A_PNG_SUPPORTED_FILTERS,
  Phase11APngError,
  readPhase11APngIhdr,
  solidRgbPng,
} from "../phase-11a-png-rgb";
import {
  PHASE_11A_SCENE2_OVERLAY_CTA,
  PHASE_11A_SCENE2_OVERLAY_LOCALE,
  PHASE_11A_SCENE2_OVERLAY_TITLE,
} from "../phase-11a-strip-overlay-copy-dry-run";
import {
  createMemoryPhase11ARoleAssetContentPort,
  fingerprintPhase11AComposedAsset,
  ingestPhase11AComposedOverlay,
} from "../phase-11a-composed-ingest";
import { createMemoryAssetRepository } from "../phase-11a-image-storage-ingest";
import { buildPhase11ARoleImageStoragePath } from "../phase-11a-image-role-storage";
import { PHASE_11A_SMOKE_PROJECT_ID, PHASE_11A_SMOKE_SCENE_ID } from "../phase-11a-openai-image-allowlist";
import { PHASE_11A_OVERLAY_FONT_FAMILY } from "@/domain/production/image-text-overlay";
import {
  assertPhase11ACompositionPreflightConfirm,
  assertPhase11ACompositionPreflightReportRedacted,
  assertPhase11AExistingProviderCompositionPreflightNotAuthorized,
  describePhase11AExistingProviderCompositionPreflight,
  redactChecksumPrefix,
} from "../phase-11a-existing-provider-composition-preflight";
import { inspectPhase11APngScanlineFilters } from "../phase-11a-png-scanline-filter-inspect";

const WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PARENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const NOW = "2026-08-14T00:00:00.000Z";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBytes, data]);
  return Buffer.concat([u32(data.length), typeBytes, data, u32(crc32(crcInput))]);
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function ihdr(opts: {
  width: number;
  height: number;
  bitDepth?: number;
  colorType?: number;
  compression?: number;
  filterMethod?: number;
  interlace?: number;
}): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(opts.width >>> 0, 0);
  data.writeUInt32BE(opts.height >>> 0, 4);
  data[8] = opts.bitDepth ?? 8;
  data[9] = opts.colorType ?? 2;
  data[10] = opts.compression ?? 0;
  data[11] = opts.filterMethod ?? 0;
  data[12] = opts.interlace ?? 0;
  return data;
}

function wrapPng(ihdrData: Buffer, raw: Uint8Array, extra?: Buffer[]): Uint8Array {
  const parts = [
    PNG_SIG,
    chunk("IHDR", ihdrData),
    ...(extra ?? []),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ];
  return Buffer.concat(parts);
}

function assertCode(fn: () => unknown, code: string): void {
  try {
    fn();
    assert.fail(`expected ${code}`);
  } catch (err) {
    assert.equal(isPhase11APngError(err), true);
    assert.equal((err as Phase11APngError).code, code);
  }
}

function scene2Spec() {
  return createDefaultPhase11AOverlaySpec({
    locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    title: PHASE_11A_SCENE2_OVERLAY_TITLE,
    callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
  });
}

test("11A-PNG — Paeth predictor spec edges", () => {
  assert.equal(paethPredictor(0, 0, 0), 0);
  assert.equal(paethPredictor(10, 20, 10), 20);
  assert.equal(paethPredictor(255, 0, 0), 255);
  assert.equal(paethPredictor(0, 255, 0), 255);
  assert.equal(paethPredictor(100, 100, 200), 100);
  assert.equal(paethPredictor(50, 200, 50), 200);
});

test("11A-PNG — filters 0-4 and mixed rows reconstruct the same pixels", () => {
  const rgb = syntheticPatternRgb(16, 8);
  const baseline = decodeRgbPng(encodeRgbPng({ width: 16, height: 8, rgb }));
  for (const filter of PHASE_11A_PNG_SUPPORTED_FILTERS) {
    const png = encodeRgbPngWithRowFilters({ width: 16, height: 8, rgb }, Array(8).fill(filter));
    const out = decodeRgbPng(png);
    assert.equal(out.width, 16);
    assert.equal(out.height, 8);
    assert.deepEqual(out.rgb, baseline.rgb);
  }
  const mixed = encodeRgbPngWithRowFilters(
    { width: 16, height: 8, rgb },
    [0, 1, 2, 3, 4, 4, 1, 0],
  );
  assert.deepEqual(decodeRgbPng(mixed).rgb, baseline.rgb);
});

test("11A-PNG — first row / first column / modulo 256", () => {
  const rgb = new Uint8Array([
    0, 0, 0, 255, 1, 2, 3, 4, 5, 250, 251, 252, 10, 20, 30, 200, 210, 220, 1, 2, 3, 254, 255, 0,
  ]);
  const png = encodeRgbPngWithRowFilters({ width: 4, height: 2, rgb }, [4, 3]);
  assert.deepEqual(decodeRgbPng(png).rgb, rgb);
});

test("11A-PNG — encode filter 0 roundtrip unchanged", () => {
  const png = solidRgbPng({ width: 8, height: 8, r: 40, g: 48, b: 62 });
  const a = decodeRgbPng(png);
  const b = decodeRgbPng(encodeRgbPng(a));
  assert.deepEqual(a.rgb, b.rgb);
  assert.equal(readPhase11APngIhdr(png).colorType, 2);
  assert.equal(readPhase11APngIhdr(png).interlace, 0);
});

test("11A-PNG — reject filter 5, truncated, CRC, unknown critical", () => {
  const rgb = syntheticPatternRgb(4, 2);
  const raw = Buffer.alloc((4 * 3 + 1) * 2);
  raw[0] = 5;
  raw[13] = 0;
  raw.set(rgb.subarray(0, 12), 1);
  raw.set(rgb.subarray(12), 14);
  const filter5 = wrapPng(ihdr({ width: 4, height: 2 }), raw);
  assertCode(() => decodeRgbPng(filter5), "unknown_filter");

  const ok = encodeRgbPng({ width: 4, height: 2, rgb });
  assertCode(() => decodeRgbPng(ok.subarray(0, 20)), "truncated");

  const crcBroken = Uint8Array.from(ok);
  crcBroken[ok.length - 1] = ((crcBroken[ok.length - 1] ?? 0) ^ 0xff) as number;
  assertCode(() => decodeRgbPng(crcBroken), "invalid_crc");

  const hostile = Buffer.concat([
    PNG_SIG,
    chunk("IHDR", ihdr({ width: 4, height: 2 })),
    chunk("FAKE", new Uint8Array([1])),
    chunk("IDAT", deflateSync(Buffer.alloc((4 * 3 + 1) * 2), { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
  assertCode(() => decodeRgbPng(hostile), "unknown_critical_chunk");
});

test("11A-PNG — reject unsupported formats and hostile dimensions", () => {
  const emptyRaw = Buffer.alloc(0);
  assertCode(
    () => decodeRgbPng(wrapPng(ihdr({ width: 4, height: 2, colorType: 0 }), emptyRaw)),
    "grayscale_unsupported",
  );
  assertCode(
    () => decodeRgbPng(wrapPng(ihdr({ width: 4, height: 2, colorType: 3 }), emptyRaw)),
    "indexed_unsupported",
  );
  assertCode(
    () => decodeRgbPng(wrapPng(ihdr({ width: 4, height: 2, colorType: 6 }), emptyRaw)),
    "rgba_unsupported",
  );
  assertCode(
    () => decodeRgbPng(wrapPng(ihdr({ width: 4, height: 2, bitDepth: 16 }), emptyRaw)),
    "unsupported_bit_depth",
  );
  assertCode(
    () => decodeRgbPng(wrapPng(ihdr({ width: 4, height: 2, interlace: 1 }), emptyRaw)),
    "interlaced_unsupported",
  );
  assertCode(
    () => decodeRgbPng(wrapPng(ihdr({ width: 0, height: 4 }), emptyRaw)),
    "invalid_dimensions",
  );
  assertCode(
    () => decodeRgbPng(wrapPng(ihdr({ width: 2048, height: 4 }), emptyRaw)),
    "invalid_dimensions",
  );
  assertCode(() => decodeRgbPng(new Uint8Array(PHASE_11A_PNG_MAX_ENCODED_BYTES + 1)), "encoded_too_large");
});

test("11A-PNG — truncated IDAT and decompression bomb", () => {
  const tiny = wrapPng(ihdr({ width: 4, height: 2 }), Buffer.from([0x78, 0x9c]));
  try {
    decodeRgbPng(tiny);
    assert.fail("expected truncated IDAT rejection");
  } catch (err) {
    assert.equal(isPhase11APngError(err), true);
    const code = (err as Phase11APngError).code;
    assert.equal(["idat_truncated", "inflated_size_mismatch"].includes(code), true);
  }

  const bombRaw = Buffer.alloc(1);
  const bomb = Buffer.concat([
    PNG_SIG,
    chunk("IHDR", ihdr({ width: 1024, height: 1024 })),
    chunk("IDAT", deflateSync(bombRaw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
  try {
    decodeRgbPng(bomb);
    assert.fail("expected bomb rejection");
  } catch (err) {
    assert.equal(isPhase11APngError(err), true);
    const code = (err as Phase11APngError).code;
    assert.equal(["idat_truncated", "inflated_size_mismatch", "decompression_bomb"].includes(code), true);
  }
});

test("11A-PNG — compositor French overlay is filter-invariant and deterministic", () => {
  const spec = scene2Spec();
  assert.equal(spec.locale, "fr");
  assert.equal(spec.title, "De l’idée à la structure");
  assert.equal(spec.callToAction, "Découvrir Virtual Humans Studio");
  assert.equal(spec.fontFamily, PHASE_11A_OVERLAY_FONT_FAMILY);
  assert.equal(spec.title.includes("\u2019"), true);

  const rgb = syntheticPatternRgb(1024, 1024);
  const none = encodeRgbPng({ width: 1024, height: 1024, rgb });
  const paeth = encodeRgbPngWithRowFilters({ width: 1024, height: 1024, rgb }, Array(1024).fill(4));
  const mixed = encodeRgbPngWithRowFilters(
    { width: 1024, height: 1024, rgb },
    Array.from({ length: 1024 }, (_, y) => y % 5),
  );
  const a = composePhase11ADeterministicOverlay({ providerPng: none, spec });
  const b = composePhase11ADeterministicOverlay({ providerPng: paeth, spec });
  const c = composePhase11ADeterministicOverlay({ providerPng: mixed, spec });
  assert.equal(a.checksumSha256, b.checksumSha256);
  assert.equal(a.checksumSha256, c.checksumSha256);
  assert.equal(a.checksumSha256, checksumSha256Bytes(a.png));
  assert.deepEqual(a.renderedStrings, [spec.title, spec.callToAction]);
  assert.ok(a.lineBoxes.some((l) => l.role === "title" && l.text.includes("idée")));
  assert.ok(a.lineBoxes.some((l) => l.role === "callToAction"));
  const qc = validatePhase11ATypographicQc({ spec, composed: a });
  assert.equal(qc.status, "accepted");
  assert.equal(fingerprintImageTextOverlaySpec(spec), fingerprintImageTextOverlaySpec(scene2Spec()));
});

test("11A-PNG — overflow reject and contrast still fail-closed", () => {
  const spec = scene2Spec();
  spec.maxLines = 1;
  spec.title = "Un titre volontairement beaucoup trop long pour une seule ligne overlay";
  spec.fontSize = 64;
  const png = encodeRgbPngWithRowFilters(
    { width: 1024, height: 1024, rgb: syntheticPatternRgb(1024, 1024) },
    Array(1024).fill(1),
  );
  assert.throws(
    () => composePhase11ADeterministicOverlay({ providerPng: png, spec }),
    /overlay_overflow/,
  );
});

test("11A-PNG — synthetic parent/child ingest replay", async () => {
  const spec = scene2Spec();
  const png = encodeRgbPngWithRowFilters(
    { width: 1024, height: 1024, rgb: syntheticPatternRgb(1024, 1024) },
    Array(1024).fill(2),
  );
  const composed = composePhase11ADeterministicOverlay({ providerPng: png, spec });
  const content = createMemoryPhase11ARoleAssetContentPort();
  const assets = createMemoryAssetRepository();
  const providerPath = buildPhase11ARoleImageStoragePath({
    workspaceId: WS,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    assetId: PARENT_ID,
    role: "provider",
  });
  const first = await ingestPhase11AComposedOverlay({
    workspaceId: WS,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    runId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    stepId: "step-image",
    parentAssetId: PARENT_ID,
    parentChecksumSha256: checksumSha256Bytes(png),
    parentStoragePath: providerPath,
    composed,
    overlay: spec,
    content,
    assets,
    nowIso: NOW,
  });
  const replay = await ingestPhase11AComposedOverlay({
    workspaceId: WS,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    runId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    stepId: "step-image",
    parentAssetId: PARENT_ID,
    parentChecksumSha256: checksumSha256Bytes(png),
    parentStoragePath: providerPath,
    composed,
    overlay: spec,
    content,
    assets,
    nowIso: NOW,
  });
  assert.equal(first.wrote, true);
  assert.equal(replay.wrote, false);
  assert.equal(replay.assetId, first.assetId);
  assert.equal(first.active, false);
  assert.equal(
    fingerprintPhase11AComposedAsset({
      parentChecksumSha256: checksumSha256Bytes(png),
      overlay: spec,
    }).length,
    64,
  );
});

test("11A-PNG — future composition preflight is prepared and not executable", () => {
  const plan = describePhase11AExistingProviderCompositionPreflight();
  assert.equal(plan.prepared, true);
  assert.equal(plan.executed, false);
  assert.equal(plan.providerAssetRead, false);
  assert.equal(plan.providerCalled, false);
  assert.equal(plan.ProductionStorageWrite, false);
  assert.equal(plan.authorizationRequired, "AUTH_11A_COMPOSE_EXISTING_PROVIDER_PNG_FILTERS");
  assert.throws(
    () => assertPhase11AExistingProviderCompositionPreflightNotAuthorized(),
    /not authorized/,
  );
});

test("11A-PNG — scanline filter inspect returns unique numeric filters only", () => {
  const rgb = syntheticPatternRgb(8, 8);
  const png = encodeRgbPngWithRowFilters({ width: 8, height: 8, rgb }, [0, 1, 2, 3, 4, 0, 1, 2]);
  assert.deepEqual(inspectPhase11APngScanlineFilters(png), [0, 1, 2, 3, 4]);
  const decoded = decodeRgbPng(png);
  assert.equal(decoded.width, 8);
  assert.equal(JSON.stringify(inspectPhase11APngScanlineFilters(png)).includes("data:image"), false);
});

test("11A-PNG — composition preflight confirm and redaction guards", () => {
  assert.throws(
    () => assertPhase11ACompositionPreflightConfirm({}),
    /CONFIRM_PHASE_11A_EXISTING_PROVIDER_COMPOSITION_PREFLIGHT required/,
  );
  assert.throws(
    () =>
      assertPhase11ACompositionPreflightConfirm({
        CONFIRM_PHASE_11A_EXISTING_PROVIDER_COMPOSITION_PREFLIGHT: "1",
        PHASE_11A_ALLOW_EXECUTE: "1",
      }),
    /PHASE_11A_ALLOW_EXECUTE is forbidden/,
  );
  assertPhase11ACompositionPreflightConfirm({
    CONFIRM_PHASE_11A_EXISTING_PROVIDER_COMPOSITION_PREFLIGHT: "1",
  });
  assert.equal(redactChecksumPrefix("1ac51f484420ef88abcdef0123456789"), "1ac51f484420ef88");
  assert.throws(
    () =>
      assertPhase11ACompositionPreflightReportRedacted(
        JSON.stringify({ url: "https://example.supabase.co/storage/v1/object/sign/x?token=abc" }),
      ),
    /preflight report leak/,
  );
  assertPhase11ACompositionPreflightReportRedacted(
    JSON.stringify({
      verdict: "READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION",
      composedChecksumPrefix: "abcd1234abcd1234",
      pngFiltersEncountered: [0, 2],
    }),
  );
});

test("11A-PNG — local dry-run flags", async () => {
  const report = await runPhase11APngFilterDecoderDryRun();
  assert.deepEqual(report.pngFiltersSupported, [0, 1, 2, 3, 4]);
  assert.equal(report.providerAssetRead, false);
  assert.equal(report.providerCalled, false);
  assert.equal(report.compositorExecutable, true);
  assert.equal(report.overlaySpecValid, true);
  assert.equal(report.deterministicChecksum, true);
  assert.equal(report.ProductionStorageWrite, false);
  assert.equal(report.HumanReviewRequired, true);
  assert.equal(report.futurePreflightExecuted, false);
  assert.equal(report.overlayTitle, PHASE_11A_SCENE2_OVERLAY_TITLE);
  assert.equal(report.overlayCta, PHASE_11A_SCENE2_OVERLAY_CTA);
  assert.equal(JSON.stringify(report).includes("data:image"), false);
  assert.equal(/https?:\/\//i.test(JSON.stringify(report)), false);
});
