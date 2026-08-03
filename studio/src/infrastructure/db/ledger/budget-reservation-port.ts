/**
 * Supabase BudgetReservationPort via atomic RPCs (VHS-113).
 */

import type { BudgetReservationPort } from "@/application/production/ports";
import { money } from "@/domain/cost";
import { mapSupabaseError } from "../errors";
import type { V2DbClient } from "../supabase-server";

/** Tracks revision per reservation for optimistic commit/release. */
type ReservationMeta = { revision: number; projectId: string };

export function createSupabaseBudgetReservationPort(deps: {
  client: V2DbClient;
  workspaceId: string;
  /** Resolve projectId from runId when not in request (reserve has runId). */
  resolveProjectIdForRun: (runId: string) => Promise<string>;
  correlationId?: string;
}): BudgetReservationPort & { _meta: Map<string, ReservationMeta> } {
  const meta = new Map<string, ReservationMeta>();
  const { client, workspaceId } = deps;

  return {
    _meta: meta,

    async reserve(request) {
      try {
        const projectId = await deps.resolveProjectIdForRun(request.runId);
        const { data, error } = await client.rpc("reserve_budget", {
          p_id: request.reservationId,
          p_workspace_id: workspaceId,
          p_project_id: projectId,
          p_run_id: request.runId,
          p_attempt_id: request.attemptId,
          p_amount_minor: request.amount.amountMinor,
          p_currency: request.currency,
          p_correlation_id: deps.correlationId ?? request.runId,
          p_ledger_idempotency_key: `reserve:${request.reservationId}`,
        });
        if (error) {
          const mapped = mapSupabaseError(error);
          if (mapped.code === "insufficient_funds") {
            return { status: "rejected", reason: "insufficient_funds" };
          }
          return { status: "rejected", reason: mapped.code };
        }
        if (data) {
          meta.set(request.reservationId, {
            revision: data.revision,
            projectId,
          });
        }
        return {
          status: "reserved",
          reservationId: request.reservationId,
          amount: request.amount,
        };
      } catch {
        return { status: "rejected", reason: "unavailable" };
      }
    },

    async commit(request) {
      const m = meta.get(request.reservationId);
      const expected = m?.revision ?? 1;
      const { data, error } = await client.rpc("commit_budget_reservation", {
        p_reservation_id: request.reservationId,
        p_amount_minor: request.amount.amountMinor,
        p_cost_status: request.costKind === "provisional" ? "provisional" : "committed",
        p_ledger_idempotency_key: `commit:${request.reservationId}`,
        p_expected_revision: expected,
      });
      if (error) {
        return { status: "failed", reason: mapSupabaseError(error).code };
      }
      if (data) {
        meta.set(request.reservationId, {
          revision: data.revision,
          projectId: m?.projectId ?? "",
        });
      }
      return {
        status: "committed",
        amount: money(request.amount.amountMinor, request.amount.currency),
        costKind: request.costKind,
      };
    },

    async release(request) {
      const m = meta.get(request.reservationId);
      const expected = m?.revision ?? 1;
      const { error } = await client.rpc("release_budget_reservation", {
        p_reservation_id: request.reservationId,
        p_ledger_idempotency_key: `release:${request.reservationId}`,
        p_expected_revision: expected,
      });
      if (error) {
        return { status: "failed", reason: mapSupabaseError(error).code };
      }
      meta.delete(request.reservationId);
      return { status: "released", amount: request.amount };
    },
  };
}
