/**
 * Motion media references — reuse AssetInputRef (generation/input.ts).
 * No parallel MediaReference system.
 */

import type { AssetAccess, AssetInputRef, AssetKind } from "@/domain/generation";
import { MotionTransferDomainError } from "./errors";

export type MotionMediaRole =
  | "source_video"
  | "identity"
  | "outfit"
  | "qc_evidence"
  | "output"
  | "other";

/** Redacted-safe provenance — never store signed URLs or bytes. */
export type MotionMediaProvenance = {
  sourceKind?: string;
  providerId?: string;
  externalAssetId?: string;
  capturedAt?: string;
  licenseTag?: string;
  consentTag?: string;
};

/**
 * Domain MediaReference for motion_transfer.
 * Wraps AssetInputRef + optional role/metadata (checksum/mime via asset).
 */
export type MotionMediaReference = {
  asset: AssetInputRef;
  role: MotionMediaRole;
  durationSeconds?: number;
  width?: number;
  height?: number;
  provenance?: MotionMediaProvenance;
};

export type MotionMediaReferenceParseOptions = {
  /** Production default: false — data URLs forbidden for motion transfer. */
  allowDataUrl?: boolean;
  /** When set, require asset.kind to be one of these. */
  expectedKinds?: readonly AssetKind[];
  role: MotionMediaRole;
  at?: string;
};

export function validateMotionMediaReference(
  ref: MotionMediaReference,
  options: MotionMediaReferenceParseOptions,
): void {
  const asset = ref.asset;
  if (!asset.assetId?.trim()) {
    throw new MotionTransferDomainError(
      "invalid_motion_transfer_input",
      "Media reference assetId is required.",
      { field: "asset.assetId" },
    );
  }

  if (options.expectedKinds && !options.expectedKinds.includes(asset.kind)) {
    throw new MotionTransferDomainError(
      "invalid_motion_transfer_input",
      "Media reference kind is not allowed for this role.",
      { field: "asset.kind" },
    );
  }

  if (ref.role !== options.role) {
    throw new MotionTransferDomainError(
      "invalid_motion_transfer_input",
      "Media reference role mismatch.",
      { field: "role" },
    );
  }

  assertAccessAllowed(asset.access, {
    allowDataUrl: options.allowDataUrl === true,
    at: options.at ?? new Date().toISOString(),
  });

  if (ref.durationSeconds != null) {
    if (
      !Number.isFinite(ref.durationSeconds) ||
      ref.durationSeconds <= 0 ||
      ref.durationSeconds > 3600
    ) {
      throw new MotionTransferDomainError(
        "invalid_duration",
        "Media reference duration is out of bounds.",
        { field: "durationSeconds" },
      );
    }
  }
}

function assertAccessAllowed(
  access: AssetAccess,
  options: { allowDataUrl: boolean; at: string },
): void {
  if (access.kind === "data_url") {
    if (!options.allowDataUrl) {
      throw new MotionTransferDomainError(
        "data_url_forbidden",
        "Inline data URLs are not allowed for motion transfer media.",
        { field: "asset.access" },
      );
    }
    if (!access.dataUrl?.startsWith("data:")) {
      throw new MotionTransferDomainError(
        "invalid_motion_transfer_input",
        "Invalid data URL access.",
        { field: "asset.access" },
      );
    }
    return;
  }

  if (access.kind === "internal") {
    if (!access.storagePath?.trim()) {
      throw new MotionTransferDomainError(
        "invalid_motion_transfer_input",
        "Internal storage path is empty.",
        { field: "asset.access" },
      );
    }
    return;
  }

  if (access.kind === "signed_url") {
    const exp = Date.parse(access.expiresAt);
    const now = Date.parse(options.at);
    if (!Number.isFinite(exp) || !Number.isFinite(now) || now >= exp) {
      throw new MotionTransferDomainError(
        "invalid_motion_transfer_input",
        "Signed asset URL is expired or invalid.",
        { field: "asset.access" },
      );
    }
    if (!/^https:\/\//i.test(access.url)) {
      throw new MotionTransferDomainError(
        "invalid_motion_transfer_input",
        "Asset URL scheme is not allowed.",
        { field: "asset.access" },
      );
    }
    return;
  }

  throw new MotionTransferDomainError(
    "invalid_motion_transfer_input",
    "Unknown asset access kind.",
    { field: "asset.access" },
  );
}

/** Stable fingerprint — never includes signed URLs or data URLs. */
export function fingerprintMotionMediaReference(ref: MotionMediaReference): string {
  const asset = ref.asset;
  const accessKind = asset.access.kind;
  const accessStable =
    accessKind === "internal"
      ? `internal:${asset.access.storagePath}`
      : accessKind === "signed_url"
        ? `signed_url:expires:${asset.access.expiresAt}`
        : "data_url:omitted";
  return [
    ref.role,
    asset.assetId,
    asset.kind,
    asset.mimeType ?? "",
    asset.checksum ?? "",
    accessStable,
    ref.durationSeconds ?? "",
    ref.width ?? "",
    ref.height ?? "",
  ].join("|");
}
