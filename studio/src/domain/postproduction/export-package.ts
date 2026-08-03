/**
 * Export package + redacted manifest (VHS-111).
 */

import type { Money } from "@/domain/cost";
import type { GeneratedAsset } from "@/domain/generation";
import { redactAsset } from "@/domain/production";
import type { HumanReviewDecision } from "./human-review";
import type { FinalQualityReport } from "./quality-report";
import { PostProductionDomainError } from "./errors";

export const EXPORT_MANIFEST_SCHEMA_VERSION = "1.0.0" as const;

export type ExportSceneAsset = {
  sceneId: string;
  sceneOrder: number;
  assetId: string;
  mimeType: string;
  durationSeconds?: number;
};

export type ExportProviderUse = {
  providerId: string;
  modelId: string;
  stepId: string;
  attemptNumber: number;
  kind: "primary" | "fallback";
};

export type ExportCostSummary = {
  estimatedAmountMinor: number;
  committedAmountMinor: number;
  releasedAmountMinor: number;
  currency: string;
};

export type ExportQualitySummary = {
  status: FinalQualityReport["status"];
  validatorVersion: string;
  blockingCount: number;
  warningCount: number;
  humanReviewStatus?: "approved" | "rejected";
};

export type ExportManifest = {
  schemaVersion: string;
  projectId: string;
  productionRunId: string;
  generationPlanRevisionId: string;
  storyboardRevisionId: string;
  finalAssetId: string;
  sceneAssets: ExportSceneAsset[];
  providers: ExportProviderUse[];
  costs: ExportCostSummary;
  quality: ExportQualitySummary;
  generatedAt: string;
};

export type ExportPackage = {
  id: string;
  projectId: string;
  productionResultRevisionId: string;
  finalAsset: GeneratedAsset;
  qualityReport: FinalQualityReport;
  humanReview?: HumanReviewDecision;
  manifest: ExportManifest;
  createdAt: string;
};

export function freezeExportPackage(pkg: ExportPackage): ExportPackage {
  const redacted: ExportPackage = {
    ...pkg,
    finalAsset: redactAsset(pkg.finalAsset),
  };
  return Object.freeze(JSON.parse(JSON.stringify(redacted)) as ExportPackage);
}

export function assertExportAllowed(input: {
  quality: FinalQualityReport;
  humanReview?: HumanReviewDecision;
  finalAsset: GeneratedAsset;
  nowIso: string;
}): void {
  if (input.quality.blockingIssues.some((i) => i.blocking && i.layer === "technical")) {
    throw new PostProductionDomainError(
      "export_not_ready",
      "Erreur technique bloquante — export interdit."
    );
  }
  if (input.quality.status === "rejected") {
    throw new PostProductionDomainError("quality_rejected", "Qualité refusée.");
  }
  if (input.quality.status === "needs_review") {
    if (!input.humanReview || input.humanReview.status !== "approved") {
      throw new PostProductionDomainError(
        "needs_review",
        "Revue humaine requise avant export."
      );
    }
  }
  const src = input.finalAsset.source;
  if (src.kind === "temporary_external" && Date.parse(src.expiresAt) <= Date.parse(input.nowIso)) {
    throw new PostProductionDomainError("expired_asset", "Asset final expiré.");
  }
}

export function buildExportManifest(input: {
  projectId: string;
  productionRunId: string;
  generationPlanRevisionId: string;
  storyboardRevisionId: string;
  finalAssetId: string;
  sceneAssets: ExportSceneAsset[];
  providers: ExportProviderUse[];
  costs: { estimated: Money; committed: Money; released: Money };
  quality: FinalQualityReport;
  humanReview?: HumanReviewDecision;
  generatedAt: string;
}): ExportManifest {
  return Object.freeze({
    schemaVersion: EXPORT_MANIFEST_SCHEMA_VERSION,
    projectId: input.projectId,
    productionRunId: input.productionRunId,
    generationPlanRevisionId: input.generationPlanRevisionId,
    storyboardRevisionId: input.storyboardRevisionId,
    finalAssetId: input.finalAssetId,
    sceneAssets: input.sceneAssets,
    providers: input.providers,
    costs: {
      estimatedAmountMinor: input.costs.estimated.amountMinor,
      committedAmountMinor: input.costs.committed.amountMinor,
      releasedAmountMinor: input.costs.released.amountMinor,
      currency: input.costs.estimated.currency,
    },
    quality: {
      status: input.quality.status,
      validatorVersion: input.quality.validatorVersion,
      blockingCount: input.quality.blockingIssues.filter((i) => i.blocking).length,
      warningCount: input.quality.warnings.length,
      humanReviewStatus: input.humanReview?.status,
    },
    generatedAt: input.generatedAt,
  });
}
