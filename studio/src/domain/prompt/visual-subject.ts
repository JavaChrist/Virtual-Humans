/**
 * Derive a provider-safe visual subject for text_motion scenes.
 * Never copies screenText / overlay title / CTA.
 */

import type { VisualDirection } from "@/domain/art";
import type { CreativeConcept } from "@/domain/creative";
import type { StoryboardScene } from "@/domain/storyboard";
import { findOverlayCopyLeak } from "@/domain/production/overlay-copy-leak";
import { PROMPT_FIELD_LIMITS } from "./scene-package";

export const PHASE_11A_SCENE2_FUNCTIONAL_VISUAL_SUBJECT =
  "An abstract idea gradually becoming an organized structure: luminous modular elements assembling, visual progression from diffuse to ordered, reserved empty negative space for later typographic overlay. No letters, numbers, pseudo-glyphs, text buttons, or written interfaces." as const;

export const PHASE_11A_SCENE2_FUNCTIONAL_VISUAL_ACTION =
  "Luminous modular elements assemble from diffuse to ordered" as const;

function visualForScene(visual: VisualDirection, scene: StoryboardScene) {
  return visual.segments.find((s) => s.id === scene.visualDirectionSegmentId);
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function isLeakFree(text: string, forbidden: readonly string[]): boolean {
  return findOverlayCopyLeak(text, forbidden, "visual_subject_candidate") === null;
}

function appendNoTextAndNegativeSpace(description: string): string {
  const lower = description.toLowerCase();
  const bits = [description.trim()];
  if (!/negative space|espace négatif|textsafe|safe area/.test(lower)) {
    bits.push("Reserved empty negative space for later typographic overlay.");
  }
  if (!/\bno (letters|text|words|numbers)\b/.test(lower)) {
    bits.push("No letters, numbers, pseudo-glyphs, text buttons, or written interfaces.");
  }
  return bits.join(" ");
}

/**
 * Visual subject for text_motion. Prefers a leak-free VisualDirection /
 * CreativeConcept metaphor. For scene-2 / problem, falls back to the
 * functional idea→structure direction without copying overlay copy.
 */
export function deriveTextMotionVisualSubject(input: {
  scene: StoryboardScene;
  visual: VisualDirection;
  concept?: CreativeConcept;
  forbiddenCopy: readonly string[];
}): string {
  const { scene, visual, concept, forbiddenCopy } = input;
  const vd = visualForScene(visual, scene);
  const candidates: string[] = [];
  if (vd?.environment.description?.trim()) candidates.push(vd.environment.description.trim());
  if (vd?.location.description?.trim()) candidates.push(vd.location.description.trim());
  if (concept) {
    for (const device of [concept.openingDevice, concept.proofDevice, concept.endingDevice]) {
      if (device?.kind === "visual_metaphor" && device.description?.trim()) {
        candidates.push(device.description.trim());
      }
    }
  }

  const leakFree = candidates.filter(
    (c) => c.length >= 24 && isLeakFree(c, forbiddenCopy) && c !== scene.screenText,
  );
  const precise = leakFree.find((c) => c.length >= 40);

  const isScene2 =
    scene.id === "scene-2" ||
    scene.order === 2 ||
    (scene.purpose === "problem" && scene.productionIntent === "text_motion");

  const base = precise
    ? appendNoTextAndNegativeSpace(precise)
    : isScene2
      ? PHASE_11A_SCENE2_FUNCTIONAL_VISUAL_SUBJECT
      : appendNoTextAndNegativeSpace(
          leakFree[0] ??
            `Visual metaphor for ${scene.purpose} with reserved negative space and no painted copy`,
        );

  if (!isLeakFree(base, forbiddenCopy)) {
    if (isScene2) return PHASE_11A_SCENE2_FUNCTIONAL_VISUAL_SUBJECT;
    throw new Error("Phase 11A: visual subject derivation leaked overlay copy.");
  }
  return clip(base, PROMPT_FIELD_LIMITS.description);
}

export function deriveTextMotionVisualAction(input: {
  scene: StoryboardScene;
  hintedAction?: string;
  forbiddenCopy: readonly string[];
}): string {
  const hinted = input.hintedAction?.trim();
  if (
    hinted &&
    hinted !== input.scene.screenText &&
    isLeakFree(hinted, input.forbiddenCopy)
  ) {
    return clip(hinted, PROMPT_FIELD_LIMITS.action);
  }
  const isScene2 =
    input.scene.id === "scene-2" ||
    input.scene.order === 2 ||
    (input.scene.purpose === "problem" && input.scene.productionIntent === "text_motion");
  if (isScene2) return PHASE_11A_SCENE2_FUNCTIONAL_VISUAL_ACTION;
  return "Hold visual intent of the scene";
}

export function overlayForbiddenCopyFromScene(input: {
  scene: StoryboardScene;
  callToAction?: string;
}): string[] {
  return [input.scene.screenText, input.scene.title, input.callToAction]
    .filter((s): s is string => Boolean(s?.trim()))
    .filter((s) => s.trim().length >= 3);
}
