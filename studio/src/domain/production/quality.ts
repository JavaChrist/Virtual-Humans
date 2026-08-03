/**
 * Structured quality checks — no visual/identity scoring.
 */

import type { GeneratedAsset } from "@/domain/generation";
import type { GenerationStep } from "@/domain/routing/router/generation-plan";

export type QualityCheck = {
  code: string;
  passed: boolean;
  detail?: string;
};

export type QualityWarning = {
  code: string;
  message: string;
};

export type QualityRejection = {
  code: string;
  message: string;
};

export type QualityReviewReason = {
  code: string;
  message: string;
};

export type QualityValidationResult =
  | {
      status: "accepted";
      checks: QualityCheck[];
      warnings: QualityWarning[];
    }
  | {
      status: "rejected";
      checks: QualityCheck[];
      reasons: QualityRejection[];
      retryableWithFallback: boolean;
    }
  | {
      status: "needs_review";
      checks: QualityCheck[];
      reasons: QualityReviewReason[];
    };

export type QualityValidationRequest = {
  step: GenerationStep;
  asset: GeneratedAsset;
  nowIso: string;
};

function expectedAssetKind(
  step: GenerationStep
): "image" | "video" | "audio" | "lipsync" | "carousel" | "unknown" {
  const media = step.expectedOutput.mediaType;
  if (media === "image") return "image";
  if (media === "video") return "video";
  if (media === "audio") return "audio";
  if (step.action === "lipsync") return "lipsync";
  if (step.action === "carousel") return "carousel";
  if (step.action === "image" || step.action === "scene_image" || step.action === "duo_frame") {
    return "image";
  }
  if (step.action === "video") return "video";
  if (step.action === "voice") return "audio";
  return "unknown";
}

function hasUsableSource(asset: GeneratedAsset): boolean {
  const s = asset.source;
  if (s.kind === "temporary_external") return Boolean(s.url);
  if (s.kind === "inline_data_url") return Boolean(s.dataUrl);
  if (s.kind === "internal") return Boolean(s.storagePath);
  return false;
}

function sourceExpiresAt(asset: GeneratedAsset): string | undefined {
  return asset.source.kind === "temporary_external" ? asset.source.expiresAt : undefined;
}

/**
 * Pure structured checks usable without real media decoding.
 * Never invents visual quality scores. needs_review is never silently accepted.
 */
export function evaluateStructuredQuality(
  request: QualityValidationRequest
): QualityValidationResult {
  const { step, asset, nowIso } = request;
  const checks: QualityCheck[] = [];
  const warnings: QualityWarning[] = [];
  const reasons: QualityRejection[] = [];
  const reviewReasons: QualityReviewReason[] = [];

  const expectedKind = expectedAssetKind(step);
  const kindOk =
    expectedKind === "unknown" ||
    asset.kind === expectedKind ||
    (expectedKind === "video" && asset.kind === "lipsync");
  checks.push({
    code: "asset_kind",
    passed: kindOk,
    detail: `expected=${expectedKind} actual=${asset.kind}`,
  });
  if (!kindOk) {
    reasons.push({
      code: "asset_kind_mismatch",
      message: `Type d'asset inattendu: ${asset.kind}.`,
    });
  }

  const mimeOk = typeof asset.mimeType === "string" && asset.mimeType.includes("/");
  checks.push({ code: "mime_present", passed: mimeOk, detail: asset.mimeType });
  if (!mimeOk) {
    reasons.push({ code: "invalid_mime", message: "MIME invalide ou absent." });
  } else {
    const mimeMatch =
      (expectedKind === "image" && asset.mimeType.startsWith("image/")) ||
      (expectedKind === "video" && asset.mimeType.startsWith("video/")) ||
      (expectedKind === "audio" && asset.mimeType.startsWith("audio/")) ||
      expectedKind === "unknown" ||
      expectedKind === "lipsync" ||
      expectedKind === "carousel";
    checks.push({ code: "mime_match", passed: mimeMatch });
    if (!mimeMatch) {
      reasons.push({ code: "mime_mismatch", message: "MIME incompatible avec l'étape." });
    }
  }

  if (asset.kind === "video" || asset.kind === "audio" || asset.kind === "lipsync") {
    if (asset.durationSeconds == null) {
      checks.push({ code: "duration_present", passed: false });
      warnings.push({ code: "duration_missing", message: "Durée absente — revue recommandée." });
      reviewReasons.push({ code: "duration_missing", message: "Durée média absente." });
    } else {
      checks.push({
        code: "duration_present",
        passed: true,
        detail: String(asset.durationSeconds),
      });
      if (
        step.expectedOutput.durationSeconds != null &&
        Math.abs(asset.durationSeconds - step.expectedOutput.durationSeconds) >
          step.expectedOutput.durationSeconds * 0.5
      ) {
        reviewReasons.push({
          code: "duration_ratio",
          message: "Durée éloignée du contrat attendu.",
        });
        warnings.push({
          code: "duration_ratio",
          message: "Durée éloignée du contrat — revue recommandée.",
        });
      }
    }
  }

  if (asset.kind === "image" || asset.kind === "video" || asset.kind === "lipsync") {
    if (asset.width == null || asset.height == null) {
      checks.push({ code: "dimensions_present", passed: false });
      warnings.push({
        code: "dimensions_missing",
        message: "Dimensions absentes — revue recommandée.",
      });
      reviewReasons.push({ code: "dimensions_missing", message: "Dimensions absentes." });
    } else {
      checks.push({
        code: "dimensions_present",
        passed: true,
        detail: `${asset.width}x${asset.height}`,
      });
    }
  }

  const sourceOk = hasUsableSource(asset);
  checks.push({ code: "source_present", passed: sourceOk });
  if (!sourceOk) {
    reasons.push({ code: "source_missing", message: "Source asset absente." });
  } else {
    const expiresAt = sourceExpiresAt(asset);
    if (expiresAt) {
      const expired = Date.parse(expiresAt) <= Date.parse(nowIso);
      checks.push({ code: "source_not_expired", passed: !expired });
      if (expired) {
        reasons.push({ code: "source_expired", message: "Source expirée." });
      }
    }
  }

  checks.push({
    code: "output_contract",
    passed: expectedKind === "unknown" || kindOk,
    detail: step.expectedOutput.mediaType,
  });

  if (reasons.length > 0) {
    return {
      status: "rejected",
      checks,
      reasons,
      retryableWithFallback: reasons.every(
        (r) => r.code !== "invalid_mime" && r.code !== "source_missing"
      ),
    };
  }

  if (reviewReasons.length > 0) {
    return { status: "needs_review", checks, reasons: reviewReasons };
  }

  return { status: "accepted", checks, warnings };
}
