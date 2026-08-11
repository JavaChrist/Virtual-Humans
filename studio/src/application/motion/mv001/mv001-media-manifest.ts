/**
 * MT-013F — Mv001MediaManifest contract (no media bytes).
 * Paths must be local-private / opaque — never commit media or signed URLs.
 */

import { deepFreeze } from "@/domain/motion/freeze";
import { MV001_BENCHMARK_ID, MV001_PRIVACY_EXPIRES_AT } from "./mv001-benchmark-profile";

export const MV001_MEDIA_MANIFEST_SCHEMA_VERSION = "mt013f-mv001-media-1.0.0" as const;

export const MV001_MEDIA_ROLES = [
  "motion_source_video",
  "motion_identity_reference",
] as const;
export type Mv001MediaRole = (typeof MV001_MEDIA_ROLES)[number];

export type Mv001MediaValidationStatus =
  | "pending"
  | "validated"
  | "invalid"
  | "missing";

export type Mv001MediaEntry = {
  role: Mv001MediaRole;
  /** Relative opaque path under private local root (never absolute user home). */
  localRelativePath: string;
  mimeType: string;
  sizeBytes: number;
  /** Required for video; null for identity image. */
  durationSeconds: number | null;
  width: number;
  height: number;
  fps: number | null;
  checksumSha256: string;
  provenance: string;
  consentReferenceId: string;
  expiresAt: string;
  validationStatus: Mv001MediaValidationStatus;
};

export type Mv001MediaManifest = {
  schemaVersion: typeof MV001_MEDIA_MANIFEST_SCHEMA_VERSION;
  benchmarkId: typeof MV001_BENCHMARK_ID;
  entries: readonly Mv001MediaEntry[];
  createdAt: string;
};

const SHA256_RE = /^[a-f0-9]{64}$/i;
const REL_PATH_RE = /^[a-zA-Z0-9._/-]+$/;

const FORBIDDEN_MANIFEST_PATTERNS = [
  /data:[^;]+;base64,/i,
  /https?:\/\//i,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i, // JWT-ish
  /postgresql:\/\//i,
  /[A-Za-z]:\\+Users\\+/i, // raw or JSON-escaped Windows user paths
  /\/home\/[^/]+\//i,
  /BEGIN (RSA )?PRIVATE KEY/i,
];

export function assertMv001ManifestRedacted(value: unknown): void {
  const s = JSON.stringify(value);
  for (const re of FORBIDDEN_MANIFEST_PATTERNS) {
    if (re.test(s)) {
      throw new Error("Mv001MediaManifest contains forbidden sensitive pattern.");
    }
  }
}

export function createEmptyMv001MediaManifest(createdAt: string): Readonly<Mv001MediaManifest> {
  return deepFreeze({
    schemaVersion: MV001_MEDIA_MANIFEST_SCHEMA_VERSION,
    benchmarkId: MV001_BENCHMARK_ID,
    entries: [],
    createdAt,
  });
}

export function createMv001MediaManifest(input: {
  createdAt: string;
  entries: Mv001MediaEntry[];
}): Readonly<Mv001MediaManifest> {
  const roles = new Set<string>();
  for (const e of input.entries) {
    if (!MV001_MEDIA_ROLES.includes(e.role)) {
      throw new Error(`invalid media role: ${e.role}`);
    }
    if (roles.has(e.role)) throw new Error(`duplicate media role: ${e.role}`);
    roles.add(e.role);
    if (!REL_PATH_RE.test(e.localRelativePath) || e.localRelativePath.includes("..")) {
      throw new Error("invalid localRelativePath");
    }
    if (!SHA256_RE.test(e.checksumSha256)) {
      throw new Error("invalid checksumSha256");
    }
    if (e.sizeBytes <= 0) throw new Error("invalid sizeBytes");
    if (e.width <= 0 || e.height <= 0) throw new Error("invalid dimensions");
  }
  const manifest = deepFreeze({
    schemaVersion: MV001_MEDIA_MANIFEST_SCHEMA_VERSION,
    benchmarkId: MV001_BENCHMARK_ID,
    entries: input.entries.map((e) =>
      deepFreeze({
        ...e,
        expiresAt: e.expiresAt || MV001_PRIVACY_EXPIRES_AT,
      }),
    ),
    createdAt: input.createdAt,
  });
  assertMv001ManifestRedacted(manifest);
  return manifest;
}

export function manifestHasRequiredRoles(manifest: Mv001MediaManifest): boolean {
  const roles = new Set(manifest.entries.map((e) => e.role));
  return (
    roles.has("motion_source_video") && roles.has("motion_identity_reference")
  );
}

export function allManifestEntriesValidated(manifest: Mv001MediaManifest): boolean {
  return (
    manifestHasRequiredRoles(manifest) &&
    manifest.entries.every((e) => e.validationStatus === "validated")
  );
}
