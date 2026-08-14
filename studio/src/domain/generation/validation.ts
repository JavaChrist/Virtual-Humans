/**
 * Command and input validation (VHS-109).
 */

import type { BriefAspectRatio } from "@/domain/brief";
import type { ScenePackage } from "@/domain/prompt";
import type { GenerationStep } from "@/domain/routing/router";
import type { GenerationCommand } from "./command";
import { GenerationDomainError } from "./errors";
import { validateIdempotencyKey } from "./idempotency";
import {
  assertAssetAccessUsable,
  type CanonicalGenerationInput,
  type ResolvedGenerationInput,
} from "./input";

export function validateGenerationCommand(command: GenerationCommand): void {
  validateIdempotencyKey(command.idempotencyKey);
  if (!Number.isInteger(command.attempt) || command.attempt < 1) {
    throw new GenerationDomainError("invalid_input", "Attempt must be a positive integer.");
  }
  const at = Date.parse(command.requestedAt);
  if (!Number.isFinite(at)) {
    throw new GenerationDomainError("invalid_input", "requestedAt must be a valid UTC timestamp.");
  }

  const { step, scenePackage } = command;
  if (command.projectId !== scenePackage.projectId) {
    throw new GenerationDomainError("invalid_input", "Command project does not match package.");
  }
  if (command.sceneId !== scenePackage.sceneId) {
    throw new GenerationDomainError("invalid_input", "Command scene does not match package.");
  }

  if (step.capabilityProfile) {
    const variantOk =
      !step.promptVariantId ||
      scenePackage.variants.some(
        (v) =>
          v.id === step.promptVariantId &&
          v.capabilityProfile === step.capabilityProfile,
      );
    if (step.promptVariantId && !variantOk) {
      throw new GenerationDomainError(
        "invalid_input",
        "promptVariantId not found for capability profile.",
      );
    }
  }

  // Required scene references must appear in resolvedInputs
  for (const ref of scenePackage.references.filter((r) => r.required)) {
    const found = command.resolvedInputs.some(
      (ri) => ri.asset.assetId === ref.sourceId || ri.asset.assetId === ref.id,
    );
    if (!found) {
      // Also accept role match for required refs
      const byRole = command.resolvedInputs.some((ri) => ri.role === ref.role);
      if (!byRole) {
        throw new GenerationDomainError(
          "invalid_input",
          "Required reference is not resolved.",
          { diagnostic: `ref=${ref.id}` },
        );
      }
    }
  }

  // Dependencies must be represented
  for (const dep of step.dependsOnStepIds) {
    const found = command.resolvedInputs.some((ri) => ri.fromStepId === dep);
    if (!found) {
      throw new GenerationDomainError(
        "invalid_input",
        "Step dependency is not represented in resolvedInputs.",
        { diagnostic: `dep=${dep}` },
      );
    }
  }

  for (const ri of command.resolvedInputs) {
    assertAssetAccessUsable(ri.asset, command.requestedAt);
  }
}

export function assertStepPackageProfile(
  step: GenerationStep,
  scenePackage: ScenePackage,
): void {
  if (step.promptVariantId) {
    const v = scenePackage.variants.find((x) => x.id === step.promptVariantId);
    if (!v) {
      throw new GenerationDomainError("invalid_input", "Prompt variant missing from package.");
    }
    if (v.capabilityProfile !== step.capabilityProfile) {
      throw new GenerationDomainError(
        "invalid_input",
        "Prompt variant profile does not match step.",
      );
    }
  }
}

export function buildCanonicalInput(input: {
  command: GenerationCommand;
  promptText: string;
  negativePrompt?: string;
  rendererVersion?: string;
  aspectRatio?: BriefAspectRatio;
  durationSeconds?: number;
  language?: string;
  dialogueText?: string;
}): CanonicalGenerationInput {
  const { command, promptText } = input;
  const step = command.step;
  const refs = command.resolvedInputs.map((r) => r.asset);
  const common = {
    action: step.action,
    capabilityProfile: step.capabilityProfile,
    providerId: step.providerId,
    modelId: step.modelId,
    promptText,
    promptVariantId: step.promptVariantId,
    rendererVersion: input.rendererVersion,
    aspectRatio: input.aspectRatio,
    negativePrompt: input.negativePrompt,
    references: refs,
  };

  switch (step.action) {
    case "image":
    case "scene_image":
    case "duo_frame":
      return {
        ...common,
        kind: "image",
        action: step.action,
      };
    case "video": {
      const start = command.resolvedInputs.find(
        (r) =>
          r.role === "start_frame" ||
          r.role === "i2v_start_frame" ||
          r.asset.kind === "image" ||
          r.fromStepId,
      );
      return {
        ...common,
        kind: "video",
        action: "video",
        durationSeconds:
          input.durationSeconds ??
          step.expectedOutput.durationSeconds ??
          0,
        startFrame: start?.asset,
      };
    }
    case "voice":
      return {
        ...common,
        kind: "voice",
        action: "voice",
        text: input.dialogueText ?? promptText,
        language: input.language,
        voiceAsset: command.resolvedInputs.find((r) => r.asset.kind === "voice")?.asset,
      };
    case "lipsync": {
      const video = command.resolvedInputs.find(
        (r) => r.asset.kind === "video" || r.role === "video",
      );
      const audio = command.resolvedInputs.find(
        (r) => r.asset.kind === "audio" || r.role === "audio",
      );
      if (!video || !audio) {
        throw new GenerationDomainError(
          "invalid_input",
          "Lipsync requires resolved video and audio inputs.",
        );
      }
      return {
        ...common,
        kind: "lipsync",
        action: "lipsync",
        video: video.asset,
        audio: audio.asset,
        durationSeconds: input.durationSeconds,
      };
    }
    case "carousel": {
      const images = command.resolvedInputs
        .filter((r) => r.asset.kind === "image" || r.asset.kind === "screen")
        .map((r) => r.asset);
      if (images.length === 0) {
        throw new GenerationDomainError(
          "invalid_input",
          "Carousel requires at least one image input.",
        );
      }
      return {
        ...common,
        kind: "carousel",
        action: "carousel",
        durationSeconds: input.durationSeconds ?? step.expectedOutput.durationSeconds ?? 1,
        images,
      };
    }
    case "motion_transfer": {
      if (step.capabilityProfile !== "video.motion_transfer") {
        throw new GenerationDomainError(
          "invalid_input",
          "motion_transfer action requires video.motion_transfer capability.",
        );
      }
      const source = command.resolvedInputs.find(
        (r) => r.role === "source_video" || r.asset.kind === "video",
      );
      if (!source) {
        throw new GenerationDomainError(
          "invalid_input",
          "motion_transfer requires a resolved source_video input.",
        );
      }
      // Never treat start_frame / I2V image as motion source.
      const startFrame = command.resolvedInputs.find((r) => r.role === "start_frame");
      if (startFrame && !source) {
        throw new GenerationDomainError(
          "invalid_input",
          "I2V start_frame cannot satisfy motion_transfer source video.",
        );
      }
      const identityReferences = command.resolvedInputs
        .filter(
          (r) =>
            r.role === "identity" ||
            r.asset.kind === "character" ||
            r.role === "reference_image",
        )
        .map((r) => r.asset);
      if (identityReferences.length === 0) {
        throw new GenerationDomainError(
          "invalid_input",
          "motion_transfer requires at least one identity reference.",
        );
      }
      const outfit = command.resolvedInputs.find(
        (r) => r.role === "outfit" || r.asset.kind === "outfit",
      );
      return {
        ...common,
        kind: "motion_transfer",
        action: "motion_transfer",
        capabilityProfile: "video.motion_transfer",
        durationSeconds:
          input.durationSeconds ??
          step.expectedOutput.durationSeconds ??
          0,
        sourceVideo: source.asset,
        identityReferences,
        outfitReference: outfit?.asset,
      };
    }
    case "merge":
    case "merge_audio":
      throw new GenerationDomainError(
        "model_not_supported",
        "Action is not supported as a primary Generation Engine step.",
        { diagnostic: step.action },
      );
    default: {
      const _e: never = step.action;
      throw new GenerationDomainError(
        "model_not_supported",
        "Action is not supported by the Generation Engine.",
        { diagnostic: String(_e) },
      );
    }
  }
}

export function collectResolvedAssetIds(inputs: ResolvedGenerationInput[]): string[] {
  return inputs.map((i) => i.asset.assetId);
}
