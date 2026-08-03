/**
 * Signed storage PUT uploader (VHS-111C).
 * Exactly one attempt — no automatic retry.
 */

import type {
  AiccosExecutionContext,
  AiccosStorageUploader,
  AiccosUploadRequest,
  AiccosUploadResult,
} from "./contracts";
import { AiccosPipelineError } from "./errors";
import type { FetchLike } from "./source-download";

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

/** Historical PUT headers: Content-Type + x-upsert. */
export function buildHistoricalUploadHeaders(mimeType: string): Record<string, string> {
  return { "Content-Type": mimeType, "x-upsert": "true" };
}

export function createFetchAiccosStorageUploader(deps: {
  fetchImpl: FetchLike;
}): AiccosStorageUploader {
  return {
    async upload(
      request: AiccosUploadRequest,
      context: AiccosExecutionContext
    ): Promise<AiccosUploadResult> {
      if (!request.uploadUrl || !/^https?:\/\//i.test(request.uploadUrl)) {
        throw new AiccosPipelineError("invalid_import_session", "URL d'upload invalide.", {
          httpStatusHint: 502,
        });
      }

      const headers = {
        ...buildHistoricalUploadHeaders(request.mimeType),
        ...request.requiredHeaders,
      };
      // Never allow Authorization override from session echo
      delete headers["Authorization"];
      delete headers["authorization"];

      const { signal, cleanup } = mergeAbortSignals(context.timeoutMs, context.signal);
      try {
        const uploadRes = await deps.fetchImpl(request.uploadUrl, {
          method: "PUT",
          headers,
          body: request.bytes as unknown as BodyInit,
          signal,
        });
        if (!uploadRes.ok) {
          const detail = await uploadRes.text().catch(() => "");
          return {
            ok: false,
            status: uploadRes.status,
            detailSnippet: detail.slice(0, 200),
          };
        }
        return { ok: true };
      } catch (e) {
        if (e instanceof AiccosPipelineError) throw e;
        if (signal.aborted) {
          throw new AiccosPipelineError("timeout", "Délai d'attente AICCOS dépassé.", {
            httpStatusHint: 502,
            retryable: true,
          });
        }
        throw new AiccosPipelineError("upload_failed", "L'upload du clip a échoué.", {
          httpStatusHint: 502,
        });
      } finally {
        cleanup();
      }
    },
  };
}
