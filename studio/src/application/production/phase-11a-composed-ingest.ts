/**
 * Phase 11A — private composed overlay ingest (memory / tests).
 * Provider original is never overwritten. Composed asset stays active=false.
 * Production Storage writes are forbidden in this phase.
 */

import { createHash } from "node:crypto";
import {
  DIRECTOR_FINAL_ASSETS_BUCKET,
  isDirectorAssetUuid,
} from "@/application/postproduction/director-final-asset-path";
import {
  sha256Hex,
  type AssetContentPort,
} from "@/application/postproduction/asset-content-port";
import type { AssetRepository, PersistedAsset } from "@/infrastructure/db/repositories/asset-repository";
import type { ImageTextOverlaySpec } from "@/domain/production/image-text-overlay";
import { fingerprintImageTextOverlaySpec } from "@/domain/production/image-text-overlay";
import { assertPhase11AOutputNotAutoActive } from "./phase-11a-human-review-gate";
import {
  PHASE_11A_COMPOSITOR_VERSION,
  type Phase11ACompositorResult,
} from "./phase-11a-deterministic-compositor";
import {
  assertSafePhase11ARoleImageStoragePath,
  buildPhase11ARoleImageStoragePath,
} from "./phase-11a-image-role-storage";
import { MV001_MOTION_PROJECT_ID } from "./phase-11a-motion-isolation";

export const PHASE_11A_COMPOSED_MEDIA_ROLE = "composed_overlay_image" as const;
export const PHASE_11A_PROVIDER_MEDIA_ROLE = "provider_image_original" as const;

export function composedAssetIdFromFingerprint(fingerprint: string): string {
  const b = Buffer.from(fingerprint.slice(0, 32), "hex");
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x50;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function fingerprintPhase11AComposedAsset(input: {
  parentChecksumSha256: string;
  overlay: ImageTextOverlaySpec;
  compositorVersion?: string;
}): string {
  const overlayFp = fingerprintImageTextOverlaySpec(input.overlay);
  const canonical = JSON.stringify({
    parentChecksumSha256: input.parentChecksumSha256,
    overlayFingerprint: overlayFp,
    compositorVersion: input.compositorVersion ?? PHASE_11A_COMPOSITOR_VERSION,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export type Phase11AComposedIngestResult = {
  wrote: boolean;
  assetId: string;
  parentAssetId: string;
  storagePath: string;
  storageBucket: typeof DIRECTOR_FINAL_ASSETS_BUCKET;
  checksumSha256: string;
  overlayFingerprint: string;
  active: false;
  qualityStatus: "needs_review";
  mediaRole: typeof PHASE_11A_COMPOSED_MEDIA_ROLE;
};

export async function ingestPhase11AComposedOverlay(input: {
  workspaceId: string;
  projectId: string;
  runId: string;
  sceneId: string;
  stepId: string;
  parentAssetId: string;
  parentChecksumSha256: string;
  parentStoragePath: string;
  composed: Phase11ACompositorResult;
  overlay: ImageTextOverlaySpec;
  content: AssetContentPort;
  assets: AssetRepository;
  nowIso: string;
  /** Must remain false this phase. */
  allowProductionStorage?: false;
}): Promise<Phase11AComposedIngestResult> {
  if (input.allowProductionStorage) {
    throw new Error("Phase 11A composed ingest: Production Storage write forbidden this phase.");
  }
  if (input.projectId === MV001_MOTION_PROJECT_ID) {
    throw new Error("Phase 11A composed ingest: Motion project forbidden.");
  }
  if (input.parentStoragePath.includes("/composed/")) {
    throw new Error("Phase 11A composed ingest: parent must not be a composed asset.");
  }

  const fingerprint = fingerprintPhase11AComposedAsset({
    parentChecksumSha256: input.parentChecksumSha256,
    overlay: input.overlay,
    compositorVersion: input.composed.compositorVersion,
  });
  const assetId = composedAssetIdFromFingerprint(fingerprint);
  if (!isDirectorAssetUuid(assetId)) {
    throw new Error("Phase 11A composed ingest: derived assetId invalid.");
  }
  const storagePath = buildPhase11ARoleImageStoragePath({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    assetId,
    role: "composed",
  });
  assertSafePhase11ARoleImageStoragePath(storagePath, {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    assetId,
    role: "composed",
  });

  const existingObj = await input.content.get({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    assetId,
    storagePath,
  });
  if (existingObj) {
    if (existingObj.checksumSha256 !== input.composed.checksumSha256) {
      throw new Error("Phase 11A composed ingest: overwrite of divergent object forbidden.");
    }
    const existingRow = await input.assets.load(assetId);
    const provenance = existingRow?.provenance as { active?: boolean } | null;
    if (provenance?.active) {
      throw new Error("Phase 11A composed ingest: existing composed asset must not be active.");
    }
    return {
      wrote: false,
      assetId,
      parentAssetId: input.parentAssetId,
      storagePath,
      storageBucket: DIRECTOR_FINAL_ASSETS_BUCKET,
      checksumSha256: input.composed.checksumSha256,
      overlayFingerprint: input.composed.overlayFingerprint,
      active: false,
      qualityStatus: "needs_review",
      mediaRole: PHASE_11A_COMPOSED_MEDIA_ROLE,
    };
  }

  await input.content.put({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    assetId,
    mimeType: "image/png",
    bytes: input.composed.png,
    storagePath,
  });

  const row: PersistedAsset = {
    id: assetId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    runId: input.runId,
    sceneId: input.sceneId,
    stepId: input.stepId,
    kind: "image",
    mimeType: "image/png",
    storageBucket: DIRECTOR_FINAL_ASSETS_BUCKET,
    storagePath,
    sourceKind: "internal",
    sourceProvider: "deterministic-overlay",
    externalJobId: null,
    checksum: input.composed.checksumSha256,
    sizeBytes: input.composed.png.byteLength,
    width: 1024,
    height: 1024,
    durationSeconds: null,
    provenance: {
      active: false,
      published: false,
      mergeRequested: false,
      exportRequested: false,
      downstreamRequested: false,
      mediaRole: PHASE_11A_COMPOSED_MEDIA_ROLE,
      motionRole: null,
      parentAssetId: input.parentAssetId,
      overlayVersion: input.composed.overlayVersion,
      overlayFingerprint: input.composed.overlayFingerprint,
      compositorVersion: input.composed.compositorVersion,
    },
    status: "pending_review",
    createdAt: input.nowIso,
    expiresAt: null,
  };
  assertPhase11AOutputNotAutoActive({
    active: false,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
  });
  await input.assets.insert(row);

  void sha256Hex(input.composed.png);

  return {
    wrote: true,
    assetId,
    parentAssetId: input.parentAssetId,
    storagePath,
    storageBucket: DIRECTOR_FINAL_ASSETS_BUCKET,
    checksumSha256: input.composed.checksumSha256,
    overlayFingerprint: input.composed.overlayFingerprint,
    active: false,
    qualityStatus: "needs_review",
    mediaRole: PHASE_11A_COMPOSED_MEDIA_ROLE,
  };
}

export function createMemoryPhase11ARoleAssetContentPort(): AssetContentPort & {
  store: Map<string, Uint8Array>;
  writeCount: number;
} {
  const store = new Map<string, Uint8Array>();
  const port: AssetContentPort & { store: Map<string, Uint8Array>; writeCount: number } = {
    configured: true,
    store,
    writeCount: 0,
    async put(input) {
      const path = input.storagePath;
      if (!path) throw new Error("Phase 11A role memory port requires storagePath.");
      const existing = store.get(path);
      if (existing) {
        if (sha256Hex(existing) !== sha256Hex(input.bytes)) {
          throw new Error("Collision Storage : contenu différent sous la même identité.");
        }
        return;
      }
      store.set(path, input.bytes);
      port.writeCount += 1;
    },
    async get(input) {
      const path = input.storagePath;
      if (!path) return null;
      const bytes = store.get(path);
      if (!bytes) return null;
      return {
        assetId: input.assetId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        mimeType: "image/png",
        bytes,
        sizeBytes: bytes.byteLength,
        checksumSha256: sha256Hex(bytes),
        storagePath: path,
      };
    },
  };
  return port;
}
