/**
 * Zod schemas for Motion Transfer domain (MT-001).
 */

import { z } from "zod";
import { AspectRatioValues } from "@/domain/brief";
import { DomainIdSchema } from "@/domain/shared";
import {
  MOTION_QC_RESULT_SCHEMA_VERSION,
  MOTION_REFERENCE_SPEC_SCHEMA_VERSION,
  MOTION_TRANSFER_DURATION_MAX_SECONDS,
  MOTION_TRANSFER_DURATION_MIN_SECONDS,
  MOTION_TRANSFER_FPS_MAX,
  MOTION_TRANSFER_FPS_MIN,
  MOTION_TRANSFER_INPUT_SCHEMA_VERSION,
  MOTION_TRANSFER_RESULT_SCHEMA_VERSION,
  LockLevelValues,
  MotionFidelityValues,
  MotionQcOverallStatusValues,
  MotionTransferCancelStatusValues,
  MotionTransferEstimateModeValues,
  MotionTransferJobStatusValues,
  PoseControlModeValues,
  QcSeverityValues,
  QcStatusValues,
} from "./types";
import { MOTION_TRANSFER_CAPABILITY } from "./capability";

const AssetKindSchema = z.enum([
  "character",
  "outfit",
  "expression",
  "pose",
  "product",
  "background",
  "brand",
  "screen",
  "voice",
  "image",
  "video",
  "audio",
  "step_output",
]);

const AssetAccessSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("internal"),
    storagePath: z.string().min(1).max(1024),
  }),
  z.object({
    kind: z.literal("signed_url"),
    url: z.string().min(1).max(4096),
    expiresAt: z.string().min(1),
  }),
  z.object({
    kind: z.literal("data_url"),
    dataUrl: z.string().min(1),
  }),
]);

export const AssetInputRefSchema = z.object({
  assetId: DomainIdSchema,
  kind: AssetKindSchema,
  mimeType: z.string().min(1).max(128).optional(),
  checksum: z.string().min(1).max(128).optional(),
  access: AssetAccessSchema,
});

export const MotionMediaProvenanceSchema = z
  .object({
    sourceKind: z.string().min(1).max(64).optional(),
    providerId: z.string().min(1).max(64).optional(),
    externalAssetId: z.string().min(1).max(160).optional(),
    capturedAt: z.string().min(1).max(64).optional(),
    licenseTag: z.string().min(1).max(64).optional(),
    consentTag: z.string().min(1).max(64).optional(),
  })
  .strict();

export const MotionMediaRoleSchema = z.enum([
  "source_video",
  "identity",
  "outfit",
  "qc_evidence",
  "output",
  "other",
]);

export const MotionMediaReferenceSchema = z.object({
  asset: AssetInputRefSchema,
  role: MotionMediaRoleSchema,
  durationSeconds: z.number().positive().max(3600).optional(),
  width: z.number().int().positive().max(16384).optional(),
  height: z.number().int().positive().max(16384).optional(),
  provenance: MotionMediaProvenanceSchema.optional(),
});

export const MotionQcRequirementSchema = z.object({
  code: z.string().min(1).max(160),
  severity: z.enum(QcSeverityValues),
  humanValidationRequired: z.boolean().optional(),
});

export const MotionPhaseSchema = z.object({
  phaseId: DomainIdSchema,
  order: z.number().int().nonnegative(),
  title: z.string().min(1).max(200).optional(),
  expectedDurationSeconds: z
    .object({
      min: z.number().positive().optional(),
      max: z.number().positive().optional(),
    })
    .optional(),
});

export const MotionCheckpointSchema = z.object({
  checkpointId: DomainIdSchema,
  phaseId: DomainIdSchema,
  description: z.string().min(1).max(2000),
  bodyFocus: z.array(z.string().min(1).max(64)).max(32).optional(),
  mandatory: z.boolean(),
});

export const MotionBodyRelationSchema = z.object({
  relationId: DomainIdSchema,
  description: z.string().min(1).max(2000),
  mandatory: z.boolean(),
});

export const MotionForbiddenPatternSchema = z.object({
  patternId: DomainIdSchema,
  description: z.string().min(1).max(2000),
  severity: z.enum(QcSeverityValues),
});

export const MotionTimingConstraintSchema = z.object({
  constraintId: DomainIdSchema,
  description: z.string().min(1).max(2000),
  preserveRelativeTiming: z.boolean(),
});

export const MotionCameraConstraintSchema = z.object({
  constraintId: DomainIdSchema,
  preserveCamera: z.boolean(),
  notes: z.string().min(1).max(2000).optional(),
});

export const MotionReferenceSpecSchema = z.object({
  schemaVersion: z.literal(MOTION_REFERENCE_SPEC_SCHEMA_VERSION),
  movementId: DomainIdSchema,
  version: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  phases: z.array(MotionPhaseSchema).max(64),
  checkpoints: z.array(MotionCheckpointSchema).max(256),
  bodyRelations: z.array(MotionBodyRelationSchema).max(128),
  forbiddenPatterns: z.array(MotionForbiddenPatternSchema).max(128),
  timingConstraints: z.array(MotionTimingConstraintSchema).max(64),
  cameraConstraints: z.array(MotionCameraConstraintSchema).max(32),
  qcRequirements: z.array(MotionQcRequirementSchema).max(128),
  humanValidationRequired: z.boolean(),
});

export const MotionTransferCharacterSchema = z.object({
  characterId: DomainIdSchema,
  identityReferences: z.array(MotionMediaReferenceSchema).max(16),
  outfitReference: MotionMediaReferenceSchema.optional(),
  identityLock: z.enum(LockLevelValues),
  outfitLock: z.enum(LockLevelValues).optional(),
  fullBodyRequired: z.boolean().optional(),
});

export const MotionTransferMotionParamsSchema = z.object({
  preserveMotion: z.boolean(),
  preserveTiming: z.boolean(),
  preserveCamera: z.boolean().optional(),
  fidelity: z.enum(MotionFidelityValues),
  poseControl: z.enum(PoseControlModeValues).optional(),
});

export const MotionTransferOutputConstraintsSchema = z.object({
  durationSeconds: z
    .number()
    .gt(MOTION_TRANSFER_DURATION_MIN_SECONDS - 1e-9)
    .max(MOTION_TRANSFER_DURATION_MAX_SECONDS)
    .optional(),
  aspectRatio: z.enum(AspectRatioValues),
  resolution: z.string().min(1).max(32).optional(),
  fps: z
    .number()
    .int()
    .min(MOTION_TRANSFER_FPS_MIN)
    .max(MOTION_TRANSFER_FPS_MAX)
    .optional(),
});

export const MotionTransferInputSchema = z
  .object({
    schemaVersion: z.literal(MOTION_TRANSFER_INPUT_SCHEMA_VERSION),
    capability: z.literal(MOTION_TRANSFER_CAPABILITY),
    sourceVideo: MotionMediaReferenceSchema,
    character: MotionTransferCharacterSchema,
    motion: MotionTransferMotionParamsSchema,
    referenceSpec: MotionReferenceSpecSchema.optional(),
    output: MotionTransferOutputConstraintsSchema,
    prompt: z.string().min(1).max(4000).optional(),
    negativeConstraints: z.array(z.string().min(1).max(500)).max(64).optional(),
    qcRequirements: z.array(MotionQcRequirementSchema).max(128),
    correlationId: DomainIdSchema,
  })
  .strict();

export const MotionCheckpointResultSchema = z.object({
  checkpointId: DomainIdSchema,
  status: z.enum(QcStatusValues),
  notes: z.string().min(1).max(1000).optional(),
});

export const MotionQcIssueSchema = z.object({
  code: z.string().min(1).max(160),
  severity: z.enum(QcSeverityValues),
  message: z.string().min(1).max(500),
});

export const MotionQcResultSchema = z.object({
  schemaVersion: z.literal(MOTION_QC_RESULT_SCHEMA_VERSION),
  motionFidelity: z.enum(QcStatusValues),
  identityFidelity: z.enum(QcStatusValues),
  outfitFidelity: z.enum(QcStatusValues),
  cameraCompliance: z.enum(QcStatusValues),
  bodyIntegrity: z.enum(QcStatusValues),
  temporalConsistency: z.enum(QcStatusValues),
  checkpointResults: z.array(MotionCheckpointResultSchema).max(256),
  issues: z.array(MotionQcIssueSchema).max(256),
  overallStatus: z.enum(MotionQcOverallStatusValues),
  humanValidationRequired: z.boolean(),
});

export const MotionTransferEstimateSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  currency: z.string().length(3),
  estimatedCostMinor: z.number().int().nonnegative(),
  durationSeconds: z.number().positive().optional(),
  pricingUnit: z.enum(["second", "job"]).optional(),
  notes: z.array(z.string().min(1).max(200)).max(16).optional(),
  mode: z.enum(MotionTransferEstimateModeValues).optional(),
  pricingStrategy: z.string().min(1).max(80).optional(),
  pricingVersion: z.string().min(1).max(80).optional(),
  assumptions: z.array(z.string().min(1).max(200)).max(16).optional(),
  expiresAt: z.string().min(1).optional(),
  providerId: z.string().min(1).max(64).optional(),
  modelId: z.string().min(1).max(160).optional(),
  capability: z.literal("video.motion_transfer").optional(),
  capabilityVersion: z.string().min(1).max(64).optional(),
});

export const MotionTransferProviderOutputDescriptorSchema = z.object({
  providerOutputRef: z.string().min(1).max(256),
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative().optional(),
  durationSeconds: z.number().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().positive().optional(),
  providerChecksum: z.string().min(1).max(128).optional(),
  completedAt: z.string().min(1),
});

export const MotionTransferSubmissionSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  status: z.literal("submitted"),
  providerJobId: DomainIdSchema,
  submittedAt: z.string().min(1),
  acceptedAt: z.string().min(1).optional(),
  syncOrAsync: z.enum(["sync", "async"]).optional(),
  pollingRequired: z.boolean().optional(),
  estimatedCompletionAt: z.string().min(1).optional(),
  requestMetadataRedacted: z.record(z.string(), z.unknown()).optional(),
});

export const MotionTransferStatusSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  status: z.enum(MotionTransferJobStatusValues),
  providerJobId: DomainIdSchema,
  progressPercent: z.number().min(0).max(100).optional(),
  errorCode: z.string().min(1).max(80).optional(),
  updatedAt: z.string().min(1),
  output: MotionTransferProviderOutputDescriptorSchema.optional(),
  usage: z
    .object({
      durationSeconds: z.number().positive().optional(),
      units: z.number().nonnegative().optional(),
    })
    .optional(),
  actualCostMinor: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
});

export const MotionTransferCancelResultSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  status: z.enum(MotionTransferCancelStatusValues),
  providerJobId: DomainIdSchema,
  lateResultExpected: z.boolean().optional(),
});

export const MotionTransferResultSchema = z.object({
  schemaVersion: z.literal(MOTION_TRANSFER_RESULT_SCHEMA_VERSION),
  status: z.enum(["completed", "failed", "cancelled"]),
  asset: MotionMediaReferenceSchema.optional(),
  providerId: z.string().min(1).max(64).optional(),
  modelId: z.string().min(1).max(160).optional(),
  providerJobId: DomainIdSchema.optional(),
  usage: z
    .object({
      durationSeconds: z.number().positive().optional(),
      units: z.number().nonnegative().optional(),
    })
    .optional(),
  costMinor: z.number().int().nonnegative().optional(),
  provenance: z.record(z.string(), z.unknown()).optional(),
  qc: MotionQcResultSchema.optional(),
  errorCode: z.string().min(1).max(80).optional(),
  publicMessage: z.string().min(1).max(500).optional(),
});
