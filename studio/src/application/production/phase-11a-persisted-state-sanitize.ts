/**
 * Phase 11A — fail-closed sanitization before any Production persistence.
 * Strips media payloads (base64, data URLs, buffers, signed URLs, prompts).
 */

import type { GeneratedAsset } from "@/domain/generation";
import type { ProductionRun } from "@/domain/production";

const FORBIDDEN_KEY_RE =
  /^(b64_json|base64|dataUrl|data_url|bytes|buffer|rawBody|requestBody|responseBody|promptText|prompt_full|authorization|api[_-]?key)$/i;

const DATA_URL_RE = /data:(?:image|application)\/[a-z0-9.+-]+;base64,/i;
/** Long base64-looking blobs; ignores short hashes (≤64) and "[redacted]". */
const BASE64_BLOB_RE = /(?:^|[^A-Za-z0-9+/=])(?:[A-Za-z0-9+/]{200,}={0,2})(?:[^A-Za-z0-9+/=]|$)/;
const SIGNED_URL_RE =
  /https?:\/\/[^\s"'<>]+(?:token|X-Amz-|sig=|signature=|supabase\.co\/storage)/i;
const OPENAI_URL_RE = /https?:\/\/(?:api\.)?openai\.com\//i;
const SK_RE = /sk-[a-zA-Z0-9]{10,}/;

export type PersistedStateSanitizeHit = {
  path: string;
  reason: string;
};

function isBinaryLike(value: unknown): boolean {
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return true;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return true;
  return false;
}

function scanValue(
  value: unknown,
  path: string,
  hits: PersistedStateSanitizeHit[],
): void {
  if (value == null) return;
  if (isBinaryLike(value)) {
    hits.push({ path, reason: "binary_buffer" });
    return;
  }
  if (typeof value === "string") {
    if (DATA_URL_RE.test(value)) hits.push({ path, reason: "data_url" });
    if (BASE64_BLOB_RE.test(value) && value.length > 120) {
      hits.push({ path, reason: "base64_blob" });
    }
    if (SIGNED_URL_RE.test(value) || OPENAI_URL_RE.test(value)) {
      hits.push({ path, reason: "url_payload" });
    }
    if (SK_RE.test(value)) hits.push({ path, reason: "secret_shape" });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => scanValue(item, `${path}[${i}]`, hits));
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const child = path ? `${path}.${k}` : k;
      if (FORBIDDEN_KEY_RE.test(k)) {
        hits.push({ path: child, reason: `forbidden_key:${k}` });
      }
      scanValue(v, child, hits);
    }
  }
}

/** Fail-closed: throw if media/secret payloads remain in a persistence-bound object. */
export function assertNoMediaPayloadInPersistedState(
  value: unknown,
  label = "persisted_state",
): void {
  const hits: PersistedStateSanitizeHit[] = [];
  scanValue(value, label, hits);
  if (hits.length > 0) {
    const sample = hits
      .slice(0, 5)
      .map((h) => `${h.path}:${h.reason}`)
      .join("; ");
    throw new Error(
      `Phase 11A: media/secret payload forbidden in persistence (${sample}).`,
    );
  }
}

/** Rewrite GeneratedAsset to a persistence-safe internal reference. */
export function toPersistedSafeGeneratedAsset(
  asset: GeneratedAsset,
  internal: { storagePath: string; checksum: string; sizeBytes: number; width?: number; height?: number },
): GeneratedAsset {
  return {
    id: asset.id,
    kind: asset.kind,
    mimeType: asset.mimeType,
    source: { kind: "internal", storagePath: internal.storagePath },
    checksum: internal.checksum,
    sizeBytes: internal.sizeBytes,
    width: internal.width,
    height: internal.height,
  };
}

/**
 * Deep-clone ProductionRun stripping inline/temporary media sources.
 * Inline outputs without a storage path become a tombstone (kind internal + unavailable path)
 * so jsonb never retains dataUrl/base64 keys.
 */
export function sanitizeProductionRunForPersistence(run: ProductionRun): ProductionRun {
  const clone = structuredClone(run) as ProductionRun;
  for (const scene of clone.scenes) {
    for (const step of scene.steps) {
      step.outputAssets = step.outputAssets.map((asset) => redactAssetSource(asset));
      step.attempts = step.attempts.map((attempt) => {
        if (!attempt.output) return attempt;
        return { ...attempt, output: redactAssetSource(attempt.output) };
      });
    }
  }
  assertNoMediaPayloadInPersistedState(clone, "production_run");
  return clone;
}

function redactAssetSource(asset: GeneratedAsset): GeneratedAsset {
  if (asset.source.kind === "inline_data_url") {
    // Never persist dataUrl key — tombstone only (materialize path should have rewritten first).
    return {
      id: asset.id,
      kind: asset.kind,
      mimeType: asset.mimeType,
      source: {
        kind: "internal",
        storagePath: "redacted/unavailable/media/image/not-ingested.png",
      },
      checksum: asset.checksum,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
    };
  }
  if (asset.source.kind === "temporary_external") {
    return {
      id: asset.id,
      kind: asset.kind,
      mimeType: asset.mimeType,
      source: {
        kind: "internal",
        storagePath: "redacted/unavailable/media/image/expired-external.png",
      },
      checksum: asset.checksum,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
    };
  }
  return asset;
}

/** Crash marker — sync OpenAI result lost before durable ingest (no auto-resubmit). */
export const PHASE_11A_PROVIDER_RESULT_NOT_DURABLY_INGESTED =
  "provider_result_not_durably_ingested" as const;
