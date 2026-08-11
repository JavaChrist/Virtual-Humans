/**
 * Motion Transfer persistence mapping (MT-005).
 * REUSE generic V2 tables — no parallel motion_* tables in V1.
 * Never persist signed URLs or binary media in JSONB.
 */

import type { ArtifactType } from "@/domain/project/artifact-types";
import type { MotionMediaRole } from "./media-reference";

export const MOTION_PERSISTENCE_CONTRACT_VERSION = "1.0.0" as const;

/** SQL decision values for human_review_decisions.decision (MT-005b). */
export const MotionHumanReviewDecisionValues = [
  "approved",
  "rejected",
  "retry_same_reference",
  "retry_updated_constraints",
  "request_new_reference",
] as const;
export type MotionHumanReviewDecision =
  (typeof MotionHumanReviewDecisionValues)[number];

/** Domain intent → SQL decision mapping (stable). */
export const MOTION_HUMAN_REVIEW_INTENT = {
  APPROVE: "approved",
  REJECT: "rejected",
  RETRY_WITH_SAME_REFERENCE: "retry_same_reference",
  RETRY_WITH_UPDATED_CONSTRAINTS: "retry_updated_constraints",
  REQUEST_NEW_REFERENCE: "request_new_reference",
} as const satisfies Record<string, MotionHumanReviewDecision>;

/**
 * Asset roles for Motion Transfer Storage/provenance (versioned).
 * Stored in assets.provenance.motionRole — not a SQL CHECK enum.
 */
export const MotionAssetRoleValues = [
  "motion_source_video",
  "motion_identity_reference",
  "motion_outfit_reference",
  "motion_provider_output",
  "motion_qc_evidence",
  "motion_approved_output",
] as const;
export type MotionAssetRole = (typeof MotionAssetRoleValues)[number];

export const MOTION_ASSET_ROLE_TO_MEDIA_ROLE: Record<
  MotionAssetRole,
  MotionMediaRole
> = {
  motion_source_video: "source_video",
  motion_identity_reference: "identity",
  motion_outfit_reference: "outfit",
  motion_provider_output: "output",
  motion_qc_evidence: "qc_evidence",
  motion_approved_output: "output",
};

/** Path segment under .../motion/{segment}/... */
export const MOTION_STORAGE_PATH_SEGMENT: Record<MotionAssetRole, string> = {
  motion_source_video: "source",
  motion_identity_reference: "identity",
  motion_outfit_reference: "outfit",
  motion_provider_output: "output",
  motion_qc_evidence: "qc",
  motion_approved_output: "final",
};

export type MotionAssetRolePolicy = {
  role: MotionAssetRole;
  allowedMime: readonly string[];
  /** DB assets.kind target */
  dbKind: "image" | "video";
  character: "source" | "intermediate" | "final";
  retentionClass: "source_media" | "intermediate" | "final_approved" | "qc_evidence";
};

export const MOTION_ASSET_ROLE_POLICIES: Record<
  MotionAssetRole,
  MotionAssetRolePolicy
> = {
  motion_source_video: {
    role: "motion_source_video",
    allowedMime: ["video/mp4", "video/webm"],
    dbKind: "video",
    character: "source",
    retentionClass: "source_media",
  },
  motion_identity_reference: {
    role: "motion_identity_reference",
    allowedMime: ["image/png", "image/jpeg", "image/webp"],
    dbKind: "image",
    character: "source",
    retentionClass: "source_media",
  },
  motion_outfit_reference: {
    role: "motion_outfit_reference",
    allowedMime: ["image/png", "image/jpeg", "image/webp"],
    dbKind: "image",
    character: "source",
    retentionClass: "source_media",
  },
  motion_provider_output: {
    role: "motion_provider_output",
    allowedMime: ["video/mp4", "video/webm"],
    dbKind: "video",
    character: "intermediate",
    retentionClass: "intermediate",
  },
  motion_qc_evidence: {
    role: "motion_qc_evidence",
    allowedMime: ["image/png", "image/jpeg", "image/webp", "video/mp4"],
    dbKind: "image",
    character: "intermediate",
    retentionClass: "qc_evidence",
  },
  motion_approved_output: {
    role: "motion_approved_output",
    allowedMime: ["video/mp4", "video/webm"],
    dbKind: "video",
    character: "final",
    retentionClass: "final_approved",
  },
};

export type MotionSourceLifecycleStatus =
  | "registered"
  | "validated"
  | "available"
  | "consumed_by_run"
  | "retained"
  | "expired"
  | "quarantined"
  | "deleted";

export type MotionProviderOutputLifecycleStatus =
  | "provider_completed"
  | "downloaded"
  | "checksum_verified"
  | "storage_ingested"
  | "metadata_persisted"
  | "qc_pending"
  | "human_review_pending"
  | "approved"
  | "rejected"
  | "late_quarantined"
  | "cancelled_ignored";

/** How Motion objects map onto generic V2 structures. */
export type MotionPersistenceMapping = {
  object: string;
  representation: string;
  classification:
    | "REUSE_AS_IS"
    | "EXTEND_CODE_ONLY"
    | "LOCAL_MIGRATION_REQUIRED"
    | "FUTURE_ONLY";
  artifactType?: ArtifactType | null;
  notes: string;
};

export const MOTION_PERSISTENCE_MATRIX: readonly MotionPersistenceMapping[] = [
  {
    object: "MotionTransferInput",
    representation: "job.payload jsonb (fingerprints/refs only) + assets rows",
    classification: "EXTEND_CODE_ONLY",
    notes: "No signed URLs/binaries in JSONB.",
  },
  {
    object: "MotionReferenceSpec",
    representation: "job.payload.referenceSpecFingerprint + optional artifact value",
    classification: "EXTEND_CODE_ONLY",
    notes: "Fingerprint required; full spec may ride in payload without media.",
  },
  {
    object: "MotionTransferGenerationPlan",
    representation: "project_artifacts generation_plan (or plan fingerprint in job)",
    classification: "REUSE_AS_IS",
    artifactType: "generation_plan",
    notes: "production_runs require active generation_plan FK.",
  },
  {
    object: "MotionTransferRun",
    representation: "production_runs",
    classification: "REUSE_AS_IS",
    notes: "state jsonb may carry motion capability tag.",
  },
  {
    object: "MotionTransferJob",
    representation: "production_jobs action=motion_transfer",
    classification: "REUSE_AS_IS",
    notes: "action text — no CHECK enum.",
  },
  {
    object: "MotionTransferAttempt",
    representation: "generation_attempts",
    classification: "REUSE_AS_IS",
    notes: "UNIQUE idempotency_key; append provider/model/attempt at runtime.",
  },
  {
    object: "MotionTransferResult",
    representation: "production_result artifact + assets",
    classification: "REUSE_AS_IS",
    artifactType: "production_result",
    notes: "Never final without APPROVE when human gate required.",
  },
  {
    object: "MotionQcResult",
    representation: "quality_report artifact",
    classification: "EXTEND_CODE_ONLY",
    artifactType: "quality_report",
    notes: "Schema MotionQcResult in value jsonb.",
  },
  {
    object: "HumanReviewDecision (motion)",
    representation: "human_review_decisions.decision",
    classification: "LOCAL_MIGRATION_REQUIRED",
    notes: "Extend CHECK beyond approved/rejected for retry intents.",
  },
] as const;

/** Redacted provenance blob for assets.provenance — no URLs/bytes/secrets. */
export type MotionAssetProvenance = {
  schemaVersion: "1.0.0";
  motionRole: MotionAssetRole;
  capability: "video.motion_transfer";
  contentFingerprint: string;
  correlationId: string;
  sourceLifecycle?: MotionSourceLifecycleStatus;
  providerOutputLifecycle?: MotionProviderOutputLifecycleStatus;
  licenseTag?: string;
  consentTag?: string;
  biometricPotential?: boolean;
  providerId?: string;
  externalJobId?: string;
  lateOutput?: boolean;
};

export function assertMotionAssetMimeAllowed(
  role: MotionAssetRole,
  mimeType: string,
): void {
  const policy = MOTION_ASSET_ROLE_POLICIES[role];
  if (!policy.allowedMime.includes(mimeType)) {
    throw new Error(`motion_mime_not_allowed:${role}`);
  }
}

export function isFinalizableMotionReview(
  decision: MotionHumanReviewDecision,
): boolean {
  return decision === "approved";
}

export function isRetryMotionReview(
  decision: MotionHumanReviewDecision,
): boolean {
  return (
    decision === "retry_same_reference" ||
    decision === "retry_updated_constraints" ||
    decision === "request_new_reference"
  );
}
