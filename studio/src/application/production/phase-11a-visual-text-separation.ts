/**
 * Split validated ScenePackage visual content from marketing overlay strings.
 * Overlay copy never enters the provider image prompt.
 */

import type { ScenePackage } from "@/domain/prompt";
import {
  createDefaultPhase11AOverlaySpec,
  parseImageTextOverlaySpec,
  type ImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";

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
  overlay: ImageTextOverlaySpec;
  screenTextRenderMode: "post_production";
};

export function separatePhase11AVisualAndText(input: {
  pkg: ScenePackage;
  overlay: ImageTextOverlaySpec;
}): Phase11AVisualTextSeparation {
  const { pkg, overlay } = input;
  parseImageTextOverlaySpec(overlay);
  if (pkg.screenText?.renderMode === "model_generated") {
    throw new Error("Phase 11A: screenText.renderMode=model_generated forbidden on image path.");
  }
  const locale = overlay.locale;
  if (pkg.screenText?.text && pkg.screenText.text !== overlay.title && pkg.screenText.text !== overlay.subtitle) {
    throw new Error("Phase 11A: screenText must match overlay title or subtitle.");
  }
  return {
    locale,
    visualDescription: {
      subject: pkg.subject.description,
      action: pkg.action.primaryAction,
      environment: pkg.environment.description,
      camera: `${pkg.camera.shotSize}/${pkg.camera.angle}`,
      composition: pkg.composition.subjectPosition,
      style: pkg.style.brandAlignment,
    },
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
