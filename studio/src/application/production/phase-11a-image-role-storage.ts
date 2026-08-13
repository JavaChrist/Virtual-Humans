/**
 * Phase 11A — role-specific private Storage paths (provider vs composed).
 * Historical 5-segment path stays for the rejected smoke asset. New writes use 6 segments.
 */

import { isDirectorAssetUuid } from "@/application/postproduction/director-final-asset-path";
import { MV001_MOTION_PROJECT_ID } from "./phase-11a-motion-isolation";

export const PHASE_11A_IMAGE_STORAGE_ROLES = ["provider", "composed"] as const;
export type Phase11AImageStorageRole = (typeof PHASE_11A_IMAGE_STORAGE_ROLES)[number];

export function buildPhase11ARoleImageStoragePath(input: {
  workspaceId: string;
  projectId: string;
  assetId: string;
  role: Phase11AImageStorageRole;
}): string {
  const workspaceId = input.workspaceId.trim();
  const projectId = input.projectId.trim();
  const assetId = input.assetId.trim();
  if (!workspaceId || !projectId || !assetId) {
    throw new Error("Phase 11A role storage path requires workspace/project/asset ids.");
  }
  if (
    workspaceId.includes("..") ||
    projectId.includes("..") ||
    assetId.includes("..") ||
    workspaceId.includes("/") ||
    projectId.includes("/") ||
    assetId.includes("/")
  ) {
    throw new Error("Phase 11A role storage path segments invalid.");
  }
  if (projectId === MV001_MOTION_PROJECT_ID) {
    throw new Error("Phase 11A storage path must not use Motion project.");
  }
  if (!isDirectorAssetUuid(assetId)) {
    throw new Error("Phase 11A role storage path assetId must be a UUID.");
  }
  return `${workspaceId}/${projectId}/media/image/${input.role}/${assetId}.png`;
}

export function assertSafePhase11ARoleImageStoragePath(
  storagePath: string,
  scope: {
    workspaceId: string;
    projectId: string;
    assetId: string;
    role: Phase11AImageStorageRole;
  },
): void {
  if (!storagePath || storagePath.includes("..") || storagePath.includes("\\")) {
    throw new Error("Phase 11A role storagePath invalide.");
  }
  if (storagePath.startsWith("/") || storagePath.includes("//")) {
    throw new Error("Phase 11A role storagePath invalide.");
  }
  const parts = storagePath.split("/");
  if (parts.length !== 6) {
    throw new Error("Phase 11A role storagePath must be 6 segments.");
  }
  const [ws, proj, mediaLit, imageLit, role, file] = parts;
  if (ws !== scope.workspaceId || proj !== scope.projectId) {
    throw new Error("Phase 11A role storagePath hors workspace/projet.");
  }
  if (proj === MV001_MOTION_PROJECT_ID) {
    throw new Error("Phase 11A storagePath must not use Motion project.");
  }
  if (mediaLit !== "media" || imageLit !== "image") {
    throw new Error("Phase 11A storagePath role must be media/image.");
  }
  if (role !== scope.role) {
    throw new Error("Phase 11A storagePath role mismatch.");
  }
  if (role !== "provider" && role !== "composed") {
    throw new Error("Phase 11A storagePath role must be provider|composed.");
  }
  if (!file.endsWith(".png")) {
    throw new Error("Phase 11A storagePath must end with .png.");
  }
  const idPart = file.slice(0, -4);
  if (!isDirectorAssetUuid(idPart) || idPart !== scope.assetId) {
    throw new Error("Phase 11A storagePath assetId mismatch.");
  }
}
