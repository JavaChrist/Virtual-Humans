/**
 * Provider-facing image visual variant (Phase 11A-STRIP).
 * Responsibility A only — never carries overlay copy.
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import {
  PHASE_11A_PROVIDER_TEXT_POLICY,
  PHASE_11A_PROVIDER_TEXT_POLICY_VERSION,
} from "./image-text-overlay";
import {
  assertNoForbiddenOverlayKeys,
  assertNoOverlayCopyLeak,
} from "./overlay-copy-leak";

export const IMAGE_VISUAL_VARIANT_KIND = "image_visual_variant" as const;
export const IMAGE_VISUAL_VARIANT_SCHEMA_VERSION = "1.0.0" as const;
export const IMAGE_VISUAL_VARIANT_VERSION = "phase-11a-image-visual-variant-1.0.0" as const;

export const PHASE_11A_FORBIDDEN_VISUAL_ELEMENTS = [
  "letters",
  "words",
  "numbers",
  "captions",
  "written logo",
  "watermark",
  "textual interface",
  "pseudo-glyphs",
  "text inside buttons",
] as const;

const PAINT_TEXT_RE =
  /\b(draw|write|paint|render|inscribe|add|include)\b[\s\S]{0,48}\b(text|word|letter|caption|title|subtitle|cta|button label|glyph)\b/i;

export const ImageVisualVariantSchema = z
  .object({
    kind: z.literal(IMAGE_VISUAL_VARIANT_KIND),
    schemaVersion: z.literal(IMAGE_VISUAL_VARIANT_SCHEMA_VERSION),
    version: z.literal(IMAGE_VISUAL_VARIANT_VERSION),
    visualSubject: z.string().min(12).max(320),
    visualAction: z.string().min(4).max(200),
    environment: z.string().min(4).max(320),
    composition: z.string().min(2).max(200),
    camera: z.string().min(2).max(160),
    lighting: z.string().min(2).max(160),
    palette: z.string().min(2).max(160),
    style: z.string().min(2).max(160),
    negativeSpaceIntent: z.string().min(8).max(240),
    forbiddenVisualElements: z
      .array(z.string().min(2).max(48))
      .min(6)
      .max(16),
    providerTextPolicy: z.literal(PHASE_11A_PROVIDER_TEXT_POLICY),
    providerTextPolicyVersion: z.literal(PHASE_11A_PROVIDER_TEXT_POLICY_VERSION),
  })
  .strict()
  .superRefine((variant, ctx) => {
    const blob = [
      variant.visualSubject,
      variant.visualAction,
      variant.environment,
      variant.composition,
      variant.camera,
      variant.lighting,
      variant.palette,
      variant.style,
      variant.negativeSpaceIntent,
    ].join("\n");
    if (PAINT_TEXT_RE.test(blob)) {
      ctx.addIssue({
        code: "custom",
        message: "visual variant must not instruct painting of text",
      });
    }
  });

export type ImageVisualVariant = z.infer<typeof ImageVisualVariantSchema>;

export function parseImageVisualVariant(input: unknown): ImageVisualVariant {
  const parsed = ImageVisualVariantSchema.parse(input);
  assertNoForbiddenOverlayKeys(parsed as unknown as Record<string, unknown>);
  return parsed;
}

export function fingerprintImageVisualVariant(variant: ImageVisualVariant): string {
  const canonical = JSON.stringify({
    kind: variant.kind,
    schemaVersion: variant.schemaVersion,
    version: variant.version,
    visualSubject: variant.visualSubject,
    visualAction: variant.visualAction,
    environment: variant.environment,
    composition: variant.composition,
    camera: variant.camera,
    lighting: variant.lighting,
    palette: variant.palette,
    style: variant.style,
    negativeSpaceIntent: variant.negativeSpaceIntent,
    forbiddenVisualElements: [...variant.forbiddenVisualElements],
    providerTextPolicy: variant.providerTextPolicy,
    providerTextPolicyVersion: variant.providerTextPolicyVersion,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function assertImageVisualVariantHasNoOverlayCopy(
  variant: ImageVisualVariant,
  overlayCopy: readonly string[],
): void {
  parseImageVisualVariant(variant);
  const blob = [
    variant.visualSubject,
    variant.visualAction,
    variant.environment,
    variant.composition,
    variant.camera,
    variant.lighting,
    variant.palette,
    variant.style,
    variant.negativeSpaceIntent,
    variant.forbiddenVisualElements.join(" "),
  ].join("\n");
  assertNoOverlayCopyLeak(blob, overlayCopy, "image_visual_variant");
}
