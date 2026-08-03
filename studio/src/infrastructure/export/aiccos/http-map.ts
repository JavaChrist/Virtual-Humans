/**
 * Map pipeline results to historical /api/aiccos/send HTTP responses (VHS-111C).
 */

import type { AiccosExportPipelineResult } from "./contracts";

export type HistoricalAiccosHttpResponse = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Exact historical public messages / statuses for the Route Handler.
 */
export function mapPipelineResultToHistoricalHttp(
  result: AiccosExportPipelineResult
): HistoricalAiccosHttpResponse {
  if (result.status === "delivered") {
    return {
      status: 200,
      body: {
        clip: {
          id: result.externalId,
          publicUrl: result.publicUrl,
          title: result.title,
        },
      },
    };
  }

  const err = result.error;
  const h = err.historical;

  if (err.code === "aiccos_not_configured") {
    return {
      status: 500,
      body: {
        error:
          "AICCOS_IMPORT_TOKEN manquant dans .env.local — impossible d'envoyer vers AICCOS.",
      },
    };
  }

  if (err.code === "invalid_source_url") {
    return { status: 400, body: { error: "URL de vidéo invalide." } };
  }

  if (err.code === "invalid_export_package" && err.publicMessage === "Un titre est requis.") {
    return { status: 400, body: { error: "Un titre est requis." } };
  }

  if (err.code === "source_empty") {
    return { status: 502, body: { error: "La vidéo téléchargée est vide." } };
  }

  if (err.code === "source_too_large" && h?.sizeBytes != null) {
    const mo = (h.sizeBytes / 1024 / 1024).toFixed(1);
    return {
      status: 400,
      body: { error: `Vidéo trop lourde pour AICCOS : ${mo} Mo (max 50 Mo).` },
    };
  }

  if (err.code === "source_download_failed" && h?.downloadStatus != null) {
    return {
      status: 502,
      body: { error: `Téléchargement de la vidéo impossible (${h.downloadStatus}).` },
    };
  }

  if (
    (err.code === "import_creation_failed" ||
      err.code === "aiccos_unauthorized" ||
      err.code === "aiccos_rate_limited" ||
      err.code === "aiccos_unavailable" ||
      err.code === "invalid_import_session") &&
    (h?.prepareStatus != null || err.publicMessage.includes("préparation"))
  ) {
    return {
      status: 502,
      body: {
        error:
          h?.prepareError ??
          (h?.prepareStatus != null
            ? `AICCOS a refusé la préparation (${h.prepareStatus}).`
            : err.publicMessage),
      },
    };
  }

  if (err.code === "upload_failed") {
    const status = h?.uploadStatus ?? 0;
    const detail = h?.uploadDetail ?? "";
    return {
      status: 502,
      body: {
        error: `L'upload du clip a échoué (${status}). ${detail}`.trimEnd(),
      },
    };
  }

  if (
    err.code === "complete_failed" ||
    err.code === "invalid_clip_result" ||
    h?.completeStatus != null
  ) {
    return {
      status: 502,
      body: {
        error:
          h?.completeError ??
          (h?.completeStatus != null
            ? `AICCOS a refusé l'enregistrement (${h.completeStatus}).`
            : err.publicMessage),
      },
    };
  }

  return {
    status: err.httpStatusHint ?? 502,
    body: { error: err.publicMessage },
  };
}
