/**
 * Explicit server-side dependencies for the production worker (VHS-114).
 * Never instantiated at module import time.
 */

import type { GenerationEngine } from "@/application/generation";
import type { MotionTransferWorkerProcessor } from "@/application/motion/motion-transfer-worker-orchestrator";
import type { ProductionDirector } from "@/application/production/production-director";
import type { ProductionPorts } from "@/application/production/ports";
import type { JobQueuePort } from "@/application/production/enqueue";
import type { WorkerPolicy } from "@/application/worker/policy";
import type { WorkerEventSink } from "@/application/worker/result";
import type { FeatureFlagsSnapshot } from "@/infrastructure/config/feature-flags";

export type ProductionWorkerFactoryDeps = {
  policy: WorkerPolicy;
  flags: FeatureFlagsSnapshot;
  queue: JobQueuePort;
  director: ProductionDirector;
  engine: GenerationEngine;
  ports: ProductionPorts;
  events?: WorkerEventSink;
  /**
   * MT-013K-WIRE — Motion Transfer orchestrator on the canonical worker path.
   * Absent ⇒ motion_transfer jobs fail-closed (`motion_capability_unavailable`).
   */
  motionTransfer?: MotionTransferWorkerProcessor;
};
