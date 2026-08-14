/**
 * Centralized overlay-copy leak detection (Phase 11A-STRIP).
 * Compares marketing overlay strings against visual / provider surfaces.
 *
 * Threshold (documented, tested against false positives):
 * - Normalize: Unicode NFC, unify apostrophes, lowercase, collapse spaces,
 *   strip punctuation.
 * - Reject exact / normalized full-string inclusion when overlay length >= 8.
 * - Reject a contiguous normalized span of the overlay with length >= 16
 *   (significant partial inclusion: title phrase, CTA core, …).
 * - Never reject a single generic visual word solely because it also appears
 *   in the title (e.g. « idée », « structure »).
 * - Do not echo overlay copy in public error messages.
 */

import {
  overlayStrings,
  type ImageTextOverlaySpec,
} from "./image-text-overlay";

export const OVERLAY_LEAK_MIN_EXACT_LEN = 8 as const;
export const OVERLAY_LEAK_MIN_SPAN_LEN = 16 as const;
export const OVERLAY_LEAK_DETECTOR_VERSION = "overlay-leak-v1" as const;

const APOSTROPHES = /[\u2018\u2019\u201B\u2032\u00B4`]/g;

export type OverlayLeakKind =
  | "exact_or_normalized"
  | "significant_substring"
  | "screen_text_field"
  | "forbidden_overlay_key";

export type OverlayLeakFinding = {
  leaked: true;
  kind: OverlayLeakKind;
  surface: string;
  detectorVersion: typeof OVERLAY_LEAK_DETECTOR_VERSION;
};

export function normalizeOverlayText(value: string): string {
  return value
    .normalize("NFC")
    .replace(APOSTROPHES, " ")
    .replace(/'/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantSpans(normalized: string): string[] {
  const spans = new Set<string>();
  if (normalized.length >= OVERLAY_LEAK_MIN_EXACT_LEN) spans.add(normalized);
  const tokens = normalized.split(" ").filter(Boolean);
  for (let i = 0; i < tokens.length; i += 1) {
    for (let j = i + 1; j <= tokens.length; j += 1) {
      const slice = tokens.slice(i, j).join(" ");
      if (slice.length >= OVERLAY_LEAK_MIN_SPAN_LEN) spans.add(slice);
    }
  }
  return [...spans];
}

export function findOverlayCopyLeak(
  haystack: string,
  overlayCopy: readonly string[],
  surface = "visual",
): OverlayLeakFinding | null {
  const hay = normalizeOverlayText(haystack);
  if (!hay) return null;
  for (const raw of overlayCopy) {
    if (!raw?.trim() || raw.trim().length < 3) continue;
    const norm = normalizeOverlayText(raw);
    if (norm.length >= OVERLAY_LEAK_MIN_EXACT_LEN && hay.includes(norm)) {
      return {
        leaked: true,
        kind: "exact_or_normalized",
        surface,
        detectorVersion: OVERLAY_LEAK_DETECTOR_VERSION,
      };
    }
    for (const span of significantSpans(norm)) {
      if (hay.includes(span)) {
        return {
          leaked: true,
          kind: span === norm ? "exact_or_normalized" : "significant_substring",
          surface,
          detectorVersion: OVERLAY_LEAK_DETECTOR_VERSION,
        };
      }
    }
  }
  return null;
}

export function overlayCopyFromSpec(spec: ImageTextOverlaySpec): string[] {
  return overlayStrings(spec);
}

export function assertNoOverlayCopyLeak(
  haystack: string,
  overlayCopy: readonly string[],
  surface: string,
): void {
  const finding = findOverlayCopyLeak(haystack, overlayCopy, surface);
  if (finding) {
    throw new Error(`Phase 11A overlay leak: ${finding.kind} on ${surface}.`);
  }
}

const FORBIDDEN_VISUAL_KEYS = [
  "screenText",
  "title",
  "subtitle",
  "callToAction",
  "legalLine",
] as const;

export function assertNoForbiddenOverlayKeys(record: Record<string, unknown>): void {
  for (const key of FORBIDDEN_VISUAL_KEYS) {
    if (key in record) {
      throw new Error(`Phase 11A overlay leak: forbidden key ${key} on visual variant.`);
    }
  }
}
