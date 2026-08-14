/**
 * Canonical inter-run media source reference (Phase 11B).
 * Provider-agnostic. Never carries a signed URL, data URL, or media bytes.
 */
import { createHash } from "node:crypto";

export const EXISTING_MEDIA_ASSET_REFERENCE_VERSION = "existing-media-asset-reference-1.0.0" as const;

export const EXISTING_MEDIA_ASSET_LIFECYCLES = [
  "approved",
  "pending_review",
  "rejected",
  "stale",
  "quarantined",
] as const;
export type ExistingMediaAssetLifecycle = (typeof EXISTING_MEDIA_ASSET_LIFECYCLES)[number];

export type ExistingMediaAssetReference = {
  referenceVersion: typeof EXISTING_MEDIA_ASSET_REFERENCE_VERSION;
  workspaceId: string;
  projectId: string;
  assetId: string;
  expectedChecksum: string;
  expectedMimeType: string;
  expectedWidth: number;
  expectedHeight: number;
  expectedLifecycle: "approved";
  requiredHumanApproval: true;
  sourceRole: string;
  sourceSceneId: string;
  sourceKind: "internal";
  expectedStoragePath: string;
  activeAllowed: false;
  provenanceFingerprint: string;
  humanReviewDecisionId?: string;
};

export type ExistingMediaAssetFacts = {
  workspaceId: string;
  projectId: string;
  assetId: string;
  checksum: string;
  mimeType: string;
  width: number;
  height: number;
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
    throw new Error("ExistingMediaAssetReference must not contain URL, token, or media payload.");
  }
}

export function fingerprintExistingMediaAssetReference(
  input: Omit<ExistingMediaAssetReference, "provenanceFingerprint" | "referenceVersion"> & {
    referenceVersion?: typeof EXISTING_MEDIA_ASSET_REFERENCE_VERSION;
  },
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: EXISTING_MEDIA_ASSET_REFERENCE_VERSION,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        assetId: input.assetId,
        expectedChecksum: input.expectedChecksum,
        expectedMimeType: input.expectedMimeType,
        expectedWidth: input.expectedWidth,
        expectedHeight: input.expectedHeight,
        expectedLifecycle: input.expectedLifecycle,
        requiredHumanApproval: true,
        sourceRole: input.sourceRole,
        sourceSceneId: input.sourceSceneId,
        sourceKind: "internal",
        expectedStoragePath: input.expectedStoragePath,
        activeAllowed: false,
        humanReviewDecisionId: input.humanReviewDecisionId ?? "",
      }),
    )
    .digest("hex");
}

export function createExistingMediaAssetReference(
  input: Omit<ExistingMediaAssetReference, "provenanceFingerprint" | "referenceVersion" | "sourceKind" | "activeAllowed" | "requiredHumanApproval" | "expectedLifecycle"> & {
    expectedLifecycle?: "approved";
    humanReviewDecisionId?: string;
  },
): ExistingMediaAssetReference {
  if (!UUID_RE.test(input.workspaceId) || !UUID_RE.test(input.projectId) || !UUID_RE.test(input.assetId)) {
    throw new Error("ExistingMediaAssetReference: workspace/project/asset ids must be UUIDs.");
  }
  if (!SHA256_RE.test(input.expectedChecksum)) {
    throw new Error("ExistingMediaAssetReference: expectedChecksum must be sha256 hex.");
  }
  if (input.expectedMimeType !== "image/png" && !input.expectedMimeType.startsWith("image/")) {
    throw new Error("ExistingMediaAssetReference: MIME must be a still image.");
  }
  if (input.expectedWidth < 1 || input.expectedHeight < 1) {
    throw new Error("ExistingMediaAssetReference: dimensions must be positive.");
  }
  if (!input.expectedStoragePath.startsWith(`${input.workspaceId}/${input.projectId}/`)) {
    throw new Error("ExistingMediaAssetReference: storage path must stay inside workspace/project.");
  }
  if (/https?:\/\//i.test(input.expectedStoragePath) || input.expectedStoragePath.includes("?")) {
    throw new Error("ExistingMediaAssetReference: storage path must be internal, not a URL.");
  }
  const draft: ExistingMediaAssetReference = {
    referenceVersion: EXISTING_MEDIA_ASSET_REFERENCE_VERSION,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    assetId: input.assetId,
    expectedChecksum: input.expectedChecksum,
    expectedMimeType: input.expectedMimeType,
    expectedWidth: input.expectedWidth,
    expectedHeight: input.expectedHeight,
    expectedLifecycle: "approved",
    requiredHumanApproval: true,
    sourceRole: input.sourceRole,
    sourceSceneId: input.sourceSceneId,
    sourceKind: "internal",
    expectedStoragePath: input.expectedStoragePath,
    activeAllowed: false,
    provenanceFingerprint: "",
    humanReviewDecisionId: input.humanReviewDecisionId,
  };
  draft.provenanceFingerprint = fingerprintExistingMediaAssetReference(draft);
  assertNoMediaLeak(draft);
  return Object.freeze(draft);
}

export function assertExistingMediaAssetReferenceMatchesFacts(
  reference: ExistingMediaAssetReference,
  facts: ExistingMediaAssetFacts,
): void {
  assertNoMediaLeak(reference);
  if (facts.workspaceId !== reference.workspaceId) {
    throw new Error("ExistingMediaAssetReference: workspace mismatch.");
  }
  if (facts.projectId !== reference.projectId) {
    throw new Error("ExistingMediaAssetReference: project mismatch.");
  }
  if (facts.assetId !== reference.assetId) {
    throw new Error("ExistingMediaAssetReference: asset mismatch.");
  }
  if (facts.checksum !== reference.expectedChecksum) {
    throw new Error("ExistingMediaAssetReference: checksum mismatch.");
  }
  if (facts.mimeType !== reference.expectedMimeType) {
    throw new Error("ExistingMediaAssetReference: MIME mismatch.");
  }
  if (facts.width !== reference.expectedWidth || facts.height !== reference.expectedHeight) {
    throw new Error("ExistingMediaAssetReference: dimensions mismatch.");
  }
  const lifecycle = String(facts.lifecycle);
  if (lifecycle === "rejected" || lifecycle === "pending_review") {
    throw new Error("ExistingMediaAssetReference: pending/rejected source forbidden.");
  }
  if (facts.stale || facts.quarantined || lifecycle === "stale" || lifecycle === "quarantined") {
    throw new Error("ExistingMediaAssetReference: stale/quarantined source forbidden.");
  }
  if (lifecycle !== "approved" || reference.expectedLifecycle !== "approved") {
    throw new Error("ExistingMediaAssetReference: lifecycle must be approved.");
  }
  if (facts.sourceKind !== "internal" || reference.sourceKind !== "internal") {
    throw new Error("ExistingMediaAssetReference: source_kind must be internal.");
  }
  if (!facts.bucketPrivate) {
    throw new Error("ExistingMediaAssetReference: asset must be private.");
  }
  if (facts.humanReviewDecision !== "approved") {
    throw new Error("ExistingMediaAssetReference: Human Review APPROVE required.");
  }
  if (facts.active === true) {
    throw new Error("ExistingMediaAssetReference: activation is not required and must stay false.");
  }
  if (facts.storagePath !== reference.expectedStoragePath) {
    throw new Error("ExistingMediaAssetReference: storage path mismatch.");
  }
}

export function assertExistingMediaAssetMayStayInactive(active: boolean): void {
  if (active) {
    throw new Error("ExistingMediaAssetReference: approved I2V source must remain active=false.");
  }
}
