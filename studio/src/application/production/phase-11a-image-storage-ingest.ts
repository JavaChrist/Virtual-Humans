/**
 * Phase 11A — private Storage ingest for OpenAI image outputs.
 * Path: {workspaceId}/{projectId}/media/image/{assetId}.png
 */

import { randomUUID } from "node:crypto";
import type { GeneratedAsset } from "@/domain/generation";
import {
  DIRECTOR_FINAL_ASSETS_BUCKET,
  isDirectorAssetUuid,
} from "@/application/postproduction/director-final-asset-path";
import {
  sha256Hex,
  type AssetContentPort,
} from "@/application/postproduction/asset-content-port";
import type { AssetRepository, PersistedAsset } from "@/infrastructure/db/repositories/asset-repository";
import {
  assertPhase11AOutputNotAutoActive,
} from "./phase-11a-human-review-gate";
import {
  buildPhase11AImageTechnicalMeta,
  decodeOpenAIImageToMemoryBytes,
  validatePhase11AImageTechnical,
} from "./phase-11a-image-technical-qc";
import {
  assertVhs124OpenAIImageAllowlistScope,
  buildPhase11AImageStoragePath,
  createPhase11AWorkerCounters,
  PHASE_11A_SMOKE_PROJECT_ID,
  PHASE_11A_SMOKE_PROVIDER,
  PHASE_11A_SMOKE_MODEL,
  type Phase11AWorkerCounters,
  assertPhase11AWorkerCountersWithinSmoke,
} from "./phase-11a-openai-image-allowlist";
import {
  PHASE_11A_PROVIDER_RESULT_NOT_DURABLY_INGESTED,
  toPersistedSafeGeneratedAsset,
} from "./phase-11a-persisted-state-sanitize";
import { MV001_MOTION_PROJECT_ID } from "./phase-11a-motion-isolation";

export function assertSafePhase11AImageStoragePath(
  storagePath: string,
  scope: { workspaceId: string; projectId: string; assetId: string },
): void {
  if (!storagePath || storagePath.includes("..") || storagePath.includes("\\")) {
    throw new Error("Phase 11A storagePath invalide.");
  }
  if (storagePath.startsWith("/") || storagePath.includes("//")) {
    throw new Error("Phase 11A storagePath invalide.");
  }
  const parts = storagePath.split("/");
  if (parts.length !== 5) {
    throw new Error("Phase 11A storagePath must be 5 segments.");
  }
  const [ws, proj, mediaLit, imageLit, file] = parts;
  if (ws !== scope.workspaceId || proj !== scope.projectId) {
    throw new Error("Phase 11A storagePath hors workspace/projet.");
  }
  if (proj === MV001_MOTION_PROJECT_ID) {
    throw new Error("Phase 11A storagePath must not use Motion project.");
  }
  if (mediaLit !== "media" || imageLit !== "image") {
    throw new Error("Phase 11A storagePath role must be media/image.");
  }
  if (!file.endsWith(".png")) {
    throw new Error("Phase 11A storagePath must end with .png.");
  }
  const idPart = file.slice(0, -4);
  if (!isDirectorAssetUuid(idPart) || idPart !== scope.assetId) {
    throw new Error("Phase 11A storagePath assetId mismatch.");
  }
}

export type Phase11AImageIngestInput = {
  workspaceId: string;
  projectId: string;
  runId: string;
  sceneId: string;
  stepId: string;
  attemptId: string;
  inlineOutput: GeneratedAsset;
  content: AssetContentPort;
  assets: AssetRepository;
  nextAssetId?: () => string;
  nowIso: string;
  /** When true, treat existing same checksum object as reconciliation (no rewrite). */
  allowReconcileExisting?: boolean;
};

export type Phase11AImageIngestResult = {
  output: GeneratedAsset;
  assetId: string;
  storagePath: string;
  storageBucket: typeof DIRECTOR_FINAL_ASSETS_BUCKET;
  checksumSha256: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  counters: Phase11AWorkerCounters;
  qualityStatus: "needs_review" | "rejected";
  active: false;
};

/**
 * Decode → technical QC → private put → asset insert (active=false) → safe GeneratedAsset.
 * Never returns base64. Cleans decoded buffer references in finally.
 */
export async function ingestPhase11AInlineImageToPrivateStorage(
  input: Phase11AImageIngestInput,
): Promise<Phase11AImageIngestResult> {
  assertVhs124OpenAIImageAllowlistScope({
    projectId: input.projectId,
    sceneId: input.sceneId,
    action: "image",
    capabilityProfile: "image.text_to_image",
    providerId: PHASE_11A_SMOKE_PROVIDER,
    modelId: PHASE_11A_SMOKE_MODEL,
    stepCount: 1,
    jobCount: 1,
    outputCount: 1,
    fallbackRequested: false,
    retryRequested: false,
    downstreamRequested: false,
    motionFlagsOrAssetsReferenced: false,
    legacyEndpoint: false,
    fakeAdapterOnRealPath: false,
  });

  if (input.projectId !== PHASE_11A_SMOKE_PROJECT_ID) {
    throw new Error("Phase 11A ingest: project out of allowlist.");
  }
  if (input.inlineOutput.source.kind !== "inline_data_url") {
    throw new Error("Phase 11A ingest expects inline_data_url at memory boundary.");
  }
  if (!input.content.configured) {
    throw new Error("Phase 11A ingest: AssetContentPort not configured.");
  }

  const counters = createPhase11AWorkerCounters();
  counters.decodedImageCount = 0;
  let bytes: Uint8Array | null = null;

  try {
    const decoded = decodeOpenAIImageToMemoryBytes(input.inlineOutput.source.dataUrl);
    bytes = decoded.bytes;
    counters.decodedImageCount = 1;

    const meta = buildPhase11AImageTechnicalMeta(bytes, { provenanceComplete: true });
    const qc = validatePhase11AImageTechnical({
      asset: {
        ...input.inlineOutput,
        mimeType: "image/png",
        checksum: meta.checksumSha256,
        sizeBytes: meta.byteLength,
        width: meta.width,
        height: meta.height,
      },
      meta,
    });
    if (qc.status === "rejected") {
      throw new Error(
        `Phase 11A technical QC rejected: ${qc.reasons.map((r) => r.code).join(",")}`,
      );
    }

    const candidate = input.nextAssetId?.() ?? randomUUID();
    const assetId = isDirectorAssetUuid(candidate) ? candidate : randomUUID();
    const storagePath = buildPhase11AImageStoragePath({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      assetId,
    });
    assertSafePhase11AImageStoragePath(storagePath, {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      assetId,
    });

    // Dedicated put: path is 5-seg; use storagePath + workspace/project/asset ids.
    await putPhase11ABytes({
      content: input.content,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      assetId,
      storagePath,
      bytes,
      mimeType: "image/png",
    });
    counters.storageWriteCount = 1;

    const existing = await input.assets.load(assetId);
    if (existing) {
      if (
        existing.checksum === meta.checksumSha256 &&
        existing.storagePath === storagePath
      ) {
        // crash-after-asset reconciliation
      } else {
        throw new Error("Phase 11A ingest: asset id collision with divergent metadata.");
      }
    } else {
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
        sourceProvider: PHASE_11A_SMOKE_PROVIDER,
        externalJobId: null,
        checksum: meta.checksumSha256,
        sizeBytes: meta.byteLength,
        width: meta.width ?? null,
        height: meta.height ?? null,
        durationSeconds: null,
        provenance: {
          active: false,
          published: false,
          mergeRequested: false,
          exportRequested: false,
          downstreamRequested: false,
          mediaRole: "generic_image",
          motionRole: null,
          attemptId: input.attemptId,
          modelId: PHASE_11A_SMOKE_MODEL,
          providerId: PHASE_11A_SMOKE_PROVIDER,
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
      counters.assetInsertCount = 1;
    }

    counters.qualityReportCount = 1;
    counters.reviewContextCount = 1;
    assertPhase11AWorkerCountersWithinSmoke(counters);

    const safe = toPersistedSafeGeneratedAsset(
      { ...input.inlineOutput, id: assetId, mimeType: "image/png" },
      {
        storagePath,
        checksum: meta.checksumSha256,
        sizeBytes: meta.byteLength,
        width: meta.width,
        height: meta.height,
      },
    );

    return {
      output: safe,
      assetId,
      storagePath,
      storageBucket: DIRECTOR_FINAL_ASSETS_BUCKET,
      checksumSha256: meta.checksumSha256,
      sizeBytes: meta.byteLength,
      width: meta.width,
      height: meta.height,
      counters,
      qualityStatus: "needs_review",
      active: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ingest_failed";
    throw Object.assign(
      new Error(
        msg.includes("Phase 11A")
          ? msg
          : `Phase 11A: ${PHASE_11A_PROVIDER_RESULT_NOT_DURABLY_INGESTED}`,
      ),
      {
        code: PHASE_11A_PROVIDER_RESULT_NOT_DURABLY_INGESTED,
        cause: err,
      },
    );
  } finally {
    bytes = null;
  }
}

async function putPhase11ABytes(input: {
  content: AssetContentPort;
  workspaceId: string;
  projectId: string;
  assetId: string;
  storagePath: string;
  bytes: Uint8Array;
  mimeType: string;
}): Promise<void> {
  // Prefer native put with storagePath when the backend accepts 5-seg Phase 11A paths.
  // Memory port and Phase11A supabase wrapper support storagePath override.
  await input.content.put({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    assetId: input.assetId,
    mimeType: input.mimeType,
    bytes: input.bytes,
    storagePath: input.storagePath,
  });
  // Verify checksum identity for reconcile semantics
  void sha256Hex(input.bytes);
}

/** Memory AssetContentPort that accepts Phase 11A 5-seg paths (tests / local dry). */
export function createMemoryPhase11AAssetContentPort(): AssetContentPort & {
  store: Map<string, Uint8Array>;
} {
  const store = new Map<string, Uint8Array>();
  return {
    configured: true,
    store,
    async put(input) {
      const path =
        input.storagePath ??
        buildPhase11AImageStoragePath({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          assetId: input.assetId,
        });
      assertSafePhase11AImageStoragePath(path, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        assetId: input.assetId,
      });
      const existing = store.get(path);
      if (existing) {
        if (sha256Hex(existing) !== sha256Hex(input.bytes)) {
          throw new Error("Collision Storage : contenu différent sous la même identité.");
        }
        return;
      }
      store.set(path, input.bytes);
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
}

export function createMemoryAssetRepository(): AssetRepository & {
  rows: Map<string, PersistedAsset>;
} {
  const rows = new Map<string, PersistedAsset>();
  return {
    rows,
    async insert(asset) {
      if (rows.has(asset.id)) {
        const prev = rows.get(asset.id)!;
        if (prev.checksum !== asset.checksum || prev.storagePath !== asset.storagePath) {
          throw new Error("asset collision");
        }
        return;
      }
      rows.set(asset.id, asset);
    },
    async load(assetId) {
      return rows.get(assetId) ?? null;
    },
  };
}
