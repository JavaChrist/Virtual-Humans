/**
 * Serve the final media bytes for an active ExportPackage (VHS-125 download fix).
 * Manifest JSON is separate — this never returns the package as the media body.
 */

import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import type { ExportPackage, FinalQualityReport, HumanReviewDecision } from "@/domain/postproduction";
import { assertExportAllowed } from "@/domain/postproduction";
import type { ProductionResult } from "@/domain/production";
import {
  DOWNLOAD_ALLOWED_MIME,
  DOWNLOAD_MAX_BYTES,
  isAssetContentConfigured,
  type AssetContentBackend,
  type AssetContentGetResult,
} from "@/application/postproduction/asset-content-port";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import type { MergeOutcomeRecord } from "./delivery-for-project";
import { buildSafeDownloadFilename } from "./safe-download-filename";

export type DownloadFinalAssetDeps = {
  workspaceId: string;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  assetContent: AssetContentBackend;
  env?: Record<string, string | undefined>;
  nowIso?: () => string;
};

export type DownloadFinalAssetSuccess = {
  status: "ok";
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  sizeBytes: number;
  checksumSha256: string;
  assetId: string;
  exportPackageId: string;
  headers: {
    "Content-Type": string;
    "Content-Disposition": string;
    "Content-Length": string;
    "Cache-Control": "private, no-store";
    "X-Content-Type-Options": "nosniff";
  };
};

export type DownloadFinalAssetFailure = {
  status: "failed";
  code: string;
  publicMessage: string;
  httpHint: 400 | 404 | 409 | 422 | 503;
};

export type DownloadFinalAssetResult = DownloadFinalAssetSuccess | DownloadFinalAssetFailure;

export type DownloadFinalAssetForProject = {
  execute(input: { projectId: string }): Promise<DownloadFinalAssetResult>;
};

function fail(
  code: string,
  publicMessage: string,
  httpHint: DownloadFinalAssetFailure["httpHint"],
): DownloadFinalAssetFailure {
  return { status: "failed", code, publicMessage, httpHint };
}

async function loadActive<T>(
  artifacts: ArtifactRepository,
  projectId: string,
  type: "export_package" | "merge_plan" | "quality_report" | "production_result",
): Promise<{ artifactId: string; revision: number; value: T } | null> {
  const pointer = await artifacts.getActive(projectId, type);
  if (!pointer) return null;
  const item = await artifacts.load(pointer.artifactId);
  if (!item) return null;
  return { artifactId: pointer.artifactId, revision: pointer.revision, value: item.value as T };
}

export function createDownloadFinalAssetForProject(
  deps: DownloadFinalAssetDeps,
): DownloadFinalAssetForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  return {
    async execute(input) {
      if (!canUseDirectorV2Persistence(env)) {
        return fail("persistence_disabled", "Persistance Director désactivée.", 503);
      }
      if (!isAssetContentConfigured(deps.assetContent)) {
        return fail(
          "asset_content_unavailable",
          "Backend de contenu d'asset non configuré — téléchargement média impossible.",
          503,
        );
      }

      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return fail("not_found", "Projet introuvable.", 404);
      }

      const exportActive = await loadActive<ExportPackage>(
        deps.artifacts,
        input.projectId,
        "export_package",
      );
      if (!exportActive) {
        return fail("export_package_missing", "Aucun paquet d'export actif.", 404);
      }
      const pkg = exportActive.value;
      if (pkg.projectId !== input.projectId) {
        return fail("export_stale", "Paquet d'export incohérent avec le projet.", 409);
      }

      const mergeActive = await loadActive<MergeOutcomeRecord>(
        deps.artifacts,
        input.projectId,
        "merge_plan",
      );
      if (!mergeActive || mergeActive.value.status !== "completed" || !mergeActive.value.finalAsset) {
        return fail("merge_not_completed", "Le merge n'est pas terminé.", 422);
      }

      const prActive = await loadActive<ProductionResult>(
        deps.artifacts,
        input.projectId,
        "production_result",
      );
      if (!prActive) {
        return fail("production_result_missing", "ProductionResult introuvable.", 422);
      }
      const delivery = prActive.value.delivery;
      if (!delivery || (delivery.status !== "export_ready" && delivery.status !== "delivered")) {
        return fail(
          "delivery_not_ready",
          "Livraison non prête pour le téléchargement.",
          422,
        );
      }
      if (delivery.exportPackageId && delivery.exportPackageId !== pkg.id) {
        return fail("export_stale", "ExportPackage obsolète par rapport à la livraison active.", 409);
      }
      if (delivery.finalAssetId && delivery.finalAssetId !== pkg.finalAsset.id) {
        return fail("asset_mismatch", "Asset final incohérent avec la livraison.", 409);
      }

      const qualityActive = await loadActive<FinalQualityReport>(
        deps.artifacts,
        input.projectId,
        "quality_report",
      );
      if (!qualityActive) {
        return fail("quality_report_missing", "Rapport qualité introuvable.", 422);
      }

      // Human review is embedded in ExportPackage when required; re-check with assertExportAllowed.
      const humanReview: HumanReviewDecision | undefined = pkg.humanReview;
      if (qualityActive.value.status === "needs_review" && !humanReview) {
        return fail("needs_review", "Revue humaine requise avant téléchargement.", 422);
      }
      if (humanReview && humanReview.status !== "approved" && qualityActive.value.status === "needs_review") {
        return fail("needs_review", "Revue humaine non approuvée.", 422);
      }

      try {
        assertExportAllowed({
          quality: qualityActive.value,
          humanReview,
          finalAsset: pkg.finalAsset,
          nowIso: nowIso(),
        });
      } catch (e) {
        const code =
          e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "export_not_ready";
        return fail(code, e instanceof Error ? e.message : "Export non prêt.", 422);
      }

      const finalAsset = pkg.finalAsset;
      if (mergeActive.value.finalAsset.id !== finalAsset.id) {
        return fail("asset_mismatch", "Asset final différent du résultat de merge.", 409);
      }
      if (!DOWNLOAD_ALLOWED_MIME.has(finalAsset.mimeType)) {
        return fail("invalid_mime", "Type MIME non autorisé pour le téléchargement.", 422);
      }
      if (finalAsset.source.kind !== "internal") {
        return fail(
          "unsupported_source",
          "Seuls les assets internes sont téléchargeables via cette route.",
          422,
        );
      }
      if (
        finalAsset.source.storagePath.includes("..") ||
        finalAsset.source.storagePath.includes("\\") ||
        finalAsset.source.storagePath.startsWith("/")
      ) {
        return fail("invalid_storage_path", "Référence de stockage invalide.", 422);
      }

      const content: AssetContentGetResult | null = await deps.assetContent.get({
        assetId: finalAsset.id,
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        storagePath: finalAsset.source.storagePath,
      });
      if (!content) {
        return fail("content_missing", "Contenu de l'asset final introuvable.", 404);
      }
      if (content.workspaceId !== deps.workspaceId || content.projectId !== input.projectId) {
        return fail("workspace_mismatch", "Asset hors du workspace du projet.", 404);
      }
      if (content.mimeType !== finalAsset.mimeType) {
        return fail("invalid_mime", "MIME du contenu incohérent avec l'asset.", 422);
      }
      if (content.sizeBytes === 0 || content.bytes.byteLength === 0) {
        return fail("empty_content", "Contenu vide.", 422);
      }
      if (content.bytes.byteLength > DOWNLOAD_MAX_BYTES) {
        return fail("size_limit", "Taille supérieure à la limite autorisée.", 422);
      }
      if (
        finalAsset.sizeBytes != null &&
        finalAsset.sizeBytes !== content.bytes.byteLength
      ) {
        return fail("size_mismatch", "Taille déclarée incohérente avec le contenu.", 422);
      }
      if (finalAsset.checksum && finalAsset.checksum !== content.checksumSha256) {
        return fail("checksum_mismatch", "Checksum incohérente.", 422);
      }

      const filename = buildSafeDownloadFilename({
        projectId: input.projectId,
        assetId: finalAsset.id,
        mimeType: finalAsset.mimeType,
      });
      const sizeBytes = content.bytes.byteLength;

      return {
        status: "ok",
        bytes: content.bytes,
        mimeType: finalAsset.mimeType,
        filename,
        sizeBytes,
        checksumSha256: content.checksumSha256,
        assetId: finalAsset.id,
        exportPackageId: pkg.id,
        headers: {
          "Content-Type": finalAsset.mimeType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(sizeBytes),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      };
    },
  };
}
