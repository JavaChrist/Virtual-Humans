/**
 * Universal fake ProviderAdapter (VHS-124).
 * No network, no secrets, no media bytes — metadata-only internal refs.
 */

import type { MediaAction } from "@/domain/cost";
import type {
  CanonicalGenerationInput,
  ProviderAdapter,
  ProviderExecutionContext,
  ProviderSubmissionResult,
} from "@/domain/generation";

const FAKE_COST_MINOR = 1;

function assetKind(action: MediaAction): "image" | "video" | "audio" | "lipsync" | "carousel" {
  if (action === "video" || action === "merge" || action === "motion_transfer") return "video";
  if (action === "voice" || action === "merge_audio") return "audio";
  if (action === "lipsync") return "lipsync";
  if (action === "carousel") return "carousel";
  return "image";
}

function mimeFor(kind: ReturnType<typeof assetKind>): string {
  if (kind === "video" || kind === "lipsync" || kind === "carousel") return "video/mp4";
  if (kind === "audio") return "audio/mpeg";
  return "image/png";
}

/**
 * Create a deterministic fake adapter for any provider id (fal / openai / elevenlabs).
 * Outputs are persistence-safe: internal storagePath only, never dataUrl or signed URL.
 */
export function createUniversalFakeAdapter(providerId: string): ProviderAdapter {
  let submitCount = 0;
  const adapter: ProviderAdapter & { readonly submitCount: number } = {
    providerId,
    get submitCount() {
      return submitCount;
    },
    supports(modelId: string, action: MediaAction): boolean {
      void modelId;
      void action;
      return true;
    },
    async submit(
      input: CanonicalGenerationInput,
      context: ProviderExecutionContext,
    ): Promise<ProviderSubmissionResult> {
      if (context.signal?.aborted) {
        throw new Error("Generation was aborted.");
      }
      submitCount += 1;
      void context.idempotencyKey;
      const kind = assetKind(input.action);
      const requestedDuration =
        "durationSeconds" in input && typeof input.durationSeconds === "number"
          ? input.durationSeconds
          : 5;
      const durationSeconds =
        kind === "video" || kind === "lipsync" || kind === "carousel" || kind === "audio"
          ? Math.max(1, Math.round(requestedDuration))
          : undefined;
      return {
        status: "completed",
        completedAt: context.requestedAt,
        output: {
          id: `fake-${providerId}-${submitCount}`,
          kind,
          mimeType: mimeFor(kind),
          source: {
            kind: "internal",
            storagePath: `e2e-fake/${providerId}/${kind}/${submitCount}`,
          },
          checksum: "e2e-fake-synthetic",
          sizeBytes: 86,
          ...(durationSeconds != null ? { durationSeconds } : {}),
        },
        usage: {
          unit: "usd_minor",
          quantity: FAKE_COST_MINOR,
          amountMinor: FAKE_COST_MINOR,
          currency: "USD",
          rawLabel: "fake-universal",
        },
      };
    },
  };
  return adapter;
}
