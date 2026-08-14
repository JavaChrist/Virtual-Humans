/**
 * Phase 11B — bind the generic ExistingMediaAssetReference to the approved 11A still.
 * Does not read or sign Production media.
 */
import {
  assertExistingMediaAssetMayStayInactive,
  assertExistingMediaAssetReferenceMatchesFacts,
  createExistingMediaAssetReference,
  type ExistingMediaAssetFacts,
  type ExistingMediaAssetReference,
} from "@/domain/generation/existing-media-asset-reference";
import type { ResolvedGenerationInput } from "@/domain/generation";
import type { GenerationStep } from "@/domain/routing/router";
import {
  PHASE_11B_PARENT_PENDING_PREFIX,
  PHASE_11B_PROJECT_ID,
  PHASE_11B_REJECTED_ASSET_PREFIXES,
  PHASE_11B_SCENE_ID,
  PHASE_11B_SOURCE_ASSET_ID,
  PHASE_11B_SOURCE_CHECKSUM,
  PHASE_11B_SOURCE_HR_DECISION_PREFIX,
  PHASE_11B_WORKSPACE_ID,
  assertPhase11BDoesNotUseRejectedOrPendingSource,
} from "./phase-11b-i2v-allowlist";

export function phase11BComposedStoragePath(assetId = PHASE_11B_SOURCE_ASSET_ID): string {
  return `${PHASE_11B_WORKSPACE_ID}/${PHASE_11B_PROJECT_ID}/media/image/composed/${assetId}.png`;
}

export function buildPhase11BApprovedSourceReference(input?: {
  humanReviewDecisionId?: string;
}): ExistingMediaAssetReference {
  assertPhase11BDoesNotUseRejectedOrPendingSource(PHASE_11B_SOURCE_ASSET_ID);
  return createExistingMediaAssetReference({
    workspaceId: PHASE_11B_WORKSPACE_ID,
    projectId: PHASE_11B_PROJECT_ID,
    assetId: PHASE_11B_SOURCE_ASSET_ID,
    expectedChecksum: PHASE_11B_SOURCE_CHECKSUM,
    expectedMimeType: "image/png",
    expectedWidth: 1024,
    expectedHeight: 1024,
    sourceRole: "i2v_start_frame",
    sourceSceneId: PHASE_11B_SCENE_ID,
    expectedStoragePath: phase11BComposedStoragePath(),
    humanReviewDecisionId: input?.humanReviewDecisionId ?? `${PHASE_11B_SOURCE_HR_DECISION_PREFIX}-synthetic`,
  });
}

export function phase11BSyntheticApprovedFacts(
  reference: ExistingMediaAssetReference,
): ExistingMediaAssetFacts {
  return {
    workspaceId: reference.workspaceId,
    projectId: reference.projectId,
    assetId: reference.assetId,
    checksum: reference.expectedChecksum,
    mimeType: reference.expectedMimeType,
    width: reference.expectedWidth,
    height: reference.expectedHeight,
    lifecycle: "approved",
    sourceKind: "internal",
    storagePath: reference.expectedStoragePath,
    bucketPrivate: true,
    active: false,
    humanReviewDecision: "approved",
  };
}

export function resolveExistingAssetInputsFromStep(step: GenerationStep): ResolvedGenerationInput[] {
  const resolved: ResolvedGenerationInput[] = [];
  for (const ref of step.inputRefs) {
    if (ref.kind !== "existing_asset") continue;
    const existing = step.existingMediaAsset;
    if (!existing || existing.assetId !== ref.id) {
      throw new Error("existing_asset ref must match step.existingMediaAsset.");
    }
    resolved.push({
      role: ref.role,
      asset: {
        assetId: existing.assetId,
        kind: "image",
        mimeType: existing.expectedMimeType,
        checksum: existing.expectedChecksum,
        access: { kind: "internal", storagePath: existing.expectedStoragePath },
      },
    });
  }
  return resolved;
}

export function assertPhase11BSourceReferenceReady(
  reference: ExistingMediaAssetReference,
  facts: ExistingMediaAssetFacts,
): void {
  assertPhase11BDoesNotUseRejectedOrPendingSource(reference.assetId);
  for (const prefix of PHASE_11B_REJECTED_ASSET_PREFIXES) {
    if (reference.assetId.startsWith(prefix)) {
      throw new Error("Phase 11B source must not be a rejected asset.");
    }
  }
  if (reference.assetId.startsWith(PHASE_11B_PARENT_PENDING_PREFIX)) {
    throw new Error("Phase 11B source must not be the pending parent.");
  }
  assertExistingMediaAssetReferenceMatchesFacts(reference, facts);
  assertExistingMediaAssetMayStayInactive(facts.active);
}
