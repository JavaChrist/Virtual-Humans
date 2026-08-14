/**
 * Phase 11A — structured image prompt from validated ScenePackage only.
 * Full prompt is never persisted to logs/public surfaces — hash + metadata only.
 * Marketing copy is never sent to the image provider (no-text policy).
 */

import type { ScenePackage } from "@/domain/prompt";
import {
  overlayStrings,
  PHASE_11A_PROVIDER_TEXT_POLICY,
  PHASE_11A_PROVIDER_TEXT_POLICY_VERSION,
  PHASE_11A_TEXT_OVERLAY_MODE,
  type ImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";
import { assertNoOverlayCopyLeak } from "@/domain/production/overlay-copy-leak";
import {
  assertPhase11ADoesNotInvokeMotionEndpoint,
  assertPhase11ADoesNotUseMotionProject,
} from "./phase-11a-motion-isolation";
import {
  hashPhase11APrompt,
  PHASE_11A_SMOKE_CAPABILITY,
  PHASE_11A_SMOKE_SCENE_ID,
} from "./phase-11a-openai-image-allowlist";

export const PHASE_11A_IMAGE_PROMPT_VERSION = "phase-11a-image-prompt-v2" as const;

export const PHASE_11A_NO_TEXT_POSITIVE_BLOCK = [
  "Visual composition, mood, palette, subject, action, environment, framing, lighting, style, and art direction only.",
  "Reserve empty negative space in the lower third for a later typographic overlay.",
  "No text. No letters. No words. No numbers. No captions. No written logo. No watermark.",
  "No textual interface. No pseudo-glyphs. No text inside buttons.",
  "No letters, words, digits, captions, labels, logos, watermarks, or UI glyphs.",
  "No buttons with text. No fake lettering. No simulated interfaces containing glyphs.",
].join(" ");

export const PHASE_11A_NO_TEXT_NEGATIVE =
  "letters, words, numbers, captions, labels, logos, watermarks, UI glyphs, buttons with text, fake lettering, simulated interface text";

const DRAW_TEXT_POSITIVE_RE =
  /\b(draw|write|paint|render|inscribe|add|include)\b[\s\S]{0,48}\b(text|word|letter|caption|title|subtitle|cta|button label|glyph)\b/i;

export type Phase11AImagePromptBuild = {
  /** Memory-only — caller must not log or persist. */
  promptText: string;
  negativePrompt?: string;
  promptHash: string;
  promptVersion: typeof PHASE_11A_IMAGE_PROMPT_VERSION;
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
    providerTextPolicy: typeof PHASE_11A_PROVIDER_TEXT_POLICY;
    textOverlayMode: typeof PHASE_11A_TEXT_OVERLAY_MODE;
    providerTextPolicyVersion: typeof PHASE_11A_PROVIDER_TEXT_POLICY_VERSION;
    promptHash: string;
  };
};

/** Hard URL/path schemes only — avoid false positives on ordinary prose. */
const LOCAL_PATH_RE = /(?:[A-Za-z]:\\(?:Users|home)|\/(?:Users|home)\/|file:\/\/)/i;
const URL_RE = /https?:\/\/|blob:|data:image\/|data:application\//i;
const MOTION_MARKERS = /motion[_-]?transfer|kling-video|mv-?001|privacy[_-]?pack/i;

export function assertOverlayStringsNotInProviderPrompt(
  promptText: string,
  spec: ImageTextOverlaySpec,
): void {
  assertNoOverlayCopyLeak(promptText, overlayStrings(spec), "provider_prompt");
}

export function assertPhase11APromptDoesNotAskToDrawWords(visualSource: string): void {
  if (DRAW_TEXT_POSITIVE_RE.test(visualSource)) {
    throw new Error("Phase 11A prompt: must not instruct the model to draw words.");
  }
}

/**
 * Build image prompt exclusively from ScenePackage blocks / validated variant.
 * Rejects local paths, signed URLs, Motion private data, raw user dumps, overlay copy.
 */
export function buildPhase11AImagePromptFromScenePackage(
  pkg: ScenePackage,
  options?: { overlay?: ImageTextOverlaySpec },
): Phase11AImagePromptBuild {
  assertPhase11ADoesNotUseMotionProject(pkg.projectId);
  if (pkg.sceneId !== PHASE_11A_SMOKE_SCENE_ID && pkg.sceneId !== "sc-2") {
    // Allow test aliases only when sceneOrder matches smoke; production smoke is scene-2.
    if (pkg.sceneOrder !== 2) {
      throw new Error("Phase 11A prompt: scene not in allowlist.");
    }
  }

  if (pkg.screenText?.renderMode === "model_generated") {
    throw new Error("Phase 11A prompt: screenText.renderMode=model_generated forbidden.");
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
  assertPhase11APromptDoesNotAskToDrawWords(variant.positive);

  if (pkg.screenText?.text && pkg.screenText.text.length >= 3) {
    if (variant.positive.toLowerCase().includes(pkg.screenText.text.toLowerCase())) {
      throw new Error("Phase 11A prompt: screenText copy must not appear in the image variant.");
    }
    assertNoOverlayCopyLeak(variant.positive, [pkg.screenText.text], "image_variant");
  }

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
    `textSafeArea:${pkg.composition.textSafeArea}`,
    continuity ? `continuity:${continuity}` : "",
    brand ? `brand:${brand}` : "",
    safety ? `safety:${safety}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  assertPhase11APromptDoesNotAskToDrawWords(compositionBits);

  // Prefer validated renderer variant; append structured continuity + no-text policy.
  const promptText = [variant.positive.trim(), compositionBits, PHASE_11A_NO_TEXT_POSITIVE_BLOCK].join(
    "\n\n",
  );
  if (options?.overlay) {
    assertOverlayStringsNotInProviderPrompt(variant.positive, options.overlay);
    assertOverlayStringsNotInProviderPrompt(compositionBits, options.overlay);
    assertOverlayStringsNotInProviderPrompt(promptText, options.overlay);
  }
  if (pkg.screenText?.text && pkg.screenText.text.length >= 3) {
    if (promptText.toLowerCase().includes(pkg.screenText.text.toLowerCase())) {
      throw new Error("Phase 11A prompt: screenText copy leaked into provider prompt.");
    }
    assertNoOverlayCopyLeak(promptText, [pkg.screenText.text], "provider_prompt");
  }

  const negativeParts = [
    variant.negative?.trim(),
    forbidden || undefined,
    PHASE_11A_NO_TEXT_NEGATIVE,
    "local file paths",
    "watermarks",
    "readable private URLs",
  ].filter(Boolean);

  const promptHash = hashPhase11APrompt(promptText);

  return {
    promptText,
    negativePrompt: negativeParts.join(", "),
    promptHash,
    promptVersion: PHASE_11A_IMAGE_PROMPT_VERSION,
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
      providerTextPolicy: PHASE_11A_PROVIDER_TEXT_POLICY,
      textOverlayMode: PHASE_11A_TEXT_OVERLAY_MODE,
      providerTextPolicyVersion: PHASE_11A_PROVIDER_TEXT_POLICY_VERSION,
      promptHash,
    },
  };
}
