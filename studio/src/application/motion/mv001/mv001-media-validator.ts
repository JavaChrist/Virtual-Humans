/**
 * MT-013F — Offline media validator (no network, no upload).
 * Validates manifest metadata; optional filesystem checks only when entries provided.
 * Does not read media during prep if no paths are supplied.
 */

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  MV001_DURATION_SECONDS,
  MV001_PRIVACY_EXPIRES_AT,
} from "./mv001-benchmark-profile";
import {
  type Mv001MediaEntry,
  type Mv001MediaManifest,
  allManifestEntriesValidated,
  createMv001MediaManifest,
  manifestHasRequiredRoles,
} from "./mv001-media-manifest";

/** Documented duration tolerance for prep (±0.25s around target duration). */
export const MV001_DURATION_TOLERANCE_SECONDS = 0.25 as const;

const VIDEO_MIME = new Set(["video/mp4"]);
const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export type Mv001MediaValidateResult = {
  ok: boolean;
  mediaRead: boolean;
  issues: string[];
  manifest: Mv001MediaManifest;
};

export function validateMv001MediaEntryMetadata(entry: Mv001MediaEntry): string[] {
  const issues: string[] = [];
  if (entry.role === "motion_source_video") {
    if (!VIDEO_MIME.has(entry.mimeType)) issues.push("source_mime_forbidden");
    if (entry.durationSeconds == null) issues.push("source_duration_missing");
    else if (
      Math.abs(entry.durationSeconds - MV001_DURATION_SECONDS) >
      MV001_DURATION_TOLERANCE_SECONDS
    ) {
      issues.push("source_duration_out_of_tolerance");
    }
    if (entry.fps == null || entry.fps <= 0) issues.push("source_fps_missing");
  }
  if (entry.role === "motion_identity_reference") {
    if (!IMAGE_MIME.has(entry.mimeType)) issues.push("identity_mime_forbidden");
    if (entry.durationSeconds != null) issues.push("identity_must_not_have_duration");
  }
  if (!/^[a-f0-9]{64}$/i.test(entry.checksumSha256)) {
    issues.push("checksum_invalid");
  }
  if (entry.checksumSha256.trim() === "") issues.push("checksum_missing");
  if (entry.sizeBytes <= 0) issues.push("size_invalid");
  if (entry.width <= 0 || entry.height <= 0) issues.push("dimensions_invalid");
  const exp = Date.parse(entry.expiresAt);
  if (!Number.isFinite(exp)) issues.push("entry_expires_invalid");
  return issues;
}

/**
 * Validate a prepared manifest without reading files (metadata-only).
 */
export function validateMv001MediaManifestOffline(
  manifest: Mv001MediaManifest,
): Mv001MediaValidateResult {
  const issues: string[] = [];
  if (manifest.benchmarkId !== "MV-001") issues.push("manifest_wrong_benchmark");
  if (!manifestHasRequiredRoles(manifest)) issues.push("media_roles_incomplete");
  for (const e of manifest.entries) {
    issues.push(...validateMv001MediaEntryMetadata(e).map((i) => `${e.role}:${i}`));
  }
  const ok = issues.length === 0 && allManifestEntriesValidated(manifest);
  return { ok, mediaRead: false, issues, manifest };
}

/**
 * Optional local file check — only when explicitly invoked with a private root.
 * Never uploads. Never logs absolute paths containing user homes.
 */
export function verifyMv001LocalFileChecksum(input: {
  privateRootDir: string;
  relativePath: string;
  expectedSha256: string;
}): { ok: boolean; issue?: string } {
  if (input.relativePath.includes("..") || input.relativePath.startsWith("/")) {
    return { ok: false, issue: "path_unsafe" };
  }
  try {
    const full = join(input.privateRootDir, input.relativePath);
    const st = statSync(full);
    if (!st.isFile() || st.size <= 0) return { ok: false, issue: "file_unreadable" };
    const buf = readFileSync(full);
    const hash = createHash("sha256").update(buf).digest("hex");
    if (hash.toLowerCase() !== input.expectedSha256.toLowerCase()) {
      return { ok: false, issue: "checksum_mismatch" };
    }
    return { ok: true };
  } catch {
    return { ok: false, issue: "file_unreadable" };
  }
}

/** Build a pending skeleton for operator fill-in (no real media). */
export function buildPendingMv001MediaSkeleton(createdAt: string): Mv001MediaManifest {
  return createMv001MediaManifest({
    createdAt,
    entries: [
      {
        role: "motion_source_video",
        localRelativePath: "mv001/source.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1,
        durationSeconds: MV001_DURATION_SECONDS,
        width: 1,
        height: 1,
        fps: 24,
        checksumSha256: "0".repeat(64),
        provenance: "pending-operator",
        consentReferenceId: "pending",
        expiresAt: MV001_PRIVACY_EXPIRES_AT,
        validationStatus: "pending",
      },
      {
        role: "motion_identity_reference",
        localRelativePath: "mv001/identity.png",
        mimeType: "image/png",
        sizeBytes: 1,
        durationSeconds: null,
        width: 1,
        height: 1,
        fps: null,
        checksumSha256: "0".repeat(64),
        provenance: "pending-operator",
        consentReferenceId: "pending",
        expiresAt: MV001_PRIVACY_EXPIRES_AT,
        validationStatus: "pending",
      },
    ],
  });
}
