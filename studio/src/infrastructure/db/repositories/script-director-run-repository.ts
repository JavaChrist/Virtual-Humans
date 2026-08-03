import type { ScriptDirectorRunPort } from "@/application/directors/script/analyze-for-project";
import type { Json } from "../database.types";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

export function createSupabaseScriptDirectorRunPort(deps: {
  client: V2DbClient;
  workspaceId: string;
}): ScriptDirectorRunPort {
  const { client, workspaceId } = deps;
  return {
    async beginOrGet(input) {
      const { data, error } = await client.rpc("begin_or_get_script_director_run" as never, {
        p_id: input.id, p_workspace_id: input.workspaceId, p_project_id: input.projectId,
        p_creative_concept_artifact_id: input.creativeConceptArtifactId, p_creative_concept_revision: input.creativeConceptRevision,
        p_marketing_plan_artifact_id: input.marketingPlanArtifactId, p_marketing_plan_revision: input.marketingPlanRevision,
        p_brief_artifact_id: input.briefArtifactId, p_brief_revision: input.briefRevision,
        p_model_id: input.modelId, p_prompt_version: input.promptVersion, p_schema_version: input.schemaVersion,
        p_idempotency_key: input.idempotencyKey, p_command_fingerprint: input.commandFingerprint,
        p_correlation_id: input.correlationId, p_estimated_cost_minor: input.estimatedCostMinor ?? null,
        p_currency: input.currency ?? null,
      } as never);
      if (error) throw mapSupabaseError(error);
      const row = data as { status?: string; director_run_id?: string; revision?: number; output_artifact_id?: string | null };
      if (!row?.director_run_id) throw new PersistenceError("unknown", "Script run incomplete.");
      if (row.status === "already_running") return { status: "already_running" as const, directorRunId: row.director_run_id, revision: row.revision ?? 1 };
      if (row.status === "existing") return { status: "existing" as const, directorRunId: row.director_run_id, revision: row.revision ?? 1, outputArtifactId: row.output_artifact_id ?? "" };
      return { status: "created" as const, directorRunId: row.director_run_id, revision: row.revision ?? 1 };
    },
    async reserveBudget(input) {
      const { error } = await client.rpc("reserve_director_budget", {
        p_id: input.reservationId, p_workspace_id: input.workspaceId, p_project_id: input.projectId,
        p_director_run_id: input.directorRunId, p_attempt_id: input.attemptId, p_amount_minor: input.amountMinor,
        p_currency: input.currency, p_correlation_id: input.correlationId, p_ledger_idempotency_key: input.ledgerIdempotencyKey,
      });
      if (error) throw mapSupabaseError(error);
    },
    async persistScript(input) {
      const { data, error } = await client.rpc("persist_video_script" as never, {
        p_workspace_id: input.workspaceId, p_project_id: input.projectId, p_director_run_id: input.directorRunId, p_artifact_id: input.artifactId,
        p_creative_concept_artifact_id: input.creativeConceptArtifactId, p_creative_concept_revision: input.creativeConceptRevision,
        p_marketing_plan_artifact_id: input.marketingPlanArtifactId, p_marketing_plan_revision: input.marketingPlanRevision,
        p_brief_artifact_id: input.briefArtifactId, p_brief_revision: input.briefRevision, p_script: input.script as Json,
        p_schema_version: input.schemaVersion, p_correlation_id: input.correlationId, p_actor_type: "shared_password",
        p_actor_id: "shared-password-user", p_created_by: "shared-password-user", p_reservation_id: input.reservationId ?? null,
        p_actual_cost_minor: input.actualCostMinor ?? null, p_cost_status: input.costStatus, p_usage: (input.usage as Json) ?? null,
        p_expected_run_revision: input.expectedRunRevision, p_ledger_idempotency_key: input.ledgerIdempotencyKey ?? null,
      } as never);
      if (error) throw mapSupabaseError(error);
      const row = data as { status?: string; artifact_id?: string; revision?: number };
      if (!row?.artifact_id || row.revision == null) throw new PersistenceError("unknown", "Persist script incomplete.");
      return { status: row.status === "existing" ? "existing" as const : "created" as const, artifactId: row.artifact_id, revision: row.revision };
    },
    async failRun(input) {
      const { error } = await client.rpc("fail_director_run", {
        p_director_run_id: input.directorRunId, p_workspace_id: input.workspaceId, p_expected_revision: input.expectedRevision,
        p_error_code: input.errorCode, p_status: input.status, p_reservation_id: input.reservationId ?? null,
        p_ledger_idempotency_key: input.reservationId ? `dir-release-${input.directorRunId}` : null, p_correlation_id: input.correlationId,
      });
      if (error) throw mapSupabaseError(error);
    },
    async loadActiveVideoScript(projectId) {
      const { data: active, error } = await client.from("active_artifact_revisions").select("artifact_id, revision")
        .eq("workspace_id", workspaceId).eq("project_id", projectId).eq("artifact_type", "video_script").maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!active?.artifact_id) return null;
      const { data: artifact, error: artifactError } = await client.from("project_artifacts").select("value, revision").eq("id", active.artifact_id).maybeSingle();
      if (artifactError) throw mapSupabaseError(artifactError);
      return artifact ? { revision: artifact.revision as number, value: artifact.value } : null;
    },
  };
}
