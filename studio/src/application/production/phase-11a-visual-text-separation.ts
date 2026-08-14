/**
 * Split validated ScenePackage visual content from marketing overlay strings.
 * Overlay copy never enters the provider image prompt.
 */

import type { ScenePackage } from "@/domain/prompt";
import {
  createDefaultPhase11AOverlaySpec,
  parseImageTextOverlaySpec,
  PHASE_11A_PROVIDER_TEXT_POLICY,
  PHASE_11A_PROVIDER_TEXT_POLICY_VERSION,
  type ImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";
import {
  assertImageVisualVariantHasNoOverlayCopy,
  fingerprintImageVisualVariant,
  parseImageVisualVariant,
  PHASE_11A_FORBIDDEN_VISUAL_ELEMENTS,
  type ImageVisualVariant,
} from "@/domain/production/image-visual-variant";
import {
  overlayCopyFromSpec,
  assertNoOverlayCopyLeak,
} from "@/domain/production/overlay-copy-leak";

export type Phase11AVisualTextSeparation = {
  locale: string;
  visualDescription: {
    subject: string;
    action: string;
    environment: string;
    camera: string;
    composition: string;
    style: string;
  };
  visualVariant: ImageVisualVariant;
  visualVariantFingerprint: string;
  overlay: ImageTextOverlaySpec;
  screenTextRenderMode: "post_production";
};

export function buildPhase11AImageVisualVariant(input: {
  pkg: ScenePackage;
  overlay: ImageTextOverlaySpec;
}): ImageVisualVariant {
  const { pkg, overlay } = input;
  const copy = overlayCopyFromSpec(overlay);
  const visualSubject =
    pkg.subject.description.trim().length >= 12
      ? pkg.subject.description.trim()
      : `${pkg.subject.description.trim()} visual still with reserved negative space`;
  const visualAction =
    pkg.action.primaryAction.trim().length >= 4
      ? pkg.action.primaryAction.trim()
      : `${pkg.action.primaryAction.trim()} hold`;
  const variant = parseImageVisualVariant({
    kind: "image_visual_variant",
    schemaVersion: "1.0.0",
    version: "phase-11a-image-visual-variant-1.0.0",
    visualSubject,
    visualAction,
    environment: pkg.environment.description,
    composition: pkg.composition.subjectPosition,
    camera: `${pkg.camera.shotSize}/${pkg.camera.angle}`,
    lighting: `${pkg.lighting.source}/${pkg.lighting.quality}`,
    palette: pkg.style.paletteRoles.join(",") || pkg.style.colorIntent,
    style: pkg.style.brandAlignment,
    negativeSpaceIntent:
      pkg.composition.textSafeArea && pkg.composition.textSafeArea !== "none"
        ? `Reserve empty negative space (${pkg.composition.textSafeArea}) for later typographic overlay`
        : "Reserve empty negative space for later typographic overlay",
    forbiddenVisualElements: [...PHASE_11A_FORBIDDEN_VISUAL_ELEMENTS],
    providerTextPolicy: PHASE_11A_PROVIDER_TEXT_POLICY,
    providerTextPolicyVersion: PHASE_11A_PROVIDER_TEXT_POLICY_VERSION,
  });
  assertImageVisualVariantHasNoOverlayCopy(variant, copy);
  return variant;
}

export function separatePhase11AVisualAndText(input: {
  pkg: ScenePackage;
  overlay: ImageTextOverlaySpec;
}): Phase11AVisualTextSeparation {
  const { pkg, overlay } = input;
  parseImageTextOverlaySpec(overlay);
  if (pkg.screenText?.renderMode === "model_generated") {
    throw new Error("Phase 11A: screenText.renderMode=model_generated forbidden on image path.");
  }
  if (pkg.screenText?.text && pkg.screenText.text !== overlay.title && pkg.screenText.text !== overlay.subtitle) {
    throw new Error("Phase 11A: screenText must match overlay title or subtitle.");
  }
  const copy = overlayCopyFromSpec(overlay);
  assertNoOverlayCopyLeak(pkg.subject.description, copy, "subject");
  assertNoOverlayCopyLeak(pkg.action.primaryAction, copy, "action");
  assertNoOverlayCopyLeak(pkg.environment.description, copy, "environment");
  const imageVariant = pkg.variants.find((v) => v.capabilityProfile === "image.text_to_image");
  if (imageVariant?.positive) {
    assertNoOverlayCopyLeak(imageVariant.positive, copy, "image_variant");
  }
  const visualVariant = buildPhase11AImageVisualVariant({ pkg, overlay });
  return {
    locale: overlay.locale,
    visualDescription: {
      subject: pkg.subject.description,
      action: pkg.action.primaryAction,
      environment: pkg.environment.description,
      camera: `${pkg.camera.shotSize}/${pkg.camera.angle}`,
      composition: pkg.composition.subjectPosition,
      style: pkg.style.brandAlignment,
    },
    visualVariant,
    visualVariantFingerprint: fingerprintImageVisualVariant(visualVariant),
    overlay,
    screenTextRenderMode: "post_production",
  };
}

export function overlaySpecFromValidatedSceneCopy(input: {
  locale: string;
  title: string;
  subtitle?: string;
  callToAction?: string;
  legalLine?: string;
}): ImageTextOverlaySpec {
  return createDefaultPhase11AOverlaySpec(input);
}
