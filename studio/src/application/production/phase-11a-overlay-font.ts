/**
 * Allowlisted local bitmap font for Phase 11A deterministic overlay.
 * Shapes come from vhs-overlay-latin-bitmap-shapes-v1. Unknown glyphs fail closed.
 */

import {
  PHASE_11A_OVERLAY_FONT_FAMILIES,
  PHASE_11A_OVERLAY_FONT_FAMILY,
} from "@/domain/production/image-text-overlay";
import {
  bitmapGlyphRows,
  hasPhase11ABitmapGlyph,
  overlayCodepoints,
  PHASE_11A_BITMAP_GLYPH_CELL,
} from "./phase-11a-overlay-latin-bitmap";

export { PHASE_11A_OVERLAY_FONT_FAMILY };
export const PHASE_11A_OVERLAY_GLYPH_SIZE = PHASE_11A_BITMAP_GLYPH_CELL;

export function isPhase11AOverlayCodepointAllowed(cp: number): boolean {
  return hasPhase11ABitmapGlyph(cp);
}

export function assertPhase11AOverlayFontFamily(fontFamily: string): void {
  if (!(PHASE_11A_OVERLAY_FONT_FAMILIES as readonly string[]).includes(fontFamily)) {
    throw new Error(`overlay_font_not_allowlisted:${fontFamily}`);
  }
}

export function glyphRowsForCodepoint(cp: number): Uint8Array {
  return bitmapGlyphRows(cp);
}

export function measureOverlayTextWidth(text: string, pixelSize: number): number {
  const scale = pixelSize / PHASE_11A_OVERLAY_GLYPH_SIZE;
  const advance = PHASE_11A_OVERLAY_GLYPH_SIZE * scale;
  return Math.ceil(overlayCodepoints(text).length * advance);
}
