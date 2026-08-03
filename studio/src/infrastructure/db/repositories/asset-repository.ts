/**
 * Asset metadata repository — internal paths only (VHS-113).
 */

import type { Json } from "../database.types";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

export type PersistedAsset = {
  id: string;
  workspaceId: string;
  projectId: string;
  runId: string | null;
  sceneId: string | null;
  stepId: string | null;
  kind: string;
  mimeType: string;
  storageBucket: string | null;
  storagePath: string | null;
  sourceKind: string;
  sourceProvider: string | null;
  externalJobId: string | null;
  checksum: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  provenance: unknown;
  status: string;
  createdAt: string;
  expiresAt: string | null;
};

export type AssetRepository = {
  insert(asset: PersistedAsset): Promise<void>;
  load(assetId: string): Promise<PersistedAsset | null>;
};

export function createSupabaseAssetRepository(deps: {
  client: V2DbClient;
  workspaceId: string;
}): AssetRepository {
  const { client, workspaceId } = deps;

  return {
    async insert(asset) {
      if (asset.workspaceId !== workspaceId) {
        throw new PersistenceError(
          "invalid_input",
          "workspace_id ne correspond pas à la configuration serveur."
        );
      }
      // Never persist signed URLs — only bucket/path or source_kind markers
      const { error } = await client.from("assets").insert({
        id: asset.id,
        workspace_id: workspaceId,
        project_id: asset.projectId,
        run_id: asset.runId,
        scene_id: asset.sceneId,
        step_id: asset.stepId,
        kind: asset.kind,
        mime_type: asset.mimeType,
        storage_bucket: asset.storageBucket,
        storage_path: asset.storagePath,
        source_kind: asset.sourceKind,
        source_provider: asset.sourceProvider,
        external_job_id: asset.externalJobId,
        checksum: asset.checksum,
        size_bytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
        duration_seconds: asset.durationSeconds,
        provenance: asset.provenance as Json,
        status: asset.status,
        created_at: asset.createdAt,
        expires_at: asset.expiresAt,
      });
      if (error) throw mapSupabaseError(error);
    },

    async load(assetId) {
      const { data, error } = await client
        .from("assets")
        .select("*")
        .eq("id", assetId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) return null;
      return {
        id: data.id,
        workspaceId: data.workspace_id,
        projectId: data.project_id,
        runId: data.run_id,
        sceneId: data.scene_id,
        stepId: data.step_id,
        kind: data.kind,
        mimeType: data.mime_type,
        storageBucket: data.storage_bucket,
        storagePath: data.storage_path,
        sourceKind: data.source_kind,
        sourceProvider: data.source_provider,
        externalJobId: data.external_job_id,
        checksum: data.checksum,
        sizeBytes: data.size_bytes,
        width: data.width,
        height: data.height,
        durationSeconds: data.duration_seconds,
        provenance: data.provenance,
        status: data.status,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
      };
    },
  };
}
