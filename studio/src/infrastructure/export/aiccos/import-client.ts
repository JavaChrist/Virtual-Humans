/**
 * AICCOS import API client — token stays in factory closure (VHS-111C).
 */

import type {
  AiccosCompleteImportRequest,
  AiccosCreateImportRequest,
  AiccosExecutionContext,
  AiccosImportClient,
  AiccosImportSession,
  AiccosClipResult,
} from "./contracts";
import { AiccosPipelineError, mapAiccosHttpStatus } from "./errors";
import { validateAiccosClipResult, validateImportSession } from "./result";
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

/** Filter out authorization-like headers from any server echo. */
export function filterSessionHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (/authorization|api[_-]?key|token|secret|cookie/i.test(k)) continue;
    if (/authorization|bearer\s/i.test(v)) continue;
    out[k] = v;
  }
  return out;
}

export function createFetchAiccosImportClient(deps: {
  baseUrl: string;
  /** Resolved once in factory — never returned on contracts. */
  importToken: string;
  fetchImpl: FetchLike;
}): AiccosImportClient {
  const base = deps.baseUrl.replace(/\/+$/, "");
  if (!deps.importToken) {
    throw new AiccosPipelineError(
      "aiccos_not_configured",
      "AICCOS_IMPORT_TOKEN manquant dans .env.local — impossible d'envoyer vers AICCOS.",
      { httpStatusHint: 500 }
    );
  }

  const authHeaders = (): Record<string, string> => ({
    Authorization: `Bearer ${deps.importToken}`,
    "Content-Type": "application/json",
  });

  return {
    async createImport(
      request: AiccosCreateImportRequest,
      context: AiccosExecutionContext
    ): Promise<AiccosImportSession> {
      const { signal, cleanup } = mergeAbortSignals(context.timeoutMs, context.signal);
      try {
        const prepareRes = await deps.fetchImpl(`${base}/api/clips/import`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            fileName: request.fileName,
            mimeType: request.mimeType,
            sizeBytes: request.sizeBytes,
            productSlug: request.productSlug,
          }),
          signal,
        });
        const prepare = (await prepareRes.json().catch(() => ({}))) as {
          error?: string;
          path?: string;
          signedUrl?: string;
          expiresAt?: string;
          headers?: Record<string, string>;
        };

        if (!prepareRes.ok || !prepare.path || !prepare.signedUrl) {
          const mapped = mapAiccosHttpStatus(prepareRes.status);
          throw new AiccosPipelineError(
            mapped.code === "import_creation_failed" && prepareRes.status === 401
              ? "aiccos_unauthorized"
              : mapped.code,
            prepare.error ?? `AICCOS a refusé la préparation (${prepareRes.status}).`,
            {
              retryable: mapped.retryable,
              httpStatusHint: 502,
              historical: {
                prepareStatus: prepareRes.status,
                prepareError: prepare.error,
              },
            }
          );
        }

        const session = validateImportSession(prepare);
        if (session.expiresAt && Date.parse(session.expiresAt) <= Date.parse(context.requestedAt)) {
          throw new AiccosPipelineError(
            "invalid_import_session",
            "Session d'import AICCOS expirée.",
            { httpStatusHint: 502 }
          );
        }

        return {
          importId: session.importId,
          uploadUrl: session.uploadUrl,
          requiredHeaders: filterSessionHeaders(prepare.headers),
          expiresAt: session.expiresAt,
        };
      } catch (e) {
        if (e instanceof AiccosPipelineError) throw e;
        if (signal.aborted) {
          throw new AiccosPipelineError("timeout", "Délai d'attente AICCOS dépassé.", {
            httpStatusHint: 502,
            retryable: true,
          });
        }
        throw new AiccosPipelineError("import_creation_failed", "Création d'import AICCOS échouée.", {
          httpStatusHint: 502,
        });
      } finally {
        cleanup();
      }
    },

    async completeImport(
      request: AiccosCompleteImportRequest,
      context: AiccosExecutionContext
    ): Promise<AiccosClipResult> {
      const { signal, cleanup } = mergeAbortSignals(context.timeoutMs, context.signal);
      try {
        const completeRes = await deps.fetchImpl(`${base}/api/clips/import/complete`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            filePath: request.filePath,
            mimeType: request.mimeType,
            sizeBytes: request.sizeBytes,
            title: request.title,
            productSlug: request.productSlug,
          }),
          signal,
        });
        const complete = (await completeRes.json().catch(() => ({}))) as {
          clip?: unknown;
          error?: string;
        };

        if (!completeRes.ok || !complete.clip) {
          const mapped = mapAiccosHttpStatus(completeRes.status);
          throw new AiccosPipelineError(
            mapped.code === "import_creation_failed" ? "complete_failed" : mapped.code,
            complete.error ?? `AICCOS a refusé l'enregistrement (${completeRes.status}).`,
            {
              retryable: mapped.retryable,
              httpStatusHint: 502,
              historical: {
                completeStatus: completeRes.status,
                completeError: complete.error,
              },
            }
          );
        }

        return validateAiccosClipResult(complete.clip);
      } catch (e) {
        if (e instanceof AiccosPipelineError) throw e;
        if (signal.aborted) {
          throw new AiccosPipelineError("timeout", "Délai d'attente AICCOS dépassé.", {
            httpStatusHint: 502,
            retryable: true,
          });
        }
        throw new AiccosPipelineError("complete_failed", "Confirmation AICCOS échouée.", {
          httpStatusHint: 502,
        });
      } finally {
        cleanup();
      }
    },
  };
}
