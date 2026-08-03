/**
 * In-memory fakes — TEST ONLY. Never import from production runtime.
 */

import type { Money } from "@/domain/cost";
import type { ProductionEvent, ProductionRun } from "@/domain/production";
import { ProductionDomainError } from "@/domain/production";
import type {
  BudgetReservationPort,
  ProductionEventPort,
  ProductionIdempotencyPort,
  ProductionRunStore,
  QualityValidatorPort,
} from "../ports";
import { createStructuredQualityValidator } from "../quality-coordinator";
import type {
  BeginResult,
  StoredExecution,
} from "@/domain/generation";

export function createMemoryRunStore(): ProductionRunStore & {
  runs: Map<string, ProductionRun>;
} {
  const runs = new Map<string, ProductionRun>();
  return {
    runs,
    async load(runId) {
      return runs.get(runId) ?? null;
    },
    async create(run) {
      if (runs.has(run.id)) {
        throw new Error("run exists");
      }
      runs.set(run.id, structuredClone(run));
    },
    async save(run, expectedRevision) {
      const prev = runs.get(run.id);
      if (!prev) throw new ProductionDomainError("run_not_found", "missing");
      if (prev.revision !== expectedRevision) {
        throw new ProductionDomainError(
          "optimistic_conflict",
          "Conflit de révision optimiste."
        );
      }
      runs.set(run.id, structuredClone(run));
      return structuredClone(run);
    },
    async findActiveByPlan(planRevisionId) {
      for (const r of runs.values()) {
        if (
          r.generationPlanRevisionId === planRevisionId &&
          r.status !== "completed" &&
          r.status !== "partial" &&
          r.status !== "failed" &&
          r.status !== "cancelled"
        ) {
          return r.id;
        }
      }
      return null;
    },
  };
}

export function createMemoryBudgetPort(limitMinor = 1_000_000): BudgetReservationPort & {
  reserved: Map<string, Money>;
  committed: Map<string, { amount: Money; costKind: string }>;
  released: Map<string, Money>;
} {
  const reserved = new Map<string, Money>();
  const committed = new Map<string, { amount: Money; costKind: string }>();
  const released = new Map<string, Money>();
  let openReserved = 0;

  return {
    reserved,
    committed,
    released,
    async reserve(req) {
      if (req.amount.currency !== req.currency) {
        return { status: "rejected", reason: "currency_mismatch" };
      }
      if (openReserved + req.amount.amountMinor > limitMinor) {
        return { status: "rejected", reason: "insufficient_funds" };
      }
      openReserved += req.amount.amountMinor;
      reserved.set(req.reservationId, req.amount);
      return { status: "reserved", reservationId: req.reservationId, amount: req.amount };
    },
    async commit(req) {
      const r = reserved.get(req.reservationId);
      if (!r) return { status: "failed", reason: "unknown_reservation" };
      committed.set(req.reservationId, { amount: req.amount, costKind: req.costKind });
      openReserved -= r.amountMinor;
      reserved.delete(req.reservationId);
      return { status: "committed", amount: req.amount, costKind: req.costKind };
    },
    async release(req) {
      const r = reserved.get(req.reservationId);
      if (r) {
        openReserved -= Math.min(openReserved, req.amount.amountMinor);
        if (req.amount.amountMinor >= r.amountMinor) reserved.delete(req.reservationId);
      }
      released.set(req.reservationId, req.amount);
      return { status: "released", amount: req.amount };
    },
  };
}

export function createMemoryIdempotencyPort(
  durable = false
): ProductionIdempotencyPort & { entries: Map<string, StoredExecution> } {
  const entries = new Map<string, StoredExecution>();
  return {
    durable,
    entries,
    async find(key) {
      return entries.get(key) ?? null;
    },
    async begin(key, fingerprint): Promise<BeginResult> {
      const existing = entries.get(key);
      if (existing?.status === "completed") {
        return { status: "conflict", reason: "already_completed" };
      }
      if (existing?.status === "begun") {
        if (existing.fingerprint !== fingerprint) {
          return { status: "conflict", reason: "fingerprint_mismatch" };
        }
        return { status: "begun" };
      }
      if (existing?.status === "failed") {
        // Allow retry with new begin after fail
      }
      entries.set(key, { key, fingerprint, status: "begun" });
      return { status: "begun" };
    },
    async complete(key) {
      const e = entries.get(key);
      if (e) entries.set(key, { ...e, status: "completed" });
    },
    async fail(key) {
      const e = entries.get(key);
      if (e) entries.set(key, { ...e, status: "failed" });
    },
  };
}

export function createMemoryEventPort(): ProductionEventPort & {
  events: ProductionEvent[];
  failNext?: boolean;
} {
  const port: ProductionEventPort & { events: ProductionEvent[]; failNext?: boolean } = {
    events: [],
    async publish(event) {
      if (port.failNext) {
        port.failNext = false;
        throw new Error("publish failed");
      }
      port.events.push(event);
    },
  };
  return port;
}

export function createTestQualityPort(): QualityValidatorPort {
  return createStructuredQualityValidator();
}

/** Accepts any asset with a usable source — for orchestration happy-path tests. */
export function createAcceptingQualityPort(): QualityValidatorPort {
  return {
    async validate(request) {
      const hasSource =
        request.asset.source.kind === "temporary_external"
          ? Boolean(request.asset.source.url)
          : request.asset.source.kind === "inline_data_url"
            ? Boolean(request.asset.source.dataUrl)
            : Boolean(request.asset.source.storagePath);
      if (!hasSource || !request.asset.mimeType.includes("/")) {
        return {
          status: "rejected",
          checks: [{ code: "basic", passed: false }],
          reasons: [{ code: "invalid", message: "Asset invalide." }],
          retryableWithFallback: false,
        };
      }
      return {
        status: "accepted",
        checks: [{ code: "basic", passed: true }],
        warnings: [],
      };
    },
  };
}
