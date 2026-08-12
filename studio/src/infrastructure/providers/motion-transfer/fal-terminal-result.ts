/**
 * MT-013K-OUTPUT-TRANSPORT — strict terminal fal result validation.
 * Public surface remains an opaque descriptor; URL stays memory-only.
 */

import { MotionTransferDomainError } from "@/domain/motion";
import { MV001_DURATION_SECONDS } from "@/application/motion/mv001/mv001-benchmark-profile";
import type { FalMotionControlStatusResponse } from "./fal-motion-control-transport";
import { falMediaOriginLabel } from "./safe-fal-media-fetch";

export const FAL_TERMINAL_RESULT_VERSION = "mt013k-terminal-result-1.0.0" as const;

export type ValidatedFalTerminalVideo = {
  /** Ephemeral — caller must not persist / log. */
  videoUrl: string;
  mimeType: "video/mp4";
  sizeBytes?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  originLabel: string;
};

function countVideoOutputs(result: NonNullable<FalMotionControlStatusResponse["result"]>): number {
  if (typeof result.outputCount === "number" && Number.isFinite(result.outputCount)) {
    return result.outputCount;
  }
  if (Array.isArray(result.videos)) {
    return result.videos.length;
  }
  if (result.videoUrl?.trim()) return 1;
  return 0;
}

/**
 * Fail-closed validation of a fal terminal result for exactly one mp4 video.
 */
export function assertValidatedFalTerminalVideo(
  response: FalMotionControlStatusResponse,
  options: {
    expectedDurationSeconds?: number;
    expectedMimeType?: string;
  } = {},
): ValidatedFalTerminalVideo {
  if (response.status !== "COMPLETED") {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Résultat fal non terminal COMPLETED.",
      { diagnostic: `status=${String(response.status).slice(0, 40)}` },
    );
  }
  const result = response.result;
  if (!result || typeof result !== "object") {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Résultat fal malformed — payload absent.",
    );
  }

  const outputCount = countVideoOutputs(result);
  if (outputCount === 0) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Résultat fal — aucune vidéo attendue.",
    );
  }
  if (outputCount !== 1) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Résultat fal — sélection silencieuse interdite parmi plusieurs outputs.",
      { diagnostic: `outputs=${outputCount}` },
    );
  }

  const videoUrl = result.videoUrl?.trim();
  if (!videoUrl) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Résultat fal — URL/référence vidéo absente.",
    );
  }
  if (/^data:/i.test(videoUrl) || videoUrl.includes(";base64,")) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "data URL / base64 interdit dans le résultat fal.",
    );
  }

  const mimeType = (result.contentType ?? "video/mp4").split(";")[0]?.trim().toLowerCase();
  const expectedMime = (options.expectedMimeType ?? "video/mp4").toLowerCase();
  if (mimeType !== "video/mp4" || expectedMime !== "video/mp4") {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "MIME fal non autorisé — video/mp4 requis.",
      { diagnostic: `mime=${mimeType}` },
    );
  }

  if (result.fileSize != null) {
    if (!Number.isFinite(result.fileSize) || result.fileSize <= 0) {
      throw new MotionTransferDomainError(
        "provider_output_invalid",
        "Résultat fal — taille output invalide / vide.",
      );
    }
  }

  const expectedDuration =
    options.expectedDurationSeconds ?? MV001_DURATION_SECONDS;
  if (result.durationSeconds != null) {
    if (
      !Number.isFinite(result.durationSeconds) ||
      result.durationSeconds <= 0
    ) {
      throw new MotionTransferDomainError(
        "provider_output_invalid",
        "Résultat fal — durée incompatible.",
      );
    }
    // Compatible window for MV-001 8s (±1s) when declared.
    if (Math.abs(result.durationSeconds - expectedDuration) > 1.01) {
      throw new MotionTransferDomainError(
        "provider_output_invalid",
        "Résultat fal — durée hors fenêtre attendue.",
        {
          diagnostic: `duration=${result.durationSeconds}`,
        },
      );
    }
  }

  if (result.width != null && (!Number.isFinite(result.width) || result.width < 16)) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Résultat fal — largeur incohérente.",
    );
  }
  if (result.height != null && (!Number.isFinite(result.height) || result.height < 16)) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Résultat fal — hauteur incohérente.",
    );
  }
  if (result.fps != null && (!Number.isFinite(result.fps) || result.fps < 1 || result.fps > 120)) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Résultat fal — fps incohérent.",
    );
  }

  return {
    videoUrl,
    mimeType: "video/mp4",
    sizeBytes: result.fileSize,
    durationSeconds: result.durationSeconds,
    width: result.width,
    height: result.height,
    fps: result.fps,
    originLabel: falMediaOriginLabel(videoUrl),
  };
}
