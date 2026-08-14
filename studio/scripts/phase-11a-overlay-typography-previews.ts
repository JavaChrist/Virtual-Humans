#!/usr/bin/env node
/**
 * Local synthetic previews for Phase 11A compositor 1.2.0.
 * Writes only under studio/.tmp/ (gitignored). No Production media. No provider.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultPhase11AOverlaySpec, createPhase11AProfessionalOverlaySpec } from "@/domain/production/image-text-overlay";
import {
  PHASE_11A_SCENE2_OVERLAY_CTA,
  PHASE_11A_SCENE2_OVERLAY_LOCALE,
  PHASE_11A_SCENE2_OVERLAY_TITLE,
} from "@/application/production/phase-11a-strip-overlay-copy-dry-run";
import { composePhase11ADeterministicOverlay } from "@/application/production/phase-11a-deterministic-compositor";
import { composePhase11AVectorOverlay } from "@/application/production/phase-11a-vector-compositor";
import {
  cropRgbPng,
  paintDebugLayout,
  stitchSideBySide,
  syntheticDarkPng,
  syntheticLightPng,
  syntheticScene2GridPng,
  syntheticVariableContrastPng,
} from "@/application/production/phase-11a-overlay-synthetic-fixtures";
import { checksumSha256Bytes } from "@/application/production/phase-11a-image-technical-qc";

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".tmp", "phase-11a-overlay-1.2.0");
mkdirSync(outDir, { recursive: true });

const spec12 = createPhase11AProfessionalOverlaySpec({
  locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
  title: PHASE_11A_SCENE2_OVERLAY_TITLE,
  callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
});
const spec11 = createDefaultPhase11AOverlaySpec({
  locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
  title: PHASE_11A_SCENE2_OVERLAY_TITLE,
  callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
});

function write(name: string, bytes: Uint8Array): void {
  writeFileSync(resolve(outDir, name), bytes);
}

const grid = syntheticScene2GridPng();
const dark = syntheticDarkPng();
const light = syntheticLightPng();
const variable = syntheticVariableContrastPng();

const v12grid = composePhase11AVectorOverlay({ providerPng: grid, spec: spec12 });
const v11grid = composePhase11ADeterministicOverlay({ providerPng: grid, spec: spec11 });
const v12dark = composePhase11AVectorOverlay({ providerPng: dark, spec: spec12 });
const v12light = composePhase11AVectorOverlay({ providerPng: light, spec: spec12 });
const v12var = composePhase11AVectorOverlay({ providerPng: variable, spec: spec12 });

write("01-full-grid-1.2.0.png", v12grid.png);
write("02-full-dark-1.2.0.png", v12dark.png);
write("03-full-light-1.2.0.png", v12light.png);
write("04-full-variable-1.2.0.png", v12var.png);
write("05-side-by-side-1.1.0-vs-1.2.0.png", stitchSideBySide(v11grid.png, v12grid.png));
write(
  "06-debug-boxes-safe-areas.png",
  paintDebugLayout({ png: v12grid.png, boxes: v12grid.lineBoxes, safe: spec12.safeArea }),
);

const titleBox = v12grid.lineBoxes.find((b) => b.role === "title")!;
const ctaBox = v12grid.lineBoxes.find((b) => b.role === "callToAction")!;
write(
  "07-crop-title.png",
  cropRgbPng({
    png: v12grid.png,
    x: Math.max(0, titleBox.x - 12),
    y: Math.max(0, titleBox.y - 12),
    w: Math.min(1024 - titleBox.x + 12, titleBox.width + 24),
    h: Math.min(1024 - titleBox.y + 12, titleBox.height + 24),
  }),
);
write(
  "08-crop-cta.png",
  cropRgbPng({
    png: v12grid.png,
    x: Math.max(0, ctaBox.x - 12),
    y: Math.max(0, ctaBox.y - 12),
    w: Math.min(1024 - ctaBox.x + 12, ctaBox.width + 24),
    h: Math.min(1024 - ctaBox.y + 12, ctaBox.height + 24),
  }),
);

const report = {
  compositor12: v12grid.compositorVersion,
  checksumGrid: v12grid.checksumSha256,
  checksumDark: v12dark.checksumSha256,
  checksumLight: v12light.checksumSha256,
  checksumVariable: v12var.checksumSha256,
  checksum11: v11grid.checksumSha256,
  contrastGrid: v12grid.contrastRatio,
  contrastLight: v12light.contrastRatio,
  lines: v12grid.lineBoxes.map((b) => ({ role: b.role, text: b.text, w: b.width, h: b.height })),
};
write("09-preview-meta.json", new TextEncoder().encode(`${JSON.stringify(report, null, 2)}\n`));
process.stdout.write(`${JSON.stringify({ outDir, ...report, parentChecksum: checksumSha256Bytes(grid) }, null, 2)}\n`);
