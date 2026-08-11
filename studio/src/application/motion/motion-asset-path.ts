/**
 * Deterministic private Storage paths for Motion Transfer (MT-005).
 * Reuses bucket director-final-assets — no new bucket.
 *
 * Pattern (5 segments):
 * `{workspaceId}/{projectId}/motion/{roleSegment}/{assetId}.{ext}`
 *
 * Distinct from Director final 4-seg builder (merge/export).
 */

import {
  MOTION_ASSET_ROLE_POLICIES,
  MOTION_STORAGE_PATH_SEGMENT,
  assertMotionAssetMimeAllowed,
  type MotionAssetRole,
} from "@/domain/motion/persistence";

export const MOTION_ASSETS_BUCKET = "director-final-assets" as const;

/** Soft ceiling aligned with director-final-assets bucket (50 MiB). */
export const MOTION_ASSET_MAX_BYTES = 50 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIME_TO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const ROLE_SEGMENTS = new Set(Object.values(MOTION_STORAGE_PATH_SEGMENT));

export function isMotionPathUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function extensionForMotionMime(mimeType: string): string | null {
  return MIME_TO_EXT[mimeType] ?? null;
}

export type MotionAssetPathInput = {
  workspaceId: string;
  projectId: string;
  role: MotionAssetRole;
  /** Server-generated asset UUID — never a user filename. */
  assetId: string;
  mimeType: string;
};

/**
 * Build a private Storage path for a Motion asset role.
 */
export function buildMotionAssetStoragePath(input: MotionAssetPathInput): string {
  const workspaceId = input.workspaceId.trim();
  const projectId = input.projectId.trim();
  const assetId = input.assetId.trim();
  for (const [label, value] of [
    ["workspaceId", workspaceId],
    ["projectId", projectId],
    ["assetId", assetId],
  ] as const) {
    if (!isMotionPathUuid(value)) {
      throw new Error(`${label} invalide pour le chemin Motion Storage.`);
    }
  }
  assertMotionAssetMimeAllowed(input.role, input.mimeType);
  const ext = extensionForMotionMime(input.mimeType);
  if (!ext) {
    throw new Error("MIME non autorisé pour le chemin Motion Storage.");
  }
  const roleSegment = MOTION_STORAGE_PATH_SEGMENT[input.role];
  const path = `${workspaceId}/${projectId}/motion/${roleSegment}/${assetId}.${ext}`;
  assertSafeMotionStoragePath(path, { workspaceId, projectId });
  return path;
}

export function assertSafeMotionStoragePath(
  storagePath: string,
  scope: { workspaceId: string; projectId: string },
): void {
  if (!storagePath || storagePath.includes("..") || storagePath.includes("\\")) {
    throw new Error("motion storagePath invalide.");
  }
  if (storagePath.startsWith("/") || storagePath.includes("//")) {
    throw new Error("motion storagePath invalide.");
  }
  // Reject raw user filenames / separators in segments
  if (/[\s<>:"|?*]/.test(storagePath)) {
    throw new Error("motion storagePath invalide.");
  }
  const parts = storagePath.split("/");
  if (parts.length !== 5) {
    throw new Error("motion storagePath invalide.");
  }
  const [ws, proj, motionLit, roleSeg, file] = parts;
  if (ws !== scope.workspaceId || proj !== scope.projectId) {
    throw new Error("motion storagePath hors workspace/projet.");
  }
  if (motionLit !== "motion") {
    throw new Error("motion storagePath invalide.");
  }
  if (!ROLE_SEGMENTS.has(roleSeg as (typeof MOTION_STORAGE_PATH_SEGMENT)[MotionAssetRole])) {
    throw new Error("motion storagePath role invalide.");
  }
  const dot = file.lastIndexOf(".");
  if (dot <= 0) throw new Error("motion storagePath invalide.");
  const idPart = file.slice(0, dot);
  const ext = file.slice(dot + 1).toLowerCase();
  if (!isMotionPathUuid(idPart)) throw new Error("motion storagePath invalide.");
  if (!Object.values(MIME_TO_EXT).includes(ext)) {
    throw new Error("motion storagePath invalide.");
  }
}

/** Infer role from a validated motion storage path. */
export function motionRoleFromStoragePath(storagePath: string): MotionAssetRole | null {
  const parts = storagePath.split("/");
  if (parts.length !== 5 || parts[2] !== "motion") return null;
  const seg = parts[3]!;
  for (const [role, segment] of Object.entries(MOTION_STORAGE_PATH_SEGMENT) as Array<
    [MotionAssetRole, string]
  >) {
    if (segment === seg) return role;
  }
  return null;
}

export function dbKindForMotionRole(
  role: MotionAssetRole,
  mimeType?: string,
): "image" | "video" {
  if (role === "motion_qc_evidence" && mimeType) {
    return mimeType.startsWith("video/") ? "video" : "image";
  }
  return MOTION_ASSET_ROLE_POLICIES[role].dbKind;
}
