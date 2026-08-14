/**
 * Phase 11A — deterministic typographic compositor (local bitmap font).
 * Does not call providers, download fonts, or mutate overlay strings.
 * Provider PNG decode supports filters 0–4; composed output is filter-0 RGB8.
 */

import {
  assertOverlayContrast,
  contrastRatio,
  fingerprintImageTextOverlaySpec,
  overlayStrings,
  PHASE_11A_TEXT_OVERLAY_VERSION,
  type ImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";
import {
  assertPhase11AOverlayFontFamily,
  glyphRowsForCodepoint,
  PHASE_11A_OVERLAY_GLYPH_SIZE,
} from "./phase-11a-overlay-font";
import { overlayCodepoints } from "./phase-11a-overlay-latin-bitmap";
import { checksumSha256Bytes } from "./phase-11a-image-technical-qc";
import { decodeRgbPng, encodeRgbPng } from "./phase-11a-png-rgb";

export const PHASE_11A_COMPOSITOR_VERSION = "phase-11a-bitmap-compositor-1.1.0" as const;
export const PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME = "WIRED_DISABLED" as const;
export const PHASE_11A_COMPOSITOR_CANVAS = 1024 as const;

export type OverlayLineBox = {
  role: "title" | "subtitle" | "callToAction" | "legalLine";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lineIndex: number;
};

export type Phase11ACompositorResult = {
  png: Uint8Array;
  checksumSha256: string;
  width: 1024;
  height: 1024;
  overlayFingerprint: string;
  compositorVersion: typeof PHASE_11A_COMPOSITOR_VERSION;
  overlayVersion: typeof PHASE_11A_TEXT_OVERLAY_VERSION;
  renderedStrings: string[];
  lineBoxes: OverlayLineBox[];
  contrastRatio: number;
  fontFamily: string;
  locale: string;
  redactedMetadata: {
    providerTextPolicy: "no_text";
    textOverlayMode: "deterministic";
    overlayVersion: typeof PHASE_11A_TEXT_OVERLAY_VERSION;
    compositorVersion: typeof PHASE_11A_COMPOSITOR_VERSION;
    overlayFingerprint: string;
    checksumSha256: string;
    lineCount: number;
  };
};

function parseHex(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function wrapExactWords(text: string, maxWidth: number, charWidth: number): string[] {
  if (measure(text, charWidth) <= maxWidth) return [text];
  const words = text.split(" ");
  if (words.length === 1) {
    throw new Error("overlay_overflow:unbreakable_token");
  }
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (measure(word, charWidth) > maxWidth) {
      throw new Error("overlay_overflow:unbreakable_token");
    }
    const next = current ? `${current} ${word}` : word;
    if (measure(next, charWidth) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function measure(text: string, charWidth: number): number {
  return overlayCodepoints(text).length * charWidth;
}

function paintGlyph(input: {
  rgb: Uint8Array;
  canvas: number;
  x: number;
  y: number;
  rows: Uint8Array;
  scale: number;
  color: [number, number, number];
  bold: boolean;
  clip: { x0: number; y0: number; x1: number; y1: number };
}): void {
  const { rgb, canvas, rows, scale, color, clip } = input;
  const offsets = input.bold ? [0, 1] : [0];
  for (const dx of offsets) {
    for (let gy = 0; gy < 8; gy++) {
      const bits = rows[gy] ?? 0;
      for (let gx = 0; gx < 8; gx++) {
        if (((bits >> (7 - gx)) & 1) === 0) continue;
        for (let py = 0; py < scale; py++) {
          for (let px = 0; px < scale; px++) {
            const xx = Math.floor(input.x + dx + gx * scale + px);
            const yy = Math.floor(input.y + gy * scale + py);
            if (xx < clip.x0 || yy < clip.y0 || xx >= clip.x1 || yy >= clip.y1) {
              throw new Error("overlay_clipping");
            }
            if (xx < 0 || yy < 0 || xx >= canvas || yy >= canvas) {
              throw new Error("overlay_clipping");
            }
            const i = (yy * canvas + xx) * 3;
            rgb[i] = color[0];
            rgb[i + 1] = color[1];
            rgb[i + 2] = color[2];
          }
        }
      }
    }
  }
}

function fillRect(input: {
  rgb: Uint8Array;
  canvas: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: [number, number, number];
  clip: { x0: number; y0: number; x1: number; y1: number };
}): void {
  const x1 = input.x + input.w;
  const y1 = input.y + input.h;
  if (input.x < input.clip.x0 || input.y < input.clip.y0 || x1 > input.clip.x1 || y1 > input.clip.y1) {
    throw new Error("overlay_clipping");
  }
  for (let y = input.y; y < y1; y++) {
    for (let x = input.x; x < x1; x++) {
      const i = (y * input.canvas + x) * 3;
      input.rgb[i] = input.color[0];
      input.rgb[i + 1] = input.color[1];
      input.rgb[i + 2] = input.color[2];
    }
  }
}

export function composePhase11ADeterministicOverlay(input: {
  providerPng: Uint8Array;
  spec: ImageTextOverlaySpec;
}): Phase11ACompositorResult {
  assertPhase11AOverlayFontFamily(input.spec.fontFamily);
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

  const scale = spec.fontSize / PHASE_11A_OVERLAY_GLYPH_SIZE;
  const charW = PHASE_11A_OVERLAY_GLYPH_SIZE * scale;
  const lineH = Math.ceil(spec.fontSize * spec.lineHeight);
  const textColor = parseHex(spec.textColor);
  const bgColor = parseHex(spec.backgroundColor);

  type Planned = { role: OverlayLineBox["role"]; text: string };
  const planned: Planned[] = [];
  const blocks: Array<{ role: OverlayLineBox["role"]; source: string }> = [
    { role: "title", source: spec.title },
  ];
  if (spec.subtitle) blocks.push({ role: "subtitle", source: spec.subtitle });
  if (spec.callToAction) blocks.push({ role: "callToAction", source: spec.callToAction });
  if (spec.legalLine) blocks.push({ role: "legalLine", source: spec.legalLine });

  for (const block of blocks) {
    for (const ch of block.source) {
      glyphRowsForCodepoint(ch.codePointAt(0) ?? 0);
    }
    for (const line of wrapExactWords(block.source, boxW, charW)) {
      planned.push({ role: block.role, text: line });
    }
  }
  if (planned.length > spec.maxLines) {
    throw new Error("overlay_overflow:max_lines");
  }
  const totalH = planned.length * lineH;
  if (totalH > boxH) {
    throw new Error("overlay_overflow:safe_area");
  }

  const lineBoxes: OverlayLineBox[] = [];
  let y = clip.y0;
  let lineIndex = 0;
  for (const line of planned) {
    const width = Math.ceil(measure(line.text, charW));
    let x = clip.x0;
    if (spec.alignment === "center") x = clip.x0 + Math.floor((boxW - width) / 2);
    if (spec.alignment === "right") x = clip.x1 - width;
    fillRect({
      rgb,
      canvas: PHASE_11A_COMPOSITOR_CANVAS,
      x,
      y,
      w: width,
      h: spec.fontSize,
      color: bgColor,
      clip,
    });
    let cx = x;
    for (const ch of line.text) {
      const cp = ch.codePointAt(0) ?? 0;
      paintGlyph({
        rgb,
        canvas: PHASE_11A_COMPOSITOR_CANVAS,
        x: cx,
        y,
        rows: glyphRowsForCodepoint(cp),
        scale,
        color: textColor,
        bold: spec.fontWeight === "bold",
        clip,
      });
      cx += charW;
    }
    lineBoxes.push({
      role: line.role,
      text: line.text,
      x,
      y,
      width,
      height: spec.fontSize,
      lineIndex,
    });
    y += lineH;
    lineIndex += 1;
  }

  const png = encodeRgbPng({
    width: PHASE_11A_COMPOSITOR_CANVAS,
    height: PHASE_11A_COMPOSITOR_CANVAS,
    rgb,
  });
  const checksumSha256 = checksumSha256Bytes(png);
  const overlayFingerprint = fingerprintImageTextOverlaySpec(spec);
  const rendered = overlayStrings(spec);

  return {
    png,
    checksumSha256,
    width: 1024,
    height: 1024,
    overlayFingerprint,
    compositorVersion: PHASE_11A_COMPOSITOR_VERSION,
    overlayVersion: PHASE_11A_TEXT_OVERLAY_VERSION,
    renderedStrings: rendered,
    lineBoxes,
    contrastRatio: contrastRatio(spec.textColor, spec.backgroundColor),
    fontFamily: spec.fontFamily,
    locale: spec.locale,
    redactedMetadata: {
      providerTextPolicy: "no_text",
      textOverlayMode: "deterministic",
      overlayVersion: PHASE_11A_TEXT_OVERLAY_VERSION,
      compositorVersion: PHASE_11A_COMPOSITOR_VERSION,
      overlayFingerprint,
      checksumSha256,
      lineCount: lineBoxes.length,
    },
  };
}
