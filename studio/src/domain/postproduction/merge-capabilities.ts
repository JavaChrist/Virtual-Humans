/**
 * Declared MergeEngine capabilities — honest about fal compose limits (VHS-111).
 */

export const MERGE_POLICY_VERSION = "merge-policy.v1" as const;

export type MergeTransitionKind =
  | "cut"
  | "fade"
  | "cross_fade"
  | "slide"
  | "zoom"
  | "match_cut"
  | "none";

export type MergeEngineCapabilities = {
  version: string;
  /** When false, execute() must refuse. */
  executionEnabled: boolean;
  sequentialConcatenation: boolean;
  supportedTransitions: readonly MergeTransitionKind[];
  preserveEmbeddedAudio: boolean;
  stripEmbeddedAudio: boolean;
  /** Single video + single audio track mux (historical merge-audio). */
  singleAudioMux: boolean;
  audioMuxStartOffsetSeconds: readonly number[];
  overlays: boolean;
  postProductionText: boolean;
  multiTrackMix: boolean;
  loudnessLufs: boolean;
  audioFades: boolean;
  explicitCodecControl: boolean;
  explicitAspectRatioControl: boolean;
  explicitFrameRateControl: boolean;
  asyncSubmitPoll: boolean;
  cancellationSupported: boolean;
};

/**
 * Capabilities the future fal compose adapter MAY declare — not enabled here.
 */
export const FAL_COMPOSE_DECLARED_CAPABILITIES: MergeEngineCapabilities = Object.freeze({
  version: "fal-compose.declared.v1",
  executionEnabled: false,
  sequentialConcatenation: true,
  supportedTransitions: ["cut", "none"] as const,
  preserveEmbeddedAudio: true,
  stripEmbeddedAudio: true,
  singleAudioMux: true,
  audioMuxStartOffsetSeconds: [0] as const,
  overlays: false,
  postProductionText: false,
  multiTrackMix: false,
  loudnessLufs: false,
  audioFades: false,
  explicitCodecControl: false,
  explicitAspectRatioControl: false,
  explicitFrameRateControl: false,
  asyncSubmitPoll: true,
  cancellationSupported: false,
});

/**
 * Stub adapter capabilities — explicitly unavailable.
 */
export const STUB_MERGE_CAPABILITIES: MergeEngineCapabilities = Object.freeze({
  ...FAL_COMPOSE_DECLARED_CAPABILITIES,
  version: "merge-stub.v1",
  executionEnabled: false,
});
