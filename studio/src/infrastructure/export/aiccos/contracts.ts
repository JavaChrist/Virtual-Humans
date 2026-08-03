/**
 * AICCOS export contracts (VHS-111C).
 * No tokens, no secrets as business data.
 */

export const AICCOS_MAX_BYTES = 50 * 1024 * 1024;
export const AICCOS_DEFAULT_MIME = "video/mp4";
export const AICCOS_DEFAULT_BASE_URL = "https://aicommandcenteros.app";

export type AiccosExecutionContext = {
  correlationId: string;
  timeoutMs: number;
  requestedAt: string;
  signal?: AbortSignal;
};

export type ExportAssetSource = {
  url: string;
};

export type DownloadedExportAsset = {
  bytes: Uint8Array;
  mimeType: string;
  sizeBytes: number;
  sourceMetadata: {
    /** Redacted / safe origin label — never a full signed URL. */
    origin: string;
  };
};

export type AiccosExportRequest = {
  videoUrl: string;
  title: string;
  productSlug?: string | null;
};

export type AiccosCreateImportRequest = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  productSlug: string | null;
};

export type AiccosImportSession = {
  /** Historical AICCOS `path` used as filePath on complete. */
  importId: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt?: string;
};

export type AiccosUploadRequest = {
  uploadUrl: string;
  bytes: Uint8Array;
  mimeType: string;
  sizeBytes: number;
  requiredHeaders: Record<string, string>;
};

export type AiccosUploadResult = {
  ok: true;
} | {
  ok: false;
  status: number;
  /** Truncated body for historical HTTP mapping only — never logged. */
  detailSnippet?: string;
};

export type AiccosCompleteImportRequest = {
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  title: string;
  productSlug: string | null;
};

export type AiccosClipResult = {
  id: string;
  publicUrl: string;
  title: string;
};

export type AiccosExportPipelineResult =
  | {
      status: "delivered";
      destinationId: "aiccos";
      externalId: string;
      publicUrl: string;
      title: string;
      deliveredAt: string;
    }
  | {
      status: "failed";
      error: AiccosExportError;
      failedAt: string;
    };

export type AiccosErrorCode =
  | "invalid_export_package"
  | "invalid_source_url"
  | "source_download_failed"
  | "source_too_large"
  | "source_mime_unsupported"
  | "source_empty"
  | "aiccos_not_configured"
  | "aiccos_unauthorized"
  | "aiccos_rate_limited"
  | "aiccos_unavailable"
  | "import_creation_failed"
  | "invalid_import_session"
  | "upload_failed"
  | "complete_failed"
  | "invalid_clip_result"
  | "timeout"
  | "cancelled"
  | "unknown";

export type AiccosExportError = {
  code: AiccosErrorCode;
  retryable: boolean;
  publicMessage: string;
  /** Safe internal code for route mapping — never secrets/URLs. */
  internalCode?: string;
  /** Historical HTTP status hint for the route adapter. */
  httpStatusHint?: number;
  /** Fields needed to reconstruct historical public messages exactly. */
  historical?: {
    downloadStatus?: number;
    sizeBytes?: number;
    prepareStatus?: number;
    prepareError?: string;
    uploadStatus?: number;
    uploadDetail?: string;
    completeStatus?: number;
    completeError?: string;
  };
};

export interface ExportSourceDownloader {
  download(
    source: ExportAssetSource,
    context: AiccosExecutionContext
  ): Promise<DownloadedExportAsset>;
}

export interface AiccosImportClient {
  createImport(
    request: AiccosCreateImportRequest,
    context: AiccosExecutionContext
  ): Promise<AiccosImportSession>;

  completeImport(
    request: AiccosCompleteImportRequest,
    context: AiccosExecutionContext
  ): Promise<AiccosClipResult>;
}

export interface AiccosStorageUploader {
  upload(
    request: AiccosUploadRequest,
    context: AiccosExecutionContext
  ): Promise<AiccosUploadResult>;
}

export interface AiccosExportPipeline {
  send(
    request: AiccosExportRequest,
    context: AiccosExecutionContext
  ): Promise<AiccosExportPipelineResult>;
}

export type AiccosPipelineDeps = {
  downloader: ExportSourceDownloader;
  importClient: AiccosImportClient;
  uploader: AiccosStorageUploader;
  /** Injected clock — never Date.now() inside pure helpers. */
  nowMs: () => number;
  logger?: {
    info(event: string, context: { correlationId: string }, data?: unknown): void;
    error(
      event: string,
      context: { correlationId: string },
      error?: unknown,
      data?: unknown
    ): void;
  };
};
