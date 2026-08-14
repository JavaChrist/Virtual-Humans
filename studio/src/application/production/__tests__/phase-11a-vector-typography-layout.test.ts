/**
 * Phase 11A compositor 1.2.0 — local vector typography/layout.
 * Synthetic fixtures only. No Production media. No provider.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDefaultPhase11AOverlaySpec,
  createPhase11AProfessionalOverlaySpec,
  fingerprintImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";
import {
  PHASE_11A_SCENE2_OVERLAY_CTA,
  PHASE_11A_SCENE2_OVERLAY_LOCALE,
  PHASE_11A_SCENE2_OVERLAY_TITLE,
} from "../phase-11a-strip-overlay-copy-dry-run";
import {
  composePhase11ADeterministicOverlay,
  PHASE_11A_COMPOSITOR_VERSION,
} from "../phase-11a-deterministic-compositor";
import { composePhase11AVectorOverlay, PHASE_11A_VECTOR_COMPOSITOR_VERSION } from "../phase-11a-vector-compositor";
import {
  hasPhase11AVectorGlyph,
  measurePhase11AVectorText,
  PHASE_11A_VECTOR_FONT_FAMILY,
  PHASE_11A_VECTOR_FONT_ID,
  PHASE_11A_VECTOR_FONT_LICENSE,
  rasterizePhase11AVectorGlyph,
  vectorAdvance,
  vectorKerning,
} from "../phase-11a-overlay-latin-vector";
import {
  PHASE_11A_LAYOUT_12_CTA_SIZE,
  PHASE_11A_LAYOUT_12_SAFE_AREA,
  PHASE_11A_LAYOUT_12_TITLE_SIZE,
  PHASE_11A_LAYOUT_VERSION,
  assertPhase11ANoOrphanStudio,
  choosePhase11APanelAlpha,
  planPhase11ALayout12,
  wrapPhase11AOverlayLines,
} from "../phase-11a-overlay-layout-1-2";
import { validatePhase11ATypographicQc } from "../phase-11a-typographic-qc";
import {
  createMemoryPhase11ARoleAssetContentPort,
  fingerprintPhase11AComposedAsset,
  ingestPhase11AComposedOverlay,
} from "../phase-11a-composed-ingest";
import { createMemoryAssetRepository } from "../phase-11a-image-storage-ingest";
import { buildPhase11ARoleImageStoragePath } from "../phase-11a-image-role-storage";
import { checksumSha256Bytes } from "../phase-11a-image-technical-qc";
import { legacyHashGlyphRows } from "../phase-11a-overlay-latin-bitmap";
import {
  assertPhase11AOverlayPipelineGuards,
} from "../phase-11a-overlay-review";
import { PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME } from "../phase-11a-deterministic-compositor";
import {
  syntheticDarkPng,
  syntheticLightPng,
  syntheticScene2GridPng,
  syntheticVariableContrastPng,
} from "../phase-11a-overlay-synthetic-fixtures";

const TITLE = PHASE_11A_SCENE2_OVERLAY_TITLE;
const CTA = PHASE_11A_SCENE2_OVERLAY_CTA;
const WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PROJECT = "984507af-a89e-4644-8ea3-344797baa974";
const PARENT = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const NOW = "2026-08-14T00:00:00.000Z";

function professional(input?: { title?: string; callToAction?: string }) {
  return createPhase11AProfessionalOverlaySpec({
    locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    title: input?.title ?? TITLE,
    callToAction: input?.callToAction ?? CTA,
  });
}

test("11A-1.2.0 — vector font coverage, licence, accents, U+2019, fail-closed", () => {
  assert.equal(PHASE_11A_VECTOR_FONT_FAMILY, "vhs-overlay-latin-vector-v1");
  assert.equal(PHASE_11A_VECTOR_FONT_ID, "vhs-overlay-latin-vector-outlines-v1");
  assert.equal(PHASE_11A_VECTOR_FONT_LICENSE, "original-work-in-repo");
  for (const ch of [...TITLE, ...CTA]) {
    assert.equal(hasPhase11AVectorGlyph(ch.codePointAt(0)!), true, ch);
  }
  assert.equal(hasPhase11AVectorGlyph(0x2019), true);
  assert.equal(hasPhase11AVectorGlyph("é".codePointAt(0)!), true);
  assert.equal(hasPhase11AVectorGlyph("à".codePointAt(0)!), true);
  assert.equal(hasPhase11AVectorGlyph("你".codePointAt(0)!), false);
  const raster = rasterizePhase11AVectorGlyph("é".codePointAt(0)!, 40, true);
  assert.ok(raster.coverage.some((v) => v > 200));
  assert.throws(
    () => measurePhase11AVectorText("你好", 40),
    /overlay_glyph_unsupported/i,
  );
});

test("11A-1.2.0 — metrics, kerning, tracking", () => {
  const plain = measurePhase11AVectorText("VA", 40, 0);
  const kerned = measurePhase11AVectorText("VA", 40, 0);
  assert.equal(plain, kerned);
  assert.ok(vectorKerning("V".codePointAt(0)!, "A".codePointAt(0)!) < 0);
  assert.ok(vectorAdvance("M".codePointAt(0)!) > vectorAdvance("I".codePointAt(0)!));
  const tracked = measurePhase11AVectorText("Studio", 22, 8);
  const tight = measurePhase11AVectorText("Studio", 22, 0);
  assert.ok(tracked > tight);
});

test("11A-1.2.0 — wrap, anti-orphan, exact French layout", () => {
  const planned = planPhase11ALayout12({
    title: TITLE,
    callToAction: CTA,
    canvas: 1024,
    safe: PHASE_11A_LAYOUT_12_SAFE_AREA,
  });
  assertPhase11ANoOrphanStudio(planned);
  assert.equal(planned.filter((l) => l.role === "title").length <= 2, true);
  assert.equal(planned.filter((l) => l.role === "callToAction").join(" ") !== "Studio", true);
  const cta = planned.filter((l) => l.role === "callToAction");
  assert.equal(cta.map((l) => l.text).join(" "), CTA);
  assert.notEqual(cta[cta.length - 1]?.text, "Studio");
  assert.ok((planned.find((l) => l.role === "title")?.fontSize ?? 0) >= PHASE_11A_LAYOUT_12_TITLE_SIZE - 8);
  assert.ok((cta[0]?.fontSize ?? 0) <= PHASE_11A_LAYOUT_12_CTA_SIZE);
  assert.ok((planned.find((l) => l.role === "title")?.fontSize ?? 0) > (cta[0]?.fontSize ?? 0));

  const rebalanced = wrapPhase11AOverlayLines(
    "Découvrir Virtual Humans Studio",
    measurePhase11AVectorText("Découvrir Virtual Humans", 22, 8) + 4,
    22,
    8,
  );
  assert.notEqual(rebalanced[rebalanced.length - 1], "Studio");
});

test("11A-1.2.0 — contrast policy on dark and light", () => {
  const dark = choosePhase11APanelAlpha({
    meanBg: [28, 32, 40],
    textHex: "#F4F0E8",
    minContrast: 4.5,
  });
  const light = choosePhase11APanelAlpha({
    meanBg: [236, 232, 224],
    textHex: "#F4F0E8",
    minContrast: 4.5,
  });
  assert.ok(dark.contrast + 1e-9 >= 4.5);
  assert.ok(light.contrast + 1e-9 >= 4.5);
  assert.ok(light.alpha >= dark.alpha);
});

test("11A-1.2.0 — compose exact copy, hierarchy, no orphan, QC, determinism", () => {
  const spec = professional();
  assert.equal(spec.title, TITLE);
  assert.equal(spec.callToAction, CTA);
  assert.equal(spec.title.includes("\u2019"), true);
  assert.equal(spec.locale, "fr");
  const png = syntheticScene2GridPng();
  const a = composePhase11AVectorOverlay({ providerPng: png, spec });
  const b = composePhase11AVectorOverlay({ providerPng: png, spec });
  assert.equal(a.checksumSha256, b.checksumSha256);
  assert.equal(a.checksumSha256, checksumSha256Bytes(a.png));
  assert.equal(
    a.checksumSha256,
    "6bf3bc9dbe1912ba47eede1aa5a197980d81893372e1af9dd393d35bd365d2a7",
  );
  assert.deepEqual(a.lineBoxes, b.lineBoxes);
  assert.equal(a.compositorVersion, PHASE_11A_VECTOR_COMPOSITOR_VERSION);
  assert.equal(a.fontFamily, PHASE_11A_VECTOR_FONT_FAMILY);
  assert.deepEqual(a.renderedStrings, [TITLE, CTA]);
  assert.notEqual(a.lineBoxes.at(-1)?.text, "Studio");
  assert.ok(a.contrastRatio + 1e-9 >= 4.5);
  const titleH = a.lineBoxes.find((l) => l.role === "title")!.height;
  const ctaH = a.lineBoxes.find((l) => l.role === "callToAction")!.height;
  assert.ok(titleH > ctaH);
  const qc = validatePhase11ATypographicQc({ spec, composed: a });
  assert.equal(qc.status, "accepted", qc.reasons.map((r) => r.code).join(","));
  assert.equal(JSON.stringify(a.redactedMetadata).includes("http"), false);
});

test("11A-1.2.0 — dark / light / variable fixtures stay readable and deterministic", () => {
  const spec = professional();
  for (const png of [syntheticDarkPng(), syntheticLightPng(), syntheticVariableContrastPng()]) {
    const a = composePhase11AVectorOverlay({ providerPng: png, spec });
    const b = composePhase11AVectorOverlay({ providerPng: png, spec });
    assert.equal(a.checksumSha256, b.checksumSha256);
    assert.ok(a.contrastRatio + 1e-9 >= 4.5);
    assert.equal(validatePhase11ATypographicQc({ spec, composed: a }).status, "accepted");
  }
});

test("11A-1.2.0 — short, long, overflow, hostile, unsupported", () => {
  const bg = syntheticDarkPng();
  const short = composePhase11AVectorOverlay({
    providerPng: bg,
    spec: professional({ title: "Idée", callToAction: "Studio" }),
  });
  assert.equal(short.lineBoxes.filter((l) => l.role === "title").length, 1);

  const long = composePhase11AVectorOverlay({
    providerPng: bg,
    spec: professional({
      title: "De l’idée à la structure narrative claire",
      callToAction: CTA,
    }),
  });
  assert.ok(long.lineBoxes.filter((l) => l.role === "title").length >= 1);
  assert.equal(long.renderedStrings[0], "De l’idée à la structure narrative claire");

  assert.throws(
    () =>
      composePhase11AVectorOverlay({
        providerPng: bg,
        spec: professional({ title: "你好" }),
      }),
    /overlay_glyph_unsupported/i,
  );

  const hostile = professional();
  hostile.safeArea = { top: 980, right: 72, bottom: 20, left: 72 };
  assert.throws(
    () => composePhase11AVectorOverlay({ providerPng: bg, spec: hostile }),
    /overlay_overflow|overlay_safe_area|overlay_clipping/,
  );
});

test("11A-1.2.0 — 1.1.0 and 1.0.0 remain isolated; composed identity changes", () => {
  const bitmapSpec = createDefaultPhase11AOverlaySpec({
    locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    title: TITLE,
    callToAction: CTA,
  });
  const vectorSpec = professional();
  const png = syntheticScene2GridPng();
  const v11 = composePhase11ADeterministicOverlay({ providerPng: png, spec: bitmapSpec });
  const v12 = composePhase11AVectorOverlay({ providerPng: png, spec: vectorSpec });
  assert.equal(v11.compositorVersion, PHASE_11A_COMPOSITOR_VERSION);
  assert.equal(v12.compositorVersion, PHASE_11A_VECTOR_COMPOSITOR_VERSION);
  assert.notEqual(v11.checksumSha256, v12.checksumSha256);
  assert.notEqual(fingerprintImageTextOverlaySpec(bitmapSpec), fingerprintImageTextOverlaySpec(vectorSpec));
  assert.notEqual(
    fingerprintPhase11AComposedAsset({
      parentChecksumSha256: checksumSha256Bytes(png),
      overlay: bitmapSpec,
      compositorVersion: PHASE_11A_COMPOSITOR_VERSION,
    }),
    fingerprintPhase11AComposedAsset({
      parentChecksumSha256: checksumSha256Bytes(png),
      overlay: vectorSpec,
      compositorVersion: PHASE_11A_VECTOR_COMPOSITOR_VERSION,
    }),
  );
  assert.equal(validatePhase11ATypographicQc({ spec: bitmapSpec, composed: v11 }).status, "accepted");
  const hashed = legacyHashGlyphRows("A".codePointAt(0)!);
  assert.equal(hashed.length, 8);
  assert.equal(PHASE_11A_LAYOUT_VERSION, "phase-11a-overlay-layout-1.2.0");
});

test("11A-1.2.0 — memory ingest idempotent, no real Storage, guards", async () => {
  const spec = professional();
  const png = syntheticDarkPng();
  const composed = composePhase11AVectorOverlay({ providerPng: png, spec });
  const content = createMemoryPhase11ARoleAssetContentPort();
  const assets = createMemoryAssetRepository();
  const providerPath = buildPhase11ARoleImageStoragePath({
    workspaceId: WS,
    projectId: PROJECT,
    assetId: PARENT,
    role: "provider",
  });
  await content.put({
    workspaceId: WS,
    projectId: PROJECT,
    assetId: PARENT,
    mimeType: "image/png",
    bytes: png,
    storagePath: providerPath,
  });
  const writes = content.writeCount;
  const first = await ingestPhase11AComposedOverlay({
    workspaceId: WS,
    projectId: PROJECT,
    runId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    sceneId: "3c308f57-f448-40ba-aaca-bc0d8d546d01",
    stepId: "step-image",
    parentAssetId: PARENT,
    parentChecksumSha256: checksumSha256Bytes(png),
    parentStoragePath: providerPath,
    composed,
    overlay: spec,
    content,
    assets,
    nowIso: NOW,
  });
  assert.equal(first.wrote, true);
  assert.equal(first.active, false);
  const replay = await ingestPhase11AComposedOverlay({
    workspaceId: WS,
    projectId: PROJECT,
    runId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    sceneId: "3c308f57-f448-40ba-aaca-bc0d8d546d01",
    stepId: "step-image",
    parentAssetId: PARENT,
    parentChecksumSha256: checksumSha256Bytes(png),
    parentStoragePath: providerPath,
    composed,
    overlay: spec,
    content,
    assets,
    nowIso: NOW,
  });
  assert.equal(replay.wrote, false);
  assert.equal(content.writeCount, writes + 1);
  assertPhase11AOverlayPipelineGuards({
    overlayRuntime: PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
    legacyEndpoint: false,
    motionReferenced: false,
    downstreamRequested: false,
    humanReviewPresent: true,
    providerCalls: 0,
  });
});
