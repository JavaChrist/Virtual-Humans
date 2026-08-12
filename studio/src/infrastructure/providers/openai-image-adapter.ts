/**
 * OpenAI image ProviderAdapter (VHS-109).
 * Synchronous completed result — no async job / poll / cancel.
 * No internal retry / fallback. Key never stored on the adapter.
 */

import type { MediaAction } from "@/domain/cost";
import { fromLegacyUsdEstimate } from "@/domain/cost";
import {
  GenerationDomainError,
  type CanonicalGenerationInput,
  type ProviderAdapter,
  type ProviderEstimateResult,
  type ProviderExecutionContext,
  type ProviderSubmissionResult,
} from "@/domain/generation";
import { estimateImage, type ImageQuality, type ImageSize } from "@/lib/pricing";
import type { OpenAIImageClientPort } from "./contracts";
import { mapProviderError } from "./error-mapping";
import { mapCompletedMedia } from "./output-mapping";

function sizeFromAspect(
  aspect?: string,
): "1024x1024" | "1024x1536" | "1536x1024" {
  if (aspect === "16:9") return "1536x1024";
  if (aspect === "9:16") return "1024x1536";
  return "1024x1024";
}

export type OpenAIImageAdapterOptions = {
  /** Default medium (legacy Studio). Phase 11A smoke uses low. */
  quality?: ImageQuality;
  /** When set, ignore aspect mapping and force this size. */
  forceSize?: ImageSize;
};

export function createOpenAIImageAdapter(
  client: OpenAIImageClientPort,
  options: OpenAIImageAdapterOptions = {},
): ProviderAdapter {
  const quality = options.quality ?? "medium";

  return {
    providerId: "openai",
    supports(modelId: string, action: MediaAction): boolean {
      return modelId === "gpt-image-1" && (action === "image" || action === "scene_image");
    },
    async estimate(
      input: CanonicalGenerationInput,
      context: ProviderExecutionContext,
    ): Promise<ProviderEstimateResult> {
      if (input.kind !== "image") {
        throw new GenerationDomainError(
          "model_not_supported",
          "OpenAI adapter estimate expects image input.",
        );
      }
      const size = options.forceSize ?? sizeFromAspect(input.aspectRatio);
      const usd = estimateImage(size, quality, 1);
      return {
        estimate: fromLegacyUsdEstimate({
          id: `est-openai-img-${context.idempotencyKey}`.slice(0, 64),
          projectId: "openai-image-estimate",
          createdBy: "openai-image-adapter",
          correlationId: context.correlationId,
          action: "image",
          modelId: input.modelId,
          providerId: "openai",
          quantity: 1,
          usd,
          confidence: "high",
        }),
      };
    },
    async submit(
      input: CanonicalGenerationInput,
      context: ProviderExecutionContext,
    ): Promise<ProviderSubmissionResult> {
      if (input.kind !== "image") {
        throw new GenerationDomainError("model_not_supported", "OpenAI adapter expects image input.");
      }
      if (context.signal?.aborted) {
        throw new GenerationDomainError("cancelled", "Generation was aborted.", {
          providerId: "openai",
          modelId: input.modelId,
        });
      }
      // OpenAI images API does not accept our idempotency key
      void context.idempotencyKey;
      void context.correlationId;

      const size = options.forceSize ?? sizeFromAspect(input.aspectRatio);

      try {
        // Exactly one client call — no retry loop.
        const result = await client.generateImage({
          prompt: input.promptText,
          size,
          quality,
        });
        return {
          status: "completed",
          completedAt: context.requestedAt,
          output: mapCompletedMedia({
            id: `openai-img:${context.idempotencyKey}`,
            kind: "image",
            mimeType: "image/png",
            dataUrl: result.dataUrl.startsWith("data:")
              ? result.dataUrl
              : undefined,
            temporaryUrl: result.dataUrl.startsWith("http")
              ? result.dataUrl
              : undefined,
            expiresAt: result.dataUrl.startsWith("http")
              ? new Date(Date.parse(context.requestedAt) + 3600_000).toISOString()
              : undefined,
          }),
        };
      } catch (e) {
        if (e instanceof GenerationDomainError) throw e;
        const mapped = mapProviderError(e, { providerId: "openai", modelId: input.modelId });
        throw new GenerationDomainError(mapped.code, mapped.publicMessage, {
          retryable: mapped.retryable,
          providerId: "openai",
          modelId: input.modelId,
          diagnostic: mapped.internalCode,
        });
      }
    },
    // poll / cancel / webhook: unsupported
  };
}
