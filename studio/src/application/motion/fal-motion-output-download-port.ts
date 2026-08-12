/**
 * MT-013K-OUTPUT-TRANSPORT — Production fal output download port.
 *
 * providerJobId durable → getResult (no submit) → URL memory-only →
 * safe HTTPS download → checksum. Never persists/logs fal URLs.
 */

import { MotionTransferDomainError } from "@/domain/motion";
import { FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT } from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-mapping";
import type { FalMotionControlTransport } from "@/infrastructure/providers/motion-transfer/fal-motion-control-transport";
import { assertValidatedFalTerminalVideo } from "@/infrastructure/providers/motion-transfer/fal-terminal-result";
import {
  safeFetchFalMedia,
  type SafeFetchLike,
} from "@/infrastructure/providers/motion-transfer/safe-fal-media-fetch";
import { sha256Hex } from "@/application/postproduction/asset-content-port";
import { MOTION_ASSET_MAX_BYTES } from "./motion-asset-path";
import type {
  MotionOutputDownloadPort,
  MotionOutputDownloadRequest,
  MotionOutputDownloadContext,
} from "./motion-output-download-port";

export const FAL_MOTION_OUTPUT_DOWNLOAD_PORT_VERSION =
  "mt013k-fal-download-1.0.0" as const;

const OPAQUE_REF_PREFIX = "fal-out:";

export type CreateFalMotionOutputDownloadPortOptions = {
  transport: FalMotionControlTransport;
  endpointId?: string;
  fetchImpl?: SafeFetchLike;
  skipDnsLookup?: boolean;
  maxBytes?: number;
  timeoutMs?: number;
};

function parseOpaqueProviderJobId(providerOutputRef: string): string | null {
  const ref = providerOutputRef.trim();
  if (!ref.startsWith(OPAQUE_REF_PREFIX)) return null;
  const id = ref.slice(OPAQUE_REF_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

function redactErrorMessage(msg: string): string {
  return msg
    .replace(/https?:\/\/\S+/gi, "[REDACTED_URL]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/sk-[a-zA-Z0-9]+/g, "[REDACTED_KEY]")
    .replace(/fal-[A-Za-z0-9_-]{8,}/gi, "[REDACTED_KEY]");
}

/**
 * Real Production download port (still gated by resolver before construction
 * or by outer gate wrapper). Fake transport forbidden under Vercel.
 */
export function createFalMotionOutputDownloadPort(
  options: CreateFalMotionOutputDownloadPortOptions,
): MotionOutputDownloadPort & {
  readonly mediaDownloadCount: number;
  readonly resultFetchCount: number;
  readonly lastOriginLabel?: string;
  readonly lastTempCleaned?: boolean;
} {
  let downloadCount = 0;
  let mediaDownloadCount = 0;
  let resultFetchCount = 0;
  let lastOriginLabel: string | undefined;
  let lastTempCleaned: boolean | undefined;
  const endpointId =
    options.endpointId ?? FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT;

  return {
    kind: "real",
    get downloadCount() {
      return downloadCount;
    },
    get mediaDownloadCount() {
      return mediaDownloadCount;
    },
    get resultFetchCount() {
      return resultFetchCount;
    },
    get lastOriginLabel() {
      return lastOriginLabel;
    },
    get lastTempCleaned() {
      return lastTempCleaned;
    },

    async download(
      request: MotionOutputDownloadRequest,
      context: MotionOutputDownloadContext,
    ) {
      downloadCount += 1;

      if (!request.providerJobId?.trim()) {
        throw new MotionTransferDomainError(
          "provider_job_not_found",
          "providerJobId requis — pas de resubmit.",
        );
      }
      if (/^https?:\/\//i.test(request.providerOutputRef)) {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "URL provider interdite dans le descriptor durable.",
        );
      }
      const opaqueJobId = parseOpaqueProviderJobId(request.providerOutputRef);
      if (!opaqueJobId || opaqueJobId !== request.providerJobId.trim()) {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "Descriptor opaque fal-out incohérent avec providerJobId.",
        );
      }
      if (request.expectedMimeType !== "video/mp4") {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "MIME attendu video/mp4 uniquement.",
        );
      }

      const submitBefore = options.transport.submitCount;
      let terminal;
      try {
        terminal = await options.transport.getResult({
          endpointId,
          requestId: request.providerJobId.trim(),
        });
      } catch (err) {
        throw new MotionTransferDomainError(
          "provider_failed",
          redactErrorMessage(
            err instanceof Error ? err.message : "Échec getResult fal.",
          ),
        );
      }
      resultFetchCount = options.transport.resultFetchCount;
      if (options.transport.submitCount !== submitBefore) {
        throw new MotionTransferDomainError(
          "provider_failed",
          "getResult a créé un submit — interdit.",
        );
      }

      let validated;
      try {
        validated = assertValidatedFalTerminalVideo(terminal, {
          expectedMimeType: request.expectedMimeType,
          expectedDurationSeconds: context.expectedDurationSeconds,
        });
      } catch (err) {
        if (err instanceof MotionTransferDomainError) {
          throw new MotionTransferDomainError(
            err.code,
            redactErrorMessage(err.publicMessage),
          );
        }
        throw err;
      }

      // URL memory-only — never assigned to durable fields / logs.
      const ephemeralUrl = validated.videoUrl;
      mediaDownloadCount += 1;
      let fetched;
      try {
        fetched = await safeFetchFalMedia(ephemeralUrl, {
          fetchImpl: options.fetchImpl,
          skipDnsLookup: options.skipDnsLookup === true,
          maxBytes: Math.min(
            request.expectedMaxBytes ?? MOTION_ASSET_MAX_BYTES,
            options.maxBytes ?? MOTION_ASSET_MAX_BYTES,
            MOTION_ASSET_MAX_BYTES,
          ),
          timeoutMs: options.timeoutMs,
          signal: context.signal,
        });
      } catch (err) {
        if (err instanceof MotionTransferDomainError) {
          throw new MotionTransferDomainError(
            err.code,
            redactErrorMessage(err.publicMessage),
          );
        }
        throw new MotionTransferDomainError(
          "provider_failed",
          "Échec download média fal.",
        );
      } finally {
        // Drop reference aggressively (GC); never return URL.
        void ephemeralUrl;
      }

      lastOriginLabel = fetched.originLabel;
      lastTempCleaned = fetched.tempCleaned;
      const checksumSha256 = sha256Hex(fetched.bytes);

      return {
        bytes: fetched.bytes,
        mimeType: "video/mp4" as const,
        sizeBytes: fetched.sizeBytes,
        checksumSha256,
      };
    },
  };
}
