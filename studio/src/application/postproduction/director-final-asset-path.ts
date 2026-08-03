/**
 * Deterministic Storage path builder for Director final media (VHS-127 / Porte 1).
 * Segments come only from validated server-side identifiers — never from client input.
 */

import { DOWNLOAD_ALLOWED_MIME } from "./asset-content-port";

export const DIRECTOR_FINAL_ASSETS_BUCKET = "director-final-assets" as const;

/** Same ceiling as DOWNLOAD_MAX_BYTES — kept explicit for Storage bucket config. */
export const DIRECTOR_FINAL_ASSET_MAX_BYTES = 50 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIME_TO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function isDirectorAssetUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function extensionForDirectorMime(mimeType: string): string | null {
  return MIME_TO_EXT[mimeType] ?? null;
}

export function assertDirectorMimeAllowed(mimeType: string): void {
  if (!DOWNLOAD_ALLOWED_MIME.has(mimeType) || !extensionForDirectorMime(mimeType)) {
    throw new Error("MIME non autorisé pour le contenu d'asset.");
  }
}

export type DirectorFinalAssetPathInput = {
  workspaceId: string;
  projectId: string;
  /** Production run id, merge plan id, or export package id — server-generated UUID. */
  containerId: string;
  assetId: string;
  mimeType: string;
};

/**
 * `{workspaceId}/{projectId}/{containerId}/{assetId}.{ext}`
 */
export function buildDirectorFinalAssetStoragePath(
  input: DirectorFinalAssetPathInput,
): string {
  const workspaceId = input.workspaceId.trim();
  const projectId = input.projectId.trim();
  const containerId = input.containerId.trim();
  const assetId = input.assetId.trim();
  for (const [label, value] of [
    ["workspaceId", workspaceId],
    ["projectId", projectId],
    ["containerId", containerId],
    ["assetId", assetId],
  ] as const) {
    if (!isDirectorAssetUuid(value)) {
      throw new Error(`${label} invalide pour le chemin Storage.`);
    }
  }
  assertDirectorMimeAllowed(input.mimeType);
  const ext = extensionForDirectorMime(input.mimeType)!;
  const path = `${workspaceId}/${projectId}/${containerId}/${assetId}.${ext}`;
  assertSafeDirectorStoragePath(path, {
    workspaceId,
    projectId,
  });
  return path;
}

export function assertSafeDirectorStoragePath(
  storagePath: string,
  scope: { workspaceId: string; projectId: string },
): void {
  if (!storagePath || storagePath.includes("..") || storagePath.includes("\\")) {
    throw new Error("storagePath invalide.");
  }
  if (storagePath.startsWith("/") || storagePath.includes("//")) {
    throw new Error("storagePath invalide.");
  }
  const parts = storagePath.split("/");
  if (parts.length !== 4) {
    throw new Error("storagePath invalide.");
  }
  const [ws, proj, container, file] = parts;
  if (ws !== scope.workspaceId || proj !== scope.projectId) {
    throw new Error("storagePath hors workspace/projet.");
  }
  if (!isDirectorAssetUuid(container)) {
    throw new Error("storagePath invalide.");
  }
  const dot = file.lastIndexOf(".");
  if (dot <= 0) throw new Error("storagePath invalide.");
  const idPart = file.slice(0, dot);
  const ext = file.slice(dot + 1).toLowerCase();
  if (!isDirectorAssetUuid(idPart)) throw new Error("storagePath invalide.");
  if (!Object.values(MIME_TO_EXT).includes(ext)) {
    throw new Error("storagePath invalide.");
  }
}
