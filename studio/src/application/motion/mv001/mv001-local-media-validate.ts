/**
 * MT-013G — Local MV-001 media validation (Auth: LOCAL_MEDIA_VALIDATE_ONLY).
 * No network, no upload, no signed URLs, no Production writes.
 */

import { existsSync } from "node:fs";
import { deepFreeze } from "@/domain/motion/freeze";
import {
  MV001_BENCHMARK_ID,
  MV001_DURATION_SECONDS,
  MV001_PRIVACY_EXPIRES_AT,
} from "./mv001-benchmark-profile";
import {
  assertMv001ManifestRedacted,
  createMv001MediaManifest,
  type Mv001MediaManifest,
} from "./mv001-media-manifest";
import { MV001_DURATION_TOLERANCE_SECONDS } from "./mv001-media-validator";
import {
  probeLocalImageFile,
  probeLocalVideoFile,
  redactPathToRelativeRole,
} from "./mv001-local-media-probe";

export const MV001_LOCAL_VALIDATE_VERSION = "mt013g-local-media-1.0.0" as const;

/** Benchmark technical framing thresholds (doc 73_). */
export const MV001_MIN_VIDEO_SHORT_SIDE = 720 as const;
export const MV001_RECOMMENDED_VIDEO_SHORT_SIDE = 1080 as const;
export const MV001_TARGET_FPS = 24 as const;
export const MV001_FPS_TOLERANCE = 1 as const;
export const MV001_MIN_IDENTITY_SHORT_SIDE = 256 as const;

export type Mv001FramingAnalysis = {
  video: {
    shortSide: number;
    longSide: number;
    aspectRatio: string;
    orientation: "landscape" | "portrait" | "square";
    meetsMin720p: boolean;
    recommended1080p: boolean;
    fpsNear24: boolean | null;
    /** Semantic full-body / hands / feet — not auto-decidable offline. */
    fullBodySemantic: "requires_human_attestation";
  };
  identity: {
    shortSide: number;
    longSide: number;
    aspectRatio: string;
    meetsMinShortSide: boolean;
    faceBodySemantic: "requires_human_attestation";
  };
};

export type Mv001LocalMediaValidateInput = {
  sourceVideoPath: string;
  identityImagePath: string;
  nowIso: string;
  consentReferenceIdSource?: string;
  consentReferenceIdIdentity?: string;
};

export type Mv001LocalMediaValidateResult = {
  schemaVersion: typeof MV001_LOCAL_VALIDATE_VERSION;
  auth: "AUTH_MV001_LOCAL_MEDIA_VALIDATE_ONLY";
  verdict: "MEDIA_VALIDATED" | "MEDIA_INVALID" | "BLOCKED_SOURCE_PATHS_REQUIRED";
  mediaRead: boolean;
  mediaValidated: boolean;
  network: false;
  upload: false;
  providerCalled: false;
  issues: readonly string[];
  framing: Mv001FramingAnalysis | null;
  manifest: Mv001MediaManifest | null;
  /** Never absolute user paths — opaque only. */
  pathRefs: {
    source: "env:SOURCE_VIDEO_PATH" | "missing";
    identity: "env:IDENTITY_IMAGE_PATH" | "missing";
  };
};

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function aspect(w: number, h: number): string {
  const g = gcd(w, h);
  return `${Math.round(w / g)}:${Math.round(h / g)}`;
}

function orientation(w: number, h: number): "landscape" | "portrait" | "square" {
  if (w === h) return "square";
  return w > h ? "landscape" : "portrait";
}

function isPlaceholderPath(value: string | undefined): boolean {
  if (!value) return true;
  const t = value.trim();
  return t.length === 0 || t === "..." || t === "…" || t === "-" || t === "TODO";
}

/**
 * Validate local MV-001 media files and build a redacted manifest.
 */
export function validateMv001LocalMedia(
  input: Mv001LocalMediaValidateInput,
): Readonly<Mv001LocalMediaValidateResult> {
  const sourceMissing = isPlaceholderPath(input.sourceVideoPath);
  const identityMissing = isPlaceholderPath(input.identityImagePath);

  if (sourceMissing || identityMissing) {
    return deepFreeze({
      schemaVersion: MV001_LOCAL_VALIDATE_VERSION,
      auth: "AUTH_MV001_LOCAL_MEDIA_VALIDATE_ONLY",
      verdict: "BLOCKED_SOURCE_PATHS_REQUIRED",
      mediaRead: false,
      mediaValidated: false,
      network: false,
      upload: false,
      providerCalled: false,
      issues: [
        ...(sourceMissing ? ["source_path_missing_or_placeholder"] : []),
        ...(identityMissing ? ["identity_path_missing_or_placeholder"] : []),
      ],
      framing: null,
      manifest: null,
      pathRefs: {
        source: sourceMissing ? "missing" : "env:SOURCE_VIDEO_PATH",
        identity: identityMissing ? "missing" : "env:IDENTITY_IMAGE_PATH",
      },
    });
  }

  const issues: string[] = [];
  if (!existsSync(input.sourceVideoPath)) issues.push("source_file_absent");
  if (!existsSync(input.identityImagePath)) issues.push("identity_file_absent");
  if (issues.length) {
    return deepFreeze({
      schemaVersion: MV001_LOCAL_VALIDATE_VERSION,
      auth: "AUTH_MV001_LOCAL_MEDIA_VALIDATE_ONLY",
      verdict: "MEDIA_INVALID",
      mediaRead: false,
      mediaValidated: false,
      network: false,
      upload: false,
      providerCalled: false,
      issues,
      framing: null,
      manifest: null,
      pathRefs: {
        source: "env:SOURCE_VIDEO_PATH",
        identity: "env:IDENTITY_IMAGE_PATH",
      },
    });
  }

  let video;
  let image;
  try {
    video = probeLocalVideoFile(input.sourceVideoPath);
  } catch (e) {
    issues.push(`source_probe:${e instanceof Error ? e.message : "failed"}`);
  }
  try {
    image = probeLocalImageFile(input.identityImagePath);
  } catch (e) {
    issues.push(`identity_probe:${e instanceof Error ? e.message : "failed"}`);
  }

  if (!video || !image) {
    return deepFreeze({
      schemaVersion: MV001_LOCAL_VALIDATE_VERSION,
      auth: "AUTH_MV001_LOCAL_MEDIA_VALIDATE_ONLY",
      verdict: "MEDIA_INVALID",
      mediaRead: true,
      mediaValidated: false,
      network: false,
      upload: false,
      providerCalled: false,
      issues,
      framing: null,
      manifest: null,
      pathRefs: {
        source: "env:SOURCE_VIDEO_PATH",
        identity: "env:IDENTITY_IMAGE_PATH",
      },
    });
  }

  if (video.mimeType !== "video/mp4") issues.push("source_mime_forbidden");
  if (
    Math.abs(video.durationSeconds - MV001_DURATION_SECONDS) >
    MV001_DURATION_TOLERANCE_SECONDS
  ) {
    issues.push(
      `source_duration_out_of_tolerance:observed=${video.durationSeconds.toFixed(3)}`,
    );
  }
  if (video.fps == null || !(video.fps > 0)) issues.push("source_fps_missing");
  else if (Math.abs(video.fps - MV001_TARGET_FPS) > MV001_FPS_TOLERANCE) {
    issues.push(`source_fps_off_target:observed=${video.fps}`);
  }

  const vShort = Math.min(video.width, video.height);
  const vLong = Math.max(video.width, video.height);
  const iShort = Math.min(image.width, image.height);
  const iLong = Math.max(image.width, image.height);

  if (vShort < MV001_MIN_VIDEO_SHORT_SIDE) {
    issues.push(`source_resolution_below_720p:shortSide=${vShort}`);
  }
  if (iShort < MV001_MIN_IDENTITY_SHORT_SIDE) {
    issues.push(`identity_resolution_low:shortSide=${iShort}`);
  }

  const framing: Mv001FramingAnalysis = {
    video: {
      shortSide: vShort,
      longSide: vLong,
      aspectRatio: aspect(video.width, video.height),
      orientation: orientation(video.width, video.height),
      meetsMin720p: vShort >= MV001_MIN_VIDEO_SHORT_SIDE,
      recommended1080p: vShort >= MV001_RECOMMENDED_VIDEO_SHORT_SIDE,
      fpsNear24:
        video.fps == null
          ? null
          : Math.abs(video.fps - MV001_TARGET_FPS) <= MV001_FPS_TOLERANCE,
      fullBodySemantic: "requires_human_attestation",
    },
    identity: {
      shortSide: iShort,
      longSide: iLong,
      aspectRatio: aspect(image.width, image.height),
      meetsMinShortSide: iShort >= MV001_MIN_IDENTITY_SHORT_SIDE,
      faceBodySemantic: "requires_human_attestation",
    },
  };

  const sourceIssues = issues.filter((i) => i.startsWith("source_"));
  const identityIssues = issues.filter((i) => i.startsWith("identity_"));

  const manifest = createMv001MediaManifest({
    createdAt: input.nowIso,
    entries: [
      {
        role: "motion_source_video",
        localRelativePath: redactPathToRelativeRole(
          "motion_source_video",
          video.mimeType,
        ),
        mimeType: video.mimeType,
        sizeBytes: video.sizeBytes,
        durationSeconds: Math.round(video.durationSeconds * 1000) / 1000,
        width: video.width,
        height: video.height,
        fps: video.fps,
        checksumSha256: video.checksumSha256,
        provenance: "local-private-mt013g",
        consentReferenceId:
          input.consentReferenceIdSource ?? "mv001-source-consent",
        expiresAt: MV001_PRIVACY_EXPIRES_AT,
        validationStatus: sourceIssues.length === 0 ? "validated" : "invalid",
      },
      {
        role: "motion_identity_reference",
        localRelativePath: redactPathToRelativeRole(
          "motion_identity_reference",
          image.mimeType,
        ),
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        durationSeconds: null,
        width: image.width,
        height: image.height,
        fps: null,
        checksumSha256: image.checksumSha256,
        provenance: "local-private-mt013g",
        consentReferenceId:
          input.consentReferenceIdIdentity ?? "mv001-identity-consent",
        expiresAt: MV001_PRIVACY_EXPIRES_AT,
        validationStatus: identityIssues.length === 0 ? "validated" : "invalid",
      },
    ],
  });

  assertMv001ManifestRedacted(manifest);
  // Extra guard: absolute Windows/home paths must not appear
  const serialized = JSON.stringify(manifest);
  if (/[A-Za-z]:\\+Users\\+/i.test(serialized) || /\/home\/[^/]+\//i.test(serialized)) {
    throw new Error("manifest_leaked_user_path");
  }

  const ok = issues.length === 0;
  return deepFreeze({
    schemaVersion: MV001_LOCAL_VALIDATE_VERSION,
    auth: "AUTH_MV001_LOCAL_MEDIA_VALIDATE_ONLY",
    verdict: ok ? "MEDIA_VALIDATED" : "MEDIA_INVALID",
    mediaRead: true,
    mediaValidated: ok,
    network: false,
    upload: false,
    providerCalled: false,
    issues,
    framing,
    manifest: {
      ...manifest,
      benchmarkId: MV001_BENCHMARK_ID,
    },
    pathRefs: {
      source: "env:SOURCE_VIDEO_PATH",
      identity: "env:IDENTITY_IMAGE_PATH",
    },
  });
}
