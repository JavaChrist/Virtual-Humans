/**
 * Canonical video/audio source reference for lipsync (Phase 11D).
 * Provider-agnostic. Never carries a signed URL, data URL, or media bytes.
 */
import { createHash } from "node:crypto";

export const EXISTING_TIMED_MEDIA_ASSET_REFERENCE_VERSION =
  "existing-timed-media-asset-reference-1.0.0" as const;

export const TIMED_MEDIA_KINDS = ["video", "audio"] as const;
export type TimedMediaKind = (typeof TIMED_MEDIA_KINDS)[number];

export const TIMED_MEDIA_VIDEO_MIME = "video/mp4" as const;
export const TIMED_MEDIA_AUDIO_MIME = "audio/mpeg" as const;

export type ExistingTimedMediaAssetReference = {
  referenceVersion: typeof EXISTING_TIMED_MEDIA_ASSET_REFERENCE_VERSION;
  kind: TimedMediaKind;
  workspaceId: string;
  projectId: string;
  assetId: string;
  expectedChecksum: string;
  expectedMimeType: string;
  expectedLifecycle: "approved";
  requiredHumanApproval: true;
  sourceRole: string;
  sourceKind: "internal";
  expectedStoragePath: string;
  bucketPrivate: true;
  activeAllowed: false;
  provenanceFingerprint: string;
  humanReviewDecisionId?: string;
};

export type ExistingTimedMediaAssetFacts = {
  workspaceId: string;
  projectId: string;
  assetId: string;
  checksum: string;
  mimeType: string;
  lifecycle: string;
  sourceKind: string;
  storagePath: string;
  bucketPrivate: boolean;
  active: boolean;
  humanReviewDecision: string | null;
  stale?: boolean;
  quarantined?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

function assertNoMediaLeak(value: unknown): void {
  const blob = JSON.stringify(value);
  if (
    /https?:\/\//i.test(blob) ||
    /data:[^;]+;base64,/i.test(blob) ||
    /token=/i.test(blob) ||
    /signed/i.test(blob)
  ) {
    throw new Error("ExistingTimedMediaAssetReference must not contain URL, token, or media payload.");
  }
}

export function fingerprintExistingTimedMediaAssetReference(
  input: Omit<ExistingTimedMediaAssetReference, "provenanceFingerprint" | "referenceVersion"> & {
    referenceVersion?: typeof EXISTING_TIMED_MEDIA_ASSET_REFERENCE_VERSION;
  },
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: EXISTING_TIMED_MEDIA_ASSET_REFERENCE_VERSION,
        kind: input.kind,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        assetId: input.assetId,
        expectedChecksum: input.expectedChecksum,
        expectedMimeType: input.expectedMimeType,
        expectedLifecycle: "approved",
        requiredHumanApproval: true,
        sourceRole: input.sourceRole,
        sourceKind: "internal",
        expectedStoragePath: input.expectedStoragePath,
        bucketPrivate: true,
        activeAllowed: false,
        humanReviewDecisionId: input.humanReviewDecisionId ?? "",
      }),
    )
    .digest("hex");
}

export function createExistingTimedMediaAssetReference(
  input: Omit<
    ExistingTimedMediaAssetReference,
    | "provenanceFingerprint"
    | "referenceVersion"
    | "sourceKind"
    | "activeAllowed"
    | "requiredHumanApproval"
    | "expectedLifecycle"
    | "bucketPrivate"
  > & {
    expectedLifecycle?: "approved";
    humanReviewDecisionId?: string;
  },
): ExistingTimedMediaAssetReference {
  if (!UUID_RE.test(input.workspaceId) || !UUID_RE.test(input.projectId) || !UUID_RE.test(input.assetId)) {
    throw new Error("ExistingTimedMediaAssetReference: workspace/project/asset ids must be UUIDs.");
  }
  if (!SHA256_RE.test(input.expectedChecksum)) {
    throw new Error("ExistingTimedMediaAssetReference: expectedChecksum must be sha256 hex.");
  }
  if (input.kind === "video" && input.expectedMimeType !== TIMED_MEDIA_VIDEO_MIME) {
    throw new Error("ExistingTimedMediaAssetReference: video MIME must be video/mp4.");
  }
  if (input.kind === "audio" && input.expectedMimeType !== TIMED_MEDIA_AUDIO_MIME) {
    throw new Error("ExistingTimedMediaAssetReference: audio MIME must be audio/mpeg.");
  }
  if (input.expectedMimeType.startsWith("image/")) {
    throw new Error("ExistingTimedMediaAssetReference: still-image assets cannot be lipsync sources.");
  }
  if (!input.expectedStoragePath.startsWith(`${input.workspaceId}/${input.projectId}/`)) {
    throw new Error("ExistingTimedMediaAssetReference: storage path must stay inside workspace/project.");
  }
  if (/https?:\/\//i.test(input.expectedStoragePath) || input.expectedStoragePath.includes("?")) {
    throw new Error("ExistingTimedMediaAssetReference: storage path must be internal, not a URL.");
  }
  const draft: ExistingTimedMediaAssetReference = {
    referenceVersion: EXISTING_TIMED_MEDIA_ASSET_REFERENCE_VERSION,
    kind: input.kind,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    assetId: input.assetId,
    expectedChecksum: input.expectedChecksum,
    expectedMimeType: input.expectedMimeType,
    expectedLifecycle: "approved",
    requiredHumanApproval: true,
    sourceRole: input.sourceRole,
    sourceKind: "internal",
    expectedStoragePath: input.expectedStoragePath,
    bucketPrivate: true,
    activeAllowed: false,
    provenanceFingerprint: "",
    humanReviewDecisionId: input.humanReviewDecisionId,
  };
  draft.provenanceFingerprint = fingerprintExistingTimedMediaAssetReference(draft);
  assertNoMediaLeak(draft);
  return Object.freeze(draft);
}

export function assertExistingTimedMediaAssetReferenceMatchesFacts(
  reference: ExistingTimedMediaAssetReference,
  facts: ExistingTimedMediaAssetFacts,
): void {
  assertNoMediaLeak(reference);
  if (facts.workspaceId !== reference.workspaceId) {
    throw new Error("ExistingTimedMediaAssetReference: workspace mismatch.");
  }
  if (facts.projectId !== reference.projectId) {
    throw new Error("ExistingTimedMediaAssetReference: project mismatch.");
  }
  if (facts.assetId !== reference.assetId) {
    throw new Error("ExistingTimedMediaAssetReference: asset mismatch.");
  }
  if (facts.checksum !== reference.expectedChecksum) {
    throw new Error("ExistingTimedMediaAssetReference: checksum mismatch.");
  }
  if (facts.mimeType !== reference.expectedMimeType) {
    throw new Error("ExistingTimedMediaAssetReference: MIME mismatch.");
  }
  const lifecycle = String(facts.lifecycle);
  if (lifecycle === "rejected") {
    throw new Error("ExistingTimedMediaAssetReference: rejected source forbidden.");
  }
  if (lifecycle === "pending_review") {
    throw new Error("ExistingTimedMediaAssetReference: pending source forbidden.");
  }
  if (facts.stale || facts.quarantined || lifecycle === "stale" || lifecycle === "quarantined") {
    throw new Error("ExistingTimedMediaAssetReference: stale/quarantined source forbidden.");
  }
  if (lifecycle !== "approved" || reference.expectedLifecycle !== "approved") {
    throw new Error("ExistingTimedMediaAssetReference: lifecycle must be approved.");
  }
  if (facts.sourceKind !== "internal" || reference.sourceKind !== "internal") {
    throw new Error("ExistingTimedMediaAssetReference: source_kind must be internal.");
  }
  if (!facts.bucketPrivate) {
    throw new Error("ExistingTimedMediaAssetReference: asset must be private.");
  }
  if (facts.humanReviewDecision !== "approved") {
    throw new Error("ExistingTimedMediaAssetReference: Human Review APPROVE required.");
  }
  if (facts.active === true) {
    throw new Error("ExistingTimedMediaAssetReference: activation is not required and must stay false.");
  }
  if (facts.storagePath !== reference.expectedStoragePath) {
    throw new Error("ExistingTimedMediaAssetReference: storage path mismatch.");
  }
}

export function assertTimedMediaMayStayInactive(active: boolean): void {
  if (active) {
    throw new Error("ExistingTimedMediaAssetReference: approved lipsync source must remain active=false.");
  }
}
