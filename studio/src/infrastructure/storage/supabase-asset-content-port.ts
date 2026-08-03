/**
 * Durable AssetContentPort backed by private Supabase Storage (VHS-127 / Porte 1).
 * Reuses an injected server Supabase client (service_role). Never persists signed URLs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DOWNLOAD_MAX_BYTES,
  sha256Hex,
  type AssetContentGetInput,
  type AssetContentGetResult,
  type AssetContentPort,
  type AssetContentPutInput,
} from "@/application/postproduction/asset-content-port";
import {
  DIRECTOR_FINAL_ASSETS_BUCKET,
  assertDirectorMimeAllowed,
  assertSafeDirectorStoragePath,
  buildDirectorFinalAssetStoragePath,
  isDirectorAssetUuid,
} from "@/application/postproduction/director-final-asset-path";

export type CreateSupabaseStorageAssetContentPortOptions = {
  /** Injected server client — typically service_role. Never log its key. */
  client: SupabaseClient;
  bucket?: string;
};

function resolvePutPath(input: AssetContentPutInput): string {
  if (!isDirectorAssetUuid(input.assetId)) {
    throw new Error("assetId invalide pour le contenu d'asset.");
  }
  if (!isDirectorAssetUuid(input.workspaceId) || !isDirectorAssetUuid(input.projectId)) {
    throw new Error("workspace/projet invalide pour le contenu d'asset.");
  }
  assertDirectorMimeAllowed(input.mimeType);
  if (input.bytes.byteLength === 0) throw new Error("Contenu vide interdit.");
  if (input.bytes.byteLength > DOWNLOAD_MAX_BYTES) {
    throw new Error("Contenu trop volumineux.");
  }

  if (input.storagePath) {
    assertSafeDirectorStoragePath(input.storagePath, {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    });
    if (!input.storagePath.includes(`/${input.assetId}.`)) {
      throw new Error("storagePath incohérent avec assetId.");
    }
    return input.storagePath;
  }

  const containerId = input.containerId?.trim();
  if (!containerId || !isDirectorAssetUuid(containerId)) {
    throw new Error("containerId requis pour le stockage durable.");
  }
  return buildDirectorFinalAssetStoragePath({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    containerId,
    assetId: input.assetId,
    mimeType: input.mimeType,
  });
}

function resolveGetPath(input: AssetContentGetInput): string | null {
  if (!isDirectorAssetUuid(input.assetId)) return null;
  if (!isDirectorAssetUuid(input.workspaceId) || !isDirectorAssetUuid(input.projectId)) {
    return null;
  }
  if (!input.storagePath) return null;
  try {
    assertSafeDirectorStoragePath(input.storagePath, {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    });
  } catch {
    return null;
  }
  if (!input.storagePath.includes(`/${input.assetId}.`)) return null;
  return input.storagePath;
}

export function createSupabaseStorageAssetContentPort(
  options: CreateSupabaseStorageAssetContentPortOptions,
): AssetContentPort {
  const bucket = options.bucket ?? DIRECTOR_FINAL_ASSETS_BUCKET;
  const client = options.client;

  return {
    configured: true,

    async put(input) {
      const path = resolvePutPath(input);
      const checksum = sha256Hex(input.bytes);
      const body = Buffer.from(input.bytes);

      const existing = await client.storage.from(bucket).download(path);
      if (!existing.error && existing.data) {
        const prev = new Uint8Array(await existing.data.arrayBuffer());
        const prevChecksum = sha256Hex(prev);
        if (prevChecksum === checksum && prev.byteLength === input.bytes.byteLength) {
          return; // idempotent retry
        }
        throw new Error("Collision Storage : contenu différent sous la même identité.");
      }

      const { error } = await client.storage.from(bucket).upload(path, body, {
        contentType: input.mimeType,
        upsert: false,
      });

      if (error) {
        // Race: another writer succeeded with same bytes — treat as idempotent if match.
        const again = await client.storage.from(bucket).download(path);
        if (!again.error && again.data) {
          const prev = new Uint8Array(await again.data.arrayBuffer());
          if (sha256Hex(prev) === checksum) return;
        }
        throw new Error("Échec d'écriture Storage (détails non exposés).");
      }
    },

    async get(input): Promise<AssetContentGetResult | null> {
      const path = resolveGetPath(input);
      if (!path) return null;

      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data) return null;

      const bytes = new Uint8Array(await data.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > DOWNLOAD_MAX_BYTES) return null;

      // Prefer Content-Type from object metadata when available; fall back via extension.
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      const mimeFromExt: Record<string, string> = {
        mp4: "video/mp4",
        webm: "video/webm",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
      };
      const mimeType = mimeFromExt[ext];
      if (!mimeType) return null;

      return {
        assetId: input.assetId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        mimeType,
        bytes,
        sizeBytes: bytes.byteLength,
        checksumSha256: sha256Hex(bytes),
        storagePath: path,
      };
    },
  };
}
