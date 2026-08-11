/**
 * Motion-transfer media resolution port (MT-004).
 * No Storage writes; no provider downloads unless a local fake convention is used.
 */

import type { AssetInputRef, AssetKind } from "./input";
import { GenerationDomainError } from "./errors";
import type { MotionMediaReference, MotionMediaRole } from "@/domain/motion";
import { fingerprintMotionMediaReference } from "@/domain/motion";
import { sanitizePublicMessage } from "@/domain/motion/errors";

const VIDEO_MIME = /^(video\/(mp4|webm|quicktime)|application\/mp4)$/i;
const IMAGE_MIME = /^image\/(png|jpeg|jpg|webp)$/i;

export type ResolvedMotionMediaMeta = {
  role: MotionMediaRole;
  assetId: string;
  kind: AssetKind;
  mimeType: string;
  checksum: string;
  fingerprint: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  /** Access kind only — never the signed URL or data URL body. */
  accessKind: "internal" | "signed_url" | "data_url";
  /** Ephemeral boundary handle for internal ports — omitted from public dry-run. */
  ephemeralAccess?: AssetInputRef["access"];
};

export type MotionTransferMediaResolver = {
  resolve(
    ref: MotionMediaReference,
    options: { at: string; allowDataUrl?: boolean },
  ): Promise<ResolvedMotionMediaMeta>;
};

function assertMimeForRole(role: MotionMediaRole, mimeType: string | undefined): string {
  const mime = mimeType?.trim() ?? "";
  if (!mime) {
    throw new GenerationDomainError(
      "invalid_input",
      "Media MIME type is required for motion-transfer resolution.",
      { diagnostic: `role=${role}` },
    );
  }
  if (role === "source_video") {
    if (!VIDEO_MIME.test(mime)) {
      throw new GenerationDomainError(
        "invalid_input",
        "sourceVideo must use a video MIME type.",
        { diagnostic: `mime=${mime}` },
      );
    }
  } else if (role === "identity" || role === "outfit") {
    if (!IMAGE_MIME.test(mime)) {
      throw new GenerationDomainError(
        "invalid_input",
        "Identity/outfit references must use an image MIME type.",
        { diagnostic: `mime=${mime}` },
      );
    }
  }
  return mime;
}

function assertAccessPolicy(
  access: AssetInputRef["access"],
  options: { at: string; allowDataUrl: boolean },
): void {
  if (access.kind === "data_url") {
    if (!options.allowDataUrl) {
      throw new GenerationDomainError(
        "invalid_input",
        "Inline data URLs are not allowed for motion-transfer media.",
      );
    }
    return;
  }
  if (access.kind === "signed_url") {
    const exp = Date.parse(access.expiresAt);
    const now = Date.parse(options.at);
    if (!Number.isFinite(exp) || !Number.isFinite(now) || now >= exp) {
      throw new GenerationDomainError(
        "asset_unavailable",
        "Signed asset URL is expired or invalid.",
      );
    }
    if (!/^https:\/\//i.test(access.url)) {
      throw new GenerationDomainError(
        "asset_unavailable",
        "Asset URL scheme is not allowed.",
      );
    }
    return;
  }
  if (access.kind === "internal") {
    if (!access.storagePath.trim()) {
      throw new GenerationDomainError("asset_unavailable", "Internal asset path is empty.");
    }
    return;
  }
  throw new GenerationDomainError("invalid_input", "Unknown asset access kind.");
}

/** Public redacted view — no ephemeral URLs. */
export function redactResolvedMotionMedia(
  meta: ResolvedMotionMediaMeta,
): Omit<ResolvedMotionMediaMeta, "ephemeralAccess"> {
  return {
    role: meta.role,
    assetId: meta.assetId,
    kind: meta.kind,
    mimeType: meta.mimeType,
    checksum: meta.checksum,
    fingerprint: meta.fingerprint,
    durationSeconds: meta.durationSeconds,
    width: meta.width,
    height: meta.height,
    accessKind: meta.accessKind,
  };
}

/**
 * Strict fake resolver for tests — validates MIME/role/access, never downloads or writes.
 * Only resolves refs previously registered via `register`.
 */
export function createFakeMotionTransferMediaResolver(): MotionTransferMediaResolver & {
  register(ref: MotionMediaReference): void;
  clear(): void;
} {
  const catalog = new Map<string, MotionMediaReference>();
  return {
    register(ref) {
      catalog.set(`${ref.role}:${ref.asset.assetId}`, ref);
    },
    clear() {
      catalog.clear();
    },
    async resolve(ref, options) {
      const key = `${ref.role}:${ref.asset.assetId}`;
      const known = catalog.get(key);
      if (!known) {
        throw new GenerationDomainError(
          "asset_unavailable",
          sanitizePublicMessage("Motion media reference could not be resolved."),
          { diagnostic: `missing=${key}` },
        );
      }
      const allowDataUrl = options.allowDataUrl === true;
      assertAccessPolicy(ref.asset.access, { at: options.at, allowDataUrl });
      const mime = assertMimeForRole(ref.role, ref.asset.mimeType);
      if (!ref.asset.checksum?.trim()) {
        throw new GenerationDomainError(
          "invalid_input",
          "Media checksum is required for motion-transfer resolution.",
        );
      }
      // Role must match registered role
      if (known.role !== ref.role) {
        throw new GenerationDomainError(
          "invalid_input",
          "Media reference role mismatch.",
        );
      }
      return {
        role: ref.role,
        assetId: ref.asset.assetId,
        kind: ref.asset.kind,
        mimeType: mime,
        checksum: ref.asset.checksum,
        fingerprint: fingerprintMotionMediaReference(ref),
        durationSeconds: ref.durationSeconds,
        width: ref.width,
        height: ref.height,
        accessKind: ref.asset.access.kind,
        // Ephemeral only for signed_url — kept off public dry-run via redact
        ephemeralAccess:
          ref.asset.access.kind === "signed_url" ? ref.asset.access : undefined,
      };
    },
  };
}
