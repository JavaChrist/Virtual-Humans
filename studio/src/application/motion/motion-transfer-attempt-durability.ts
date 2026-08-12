/**
 * MT-013K-DURABILITY — Serialize / hydrate Motion attempt authority via
 * production_jobs.payload (no parallel table, no migration).
 *
 * Process-scoped Map is a reconstructible cache only — never sole authority
 * after a providerJobId or submitCount has been durably written.
 */

import { money } from "@/domain/cost";
import type { MotionTransferInput } from "@/domain/motion";
import type {
  ClaimedProductionJob,
  MotionTransferJobPayloadMeta,
  ProductionPayloadReference,
} from "@/application/production/enqueue";
import {
  FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION,
  FAL_KLING_MOTION_CONTROL_PRICING_VERSION,
} from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-adapter";
import type { MotionTransferAttemptRecord } from "./motion-transfer-worker-orchestrator";

/** Poll-only hydrate stub — never used for a real media submit. */
function pollHydrateMotionInput(durationSeconds: number): MotionTransferInput {
  return {
    schemaVersion: "1.0.0",
    capability: "video.motion_transfer",
    sourceVideo: {
      role: "source_video",
      asset: {
        assetId: "durable-hydrate-source",
        kind: "video",
        mimeType: "video/mp4",
        checksum: "sha256:durable-hydrate-source",
        access: {
          kind: "internal",
          storagePath: "motion/source/durable-hydrate-source.mp4",
        },
      },
      durationSeconds,
    },
    character: {
      characterId: "durable-hydrate",
      identityReferences: [
        {
          role: "identity",
          asset: {
            assetId: "durable-hydrate-identity",
            kind: "character",
            mimeType: "image/png",
            checksum: "sha256:durable-hydrate-identity",
            access: {
              kind: "internal",
              storagePath: "motion/identity/durable-hydrate-identity.png",
            },
          },
        },
      ],
      identityLock: "required",
      outfitLock: "preferred",
      fullBodyRequired: true,
    },
    motion: {
      preserveMotion: true,
      preserveTiming: true,
      preserveCamera: false,
      fidelity: "critical",
      poseControl: "provider_native",
    },
    output: {
      durationSeconds,
      aspectRatio: "9:16",
      resolution: "1080p",
      fps: 24,
    },
    qcRequirements: [
      { code: "technical.decode", severity: "blocking" },
    ],
    correlationId: "durable-hydrate",
  };
}

export const MOTION_TRANSFER_ATTEMPT_DURABILITY_VERSION =
  "mt013k-durability-1.0.0" as const;

/** Redacted durable meta from an attempt record — never signed URLs / media bytes. */
export function serializeMotionAttemptAuthority(
  record: MotionTransferAttemptRecord,
): MotionTransferJobPayloadMeta {
  return {
    phase: record.phase,
    reservationId: record.reservationId,
    reservedMinor: record.reserved.amountMinor,
    currency: record.reserved.currency,
    estimateMinor: record.estimate.estimatedCostMinor,
    estimateDurationSeconds: record.estimate.durationSeconds,
    estimatePricingVersion: record.estimate.pricingVersion,
    estimateModelId: record.estimate.modelId,
    estimateProviderId: record.estimate.providerId,
    adapterVersion: record.adapterVersion,
    pricingVersion: record.estimate.pricingVersion,
    pollCount: record.pollCount,
    submitCount: record.submitCount,
    resubmitCount: record.resubmitCount,
    submitIntentAt: record.submitIntentAt,
    requestFingerprint: record.requestFingerprint,
    outputRef: record.outputRef,
    outputMimeType: record.outputDescriptor?.mimeType,
    outputSizeBytes: record.outputDescriptor?.sizeBytes,
    outputDurationSeconds: record.outputDescriptor?.durationSeconds,
    outputWidth: record.outputDescriptor?.width,
    outputHeight: record.outputDescriptor?.height,
    outputFps: record.outputDescriptor?.fps,
    outputProviderChecksum: record.outputDescriptor?.providerChecksum,
    outputCompletedAt: record.outputDescriptor?.completedAt,
    outputLifecycle: record.outputLifecycle,
    downloadStatus: record.downloadStatus,
    downloadChecksum: record.downloadChecksum,
    ingestStatus: record.ingestStatus,
    ingestedAssetId: record.ingestedAssetId,
    qualityReportId: record.qualityReportId,
    qcStatus: record.qcStatus,
    humanReviewHandoffStatus: record.humanReviewHandoffStatus,
    drainErrorCode: record.drainErrorCode,
    lateResult: record.lateQuarantined,
    lateQuarantined: record.lateQuarantined,
    reconciliationRequired: record.reconciliationRequired,
    usageUnknown: record.usageUnknown,
    terminalSettled: record.ledgerSettled,
    ledgerSettled: record.ledgerSettled,
    terminal: record.terminal,
    deadlineAt: record.deadlineAt,
    humanReviewPolicyPresent: true,
  };
}

export function buildDurableMotionPayload(
  job: ClaimedProductionJob,
  record: MotionTransferAttemptRecord,
  mode: ProductionPayloadReference["mode"],
  opts?: { pollAfterMs?: number; providerJobIdFingerprint?: string },
): ProductionPayloadReference {
  const motion = serializeMotionAttemptAuthority(record);
  if (opts?.providerJobIdFingerprint) {
    motion.providerJobIdFingerprint = opts.providerJobIdFingerprint;
  }
  return {
    planRevisionId: job.payload.planRevisionId,
    scenePackageSceneId: job.payload.scenePackageSceneId,
    mode,
    externalJobId: record.providerJobId ?? job.payload.externalJobId,
    pollAfterMs: opts?.pollAfterMs,
    motion,
  };
}

/**
 * Reconstruct attempt authority from claimed job payload.
 * Sufficient for poll / settle / terminal replay — not for a fresh media submit
 * (signed media refs are never persisted).
 */
export function hydrateMotionTransferAttemptFromJob(
  job: ClaimedProductionJob,
): MotionTransferAttemptRecord | undefined {
  const motion = job.payload.motion;
  if (!motion) return undefined;
  const reservationId = motion.reservationId;
  const reservedMinor = motion.reservedMinor;
  const estimateMinor = motion.estimateMinor;
  if (
    reservationId == null ||
    reservedMinor == null ||
    estimateMinor == null
  ) {
    return undefined;
  }

  const providerJobId = job.payload.externalJobId?.trim() || undefined;
  const submitCount =
    typeof motion.submitCount === "number"
      ? motion.submitCount
      : providerJobId
        ? 1
        : 0;

  const durationSeconds = motion.estimateDurationSeconds ?? 8;
  const estimate = {
    schemaVersion: "1.0.0" as const,
    currency: (motion.currency ?? "USD") as "USD",
    estimatedCostMinor: estimateMinor,
    durationSeconds,
    pricingUnit: "second" as const,
    mode: "firm" as const,
    pricingStrategy: "per_second",
    pricingVersion:
      motion.estimatePricingVersion ??
      motion.pricingVersion ??
      FAL_KLING_MOTION_CONTROL_PRICING_VERSION,
    providerId: motion.estimateProviderId ?? job.providerId,
    modelId: motion.estimateModelId ?? job.modelId,
    capability: "video.motion_transfer" as const,
  };

  // Poll-only stubs — media URLs are never reconstructed from durable state.
  const motionInput = pollHydrateMotionInput(durationSeconds);

  const phase = motion.phase ?? (providerJobId ? "polling" : "submitting");

  return {
    attemptId: job.attemptId,
    jobId: job.jobId,
    runId: job.runId,
    providerJobId,
    reservationId,
    reserved: money(reservedMinor, "USD"),
    estimate,
    submitCount,
    pollCount: typeof motion.pollCount === "number" ? motion.pollCount : 0,
    resubmitCount:
      typeof motion.resubmitCount === "number" ? motion.resubmitCount : 0,
    phase,
    terminal: motion.terminal === true,
    ledgerSettled:
      motion.ledgerSettled === true || motion.terminalSettled === true,
    outputRef: motion.outputRef,
    outputDescriptor:
      motion.outputRef && motion.outputMimeType
        ? {
            providerOutputRef: motion.outputRef,
            mimeType: motion.outputMimeType,
            sizeBytes: motion.outputSizeBytes,
            durationSeconds: motion.outputDurationSeconds,
            width: motion.outputWidth,
            height: motion.outputHeight,
            fps: motion.outputFps,
            providerChecksum: motion.outputProviderChecksum,
            completedAt:
              motion.outputCompletedAt ?? "1970-01-01T00:00:00.000Z",
          }
        : undefined,
    outputLifecycle: motion.outputLifecycle as
      | import("@/domain/motion/persistence").MotionProviderOutputLifecycleStatus
      | undefined,
    downloadStatus: motion.downloadStatus ?? "none",
    downloadChecksum: motion.downloadChecksum,
    ingestStatus: motion.ingestStatus ?? "none",
    ingestedAssetId: motion.ingestedAssetId,
    qualityReportId: motion.qualityReportId,
    qcStatus: motion.qcStatus ?? "none",
    humanReviewHandoffStatus: motion.humanReviewHandoffStatus ?? "none",
    drainErrorCode: motion.drainErrorCode,
    lateQuarantined:
      motion.lateQuarantined === true || motion.lateResult === true,
    usageUnknown: motion.usageUnknown === true,
    reconciliationRequired: motion.reconciliationRequired === true,
    requestFingerprint: motion.requestFingerprint ?? "hydrated",
    submitIntentAt: motion.submitIntentAt,
    adapterVersion:
      motion.adapterVersion ?? FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION,
    mediaBoundary: {
      sourceVideoRef: "durable:omitted",
      identityRefs: ["durable:omitted"],
    },
    motionInput,
    deadlineAt: motion.deadlineAt,
  };
}

/** True when durable state alone can resume poll (providerJobId present). */
export function canResumeMotionPollFromDurableJob(
  job: ClaimedProductionJob,
): boolean {
  const id = job.payload.externalJobId?.trim();
  if (!id) return false;
  if (job.payload.mode === "execute" && !job.payload.motion?.submitCount) {
    // Execute without submitCount may still carry externalJobId after hydrate path.
  }
  return true;
}

/**
 * Crash window: submit started (count≥1) but no durable providerJobId.
 */
export function isMotionSubmissionUnknownFromDurable(
  job: ClaimedProductionJob,
): boolean {
  const motion = job.payload.motion;
  const submitCount = motion?.submitCount ?? 0;
  const providerJobId = job.payload.externalJobId?.trim();
  if (providerJobId) return false;
  if (motion?.phase === "submission_unknown") return true;
  return submitCount >= 1;
}
