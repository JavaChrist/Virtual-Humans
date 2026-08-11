/**
 * MT-013F — Private upload plan for MV-001 (prep only — never executes upload).
 * Max 2 private uploads; signed URLs in memory only at last moment (future Auth).
 */

import { deepFreeze } from "@/domain/motion/freeze";
import {
  buildMotionAssetStoragePath,
  MOTION_ASSETS_BUCKET,
} from "@/application/motion/motion-asset-path";
import { MV001_BENCHMARK_ID } from "./mv001-benchmark-profile";
import type { Mv001MediaRole } from "./mv001-media-manifest";

export const MV001_UPLOAD_PREP_VERSION = "mt013f-mv001-upload-1.0.0" as const;
export const MV001_MAX_PRIVATE_UPLOADS = 2 as const;

/** Minimal signed URL TTL for future Auth (seconds) — never persist URLs. */
export const MV001_SIGNED_URL_TTL_SECONDS = 60 as const;

export type Mv001UploadPlanEntry = {
  role: Mv001MediaRole;
  bucket: typeof MOTION_ASSETS_BUCKET;
  /** Opaque storage path — no public ACL. */
  storagePath: string;
  mimeType: string;
  replaceExisting: false;
  publicAccess: false;
};

export type Mv001UploadPrepPlan = {
  schemaVersion: typeof MV001_UPLOAD_PREP_VERSION;
  benchmarkId: typeof MV001_BENCHMARK_ID;
  maxUploads: typeof MV001_MAX_PRIVATE_UPLOADS;
  signedUrlTtlSeconds: typeof MV001_SIGNED_URL_TTL_SECONDS;
  persistSignedUrls: false;
  requireHumanAuth: true;
  executed: false;
  entries: readonly Mv001UploadPlanEntry[];
  cleanup: {
    quarantineLateOutputs: true;
    revokeSignedUrlsOnClose: true;
    documentOnly: true;
  };
  notes: readonly string[];
};

/**
 * Build upload plan descriptors. Does not touch Storage or network.
 */
export function buildMv001UploadPrepPlan(input: {
  workspaceId: string;
  projectId: string;
  sourceAssetId: string;
  identityAssetId: string;
}): Readonly<Mv001UploadPrepPlan> {
  const sourcePath = buildMotionAssetStoragePath({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    role: "motion_source_video",
    assetId: input.sourceAssetId,
    mimeType: "video/mp4",
  });
  const identityPath = buildMotionAssetStoragePath({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    role: "motion_identity_reference",
    assetId: input.identityAssetId,
    mimeType: "image/png",
  });

  return deepFreeze({
    schemaVersion: MV001_UPLOAD_PREP_VERSION,
    benchmarkId: MV001_BENCHMARK_ID,
    maxUploads: MV001_MAX_PRIVATE_UPLOADS,
    signedUrlTtlSeconds: MV001_SIGNED_URL_TTL_SECONDS,
    persistSignedUrls: false,
    requireHumanAuth: true,
    executed: false,
    entries: [
      {
        role: "motion_source_video",
        bucket: MOTION_ASSETS_BUCKET,
        storagePath: sourcePath,
        mimeType: "video/mp4",
        replaceExisting: false,
        publicAccess: false,
      },
      {
        role: "motion_identity_reference",
        bucket: MOTION_ASSETS_BUCKET,
        storagePath: identityPath,
        mimeType: "image/png",
        replaceExisting: false,
        publicAccess: false,
      },
    ],
    cleanup: {
      quarantineLateOutputs: true,
      revokeSignedUrlsOnClose: true,
      documentOnly: true,
    },
    notes: [
      "Exactly two private uploads maximum — source video + identity image.",
      "Signed URLs only in memory at submit time; never persisted in DB/logs/Git.",
      "No public ACL; workspace/project path verified by assertSafeMotionStoragePath.",
      "Upload requires separate human Auth — this plan must not be executed in MT-013F.",
      "Do not replace existing assets; new assetIds only.",
    ],
  });
}

/** Guard: refuse execution in prep phase. */
export function assertMv001UploadNotExecuted(plan: Mv001UploadPrepPlan): void {
  if (plan.executed !== false) {
    throw new Error("MV-001 upload must not execute during MT-013F prep.");
  }
  if (plan.entries.length > MV001_MAX_PRIVATE_UPLOADS) {
    throw new Error("MV-001 upload exceeds max private uploads.");
  }
}
