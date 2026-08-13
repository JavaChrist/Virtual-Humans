/**
 * Deterministic image text overlay contract (Phase 11A-HARDEN).
 * Marketing copy is composed in code — never painted by the image provider.
 */

import { createHash } from "node:crypto";
import { z } from "zod";

export const IMAGE_TEXT_OVERLAY_SCHEMA_VERSION = "1.0.0" as const;
export const IMAGE_TEXT_OVERLAY_ARTIFACT_KIND = "image_text_overlay_spec" as const;
export const PHASE_11A_OVERLAY_FONT_FAMILY = "vhs-overlay-latin-bitmap-v1" as const;
export const PHASE_11A_PROVIDER_TEXT_POLICY = "no_text" as const;
export const PHASE_11A_TEXT_OVERLAY_MODE = "deterministic" as const;
export const PHASE_11A_PROVIDER_TEXT_POLICY_VERSION = "no-text-v1" as const;
export const PHASE_11A_TEXT_OVERLAY_VERSION =
  "phase-11a-deterministic-overlay-1.0.0" as const;

const HOSTILE_HTML = /<\/?[a-z][\s\S]*>/i;
const HOSTILE_SCRIPT = /<script|javascript:|onerror\s*=/i;
const HOSTILE_URL = /https?:\/\/|blob:|data:image\/|data:application\/|file:\/\//i;
const PROVIDER_INSTRUCTION =
  /\b(draw|write|paint|render|inscribe)\b[\s\S]{0,40}\b(text|word|letter|glyph|caption|button)\b/i;

const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "text/background color must be #RRGGBB");

export const ImageTextOverlaySpecSchema = z
  .object({
    kind: z.literal(IMAGE_TEXT_OVERLAY_ARTIFACT_KIND),
    schemaVersion: z.literal(IMAGE_TEXT_OVERLAY_SCHEMA_VERSION),
    locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, "locale must be like fr or fr-FR"),
    title: z.string().min(1).max(80),
    subtitle: z.string().min(1).max(120).optional(),
    callToAction: z.string().min(1).max(48).optional(),
    legalLine: z.string().min(1).max(160).optional(),
    fontFamily: z.literal(PHASE_11A_OVERLAY_FONT_FAMILY),
    fontWeight: z.enum(["regular", "bold"]),
    fontSize: z.number().int().min(16).max(96),
    lineHeight: z.number().min(1).max(2),
    alignment: z.enum(["left", "center", "right"]),
    textColor: HexColorSchema,
    backgroundColor: HexColorSchema,
    safeArea: z
      .object({
        top: z.number().int().min(0).max(1024),
        right: z.number().int().min(0).max(1024),
        bottom: z.number().int().min(0).max(1024),
        left: z.number().int().min(0).max(1024),
      })
      .strict(),
    maxLines: z.number().int().min(1).max(8),
    overflowPolicy: z.literal("reject"),
    contrastRequirement: z.number().min(4.5).max(21),
    version: z.literal(PHASE_11A_TEXT_OVERLAY_VERSION),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const strings = [spec.title, spec.subtitle, spec.callToAction, spec.legalLine].filter(
      (s): s is string => Boolean(s),
    );
    for (const s of strings) {
      if (HOSTILE_HTML.test(s) || HOSTILE_SCRIPT.test(s)) {
        ctx.addIssue({ code: "custom", message: "overlay strings must not contain HTML/script" });
      }
      if (HOSTILE_URL.test(s)) {
        ctx.addIssue({ code: "custom", message: "overlay strings must not contain URLs" });
      }
      if (PROVIDER_INSTRUCTION.test(s)) {
        ctx.addIssue({ code: "custom", message: "overlay strings must not contain provider instructions" });
      }
    }
    if (spec.safeArea.top + spec.safeArea.bottom >= 1024) {
      ctx.addIssue({ code: "custom", message: "safeArea vertical insets leave no row" });
    }
    if (spec.safeArea.left + spec.safeArea.right >= 1024) {
      ctx.addIssue({ code: "custom", message: "safeArea horizontal insets leave no column" });
    }
  });

export type ImageTextOverlaySpec = z.infer<typeof ImageTextOverlaySpecSchema>;

export function parseImageTextOverlaySpec(input: unknown): ImageTextOverlaySpec {
  return ImageTextOverlaySpecSchema.parse(input);
}

export function fingerprintImageTextOverlaySpec(spec: ImageTextOverlaySpec): string {
  const canonical = JSON.stringify({
    kind: spec.kind,
    schemaVersion: spec.schemaVersion,
    locale: spec.locale,
    title: spec.title,
    subtitle: spec.subtitle ?? null,
    callToAction: spec.callToAction ?? null,
    legalLine: spec.legalLine ?? null,
    fontFamily: spec.fontFamily,
    fontWeight: spec.fontWeight,
    fontSize: spec.fontSize,
    lineHeight: spec.lineHeight,
    alignment: spec.alignment,
    textColor: spec.textColor.toLowerCase(),
    backgroundColor: spec.backgroundColor.toLowerCase(),
    safeArea: spec.safeArea,
    maxLines: spec.maxLines,
    overflowPolicy: spec.overflowPolicy,
    contrastRequirement: spec.contrastRequirement,
    version: spec.version,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function overlayStrings(spec: ImageTextOverlaySpec): string[] {
  return [spec.title, spec.subtitle, spec.callToAction, spec.legalLine].filter(
    (s): s is string => Boolean(s),
  );
}

export function relativeLuminance(hex: string): number {
  const n = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (ch[0] ?? 0) + 0.7152 * (ch[1] ?? 0) + 0.0722 * (ch[2] ?? 0);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export function assertOverlayContrast(spec: ImageTextOverlaySpec): void {
  const ratio = contrastRatio(spec.textColor, spec.backgroundColor);
  if (ratio + 1e-9 < spec.contrastRequirement) {
    throw new Error(
      `overlay_contrast_insufficient:${ratio.toFixed(2)}<${spec.contrastRequirement}`,
    );
  }
}

export function createDefaultPhase11AOverlaySpec(input: {
  locale: string;
  title: string;
  subtitle?: string;
  callToAction?: string;
  legalLine?: string;
}): ImageTextOverlaySpec {
  return parseImageTextOverlaySpec({
    kind: IMAGE_TEXT_OVERLAY_ARTIFACT_KIND,
    schemaVersion: IMAGE_TEXT_OVERLAY_SCHEMA_VERSION,
    locale: input.locale,
    title: input.title,
    ...(input.subtitle ? { subtitle: input.subtitle } : {}),
    ...(input.callToAction ? { callToAction: input.callToAction } : {}),
    ...(input.legalLine ? { legalLine: input.legalLine } : {}),
    fontFamily: PHASE_11A_OVERLAY_FONT_FAMILY,
    fontWeight: "bold",
    fontSize: 32,
    lineHeight: 1.25,
    alignment: "center",
    textColor: "#F7F4EE",
    backgroundColor: "#1A1F2B",
    safeArea: { top: 720, right: 64, bottom: 48, left: 64 },
    maxLines: 5,
    overflowPolicy: "reject",
    contrastRequirement: 4.5,
    version: PHASE_11A_TEXT_OVERLAY_VERSION,
  });
}
