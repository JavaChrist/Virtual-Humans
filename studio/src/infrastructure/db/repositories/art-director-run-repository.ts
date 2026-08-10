import type { ArtDirectorRunPort } from "@/application/directors/art/analyze-for-project";
import {
  isLegacyArtTimeoutMisclassified,
  LEGACY_ART_TIMEOUT_RETRY_REASON,
} from "@/domain/directors/legacy-art-timeout-misclassified";
import { isDirectorHumanRetryableErrorCode } from "@/domain/directors/retryable-error-codes";
import type { Json } from "../database.types";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

type BeginRetryRow = {
  status?: string;
  director_run_id?: string;
  revision?: number;
  attempt_number?: number;
  retry_of_run_id?: string | null;
  output_artifact_id?: string | null;
  run_status?: string;
  error_code?: string | null;
  legacy_retry_reason?: string | null;
};

function mapLegacyRetryReason(
  value: string | null | undefined
): typeof LEGACY_ART_TIMEOUT_RETRY_REASON | undefined {
  return value === LEGACY_ART_TIMEOUT_RETRY_REASON
    ? LEGACY_ART_TIMEOUT_RETRY_REASON
    : undefined;
}

export function createSupabaseArtDirectorRunPort(deps: {
  client: V2DbClient;
  workspaceId: string;
}): ArtDirectorRunPort {
  const { client, workspaceId } = deps;
  return {
    async beginOrGet(input) {
      const { data, error } = await client.rpc("begin_or_get_art_director_run" as never, {
        p_id: input.id, p_workspace_id: input.workspaceId, p_project_id: input.projectId,
        p_video_script_artifact_id: input.videoScriptArtifactId, p_video_script_revision: input.videoScriptRevision,
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
      if (!row?.director_run_id) throw new PersistenceError("unknown", "Art run incomplete.");
      if (row.status === "already_running") return { status: "already_running" as const, directorRunId: row.director_run_id, revision: row.revision ?? 1 };
      if (row.status === "existing") return { status: "existing" as const, directorRunId: row.director_run_id, revision: row.revision ?? 1, outputArtifactId: row.output_artifact_id ?? "" };
      return { status: "created" as const, directorRunId: row.director_run_id, revision: row.revision ?? 1 };
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
          p_director_type: "art",
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
      const row = data as BeginRetryRow;
      if (!row?.director_run_id) {
        throw new PersistenceError("unknown", "Art director retry incomplete.");
      }
      if (row.status === "already_running") {
        return {
          status: "already_running" as const,
          directorRunId: row.director_run_id,
          revision: row.revision ?? 1,
          attemptNumber: row.attempt_number ?? 1,
          retryOfRunId: row.retry_of_run_id ?? input.previousRunId,
          legacyRetryReason: mapLegacyRetryReason(row.legacy_retry_reason),
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
          legacyRetryReason: mapLegacyRetryReason(row.legacy_retry_reason),
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
          legacyRetryReason: mapLegacyRetryReason(row.legacy_retry_reason),
        };
      }
      return {
        status: "created" as const,
        directorRunId: row.director_run_id,
        revision: row.revision ?? 1,
        attemptNumber: row.attempt_number ?? 1,
        retryOfRunId: row.retry_of_run_id ?? input.previousRunId,
        legacyRetryReason: mapLegacyRetryReason(row.legacy_retry_reason),
      };
    },

    async reserveBudget(input) {
      const { error } = await client.rpc("reserve_director_budget", {
        p_id: input.reservationId, p_workspace_id: input.workspaceId, p_project_id: input.projectId,
        p_director_run_id: input.directorRunId, p_attempt_id: input.attemptId, p_amount_minor: input.amountMinor,
        p_currency: input.currency, p_correlation_id: input.correlationId, p_ledger_idempotency_key: input.ledgerIdempotencyKey,
      });
      if (error) throw mapSupabaseError(error);
    },
    async persistVisualDirection(input) {
      const { data, error } = await client.rpc("persist_visual_direction" as never, {
        p_workspace_id: input.workspaceId, p_project_id: input.projectId, p_director_run_id: input.directorRunId, p_artifact_id: input.artifactId,
        p_video_script_artifact_id: input.videoScriptArtifactId, p_video_script_revision: input.videoScriptRevision,
        p_creative_concept_artifact_id: input.creativeConceptArtifactId, p_creative_concept_revision: input.creativeConceptRevision,
        p_marketing_plan_artifact_id: input.marketingPlanArtifactId, p_marketing_plan_revision: input.marketingPlanRevision,
        p_brief_artifact_id: input.briefArtifactId, p_brief_revision: input.briefRevision,
        p_visual_direction: input.visualDirection as Json, p_schema_version: input.schemaVersion,
        p_correlation_id: input.correlationId, p_actor_type: "shared_password", p_actor_id: "shared-password-user", p_created_by: "shared-password-user",
        p_reservation_id: input.reservationId ?? null, p_actual_cost_minor: input.actualCostMinor ?? null,
        p_cost_status: input.costStatus, p_usage: (input.usage as Json) ?? null,
        p_expected_run_revision: input.expectedRunRevision, p_ledger_idempotency_key: input.ledgerIdempotencyKey ?? null,
      } as never);
      if (error) throw mapSupabaseError(error);
      const row = data as { status?: string; artifact_id?: string; revision?: number };
      if (!row?.artifact_id || row.revision == null) throw new PersistenceError("unknown", "Persist visual direction incomplete.");
      return { status: row.status === "existing" ? "existing" as const : "created" as const, artifactId: row.artifact_id, revision: row.revision };
    },
    async failRun(input) {
      const knownCost =
        input.actualCostMinor != null && Number.isFinite(input.actualCostMinor);
      const { error } = await client.rpc("fail_director_run", {
        p_director_run_id: input.directorRunId, p_workspace_id: input.workspaceId, p_expected_revision: input.expectedRevision,
        p_error_code: input.errorCode, p_status: input.status, p_reservation_id: input.reservationId ?? null,
        p_ledger_idempotency_key: input.reservationId
          ? knownCost
            ? `dir-fail-commit-${input.directorRunId}`
            : `dir-release-${input.directorRunId}`
          : null,
        p_correlation_id: input.correlationId,
        p_usage: (input.usage as Json) ?? null,
        p_actual_cost_minor: input.actualCostMinor ?? null,
        p_cost_status: input.costStatus ?? null,
      });
      if (error) throw mapSupabaseError(error);
    },
    async loadActiveVisualDirection(projectId) {
      const { data: active, error } = await client.from("active_artifact_revisions").select("artifact_id, revision")
        .eq("workspace_id", workspaceId).eq("project_id", projectId).eq("artifact_type", "visual_direction").maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!active?.artifact_id) return null;
      const { data: artifact, error: artifactError } = await client.from("project_artifacts").select("value, revision").eq("id", active.artifact_id).maybeSingle();
      if (artifactError) throw mapSupabaseError(artifactError);
      return artifact ? { revision: artifact.revision as number, value: artifact.value } : null;
    },

    async loadLatestFailedArtRun(projectId) {
      const { data, error } = await client
        .from("director_runs" as never)
        .select(
          "id, status, error_code, attempt_number, model_id, prompt_version, schema_version, output_artifact_id, retry_of_run_id"
        )
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("director_type", "art")
        .eq("status", "failed")
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
        output_artifact_id: string | null;
        retry_of_run_id: string | null;
      };
      if (!row.error_code) return null;
      return {
        directorRunId: row.id,
        attemptNumber: row.attempt_number ?? 1,
        errorCode: row.error_code,
        modelId: row.model_id,
        promptVersion: row.prompt_version,
        schemaVersion: row.schema_version,
        retryOfRunId: row.retry_of_run_id ?? null,
      };
    },

    async loadRetryableFailedRun(projectId) {
      const { data: activeVd } = await client
        .from("active_artifact_revisions")
        .select("artifact_id")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("artifact_type", "visual_direction")
        .maybeSingle();
      if (activeVd?.artifact_id) return null;

      const { data, error } = await client
        .from("director_runs" as never)
        .select(
          "id, status, director_type, error_code, attempt_number, model_id, prompt_version, schema_version, input_artifact_id, input_revision, output_artifact_id, cost_status, usage, actual_cost_minor, created_at, completed_at"
        )
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("director_type", "art")
        .order("attempt_number", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) return null;
      const row = data as {
        id: string;
        status: string;
        director_type: string;
        error_code: string | null;
        attempt_number: number;
        model_id: string;
        prompt_version: string;
        schema_version: string;
        input_artifact_id: string;
        input_revision: number;
        output_artifact_id: string | null;
        cost_status: string | null;
        usage: unknown;
        actual_cost_minor: number | null;
        created_at: string;
        completed_at: string | null;
      };
      if (row.status !== "failed") return null;
      if (row.output_artifact_id) return null;
      if (row.cost_status === "reserved") return null;

      const legacyTimeoutMisclassified = isLegacyArtTimeoutMisclassified({
        directorType: row.director_type,
        status: row.status,
        errorCode: row.error_code,
        usage: row.usage,
        actualCostMinor: row.actual_cost_minor,
        costStatus: row.cost_status,
        outputArtifactId: row.output_artifact_id,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      });

      if (
        !isDirectorHumanRetryableErrorCode(row.error_code) &&
        !legacyTimeoutMisclassified
      ) {
        return null;
      }
      if (!row.error_code) return null;

      return {
        directorRunId: row.id,
        attemptNumber: row.attempt_number ?? 1,
        errorCode: row.error_code,
        modelId: row.model_id,
        promptVersion: row.prompt_version,
        schemaVersion: row.schema_version,
        inputArtifactId: row.input_artifact_id,
        inputRevision: row.input_revision,
        legacyRetryReason: legacyTimeoutMisclassified
          ? LEGACY_ART_TIMEOUT_RETRY_REASON
          : undefined,
      };
    },
  };
}
