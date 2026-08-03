/**
 * Normalized MergeResult + validation (VHS-111).
 */

import type { GeneratedAsset } from "@/domain/generation";
import type { PostProductionErrorCode } from "./errors";
import type { MergeEngineCapabilities } from "./merge-capabilities";
import type { MergePlan } from "./merge-plan";

export type ExternalMergeJobRef = {
  providerId: string;
  modelId: string;
  externalJobId: string;
};

export type MergeError = {
  code: PostProductionErrorCode;
  retryable: boolean;
  publicMessage: string;
};

export type MergeResult =
  | {
      status: "completed";
      asset: GeneratedAsset;
      completedAt: string;
    }
  | {
      status: "submitted" | "processing";
      job: ExternalMergeJobRef;
      pollAfterMs?: number;
    }
  | {
      status: "failed";
      error: MergeError;
      failedAt: string;
    }
  | {
      status: "cancelled";
      cancelledAt: string;
    };

export type MergeValidationResult = {
  valid: boolean;
  capabilities: MergeEngineCapabilities;
  issues: { code: string; message: string; blocking: boolean }[];
  warnings: { code: string; message: string }[];
};

export type MergeExecutionContext = {
  correlationId: string;
  requestedAt: string;
  signal?: AbortSignal;
};

export function validateMergePlanAgainstCapabilities(
  plan: MergePlan,
  capabilities: MergeEngineCapabilities
): MergeValidationResult {
  const issues: MergeValidationResult["issues"] = [];
  const warnings: MergeValidationResult["warnings"] = [];

  if (!capabilities.executionEnabled) {
    issues.push({
      code: "merge_execution_unavailable",
      message: "MergeEngine non configuré pour l'exécution.",
      blocking: true,
    });
  }

  for (const t of plan.transitions) {
    if (!capabilities.supportedTransitions.includes(t.kind)) {
      issues.push({
        code: "unsupported_transition",
        message: `Transition ${t.kind} non supportée.`,
        blocking: true,
      });
    }
  }

  if (plan.overlays.length > 0 && !capabilities.postProductionText && !capabilities.overlays) {
    issues.push({
      code: "unsupported_overlay",
      message: "Overlays / texte postproduction non supportés par l'engine.",
      blocking: true,
    });
  }

  if (plan.audio.targetLoudnessLufs != null && !capabilities.loudnessLufs) {
    warnings.push({
      code: "lufs_unsupported",
      message: "Cible LUFS déclarée mais non supportée — non appliquée.",
    });
  }

  if (
    (plan.audio.fadeInSeconds != null || plan.audio.fadeOutSeconds != null) &&
    !capabilities.audioFades
  ) {
    warnings.push({
      code: "audio_fades_unsupported",
      message: "Fades audio non supportés.",
    });
  }

  const nonEmbedded = plan.audio.tracks.filter((t) => t.role !== "embedded_video");
  if (nonEmbedded.length > 0 && !capabilities.singleAudioMux && !capabilities.multiTrackMix) {
    issues.push({
      code: "unsupported_audio_mix",
      message: "Mix audio multi-sources non supporté.",
      blocking: true,
    });
  }

  if (plan.output.videoCodec && !capabilities.explicitCodecControl) {
    warnings.push({
      code: "codec_not_controlled",
      message: "Codec demandé non contrôlé par l'engine historique.",
    });
  }

  return {
    valid: issues.filter((i) => i.blocking).length === 0,
    capabilities,
    issues,
    warnings,
  };
}
