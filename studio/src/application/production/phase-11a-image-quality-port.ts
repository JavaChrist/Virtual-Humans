/**
 * Phase 11A QualityValidatorPort — technical checks + needs_review (Human Review).
 * Does not invent visual scores.
 */

import type { QualityValidatorPort } from "./ports";
import {
  buildPhase11AImageTechnicalMeta,
  decodeOpenAIImageToMemoryBytes,
  validatePhase11AImageTechnical,
} from "./phase-11a-image-technical-qc";

export function createPhase11AImageTechnicalQualityPort(): QualityValidatorPort {
  return {
    async validate(request, _context) {
      void _context;
      if (request.asset.kind !== "image" && request.step.expectedOutput.mediaType !== "image") {
        return {
          status: "rejected",
          checks: [{ code: "kind", passed: false }],
          reasons: [{ code: "kind", message: "Phase 11A QC expects image." }],
          retryableWithFallback: false,
        };
      }

      let bytes: Uint8Array | null = null;
      const source = request.asset.source;
      if (source.kind === "inline_data_url") {
        try {
          bytes = decodeOpenAIImageToMemoryBytes(source.dataUrl).bytes;
        } catch {
          return {
            status: "rejected",
            checks: [{ code: "decodable", passed: false }],
            reasons: [{ code: "corrupt", message: "Inline image not decodable." }],
            retryableWithFallback: false,
          };
        }
      }

      if (!bytes) {
        // Storage-backed asset: dimensions unavailable without download — humanOnly.
        const meta = {
          mimeType: request.asset.mimeType,
          byteLength: request.asset.sizeBytes ?? 1,
          checksumSha256:
            request.asset.checksum ??
            "0000000000000000000000000000000000000000000000000000000000000001",
          dimensionsMeasured: false,
          provenanceComplete: Boolean(
            request.asset.checksum || source.kind === "internal",
          ),
        };
        return validatePhase11AImageTechnical({ asset: request.asset, meta });
      }

      const meta = buildPhase11AImageTechnicalMeta(bytes, {
        provenanceComplete: true,
      });
      return validatePhase11AImageTechnical({ asset: request.asset, meta });
    },
  };
}
