/**
 * Canonical generation inputs — provider-agnostic (VHS-109).
 */

import type { BriefAspectRatio } from "@/domain/brief";
import type { CapabilityProfile } from "@/domain/prompt";
import type { MediaAction } from "@/domain/cost";
import { GenerationDomainError } from "./errors";

export const AssetKindValues = [
  "character",
  "outfit",
  "expression",
  "pose",
  "product",
  "background",
  "brand",
  "screen",
  "voice",
  "image",
  "video",
  "audio",
  "step_output",
] as const;
export type AssetKind = (typeof AssetKindValues)[number];

export type AssetAccess =
  | { kind: "internal"; storagePath: string }
  | { kind: "signed_url"; url: string; expiresAt: string }
  | { kind: "data_url"; dataUrl: string };

export type AssetInputRef = {
  assetId: string;
  kind: AssetKind;
  mimeType?: string;
  checksum?: string;
  access: AssetAccess;
};

export type ResolvedGenerationInput = {
  role: string;
  asset: AssetInputRef;
  fromStepId?: string;
};

type CommonInput = {
  action: MediaAction;
  capabilityProfile: CapabilityProfile;
  providerId: string;
  modelId: string;
  promptText: string;
  promptVariantId?: string;
  rendererVersion?: string;
  aspectRatio?: BriefAspectRatio;
  negativePrompt?: string;
  references: AssetInputRef[];
};

export type ImageGenerationInput = CommonInput & {
  kind: "image";
  action: "image" | "scene_image" | "duo_frame";
};

export type VideoGenerationInput = CommonInput & {
  kind: "video";
  action: "video";
  durationSeconds: number;
  startFrame?: AssetInputRef;
};

export type VoiceGenerationInput = CommonInput & {
  kind: "voice";
  action: "voice";
  text: string;
  language?: string;
  voiceAsset?: AssetInputRef;
};

export type LipsyncGenerationInput = CommonInput & {
  kind: "lipsync";
  action: "lipsync";
  video: AssetInputRef;
  audio: AssetInputRef;
  durationSeconds?: number;
};

export type CarouselGenerationInput = CommonInput & {
  kind: "carousel";
  action: "carousel";
  durationSeconds: number;
  images: AssetInputRef[];
};

export type CanonicalGenerationInput =
  | ImageGenerationInput
  | VideoGenerationInput
  | VoiceGenerationInput
  | LipsyncGenerationInput
  | CarouselGenerationInput;

/** Validate signed URL access without logging the URL. */
export function assertAssetAccessUsable(asset: AssetInputRef, at: string): void {
  if (asset.access.kind === "signed_url") {
    const exp = Date.parse(asset.access.expiresAt);
    const now = Date.parse(at);
    if (!Number.isFinite(exp) || !Number.isFinite(now) || now >= exp) {
      throw new GenerationDomainError("asset_unavailable", "Signed asset URL is expired or invalid.");
    }
    if (!/^https:\/\//i.test(asset.access.url)) {
      throw new GenerationDomainError("asset_unavailable", "Asset URL scheme is not allowed.");
    }
  }
  if (asset.access.kind === "internal" && !asset.access.storagePath.trim()) {
    throw new GenerationDomainError("asset_unavailable", "Internal asset path is empty.");
  }
}
