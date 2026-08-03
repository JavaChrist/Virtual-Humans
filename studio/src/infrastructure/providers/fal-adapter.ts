/**
 * fal.ai ProviderAdapter wrapper (VHS-109).
 * Supports queue submit/poll for video/lipsync/carousel.
 * Identity image via optional sync port (flux-pulid).
 * cancel / webhook: unsupported (not present in existing helpers).
 */

import type { MediaAction } from "@/domain/cost";
import {
  GenerationDomainError,
  type CanonicalGenerationInput,
  type ProviderAdapter,
  type ProviderExecutionContext,
  type ProviderPollResult,
  type ProviderSubmissionResult,
  type ExternalJobRef,
} from "@/domain/generation";
import type { FalClientPort } from "./contracts";
import { mapProviderError } from "./error-mapping";
import { expiresAtFrom, mapCompletedMedia } from "./output-mapping";

const VIDEO_MODELS = new Set([
  "fal-ai/veo3.1/fast",
  "bytedance/seedance-2.0/reference-to-video",
  "fal-ai/kling-video/v2/master/image-to-video",
  "fal-ai/runway-gen3/turbo/image-to-video",
  "fal-ai/kling-video/v2/master/text-to-video",
  "fal-ai/minimax/hailuo-02/standard/text-to-video",
]);

const LIPSYNC_MODELS = new Set(["veed/lipsync", "fal-ai/sync-lipsync/v3"]);
const CAROUSEL_MODELS = new Set(["fal-ai/ffmpeg-api/images-to-video"]);
const IDENTITY_MODELS = new Set(["fal-ai/flux-pulid", "fal-ai/nano-banana/edit"]);

function accessUrl(asset: { access: CanonicalGenerationInput["references"][number]["access"] }): string {
  if (asset.access.kind === "signed_url") return asset.access.url;
  if (asset.access.kind === "data_url") return asset.access.dataUrl;
  throw new GenerationDomainError(
    "asset_unavailable",
    "fal adapter requires signed_url or data_url access (internal storage not wired).",
  );
}

function buildFalInput(input: CanonicalGenerationInput): Record<string, unknown> {
  if (input.kind === "video") {
    const body: Record<string, unknown> = {
      prompt: input.promptText,
      duration: input.durationSeconds,
    };
    if (input.aspectRatio) body.aspect_ratio = input.aspectRatio;
    if (input.startFrame) body.image_url = accessUrl(input.startFrame);
    return body;
  }
  if (input.kind === "lipsync") {
    return {
      video_url: accessUrl(input.video),
      audio_url: accessUrl(input.audio),
    };
  }
  if (input.kind === "carousel") {
    return {
      image_urls: input.images.map((i) => accessUrl(i)),
      duration: input.durationSeconds,
    };
  }
  if (input.kind === "image") {
    return { prompt: input.promptText };
  }
  throw new GenerationDomainError("model_not_supported", "fal adapter does not support this input kind.");
}

export function createFalAdapter(client: FalClientPort): ProviderAdapter {
  return {
    providerId: "fal",
    supports(modelId: string, action: MediaAction): boolean {
      if (action === "video") return VIDEO_MODELS.has(modelId);
      if (action === "lipsync") return LIPSYNC_MODELS.has(modelId);
      if (action === "carousel") return CAROUSEL_MODELS.has(modelId);
      if (action === "image" || action === "scene_image" || action === "duo_frame") {
        return IDENTITY_MODELS.has(modelId);
      }
      return false;
    },
    async submit(
      input: CanonicalGenerationInput,
      context: ProviderExecutionContext,
    ): Promise<ProviderSubmissionResult> {
      if (context.signal?.aborted) {
        throw new GenerationDomainError("cancelled", "Generation was aborted.", {
          providerId: "fal",
          modelId: input.modelId,
        });
      }
      // Idempotency key: fal queue helpers do not accept it → no silent claim
      void context.idempotencyKey;

      try {
        if (
          (input.action === "image" || input.action === "scene_image") &&
          input.modelId === "fal-ai/flux-pulid"
        ) {
          if (!client.generateIdentityImage) {
            throw new GenerationDomainError(
              "model_not_supported",
              "Identity image client port is not configured.",
              { providerId: "fal", modelId: input.modelId },
            );
          }
          const ref = input.references[0];
          if (!ref) {
            throw new GenerationDomainError("invalid_input", "Identity image requires a reference.");
          }
          const url = await client.generateIdentityImage(
            accessUrl(ref),
            input.promptText,
          );
          return {
            status: "completed",
            completedAt: context.requestedAt,
            output: mapCompletedMedia({
              id: `fal-img:${context.idempotencyKey}`,
              kind: "image",
              mimeType: "image/png",
              temporaryUrl: url,
              expiresAt: expiresAtFrom(context.requestedAt),
            }),
          };
        }

        const falInput = buildFalInput(input);
        const requestId = await client.submitJob(input.modelId, falInput);
        return {
          status: "submitted",
          submittedAt: context.requestedAt,
          pollAfterMs: 2000,
          providerJob: {
            providerId: "fal",
            modelId: input.modelId,
            externalJobId: requestId,
          },
        };
      } catch (e) {
        if (e instanceof GenerationDomainError) throw e;
        throw new GenerationDomainError(
          mapProviderError(e, { providerId: "fal", modelId: input.modelId }).code,
          mapProviderError(e, { providerId: "fal", modelId: input.modelId }).publicMessage,
          {
            retryable: mapProviderError(e, { providerId: "fal", modelId: input.modelId }).retryable,
            providerId: "fal",
            modelId: input.modelId,
            diagnostic: mapProviderError(e, { providerId: "fal", modelId: input.modelId }).internalCode,
          },
        );
      }
    },
    async poll(
      job: ExternalJobRef,
      context: ProviderExecutionContext,
    ): Promise<ProviderPollResult> {
      if (job.providerId !== "fal") {
        throw new GenerationDomainError("invalid_input", "Cannot poll job from another provider.");
      }
      if (context.signal?.aborted) {
        throw new GenerationDomainError("cancelled", "Generation was aborted.", {
          providerId: "fal",
          modelId: job.modelId,
        });
      }
      try {
        const status = await client.checkJob(job.modelId, job.externalJobId);
        if (status.status === "COMPLETED") {
          const url = status.videoUrl ?? status.imageUrl;
          if (!url) {
            return {
              status: "failed",
              failedAt: context.requestedAt,
              providerJob: job,
              error: {
                code: "output_invalid",
                retryable: false,
                publicMessage: "Provider completed without media URL.",
                providerId: "fal",
                modelId: job.modelId,
              },
            };
          }
          const kind =
            LIPSYNC_MODELS.has(job.modelId)
              ? "lipsync"
              : CAROUSEL_MODELS.has(job.modelId)
                ? "carousel"
                : IDENTITY_MODELS.has(job.modelId)
                  ? "image"
                  : "video";
          return {
            status: "completed",
            completedAt: context.requestedAt,
            providerJob: job,
            output: mapCompletedMedia({
              id: `fal-out:${job.externalJobId}`,
              kind,
              mimeType: kind === "image" ? "image/png" : "video/mp4",
              temporaryUrl: url,
              expiresAt: expiresAtFrom(context.requestedAt),
            }),
          };
        }
        if (status.status === "FAILED") {
          return {
            status: "failed",
            failedAt: context.requestedAt,
            providerJob: job,
            error: {
              code: "provider_unavailable",
              retryable: true,
              publicMessage: "Provider job failed.",
              providerId: "fal",
              modelId: job.modelId,
              internalCode: status.error ? "fal_job_failed" : undefined,
            },
          };
        }
        return {
          status: "processing",
          providerJob: job,
          pollAfterMs: 2000,
        };
      } catch (e) {
        const mapped = mapProviderError(e, { providerId: "fal", modelId: job.modelId });
        return {
          status: "failed",
          failedAt: context.requestedAt,
          providerJob: job,
          error: mapped,
        };
      }
    },
    // cancel: unsupported — existing fal helpers have no cancel API
    // verifyWebhook: unsupported
  };
}
