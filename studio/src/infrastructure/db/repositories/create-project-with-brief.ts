/**
 * Adapter for atomic create_director_project_with_brief RPC (VHS-116).
 */

import type { Json } from "../database.types";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

export type CreateProjectWithBriefRpcInput = {
  workspaceId: string;
  projectId: string;
  artifactId: string;
  projectName: string;
  brief: Record<string, unknown>;
  schemaVersion: string;
  correlationId: string;
  actorType: "shared_password" | "system";
  actorId: string;
  createdBy: string;
};

export type CreateProjectWithBriefRpcResult = {
  status: "created" | "existing";
  projectId: string;
  artifactId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectWithBriefPort = {
  execute(input: CreateProjectWithBriefRpcInput): Promise<CreateProjectWithBriefRpcResult>;
};

export function createSupabaseCreateProjectWithBriefPort(deps: {
  client: V2DbClient;
}): CreateProjectWithBriefPort {
  const { client } = deps;
  return {
    async execute(input) {
      const { data, error } = await client.rpc("create_director_project_with_brief", {
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_artifact_id: input.artifactId,
        p_project_name: input.projectName,
        p_brief: input.brief as Json,
        p_schema_version: input.schemaVersion,
        p_correlation_id: input.correlationId,
        p_actor_type: input.actorType,
        p_actor_id: input.actorId,
        p_created_by: input.createdBy,
      });
      if (error) {
        const mapped = mapSupabaseError(error);
        const msg = error.message?.toLowerCase() ?? "";
        if (/workspace_not_found/.test(msg)) {
          throw new PersistenceError(
            "not_found",
            "Workspace V2 introuvable. Vérifiez DIRECTOR_V2_WORKSPACE_ID.",
            { diagnostic: "workspace_not_found" }
          );
        }
        if (/project_brief_conflict/.test(msg)) {
          throw new PersistenceError(
            "conflict",
            "Ce projet existe déjà avec un brief différent.",
            { diagnostic: "project_brief_conflict" }
          );
        }
        if (/invalid_/.test(msg)) {
          throw new PersistenceError("invalid_input", "Données de création invalides.", {
            diagnostic: msg,
          });
        }
        throw mapped;
      }
      const row = data as {
        status?: string;
        project_id?: string;
        artifact_id?: string;
        revision?: number;
        created_at?: string;
        updated_at?: string;
      } | null;
      if (!row?.project_id || !row.artifact_id) {
        throw new PersistenceError("unknown", "Création de projet incomplète.");
      }
      return {
        status: row.status === "existing" ? "existing" : "created",
        projectId: row.project_id,
        artifactId: row.artifact_id,
        revision: row.revision ?? 1,
        createdAt: row.created_at ?? "",
        updatedAt: row.updated_at ?? "",
      };
    },
  };
}
