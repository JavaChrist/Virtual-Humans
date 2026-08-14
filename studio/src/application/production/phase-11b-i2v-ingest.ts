/**
 * Phase 11B — future I2V output ingest path. No Storage write in this phase.
 */
import { PHASE_11B_PROJECT_ID, PHASE_11B_WORKSPACE_ID } from "./phase-11b-i2v-allowlist";

export const PHASE_11B_I2V_OUTPUT_MIME_ALLOWLIST = ["video/mp4", "video/webm"] as const;
export const PHASE_11B_I2V_MAX_BYTES = 80 * 1024 * 1024;

export function buildPhase11BI2vOutputStoragePath(outputAssetId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(outputAssetId)) {
    throw new Error("Phase 11B ingest: output asset id must be a UUID.");
  }
  return `${PHASE_11B_WORKSPACE_ID}/${PHASE_11B_PROJECT_ID}/media/video/i2v/${outputAssetId}.mp4`;
}

export function assertPhase11BI2vOutputMime(mime: string): void {
  if (!PHASE_11B_I2V_OUTPUT_MIME_ALLOWLIST.includes(mime as (typeof PHASE_11B_I2V_OUTPUT_MIME_ALLOWLIST)[number])) {
    throw new Error("Phase 11B ingest: MIME not allowlisted.");
  }
}

export function assertPhase11BI2vOutputSize(bytes: number): void {
  if (bytes <= 0 || bytes > PHASE_11B_I2V_MAX_BYTES) {
    throw new Error("Phase 11B ingest: size out of bounds.");
  }
}

export const PHASE_11B_I2V_RESULT_HOST_ALLOWLIST = ["fal.media"] as const;

export function assertPhase11BI2vFetchHostAllowlist(url: string): void {
  if (/https?:\/\/(localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(url)) {
    throw new Error("Phase 11B ingest: hostile/private host rejected.");
  }
  if (!/^https:\/\//i.test(url)) {
    throw new Error("Phase 11B ingest: only https result URLs.");
  }
}

export function assertPhase11BI2vResultHostAllowlist(url: string): void {
  assertPhase11BI2vFetchHostAllowlist(url);
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error("Phase 11B ingest: result URL is not parseable.");
  }
  const allowed = host === "fal.media" || host.endsWith(".fal.media");
  if (!allowed) {
    throw new Error("Phase 11B ingest: result host is not allowlisted.");
  }
}

export function createPhase11BI2vOutputProvenance(input: {
  sourceAssetId: string;
  sourceChecksum: string;
  outputAssetId: string;
}): Record<string, unknown> {
  const next = {
    mediaRole: "i2v_output_video",
    parentAssetId: input.sourceAssetId,
    parentChecksum: input.sourceChecksum,
    outputAssetId: input.outputAssetId,
    active: false,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
    lifecycle: "pending_review",
  };
  if (/https?:\/\//i.test(JSON.stringify(next))) {
    throw new Error("Phase 11B ingest provenance must not contain URLs.");
  }
  return next;
}

export function assertPhase11BI2vNoOverwrite(existingObject: boolean): void {
  if (existingObject) {
    throw new Error("Phase 11B ingest: overwrite forbidden.");
  }
}
