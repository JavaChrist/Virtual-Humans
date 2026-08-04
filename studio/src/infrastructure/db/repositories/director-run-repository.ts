/**
 * Director run + marketing persist RPCs (VHS-117B / VHS-128 retry).
 */

import type { MarketingDirectorRunPort } from "@/application/directors/marketing/analyze-for-project";
import { isDirectorHumanRetryableErrorCode } from "@/domain/directors/retryable-error-codes";
import type { Json } from "../database.types";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

type BeginRow = {
  status?: string;
  director_run_id?: string;
  revision?: number;
  output_artifact_id?: string | null;
  attempt_number?: number;
  retry_of_run_id?: string | null;
  error_code?: string | null;
  run_status?: string;
};

export function createSupabaseMarketingDirectorRunPort(deps: {
  client: V2DbClient;
  workspaceId: string;
}): MarketingDirectorRunPort {
  const { client, workspaceId } = deps;

  return {
    async beginOrGet(input) {
      const { data, error } = await client.rpc("begin_or_get_marketing_director_run", {
        p_id: input.id,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_input_artifact_id: input.inputArtifactId,
        p_input_revision: input.inputRevision,
        p_model_id: input.modelId,
        p_prompt_version: input.promptVersion,
        p_schema_version: input.schemaVersion,
        p_idempotency_key: input.idempotencyKey,
        p_command_fingerprint: input.commandFingerprint,
        p_correlation_id: input.correlationId,
        p_estimated_cost_minor: input.estimatedCostMinor ?? null,
        p_currency: input.currency ?? null,
      });
      if (error) throw mapSupabaseError(error);
      const row = data as BeginRow;
      if (!row?.director_run_id) {
        throw new PersistenceError("unknown", "Director run incomplete.");
      }
      if (row.status === "already_running") {
        return {
          status: "already_running" as const,
          directorRunId: row.director_run_id,
          revision: row.revision ?? 1,
        };
      }
      if (row.status === "existing") {
        return {
          status: "existing" as const,
          directorRunId: row.director_run_id,
          revision: row.revision ?? 1,
          outputArtifactId: row.output_artifact_id ?? "",
        };
      }
      return {
        status: "created" as const,
        directorRunId: row.director_run_id,
        revision: row.revision ?? 1,
      };
    },

    async beginOrRetry(input) {
      const { data, error } = await client.rpc(
        "begin_or_retry_director_run" as never,
        {
          p_id: input.id,
          p_workspace_id: input.workspaceId,
          p_project_id: input.projectId,
          p_previous_run_id: input.previousRunId,
          p_retry_request_id: input.retryRequestId,
          p_director_type: "marketing",
          p_input_artifact_id: input.inputArtifactId,
          p_input_revision: input.inputRevision,
          p_model_id: input.modelId,
          p_prompt_version: input.promptVersion,
          p_schema_version: input.schemaVersion,
          p_command_fingerprint: input.commandFingerprint,
          p_correlation_id: input.correlationId,
          p_estimated_cost_minor: input.estimatedCostMinor ?? null,
          p_currency: input.currency ?? null,
        } as never
      );
      if (error) throw mapSupabaseError(error);
      const row = data as BeginRow;
      if (!row?.director_run_id) {
        throw new PersistenceError("unknown", "Director retry incomplete.");
      }
      if (row.status === "already_running") {
        return {
          status: "already_running" as const,
          directorRunId: row.director_run_id,
          revision: row.revision ?? 1,
          attemptNumber: row.attempt_number ?? 1,
          retryOfRunId: row.retry_of_run_id ?? input.previousRunId,
        };
      }
      if (row.status === "terminal_replay") {
        return {
          status: "terminal_replay" as const,
          directorRunId: row.director_run_id,
          revision: row.revision ?? 1,
          attemptNumber: row.attempt_number ?? 1,
          retryOfRunId: row.retry_of_run_id ?? input.previousRunId,
          runStatus: row.run_status ?? "failed",
          errorCode: row.error_code ?? undefined,
          outputArtifactId: row.output_artifact_id ?? undefined,
        };
      }
      if (row.status === "existing") {
        return {
          status: "existing" as const,
          directorRunId: row.director_run_id,
          revision: row.revision ?? 1,
          attemptNumber: row.attempt_number ?? 1,
          retryOfRunId: row.retry_of_run_id ?? input.previousRunId,
          outputArtifactId: row.output_artifact_id ?? "",
        };
      }
      return {
        status: "created" as const,
        directorRunId: row.director_run_id,
        revision: row.revision ?? 1,
        attemptNumber: row.attempt_number ?? 1,
        retryOfRunId: row.retry_of_run_id ?? input.previousRunId,
      };
    },

    async reserveBudget(input) {
      const { error } = await client.rpc("reserve_director_budget", {
        p_id: input.reservationId,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_director_run_id: input.directorRunId,
        p_attempt_id: input.attemptId,
        p_amount_minor: input.amountMinor,
        p_currency: input.currency,
        p_correlation_id: input.correlationId,
        p_ledger_idempotency_key: input.ledgerIdempotencyKey,
      });
      if (error) throw mapSupabaseError(error);
    },

    async persistPlan(input) {
      const { data, error } = await client.rpc("persist_marketing_plan", {
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_director_run_id: input.directorRunId,
        p_artifact_id: input.artifactId,
        p_brief_artifact_id: input.briefArtifactId,
        p_brief_revision: input.briefRevision,
        p_plan: input.plan as Json,
        p_schema_version: input.schemaVersion,
        p_correlation_id: input.correlationId,
        p_actor_type: "shared_password",
        p_actor_id: "shared-password-user",
        p_created_by: "shared-password-user",
        p_reservation_id: input.reservationId ?? null,
        p_actual_cost_minor: input.actualCostMinor ?? null,
        p_cost_status: input.costStatus,
        p_usage: (input.usage as Json) ?? null,
        p_expected_run_revision: input.expectedRunRevision,
        p_ledger_idempotency_key: input.ledgerIdempotencyKey ?? null,
      });
      if (error) throw mapSupabaseError(error);
      const row = data as {
        status?: string;
        artifact_id?: string;
        revision?: number;
      };
      if (!row?.artifact_id || row.revision == null) {
        throw new PersistenceError("unknown", "Persist marketing plan incomplete.");
      }
      return {
        status: row.status === "existing" ? "existing" : "created",
        artifactId: row.artifact_id,
        revision: row.revision,
      };
    },

    async failRun(input) {
      const { error } = await client.rpc("fail_director_run", {
        p_director_run_id: input.directorRunId,
        p_workspace_id: input.workspaceId,
        p_expected_revision: input.expectedRevision,
        p_error_code: input.errorCode,
        p_status: input.status,
        p_reservation_id: input.reservationId ?? null,
        p_ledger_idempotency_key: input.reservationId
          ? `dir-release-${input.directorRunId}`
          : null,
        p_correlation_id: input.correlationId,
      });
      if (error) throw mapSupabaseError(error);
    },

    async loadActiveMarketingPlan(projectId) {
      const { data: active, error } = await client
        .from("active_artifact_revisions")
        .select("artifact_id, revision")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("artifact_type", "marketing_plan")
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!active?.artifact_id) return null;
      const { data: art, error: aErr } = await client
        .from("project_artifacts")
        .select("value, revision")
        .eq("id", active.artifact_id)
        .maybeSingle();
      if (aErr) throw mapSupabaseError(aErr);
      if (!art) return null;
      return { revision: art.revision as number, value: art.value };
    },

    async loadRetryableFailedRun(projectId) {
      const { data: activePlan } = await client
        .from("active_artifact_revisions")
        .select("artifact_id")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("artifact_type", "marketing_plan")
        .maybeSingle();
      if (activePlan?.artifact_id) return null;

      const { data, error } = await client
        .from("director_runs" as never)
        .select(
          "id, status, error_code, attempt_number, model_id, prompt_version, schema_version, input_artifact_id, input_revision, output_artifact_id, cost_status"
        )
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("director_type", "marketing")
        .order("attempt_number", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) return null;
      const row = data as {
        id: string;
        status: string;
        error_code: string | null;
        attempt_number: number;
        model_id: string;
        prompt_version: string;
        schema_version: string;
        input_artifact_id: string;
        input_revision: number;
        output_artifact_id: string | null;
        cost_status: string | null;
      };
      if (row.status !== "failed") return null;
      if (!isDirectorHumanRetryableErrorCode(row.error_code)) return null;
      if (row.output_artifact_id) return null;
      if (row.cost_status === "reserved") return null;

      return {
        directorRunId: row.id,
        attemptNumber: row.attempt_number ?? 1,
        errorCode: row.error_code,
        modelId: row.model_id,
        promptVersion: row.prompt_version,
        schemaVersion: row.schema_version,
        inputArtifactId: row.input_artifact_id,
        inputRevision: row.input_revision,
      };
    },
  };
}
