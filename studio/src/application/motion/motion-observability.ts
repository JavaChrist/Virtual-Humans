/**
 * Canonical Motion Transfer observability facade (MT-011).
 * Consolidates worker / QC / review event families — no second logging framework.
 */

import { deepFreeze } from "@/domain/motion";
import {
  assertMotionSurfaceRedacted,
  sanitizeMotionValue,
  MOTION_SANITIZER_VERSION,
} from "@/domain/motion/security";

export const MOTION_OBSERVABILITY_CATALOG_VERSION = "mt011-events-1.0.0" as const;

/** Versioned canonical catalog (ticket §3). */
export const MOTION_OBSERVABILITY_EVENT_TYPES = [
  "motion.route.requested",
  "motion.route.selected",
  "motion.route.failed",
  "motion.plan.prepared",
  "motion.plan.rejected",
  "motion.job.enqueued",
  "motion.job.claimed",
  "motion.job.lease_extended",
  "motion.job.released",
  "motion.submit.intent",
  "motion.submit.accepted",
  "motion.submit.failed",
  "motion.submit.unknown",
  "motion.poll.started",
  "motion.poll.progressed",
  "motion.poll.completed",
  "motion.poll.failed",
  "motion.poll.timed_out",
  "motion.output.quarantined",
  "motion.output.ingested",
  "motion.qc.started",
  "motion.qc.completed",
  "motion.qc.failed",
  "motion.review.requested",
  "motion.review.recorded",
  "motion.review.conflict",
  "motion.ledger.reserved",
  "motion.ledger.committed",
  "motion.ledger.released",
  "motion.ledger.reconciliation_required",
  "motion.security.policy_denied",
  "motion.security.redaction_applied",
] as const;

export type MotionObservabilityEventType =
  (typeof MOTION_OBSERVABILITY_EVENT_TYPES)[number];

/** Mandatory correlation fields for every Motion event. */
export type MotionObservabilityBase = {
  type: MotionObservabilityEventType;
  schemaVersion: typeof MOTION_OBSERVABILITY_CATALOG_VERSION;
  correlationId: string;
  workspaceId?: string;
  projectId?: string;
  productionRunId?: string;
  productionJobId?: string;
  generationAttemptId?: string;
  directorRunId?: string;
  providerJobIdFingerprint?: string;
  artifactId?: string;
  assetId?: string;
  reviewRequestId?: string;
  idempotencyFingerprint?: string;
  /** Version provenance — never media. */
  versions?: {
    registry?: string;
    router?: string;
    adapter?: string;
    qcPolicy?: string;
    measurement?: string;
    privacy?: string;
    sanitizer?: string;
  };
  /** Operational metadata only. */
  data?: Record<string, unknown>;
};

export type MotionObservabilityEvent = Readonly<MotionObservabilityBase>;

export type MotionObservabilitySink = {
  emit(event: MotionObservabilityEvent): void;
};

export type MotionObservabilityMemoryStore = MotionObservabilitySink & {
  events: MotionObservabilityEvent[];
};

export function createMemoryMotionObservabilitySink(): MotionObservabilityMemoryStore {
  const events: MotionObservabilityEvent[] = [];
  return {
    events,
    emit(event) {
      events.push(event);
    },
  };
}

/**
 * Map legacy worker/QC/review event type aliases → catalog (best-effort).
 */
export function mapLegacyMotionEventType(
  legacy: string,
): MotionObservabilityEventType | null {
  const map: Record<string, MotionObservabilityEventType> = {
    "motion.job.claimed": "motion.job.claimed",
    "motion.submit.intent": "motion.submit.intent",
    "motion.submit.accepted": "motion.submit.accepted",
    "motion.submit.unknown": "motion.submit.unknown",
    "motion.poll.scheduled": "motion.poll.started",
    "motion.poll.status": "motion.poll.progressed",
    "motion.provider.completed": "motion.poll.completed",
    "motion.provider.failed": "motion.poll.failed",
    "motion.ledger.reconciled": "motion.ledger.committed",
    "motion.qc.pending": "motion.qc.started",
    "motion.late_result": "motion.output.quarantined",
    "motion.qc.started": "motion.qc.started",
    "motion.qc.completed": "motion.qc.completed",
    "motion.qc.rejected": "motion.qc.failed",
    "motion.qc.retry_recommended": "motion.qc.completed",
    "motion.qc.needs_review": "motion.review.requested",
    "motion.review.opened": "motion.review.requested",
    "motion.review.decision.recorded": "motion.review.recorded",
    "motion.review.decision.existing": "motion.review.recorded",
    "motion.review.conflict": "motion.review.conflict",
    "motion.review.rejected": "motion.review.recorded",
    "motion.review.retry_requested": "motion.review.recorded",
    "motion.review.new_reference_requested": "motion.review.recorded",
  };
  return map[legacy] ?? null;
}

export function isMotionObservabilityEventType(
  t: string,
): t is MotionObservabilityEventType {
  return (MOTION_OBSERVABILITY_EVENT_TYPES as readonly string[]).includes(t);
}

/**
 * Emit a sanitized, immutable Motion observability event.
 * Fail-closed if surface contains media/secrets after sanitize.
 */
export function emitMotionObservabilityEvent(
  sink: MotionObservabilitySink | undefined,
  input: Omit<MotionObservabilityBase, "schemaVersion" | "versions"> & {
    versions?: MotionObservabilityBase["versions"];
  },
): MotionObservabilityEvent {
  if (!isMotionObservabilityEventType(input.type)) {
    throw new Error("motion_observability_unknown_event_type");
  }
  if (!input.correlationId?.trim()) {
    throw new Error("motion_observability_correlation_required");
  }

  const sanitizedData = input.data
    ? (sanitizeMotionValue(input.data, {
        preserveKeys: [
          "correlationId",
          "status",
          "phase",
          "httpStatus",
          "providerErrorCode",
          "networkAttempts",
          "mimeType",
          "durationSeconds",
          "fps",
          "sizeBytes",
          "stage",
        ],
      }) as Record<string, unknown>)
    : undefined;

  const event = deepFreeze({
    type: input.type,
    schemaVersion: MOTION_OBSERVABILITY_CATALOG_VERSION,
    correlationId: input.correlationId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    productionRunId: input.productionRunId,
    productionJobId: input.productionJobId,
    generationAttemptId: input.generationAttemptId,
    directorRunId: input.directorRunId,
    providerJobIdFingerprint: input.providerJobIdFingerprint,
    artifactId: input.artifactId,
    assetId: input.assetId,
    reviewRequestId: input.reviewRequestId,
    idempotencyFingerprint: input.idempotencyFingerprint,
    versions: {
      sanitizer: MOTION_SANITIZER_VERSION,
      ...input.versions,
    },
    data: sanitizedData,
  }) as MotionObservabilityEvent;

  assertMotionSurfaceRedacted(event, "motion_observability");
  sink?.emit(event);
  return event;
}

/** Bridge: wrap legacy assert helpers with central sanitizer. */
export function assertMotionObservabilityRedacted(event: unknown): void {
  assertMotionSurfaceRedacted(event, "motion_observability");
}
