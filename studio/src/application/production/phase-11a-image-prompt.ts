/**
 * Phase 11A — structured image prompt from validated ScenePackage only.
 * Full prompt is never persisted to logs/public surfaces — hash + metadata only.
 */

import type { ScenePackage } from "@/domain/prompt";
import {
  assertPhase11ADoesNotInvokeMotionEndpoint,
  assertPhase11ADoesNotUseMotionProject,
} from "./phase-11a-motion-isolation";
import {
  hashPhase11APrompt,
  PHASE_11A_SMOKE_CAPABILITY,
  PHASE_11A_SMOKE_SCENE_ID,
} from "./phase-11a-openai-image-allowlist";

export type Phase11AImagePromptBuild = {
  /** Memory-only — caller must not log or persist. */
  promptText: string;
  negativePrompt?: string;
  promptHash: string;
  promptVersion: "phase-11a-image-prompt-v1";
  capabilityProfile: typeof PHASE_11A_SMOKE_CAPABILITY;
  sceneId: string;
  variantId: string;
  includedBlocks: string[];
  redactedMetadata: {
    subjectKind: string;
    hasDialogue: boolean;
    constraintRequiredCount: number;
    constraintForbiddenCount: number;
    referenceCount: number;
  };
};

const LOCAL_PATH_RE = /(?:[A-Za-z]:\\|\/(?:Users|home|var|tmp)\/|file:\/\/)/i;
const URL_RE = /https?:\/\/|blob:|data:/i;
const MOTION_MARKERS = /motion[_-]?transfer|kling-video|mv-?001|privacy[_-]?pack/i;

/**
 * Build image prompt exclusively from ScenePackage blocks / validated variant.
 * Rejects local paths, signed URLs, Motion private data, raw user dumps.
 */
export function buildPhase11AImagePromptFromScenePackage(
  pkg: ScenePackage,
): Phase11AImagePromptBuild {
  assertPhase11ADoesNotUseMotionProject(pkg.projectId);
  if (pkg.sceneId !== PHASE_11A_SMOKE_SCENE_ID && pkg.sceneId !== "sc-2") {
    // Allow test aliases only when sceneOrder matches smoke; production smoke is scene-2.
    if (pkg.sceneOrder !== 2) {
      throw new Error("Phase 11A prompt: scene not in allowlist.");
    }
  }

  for (const ref of pkg.references) {
    const raw = JSON.stringify(ref);
    if (URL_RE.test(raw) || LOCAL_PATH_RE.test(raw)) {
      throw new Error("Phase 11A prompt: references must not contain URLs or local paths.");
    }
    if (MOTION_MARKERS.test(raw)) {
      throw new Error("Phase 11A prompt: Motion private references forbidden.");
    }
  }

  const variant =
    pkg.variants.find((v) => v.capabilityProfile === PHASE_11A_SMOKE_CAPABILITY) ??
    pkg.variants.find((v) => v.mediaType === "image");

  if (!variant?.positive?.trim()) {
    throw new Error("Phase 11A prompt: missing image.text_to_image variant.");
  }

  if (LOCAL_PATH_RE.test(variant.positive) || URL_RE.test(variant.positive)) {
    throw new Error("Phase 11A prompt: variant must not contain URLs or local paths.");
  }
  if (MOTION_MARKERS.test(variant.positive)) {
    throw new Error("Phase 11A prompt: Motion content forbidden in variant.");
  }
  assertPhase11ADoesNotInvokeMotionEndpoint(variant.positive);

  const brand = [
    pkg.style.brandAlignment,
    pkg.style.colorIntent,
    ...pkg.constraints.required.map((c) => c.description),
  ]
    .filter(Boolean)
    .slice(0, 6)
    .join("; ");
  const forbidden = pkg.constraints.forbidden
    .map((c) => c.description)
    .filter(Boolean)
    .slice(0, 6)
    .join("; ");
  const safety = pkg.constraints.safety
    .map((c) => c.description)
    .filter(Boolean)
    .slice(0, 4)
    .join("; ");
  const continuity = pkg.constraints.continuity
    .map((c) => c.description)
    .filter(Boolean)
    .slice(0, 4)
    .join("; ");

  const compositionBits = [
    `intent:${pkg.productionIntent}`,
    `subject:${pkg.subject.description}`,
    `action:${pkg.action.primaryAction}`,
    `environment:${pkg.environment.description}`,
    `camera:${pkg.camera.shotSize}/${pkg.camera.angle}`,
    `composition:${pkg.composition.subjectPosition}`,
    continuity ? `continuity:${continuity}` : "",
    brand ? `brand:${brand}` : "",
    safety ? `safety:${safety}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  // Prefer validated renderer variant; append structured continuity constraints only.
  const promptText = [variant.positive.trim(), compositionBits].join("\n\n");
  const negativeParts = [
    variant.negative?.trim(),
    forbidden || undefined,
    "local file paths",
    "watermarks",
    "readable private URLs",
  ].filter(Boolean);

  return {
    promptText,
    negativePrompt: negativeParts.join(", "),
    promptHash: hashPhase11APrompt(promptText),
    promptVersion: "phase-11a-image-prompt-v1",
    capabilityProfile: PHASE_11A_SMOKE_CAPABILITY,
    sceneId: pkg.sceneId,
    variantId: variant.id,
    includedBlocks: [...variant.includedBlocks],
    redactedMetadata: {
      subjectKind: pkg.subject.kind,
      hasDialogue: Boolean(pkg.dialogue?.text),
      constraintRequiredCount: pkg.constraints.required.length,
      constraintForbiddenCount: pkg.constraints.forbidden.length,
      referenceCount: pkg.references.length,
    },
  };
}
