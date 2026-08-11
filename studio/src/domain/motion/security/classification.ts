/**
 * Motion Transfer data classification (MT-011).
 * Controls what may appear on public / log / event surfaces.
 */

export const MotionDataClassValues = [
  "PUBLIC_SAFE",
  "INTERNAL_OPERATIONAL",
  "PRIVATE_MEDIA_METADATA",
  "SENSITIVE_BIOMETRIC",
  "SECRET",
  "FORBIDDEN_IN_LOGS",
] as const;

export type MotionDataClass = (typeof MotionDataClassValues)[number];

/** Field → class mapping for Motion Transfer surfaces. */
export const MOTION_DATA_CLASSIFICATION = {
  correlationId: "PUBLIC_SAFE",
  workspaceId: "INTERNAL_OPERATIONAL",
  projectId: "INTERNAL_OPERATIONAL",
  productionRunId: "INTERNAL_OPERATIONAL",
  productionJobId: "INTERNAL_OPERATIONAL",
  generationAttemptId: "INTERNAL_OPERATIONAL",
  directorRunId: "INTERNAL_OPERATIONAL",
  providerJobIdFingerprint: "INTERNAL_OPERATIONAL",
  artifactId: "INTERNAL_OPERATIONAL",
  assetId: "INTERNAL_OPERATIONAL",
  reviewRequestId: "INTERNAL_OPERATIONAL",
  idempotencyFingerprint: "INTERNAL_OPERATIONAL",
  mimeType: "PRIVATE_MEDIA_METADATA",
  sizeBytes: "PRIVATE_MEDIA_METADATA",
  durationSeconds: "PRIVATE_MEDIA_METADATA",
  width: "PRIVATE_MEDIA_METADATA",
  height: "PRIVATE_MEDIA_METADATA",
  fps: "PRIVATE_MEDIA_METADATA",
  checksum: "PRIVATE_MEDIA_METADATA",
  contentFingerprint: "PRIVATE_MEDIA_METADATA",
  motionRole: "PRIVATE_MEDIA_METADATA",
  httpStatus: "INTERNAL_OPERATIONAL",
  providerErrorCode: "INTERNAL_OPERATIONAL",
  providerRequestId: "INTERNAL_OPERATIONAL",
  networkAttempts: "INTERNAL_OPERATIONAL",
  stage: "INTERNAL_OPERATIONAL",
  FAL_KEY: "SECRET",
  bearerToken: "SECRET",
  signedUrl: "FORBIDDEN_IN_LOGS",
  dataUrl: "FORBIDDEN_IN_LOGS",
  prompt: "FORBIDDEN_IN_LOGS",
  providerRawPayload: "FORBIDDEN_IN_LOGS",
  sourceVideoUrl: "FORBIDDEN_IN_LOGS",
  identityImage: "SENSITIVE_BIOMETRIC",
  humanReviewComment: "FORBIDDEN_IN_LOGS",
  biometricRaw: "SENSITIVE_BIOMETRIC",
} as const satisfies Record<string, MotionDataClass>;

export function isForbiddenInLogs(cls: MotionDataClass): boolean {
  return (
    cls === "FORBIDDEN_IN_LOGS" ||
    cls === "SECRET" ||
    cls === "SENSITIVE_BIOMETRIC"
  );
}

export function isAllowedOnPublicEvent(cls: MotionDataClass): boolean {
  return cls === "PUBLIC_SAFE" || cls === "INTERNAL_OPERATIONAL" || cls === "PRIVATE_MEDIA_METADATA";
}
