/**
 * Motion Transfer domain types (MT-001).
 * Schema versions follow MAJOR.MINOR.PATCH convention (shared SchemaVersion).
 */

import type { BriefAspectRatio } from "@/domain/brief";
import type { MotionMediaReference } from "./media-reference";

export const MOTION_TRANSFER_INPUT_SCHEMA_VERSION = "1.0.0" as const;
export const MOTION_REFERENCE_SPEC_SCHEMA_VERSION = "1.0.0" as const;
export const MOTION_QC_RESULT_SCHEMA_VERSION = "1.0.0" as const;
export const MOTION_TRANSFER_RESULT_SCHEMA_VERSION = "1.0.0" as const;

/** Provider-independent action version embedded in fingerprints. */
export const MOTION_TRANSFER_ACTION_VERSION = "motion-transfer-action-v1" as const;

/** Generic domain duration bounds — not a provider limit. */
export const MOTION_TRANSFER_DURATION_MIN_SECONDS = 0.1;
export const MOTION_TRANSFER_DURATION_MAX_SECONDS = 600;

export const MOTION_TRANSFER_FPS_MIN = 1;
export const MOTION_TRANSFER_FPS_MAX = 120;

export const MotionFidelityValues = ["standard", "high", "critical"] as const;
export type MotionFidelity = (typeof MotionFidelityValues)[number];

export const LockLevelValues = ["required", "preferred"] as const;
export type LockLevel = (typeof LockLevelValues)[number];

export const PoseControlModeValues = [
  "provider_native",
  "derived_pose",
  "none",
] as const;
export type PoseControlMode = (typeof PoseControlModeValues)[number];

export const QcSeverityValues = ["blocking", "warning"] as const;
export type QcSeverity = (typeof QcSeverityValues)[number];

export const QcStatusValues = ["pass", "fail", "unknown", "skipped"] as const;
export type QcStatus = (typeof QcStatusValues)[number];

export const MotionQcOverallStatusValues = [
  "pass",
  "retry",
  "human_review",
  "reject",
] as const;
export type MotionQcOverallStatus = (typeof MotionQcOverallStatusValues)[number];

export type MotionTransferCharacter = {
  characterId: string;
  identityReferences: MotionMediaReference[];
  outfitReference?: MotionMediaReference;
  identityLock: LockLevel;
  outfitLock?: LockLevel;
  fullBodyRequired?: boolean;
};

export type MotionTransferMotionParams = {
  /** Must be true for video.motion_transfer. */
  preserveMotion: boolean;
  preserveTiming: boolean;
  preserveCamera?: boolean;
  fidelity: MotionFidelity;
  poseControl?: PoseControlMode;
};

export type MotionTransferOutputConstraints = {
  durationSeconds?: number;
  aspectRatio: BriefAspectRatio;
  resolution?: string;
  fps?: number;
};

export type MotionQcRequirement = {
  code: string;
  severity: QcSeverity;
  humanValidationRequired?: boolean;
};

export type MotionPhase = {
  phaseId: string;
  order: number;
  title?: string;
  expectedDurationSeconds?: { min?: number; max?: number };
};

export type MotionCheckpoint = {
  checkpointId: string;
  phaseId: string;
  description: string;
  bodyFocus?: string[];
  mandatory: boolean;
};

export type MotionBodyRelation = {
  relationId: string;
  description: string;
  mandatory: boolean;
};

export type MotionForbiddenPattern = {
  patternId: string;
  description: string;
  severity: QcSeverity;
};

export type MotionTimingConstraint = {
  constraintId: string;
  description: string;
  preserveRelativeTiming: boolean;
};

export type MotionCameraConstraint = {
  constraintId: string;
  preserveCamera: boolean;
  notes?: string;
};

export type MotionReferenceSpec = {
  schemaVersion: typeof MOTION_REFERENCE_SPEC_SCHEMA_VERSION;
  movementId: string;
  version: string;
  title: string;
  phases: MotionPhase[];
  checkpoints: MotionCheckpoint[];
  bodyRelations: MotionBodyRelation[];
  forbiddenPatterns: MotionForbiddenPattern[];
  timingConstraints: MotionTimingConstraint[];
  cameraConstraints: MotionCameraConstraint[];
  qcRequirements: MotionQcRequirement[];
  humanValidationRequired: boolean;
};

export type MotionTransferInput = {
  schemaVersion: typeof MOTION_TRANSFER_INPUT_SCHEMA_VERSION;
  capability: "video.motion_transfer";
  sourceVideo: MotionMediaReference;
  character: MotionTransferCharacter;
  motion: MotionTransferMotionParams;
  referenceSpec?: MotionReferenceSpec;
  output: MotionTransferOutputConstraints;
  prompt?: string;
  negativeConstraints?: string[];
  qcRequirements: MotionQcRequirement[];
  correlationId: string;
};

export type MotionCheckpointResult = {
  checkpointId: string;
  status: QcStatus;
  notes?: string;
};

export type MotionQcIssue = {
  code: string;
  severity: QcSeverity;
  message: string;
};

export type MotionQcResult = {
  schemaVersion: typeof MOTION_QC_RESULT_SCHEMA_VERSION;
  motionFidelity: QcStatus;
  identityFidelity: QcStatus;
  outfitFidelity: QcStatus;
  cameraCompliance: QcStatus;
  bodyIntegrity: QcStatus;
  temporalConsistency: QcStatus;
  checkpointResults: MotionCheckpointResult[];
  issues: MotionQcIssue[];
  overallStatus: MotionQcOverallStatus;
  humanValidationRequired: boolean;
};

/** Estimate firmness — non-firm estimates must not drive paid reservations. */
export const MotionTransferEstimateModeValues = ["firm", "indicative"] as const;
export type MotionTransferEstimateMode =
  (typeof MotionTransferEstimateModeValues)[number];

export type MotionTransferEstimate = {
  schemaVersion: "1.0.0";
  currency: string;
  estimatedCostMinor: number;
  durationSeconds?: number;
  pricingUnit?: "second" | "job";
  notes?: string[];
  /** MT-006 — firm | indicative */
  mode?: MotionTransferEstimateMode;
  pricingStrategy?: string;
  pricingVersion?: string;
  assumptions?: string[];
  expiresAt?: string;
  providerId?: string;
  modelId?: string;
  capability?: "video.motion_transfer";
  capabilityVersion?: string;
};

export type MotionTransferSubmission = {
  schemaVersion: "1.0.0";
  status: "submitted";
  providerJobId: string;
  submittedAt: string;
  /** Alias acceptedAt — same instant as submittedAt when present. */
  acceptedAt?: string;
  syncOrAsync?: "sync" | "async";
  pollingRequired?: boolean;
  estimatedCompletionAt?: string;
  /** Redacted provider request metadata — never URLs, keys, or media. */
  requestMetadataRedacted?: Record<string, unknown>;
};

/**
 * Canonical Motion Transfer job statuses (domain).
 * Provider vocabulary mapping (MT-006):
 *   running → processing
 *   succeeded → completed
 *   timed_out → timed_out (terminal)
 */
export const MotionTransferJobStatusValues = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "timed_out",
] as const;
export type MotionTransferJobStatus =
  (typeof MotionTransferJobStatusValues)[number];

export type MotionTransferStatus = {
  schemaVersion: "1.0.0";
  status: MotionTransferJobStatus;
  providerJobId: string;
  progressPercent?: number;
  errorCode?: string;
  updatedAt: string;
  /** Present only on terminal success — descriptors only, no signed URLs. */
  output?: MotionTransferProviderOutputDescriptor;
  usage?: { durationSeconds?: number; units?: number };
  actualCostMinor?: number;
  currency?: string;
};

export type MotionTransferProviderOutputDescriptor = {
  /** Opaque provider-side reference — not a signed URL. */
  providerOutputRef: string;
  mimeType: string;
  sizeBytes?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  providerChecksum?: string;
  completedAt: string;
};

export const MotionTransferCancelStatusValues = [
  "cancelled",
  "cancel_unsupported",
  "already_terminal",
  "cancel_failed",
] as const;
export type MotionTransferCancelStatus =
  (typeof MotionTransferCancelStatusValues)[number];

export type MotionTransferCancelResult = {
  schemaVersion: "1.0.0";
  status: MotionTransferCancelStatus;
  providerJobId: string;
  /** True when a late provider result must be quarantined (future ingestion). */
  lateResultExpected?: boolean;
};

export type MotionTransferResult = {
  schemaVersion: typeof MOTION_TRANSFER_RESULT_SCHEMA_VERSION;
  status: "completed" | "failed" | "cancelled";
  asset?: MotionMediaReference;
  providerId?: string;
  modelId?: string;
  providerJobId?: string;
  usage?: { durationSeconds?: number; units?: number };
  costMinor?: number;
  provenance?: Record<string, unknown>;
  qc?: MotionQcResult;
  errorCode?: string;
  publicMessage?: string;
};

/**
 * Router-facing invariant helper (no provider selected in MT-001).
 * `critical` requires the model capability declaration to include that fidelity.
 */
export function modelSupportsMotionFidelity(
  fidelity: MotionFidelity,
  declaredLevels: readonly MotionFidelity[] | undefined,
): boolean {
  if (!declaredLevels || declaredLevels.length === 0) return false;
  return declaredLevels.includes(fidelity);
}
