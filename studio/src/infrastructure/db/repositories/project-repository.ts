/**
 * Supabase ProjectRepository (VHS-113).
 */

import type {
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";
import type { ProjectStatus } from "@/domain/project";
import { isProjectStatus } from "@/domain/project";
import type { V2DbClient } from "../supabase-server";
import { mapSupabaseError, PersistenceError } from "../errors";

function rowToProject(
  row: {
    id: string;
    workspace_id: string;
    name: string;
    status: string;
    active_revision: number;
    schema_version: string;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
    correlation_id: string;
  }
): PersistedVideoProject {
  if (!isProjectStatus(row.status)) {
    throw new PersistenceError("invalid_input", "Statut projet invalide en base.");
  }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    status: row.status,
    activeRevision: row.active_revision,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    correlationId: row.correlation_id,
  };
}

export function createSupabaseProjectRepository(deps: {
  client: V2DbClient;
  workspaceId: string;
}): ProjectRepository {
  const { client, workspaceId } = deps;

  return {
    async create(project) {
      if (project.workspaceId !== workspaceId) {
        throw new PersistenceError(
          "invalid_input",
          "workspace_id ne correspond pas à la configuration serveur."
        );
      }
      const { error } = await client.from("video_projects").insert({
        id: project.id,
        workspace_id: workspaceId,
        name: project.name,
        status: project.status,
        active_revision: project.activeRevision,
        schema_version: project.schemaVersion,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
        archived_at: project.archivedAt,
        correlation_id: project.correlationId,
      });
      if (error) throw mapSupabaseError(error);
    },

    async load(projectId) {
      const { data, error } = await client
        .from("video_projects")
        .select("*")
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      return data ? rowToProject(data) : null;
    },

    async saveStatus(
      projectId: string,
      status: ProjectStatus,
      expectedActiveRevision: number,
      updatedAt: string
    ) {
      const { data, error } = await client
        .from("video_projects")
        .update({
          status,
          updated_at: updatedAt,
          archived_at: status === "archived" ? updatedAt : null,
        })
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .eq("active_revision", expectedActiveRevision)
        .select("*")
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) {
        throw new PersistenceError(
          "optimistic_conflict",
          "Conflit de révision optimiste."
        );
      }
      return rowToProject(data);
    },

    async listRecent(limit) {
      const capped = Math.min(Math.max(Math.floor(limit) || 1, 1), 50);
      const { data, error } = await client
        .from("video_projects")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false })
        .limit(capped);
      if (error) throw mapSupabaseError(error);
      return (data ?? []).map(rowToProject);
    },

    async countActiveNonArchived() {
      const { count, error } = await client
        .from("video_projects")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .is("archived_at", null);
      if (error) throw mapSupabaseError(error);
      return count ?? 0;
    },
  };
}
