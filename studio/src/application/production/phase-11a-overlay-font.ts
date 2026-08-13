/**
 * Allowlisted local bitmap font for Phase 11A deterministic overlay.
 * No remote fonts. Unknown glyphs fail closed — no silent substitution.
 */

import { PHASE_11A_OVERLAY_FONT_FAMILY } from "@/domain/production/image-text-overlay";

export { PHASE_11A_OVERLAY_FONT_FAMILY };
export const PHASE_11A_OVERLAY_GLYPH_SIZE = 8 as const;

/** ASCII printable + Latin-1 supplement + FR punctuation extras. */
const EXTRA_CODEPOINTS = new Set([
  0x0152, // Œ
  0x0153, // œ
  0x2018, // ‘
  0x2019, // ’
  0x00ab, // «
  0x00bb, // »
  0x20ac, // €
]);

export function isPhase11AOverlayCodepointAllowed(cp: number): boolean {
  if (cp >= 0x20 && cp <= 0x7e) return true;
  if (cp >= 0xa0 && cp <= 0xff) return true;
  return EXTRA_CODEPOINTS.has(cp);
}

export function assertPhase11AOverlayFontFamily(fontFamily: string): void {
  if (fontFamily !== PHASE_11A_OVERLAY_FONT_FAMILY) {
    throw new Error(`overlay_font_not_allowlisted:${fontFamily}`);
  }
}

/**
 * Stable 8×8 glyph (bits 1–6). Deterministic from codepoint; not a substitute
 * for a production TTF, but local, networked-never, and checksum-stable.
 */
export function glyphRowsForCodepoint(cp: number): Uint8Array {
  if (!isPhase11AOverlayCodepointAllowed(cp)) {
    throw new Error(`overlay_glyph_unsupported:U+${cp.toString(16).toUpperCase()}`);
  }
  const rows = new Uint8Array(8);
  if (cp === 0x20 || cp === 0xa0) return rows;
  let s = (Math.imul(cp + 1, 0x9e3779b1) >>> 0) || 1;
  for (let y = 0; y < 8; y++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    rows[y] = (s >>> 10) & 0x7e;
  }
  rows[0] = (rows[0] ?? 0) | 0x18;
  rows[7] = (rows[7] ?? 0) | 0x18;
  return rows;
}

export function measureOverlayTextWidth(text: string, pixelSize: number): number {
  const scale = pixelSize / PHASE_11A_OVERLAY_GLYPH_SIZE;
  const advance = PHASE_11A_OVERLAY_GLYPH_SIZE * scale;
  return Math.ceil(text.length * advance);
}
