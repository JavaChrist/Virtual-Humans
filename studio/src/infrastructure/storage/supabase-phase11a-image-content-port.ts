/**
 * Supabase Storage port for Phase 11A image paths (5 segments).
 * Bucket: director-final-assets · no public URL · no upsert overwrite of divergent bytes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DOWNLOAD_MAX_BYTES,
  sha256Hex,
  type AssetContentGetResult,
  type AssetContentPort,
} from "@/application/postproduction/asset-content-port";
import { DIRECTOR_FINAL_ASSETS_BUCKET } from "@/application/postproduction/director-final-asset-path";
import { assertSafePhase11AImageStoragePath } from "@/application/production/phase-11a-image-storage-ingest";
import { buildPhase11AImageStoragePath } from "@/application/production/phase-11a-openai-image-allowlist";

export function createSupabasePhase11AImageContentPort(options: {
  client: SupabaseClient;
  bucket?: string;
}): AssetContentPort {
  const bucket = options.bucket ?? DIRECTOR_FINAL_ASSETS_BUCKET;
  const client = options.client;

  return {
    configured: true,

    async put(input) {
      const path =
        input.storagePath ??
        buildPhase11AImageStoragePath({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          assetId: input.assetId,
        });
      assertSafePhase11AImageStoragePath(path, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        assetId: input.assetId,
      });
      if (input.mimeType !== "image/png") {
        throw new Error("Phase 11A Storage: MIME image/png only.");
      }
      if (input.bytes.byteLength === 0 || input.bytes.byteLength > DOWNLOAD_MAX_BYTES) {
        throw new Error("Phase 11A Storage: byte size out of bounds.");
      }
      const checksum = sha256Hex(input.bytes);
      const body = Buffer.from(input.bytes);

      const existing = await client.storage.from(bucket).download(path);
      if (!existing.error && existing.data) {
        const prev = new Uint8Array(await existing.data.arrayBuffer());
        if (sha256Hex(prev) === checksum && prev.byteLength === input.bytes.byteLength) {
          return;
        }
        throw new Error("Collision Storage : contenu différent sous la même identité.");
      }

      const { error } = await client.storage.from(bucket).upload(path, body, {
        contentType: "image/png",
        upsert: false,
      });
      if (error) {
        const again = await client.storage.from(bucket).download(path);
        if (!again.error && again.data) {
          const prev = new Uint8Array(await again.data.arrayBuffer());
          if (sha256Hex(prev) === checksum) return;
        }
        throw new Error("Échec d'écriture Storage Phase 11A (détails non exposés).");
      }
    },

    async get(input): Promise<AssetContentGetResult | null> {
      const path = input.storagePath;
      if (!path) return null;
      try {
        assertSafePhase11AImageStoragePath(path, {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          assetId: input.assetId,
        });
      } catch {
        return null;
      }
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data) return null;
      const bytes = new Uint8Array(await data.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > DOWNLOAD_MAX_BYTES) return null;
      return {
        assetId: input.assetId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        mimeType: "image/png",
        bytes,
        sizeBytes: bytes.byteLength,
        checksumSha256: sha256Hex(bytes),
        storagePath: path,
      };
    },
  };
}
