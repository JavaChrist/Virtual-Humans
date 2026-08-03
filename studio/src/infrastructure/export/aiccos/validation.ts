/**
 * Request validation mirroring historical /api/aiccos/send (VHS-111C).
 */

import {
  AICCOS_MAX_BYTES,
  type AiccosExportRequest,
} from "./contracts";
import { AiccosPipelineError } from "./errors";

export type HistoricalAiccosBody = {
  videoUrl?: unknown;
  title?: unknown;
  productSlug?: unknown;
};

/** Pure parse of historical JSON body fields. */
export function parseHistoricalAiccosBody(body: HistoricalAiccosBody): AiccosExportRequest {
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const productSlug =
    typeof body.productSlug === "string" && body.productSlug.trim()
      ? body.productSlug.trim()
      : null;

  if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
    throw new AiccosPipelineError("invalid_source_url", "URL de vidéo invalide.", {
      httpStatusHint: 400,
    });
  }
  if (!title) {
    throw new AiccosPipelineError("invalid_export_package", "Un titre est requis.", {
      httpStatusHint: 400,
    });
  }

  return { videoUrl, title, productSlug };
}

export function assertSizeWithinLimit(sizeBytes: number): void {
  if (sizeBytes === 0) {
    throw new AiccosPipelineError("source_empty", "La vidéo téléchargée est vide.", {
      httpStatusHint: 502,
    });
  }
  if (sizeBytes > AICCOS_MAX_BYTES) {
    const mo = (sizeBytes / 1024 / 1024).toFixed(1);
    throw new AiccosPipelineError(
      "source_too_large",
      `Vidéo trop lourde pour AICCOS : ${mo} Mo (max 50 Mo).`,
      {
        httpStatusHint: 400,
        historical: { sizeBytes },
      }
    );
  }
}

/** Historical MIME: content-type header first segment, else video/mp4. */
export function resolveHistoricalMime(contentTypeHeader: string | null | undefined): string {
  return contentTypeHeader?.split(";")[0] || "video/mp4";
}

/**
 * Historical fileNameFromUrl with injectable clock (no Date.now in pure path).
 */
export function fileNameFromUrl(videoUrl: string, nowMs: number): string {
  try {
    const last = new URL(videoUrl).pathname.split("/").pop() ?? "";
    if (/\.(mp4|webm|mov)$/i.test(last)) return last;
  } catch {
    // fall through
  }
  return `clip-${nowMs}.mp4`;
}

/** Safe origin label for metadata — hostname only when parseable. */
export function safeOriginLabel(url: string): string {
  try {
    return new URL(url).hostname || "external";
  } catch {
    return "external";
  }
}
