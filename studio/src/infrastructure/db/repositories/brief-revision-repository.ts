/**
 * Supabase ports for Brief revision + stale (VHS-126).
 */
import type {
  BriefRevisePort,
  BriefRevisionView,
  StaleArtifactView,
} from "@/application/directors/brief/revise-for-project";
import type { ArtifactType } from "@/domain/project";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

export function createSupabaseBriefRevisePort(deps: {
  client: V2DbClient;
  workspaceId: string;
}): BriefRevisePort {
  const { client, workspaceId } = deps;

  return {
    async revise(input) {
      if (input.workspaceId !== workspaceId) {
        throw new PersistenceError("invalid_input", "workspace mismatch");
      }
      const { data, error } = await client.rpc("revise_project_brief" as never, {
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_new_artifact_id: input.newArtifactId,
        p_brief: input.brief,
        p_schema_version: input.schemaVersion,
        p_expected_brief_revision: input.expectedBriefRevision,
        p_expected_project_revision: input.expectedProjectRevision,
        p_idempotency_key: input.idempotencyKey,
        p_command_fingerprint: input.commandFingerprint,
        p_correlation_id: input.correlationId,
        p_created_by: input.createdBy,
        p_actor_type: input.actorType,
        p_actor_id: input.actorId,
      } as never);
      if (error) throw mapSupabaseError(error);
      const row = data as {
        status?: string;
        artifact_id?: string;
        revision?: number;
        project_revision?: number;
        previous_artifact_id?: string;
        previous_revision?: number;
        restart_point?: string;
        stale_types?: string[] | unknown;
      };
      if (!row?.artifact_id || row.revision == null) {
        throw new PersistenceError("unknown", "revise_project_brief incomplete");
      }
      const staleTypes = Array.isArray(row.stale_types)
        ? row.stale_types.map(String)
        : [];
      return {
        status: row.status === "existing" ? ("existing" as const) : ("created" as const),
        artifactId: row.artifact_id,
        revision: row.revision,
        projectRevision: row.project_revision ?? input.expectedProjectRevision + 1,
        previousArtifactId: row.previous_artifact_id,
        previousRevision: row.previous_revision,
        restartPoint: row.restart_point ?? "marketing_plan",
        staleTypes,
      };
    },

    async listStale(input) {
      const { data, error } = await client.rpc("list_project_stale_artifacts" as never, {
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
      } as never);
      if (error) throw mapSupabaseError(error);
      const rows = (data as unknown[]) ?? [];
      return rows.map((raw) => {
        const r = raw as Record<string, unknown>;
        return {
          artifactType: String(r.artifactType) as ArtifactType,
          artifactId: String(r.artifactId),
          revision: Number(r.revision),
          staleReason: r.staleReason != null ? String(r.staleReason) : null,
          staleSince: r.staleSince != null ? String(r.staleSince) : null,
          causedByType: r.causedByType != null ? String(r.causedByType) : null,
          sourceRevision: r.sourceRevision != null ? Number(r.sourceRevision) : null,
        } satisfies StaleArtifactView;
      });
    },

    async clearStale(input) {
      const { error } = await client.rpc("clear_active_artifact_stale" as never, {
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_artifact_type: input.artifactType,
      } as never);
      if (error) throw mapSupabaseError(error);
    },

    async listBriefRevisions(input) {
      const { data: active, error: aErr } = await client
        .from("active_artifact_revisions")
        .select("artifact_id, revision")
        .eq("workspace_id", input.workspaceId)
        .eq("project_id", input.projectId)
        .eq("artifact_type", "video_project_brief")
        .maybeSingle();
      if (aErr) throw mapSupabaseError(aErr);

      const { data, error } = await client
        .from("project_artifacts")
        .select("id, revision, created_at, value")
        .eq("workspace_id", input.workspaceId)
        .eq("project_id", input.projectId)
        .eq("artifact_type", "video_project_brief")
        .order("revision", { ascending: true });
      if (error) throw mapSupabaseError(error);

      const activeId = active?.artifact_id ?? null;
      return (data ?? []).map((row) => {
        const value = row.value as { projectName?: string } | null;
        return {
          artifactId: row.id,
          revision: row.revision,
          createdAt: row.created_at,
          projectName: value?.projectName ?? "—",
          isActive: row.id === activeId,
        } satisfies BriefRevisionView;
      });
    },
  };
}
