/**
 * Synthetic coaching-style Motion fixture (MT-012).
 * Opaque IDs only — no Tai-Chi / sport semantics hardcoded in QC engine.
 */

import {
  makeMinimalInput,
  makeReferenceSpec,
  makeVideoRef,
  makeIdentityRef,
  makeOutfitRef,
} from "@/domain/motion/__tests__/fixtures";
import type { MotionTransferInput } from "@/domain/motion";

export const MT012_WORKSPACE_ID = "ws-mt012-synth" as const;
export const MT012_PROJECT_ID = "proj-mt012-synth" as const;
export const MT012_CORRELATION_ID = "corr-mt012-mv001-synth" as const;

/** Opaque movement id — benchmark label only, not a QC rule. */
export const MT012_MOVEMENT_ID = "MV-001-SYNTH" as const;

/**
 * Critical-fidelity synthetic input for nominal E2E.
 * Inspired by coaching benchmarks; checkpoints remain opaque IDs.
 */
export function makeMv001LikeOpaqueInput(
  over: Partial<MotionTransferInput> = {},
): MotionTransferInput {
  return makeMinimalInput({
    sourceVideo: makeVideoRef("src-opaque-mv001"),
    character: {
      characterId: "char-opaque-coach-1",
      identityReferences: [makeIdentityRef("id-opaque-1")],
      identityLock: "required",
      outfitLock: "preferred",
      outfitReference: makeOutfitRef("outfit-opaque-1"),
      fullBodyRequired: true,
    },
    motion: {
      preserveMotion: true,
      preserveTiming: true,
      preserveCamera: true,
      fidelity: "critical",
      poseControl: "provider_native",
    },
    referenceSpec: makeReferenceSpec({
      movementId: MT012_MOVEMENT_ID,
      version: "1.0.0-synth",
      title: "Synthetic coaching movement benchmark",
      humanValidationRequired: true,
      qcRequirements: [
        {
          code: "checkpoint.opaque.human",
          severity: "blocking",
          humanValidationRequired: true,
        },
      ],
    }),
    output: {
      durationSeconds: 8,
      aspectRatio: "9:16",
      resolution: "1080p",
      fps: 24,
    },
    qcRequirements: [
      { code: "technical.decode", severity: "blocking" },
      {
        code: "human.sport_validation",
        severity: "blocking",
        humanValidationRequired: true,
      },
    ],
    correlationId: MT012_CORRELATION_ID,
    prompt: undefined,
    ...over,
  });
}
