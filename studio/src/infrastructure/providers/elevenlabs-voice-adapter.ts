/**
 * ElevenLabs voice ProviderAdapter (VHS-109).
 * Synchronous completed result — no poll / cancel / webhook.
 * Voice id must be provided via resolved voice asset or fails — no silent default.
 */

import type { MediaAction } from "@/domain/cost";
import {
  GenerationDomainError,
  type CanonicalGenerationInput,
  type ProviderAdapter,
  type ProviderExecutionContext,
  type ProviderSubmissionResult,
} from "@/domain/generation";
import type { ElevenLabsVoiceClientPort } from "./contracts";
import { mapProviderError } from "./error-mapping";
import { mapCompletedMedia } from "./output-mapping";

function resolveVoiceId(input: CanonicalGenerationInput): string | undefined {
  if (input.kind !== "voice") return undefined;
  const asset = input.voiceAsset;
  if (!asset) return undefined;
  // Convention: assetId holds the ElevenLabs voice id when kind=voice
  return asset.assetId;
}

export function createElevenLabsVoiceAdapter(
  client: ElevenLabsVoiceClientPort,
): ProviderAdapter {
  return {
    providerId: "elevenlabs",
    supports(modelId: string, action: MediaAction): boolean {
      return action === "voice" && modelId === "eleven_multilingual_v2";
    },
    async submit(
      input: CanonicalGenerationInput,
      context: ProviderExecutionContext,
    ): Promise<ProviderSubmissionResult> {
      if (input.kind !== "voice") {
        throw new GenerationDomainError(
          "model_not_supported",
          "ElevenLabs adapter expects voice input.",
        );
      }
      if (context.signal?.aborted) {
        throw new GenerationDomainError("cancelled", "Generation was aborted.", {
          providerId: "elevenlabs",
          modelId: input.modelId,
        });
      }
      void context.idempotencyKey;

      const voiceId = resolveVoiceId(input);
      if (!voiceId) {
        throw new GenerationDomainError(
          "invalid_input",
          "Voice generation requires an explicit voice asset id.",
          { providerId: "elevenlabs", modelId: input.modelId },
        );
      }
      if (!input.text.trim()) {
        throw new GenerationDomainError("invalid_input", "Voice text is empty.");
      }

      try {
        const result = await client.generateVoice({
          text: input.text,
          voiceId,
          modelId: input.modelId,
        });
        return {
          status: "completed",
          completedAt: context.requestedAt,
          output: mapCompletedMedia({
            id: `el-voice:${context.idempotencyKey}`,
            kind: "audio",
            mimeType: result.mime || "audio/mpeg",
            dataUrl: result.dataUrl,
          }),
        };
      } catch (e) {
        if (e instanceof GenerationDomainError) throw e;
        const mapped = mapProviderError(e, {
          providerId: "elevenlabs",
          modelId: input.modelId,
        });
        throw new GenerationDomainError(mapped.code, mapped.publicMessage, {
          retryable: mapped.retryable,
          providerId: "elevenlabs",
          modelId: input.modelId,
          diagnostic: mapped.internalCode,
        });
      }
    },
  };
}
