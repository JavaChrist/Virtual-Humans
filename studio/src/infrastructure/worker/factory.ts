/**
 * Server factory for ProductionWorker (VHS-114).
 *
 * - Not called at import time
 * - Does not start timers or claim jobs
 * - Does not read secrets into the domain layer
 */

import {
  createProductionWorker,
  type ProductionWorker,
} from "@/application/worker/production-worker";
import type { ProductionWorkerFactoryDeps } from "./dependencies";

/**
 * Build a ProductionWorker. Caller must invoke runOnce explicitly.
 * Never auto-starts; safe to call from server routes later (not in this increment).
 */
export function createProductionWorkerFromDeps(
  dependencies: ProductionWorkerFactoryDeps
): ProductionWorker {
  return createProductionWorker({
    policy: dependencies.policy,
    flags: dependencies.flags,
    queue: dependencies.queue,
    director: dependencies.director,
    engine: dependencies.engine,
    ports: dependencies.ports,
    events: dependencies.events,
    motionTransfer: dependencies.motionTransfer,
  });
}

/** Alias matching the increment contract. */
export const createProductionWorkerFactory = createProductionWorkerFromDeps;
