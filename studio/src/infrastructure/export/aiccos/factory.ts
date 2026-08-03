/**
 * Production factory for AICCOS pipeline (VHS-111C).
 * Reads env here only — never in domain/application.
 */

import { logger as defaultLogger } from "@/infrastructure/observability";
import { AICCOS_DEFAULT_BASE_URL, type AiccosExportPipeline } from "./contracts";
import { createFetchAiccosImportClient } from "./import-client";
import { createAiccosExportPipeline } from "./pipeline";
import { createFetchSourceDownloader, type FetchLike } from "./source-download";
import { createFetchAiccosStorageUploader } from "./upload-client";

export type CreateProductionAiccosPipelineOptions = {
  fetchImpl?: FetchLike;
  nowMs?: () => number;
  logger?: typeof defaultLogger;
  /** Override env for tests — never pass real secrets in unit tests. */
  env?: {
    AICCOS_URL?: string;
    AICCOS_IMPORT_TOKEN?: string;
  };
};

/**
 * Builds the shared pipeline wired to fetch.
 * Throws if AICCOS_IMPORT_TOKEN is absent (caller maps to historical 500).
 */
export function createProductionAiccosPipeline(
  options: CreateProductionAiccosPipelineOptions = {}
): AiccosExportPipeline {
  const env = options.env ?? process.env;
  const token = env.AICCOS_IMPORT_TOKEN;
  if (!token) {
    throw new Error("AICCOS_IMPORT_TOKEN_MISSING");
  }
  const baseUrl = (env.AICCOS_URL ?? AICCOS_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const nowMs = options.nowMs ?? (() => Date.now());
  const log = options.logger ?? defaultLogger;

  return createAiccosExportPipeline({
    downloader: createFetchSourceDownloader({ fetchImpl }),
    importClient: createFetchAiccosImportClient({
      baseUrl,
      importToken: token,
      fetchImpl,
    }),
    uploader: createFetchAiccosStorageUploader({ fetchImpl }),
    nowMs,
    logger: log,
  });
}
