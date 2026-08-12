/**
 * MT-013P — Durable redacted MotionTransferInput for poll/drain resume.
 *
 * Never stores signed URLs, data URLs, or media bytes.
 * Sufficient for QC / Human Review resume after cold start.
 * Insufficient for a second provider submit (mediaBoundary stays durable:omitted).
 */

import type { MotionMediaReference } from "@/domain/motion";
import type { MotionTransferInput } from "@/domain/motion";

export const MOTION_TRANSFER_DURABLE_RESUME_VERSION =
  "mt013p-resume-input-1.0.0" as const;

/** Queue reclaim budget — NOT provider submit / generation_attempts. */
export const MOTION_TRANSFER_QUEUE_RECLAIM_MAX_ATTEMPTS = 64 as const;

const STUB_ASSET_PREFIX = "durable-hydrate-";

function toInternalMediaRef(ref: MotionMediaReference): MotionMediaReference {
  const assetId = ref.asset.assetId;
  const access = ref.asset.access;
  const storagePath =
    access.kind === "internal" && access.storagePath
      ? access.storagePath
      : `durable:resume/${assetId}`;
  return {
    role: ref.role,
    asset: {
      assetId,
      kind: ref.asset.kind,
      mimeType: ref.asset.mimeType,
      checksum: ref.asset.checksum,
      access: { kind: "internal", storagePath },
    },
    durationSeconds: ref.durationSeconds,
    width: ref.width,
    height: ref.height,
    provenance: ref.provenance,
  };
}

/**
 * Build a resume-capable MotionTransferInput for durable job.payload.
 * Preserves QC-critical fields (fidelity, qcRequirements, referenceSpec).
 */
export function toDurableResumeMotionTransferInput(
  input: MotionTransferInput,
): MotionTransferInput {
  return {
    schemaVersion: input.schemaVersion,
    capability: input.capability,
    sourceVideo: toInternalMediaRef(input.sourceVideo),
    character: {
      characterId: input.character.characterId,
      identityLock: input.character.identityLock,
      outfitLock: input.character.outfitLock,
      fullBodyRequired: input.character.fullBodyRequired,
      identityReferences: input.character.identityReferences.map(
        toInternalMediaRef,
      ),
      outfitReference: input.character.outfitReference
        ? toInternalMediaRef(input.character.outfitReference)
        : undefined,
    },
    motion: { ...input.motion },
    referenceSpec: input.referenceSpec
      ? structuredClone(input.referenceSpec)
      : undefined,
    output: { ...input.output },
    // Prompt never durable — not required for QC resume.
    prompt: undefined,
    negativeConstraints: undefined,
    qcRequirements: input.qcRequirements.map((q) => ({ ...q })),
    correlationId: input.correlationId,
  };
}

/** Detect the removed Production stub assets (legacy / test-only smell). */
export function isLegacyPollHydrateStubInput(
  input: MotionTransferInput | null | undefined,
): boolean {
  if (!input?.sourceVideo?.asset?.assetId) return true;
  const ids = [
    input.sourceVideo.asset.assetId,
    ...(input.character?.identityReferences ?? []).map(
      (r) => r?.asset?.assetId,
    ),
  ].filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return true;
  return ids.some((id) => id.startsWith(STUB_ASSET_PREFIX));
}

/**
 * True when durable resume input can drive QC without inventing a stub reject.
 */
export function isDurableResumeMotionInputComplete(
  input: MotionTransferInput | null | undefined,
): boolean {
  if (!input) return false;
  if (!input.sourceVideo?.asset?.assetId) return false;
  if (!input.character?.identityReferences?.length) return false;
  if (isLegacyPollHydrateStubInput(input)) return false;
  if (!input.motion?.fidelity) return false;
  if (!Array.isArray(input.qcRequirements) || input.qcRequirements.length < 1) {
    return false;
  }
  // Stub-only technical.decode with no human/reference context is incomplete
  // for critical fidelity (the MV-001 false qc_rejected class).
  if (input.motion.fidelity === "critical") {
    const hasHumanGate =
      input.qcRequirements.some((q) => q.humanValidationRequired === true) ||
      input.referenceSpec?.humanValidationRequired === true;
    const onlyTechnicalDecode =
      input.qcRequirements.length === 1 &&
      input.qcRequirements[0]?.code === "technical.decode";
    if (onlyTechnicalDecode && !hasHumanGate) return false;
  }
  return true;
}

export function assertNoSignedUrlInResumeInput(
  input: MotionTransferInput,
): void {
  const refs: MotionMediaReference[] = [
    input.sourceVideo,
    ...input.character.identityReferences,
  ];
  if (input.character.outfitReference) {
    refs.push(input.character.outfitReference);
  }
  for (const ref of refs) {
    if (ref.asset.access.kind !== "internal") {
      throw new Error(
        `resume_input_must_be_internal:${ref.asset.assetId}:${ref.asset.access.kind}`,
      );
    }
  }
}
