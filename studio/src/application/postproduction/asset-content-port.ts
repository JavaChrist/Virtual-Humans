/**
 * Asset content port — binary bytes behind an internal asset id (VHS-125 fix).
 * Metadata stays in AssetRepository / ExportPackage; this port holds recoverable content.
 * Never stores signed URLs, tokens, or absolute local paths as durable truth.
 */

import { createHash } from "node:crypto";

export const DOWNLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const DOWNLOAD_ALLOWED_MIME = new Set([
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type AssetContentPutInput = {
  assetId: string;
  workspaceId: string;
  projectId: string;
  mimeType: string;
  bytes: Uint8Array;
  /** Relative logical path marker only — never an absolute FS path. */
  storagePath?: string;
};

export type AssetContentGetResult = {
  assetId: string;
  workspaceId: string;
  projectId: string;
  mimeType: string;
  bytes: Uint8Array;
  sizeBytes: number;
  checksumSha256: string;
  storagePath?: string;
};

export type AssetContentPort = {
  readonly configured: true;
  put(input: AssetContentPutInput): Promise<void>;
  get(input: {
    assetId: string;
    workspaceId: string;
    projectId: string;
  }): Promise<AssetContentGetResult | null>;
};

/** Explicitly unconfigured — download must fail without fabricating media. */
export type UnconfiguredAssetContentPort = {
  readonly configured: false;
};

export type AssetContentBackend = AssetContentPort | UnconfiguredAssetContentPort;

export function createUnconfiguredAssetContentPort(): UnconfiguredAssetContentPort {
  return { configured: false };
}

export function isAssetContentConfigured(
  port: AssetContentBackend | null | undefined,
): port is AssetContentPort {
  return Boolean(port && port.configured === true);
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Tiny deterministic fake media marker — not a real playable production asset. */
export const SYNTHETIC_FAKE_MP4_MARKER = "VH-FAKE-MP4-V1" as const;

/**
 * Build a very small synthetic "mp4-like" buffer for local/fake tests only.
 * Clearly marked — never treat as a real provider result.
 */
export function buildSyntheticFakeMp4Bytes(seed = "default"): Uint8Array {
  const marker = Buffer.from(`${SYNTHETIC_FAKE_MP4_MARKER}:${seed}`, "utf8");
  // Minimal box-like header (size + 'ftyp') + marker payload.
  const header = Uint8Array.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x01,
    0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x31,
  ]);
  const out = new Uint8Array(header.length + marker.length);
  out.set(header, 0);
  out.set(marker, header.length);
  return out;
}

export function createMemoryAssetContentPort(): AssetContentPort {
  const store = new Map<string, AssetContentGetResult>();

  function key(workspaceId: string, projectId: string, assetId: string): string {
    return `${workspaceId}:${projectId}:${assetId}`;
  }

  return {
    configured: true,
    async put(input) {
      if (!input.assetId?.trim()) throw new Error("assetId requis.");
      if (!DOWNLOAD_ALLOWED_MIME.has(input.mimeType)) {
        throw new Error("MIME non autorisé pour le contenu d'asset.");
      }
      if (input.bytes.byteLength === 0) throw new Error("Contenu vide interdit.");
      if (input.bytes.byteLength > DOWNLOAD_MAX_BYTES) {
        throw new Error("Contenu trop volumineux.");
      }
      if (input.storagePath && (input.storagePath.includes("..") || input.storagePath.includes("\\"))) {
        throw new Error("storagePath invalide.");
      }
      const checksumSha256 = sha256Hex(input.bytes);
      store.set(key(input.workspaceId, input.projectId, input.assetId), {
        assetId: input.assetId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        mimeType: input.mimeType,
        bytes: input.bytes.slice(),
        sizeBytes: input.bytes.byteLength,
        checksumSha256,
        storagePath: input.storagePath,
      });
    },
    async get(input) {
      return store.get(key(input.workspaceId, input.projectId, input.assetId)) ?? null;
    },
  };
}
