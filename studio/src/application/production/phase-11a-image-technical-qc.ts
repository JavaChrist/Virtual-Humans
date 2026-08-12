/**
 * Phase 11A — technical image QC (no fake visual score).
 */

import { createHash } from "node:crypto";
import type { GeneratedAsset } from "@/domain/generation";
import type { QualityValidationResult } from "@/domain/production/quality";
import {
  PHASE_11A_SMOKE_SIZE,
} from "./phase-11a-openai-image-allowlist";

export type Phase11AImageTechnicalMeta = {
  mimeType: string;
  byteLength: number;
  checksumSha256: string;
  width?: number;
  height?: number;
  /** true when width/height measured from decoded bytes */
  dimensionsMeasured: boolean;
  provenanceComplete: boolean;
};

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Minimal PNG IHDR parse — returns null if not decodable. */
export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  for (let i = 0; i < PNG_SIG.length; i++) {
    if (bytes[i] !== PNG_SIG[i]) return null;
  }
  // IHDR length(4)+type(4)+data starts at 8
  const width =
    ((bytes[16] ?? 0) << 24) |
    ((bytes[17] ?? 0) << 16) |
    ((bytes[18] ?? 0) << 8) |
    (bytes[19] ?? 0);
  const height =
    ((bytes[20] ?? 0) << 24) |
    ((bytes[21] ?? 0) << 16) |
    ((bytes[22] ?? 0) << 8) |
    (bytes[23] ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

export function checksumSha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Decode OpenAI data-URL / raw base64 into memory bytes only.
 * Never returns base64 string for persistence.
 */
export function decodeOpenAIImageToMemoryBytes(
  dataUrlOrB64: string,
): { bytes: Uint8Array; mime: "image/png" } {
  const raw = dataUrlOrB64.trim();
  let b64: string;
  if (raw.startsWith("data:")) {
    const comma = raw.indexOf(",");
    if (comma < 0) throw new Error("Phase 11A: invalid data URL.");
    const header = raw.slice(0, comma).toLowerCase();
    if (!header.includes("image/png") && !header.includes("image/")) {
      throw new Error("Phase 11A: expected image data URL.");
    }
    b64 = raw.slice(comma + 1);
  } else {
    b64 = raw;
  }
  if (b64.length > 12_000_000) {
    throw new Error("Phase 11A: base64 payload exceeds memory bound.");
  }
  const buf = Buffer.from(b64, "base64");
  if (buf.byteLength === 0) throw new Error("Phase 11A: empty image bytes.");
  if (buf.byteLength > 8_000_000) {
    throw new Error("Phase 11A: decoded image exceeds memory bound.");
  }
  return { bytes: new Uint8Array(buf), mime: "image/png" };
}

export function buildPhase11AImageTechnicalMeta(
  bytes: Uint8Array,
  opts?: { provenanceComplete?: boolean },
): Phase11AImageTechnicalMeta {
  const dims = readPngDimensions(bytes);
  return {
    mimeType: "image/png",
    byteLength: bytes.byteLength,
    checksumSha256: checksumSha256Bytes(bytes),
    width: dims?.width,
    height: dims?.height,
    dimensionsMeasured: Boolean(dims),
    provenanceComplete: opts?.provenanceComplete ?? true,
  };
}

export function validatePhase11AImageTechnical(input: {
  asset: GeneratedAsset;
  meta: Phase11AImageTechnicalMeta;
}): QualityValidationResult {
  const checks: Array<{ code: string; passed: boolean; detail?: string }> = [];
  const reasons: Array<{ code: string; message: string }> = [];

  const mimeOk = input.meta.mimeType === "image/png" && input.asset.mimeType === "image/png";
  checks.push({ code: "mime_png", passed: mimeOk });
  if (!mimeOk) reasons.push({ code: "mime", message: "Expected image/png." });

  const decodable = input.meta.byteLength > 0 && Boolean(input.meta.checksumSha256);
  checks.push({ code: "decodable", passed: decodable });
  if (!decodable) reasons.push({ code: "corrupt", message: "Image not decodable." });

  const expected = PHASE_11A_SMOKE_SIZE.split("x").map(Number);
  const [ew, eh] = expected;
  if (!input.meta.dimensionsMeasured) {
    checks.push({
      code: "dimensions",
      passed: true,
      detail: "unavailable_humanOnly",
    });
  } else {
    const dimOk = input.meta.width === ew && input.meta.height === eh;
    checks.push({
      code: "dimensions",
      passed: dimOk,
      detail: `${input.meta.width}x${input.meta.height}`,
    });
    if (!dimOk) {
      reasons.push({
        code: "dimensions",
        message: `Expected ${PHASE_11A_SMOKE_SIZE}.`,
      });
    }
  }

  const sizeOk = input.meta.byteLength > 32 && input.meta.byteLength <= 8_000_000;
  checks.push({ code: "byte_size", passed: sizeOk, detail: String(input.meta.byteLength) });
  if (!sizeOk) reasons.push({ code: "size", message: "Byte size out of bounds." });

  checks.push({
    code: "checksum",
    passed: /^[a-f0-9]{64}$/.test(input.meta.checksumSha256),
  });

  checks.push({
    code: "provenance",
    passed: input.meta.provenanceComplete,
  });
  if (!input.meta.provenanceComplete) {
    reasons.push({ code: "provenance", message: "Provenance incomplete." });
  }

  // No fake visual score — mark visual as humanOnly.
  checks.push({
    code: "visual_auto",
    passed: true,
    detail: "unavailable_humanOnly",
  });

  if (reasons.length > 0) {
    return {
      status: "rejected",
      checks,
      reasons,
      retryableWithFallback: false,
    };
  }

  return {
    status: "needs_review",
    checks,
    reasons: [
      {
        code: "human_review_required",
        message: "Technical QC passed — Human Review required before activation.",
      },
    ],
  };
}
