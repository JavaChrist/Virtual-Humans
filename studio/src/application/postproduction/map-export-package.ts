/**
 * Pure ExportPackage → AiccosExportRequest (VHS-111C).
 * Never mutates the package; never invents productSlug; never includes manifest/prompts.
 */

import {
  assertExportAllowed,
  type ExportPackage,
} from "@/domain/postproduction";
import { PostProductionDomainError } from "@/domain/postproduction";
import type { AiccosExportRequest } from "@/infrastructure/export/aiccos";

export type MapExportPackageToAiccosOptions = {
  /** Required explicit title — never invented from package internals. */
  title: string;
  /** Only when available from an explicit source — never invented. */
  productSlug?: string | null;
  at: string;
};

export function mapExportPackageToAiccosRequest(
  exportPackage: ExportPackage,
  options: MapExportPackageToAiccosOptions
): AiccosExportRequest {
  const title = options.title?.trim() ?? "";
  if (!title) {
    throw new PostProductionDomainError("invalid_input", "Un titre est requis.");
  }

  if (!exportPackage.finalAsset?.id) {
    throw new PostProductionDomainError("missing_asset", "Asset final absent.");
  }

  assertExportAllowed({
    quality: exportPackage.qualityReport,
    humanReview: exportPackage.humanReview,
    finalAsset: exportPackage.finalAsset,
    nowIso: options.at,
  });

  const source = exportPackage.finalAsset.source;
  let videoUrl: string;
  if (source.kind === "temporary_external") {
    if (Date.parse(source.expiresAt) <= Date.parse(options.at)) {
      throw new PostProductionDomainError("expired_asset", "Asset final expiré.");
    }
    videoUrl = source.url;
  } else if (source.kind === "inline_data_url") {
    throw new PostProductionDomainError(
      "invalid_input",
      "Source inline non supportée pour AICCOS."
    );
  } else {
    throw new PostProductionDomainError(
      "invalid_input",
      "Source interne non supportée pour AICCOS."
    );
  }

  if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
    throw new PostProductionDomainError("invalid_input", "URL de vidéo invalide.");
  }

  const productSlug =
    typeof options.productSlug === "string" && options.productSlug.trim()
      ? options.productSlug.trim()
      : options.productSlug === null
        ? null
        : undefined;

  return {
    videoUrl,
    title,
    ...(productSlug !== undefined ? { productSlug } : {}),
  };
}
