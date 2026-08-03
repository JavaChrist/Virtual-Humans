/**
 * ProductionEventPort → domain_events outbox (VHS-113).
 * Payload must already be safe/redacted by the publisher.
 */

import type { ProductionEventPort } from "@/application/production/ports";
import type { ProductionEvent } from "@/domain/production";
import type { Json } from "../database.types";
import { mapSupabaseError } from "../errors";
import type { V2DbClient } from "../supabase-server";

export function createSupabaseProductionEventPort(deps: {
  client: V2DbClient;
  workspaceId: string;
}): ProductionEventPort {
  const { client, workspaceId } = deps;

  return {
    async publish(event: ProductionEvent) {
      const { error } = await client.from("domain_events").insert({
        id: event.id,
        workspace_id: workspaceId,
        project_id: event.projectId,
        run_id: event.runId,
        event_type: event.type,
        aggregate_type: "production_run",
        aggregate_id: event.runId,
        aggregate_revision: 0,
        payload: {
          type: event.type,
          at: event.at,
          sceneId: event.sceneId ?? null,
          stepId: event.stepId ?? null,
          attemptId: event.attemptId ?? null,
          data: event.data ?? null,
        } as Json,
        correlation_id: event.correlationId,
      });
      if (error) throw mapSupabaseError(error);
    },
  };
}
