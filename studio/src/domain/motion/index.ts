/**
 * Motion / Performance Transfer domain public API (MT-001).
 * No provider adapters, router wiring, or engine wiring.
 */

export {
  MOTION_TRANSFER_CAPABILITY,
  NON_MOTION_TRANSFER_VIDEO_CAPABILITIES,
  assertNotI2vOrT2vFallback,
  isMotionTransferCapability,
  type MotionTransferCapability,
  type NonMotionTransferVideoCapability,
} from "./capability";

export {
  MotionTransferDomainError,
  MotionTransferProviderErrorCodeValues,
  MotionTransferQcErrorCodeValues,
  MotionTransferRoutingErrorCodeValues,
  MotionTransferValidationErrorCodeValues,
  isMotionTransferDomainError,
  layerForMotionTransferErrorCode,
  sanitizePublicMessage,
  type MotionTransferErrorCode,
  type MotionTransferErrorLayer,
  type MotionTransferProviderErrorCode,
  type MotionTransferQcErrorCode,
  type MotionTransferRoutingErrorCode,
  type MotionTransferValidationErrorCode,
} from "./errors";

export {
  fingerprintMotionMediaReference,
  validateMotionMediaReference,
  type MotionMediaProvenance,
  type MotionMediaReference,
  type MotionMediaReferenceParseOptions,
  type MotionMediaRole,
} from "./media-reference";

export {
  MOTION_QC_RESULT_SCHEMA_VERSION,
  MOTION_REFERENCE_SPEC_SCHEMA_VERSION,
  MOTION_TRANSFER_ACTION_VERSION,
  MOTION_TRANSFER_DURATION_MAX_SECONDS,
  MOTION_TRANSFER_DURATION_MIN_SECONDS,
  MOTION_TRANSFER_FPS_MAX,
  MOTION_TRANSFER_FPS_MIN,
  MOTION_TRANSFER_INPUT_SCHEMA_VERSION,
  MOTION_TRANSFER_RESULT_SCHEMA_VERSION,
  LockLevelValues,
  MotionFidelityValues,
  MotionQcOverallStatusValues,
  PoseControlModeValues,
  QcSeverityValues,
  QcStatusValues,
  modelSupportsMotionFidelity,
  type LockLevel,
  type MotionBodyRelation,
  type MotionCameraConstraint,
  type MotionCheckpoint,
  type MotionCheckpointResult,
  type MotionFidelity,
  type MotionForbiddenPattern,
  type MotionPhase,
  type MotionQcIssue,
  type MotionQcOverallStatus,
  type MotionQcRequirement,
  type MotionQcResult,
  type MotionReferenceSpec,
  type MotionTimingConstraint,
  type MotionTransferCancelResult,
  type MotionTransferCharacter,
  type MotionTransferEstimate,
  type MotionTransferInput,
  type MotionTransferMotionParams,
  type MotionTransferOutputConstraints,
  type MotionTransferResult,
  type MotionTransferStatus,
  type MotionTransferSubmission,
  type PoseControlMode,
  type QcSeverity,
  type QcStatus,
} from "./types";

export {
  AssetInputRefSchema,
  MotionMediaReferenceSchema,
  MotionQcResultSchema,
  MotionReferenceSpecSchema,
  MotionTransferCancelResultSchema,
  MotionTransferEstimateSchema,
  MotionTransferInputSchema,
  MotionTransferResultSchema,
  MotionTransferStatusSchema,
  MotionTransferSubmissionSchema,
} from "./schemas";

export {
  assertMotionReferenceSpecInvariants,
  assertMotionTransferInputInvariants,
  listIdentityFingerprints,
  parseMotionQcResult,
  parseMotionReferenceSpec,
  parseMotionTransferInput,
  parseMotionTransferResult,
  toPersistableMotionTransferInput,
  type ParseMotionTransferOptions,
} from "./parse";

export {
  buildI2vCollisionProbeFingerprint,
  buildMotionTransferIdempotencyMaterial,
  buildMotionTransferInputFingerprint,
  fingerprintMotionReferenceSpec,
} from "./idempotency";

export {
  assertNoSignedUrlLeak,
  redactMotionMediaReference,
  redactMotionQcResult,
  redactMotionTransferInput,
  redactMotionTransferResult,
  type RedactedMotionMediaReference,
} from "./redact";

export { deepFreeze } from "./freeze";

export {
  MOTION_ASSET_ROLE_POLICIES,
  MOTION_ASSET_ROLE_TO_MEDIA_ROLE,
  MOTION_HUMAN_REVIEW_INTENT,
  MOTION_PERSISTENCE_CONTRACT_VERSION,
  MOTION_PERSISTENCE_MATRIX,
  MOTION_STORAGE_PATH_SEGMENT,
  MotionAssetRoleValues,
  MotionHumanReviewDecisionValues,
  assertMotionAssetMimeAllowed,
  isFinalizableMotionReview,
  isRetryMotionReview,
  type MotionAssetProvenance,
  type MotionAssetRole,
  type MotionAssetRolePolicy,
  type MotionHumanReviewDecision,
  type MotionPersistenceMapping,
  type MotionProviderOutputLifecycleStatus,
  type MotionSourceLifecycleStatus,
} from "./persistence";
