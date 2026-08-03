/**
 * Build canonical input from a validated GenerationCommand (VHS-109).
 */

import type { BriefAspectRatio } from "@/domain/brief";
import {
  buildCanonicalInput,
  type CanonicalGenerationInput,
  type GenerationCommand,
} from "@/domain/generation";

export type ResolveCanonicalInputOptions = {
  aspectRatio?: BriefAspectRatio;
  durationSeconds?: number;
  language?: string;
};

/**
 * Resolves prompt text from the ScenePackage variant (authoritative rendered prompt).
 */
export function resolveCanonicalInput(
  command: GenerationCommand,
  options: ResolveCanonicalInputOptions = {},
): CanonicalGenerationInput {
  const step = command.step;
  const variant = step.promptVariantId
    ? command.scenePackage.variants.find((v) => v.id === step.promptVariantId)
    : command.scenePackage.variants.find(
        (v) => v.capabilityProfile === step.capabilityProfile,
      );

  const promptText = variant?.positive ?? "";
  const negativePrompt = variant?.negative;
  const rendererVersion = variant?.rendererVersion;
  const dialogueText =
    command.scenePackage.dialogue?.text ??
    (step.action === "voice" ? promptText : undefined);

  return buildCanonicalInput({
    command,
    promptText,
    negativePrompt,
    rendererVersion,
    aspectRatio: options.aspectRatio,
    durationSeconds:
      options.durationSeconds ?? step.expectedOutput.durationSeconds,
    language: options.language ?? command.scenePackage.dialogue?.language,
    dialogueText,
  });
}
