/**
 * Supabase RPC wrappers for Phase 5 postproduction delivery (VHS-125).
 * quality / human review / merge / export — no real provider/AICCOS calls here.
 */
import type {
  BeginDeliveryRunResult,
  BeginExportRunInput,
  BeginMergeRunInput,
  BeginQualityRunInput,
  DeliveryDirectorRunPort,
  FailDeliveryRunInput,
  PersistArtifactResult,
  PersistExportPackageInput,
  PersistHumanReviewDecisionInput,
  PersistHumanReviewDecisionResult,
  PersistMergeOutcomeInput,
  PersistProductionResultInput,
  PersistQualityReportInput,
  PersistWithProductionResultResult,
} from "@/application/directors/delivery/ports";
import type { HumanReviewDecision } from "@/domain/postproduction";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

function toBeginResult(row: {
  status?: string;
  director_run_id?: string;
  revision?: number;
  output_artifact_id?: string | null;
}): BeginDeliveryRunResult {
  if (!row?.director_run_id) {
    throw new PersistenceError("unknown", "Delivery director run begin incomplete.");
  }
  if (row.status === "already_running") {
    return {
      status: "already_running",
      directorRunId: row.director_run_id,
      revision: row.revision ?? 1,
      outputArtifactId: row.output_artifact_id ?? null,
    };
  }
  if (row.status === "existing") {
    if (!row.output_artifact_id) {
      throw new PersistenceError("unknown", "Delivery director run existing without output artifact.");
    }
    return {
      status: "existing",
      directorRunId: row.director_run_id,
      revision: row.revision ?? 1,
      outputArtifactId: row.output_artifact_id,
    };
  }
  return { status: "created", directorRunId: row.director_run_id, revision: row.revision ?? 1 };
}

function toPersistWithProductionResult(row: {
  status?: string;
  artifact_id?: string;
  revision?: number;
  production_result_artifact_id?: string;
  production_result_revision?: number;
}): PersistWithProductionResultResult {
  if (
    !row?.artifact_id ||
    row.revision == null ||
    !row.production_result_artifact_id ||
    row.production_result_revision == null
  ) {
    throw new PersistenceError("unknown", "Persist delivery outcome incomplete.");
  }
  return {
    status: row.status === "existing" ? "existing" : "created",
    artifactId: row.artifact_id,
    revision: row.revision,
    productionResultArtifactId: row.production_result_artifact_id,
    productionResultRevision: row.production_result_revision,
  };
}

export function createSupabaseDeliveryDirectorRunPort(deps: {
  client: V2DbClient;
  workspaceId: string;
}): DeliveryDirectorRunPort {
  const { client, workspaceId } = deps;

  return {
    async persistProductionResult(input: PersistProductionResultInput): Promise<PersistArtifactResult> {
      const { data, error } = await client.rpc("persist_production_result" as never, {
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_artifact_id: input.artifactId,
        p_production_run_id: input.productionRunId,
        p_result: input.result,
        p_schema_version: input.schemaVersion,
        p_correlation_id: input.correlationId,
        p_created_by: input.createdBy,
        p_actor_type: input.actorType,
        p_actor_id: input.actorId,
        p_expected_active_revision: input.expectedActiveRevision ?? null,
      } as never);
      if (error) throw mapSupabaseError(error);
      const row = data as { status?: string; artifact_id?: string; revision?: number };
      if (!row?.artifact_id || row.revision == null) {
        throw new PersistenceError("unknown", "Persist production result incomplete.");
      }
      return {
        status: row.status === "existing" ? "existing" : "created",
        artifactId: row.artifact_id,
        revision: row.revision,
      };
    },

    async loadLatestHumanReview(
      projectId: string,
      qualityReportArtifactId: string,
      qualityReportRevision: number,
    ): Promise<HumanReviewDecision | null> {
      const { data, error } = await client
        .from("human_review_decisions")
        .select(
          "id, production_result_artifact_id, production_result_revision, decision, comment, reviewed_issue_codes, created_at, actor_id",
        )
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("quality_report_artifact_id", qualityReportArtifactId)
        .eq("quality_report_revision", qualityReportRevision)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) return null;
      return {
        id: data.id as string,
        productionRunId: "",
        productionResultRevisionId: data.production_result_artifact_id as string,
        productionResultRevision: data.production_result_revision as number,
        status: data.decision as HumanReviewDecision["status"],
        decidedAt: data.created_at as string,
        decidedBy: data.actor_id as string,
        reviewedIssueCodes: (data.reviewed_issue_codes as string[] | null) ?? [],
        comment: (data.comment as string | null) ?? undefined,
      };
    },

    async beginOrGetQualityRun(input: BeginQualityRunInput): Promise<BeginDeliveryRunResult> {
      const { data, error } = await client.rpc("begin_or_get_quality_director_run" as never, {
        p_id: input.id,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_production_result_artifact_id: input.productionResultArtifactId,
        p_production_result_revision: input.productionResultRevision,
        p_idempotency_key: input.idempotencyKey,
        p_command_fingerprint: input.commandFingerprint,
        p_correlation_id: input.correlationId,
      } as never);
      if (error) throw mapSupabaseError(error);
      return toBeginResult(
        data as { status?: string; director_run_id?: string; revision?: number; output_artifact_id?: string | null },
      );
    },

    async persistQualityReport(
      input: PersistQualityReportInput,
    ): Promise<PersistWithProductionResultResult> {
      const { data, error } = await client.rpc("persist_quality_report" as never, {
        p_director_run_id: input.directorRunId,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_artifact_id: input.artifactId,
        p_production_result_artifact_id: input.productionResultArtifactId,
        p_production_result_revision: input.productionResultRevision,
        p_report: input.report,
        p_schema_version: input.schemaVersion,
        p_updated_production_result: input.updatedProductionResult,
        p_production_result_new_id: input.productionResultNewId,
        p_correlation_id: input.correlationId,
        p_created_by: input.createdBy,
        p_actor_type: input.actorType,
        p_actor_id: input.actorId,
        p_expected_run_revision: input.expectedRunRevision,
      } as never);
      if (error) throw mapSupabaseError(error);
      return toPersistWithProductionResult(
        data as {
          status?: string;
          artifact_id?: string;
          revision?: number;
          production_result_artifact_id?: string;
          production_result_revision?: number;
        },
      );
    },

    async persistHumanReviewDecision(
      input: PersistHumanReviewDecisionInput,
    ): Promise<PersistHumanReviewDecisionResult> {
      const { data, error } = await client.rpc("persist_human_review_decision" as never, {
        p_id: input.id,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_quality_report_artifact_id: input.qualityReportArtifactId,
        p_quality_report_revision: input.qualityReportRevision,
        p_production_result_artifact_id: input.productionResultArtifactId,
        p_production_result_revision: input.productionResultRevision,
        p_decision: input.decision,
        p_comment: input.comment ?? null,
        p_reviewed_issue_codes: input.reviewedIssueCodes,
        p_idempotency_key: input.idempotencyKey ?? null,
        p_correlation_id: input.correlationId,
        p_actor_type: input.actorType,
        p_actor_id: input.actorId,
        p_updated_production_result: input.updatedProductionResult,
        p_production_result_new_id: input.productionResultNewId,
        p_expected_production_result_revision: input.expectedProductionResultRevision,
      } as never);
      if (error) throw mapSupabaseError(error);
      const row = data as {
        status?: string;
        decision_id?: string;
        production_result_artifact_id?: string;
        production_result_revision?: number;
      };
      if (!row?.decision_id || !row.production_result_artifact_id || row.production_result_revision == null) {
        throw new PersistenceError("unknown", "Persist human review decision incomplete.");
      }
      return {
        status: row.status === "existing" ? "existing" : "created",
        decisionId: row.decision_id,
        productionResultArtifactId: row.production_result_artifact_id,
        productionResultRevision: row.production_result_revision,
      };
    },

    async beginOrGetMergeRun(input: BeginMergeRunInput): Promise<BeginDeliveryRunResult> {
      const { data, error } = await client.rpc("begin_or_get_merge_director_run" as never, {
        p_id: input.id,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_quality_report_artifact_id: input.qualityReportArtifactId,
        p_quality_report_revision: input.qualityReportRevision,
        p_production_result_artifact_id: input.productionResultArtifactId,
        p_production_result_revision: input.productionResultRevision,
        p_idempotency_key: input.idempotencyKey,
        p_command_fingerprint: input.commandFingerprint,
        p_correlation_id: input.correlationId,
      } as never);
      if (error) throw mapSupabaseError(error);
      return toBeginResult(
        data as { status?: string; director_run_id?: string; revision?: number; output_artifact_id?: string | null },
      );
    },

    async persistMergeOutcome(
      input: PersistMergeOutcomeInput,
    ): Promise<PersistWithProductionResultResult> {
      const { data, error } = await client.rpc("persist_merge_outcome" as never, {
        p_director_run_id: input.directorRunId,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_artifact_id: input.artifactId,
        p_production_result_artifact_id: input.productionResultArtifactId,
        p_production_result_revision: input.productionResultRevision,
        p_merge_outcome: input.mergeOutcome,
        p_schema_version: input.schemaVersion,
        p_merge_status: input.mergeStatus,
        p_updated_production_result: input.updatedProductionResult,
        p_production_result_new_id: input.productionResultNewId,
        p_correlation_id: input.correlationId,
        p_created_by: input.createdBy,
        p_actor_type: input.actorType,
        p_actor_id: input.actorId,
        p_expected_run_revision: input.expectedRunRevision,
      } as never);
      if (error) throw mapSupabaseError(error);
      return toPersistWithProductionResult(
        data as {
          status?: string;
          artifact_id?: string;
          revision?: number;
          production_result_artifact_id?: string;
          production_result_revision?: number;
        },
      );
    },

    async beginOrGetExportRun(input: BeginExportRunInput): Promise<BeginDeliveryRunResult> {
      const { data, error } = await client.rpc("begin_or_get_export_director_run" as never, {
        p_id: input.id,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_merge_plan_artifact_id: input.mergePlanArtifactId,
        p_merge_plan_revision: input.mergePlanRevision,
        p_production_result_artifact_id: input.productionResultArtifactId,
        p_production_result_revision: input.productionResultRevision,
        p_idempotency_key: input.idempotencyKey,
        p_command_fingerprint: input.commandFingerprint,
        p_correlation_id: input.correlationId,
      } as never);
      if (error) throw mapSupabaseError(error);
      return toBeginResult(
        data as { status?: string; director_run_id?: string; revision?: number; output_artifact_id?: string | null },
      );
    },

    async persistExportPackage(
      input: PersistExportPackageInput,
    ): Promise<PersistWithProductionResultResult> {
      const { data, error } = await client.rpc("persist_export_package" as never, {
        p_director_run_id: input.directorRunId,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_artifact_id: input.artifactId,
        p_production_result_artifact_id: input.productionResultArtifactId,
        p_production_result_revision: input.productionResultRevision,
        p_export_package: input.exportPackage,
        p_schema_version: input.schemaVersion,
        p_destination_id: input.destinationId,
        p_updated_production_result: input.updatedProductionResult,
        p_production_result_new_id: input.productionResultNewId,
        p_correlation_id: input.correlationId,
        p_created_by: input.createdBy,
        p_actor_type: input.actorType,
        p_actor_id: input.actorId,
        p_expected_run_revision: input.expectedRunRevision,
      } as never);
      if (error) throw mapSupabaseError(error);
      return toPersistWithProductionResult(
        data as {
          status?: string;
          artifact_id?: string;
          revision?: number;
          production_result_artifact_id?: string;
          production_result_revision?: number;
        },
      );
    },

    async failRun(input: FailDeliveryRunInput): Promise<void> {
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
  };
}
