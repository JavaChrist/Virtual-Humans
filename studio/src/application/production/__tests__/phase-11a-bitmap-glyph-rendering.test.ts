/**
 * Phase 11A bitmap glyph diagnosis — pixel tests, no Production media, no provider.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPhase11AOverlaySpec } from "@/domain/production/image-text-overlay";
import {
  PHASE_11A_SCENE2_OVERLAY_CTA,
  PHASE_11A_SCENE2_OVERLAY_LOCALE,
  PHASE_11A_SCENE2_OVERLAY_TITLE,
} from "../phase-11a-strip-overlay-copy-dry-run";
import {
  composePhase11ADeterministicOverlay,
  PHASE_11A_COMPOSITOR_VERSION,
} from "../phase-11a-deterministic-compositor";
import {
  glyphRowsForCodepoint,
  isPhase11AOverlayCodepointAllowed,
  measureOverlayTextWidth,
} from "../phase-11a-overlay-font";
import {
  bitmapGlyphInkCount,
  glyphRowsEqual,
  legacyHashGlyphRows,
  listPhase11ABitmapGlyphCodepoints,
  overlayCodepoints,
  PHASE_11A_BITMAP_GLYPH_ATLAS_ID,
} from "../phase-11a-overlay-latin-bitmap";
import { checksumSha256Bytes } from "../phase-11a-image-technical-qc";
import { decodeRgbPng, encodeRgbPng } from "../phase-11a-png-rgb";
import { validatePhase11ATypographicQc } from "../phase-11a-typographic-qc";

const TITLE = PHASE_11A_SCENE2_OVERLAY_TITLE;
const CTA = PHASE_11A_SCENE2_OVERLAY_CTA;
const SENSITIVE = ["D", "e", "l", "i", "d", "é", "à", "\u2019", "V", "H", "S"] as const;

function sceneOverlay() {
  return createDefaultPhase11AOverlaySpec({
    locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    title: TITLE,
    callToAction: CTA,
  });
}

function gridPng(): Uint8Array {
  const rgb = new Uint8Array(1024 * 1024 * 3);
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const i = (y * 1024 + x) * 3;
      const cell = ((Math.floor(x / 32) + Math.floor(y / 32)) & 1) === 0;
      rgb[i] = cell ? 0x3a : 0x52;
      rgb[i + 1] = cell ? 0x44 : 0x5c;
      rgb[i + 2] = cell ? 0x58 : 0x6a;
    }
  }
  return encodeRgbPng({ width: 1024, height: 1024, rgb });
}

function sampleCell(
  rgb: Uint8Array,
  originX: number,
  originY: number,
  scale: number,
): Uint8Array {
  const rows = new Uint8Array(8);
  for (let gy = 0; gy < 8; gy++) {
    let bits = 0;
    for (let gx = 0; gx < 8; gx++) {
      let ink = 0;
      for (let py = 0; py < scale; py++) {
        for (let px = 0; px < scale; px++) {
          const x = originX + gx * scale + px;
          const y = originY + gy * scale + py;
          const i = (y * 1024 + x) * 3;
          if ((rgb[i] ?? 0) > 0xc0) ink += 1;
        }
      }
      if (ink > (scale * scale) / 2) bits |= 1 << (7 - gx);
    }
    rows[gy] = bits;
  }
  return rows;
}

test("11A-GLYPH — required Unicode coverage is explicit and fail-closed", () => {
  const required = overlayCodepoints(`${TITLE}${CTA}`);
  const unique = [...new Set(required)];
  assert.equal(unique.length, 22);
  assert.ok(unique.includes(0x44)); // D
  assert.ok(unique.includes(0x20));
  assert.ok(unique.includes(0x00e9)); // é
  assert.ok(unique.includes(0x00e0)); // à
  assert.ok(unique.includes(0x2019));
  for (const cp of unique) {
    assert.equal(isPhase11AOverlayCodepointAllowed(cp), true, `U+${cp.toString(16)}`);
    const rows = glyphRowsForCodepoint(cp);
    assert.equal(rows.length, 8);
    if (cp !== 0x20 && cp !== 0xa0) {
      assert.ok(bitmapGlyphInkCount(rows) >= 3, `empty U+${cp.toString(16)}`);
      assert.equal(glyphRowsEqual(rows, legacyHashGlyphRows(cp)), false, `still hash U+${cp.toString(16)}`);
    }
  }
  assert.throws(() => glyphRowsForCodepoint(0x4f60), /overlay_glyph_unsupported:U\+4F60/);
  assert.equal(PHASE_11A_BITMAP_GLYPH_ATLAS_ID, "vhs-overlay-latin-bitmap-shapes-v1");
  assert.ok(listPhase11ABitmapGlyphCodepoints().length >= 95);
});

test("11A-GLYPH — sensitive glyphs have distinct pixels, advance and no mutual collision", () => {
  const seen = new Set<string>();
  for (const ch of SENSITIVE) {
    const cp = ch.codePointAt(0) ?? 0;
    const rows = glyphRowsForCodepoint(cp);
    const key = Buffer.from(rows).toString("hex");
    assert.equal(seen.has(key), false, `collision ${ch}`);
    seen.add(key);
    assert.equal(measureOverlayTextWidth(ch, 32), 32);
    if (ch !== "\u2019") assert.ok(bitmapGlyphInkCount(rows) >= 6);
  }
  assert.equal(glyphRowsEqual(glyphRowsForCodepoint(0x00e9), glyphRowsForCodepoint(0x65)), false);
  assert.equal(glyphRowsEqual(glyphRowsForCodepoint(0x00e0), glyphRowsForCodepoint(0x61)), false);
  assert.equal(glyphRowsEqual(glyphRowsForCodepoint(0x2019), glyphRowsForCodepoint(0x27)), false);
});

test("11A-GLYPH — title, CTA and full overlay paint exact glyph pixels", () => {
  const spec = sceneOverlay();
  spec.fontWeight = "regular";
  const provider = gridPng();
  const titleOnly = createDefaultPhase11AOverlaySpec({ locale: "fr", title: TITLE });
  titleOnly.fontWeight = "regular";
  const ctaOnly = createDefaultPhase11AOverlaySpec({ locale: "fr", title: "X", callToAction: CTA });
  ctaOnly.fontWeight = "regular";
  const title = composePhase11ADeterministicOverlay({ providerPng: provider, spec: titleOnly });
  const cta = composePhase11ADeterministicOverlay({ providerPng: provider, spec: ctaOnly });
  const full = composePhase11ADeterministicOverlay({ providerPng: provider, spec });
  assert.equal(title.renderedStrings[0], TITLE);
  assert.equal(cta.renderedStrings[1], CTA);
  assert.deepEqual(full.renderedStrings, [TITLE, CTA]);
  assert.equal(full.fontFamily, "vhs-overlay-latin-bitmap-v1");
  assert.equal(full.compositorVersion, "phase-11a-bitmap-compositor-1.1.0");
  assert.equal(PHASE_11A_COMPOSITOR_VERSION, "phase-11a-bitmap-compositor-1.1.0");

  const decoded = decodeRgbPng(full.png);
  const scale = spec.fontSize / 8;
  const titleBox = full.lineBoxes.find((b) => b.role === "title");
  assert.ok(titleBox);
  const cps = overlayCodepoints(TITLE);
  for (let i = 0; i < cps.length; i++) {
    const sampled = sampleCell(decoded.rgb, titleBox!.x + i * spec.fontSize, titleBox!.y, scale);
    const expected = glyphRowsForCodepoint(cps[i]!);
    assert.deepEqual([...sampled], [...expected], `title[${i}] U+${cps[i]!.toString(16)}`);
  }
  const qc = validatePhase11ATypographicQc({ spec, composed: full });
  assert.equal(qc.status, "accepted");
  assert.ok(full.contrastRatio + 1e-9 >= 4.5);
});

test("11A-GLYPH — golden synthetic overlay is deterministic and stays in safe area", () => {
  const spec = sceneOverlay();
  const provider = gridPng();
  const a = composePhase11ADeterministicOverlay({ providerPng: provider, spec });
  const b = composePhase11ADeterministicOverlay({ providerPng: provider, spec });
  assert.equal(a.checksumSha256, b.checksumSha256);
  assert.equal(a.checksumSha256, checksumSha256Bytes(a.png));
  assert.deepEqual(a.lineBoxes, b.lineBoxes);
  assert.equal(a.png.length, b.png.length);
  for (let i = 0; i < a.png.length; i++) assert.equal(a.png[i], b.png[i]);
  const pad = spec.safeArea;
  for (const box of a.lineBoxes) {
    assert.ok(box.x >= pad.left);
    assert.ok(box.y >= pad.top);
    assert.ok(box.x + box.width <= 1024 - pad.right);
    assert.ok(box.y + box.height <= 1024 - pad.bottom);
    assert.equal(box.text.includes("…") || box.text.endsWith("..."), false);
  }
  assert.equal(a.renderedStrings.join("|"), `${TITLE}|${CTA}`);
  assert.equal(
    a.checksumSha256,
    "9dec964f3103cfcbd255f3583793d5fbf82688cb4573764408cc2e522e417c78",
  );
});

test("11A-GLYPH — regressions wrap, overflow, unsupported, isolation", () => {
  const provider = gridPng();
  const ascii = createDefaultPhase11AOverlaySpec({ locale: "fr", title: "Virtual Humans Studio" });
  const composedAscii = composePhase11ADeterministicOverlay({ providerPng: provider, spec: ascii });
  assert.equal(composedAscii.renderedStrings[0], "Virtual Humans Studio");

  const wrap = createDefaultPhase11AOverlaySpec({
    locale: "fr",
    title: "Un titre volontairement long pour forcer deux lignes overlay",
  });
  wrap.fontSize = 40;
  const wrapped = composePhase11ADeterministicOverlay({ providerPng: provider, spec: wrap });
  assert.ok(wrapped.lineBoxes.filter((l) => l.role === "title").length >= 2);

  const overflow = createDefaultPhase11AOverlaySpec({
    locale: "fr",
    title: "Un titre beaucoup trop long pour une seule ligne autorisée vraiment",
  });
  overflow.maxLines = 1;
  overflow.fontSize = 64;
  assert.throws(
    () => composePhase11ADeterministicOverlay({ providerPng: provider, spec: overflow }),
    /overlay_overflow/,
  );
  assert.throws(
    () =>
      composePhase11ADeterministicOverlay({
        providerPng: provider,
        spec: createDefaultPhase11AOverlaySpec({ locale: "fr", title: "你好" }),
      }),
    /overlay_glyph_unsupported/,
  );
  const blob = JSON.stringify(composedAscii.redactedMetadata);
  assert.equal(/https?:\/\//i.test(blob), false);
  assert.equal(/data:image\//i.test(blob), false);
  assert.equal(/openai|fal\.ai|kling/i.test(blob), false);
});
