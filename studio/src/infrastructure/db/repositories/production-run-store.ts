/**
 * Supabase ProductionRunStore (VHS-113).
 * Full run state lives in `state` jsonb; operational columns mirror key fields.
 */

import type { ProductionRunStore } from "@/application/production/ports";
import type { ProductionRun } from "@/domain/production";
import { ProductionDomainError } from "@/domain/production";
import { sanitizeProductionRunForPersistence } from "@/application/production/phase-11a-persisted-state-sanitize";
import type { Json } from "../database.types";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

const TERMINAL = new Set(["completed", "partial", "failed", "cancelled"]);

function persistableState(run: ProductionRun): ProductionRun {
  // Fail-closed strip of inline/base64/URL payloads before jsonb write.
  return sanitizeProductionRunForPersistence(run);
}

export function createSupabaseProductionRunStore(deps: {
  client: V2DbClient;
  workspaceId: string;
  /** Resolve plan artifact UUID from plan revision id (domain plan.id). */
  resolvePlanArtifactId: (planRevisionId: string) => Promise<{
    artifactId: string;
    revision: number;
  }>;
}): ProductionRunStore {
  const { client, workspaceId } = deps;

  return {
    async load(runId) {
      const { data, error } = await client
        .from("production_runs")
        .select("state")
        .eq("id", runId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data?.state) return null;
      return data.state as unknown as ProductionRun;
    },

    async create(run) {
      const plan = await deps.resolvePlanArtifactId(run.generationPlanRevisionId);
      const state = persistableState(run);
      const { error } = await client.from("production_runs").insert({
        id: run.id,
        workspace_id: workspaceId,
        project_id: run.projectId,
        generation_plan_artifact_id: plan.artifactId,
        generation_plan_revision: plan.revision,
        status: run.status,
        revision: run.revision,
        policy_version: run.policy.version,
        estimated_cost_minor: run.estimatedCost.amountMinor,
        committed_cost_minor: run.committedCost.amountMinor,
        released_cost_minor: run.releasedCost.amountMinor,
        currency: run.currency,
        created_at: run.createdAt,
        updated_at: run.updatedAt,
        correlation_id: run.correlationId,
        state: state as unknown as Json,
      });
      if (error) throw mapSupabaseError(error);
    },

    async save(run, expectedRevision) {
      const state = persistableState(run);
      const { data, error } = await client
        .from("production_runs")
        .update({
          status: run.status,
          revision: run.revision,
          estimated_cost_minor: run.estimatedCost.amountMinor,
          committed_cost_minor: run.committedCost.amountMinor,
          released_cost_minor: run.releasedCost.amountMinor,
          updated_at: run.updatedAt,
          completed_at: TERMINAL.has(run.status) ? run.updatedAt : null,
          state: state as unknown as Json,
        })
        .eq("id", run.id)
        .eq("workspace_id", workspaceId)
        .eq("revision", expectedRevision)
        .select("state")
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data?.state) {
        throw new ProductionDomainError(
          "optimistic_conflict",
          "Conflit de révision optimiste."
        );
      }
      // Return in-memory sanitized run (not re-hydrated redacted placeholders as source of truth for callers).
      return state;
    },

    async findActiveByPlan(planRevisionId) {
      const plan = await deps.resolvePlanArtifactId(planRevisionId).catch(() => null);
      if (!plan) return null;
      const { data, error } = await client
        .from("production_runs")
        .select("id")
        .eq("generation_plan_artifact_id", plan.artifactId)
        .eq("workspace_id", workspaceId)
        .in("status", ["pending", "validating", "running", "cancelling"])
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      return data?.id ?? null;
    },
  };
}

export function createStaticPlanResolver(
  map: Map<string, { artifactId: string; revision: number }>
): (planRevisionId: string) => Promise<{ artifactId: string; revision: number }> {
  return async (planRevisionId) => {
    const hit = map.get(planRevisionId);
    if (!hit) {
      throw new PersistenceError("not_found", "Plan de génération introuvable.");
    }
    return hit;
  };
}
