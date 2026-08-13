/**
 * Future scene-2 text-free revision — prepared, not executed.
 * Does not mutate the existing HUMAN_REJECTED asset or create jobs.
 */

import { overlaySpecFromValidatedSceneCopy } from "./phase-11a-visual-text-separation";
import {
  PHASE_11A_PROVIDER_TEXT_POLICY,
  PHASE_11A_PROVIDER_TEXT_POLICY_VERSION,
  PHASE_11A_TEXT_OVERLAY_MODE,
  PHASE_11A_TEXT_OVERLAY_VERSION,
} from "@/domain/production/image-text-overlay";
import { PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME } from "./phase-11a-deterministic-compositor";
import { PHASE_11A_SMOKE_SCENE_ID } from "./phase-11a-openai-image-allowlist";

export const PHASE_11A_REJECTED_SMOKE_ASSET_PREFIX = "5d68ef64" as const;
export const PHASE_11A_SCENE2_TEXT_FREE_REVISION_AUTH_REQUIRED =
  "NEW_PROVIDER_AUTH_REQUIRED" as const;

export type Phase11AScene2TextFreeRevisionPrep = {
  execute: false;
  sceneId: typeof PHASE_11A_SMOKE_SCENE_ID;
  reuseRejectedAsFinal: false;
  rejectedAssetKeptAsHistoricalProof: true;
  rejectedAssetIdPrefix: typeof PHASE_11A_REJECTED_SMOKE_ASSET_PREFIX;
  providerTextPolicy: typeof PHASE_11A_PROVIDER_TEXT_POLICY;
  providerTextPolicyVersion: typeof PHASE_11A_PROVIDER_TEXT_POLICY_VERSION;
  textOverlayMode: typeof PHASE_11A_TEXT_OVERLAY_MODE;
  overlayVersion: typeof PHASE_11A_TEXT_OVERLAY_VERSION;
  overlayRuntime: typeof PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME;
  newIdempotencyKeyRequired: true;
  newProviderAuthRequired: true;
  automaticRetryFromReject: false;
  overlay: ReturnType<typeof overlaySpecFromValidatedSceneCopy>;
};

/**
 * Build a future revision envelope. Strings must come from validated artifacts
 * at retry time — this helper does not read Production or call a provider.
 */
export function preparePhase11AScene2TextFreeRevision(input: {
  locale: string;
  title: string;
  callToAction?: string;
  subtitle?: string;
}): Phase11AScene2TextFreeRevisionPrep {
  return {
    execute: false,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    reuseRejectedAsFinal: false,
    rejectedAssetKeptAsHistoricalProof: true,
    rejectedAssetIdPrefix: PHASE_11A_REJECTED_SMOKE_ASSET_PREFIX,
    providerTextPolicy: PHASE_11A_PROVIDER_TEXT_POLICY,
    providerTextPolicyVersion: PHASE_11A_PROVIDER_TEXT_POLICY_VERSION,
    textOverlayMode: PHASE_11A_TEXT_OVERLAY_MODE,
    overlayVersion: PHASE_11A_TEXT_OVERLAY_VERSION,
    overlayRuntime: PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
    newIdempotencyKeyRequired: true,
    newProviderAuthRequired: true,
    automaticRetryFromReject: false,
    overlay: overlaySpecFromValidatedSceneCopy({
      locale: input.locale,
      title: input.title,
      ...(input.subtitle ? { subtitle: input.subtitle } : {}),
      ...(input.callToAction ? { callToAction: input.callToAction } : {}),
    }),
  };
}
