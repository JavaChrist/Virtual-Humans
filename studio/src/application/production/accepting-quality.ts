/**
 * Permissive quality validator for fake-provider orchestration (VHS-124).
 * Accepts any asset with a usable source — not for real media QA.
 */
import type { QualityValidatorPort } from "./ports";

export function createAcceptingQualityPort(): QualityValidatorPort {
  return {
    async validate(request) {
      const hasSource =
        request.asset.source.kind === "temporary_external"
          ? Boolean(request.asset.source.url)
          : request.asset.source.kind === "inline_data_url"
            ? Boolean(request.asset.source.dataUrl)
            : Boolean(request.asset.source.storagePath);
      if (!hasSource || !request.asset.mimeType.includes("/")) {
        return {
          status: "rejected",
          checks: [{ code: "basic", passed: false }],
          reasons: [{ code: "invalid", message: "Asset invalide." }],
          retryableWithFallback: false,
        };
      }
      return {
        status: "accepted",
        checks: [{ code: "basic", passed: true }],
        warnings: [],
      };
    },
  };
}
