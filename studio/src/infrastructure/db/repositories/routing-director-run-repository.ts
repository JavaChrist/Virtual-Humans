import {
  createBudgetSnapshotFromAmounts,
  type RoutingBudgetPort,
  type RoutingDirectorRunPort,
} from "@/application/directors/routing/route-for-project";
import type { ArtifactApprovalPort } from "@/application/directors/routing/approve-for-project";
import type { Json } from "../database.types";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

export function createSupabaseRoutingBudgetPort(deps: {
  client: V2DbClient;
}): RoutingBudgetPort {
  const { client } = deps;
  return {
    async loadSnapshot(workspaceId) {
      const { data: policy, error: policyError } = await client
        .from("workspace_budget_policies")
        .select("hard_limit_minor, currency")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (policyError) throw mapSupabaseError(policyError);
      if (!policy) {
        throw new PersistenceError("not_found", "Politique budgétaire introuvable.");
      }

      const { data: reservations, error: resError } = await client
        .from("budget_reservations")
        .select("amount_minor")
        .eq("workspace_id", workspaceId)
        .eq("status", "active");
      if (resError) throw mapSupabaseError(resError);
      const reservedMinor = (reservations ?? []).reduce(
        (sum, row) => sum + Number(row.amount_minor ?? 0),
        0,
      );

      const { data: ledger, error: ledgerError } = await client
        .from("cost_ledger")
        .select("entry_type, amount_minor")
        .eq("workspace_id", workspaceId)
        .in("entry_type", ["commit", "refund", "adjustment"]);
      if (ledgerError) throw mapSupabaseError(ledgerError);

      let spentMinor = 0;
      for (const row of ledger ?? []) {
        const amount = Number(row.amount_minor ?? 0);
        if (row.entry_type === "commit" || row.entry_type === "adjustment") {
          spentMinor += amount;
        } else if (row.entry_type === "refund") {
          spentMinor -= amount;
        }
      }
      if (spentMinor < 0) spentMinor = 0;

      return createBudgetSnapshotFromAmounts({
        limitMinor: Number(policy.hard_limit_minor),
        reservedMinor,
        spentMinor,
        currency: policy.currency,
      });
    },
  };
}

export function createSupabaseRoutingDirectorRunPort(deps: {
  client: V2DbClient;
  workspaceId: string;
}): RoutingDirectorRunPort {
  const { client, workspaceId } = deps;
  return {
    async beginOrGet(input) {
      const { data, error } = await client.rpc("begin_or_get_routing_director_run" as never, {
        p_id: input.id,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_scene_package_set_artifact_id: input.scenePackageSetArtifactId,
        p_scene_package_set_revision: input.scenePackageSetRevision,
        p_storyboard_artifact_id: input.storyboardArtifactId,
        p_storyboard_revision: input.storyboardRevision,
        p_brief_artifact_id: input.briefArtifactId,
        p_brief_revision: input.briefRevision,
        p_registry_version: input.registryVersion,
        p_policy_version: input.policyVersion,
        p_schema_version: input.schemaVersion,
        p_idempotency_key: input.idempotencyKey,
        p_command_fingerprint: input.commandFingerprint,
        p_correlation_id: input.correlationId,
      } as never);
      if (error) throw mapSupabaseError(error);
      const row = data as {
        status?: string;
        director_run_id?: string;
        revision?: number;
        output_artifact_id?: string | null;
      };
      if (!row?.director_run_id) throw new PersistenceError("unknown", "Routing run incomplete.");
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

    async persistGenerationPlan(input) {
      const { data, error } = await client.rpc("persist_generation_plan" as never, {
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_director_run_id: input.directorRunId,
        p_artifact_id: input.artifactId,
        p_scene_package_set_artifact_id: input.scenePackageSetArtifactId,
        p_scene_package_set_revision: input.scenePackageSetRevision,
        p_storyboard_artifact_id: input.storyboardArtifactId,
        p_storyboard_revision: input.storyboardRevision,
        p_brief_artifact_id: input.briefArtifactId,
        p_brief_revision: input.briefRevision,
        p_plan: input.plan as Json,
        p_schema_version: input.schemaVersion,
        p_registry_version: input.registryVersion,
        p_policy_version: input.policyVersion,
        p_estimated_cost_minor: input.estimatedCostMinor,
        p_maximum_exposure_minor: input.maximumExposureMinor,
        p_currency: input.currency,
        p_correlation_id: input.correlationId,
        p_actor_type: "shared_password",
        p_actor_id: "shared-password-user",
        p_created_by: "shared-password-user",
        p_expected_run_revision: input.expectedRunRevision,
      } as never);
      if (error) throw mapSupabaseError(error);
      const row = data as { status?: string; artifact_id?: string; revision?: number };
      if (!row?.artifact_id || row.revision == null) {
        throw new PersistenceError("unknown", "Persist generation plan incomplete.");
      }
      return {
        status: row.status === "existing" ? ("existing" as const) : ("created" as const),
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

    async loadLatestApproval(projectId, artifactType) {
      const { data, error } = await client
        .from("artifact_approvals")
        .select("artifact_id, revision, status, decided_at, decided_by")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("artifact_type", artifactType)
        .order("decided_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) return null;
      if (data.status !== "approved" && data.status !== "rejected") return null;
      return {
        artifactId: data.artifact_id as string,
        revision: data.revision as number,
        status: data.status,
        decidedAt: data.decided_at as string,
        decidedBy: data.decided_by as string,
      };
    },
  };
}

export function createSupabaseArtifactApprovalPort(deps: {
  client: V2DbClient;
}): ArtifactApprovalPort {
  const { client } = deps;
  return {
    async persistApproval(input) {
      const { data, error } = await client.rpc("persist_artifact_approval" as never, {
        p_id: input.id,
        p_workspace_id: input.workspaceId,
        p_project_id: input.projectId,
        p_artifact_type: input.artifactType,
        p_artifact_id: input.artifactId,
        p_revision: input.revision,
        p_status: input.status,
        p_decided_by: input.decidedBy,
        p_comment: input.comment ?? null,
        p_expected_project_revision: input.expectedProjectRevision,
        p_confirmation: input.confirmation,
        p_correlation_id: input.correlationId,
        p_actor_type: "shared_password",
        p_actor_id: input.decidedBy,
      } as never);
      if (error) throw mapSupabaseError(error);
      const row = data as {
        status?: string;
        approval_id?: string;
        project_revision?: number;
        artifact_revision?: number;
      };
      if (!row?.approval_id || row.project_revision == null || row.artifact_revision == null) {
        throw new PersistenceError("unknown", "Persist approval incomplete.");
      }
      return {
        status: row.status === "existing" ? ("existing" as const) : ("created" as const),
        approvalId: row.approval_id,
        projectRevision: row.project_revision,
        artifactRevision: row.artifact_revision,
      };
    },
  };
}
