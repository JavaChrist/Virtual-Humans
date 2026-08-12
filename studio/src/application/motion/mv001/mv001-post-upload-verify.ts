/**
 * MT-013I / MT-013J-HOTFIX — post-upload asset row checks (no network).
 * Ensures private internal assets match expected role/MIME/path/checksum.
 */

export const MV001_POST_UPLOAD_ASSET_SELECT =
  "id,kind,mime_type,storage_bucket,storage_path,checksum,size_bytes,status,source_kind,provenance" as const;

export type Mv001PostUploadAssetRow = {
  id: string;
  kind: string;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  checksum: string;
  size_bytes: number | null;
  status: string;
  source_kind: string;
  provenance: { motionRole?: string } | null;
};

export type Mv001PostUploadVerifyExpectation = {
  bucket: string;
  sourceAssetId: string;
  identityAssetId: string;
  sourceChecksum: string;
  identityChecksum: string;
};

export type Mv001PostUploadVerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

function readMotionRole(provenance: unknown): string | undefined {
  if (!provenance || typeof provenance !== "object") return undefined;
  if (!("motionRole" in provenance)) return undefined;
  const role = Reflect.get(provenance, "motionRole");
  return typeof role === "string" ? role : undefined;
}

/**
 * Narrow a Supabase row into the post-upload verify shape without casts.
 */
export function parseMv001PostUploadAssetRow(
  row: unknown,
): Mv001PostUploadAssetRow | null {
  if (!row || typeof row !== "object") return null;
  const id = Reflect.get(row, "id");
  const kind = Reflect.get(row, "kind");
  const mimeType = Reflect.get(row, "mime_type");
  const storageBucket = Reflect.get(row, "storage_bucket");
  const storagePath = Reflect.get(row, "storage_path");
  const checksum = Reflect.get(row, "checksum");
  const sizeBytes = Reflect.get(row, "size_bytes");
  const status = Reflect.get(row, "status");
  const sourceKind = Reflect.get(row, "source_kind");
  const provenance = Reflect.get(row, "provenance");
  if (
    typeof id !== "string" ||
    typeof kind !== "string" ||
    typeof mimeType !== "string" ||
    typeof storageBucket !== "string" ||
    typeof storagePath !== "string" ||
    typeof checksum !== "string" ||
    typeof status !== "string" ||
    typeof sourceKind !== "string"
  ) {
    return null;
  }
  if (
    sizeBytes !== null &&
    sizeBytes !== undefined &&
    typeof sizeBytes !== "number"
  ) {
    return null;
  }
  return {
    id,
    kind,
    mime_type: mimeType,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    checksum,
    size_bytes: typeof sizeBytes === "number" ? sizeBytes : null,
    status,
    source_kind: sourceKind,
    provenance: { motionRole: readMotionRole(provenance) },
  };
}

/**
 * Validate one persisted asset row after private upload.
 * `source_kind` must be `internal` (never temporary_external / inline).
 */
export function verifyMv001PostUploadAssetRow(
  row: Mv001PostUploadAssetRow,
  expected: Mv001PostUploadVerifyExpectation,
): Mv001PostUploadVerifyResult {
  if (row.storage_bucket !== expected.bucket) {
    return { ok: false, reason: "bucket mismatch on asset" };
  }
  if (row.status !== "available") {
    return { ok: false, reason: "unexpected asset status" };
  }
  if (row.source_kind !== "internal") {
    return { ok: false, reason: "source_kind must be internal" };
  }

  const role = row.provenance?.motionRole;
  if (role === "motion_source_video") {
    if (row.checksum !== expected.sourceChecksum) {
      return { ok: false, reason: "persisted source checksum mismatch" };
    }
    if (row.mime_type !== "video/mp4") {
      return { ok: false, reason: "source mime mismatch" };
    }
    if (
      !row.storage_path.endsWith(`/motion/source/${expected.sourceAssetId}.mp4`)
    ) {
      return { ok: false, reason: "source path mismatch" };
    }
    return { ok: true };
  }

  if (role === "motion_identity_reference") {
    if (row.checksum !== expected.identityChecksum) {
      return { ok: false, reason: "persisted identity checksum mismatch" };
    }
    if (row.mime_type !== "image/png") {
      return { ok: false, reason: "identity mime mismatch" };
    }
    if (
      !row.storage_path.endsWith(
        `/motion/identity/${expected.identityAssetId}.png`,
      )
    ) {
      return { ok: false, reason: "identity path mismatch" };
    }
    return { ok: true };
  }

  return { ok: false, reason: "unexpected motionRole" };
}
