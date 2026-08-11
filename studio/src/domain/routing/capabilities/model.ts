/**
 * Model capabilities contract (VHS-107).
 * Absent / unknown fields are NOT treated as supported.
 */

import type { CapabilityProfile } from "@/domain/prompt";
import type { BriefAspectRatio } from "@/domain/brief";
import { CapabilityDomainError } from "./errors";
import type { ProviderId, RegionCode } from "./provider";
import type { PricingDefinition } from "./pricing";
import type { MotionTransferModelCapabilities } from "./motion-transfer";

export type ModelId = string;
export type CanonicalModelKey = string;

export const ModelStatusValues = [
  "available",
  "degraded",
  "unavailable",
  "unknown",
] as const;
export type ModelStatus = (typeof ModelStatusValues)[number];

export const MediaInputTypeValues = [
  "text",
  "image",
  "video",
  "audio",
  "reference_image",
  "start_frame",
  "end_frame",
  "source_video",
] as const;
export type MediaInputType = (typeof MediaInputTypeValues)[number];

export const MediaOutputTypeValues = [
  "image",
  "video",
  "audio",
  "lipsync_video",
  "carousel",
] as const;
export type MediaOutputType = (typeof MediaOutputTypeValues)[number];

export type AspectRatio = BriefAspectRatio;

export type DurationCapabilities = {
  minimumSeconds?: number;
  maximumSeconds?: number;
  supportedValuesSeconds?: number[];
};

export type ReferenceCapabilities = {
  /** Tri-state: true / false / unknown (undefined). */
  referenceImages?: boolean;
  startFrame?: boolean;
  endFrame?: boolean;
  characterIdentity?: boolean;
  product?: boolean;
  audioVoice?: boolean;
  maxReferences?: number;
};

export type AudioCapabilities = {
  inputAudio?: boolean;
  nativeAudioOutput?: boolean;
  nativeDialogue?: boolean;
  voiceOver?: boolean;
  lipsync?: boolean;
  voiceControl?: boolean;
};

export type CharacterCapabilities = {
  maxCharacters?: number;
  identityPreservation?: boolean;
  multiCharacter?: boolean;
};

export type ModelLimits = {
  maxPromptChars?: number;
  maxOutputSeconds?: number;
  concurrencyHint?: number;
};

/** Integer score 0–100. Absence = unknown. */
export type Score = number;

export type CapabilityScores = {
  quality?: Score;
  identity?: Score;
  speed?: Score;
  reliability?: Score;
  costEfficiency?: Score;
};

export const EvidenceSourceValues = [
  "code",
  "legacy_pricing",
  "provider_documentation",
  "manual",
  "runtime_observation",
] as const;
export type EvidenceSource = (typeof EvidenceSourceValues)[number];

export const EvidenceConfidenceValues = [
  "verified",
  "high",
  "medium",
  "low",
  "unknown",
] as const;
export type EvidenceConfidence = (typeof EvidenceConfidenceValues)[number];

export type CapabilityEvidence = {
  field: string;
  source: EvidenceSource;
  reference: string;
  verifiedAt?: string;
  confidence: EvidenceConfidence;
};

export type ModelCapabilities = {
  providerId: ProviderId;
  /** Unique within provider. */
  modelId: ModelId;
  /** External adapter id when different from modelId. */
  externalModelId?: string;
  displayName: string;
  enabled: boolean;
  status: ModelStatus;
  supportedProfiles: CapabilityProfile[];
  mediaInputs: MediaInputType[];
  mediaOutputs: MediaOutputType[];
  supportedAspectRatios: AspectRatio[];
  duration: DurationCapabilities;
  references: ReferenceCapabilities;
  audio: AudioCapabilities;
  characters: CharacterCapabilities;
  limits: ModelLimits;
  pricing: PricingDefinition[];
  quality: CapabilityScores;
  regions: RegionCode[];
  evidence: CapabilityEvidence[];
  verifiedAt?: string;
  /**
   * Motion-transfer discriminant block (MT-002).
   * Required when supportedProfiles includes video.motion_transfer.
   * Absence ⇒ model is NOT motion-transfer capable (I2V/T2V alone never suffice).
   */
  motionTransfer?: MotionTransferModelCapabilities;
};

export const MODEL_ID_MAX = 160;
export const DISPLAY_NAME_MAX = 160;

const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._/\-]{0,159}$/;

export function normalizeModelId(raw: string): ModelId {
  const id = raw.trim();
  if (!id || id.length > MODEL_ID_MAX || !MODEL_ID_RE.test(id)) {
    throw new CapabilityDomainError(
      "invalid_identifier",
      "Invalid model identifier.",
      "modelId length or format invalid",
    );
  }
  return id;
}

export function tryNormalizeModelId(raw: string): ModelId | null {
  const id = raw.trim();
  if (!id || id.length > MODEL_ID_MAX || !MODEL_ID_RE.test(id)) return null;
  return id;
}

/** Canonical key avoiding inter-provider collisions. */
export function canonicalModelKey(providerId: ProviderId, modelId: ModelId): CanonicalModelKey {
  return `${providerId}::${modelId}`;
}

/**
 * Profile support is explicit membership only.
 * Unknown / empty supportedProfiles ⇒ not supported.
 */
export function supportsCapabilityProfile(
  model: ModelCapabilities,
  profile: CapabilityProfile,
): boolean {
  return model.supportedProfiles.includes(profile);
}
