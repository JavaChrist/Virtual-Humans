/**
 * Supabase ArtifactRepository (VHS-113).
 */

import type {
  ActiveArtifactPointer,
  ArtifactRepository,
  PersistedArtifact,
} from "@/application/projects/ports";
import { isArtifactType } from "@/domain/project";
import type { Json } from "../database.types";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

function rowToArtifact(row: {
  id: string;
  workspace_id: string;
  project_id: string;
  artifact_type: string;
  revision: number;
  schema_version: string;
  parent_revision_id: string | null;
  value: Json;
  created_at: string;
  created_by: string;
  correlation_id: string;
}): PersistedArtifact {
  if (!isArtifactType(row.artifact_type)) {
    throw new PersistenceError("invalid_input", "Type d'artifact invalide en base.");
  }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    artifactType: row.artifact_type,
    revision: row.revision,
    schemaVersion: row.schema_version,
    parentRevisionId: row.parent_revision_id,
    value: row.value,
    createdAt: row.created_at,
    createdBy: row.created_by,
    correlationId: row.correlation_id,
  };
}

export function createSupabaseArtifactRepository(deps: {
  client: V2DbClient;
  workspaceId: string;
}): ArtifactRepository {
  const { client, workspaceId } = deps;

  return {
    async append(artifact) {
      if (artifact.workspaceId !== workspaceId) {
        throw new PersistenceError(
          "invalid_input",
          "workspace_id ne correspond pas à la configuration serveur."
        );
      }
      const { error } = await client.from("project_artifacts").insert({
        id: artifact.id,
        workspace_id: workspaceId,
        project_id: artifact.projectId,
        artifact_type: artifact.artifactType,
        revision: artifact.revision,
        schema_version: artifact.schemaVersion,
        parent_revision_id: artifact.parentRevisionId,
        value: artifact.value as Json,
        created_at: artifact.createdAt,
        created_by: artifact.createdBy,
        correlation_id: artifact.correlationId,
      });
      if (error) throw mapSupabaseError(error);
    },

    async load(artifactId) {
      const { data, error } = await client
        .from("project_artifacts")
        .select("*")
        .eq("id", artifactId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      return data ? rowToArtifact(data) : null;
    },

    async loadByRevision(projectId, artifactType, revision) {
      const { data, error } = await client
        .from("project_artifacts")
        .select("*")
        .eq("project_id", projectId)
        .eq("artifact_type", artifactType)
        .eq("revision", revision)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      return data ? rowToArtifact(data) : null;
    },

    async getActive(projectId, artifactType) {
      const { data, error } = await client
        .from("active_artifact_revisions")
        .select("*")
        .eq("project_id", projectId)
        .eq("artifact_type", artifactType)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) return null;
      if (!isArtifactType(data.artifact_type)) {
        throw new PersistenceError("invalid_input", "Type d'artifact invalide.");
      }
      return {
        projectId: data.project_id,
        artifactType: data.artifact_type,
        artifactId: data.artifact_id,
        revision: data.revision,
        updatedAt: data.updated_at,
        updatedBy: data.updated_by,
        stale: Boolean((data as { stale?: boolean }).stale),
        staleReason: (data as { stale_reason?: string | null }).stale_reason ?? null,
        staleSince: (data as { stale_since?: string | null }).stale_since ?? null,
      } satisfies ActiveArtifactPointer;
    },

    async setActive(input) {
      const { data, error } = await client.rpc("set_active_artifact_revision", {
        p_workspace_id: workspaceId,
        p_project_id: input.projectId,
        p_artifact_type: input.artifactType,
        p_artifact_id: input.artifactId,
        p_expected_revision: input.expectedRevision,
        p_updated_by: input.updatedBy,
      });
      if (error) throw mapSupabaseError(error);
      if (!data) {
        throw new PersistenceError("unknown", "Activation de révision échouée.");
      }
      if (!isArtifactType(data.artifact_type)) {
        throw new PersistenceError("invalid_input", "Type d'artifact invalide.");
      }
      return {
        projectId: data.project_id,
        artifactType: data.artifact_type,
        artifactId: data.artifact_id,
        revision: data.revision,
        updatedAt: data.updated_at,
        updatedBy: data.updated_by,
      };
    },
  };
}
