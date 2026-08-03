/**
 * Normalized generation outputs (VHS-109).
 */

import type { Money } from "@/domain/cost";
import { GenerationDomainError } from "./errors";

export type ExternalJobRef = {
  providerId: string;
  modelId: string;
  externalJobId: string;
};

export type GeneratedAssetSource =
  | {
      kind: "temporary_external";
      url: string;
      expiresAt: string;
    }
  | {
      kind: "inline_data_url";
      dataUrl: string;
    }
  | {
      kind: "internal";
      storagePath: string;
    };

export type GeneratedAsset = {
  id: string;
  kind: "image" | "video" | "audio" | "lipsync" | "carousel";
  mimeType: string;
  source: GeneratedAssetSource;
  checksum?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  sizeBytes?: number;
};

export type ProviderUsage = {
  unit?: string;
  quantity?: number;
  rawLabel?: string;
  /** Optional settled cost hint in minor units (fake / deterministic adapters). */
  amountMinor?: number;
  currency?: string;
};

export function assertExternalJobRef(
  job: ExternalJobRef,
  expected: { providerId: string; modelId: string },
): void {
  if (!job.externalJobId || job.externalJobId.length > 256) {
    throw new GenerationDomainError("invalid_input", "Invalid external job id.");
  }
  if (job.providerId !== expected.providerId || job.modelId !== expected.modelId) {
    throw new GenerationDomainError(
      "invalid_input",
      "External job provider/model mismatch.",
    );
  }
}

export type { Money };
