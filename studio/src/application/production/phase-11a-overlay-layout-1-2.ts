/**
 * Versioned layout policy for Phase 11A compositor 1.2.0.
 * Fail-closed overflow. No silent truncation. Anti-orphan wrap.
 */
import { contrastRatio } from "@/domain/production/image-text-overlay";
import { measurePhase11AVectorText, overlayCodepoints } from "./phase-11a-overlay-latin-vector";

export const PHASE_11A_LAYOUT_VERSION = "phase-11a-overlay-layout-1.2.0" as const;
export const PHASE_11A_CONTRAST_PANEL_VERSION = "phase-11a-contrast-panel-1.2.0" as const;

export const PHASE_11A_LAYOUT_12_SAFE_AREA = {
  top: 640,
  right: 72,
  bottom: 56,
  left: 72,
} as const;

export const PHASE_11A_LAYOUT_12_TITLE_SIZE = 40 as const;
export const PHASE_11A_LAYOUT_12_CTA_SIZE = 22 as const;
export const PHASE_11A_LAYOUT_12_TITLE_SIZE_STEPS = [40, 36, 32] as const;
export const PHASE_11A_LAYOUT_12_CTA_SIZE_STEPS = [22, 20, 18] as const;
export const PHASE_11A_LAYOUT_12_TITLE_LINE_HEIGHT = 1.12 as const;
export const PHASE_11A_LAYOUT_12_CTA_LINE_HEIGHT = 1.2 as const;
export const PHASE_11A_LAYOUT_12_TITLE_TRACKING = 0 as const;
export const PHASE_11A_LAYOUT_12_CTA_TRACKING = 8 as const;
export const PHASE_11A_LAYOUT_12_BLOCK_GAP = 22 as const;
export const PHASE_11A_LAYOUT_12_PANEL_PAD_X = 18 as const;
export const PHASE_11A_LAYOUT_12_PANEL_PAD_Y = 16 as const;
export const PHASE_11A_LAYOUT_12_PANEL_ALPHA = 0.58 as const;
export const PHASE_11A_LAYOUT_12_PANEL_ALPHA_MIN = 0.5 as const;
export const PHASE_11A_LAYOUT_12_PANEL_ALPHA_MAX = 0.86 as const;
export const PHASE_11A_LAYOUT_12_PANEL_ALPHA_STEP = 0.02 as const;
export const PHASE_11A_LAYOUT_12_GRADIENT_HEIGHT = 300 as const;
export const PHASE_11A_LAYOUT_12_GRADIENT_MAX_ALPHA = 0.42 as const;
export const PHASE_11A_LAYOUT_12_TEXT = "#F4F0E8" as const;
export const PHASE_11A_LAYOUT_12_PANEL = "#141820" as const;
export const PHASE_11A_LAYOUT_12_MAX_LINES = 4 as const;
export const PHASE_11A_LAYOUT_12_MAX_PANEL_SURFACE = 0.14 as const;

export type LayoutRole = "title" | "callToAction";

export type PlannedOverlayLine = {
  role: LayoutRole;
  text: string;
  fontSize: number;
  lineHeightPx: number;
  trackingEm: number;
};

function trackingFor(role: LayoutRole): number {
  return role === "title" ? PHASE_11A_LAYOUT_12_TITLE_TRACKING : PHASE_11A_LAYOUT_12_CTA_TRACKING;
}

function lineHeightFor(role: LayoutRole, fontSize: number): number {
  const ratio =
    role === "title" ? PHASE_11A_LAYOUT_12_TITLE_LINE_HEIGHT : PHASE_11A_LAYOUT_12_CTA_LINE_HEIGHT;
  return Math.ceil(fontSize * ratio);
}

function assertNoUnsupported(text: string, measure: (s: string) => number): void {
  overlayCodepoints(text);
  measure(text);
}

export function wrapPhase11AOverlayLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  trackingEm = 0,
): string[] {
  const measure = (s: string) => measurePhase11AVectorText(s, fontSize, trackingEm);
  assertNoUnsupported(text, measure);
  if (measure(text) <= maxWidth) return [text];
  const words = text.split(" ");
  if (words.length === 1) throw new Error("overlay_overflow:unbreakable_token");
  const greedy: string[] = [];
  let current = "";
  for (const word of words) {
    if (measure(word) > maxWidth) throw new Error("overlay_overflow:unbreakable_token");
    const next = current ? `${current} ${word}` : word;
    if (measure(next) <= maxWidth) current = next;
    else {
      greedy.push(current);
      current = word;
    }
  }
  if (current) greedy.push(current);
  return rebalanceOrphans(greedy, maxWidth, measure);
}

function rebalanceOrphans(
  lines: string[],
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  if (lines.length < 2) return lines;
  const next = [...lines];
  const last = next[next.length - 1]!;
  const lastWords = last.split(" ");
  if (lastWords.length === 1) {
    const prev = next[next.length - 2]!;
    const prevWords = prev.split(" ");
    if (prevWords.length >= 2) {
      const moved = prevWords[prevWords.length - 1]!;
      const shortened = prevWords.slice(0, -1).join(" ");
      const merged = `${moved} ${last}`;
      if (measure(shortened) <= maxWidth && measure(merged) <= maxWidth && shortened.length > 0) {
        next[next.length - 2] = shortened;
        next[next.length - 1] = merged;
      }
    }
  }
  const fixedLast = next[next.length - 1]!;
  if (fixedLast === "Studio") {
    throw new Error("overlay_overflow:orphan_word");
  }
  return next;
}

function tryPlan(input: {
  title: string;
  callToAction?: string;
  textW: number;
  textH: number;
  titleSize: number;
  ctaSize: number;
}): PlannedOverlayLine[] | null {
  if (input.ctaSize >= input.titleSize) return null;
  const planned: PlannedOverlayLine[] = [];
  try {
    for (const line of wrapPhase11AOverlayLines(
      input.title,
      input.textW,
      input.titleSize,
      PHASE_11A_LAYOUT_12_TITLE_TRACKING,
    )) {
      planned.push({
        role: "title",
        text: line,
        fontSize: input.titleSize,
        lineHeightPx: lineHeightFor("title", input.titleSize),
        trackingEm: PHASE_11A_LAYOUT_12_TITLE_TRACKING,
      });
    }
    if (input.callToAction) {
      for (const line of wrapPhase11AOverlayLines(
        input.callToAction,
        input.textW,
        input.ctaSize,
        PHASE_11A_LAYOUT_12_CTA_TRACKING,
      )) {
        planned.push({
          role: "callToAction",
          text: line,
          fontSize: input.ctaSize,
          lineHeightPx: lineHeightFor("callToAction", input.ctaSize),
          trackingEm: PHASE_11A_LAYOUT_12_CTA_TRACKING,
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("overlay_overflow")) return null;
    throw error;
  }
  if (planned.length > PHASE_11A_LAYOUT_12_MAX_LINES) return null;
  const gap = planned.some((l) => l.role === "callToAction") ? PHASE_11A_LAYOUT_12_BLOCK_GAP : 0;
  const height = planned.reduce((n, l) => n + l.lineHeightPx, 0) + gap;
  if (height > input.textH) return null;
  return planned;
}

export function planPhase11ALayout12(input: {
  title: string;
  callToAction?: string;
  canvas: number;
  safe: { top: number; right: number; bottom: number; left: number };
}): PlannedOverlayLine[] {
  const textW = input.canvas - input.safe.left - input.safe.right - PHASE_11A_LAYOUT_12_PANEL_PAD_X * 2;
  const textH = input.canvas - input.safe.top - input.safe.bottom - PHASE_11A_LAYOUT_12_PANEL_PAD_Y * 2;
  if (textW <= 0 || textH <= 0) throw new Error("overlay_safe_area_empty");
  for (const titleSize of PHASE_11A_LAYOUT_12_TITLE_SIZE_STEPS) {
    for (const ctaSize of PHASE_11A_LAYOUT_12_CTA_SIZE_STEPS) {
      const planned = tryPlan({
        title: input.title,
        callToAction: input.callToAction,
        textW,
        textH,
        titleSize,
        ctaSize,
      });
      if (planned) return planned;
    }
  }
  throw new Error("overlay_overflow:layout");
}

export function assertPhase11ANoOrphanStudio(lines: readonly PlannedOverlayLine[]): void {
  const cta = lines.filter((l) => l.role === "callToAction");
  if (cta.length >= 2 && cta[cta.length - 1]?.text === "Studio") {
    throw new Error("overlay_overflow:orphan_word");
  }
}

export function trackingForRole(role: LayoutRole): number {
  return trackingFor(role);
}

function mixChannel(bg: number, fg: number, alpha: number): number {
  return Math.round(bg * (1 - alpha) + fg * alpha);
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function choosePhase11APanelAlpha(input: {
  meanBg: readonly [number, number, number];
  textHex: string;
  minContrast: number;
}): { alpha: number; contrast: number; blendedHex: string } {
  const panel = [0x14, 0x18, 0x20] as const;
  let last: { alpha: number; contrast: number; blendedHex: string } = {
    alpha: PHASE_11A_LAYOUT_12_PANEL_ALPHA_MAX,
    contrast: 0,
    blendedHex: PHASE_11A_LAYOUT_12_PANEL,
  };
  for (let step = 0; step <= 20; step++) {
    const alpha =
      Math.round((PHASE_11A_LAYOUT_12_PANEL_ALPHA_MIN + step * PHASE_11A_LAYOUT_12_PANEL_ALPHA_STEP) * 100) /
      100;
    if (alpha > PHASE_11A_LAYOUT_12_PANEL_ALPHA_MAX + 1e-9) break;
    const r = mixChannel(input.meanBg[0], panel[0], alpha);
    const g = mixChannel(input.meanBg[1], panel[1], alpha);
    const b = mixChannel(input.meanBg[2], panel[2], alpha);
    const blendedHex = toHex(r, g, b);
    const contrast = contrastRatio(input.textHex, blendedHex);
    last = { alpha, contrast, blendedHex };
    if (contrast + 1e-9 >= input.minContrast) return last;
  }
  throw new Error(`overlay_contrast_insufficient:${last.contrast.toFixed(2)}<${input.minContrast}`);
}
