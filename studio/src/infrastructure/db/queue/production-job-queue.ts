/**
 * Durable production job queue (VHS-113).
 * Claim / heartbeat / complete / fail via SECURITY DEFINER RPCs.
 */

import { MOTION_TRANSFER_QUEUE_RECLAIM_MAX_ATTEMPTS } from "@/application/motion/durable-resume-motion-input";
import type { Json } from "../database.types";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

export type ProductionJobRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  runId: string;
  sceneId: string;
  stepId: string;
  attemptId: string;
  action: string;
  providerId: string;
  modelId: string;
  status: string;
  priority: number;
  leaseToken: string | null;
  leasedBy: string | null;
  payload: unknown;
  result: unknown;
  error: unknown;
};

function rowToJob(row: {
  id: string;
  workspace_id: string;
  project_id: string;
  run_id: string;
  scene_id: string;
  step_id: string;
  attempt_id: string;
  action: string;
  provider_id: string;
  model_id: string;
  status: string;
  priority: number;
  lease_token: string | null;
  leased_by: string | null;
  payload: Json;
  result: Json | null;
  error: Json | null;
}): ProductionJobRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    runId: row.run_id,
    sceneId: row.scene_id,
    stepId: row.step_id,
    attemptId: row.attempt_id,
    action: row.action,
    providerId: row.provider_id,
    modelId: row.model_id,
    status: row.status,
    priority: row.priority,
    leaseToken: row.lease_token,
    leasedBy: row.leased_by,
    payload: row.payload,
    result: row.result,
    error: row.error,
  };
}

export type ProductionJobQueue = {
  enqueue(job: {
    id: string;
    projectId: string;
    runId: string;
    sceneId: string;
    stepId: string;
    attemptId: string;
    action: string;
    providerId: string;
    modelId: string;
    priority?: number;
    payload: Record<string, unknown>;
    maxAttempts?: number;
  }): Promise<void>;
  claim(workerId: string, limit: number, leaseSeconds: number): Promise<ProductionJobRecord[]>;
  heartbeat(
    jobId: string,
    leaseToken: string,
    workerId: string,
    leaseSeconds?: number
  ): Promise<ProductionJobRecord>;
  complete(
    jobId: string,
    leaseToken: string,
    workerId: string,
    result: Record<string, unknown>
  ): Promise<ProductionJobRecord>;
  fail(
    jobId: string,
    leaseToken: string,
    workerId: string,
    error: { code: string; publicMessage: string }
  ): Promise<ProductionJobRecord>;
  release(
    jobId: string,
    leaseToken: string,
    workerId: string,
    availableAt?: string
  ): Promise<ProductionJobRecord>;
  /** VHS-114 — release + payload update (mode poll). Requires migration 20260804134537. */
  reschedule(
    jobId: string,
    leaseToken: string,
    workerId: string,
    availableAt: string,
    payload: Record<string, unknown>
  ): Promise<ProductionJobRecord>;
  /**
   * MT-013K-DURABILITY — update payload under active lease (no release).
   * Uses service_role row update + lease predicates — no new migration.
   */
  persistLeasedPayload(
    jobId: string,
    leaseToken: string,
    workerId: string,
    payload: Record<string, unknown>
  ): Promise<ProductionJobRecord>;
};

export function createSupabaseProductionJobQueue(deps: {
  client: V2DbClient;
  workspaceId: string;
}): ProductionJobQueue {
  const { client, workspaceId } = deps;

  return {
    async enqueue(job) {
      const { error } = await client.from("production_jobs").insert({
        id: job.id,
        workspace_id: workspaceId,
        project_id: job.projectId,
        run_id: job.runId,
        scene_id: job.sceneId,
        step_id: job.stepId,
        attempt_id: job.attemptId,
        action: job.action,
        provider_id: job.providerId,
        model_id: job.modelId,
        status: "queued",
        priority: job.priority ?? 100,
        payload: job.payload as Json,
        // motion_transfer: max_attempts = queue reclaim budget (NOT provider submit).
        // Provider submit max remains payload.motion.submitCount (=1).
        max_attempts:
          job.maxAttempts ??
          (job.action === "motion_transfer"
            ? MOTION_TRANSFER_QUEUE_RECLAIM_MAX_ATTEMPTS
            : 3),
      });
      if (error) throw mapSupabaseError(error);
    },

    async claim(workerId, limit, leaseSeconds) {
      // claim_production_jobs is global across workspaces. Bound retries while
      // releasing foreign leases so a noisy sibling workspace cannot starve us.
      const mine: Array<Parameters<typeof rowToJob>[0]> = [];
      for (let attempt = 0; attempt < 8 && mine.length < limit; attempt += 1) {
        const { data, error } = await client.rpc("claim_production_jobs", {
          p_worker_id: workerId,
          p_limit: limit,
          p_lease_seconds: leaseSeconds,
        });
        if (error) throw mapSupabaseError(error);
        const rows = data ?? [];
        if (rows.length === 0) break;
        let foreign = 0;
        for (const row of rows) {
          if (row.workspace_id === workspaceId) {
            mine.push(row);
            continue;
          }
          foreign += 1;
          if (row.lease_token && row.id) {
            try {
              await client.rpc("release_production_job", {
                p_job_id: row.id,
                p_lease_token: row.lease_token,
                p_worker_id: workerId,
                p_available_at: null,
              });
            } catch {
              // best-effort release of foreign lease
            }
          }
        }
        if (foreign === 0) break;
      }
      return mine.slice(0, limit).map(rowToJob);
    },

    async heartbeat(jobId, leaseToken, workerId, leaseSeconds = 60) {
      const { data, error } = await client.rpc("heartbeat_production_job", {
        p_job_id: jobId,
        p_lease_token: leaseToken,
        p_worker_id: workerId,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw mapSupabaseError(error);
      if (!data) throw new PersistenceError("not_found", "Job introuvable.");
      return rowToJob(data);
    },

    async complete(jobId, leaseToken, workerId, result) {
      const { data, error } = await client.rpc("complete_production_job", {
        p_job_id: jobId,
        p_lease_token: leaseToken,
        p_worker_id: workerId,
        p_result: result as Json,
      });
      if (error) throw mapSupabaseError(error);
      if (!data) throw new PersistenceError("not_found", "Job introuvable.");
      return rowToJob(data);
    },

    async fail(jobId, leaseToken, workerId, err) {
      const { data, error } = await client.rpc("fail_production_job", {
        p_job_id: jobId,
        p_lease_token: leaseToken,
        p_worker_id: workerId,
        p_error: err as unknown as Json,
      });
      if (error) throw mapSupabaseError(error);
      if (!data) throw new PersistenceError("not_found", "Job introuvable.");
      return rowToJob(data);
    },

    async release(jobId, leaseToken, workerId, availableAt) {
      const { data, error } = await client.rpc("release_production_job", {
        p_job_id: jobId,
        p_lease_token: leaseToken,
        p_worker_id: workerId,
        p_available_at: availableAt,
      });
      if (error) throw mapSupabaseError(error);
      if (!data) throw new PersistenceError("not_found", "Job introuvable.");
      return rowToJob(data);
    },

    async reschedule(jobId, leaseToken, workerId, availableAt, payload) {
      const { data, error } = await client.rpc("reschedule_production_job", {
        p_job_id: jobId,
        p_lease_token: leaseToken,
        p_worker_id: workerId,
        p_available_at: availableAt,
        p_payload: payload as Json,
      });
      if (error) throw mapSupabaseError(error);
      if (!data) throw new PersistenceError("not_found", "Job introuvable.");
      return rowToJob(data);
    },

    async persistLeasedPayload(jobId, leaseToken, workerId, payload) {
      const externalJobId =
        typeof payload.externalJobId === "string" ? payload.externalJobId : null;
      const { data, error } = await client
        .from("production_jobs")
        .update({
          payload: payload as Json,
          ...(externalJobId ? { external_job_id: externalJobId } : {}),
        })
        .eq("id", jobId)
        .eq("workspace_id", workspaceId)
        .eq("lease_token", leaseToken)
        .eq("leased_by", workerId)
        .eq("status", "leased")
        .select("*")
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) {
        throw new PersistenceError(
          "lease_invalid",
          "persistLeasedPayload — lease invalide ou job introuvable.",
        );
      }
      return rowToJob(data);
    },
  };
}
