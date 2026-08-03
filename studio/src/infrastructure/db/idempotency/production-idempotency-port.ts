/**
 * Durable ProductionIdempotencyPort (VHS-113).
 */

import type { ProductionIdempotencyPort } from "@/application/production/ports";
import type { BeginResult, StoredExecution } from "@/domain/generation";
import type { Json } from "../database.types";
import { mapSupabaseError, PersistenceError } from "../errors";
import type { V2DbClient } from "../supabase-server";

export function createSupabaseProductionIdempotencyPort(deps: {
  client: V2DbClient;
  workspaceId: string;
  resolveProjectId: (key: string) => Promise<string>;
}): ProductionIdempotencyPort {
  const { client, workspaceId } = deps;

  return {
    durable: true,

    async find(key) {
      const { data, error } = await client
        .from("idempotency_records")
        .select("key, command_fingerprint, status")
        .eq("key", key)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) return null;
      if (
        data.status !== "begun" &&
        data.status !== "completed" &&
        data.status !== "failed"
      ) {
        throw new PersistenceError("invalid_input", "Statut d'idempotence invalide.");
      }
      return {
        key: data.key,
        fingerprint: data.command_fingerprint,
        status: data.status,
      } satisfies StoredExecution;
    },

    async begin(key, commandFingerprint): Promise<BeginResult> {
      const projectId = await deps.resolveProjectId(key);
      const { data, error } = await client.rpc("idempotency_begin", {
        p_key: key,
        p_workspace_id: workspaceId,
        p_project_id: projectId,
        p_fingerprint: commandFingerprint,
      });
      if (error) throw mapSupabaseError(error);
      if (data === "fingerprint_mismatch") {
        return { status: "conflict", reason: "fingerprint_mismatch" };
      }
      if (data === "already_completed") {
        return { status: "conflict", reason: "already_completed" };
      }
      return { status: "begun" };
    },

    async complete(key, resultFingerprint) {
      const { error } = await client
        .from("idempotency_records")
        .update({
          status: "completed",
          result: { resultFingerprint } as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("key", key)
        .eq("workspace_id", workspaceId)
        .eq("status", "begun");
      if (error) throw mapSupabaseError(error);
    },

    async fail(key, errorCode) {
      const { error } = await client
        .from("idempotency_records")
        .update({
          status: "failed",
          error: { code: errorCode } as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("key", key)
        .eq("workspace_id", workspaceId);
      if (error) throw mapSupabaseError(error);
    },
  };
}
