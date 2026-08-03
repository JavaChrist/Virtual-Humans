/**
 * Source video downloader (VHS-111C).
 */

import {
  AICCOS_MAX_BYTES,
  type AiccosExecutionContext,
  type DownloadedExportAsset,
  type ExportAssetSource,
  type ExportSourceDownloader,
} from "./contracts";
import { AiccosPipelineError } from "./errors";
import {
  assertSizeWithinLimit,
  resolveHistoricalMime,
  safeOriginLabel,
} from "./validation";

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: BodyInit; signal?: AbortSignal }
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

function mergeAbortSignals(
  timeoutMs: number,
  outer?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onOuter = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", onOuter, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onOuter);
    },
  };
}

export function createFetchSourceDownloader(deps: {
  fetchImpl: FetchLike;
}): ExportSourceDownloader {
  return {
    async download(
      source: ExportAssetSource,
      context: AiccosExecutionContext
    ): Promise<DownloadedExportAsset> {
      const url = source.url?.trim() ?? "";
      if (!url || !/^https?:\/\//i.test(url)) {
        throw new AiccosPipelineError("invalid_source_url", "URL de vidéo invalide.", {
          httpStatusHint: 400,
        });
      }

      const { signal, cleanup } = mergeAbortSignals(context.timeoutMs, context.signal);
      try {
        const download = await deps.fetchImpl(url, { method: "GET", signal });
        if (!download.ok) {
          throw new AiccosPipelineError(
            "source_download_failed",
            `Téléchargement de la vidéo impossible (${download.status}).`,
            {
              httpStatusHint: 502,
              historical: { downloadStatus: download.status },
              retryable: download.status >= 500,
            }
          );
        }

        const contentLength = download.headers.get("content-length");
        if (contentLength) {
          const declared = Number(contentLength);
          if (Number.isFinite(declared) && declared > AICCOS_MAX_BYTES) {
            assertSizeWithinLimit(declared);
          }
        }

        const buffer = await download.arrayBuffer();
        const sizeBytes = buffer.byteLength;
        assertSizeWithinLimit(sizeBytes);

        const mimeType = resolveHistoricalMime(download.headers.get("content-type"));

        return {
          bytes: new Uint8Array(buffer),
          mimeType,
          sizeBytes,
          sourceMetadata: { origin: safeOriginLabel(url) },
        };
      } catch (e) {
        if (e instanceof AiccosPipelineError) throw e;
        if (signal.aborted) {
          throw new AiccosPipelineError("timeout", "Délai d'attente AICCOS dépassé.", {
            httpStatusHint: 502,
            retryable: true,
          });
        }
        throw new AiccosPipelineError(
          "source_download_failed",
          "Téléchargement de la vidéo impossible.",
          { httpStatusHint: 502, retryable: true }
        );
      } finally {
        cleanup();
      }
    },
  };
}
