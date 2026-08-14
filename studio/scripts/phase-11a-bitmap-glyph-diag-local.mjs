#!/usr/bin/env node
/**
 * Local-only glyph diagnosis preview. Writes gitignored PNGs under studio/.tmp.
 * No Production, no provider, no signed URL.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(studioRoot, ".tmp", "phase-11a-glyph-diag");

const compositorUrl = pathToFileURL(
  resolve(studioRoot, "src/application/production/phase-11a-deterministic-compositor.ts"),
).href;
const overlayUrl = pathToFileURL(
  resolve(studioRoot, "src/domain/production/image-text-overlay.ts"),
).href;
const pngUrl = pathToFileURL(resolve(studioRoot, "src/application/production/phase-11a-png-rgb.ts")).href;
const stripUrl = pathToFileURL(
  resolve(studioRoot, "src/application/production/phase-11a-strip-overlay-copy-dry-run.ts"),
).href;
const fontUrl = pathToFileURL(
  resolve(studioRoot, "src/application/production/phase-11a-overlay-latin-bitmap.ts"),
).href;

const compositor = await import(compositorUrl);
const overlay = await import(overlayUrl);
const png = await import(pngUrl);
const strip = await import(stripUrl);
const font = await import(fontUrl);

function gridRgb() {
  const rgb = new Uint8Array(1024 * 1024 * 3);
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const i = (y * 1024 + x) * 3;
      const cell = ((Math.floor(x / 32) + Math.floor(y / 32)) & 1) === 0;
      rgb[i] = cell ? 0x2c : 0x3d;
      rgb[i + 1] = cell ? 0x34 : 0x45;
      rgb[i + 2] = cell ? 0x44 : 0x55;
    }
  }
  return rgb;
}

const spec = overlay.createDefaultPhase11AOverlaySpec({
  locale: strip.PHASE_11A_SCENE2_OVERLAY_LOCALE,
  title: strip.PHASE_11A_SCENE2_OVERLAY_TITLE,
  callToAction: strip.PHASE_11A_SCENE2_OVERLAY_CTA,
});
const provider = png.encodeRgbPng({ width: 1024, height: 1024, rgb: gridRgb() });
const composed = compositor.composePhase11ADeterministicOverlay({ providerPng: provider, spec });

const atlasRgb = new Uint8Array(256 * 128 * 3).fill(0x12);
const cps = font.listPhase11ABitmapGlyphCodepoints();
for (let i = 0; i < cps.length; i++) {
  const col = i % 32;
  const row = Math.floor(i / 32);
  const rows = font.bitmapGlyphRows(cps[i]);
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      if (((rows[gy] >> (7 - gx)) & 1) === 0) continue;
      const x = col * 8 + gx;
      const y = row * 8 + gy;
      const p = (y * 256 + x) * 3;
      atlasRgb[p] = 0xf7;
      atlasRgb[p + 1] = 0xf4;
      atlasRgb[p + 2] = 0xee;
    }
  }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "overlay-full.png"), composed.png);
writeFileSync(
  resolve(outDir, "glyph-atlas.png"),
  png.encodeRgbPng({ width: 256, height: 128, rgb: atlasRgb }),
);
const decoded = png.decodeRgbPng(composed.png);
const titleBox = composed.lineBoxes.find((b) => b.role === "title");
const maxRight = composed.lineBoxes.reduce((n, b) => Math.max(n, b.x + b.width), 0);
const cropW = Math.min(1024, Math.max(titleBox.width, maxRight - (titleBox.x - 8)) + 24);
const cropH = Math.min(
  240,
  composed.lineBoxes.reduce((h, b) => Math.max(h, b.y + b.height), 0) - titleBox.y + 32,
);
const crop = new Uint8Array(cropW * cropH * 3);
for (let y = 0; y < cropH; y++) {
  for (let x = 0; x < cropW; x++) {
    const sx = titleBox.x - 8 + x;
    const sy = titleBox.y - 8 + y;
    const si = (sy * 1024 + sx) * 3;
    const di = (y * cropW + x) * 3;
    crop[di] = decoded.rgb[si];
    crop[di + 1] = decoded.rgb[si + 1];
    crop[di + 2] = decoded.rgb[si + 2];
  }
}
writeFileSync(resolve(outDir, "title-cta-crop.png"), png.encodeRgbPng({ width: cropW, height: cropH, rgb: crop }));

const summary = {
  compositorVersion: composed.compositorVersion,
  atlasId: font.PHASE_11A_BITMAP_GLYPH_ATLAS_ID,
  overlayFingerprintPrefix: composed.overlayFingerprint.slice(0, 16),
  checksumSha256Prefix: composed.checksumSha256.slice(0, 16),
  checksumSha256: composed.checksumSha256,
  renderedStrings: composed.renderedStrings,
  lineCount: composed.lineBoxes.length,
  outDir: ".tmp/phase-11a-glyph-diag",
  productionMedia: 0,
  providerCalls: 0,
};
writeFileSync(resolve(outDir, "summary-redacted.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
