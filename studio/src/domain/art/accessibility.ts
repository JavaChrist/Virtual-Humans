/**
 * Pure visual accessibility helpers (palette contrast, safe areas).
 * No UI layer.
 */

import type { ColorToken, SegmentVisualDirection } from "./visual-direction";
import type { ArtValidationIssue, ArtWarning } from "./errors";

const HEX_RE = /^#([0-9a-f]{6})$/i;

export function normalizeHex(hex: string): string | null {
  const raw = hex.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(raw);
  if (short) {
    const [r, g, b] = short[1]!.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (!HEX_RE.test(raw)) return null;
  return raw.toLowerCase();
}

function channel(n: number): number {
  const c = n / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(hexA: string, hexB: string): number | null {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  if (la == null || lb == null) return null;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Minimum recommended contrast for body text (WCAG AA). */
export const MIN_TEXT_CONTRAST = 4.5;

export function validatePaletteAccessibility(
  palette: ColorToken[],
): { issues: ArtValidationIssue[]; warnings: ArtWarning[] } {
  const issues: ArtValidationIssue[] = [];
  const warnings: ArtWarning[] = [];
  const roles = new Map<string, ColorToken[]>();

  for (const token of palette) {
    const hex = normalizeHex(token.hex);
    if (!hex) {
      issues.push({
        code: "accessibility_violation",
        field: `palette.${token.name}`,
        message: `Couleur hex invalide: ${token.hex}`,
      });
    }
    const list = roles.get(token.role) ?? [];
    list.push(token);
    roles.set(token.role, list);
  }

  for (const [role, tokens] of roles) {
    if (tokens.length > 1 && (role === "text" || role === "background" || role === "primary")) {
      warnings.push({
        code: "duplicate_color_role",
        message: `Plusieurs couleurs pour le rôle ${role}.`,
        field: "palette",
      });
    }
  }

  const text = roles.get("text")?.[0];
  const bg = roles.get("background")?.[0];
  if (text && bg) {
    const ratio = contrastRatio(text.hex, bg.hex);
    if (ratio == null) {
      issues.push({
        code: "accessibility_violation",
        field: "palette",
        message: "Impossible de calculer le contraste texte/fond.",
      });
    } else if (ratio < MIN_TEXT_CONTRAST) {
      issues.push({
        code: "accessibility_violation",
        field: "palette",
        message: `Contraste texte/fond insuffisant (${ratio.toFixed(2)} < ${MIN_TEXT_CONTRAST}).`,
      });
    }
  }

  // Essential info must not rely on color alone when text+background are the only cues
  // and no non-color role (accent with distinct intent) or hierarchy exists elsewhere.
  if (text && bg && palette.length <= 2) {
    warnings.push({
      code: "color_only_risk",
      message:
        "Palette réduite texte/fond : éviter de transmettre une info essentielle uniquement par la couleur.",
      field: "palette",
    });
  }

  return { issues, warnings };
}

export function validateCompositionAccessibility(
  segments: SegmentVisualDirection[],
  scriptScreenTextBySegmentId: Map<string, string | undefined>,
): { issues: ArtValidationIssue[]; warnings: ArtWarning[] } {
  const issues: ArtValidationIssue[] = [];
  const warnings: ArtWarning[] = [];

  for (const seg of segments) {
    const screenText = scriptScreenTextBySegmentId.get(seg.scriptSegmentId);
    if (screenText?.trim()) {
      if (seg.composition.textSafeArea === "none") {
        issues.push({
          code: "accessibility_violation",
          field: `segments.${seg.id}.composition.textSafeArea`,
          message: "Texte écran présent sans safe area.",
        });
      }
      if (!seg.composition.visualHierarchy.trim()) {
        warnings.push({
          code: "text_hierarchy_weak",
          message: "Hiérarchie visuelle vide malgré un texte écran.",
          field: `segments.${seg.id}.composition`,
        });
      }
    }
  }

  return { issues, warnings };
}
