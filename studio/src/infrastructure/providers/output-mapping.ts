/**
 * Pure provider output → GeneratedAsset mapping (VHS-109).
 * Does not invent checksum, size, duration, or persistent URLs.
 */

import { GenerationDomainError, type GeneratedAsset } from "@/domain/generation";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
]);

export function mapCompletedMedia(input: {
  id: string;
  kind: GeneratedAsset["kind"];
  mimeType: string;
  temporaryUrl?: string;
  dataUrl?: string;
  expiresAt?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}): GeneratedAsset {
  if (!ALLOWED_MIME.has(input.mimeType) && !input.mimeType.startsWith("image/") && !input.mimeType.startsWith("video/") && !input.mimeType.startsWith("audio/")) {
    throw new GenerationDomainError("output_invalid", "Unsupported media MIME type.");
  }

  if (input.temporaryUrl) {
    if (!/^https:\/\//i.test(input.temporaryUrl)) {
      throw new GenerationDomainError("output_invalid", "External media URL scheme not allowed.");
    }
    if (!input.expiresAt || !Number.isFinite(Date.parse(input.expiresAt))) {
      throw new GenerationDomainError(
        "output_invalid",
        "Temporary external media requires expiresAt.",
      );
    }
    return {
      id: input.id,
      kind: input.kind,
      mimeType: input.mimeType,
      source: {
        kind: "temporary_external",
        url: input.temporaryUrl,
        expiresAt: input.expiresAt,
      },
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
    };
  }

  if (input.dataUrl) {
    if (!/^data:/i.test(input.dataUrl)) {
      throw new GenerationDomainError("output_invalid", "Inline media must be a data URL.");
    }
    return {
      id: input.id,
      kind: input.kind,
      mimeType: input.mimeType,
      source: { kind: "inline_data_url", dataUrl: input.dataUrl },
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
    };
  }

  throw new GenerationDomainError("output_invalid", "Provider output media is missing.");
}

/** Default temporary URL TTL when provider does not expose expiry (documented assumption). */
export const TEMP_URL_DEFAULT_TTL_MS = 60 * 60 * 1000;

export function expiresAtFrom(requestedAt: string, ttlMs = TEMP_URL_DEFAULT_TTL_MS): string {
  const t = Date.parse(requestedAt);
  if (!Number.isFinite(t)) {
    throw new GenerationDomainError("invalid_input", "Invalid requestedAt for expiry derivation.");
  }
  return new Date(t + ttlMs).toISOString();
}
