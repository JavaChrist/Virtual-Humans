/**
 * Phase 11C — future Voice output ingest path. No Storage write in this phase.
 */
import { createHash } from "node:crypto";
import { PHASE_11C_PROJECT_ID, PHASE_11C_SCENE_ID, PHASE_11C_WORKSPACE_ID } from "./phase-11c-voice-allowlist";

export const PHASE_11C_VOICE_OUTPUT_MIME_ALLOWLIST = ["audio/mpeg"] as const;
export const PHASE_11C_VOICE_MAX_BYTES = 5 * 1024 * 1024;
export const PHASE_11C_VOICE_BUCKET = "production-private" as const;

export function buildPhase11CVoiceOutputStoragePath(outputAssetId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(outputAssetId)) {
    throw new Error("Phase 11C ingest: output asset id must be a UUID.");
  }
  return `${PHASE_11C_WORKSPACE_ID}/${PHASE_11C_PROJECT_ID}/${PHASE_11C_SCENE_ID}/audio/voice/${outputAssetId}.mp3`;
}

export function assertPhase11CVoiceOutputMime(mime: string): void {
  if (!PHASE_11C_VOICE_OUTPUT_MIME_ALLOWLIST.includes(mime as (typeof PHASE_11C_VOICE_OUTPUT_MIME_ALLOWLIST)[number])) {
    throw new Error("Phase 11C ingest: MIME not allowlisted.");
  }
}

export function assertPhase11CVoiceOutputSize(bytes: number): void {
  if (bytes <= 0 || bytes > PHASE_11C_VOICE_MAX_BYTES) {
    throw new Error("Phase 11C ingest: size out of bounds.");
  }
}

export function checksumPhase11CVoiceBuffer(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertPhase11CVoiceNoDataUrl(value: unknown): void {
  const blob = JSON.stringify(value);
  if (/data:[^;]+;base64,/i.test(blob) || /base64,/i.test(blob)) {
    throw new Error("Phase 11C ingest: dataUrl/base64 must never be persisted.");
  }
}

export function assertPhase11CVoiceNoOverwrite(existingObject: boolean): void {
  if (existingObject) {
    throw new Error("Phase 11C ingest: overwrite forbidden.");
  }
}

export function createPhase11CVoiceOutputProvenance(input: {
  scriptArtifactId: string;
  scriptRevision: number;
  segmentId: string;
  textSha256: string;
  voiceFingerprint: string;
  outputAssetId: string;
  i2vVideoAssetId: string;
}): Record<string, unknown> {
  const next = {
    mediaRole: "voice_tts_output_audio",
    scriptArtifactId: input.scriptArtifactId,
    scriptRevision: input.scriptRevision,
    segmentId: input.segmentId,
    textSha256: input.textSha256,
    voiceFingerprint: input.voiceFingerprint,
    outputAssetId: input.outputAssetId,
    i2vVideoAssetId: input.i2vVideoAssetId,
    i2vVideoRole: "future_lipsync_context_only",
    bucket: PHASE_11C_VOICE_BUCKET,
    active: false,
    published: false,
    lipsyncRequested: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
    lifecycle: "pending_review",
  };
  assertPhase11CVoiceNoDataUrl(next);
  return next;
}

export function simulatePhase11CVoiceIngest(input: {
  outputAssetId: string;
  bytes: Uint8Array;
  mimeType: string;
}): {
  storagePath: string;
  mimeType: string;
  byteLength: number;
  checksum: string;
  active: false;
  persistedToProduction: false;
} {
  assertPhase11CVoiceOutputMime(input.mimeType);
  assertPhase11CVoiceOutputSize(input.bytes.byteLength);
  assertPhase11CVoiceNoOverwrite(false);
  return {
    storagePath: buildPhase11CVoiceOutputStoragePath(input.outputAssetId),
    mimeType: input.mimeType,
    byteLength: input.bytes.byteLength,
    checksum: checksumPhase11CVoiceBuffer(input.bytes),
    active: false,
    persistedToProduction: false,
  };
}
