/**
 * Export destination stubs (VHS-111).
 * download = local package validation only.
 * aiccos = not configured — no fetch/import/PUT duplication (see VHS-111C).
 */

import type { ExportPackage } from "@/domain/postproduction";
import type {
  ExportContext,
  ExportDestinationAdapter,
  ExportResult,
  ExportValidationResult,
} from "./ports";

export function createDownloadExportAdapter(): ExportDestinationAdapter {
  return {
    destinationId: "download",

    async validate(pkg): Promise<ExportValidationResult> {
      const issues: ExportValidationResult["issues"] = [];
      if (!pkg.finalAsset?.id) {
        issues.push({ code: "missing_asset", message: "Asset final absent." });
      }
      if (!pkg.manifest?.finalAssetId) {
        issues.push({ code: "invalid_manifest", message: "Manifeste incomplet." });
      }
      return { valid: issues.length === 0, issues };
    },

    async send(pkg: ExportPackage, context: ExportContext): Promise<ExportResult> {
      const v = await this.validate(pkg, context);
      if (!v.valid) {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "export_not_ready",
            publicMessage: v.issues[0]?.message ?? "Export download invalide.",
          },
        };
      }
      // Local "download" = package already in hand; no network.
      return {
        status: "completed",
        destinationId: "download",
        remoteRef: pkg.id,
        completedAt: context.requestedAt,
      };
    },
  };
}

export function createUnavailableAiccosExportAdapter(): ExportDestinationAdapter {
  return {
    destinationId: "aiccos",

    async validate(): Promise<ExportValidationResult> {
      return {
        valid: false,
        issues: [
          {
            code: "destination_not_configured",
            message:
              "Adapter AICCOS non configuré. Utiliser createAiccosExportAdapter({ pipeline }).",
          },
        ],
      };
    },

    async send(_exportPackage, context): Promise<ExportResult> {
      return {
        status: "failed",
        failedAt: context.requestedAt,
        error: {
          code: "destination_not_configured",
          publicMessage:
            "Publication AICCOS indisponible — stub non activé. Utiliser createAiccosExportAdapter.",
        },
      };
    },
  };
}
