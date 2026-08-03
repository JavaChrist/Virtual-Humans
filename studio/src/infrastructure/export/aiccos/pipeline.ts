/**
 * Shared AICCOS export pipeline (VHS-111C).
 * Order: validate → download → createImport → upload → completeImport → validate result.
 */

import type {
  AiccosExecutionContext,
  AiccosExportPipeline,
  AiccosExportPipelineResult,
  AiccosExportRequest,
  AiccosPipelineDeps,
} from "./contracts";
import { AiccosPipelineError, isAiccosPipelineError, toAiccosExportError } from "./errors";
import { fileNameFromUrl, parseHistoricalAiccosBody } from "./validation";

export function createAiccosExportPipeline(deps: AiccosPipelineDeps): AiccosExportPipeline {
  return {
    async send(
      request: AiccosExportRequest,
      context: AiccosExecutionContext
    ): Promise<AiccosExportPipelineResult> {
      const logCtx = { correlationId: context.correlationId };
      deps.logger?.info("aiccos.export.started", logCtx, {
        hasProductSlug: !!request.productSlug,
      });

      try {
        // Re-validate via historical parser (also covers adapter-built requests)
        const validated = parseHistoricalAiccosBody(request);

        const downloaded = await deps.downloader.download(
          { url: validated.videoUrl },
          context
        );
        deps.logger?.info("aiccos.source.downloaded", logCtx, {
          sizeBytes: downloaded.sizeBytes,
          mimeType: downloaded.mimeType,
          origin: downloaded.sourceMetadata.origin,
        });

        const session = await deps.importClient.createImport(
          {
            fileName: fileNameFromUrl(validated.videoUrl, deps.nowMs()),
            mimeType: downloaded.mimeType,
            sizeBytes: downloaded.sizeBytes,
            productSlug: validated.productSlug ?? null,
          },
          context
        );
        deps.logger?.info("aiccos.import.created", logCtx, {
          importIdLength: session.importId.length,
          hasExpiresAt: !!session.expiresAt,
        });

        const uploadResult = await deps.uploader.upload(
          {
            uploadUrl: session.uploadUrl,
            bytes: downloaded.bytes,
            mimeType: downloaded.mimeType,
            sizeBytes: downloaded.sizeBytes,
            requiredHeaders: session.requiredHeaders,
          },
          context
        );
        if (!uploadResult.ok) {
          throw new AiccosPipelineError(
            "upload_failed",
            `L'upload du clip a échoué (${uploadResult.status}). ${uploadResult.detailSnippet ?? ""}`.trimEnd(),
            {
              httpStatusHint: 502,
              historical: {
                uploadStatus: uploadResult.status,
                uploadDetail: uploadResult.detailSnippet,
              },
            }
          );
        }
        deps.logger?.info("aiccos.upload.completed", logCtx, {
          sizeBytes: downloaded.sizeBytes,
        });

        const clip = await deps.importClient.completeImport(
          {
            filePath: session.importId,
            mimeType: downloaded.mimeType,
            sizeBytes: downloaded.sizeBytes,
            title: validated.title,
            productSlug: validated.productSlug ?? null,
          },
          context
        );

        deps.logger?.info("aiccos.export.completed", logCtx, {
          externalId: clip.id,
          sizeBytes: downloaded.sizeBytes,
          mimeType: downloaded.mimeType,
        });

        return {
          status: "delivered",
          destinationId: "aiccos",
          externalId: clip.id,
          publicUrl: clip.publicUrl,
          title: clip.title,
          deliveredAt: context.requestedAt,
        };
      } catch (e) {
        const err = toAiccosExportError(e);
        deps.logger?.error("aiccos.export.failed", logCtx, undefined, {
          code: err.code,
          retryable: err.retryable,
        });
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: err,
        };
      }
    },
  };
}

/** Assert no sensitive fields in a serializable log/error snapshot. */
export function assertSafePublicSurface(value: unknown, forbiddenSubstrings: string[]): void {
  const json = JSON.stringify(value);
  for (const s of forbiddenSubstrings) {
    if (s && json.includes(s)) {
      throw new Error("Sensitive value leaked into public surface");
    }
  }
  if (isAiccosPipelineError(value)) {
    void value;
  }
}
