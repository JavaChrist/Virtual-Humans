/**
 * Normalize fal compose video URL to GeneratedAsset (VHS-111B).
 * Expiry must be supplied by the caller — never invented here from thin air.
 */

import type { GeneratedAsset } from "@/domain/generation";

export type FalComposeSubmission = {
  requestId: string;
  modelId: string;
};

export type FalComposePollResult =
  | { status: "IN_QUEUE" | "IN_PROGRESS"; requestId: string }
  | { status: "COMPLETED"; requestId: string; videoUrl: string }
  | { status: "FAILED"; requestId: string; error?: string };

export function buildComposeVideoAsset(input: {
  assetId: string;
  videoUrl: string;
  expiresAt: string;
}): GeneratedAsset | { error: "output_invalid" } {
  const url = input.videoUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    return { error: "output_invalid" };
  }
  return {
    id: input.assetId,
    kind: "video",
    mimeType: "video/mp4",
    source: {
      kind: "temporary_external",
      url,
      expiresAt: input.expiresAt,
    },
  };
}
