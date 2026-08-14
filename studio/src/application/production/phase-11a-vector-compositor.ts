/**
 * Phase 11A compositor 1.2.0 — local vector font + professional layout.
 * Does not call providers. 1.0.0 / 1.1.0 paths are unchanged.
 */
import {
  assertOverlayContrast,
  fingerprintImageTextOverlaySpec,
  overlayStrings,
  PHASE_11A_TEXT_OVERLAY_VERSION,
  type ImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";
import { checksumSha256Bytes } from "./phase-11a-image-technical-qc";
import { decodeRgbPng, encodeRgbPng } from "./phase-11a-png-rgb";
import type { OverlayLineBox, Phase11ACompositorResult } from "./phase-11a-deterministic-compositor";
import {
  PHASE_11A_VECTOR_FONT_FAMILY,
  measurePhase11AVectorText,
  overlayCodepoints,
  rasterizePhase11AVectorGlyph,
  vectorAdvance,
  vectorKerning,
} from "./phase-11a-overlay-latin-vector";
import {
  PHASE_11A_LAYOUT_12_BLOCK_GAP,
  PHASE_11A_LAYOUT_12_GRADIENT_HEIGHT,
  PHASE_11A_LAYOUT_12_GRADIENT_MAX_ALPHA,
  PHASE_11A_LAYOUT_12_PANEL,
  PHASE_11A_LAYOUT_12_PANEL_PAD_X,
  PHASE_11A_LAYOUT_12_PANEL_PAD_Y,
  assertPhase11ANoOrphanStudio,
  choosePhase11APanelAlpha,
  planPhase11ALayout12,
} from "./phase-11a-overlay-layout-1-2";

export const PHASE_11A_VECTOR_COMPOSITOR_VERSION = "phase-11a-vector-compositor-1.2.0" as const;
export const PHASE_11A_COMPOSITOR_CANVAS = 1024 as const;

function parseHex(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function mix(bg: number, fg: number, a: number): number {
  return Math.round(bg * (1 - a) + fg * a);
}

function blendPixel(
  rgb: Uint8Array,
  i: number,
  color: [number, number, number],
  alpha: number,
): void {
  rgb[i] = mix(rgb[i] ?? 0, color[0], alpha);
  rgb[i + 1] = mix(rgb[i + 1] ?? 0, color[1], alpha);
  rgb[i + 2] = mix(rgb[i + 2] ?? 0, color[2], alpha);
}

function paintGradient(rgb: Uint8Array, canvas: number): void {
  const top = canvas - PHASE_11A_LAYOUT_12_GRADIENT_HEIGHT;
  const dark = parseHex(PHASE_11A_LAYOUT_12_PANEL);
  for (let y = top; y < canvas; y++) {
    const t = (y - top) / PHASE_11A_LAYOUT_12_GRADIENT_HEIGHT;
    const a = PHASE_11A_LAYOUT_12_GRADIENT_MAX_ALPHA * t * t;
    for (let x = 0; x < canvas; x++) {
      blendPixel(rgb, (y * canvas + x) * 3, dark, a);
    }
  }
}

function sampleMeanRgb(
  rgb: Uint8Array,
  canvas: number,
  x: number,
  y: number,
  w: number,
  h: number,
): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let yy = y; yy < y + h; yy += 2) {
    for (let xx = x; xx < x + w; xx += 2) {
      const i = (yy * canvas + xx) * 3;
      r += rgb[i] ?? 0;
      g += rgb[i + 1] ?? 0;
      b += rgb[i + 2] ?? 0;
      n += 1;
    }
  }
  if (n === 0) return [0, 0, 0];
  return [r / n, g / n, b / n];
}

function fillSoftRect(input: {
  rgb: Uint8Array;
  canvas: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: [number, number, number];
  alpha: number;
  clip: { x0: number; y0: number; x1: number; y1: number };
}): void {
  const fade = 6;
  const x1 = input.x + input.w;
  const y1 = input.y + input.h;
  if (input.x < input.clip.x0 || input.y < input.clip.y0 || x1 > input.clip.x1 || y1 > input.clip.y1) {
    throw new Error("overlay_clipping");
  }
  for (let y = input.y; y < y1; y++) {
    for (let x = input.x; x < x1; x++) {
      const dx = Math.min(x - input.x, x1 - 1 - x);
      const dy = Math.min(y - input.y, y1 - 1 - y);
      const edge = Math.min(dx, dy);
      const a = edge >= fade ? input.alpha : input.alpha * (edge / fade);
      blendPixel(input.rgb, (y * input.canvas + x) * 3, input.color, a);
    }
  }
}

function paintText(input: {
  rgb: Uint8Array;
  canvas: number;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  trackingEm: number;
  color: [number, number, number];
  outline: [number, number, number];
  bold: boolean;
  clip: { x0: number; y0: number; x1: number; y1: number };
}): void {
  const cps = overlayCodepoints(input.text);
  let pen = 0;
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i]!;
    const raster = rasterizePhase11AVectorGlyph(cp, input.fontSize, input.bold);
    const gx = Math.round(input.x + pen) - raster.originX;
    const gy = Math.round(input.y) - raster.originY;
    for (let yy = 0; yy < raster.height; yy++) {
      for (let xx = 0; xx < raster.width; xx++) {
        const cov = (raster.coverage[yy * raster.width + xx] ?? 0) / 255;
        if (cov <= 0) continue;
        const px = gx + xx;
        const py = gy + yy;
        if (px < 0 || py < 0 || px >= input.canvas || py >= input.canvas) {
          throw new Error("overlay_clipping");
        }
        const outside =
          px < input.clip.x0 || py < input.clip.y0 || px >= input.clip.x1 || py >= input.clip.y1;
        if (outside) {
          if (cov > 0.35) throw new Error("overlay_clipping");
          continue;
        }
        const idx = (py * input.canvas + px) * 3;
        blendPixel(input.rgb, idx, input.outline, Math.min(1, cov * 0.85));
        blendPixel(input.rgb, idx, input.color, cov);
      }
    }
    pen += (vectorAdvance(cp) * input.fontSize) / 1000;
    if (i + 1 < cps.length) {
      pen += ((vectorKerning(cp, cps[i + 1]!) + input.trackingEm) * input.fontSize) / 1000;
    }
  }
}

export function composePhase11AVectorOverlay(input: {
  providerPng: Uint8Array;
  spec: ImageTextOverlaySpec;
}): Phase11ACompositorResult {
  if (input.spec.fontFamily !== PHASE_11A_VECTOR_FONT_FAMILY) {
    throw new Error(`overlay_font_not_allowlisted:${input.spec.fontFamily}`);
  }
  assertOverlayContrast(input.spec);
  const decoded = decodeRgbPng(input.providerPng);
  if (decoded.width !== PHASE_11A_COMPOSITOR_CANVAS || decoded.height !== PHASE_11A_COMPOSITOR_CANVAS) {
    throw new Error("overlay_canvas_must_be_1024");
  }
  const rgb = decoded.rgb.slice();
  const spec = input.spec;
  const pad = spec.safeArea;
  const clip = {
    x0: pad.left,
    y0: pad.top,
    x1: PHASE_11A_COMPOSITOR_CANVAS - pad.right,
    y1: PHASE_11A_COMPOSITOR_CANVAS - pad.bottom,
  };
  const boxW = clip.x1 - clip.x0;
  const boxH = clip.y1 - clip.y0;
  if (boxW <= 0 || boxH <= 0) throw new Error("overlay_safe_area_empty");
  if (spec.subtitle || spec.legalLine) {
    throw new Error("overlay_layout_12_title_cta_only");
  }

  const planned = planPhase11ALayout12({
    title: spec.title,
    callToAction: spec.callToAction,
    canvas: PHASE_11A_COMPOSITOR_CANVAS,
    safe: spec.safeArea,
  });
  assertPhase11ANoOrphanStudio(planned);

  const totalH =
    planned.reduce((n, l) => n + l.lineHeightPx, 0) +
    (planned.some((l) => l.role === "callToAction") ? PHASE_11A_LAYOUT_12_BLOCK_GAP : 0) +
    PHASE_11A_LAYOUT_12_PANEL_PAD_Y * 2;
  if (totalH > boxH) throw new Error("overlay_overflow:safe_area");

  paintGradient(rgb, PHASE_11A_COMPOSITOR_CANVAS);

  const textColor = parseHex(spec.textColor);
  const panelColor = parseHex(PHASE_11A_LAYOUT_12_PANEL);
  const lineBoxes: OverlayLineBox[] = [];
  let minContrast = Number.POSITIVE_INFINITY;
  let y = clip.y0 + PHASE_11A_LAYOUT_12_PANEL_PAD_Y;
  let lineIndex = 0;
  let lastRole: string | null = null;
  for (const line of planned) {
    if (lastRole && lastRole !== line.role) y += PHASE_11A_LAYOUT_12_BLOCK_GAP;
    const width = Math.ceil(measurePhase11AVectorText(line.text, line.fontSize, line.trackingEm));
    const innerW = boxW - PHASE_11A_LAYOUT_12_PANEL_PAD_X * 2;
    let x = clip.x0 + PHASE_11A_LAYOUT_12_PANEL_PAD_X;
    if (spec.alignment === "center") x = clip.x0 + PHASE_11A_LAYOUT_12_PANEL_PAD_X + Math.floor((innerW - width) / 2);
    if (spec.alignment === "right") x = clip.x1 - PHASE_11A_LAYOUT_12_PANEL_PAD_X - width;
    const panelX = x - PHASE_11A_LAYOUT_12_PANEL_PAD_X;
    const panelY = y - PHASE_11A_LAYOUT_12_PANEL_PAD_Y;
    const panelW = width + PHASE_11A_LAYOUT_12_PANEL_PAD_X * 2;
    const panelH = line.fontSize + PHASE_11A_LAYOUT_12_PANEL_PAD_Y * 2;
    const meanBg = sampleMeanRgb(rgb, PHASE_11A_COMPOSITOR_CANVAS, panelX, panelY, panelW, panelH);
    const panel = choosePhase11APanelAlpha({
      meanBg,
      textHex: spec.textColor,
      minContrast: Math.max(spec.contrastRequirement, 5),
    });
    minContrast = Math.min(minContrast, panel.contrast);
    fillSoftRect({
      rgb,
      canvas: PHASE_11A_COMPOSITOR_CANVAS,
      x: panelX,
      y: panelY,
      w: panelW,
      h: panelH,
      color: panelColor,
      alpha: panel.alpha,
      clip,
    });
    paintText({
      rgb,
      canvas: PHASE_11A_COMPOSITOR_CANVAS,
      x,
      y,
      text: line.text,
      fontSize: line.fontSize,
      trackingEm: line.trackingEm,
      color: textColor,
      outline: panelColor,
      bold: line.role === "title" || spec.fontWeight === "bold",
      clip,
    });
    lineBoxes.push({
      role: line.role,
      text: line.text,
      x: panelX,
      y: panelY,
      width: panelW,
      height: panelH,
      lineIndex,
    });
    y += line.lineHeightPx;
    lineIndex += 1;
    lastRole = line.role;
  }

  const png = encodeRgbPng({
    width: PHASE_11A_COMPOSITOR_CANVAS,
    height: PHASE_11A_COMPOSITOR_CANVAS,
    rgb,
  });
  const checksumSha256 = checksumSha256Bytes(png);
  const overlayFingerprint = fingerprintImageTextOverlaySpec(spec);
  return {
    png,
    checksumSha256,
    width: 1024,
    height: 1024,
    overlayFingerprint,
    compositorVersion: PHASE_11A_VECTOR_COMPOSITOR_VERSION,
    overlayVersion: PHASE_11A_TEXT_OVERLAY_VERSION,
    renderedStrings: overlayStrings(spec),
    lineBoxes,
    contrastRatio: Number.isFinite(minContrast) ? minContrast : spec.contrastRequirement,
    fontFamily: spec.fontFamily,
    locale: spec.locale,
    redactedMetadata: {
      providerTextPolicy: "no_text",
      textOverlayMode: "deterministic",
      overlayVersion: PHASE_11A_TEXT_OVERLAY_VERSION,
      compositorVersion: PHASE_11A_VECTOR_COMPOSITOR_VERSION,
      overlayFingerprint,
      checksumSha256,
      lineCount: lineBoxes.length,
    },
  };
}
