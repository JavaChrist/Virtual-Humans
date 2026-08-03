import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import {
  isDirectorV2WorkerEnabled,
  isDirectorV2PaidGenerationEnabled,
} from "@/infrastructure/config/feature-flags";
import { assertDirectorWorkerSecret } from "@/infrastructure/config/worker-auth";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import {
  generateCorrelationId,
  logger,
  resolveCorrelationId,
  startObservedRoute,
} from "@/infrastructure/observability";

export const dynamic = "force-dynamic";

function redactedWorkerResult(result: {
  status: string;
  workerId: string;
  claimed: number;
  processed: number;
  completed: number;
  rescheduled: number;
  failed: number;
  leaseLost: number;
  providerCalls: number;
  durationMs: number;
  issues: Array<{ code: string; publicMessage: string; jobId?: string; runId?: string; projectId?: string }>;
}) {
  return {
    status: result.status,
    workerId: result.workerId,
    claimed: result.claimed,
    processed: result.processed,
    completed: result.completed,
    rescheduled: result.rescheduled,
    failed: result.failed,
    leaseLost: result.leaseLost,
    providerCalls: result.providerCalls,
    durationMs: result.durationMs,
    providerCalled: result.providerCalls > 0,
    issues: result.issues.map((i) => ({
      code: i.code,
      publicMessage: i.publicMessage,
      // Never expose lease tokens / secrets — jobId/runId are safe ids
      jobId: i.jobId,
      runId: i.runId,
      projectId: i.projectId,
    })),
  };
}

/** GET is never cookie-exempt and never executes the worker. */
export async function GET(req: NextRequest) {
  const obs = startObservedRoute(req, {
    route: "/api/internal/director-worker/run-once",
    operation: "director.worker.run_once",
  });
  return obs.json({ error: "Méthode non autorisée." }, { status: 405 });
}

export async function POST(req: NextRequest) {
  const obs = startObservedRoute(req, {
    route: "/api/internal/director-worker/run-once",
    operation: "director.worker.run_once",
  });

  const secretCheck = assertDirectorWorkerSecret(req.headers.get("x-director-worker-secret"));
  if (!secretCheck.ok) {
    // Generic — never leak whether secret is configured / mismatch details
    logger.info("director.worker.unauthorized", obs.context, {
      reason: secretCheck.reason,
    });
    return obs.json(
      {
        error: "Unauthorized",
        providerCalled: false,
      },
      { status: 401 },
    );
  }

  const workerOn = isDirectorV2WorkerEnabled();
  const paidOn = isDirectorV2PaidGenerationEnabled();

  if (!workerOn || !paidOn) {
    return obs.json({
      status: "disabled",
      providerCalled: false,
      claimed: 0,
      processed: 0,
      workerEnabled: workerOn,
      paidGenerationEnabled: paidOn,
      publicMessage: !workerOn
        ? "DIRECTOR_V2_WORKER_ENABLED off — aucun claim."
        : "DIRECTOR_V2_PAID_GENERATION_ENABLED off — aucun claim provider.",
    });
  }

  const correlationId =
    resolveCorrelationId(req.headers.get("x-correlation-id")) ?? generateCorrelationId();

  try {
    const stack = createDirectorPersistenceStack();
    const worker = stack.createWorker(`api-worker-${randomUUID().slice(0, 8)}`);
    const result = await worker.runOnce({
      correlationId,
      actorId: "director-worker",
      nowIso: () => new Date().toISOString(),
      nowMs: () => Date.now(),
      nextId: () => randomUUID(),
    });
    return obs.json(redactedWorkerResult(result));
  } catch (error) {
    if (error instanceof V2SupabaseConfigError) {
      return obs.json(
        { error: error.message, providerCalled: false },
        { status: 503 },
      );
    }
    logger.error("route.failure", obs.context, error);
    return obs.json(
      {
        status: "failed",
        providerCalled: false,
        error: { code: "internal_error", message: "Worker runOnce impossible." },
      },
      { status: 500 },
    );
  }
}
