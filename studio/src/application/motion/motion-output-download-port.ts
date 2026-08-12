/**
 * MT-013K-QC-CONSUMER — private provider output download port.
 * URL lives in memory only during the call — never returned for persistence.
 */

import { createHash } from "node:crypto";
import { MotionTransferDomainError } from "@/domain/motion";
import { MOTION_QC_ALLOWED_OUTPUT_MIME } from "@/domain/motion/qc/technical";
import {
  buildSyntheticFakeMp4Bytes,
  sha256Hex,
} from "@/application/postproduction/asset-content-port";
import { MOTION_ASSET_MAX_BYTES } from "./motion-asset-path";

export const MOTION_OUTPUT_DOWNLOAD_PORT_VERSION = "mt013k-download-1.0.0" as const;

export type MotionOutputDownloadRequest = {
  providerJobId: string;
  /** Opaque durable ref — never a URL. */
  providerOutputRef: string;
  /** Expected MIME from durable descriptor. */
  expectedMimeType: string;
  /** Optional expected size ceiling from descriptor. */
  expectedMaxBytes?: number;
};

export type MotionOutputDownloadResult = {
  bytes: Uint8Array;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
};

export type MotionOutputDownloadContext = {
  correlationId: string;
  workspaceId: string;
  projectId: string;
  runId: string;
  jobId: string;
  attemptId: string;
  nowIso: string;
  signal?: AbortSignal;
};

export type MotionOutputDownloadPort = {
  readonly kind: "fake" | "real";
  readonly downloadCount: number;
  download(
    request: MotionOutputDownloadRequest,
    context: MotionOutputDownloadContext,
  ): Promise<MotionOutputDownloadResult>;
};

export type FakeMotionOutputDownloadOptions = {
  /** Bytes keyed by providerJobId — default synthetic mp4. */
  bytesByProviderJobId?: ReadonlyMap<string, Uint8Array>;
  mimeType?: string;
  fail?: {
    code: "provider_timeout" | "provider_output_invalid" | "provider_failed";
    message?: string;
    afterCalls?: number;
  };
  /** Simulate oversized payload. */
  oversizeBytes?: number;
};

function assertAllowedMime(mimeType: string): void {
  if (!(MOTION_QC_ALLOWED_OUTPUT_MIME as readonly string[]).includes(mimeType)) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "MIME vidéo non autorisé pour download Motion.",
      { diagnostic: `mime=${mimeType}` },
    );
  }
}

/**
 * TEST_ONLY fake download — zero network. Forbidden as Production authority.
 */
export function createFakeMotionOutputDownloadPort(
  options: FakeMotionOutputDownloadOptions = {},
): MotionOutputDownloadPort & {
  readonly downloads: string[];
} {
  let downloadCount = 0;
  const downloads: string[] = [];
  const mimeType = options.mimeType ?? "video/mp4";

  return {
    kind: "fake",
    get downloadCount() {
      return downloadCount;
    },
    get downloads() {
      return downloads;
    },
    async download(request, _context) {
      downloadCount += 1;
      downloads.push(request.providerJobId);

      if (
        options.fail &&
        downloadCount >= (options.fail.afterCalls ?? 1)
      ) {
        throw new MotionTransferDomainError(
          options.fail.code,
          options.fail.message ?? "Download Motion fake failure.",
        );
      }

      if (!request.providerJobId?.trim() || !request.providerOutputRef?.trim()) {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "Descriptor download incomplet.",
        );
      }
      if (/^https?:\/\//i.test(request.providerOutputRef)) {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "URL provider interdite dans le descriptor durable.",
        );
      }

      assertAllowedMime(request.expectedMimeType);
      assertAllowedMime(mimeType);

      let bytes =
        options.bytesByProviderJobId?.get(request.providerJobId) ??
        buildSyntheticFakeMp4Bytes(request.providerJobId);

      if (options.oversizeBytes != null && options.oversizeBytes > 0) {
        bytes = new Uint8Array(options.oversizeBytes);
      }

      const maxBytes = Math.min(
        request.expectedMaxBytes ?? MOTION_ASSET_MAX_BYTES,
        MOTION_ASSET_MAX_BYTES,
      );
      if (bytes.byteLength > maxBytes) {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "Fichier Motion trop volumineux.",
          { diagnostic: `size=${bytes.byteLength}` },
        );
      }
      if (bytes.byteLength === 0) {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "Fichier Motion vide.",
        );
      }

      const checksumSha256 = sha256Hex(bytes);
      // Ephemeral URL must never escape this function — not returned.
      void createHash("sha256")
        .update(`memory-only:${request.providerJobId}`)
        .digest("hex");

      return {
        bytes,
        mimeType,
        sizeBytes: bytes.byteLength,
        checksumSha256,
      };
    },
  };
}
