/**
 * AICCOS ExportDestinationAdapter — injectable, not auto-wired to Production Director (VHS-111C).
 */

import {
  assertExportAllowed,
  isPostProductionDomainError,
  type ExportPackage,
} from "@/domain/postproduction";
import type {
  AiccosExportPipeline,
  AiccosExportPipelineResult,
} from "@/infrastructure/export/aiccos";
import { mapExportPackageToAiccosRequest } from "./map-export-package";
import type {
  ExportContext,
  ExportDestinationAdapter,
  ExportResult,
  ExportValidationResult,
} from "./ports";

export type CreateAiccosExportAdapterOptions = {
  pipeline: AiccosExportPipeline;
  /** Explicit title resolver — required for send; validate may skip title. */
  resolveTitle?: (pkg: ExportPackage) => string;
  /** Optional product slug from explicit project data — never invented. */
  resolveProductSlug?: (pkg: ExportPackage) => string | null | undefined;
  timeoutMs?: number;
};

export type AiccosExportResult =
  | {
      status: "delivered";
      destinationId: "aiccos";
      externalId: string;
      publicUrl: string;
      title: string;
      deliveredAt: string;
    }
  | {
      status: "failed";
      error: { code: string; retryable: boolean; publicMessage: string };
      failedAt: string;
    };

function pipelineToExportResult(
  result: AiccosExportPipelineResult
): ExportResult {
  if (result.status === "delivered") {
    return {
      status: "completed",
      destinationId: "aiccos",
      remoteRef: result.externalId,
      completedAt: result.deliveredAt,
    };
  }
  return {
    status: "failed",
    failedAt: result.failedAt,
    error: {
      code: result.error.code,
      publicMessage: result.error.publicMessage,
    },
  };
}

export function createAiccosExportAdapter(
  options: CreateAiccosExportAdapterOptions
): ExportDestinationAdapter & {
  sendDetailed: (
    exportPackage: ExportPackage,
    context: ExportContext
  ) => Promise<AiccosExportResult>;
} {
  if (!options.pipeline) {
    throw new Error("AiccosExportPipeline requis pour createAiccosExportAdapter.");
  }

  const timeoutMs = options.timeoutMs ?? 110_000;

  async function validate(
    pkg: ExportPackage,
    context: ExportContext
  ): Promise<ExportValidationResult> {
    const issues: ExportValidationResult["issues"] = [];
    if (!pkg.finalAsset?.id) {
      issues.push({ code: "missing_asset", message: "Asset final absent." });
    }
    try {
      assertExportAllowed({
        quality: pkg.qualityReport,
        humanReview: pkg.humanReview,
        finalAsset: pkg.finalAsset,
        nowIso: context.requestedAt,
      });
    } catch (e) {
      if (isPostProductionDomainError(e)) {
        issues.push({ code: e.code, message: e.publicMessage });
      } else {
        issues.push({ code: "invalid_export_package", message: "Package export invalide." });
      }
    }
    const src = pkg.finalAsset?.source;
    if (src?.kind === "temporary_external" && !/^https?:\/\//i.test(src.url)) {
      issues.push({ code: "invalid_source_url", message: "URL de vidéo invalide." });
    }
    if (src?.kind === "temporary_external" && pkg.finalAsset.sizeBytes != null) {
      if (pkg.finalAsset.sizeBytes > 50 * 1024 * 1024) {
        issues.push({ code: "source_too_large", message: "Vidéo trop lourde pour AICCOS (max 50 Mo)." });
      }
    }
    return { valid: issues.length === 0, issues };
  }

  async function sendDetailed(
    exportPackage: ExportPackage,
    context: ExportContext
  ): Promise<AiccosExportResult> {
    const snap = JSON.stringify(exportPackage);
    const v = await validate(exportPackage, context);
    if (!v.valid) {
      return {
        status: "failed",
        failedAt: context.requestedAt,
        error: {
          code: v.issues[0]?.code ?? "invalid_export_package",
          retryable: false,
          publicMessage: v.issues[0]?.message ?? "Package export invalide.",
        },
      };
    }

    const title = options.resolveTitle?.(exportPackage)?.trim() ?? "";
    if (!title) {
      return {
        status: "failed",
        failedAt: context.requestedAt,
        error: {
          code: "invalid_export_package",
          retryable: false,
          publicMessage: "Un titre est requis.",
        },
      };
    }

    let request;
    try {
      request = mapExportPackageToAiccosRequest(exportPackage, {
        title,
        productSlug: options.resolveProductSlug?.(exportPackage),
        at: context.requestedAt,
      });
    } catch (e) {
      if (isPostProductionDomainError(e)) {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: e.code,
            retryable: false,
            publicMessage: e.publicMessage,
          },
        };
      }
      throw e;
    }

    const result = await options.pipeline.send(request, {
      correlationId: context.correlationId,
      timeoutMs,
      requestedAt: context.requestedAt,
    });

    if (JSON.stringify(exportPackage) !== snap) {
      throw new Error("ExportPackage mutated during AICCOS send");
    }

    if (result.status === "delivered") {
      return {
        status: "delivered",
        destinationId: "aiccos",
        externalId: result.externalId,
        publicUrl: result.publicUrl,
        title: result.title,
        deliveredAt: result.deliveredAt,
      };
    }

    return {
      status: "failed",
      failedAt: result.failedAt,
      error: {
        code: result.error.code,
        retryable: result.error.retryable,
        publicMessage: result.error.publicMessage,
      },
    };
  }

  return {
    destinationId: "aiccos",
    validate,
    async send(exportPackage, context): Promise<ExportResult> {
      const detailed = await sendDetailed(exportPackage, context);
      if (detailed.status === "delivered") {
        return {
          status: "completed",
          destinationId: "aiccos",
          remoteRef: detailed.externalId,
          completedAt: detailed.deliveredAt,
        };
      }
      return {
        status: "failed",
        failedAt: detailed.failedAt,
        error: {
          code: detailed.error.code,
          publicMessage: detailed.error.publicMessage,
        },
      };
    },
    sendDetailed,
  };
}

export { pipelineToExportResult };
