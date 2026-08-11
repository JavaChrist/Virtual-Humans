import type { MotionMediaReference } from "../media-reference";
import type {
  MotionQcResult,
  MotionReferenceSpec,
  MotionTransferInput,
} from "../types";

export function makeVideoRef(assetId = "src-video-1"): MotionMediaReference {
  return {
    role: "source_video",
    asset: {
      assetId,
      kind: "video",
      mimeType: "video/mp4",
      checksum: `sha256:${assetId}`,
      access: { kind: "internal", storagePath: `motion/source/${assetId}.mp4` },
    },
    durationSeconds: 8,
  };
}

export function makeIdentityRef(assetId = "id-ref-1"): MotionMediaReference {
  return {
    role: "identity",
    asset: {
      assetId,
      kind: "character",
      mimeType: "image/png",
      checksum: `sha256:${assetId}`,
      access: { kind: "internal", storagePath: `motion/identity/${assetId}.png` },
    },
  };
}

export function makeOutfitRef(assetId = "outfit-1"): MotionMediaReference {
  return {
    role: "outfit",
    asset: {
      assetId,
      kind: "outfit",
      mimeType: "image/png",
      checksum: `sha256:${assetId}`,
      access: { kind: "internal", storagePath: `motion/outfit/${assetId}.png` },
    },
  };
}

export function makeReferenceSpec(
  over: Partial<MotionReferenceSpec> = {},
): MotionReferenceSpec {
  return {
    schemaVersion: "1.0.0",
    movementId: "MV-001",
    version: "1.0.0",
    title: "Benchmark movement",
    phases: [
      { phaseId: "phase-a", order: 0, title: "Start" },
      { phaseId: "phase-b", order: 1, title: "Transfer" },
    ],
    checkpoints: [
      {
        checkpointId: "cp-1",
        phaseId: "phase-a",
        description: "Feet rooted",
        bodyFocus: ["feet"],
        mandatory: true,
      },
      {
        checkpointId: "cp-2",
        phaseId: "phase-b",
        description: "Weight transfer",
        bodyFocus: ["hips", "knees"],
        mandatory: true,
      },
    ],
    bodyRelations: [
      {
        relationId: "br-1",
        description: "Knees track toes",
        mandatory: true,
      },
    ],
    forbiddenPatterns: [
      {
        patternId: "fp-1",
        description: "Locked knees",
        severity: "blocking",
      },
    ],
    timingConstraints: [
      {
        constraintId: "tc-1",
        description: "Preserve relative phase timing",
        preserveRelativeTiming: true,
      },
    ],
    cameraConstraints: [
      {
        constraintId: "cc-1",
        preserveCamera: true,
      },
    ],
    qcRequirements: [
      {
        code: "checkpoint.weight_transfer",
        severity: "blocking",
        humanValidationRequired: true,
      },
    ],
    humanValidationRequired: true,
    ...over,
  };
}

export function makeMinimalInput(
  over: Partial<MotionTransferInput> = {},
): MotionTransferInput {
  const base: MotionTransferInput = {
    schemaVersion: "1.0.0",
    capability: "video.motion_transfer",
    sourceVideo: makeVideoRef(),
    character: {
      characterId: "mei",
      identityReferences: [makeIdentityRef()],
      identityLock: "required",
      outfitLock: "preferred",
      outfitReference: makeOutfitRef(),
      fullBodyRequired: true,
    },
    motion: {
      preserveMotion: true,
      preserveTiming: true,
      preserveCamera: true,
      fidelity: "standard",
      poseControl: "provider_native",
    },
    referenceSpec: makeReferenceSpec(),
    output: {
      durationSeconds: 8,
      aspectRatio: "9:16",
      resolution: "1080p",
      fps: 24,
    },
    prompt: "optional guidance",
    negativeConstraints: ["no cartoon"],
    qcRequirements: [
      {
        code: "technical.decode",
        severity: "blocking",
      },
    ],
    correlationId: "corr-motion-1",
  };
  return {
    ...base,
    ...over,
    character: over.character
      ? { ...base.character, ...over.character }
      : base.character,
    motion: over.motion ? { ...base.motion, ...over.motion } : base.motion,
    output: over.output ? { ...base.output, ...over.output } : base.output,
  };
}

export function makeCriticalInput(): MotionTransferInput {
  return makeMinimalInput({
    motion: {
      preserveMotion: true,
      preserveTiming: true,
      fidelity: "critical",
      poseControl: "provider_native",
    },
    qcRequirements: [
      {
        code: "human.sport_validation",
        severity: "blocking",
        humanValidationRequired: true,
      },
    ],
  });
}

export function makeQcResult(over: Partial<MotionQcResult> = {}): MotionQcResult {
  return {
    schemaVersion: "1.0.0",
    motionFidelity: "unknown",
    identityFidelity: "pass",
    outfitFidelity: "unknown",
    cameraCompliance: "unknown",
    bodyIntegrity: "unknown",
    temporalConsistency: "unknown",
    checkpointResults: [
      { checkpointId: "cp-1", status: "unknown" },
      { checkpointId: "cp-2", status: "unknown" },
    ],
    issues: [],
    overallStatus: "human_review",
    humanValidationRequired: true,
    ...over,
  };
}
