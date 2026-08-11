/**
 * Motion Transfer input fingerprint / idempotency material (MT-001).
 *
 * Boundary:
 * - THIS layer: provider-independent logical fingerprint of the motion request.
 * - LATER (jobs / engine): append providerId, modelId, attempt to the runtime
 *   idempotency key (same pattern as generation/idempotency.ts).
 *
 * Never includes signed URLs, data URLs, binaries, or prompt text.
 */

import { createHash } from "node:crypto";
import { MOTION_TRANSFER_CAPABILITY } from "./capability";
import { fingerprintMotionMediaReference } from "./media-reference";
import type { MotionReferenceSpec, MotionTransferInput } from "./types";
import { MOTION_TRANSFER_ACTION_VERSION } from "./types";

export function fingerprintMotionReferenceSpec(
  spec: MotionReferenceSpec | undefined,
): string {
  if (!spec) return "none";
  const payload = {
    schemaVersion: spec.schemaVersion,
    movementId: spec.movementId,
    version: spec.version,
    title: spec.title,
    humanValidationRequired: spec.humanValidationRequired,
    phases: [...spec.phases]
      .map((p) => ({
        phaseId: p.phaseId,
        order: p.order,
        title: p.title ?? null,
        expectedDurationSeconds: p.expectedDurationSeconds ?? null,
      }))
      .sort((a, b) => a.order - b.order || a.phaseId.localeCompare(b.phaseId)),
    checkpoints: [...spec.checkpoints]
      .map((c) => ({
        checkpointId: c.checkpointId,
        phaseId: c.phaseId,
        description: c.description,
        bodyFocus: c.bodyFocus ? [...c.bodyFocus].sort() : [],
        mandatory: c.mandatory,
      }))
      .sort((a, b) => a.checkpointId.localeCompare(b.checkpointId)),
    bodyRelations: [...spec.bodyRelations]
      .map((r) => ({
        relationId: r.relationId,
        description: r.description,
        mandatory: r.mandatory,
      }))
      .sort((a, b) => a.relationId.localeCompare(b.relationId)),
    forbiddenPatterns: [...spec.forbiddenPatterns]
      .map((p) => ({
        patternId: p.patternId,
        description: p.description,
        severity: p.severity,
      }))
      .sort((a, b) => a.patternId.localeCompare(b.patternId)),
    timingConstraints: [...spec.timingConstraints]
      .map((t) => ({
        constraintId: t.constraintId,
        description: t.description,
        preserveRelativeTiming: t.preserveRelativeTiming,
      }))
      .sort((a, b) => a.constraintId.localeCompare(b.constraintId)),
    cameraConstraints: [...spec.cameraConstraints]
      .map((c) => ({
        constraintId: c.constraintId,
        preserveCamera: c.preserveCamera,
        notes: c.notes ?? null,
      }))
      .sort((a, b) => a.constraintId.localeCompare(b.constraintId)),
    qcRequirements: [...spec.qcRequirements]
      .map((q) => ({
        code: q.code,
        severity: q.severity,
        humanValidationRequired: q.humanValidationRequired ?? false,
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
  return sha256(JSON.stringify(payload));
}

/**
 * Stable SHA-256 fingerprint of a MotionTransferInput (provider-independent).
 * Prefix includes capability to avoid collision with I2V/T2V fingerprints.
 */
export function buildMotionTransferInputFingerprint(
  input: MotionTransferInput,
): string {
  const identityRefs = input.character.identityReferences
    .map(fingerprintMotionMediaReference)
    .sort();
  const payload = {
    capability: MOTION_TRANSFER_CAPABILITY,
    actionVersion: MOTION_TRANSFER_ACTION_VERSION,
    contractVersion: input.schemaVersion,
    sourceVideo: fingerprintMotionMediaReference(input.sourceVideo),
    characterId: input.character.characterId,
    identityLock: input.character.identityLock,
    outfitLock: input.character.outfitLock ?? null,
    fullBodyRequired: input.character.fullBodyRequired ?? false,
    identityRefs,
    outfitRef: input.character.outfitReference
      ? fingerprintMotionMediaReference(input.character.outfitReference)
      : null,
    motion: {
      preserveMotion: input.motion.preserveMotion,
      preserveTiming: input.motion.preserveTiming,
      preserveCamera: input.motion.preserveCamera ?? null,
      fidelity: input.motion.fidelity,
      poseControl: input.motion.poseControl ?? null,
    },
    referenceSpec: fingerprintMotionReferenceSpec(input.referenceSpec),
    output: {
      durationSeconds: input.output.durationSeconds ?? null,
      aspectRatio: input.output.aspectRatio,
      resolution: input.output.resolution ?? null,
      fps: input.output.fps ?? null,
    },
    // Prompt text intentionally excluded — length only for stability without content.
    promptCharCount: input.prompt?.length ?? 0,
    negativeConstraints: [...(input.negativeConstraints ?? [])].sort(),
    qcRequirements: [...input.qcRequirements]
      .map((q) => ({
        code: q.code,
        severity: q.severity,
        humanValidationRequired: q.humanValidationRequired ?? false,
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
  return sha256(JSON.stringify(payload));
}

/**
 * Logical idempotency material (not the final job key).
 * Format: video.motion_transfer:<contractVersion>:<fingerprint16>
 *
 * Runtime layers MUST append :providerId:modelId:attempt when submitting.
 */
export function buildMotionTransferIdempotencyMaterial(
  input: MotionTransferInput,
): string {
  const fp = buildMotionTransferInputFingerprint(input);
  return `${MOTION_TRANSFER_CAPABILITY}:${input.schemaVersion}:${fp.slice(0, 32)}`;
}

/** Demonstrates non-collision with a typical I2V fingerprint namespace. */
export function buildI2vCollisionProbeFingerprint(parts: {
  projectId: string;
  startFrameAssetId: string;
  characterId: string;
}): string {
  return sha256(
    JSON.stringify({
      capability: "video.image_to_video",
      actionVersion: "image-to-video-action-v1",
      projectId: parts.projectId,
      startFrameAssetId: parts.startFrameAssetId,
      characterId: parts.characterId,
    }),
  );
}

function sha256(json: string): string {
  return createHash("sha256").update(json).digest("hex");
}
