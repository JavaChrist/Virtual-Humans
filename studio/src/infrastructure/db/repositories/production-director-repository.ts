/**
 * Supabase ports for Production Director lifecycle (VHS-124).
 */
import type {
  ProductionApprovalRecord,
  ProductionDirectorRunPort,
} from "@/application/directors/production/start-for-project";
import type { ProductionRun } from "@/domain/production";
import type { ArtifactType } from "@/domain/project";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

const REQUIRED: readonly ArtifactType[] = [
  "video_project_brief",
  "storyboard_project",
  "generation_plan",
];

const NON_TERMINAL = ["pending", "validating", "running", "cancelling"] as const;
const TERMINAL = ["completed", "partial", "failed", "cancelled"] as const;

export function createSupabaseProductionDirectorRunPort(deps: {
  client: V2DbClient;
  workspaceId: string;
}): ProductionDirectorRunPort {
  const { client, workspaceId } = deps;

  return {
    async beginOrGet(input) {
      const { data, error } = await client.rpc("begin_or_get_production_director_run" as never, {
        p_id: input.id,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_generation_plan_artifact_id: input.generationPlanArtifactId,
        p_generation_plan_revision: input.generationPlanRevision,
        p_idempotency_key: input.idempotencyKey,
        p_command_fingerprint: input.commandFingerprint,
        p_correlation_id: input.correlationId,
      } as never);
      if (error) throw mapSupabaseError(error);
      const row = data as {
        status?: string;
        director_run_id?: string;
        revision?: number;
        production_run_id?: string | null;
      };
      if (!row?.director_run_id) {
        throw new PersistenceError("unknown", "Production director run incomplete.");
      }
      if (row.status === "already_running") {
        return {
          status: "already_running" as const,
          directorRunId: row.director_run_id,
          revision: row.revision ?? 1,
          productionRunId: row.production_run_id ?? null,
        };
      }
      if (row.status === "existing") {
        return {
          status: "existing" as const,
          directorRunId: row.director_run_id,
          revision: row.revision ?? 1,
          productionRunId: row.production_run_id ?? null,
        };
      }
      return {
        status: "created" as const,
        directorRunId: row.director_run_id,
        revision: row.revision ?? 1,
      };
    },

    async complete(input) {
      const { data, error } = await client.rpc("complete_production_director_run" as never, {
        p_director_run_id: input.directorRunId,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_production_run_id: input.productionRunId,
        p_expected_run_revision: input.expectedRunRevision,
        p_correlation_id: input.correlationId,
        p_actor_type: "shared_password",
        p_actor_id: "shared-password-user",
      } as never);
      if (error) throw mapSupabaseError(error);
      const row = data as {
        status?: string;
        production_run_id?: string;
        revision?: number;
      };
      if (!row?.production_run_id) {
        throw new PersistenceError("unknown", "Complete production director run incomplete.");
      }
      return {
        status: row.status === "existing" ? ("existing" as const) : ("created" as const),
        productionRunId: row.production_run_id,
        revision: row.revision ?? 1,
      };
    },

    async failRun(input) {
      const { error } = await client.rpc("fail_director_run", {
        p_director_run_id: input.directorRunId,
        p_workspace_id: input.workspaceId,
        p_expected_revision: input.expectedRevision,
        p_error_code: input.errorCode,
        p_status: input.status,
        p_reservation_id: null,
        p_ledger_idempotency_key: null,
        p_correlation_id: input.correlationId,
      });
      if (error) throw mapSupabaseError(error);
    },

    async loadActiveGenerationPlan(projectId) {
      const { data: active, error } = await client
        .from("active_artifact_revisions")
        .select("artifact_id, revision")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("artifact_type", "generation_plan")
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!active?.artifact_id) return null;
      const { data: artifact, error: artifactError } = await client
        .from("project_artifacts")
        .select("value, revision")
        .eq("id", active.artifact_id)
        .maybeSingle();
      if (artifactError) throw mapSupabaseError(artifactError);
      return artifact
        ? {
            artifactId: active.artifact_id as string,
            revision: artifact.revision as number,
            value: artifact.value,
          }
        : null;
    },

    async loadApprovalsForProduction(projectId) {
      const results: ProductionApprovalRecord[] = [];
      for (const artifactType of REQUIRED) {
        const { data, error } = await client
          .from("artifact_approvals")
          .select("id, artifact_id, revision, status, decided_at, decided_by, artifact_type")
          .eq("workspace_id", workspaceId)
          .eq("project_id", projectId)
          .eq("artifact_type", artifactType)
          .order("decided_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw mapSupabaseError(error);
        if (!data) continue;
        if (data.status !== "approved" && data.status !== "rejected") continue;
        results.push({
          id: data.id as string,
          artifactType,
          artifactId: data.artifact_id as string,
          revision: data.revision as number,
          status: data.status,
          decidedAt: data.decided_at as string,
          decidedBy: data.decided_by as string,
        });
      }
      return results;
    },

    async loadActiveProductionRun(projectId) {
      const { data, error } = await client
        .from("production_runs")
        .select("state")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .in("status", [...NON_TERMINAL])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data?.state) return null;
      return data.state as unknown as ProductionRun;
    },

    async loadProductionRunById(runId) {
      const { data, error } = await client
        .from("production_runs")
        .select("state")
        .eq("workspace_id", workspaceId)
        .eq("id", runId)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data?.state) return null;
      return data.state as unknown as ProductionRun;
    },

    async loadLatestTerminalProductionRun(projectId: string) {
      const { data, error } = await client
        .from("production_runs")
        .select("state")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .in("status", [...TERMINAL])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data?.state) return null;
      return data.state as unknown as ProductionRun;
    },
  };
}
