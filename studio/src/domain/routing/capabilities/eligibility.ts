/**
 * Pure eligibility filter (VHS-107).
 * Does not score, rank, or select models.
 */

import type { CapabilityProfile } from "@/domain/prompt";
import { isPricingValidAt } from "./availability";
import {
  supportsCapabilityProfile,
  type ModelCapabilities,
} from "./model";
import type { ProviderDefinition } from "./provider";
import type { CapabilityRequirements } from "./requirements";

export type IneligibilityReason = {
  code: string;
  message: string;
  field?: string;
};

export type EligibilityWarning = {
  code: string;
  message: string;
  field?: string;
};

export type EligibilityResult =
  | {
      eligible: true;
      warnings: EligibilityWarning[];
    }
  | {
      eligible: false;
      reasons: IneligibilityReason[];
      warnings: EligibilityWarning[];
    };

function reason(code: string, message: string, field?: string): IneligibilityReason {
  return { code, message, field };
}

function warn(code: string, message: string, field?: string): EligibilityWarning {
  return { code, message, field };
}

function durationCompatible(
  model: ModelCapabilities,
  durationSeconds: number,
): { ok: boolean; unknown: boolean; message?: string; softWarning?: string } {
  const d = model.duration;
  const discrete = d.supportedValuesSeconds ?? [];
  const hasAny =
    d.minimumSeconds !== undefined ||
    d.maximumSeconds !== undefined ||
    discrete.length > 0;

  if (!hasAny) {
    return { ok: false, unknown: true, message: "Duration capabilities unknown." };
  }

  const minBound =
    d.minimumSeconds ?? (discrete.length ? Math.min(...discrete) : undefined);
  const maxBound =
    d.maximumSeconds ?? (discrete.length ? Math.max(...discrete) : undefined);

  if (minBound !== undefined && durationSeconds < minBound) {
    return { ok: false, unknown: false, message: "Duration below minimum." };
  }
  if (maxBound !== undefined && durationSeconds > maxBound) {
    return { ok: false, unknown: false, message: "Duration above maximum." };
  }
  if (discrete.length > 0 && !discrete.includes(durationSeconds)) {
    return {
      ok: true,
      unknown: false,
      softWarning: "Duration within bounds but not an exact discrete provider value.",
    };
  }
  return { ok: true, unknown: false };
}

function referencesCompatible(
  model: ModelCapabilities,
  requirements: CapabilityRequirements,
): { ok: boolean; unknown: boolean; reasons: IneligibilityReason[] } {
  const reasons: IneligibilityReason[] = [];
  let unknown = false;
  const needsIdentity =
    requirements.identityPriority === "high" ||
    requirements.requiredReferences.some((r) => r.kind === "character");

  if (needsIdentity) {
    if (model.references.characterIdentity === undefined) {
      unknown = true;
      reasons.push(
        reason(
          "critical_unknown",
          "Character identity capability unknown.",
          "references.characterIdentity",
        ),
      );
    } else if (model.references.characterIdentity === false) {
      reasons.push(
        reason(
          "unsupported_requirement",
          "Model does not support character identity references.",
          "references.characterIdentity",
        ),
      );
    }
  }

  if (requirements.mediaInputs.includes("start_frame")) {
    if (model.references.startFrame === undefined && model.references.referenceImages === undefined) {
      unknown = true;
      reasons.push(
        reason("critical_unknown", "Start frame / reference image support unknown.", "references"),
      );
    } else if (
      model.references.startFrame === false &&
      model.references.referenceImages === false
    ) {
      reasons.push(
        reason("unsupported_requirement", "Model rejects start/reference images.", "references"),
      );
    }
  }

  return { ok: reasons.length === 0, unknown, reasons };
}

/**
 * Evaluate whether a model can satisfy requirements at time `at` (UTC ISO).
 * Unknown mandatory info ⇒ ineligible (never treated as true).
 */
export function evaluateEligibility(
  model: ModelCapabilities,
  requirements: CapabilityRequirements,
  at: string,
  provider?: ProviderDefinition,
): EligibilityResult {
  const reasons: IneligibilityReason[] = [];
  const warnings: EligibilityWarning[] = [];

  if (!model.enabled) {
    reasons.push(reason("model_disabled", "Model is disabled.", "enabled"));
  }
  if (model.status === "unavailable") {
    reasons.push(reason("model_unavailable", "Model status is unavailable.", "status"));
  }
  if (model.status === "unknown") {
    warnings.push(warn("status_unknown", "Model status is unknown.", "status"));
  }
  if (model.status === "degraded") {
    warnings.push(warn("status_degraded", "Model status is degraded.", "status"));
  }

  if (provider) {
    if (!provider.enabled) {
      reasons.push(reason("provider_disabled", "Provider is disabled.", "provider.enabled"));
    }
    if (provider.status === "unavailable") {
      reasons.push(
        reason("provider_unavailable", "Provider status is unavailable.", "provider.status"),
      );
    }
    if (provider.status === "unknown") {
      warnings.push(warn("provider_status_unknown", "Provider status is unknown.", "provider.status"));
    }
  }

  // Solo eligibility: must support ≥1 required profile (multi-step composition = Router).
  const missingProfiles = requirements.requiredProfiles.filter(
    (p) => !supportsCapabilityProfile(model, p),
  );
  if (missingProfiles.length === requirements.requiredProfiles.length) {
    reasons.push(
      reason(
        "unsupported_requirement",
        "Model supports none of the required capability profiles.",
        "supportedProfiles",
      ),
    );
  } else if (missingProfiles.length > 0) {
    warnings.push(
      warn(
        "partial_profiles",
        `Model missing profiles: ${missingProfiles.join(", ")}.`,
        "supportedProfiles",
      ),
    );
  }

  if (!model.mediaOutputs.includes(requirements.expectedOutput)) {
    // Carousel/image/video mismatch — block
    // Exception: lipsync_video can satisfy video for lipsync-capable models when needsDialogue
    const lipsyncOk =
      requirements.expectedOutput === "video" &&
      model.mediaOutputs.includes("lipsync_video") &&
      requirements.needsDialogue;
    if (!lipsyncOk) {
      reasons.push(
        reason(
          "unsupported_requirement",
          "Model media output incompatible with expected output.",
          "mediaOutputs",
        ),
      );
    }
  }

  if (model.supportedAspectRatios.length === 0) {
    warnings.push(
      warn("aspect_ratio_unknown", "Supported aspect ratios unknown.", "supportedAspectRatios"),
    );
  } else if (!model.supportedAspectRatios.includes(requirements.aspectRatio)) {
    reasons.push(
      reason("unsupported_requirement", "Aspect ratio not supported.", "supportedAspectRatios"),
    );
  }

  const dur = durationCompatible(model, requirements.durationSeconds);
  if (dur.unknown) {
    if (
      requirements.expectedOutput === "video" ||
      requirements.expectedOutput === "carousel" ||
      requirements.expectedOutput === "lipsync_video"
    ) {
      reasons.push(reason("critical_unknown", dur.message ?? "Duration unknown.", "duration"));
    } else {
      warnings.push(warn("duration_unknown", dur.message ?? "Duration unknown.", "duration"));
    }
  } else if (!dur.ok) {
    reasons.push(reason("unsupported_requirement", dur.message ?? "Duration incompatible.", "duration"));
  } else if (dur.softWarning) {
    warnings.push(warn("duration_not_discrete", dur.softWarning, "duration"));
  }

  const refs = referencesCompatible(model, requirements);
  reasons.push(...refs.reasons);

  if (requirements.needsDialogue) {
    if (model.audio.nativeDialogue === true) {
      // ok
    } else if (model.audio.lipsync === true && model.audio.inputAudio === true) {
      warnings.push(
        warn("dialogue_via_lipsync", "Dialogue may require separate lipsync pipeline.", "audio"),
      );
    } else if (
      model.audio.nativeDialogue === undefined &&
      model.audio.lipsync === undefined
    ) {
      reasons.push(
        reason("critical_unknown", "Dialogue / lipsync capability unknown.", "audio"),
      );
    } else {
      reasons.push(
        reason("unsupported_requirement", "Model cannot satisfy dialogue requirement.", "audio"),
      );
    }
  }

  if (requirements.needsNativeAudio && !requirements.needsDialogue) {
    if (model.audio.nativeAudioOutput === undefined && model.audio.voiceOver === undefined) {
      warnings.push(warn("audio_unknown", "Native audio capability unknown.", "audio"));
    } else if (
      model.audio.nativeAudioOutput === false &&
      model.audio.voiceOver === false
    ) {
      reasons.push(
        reason("unsupported_requirement", "Model has no audio output path.", "audio"),
      );
    }
  }

  if (requirements.characterCount > 1) {
    if (model.characters.multiCharacter === undefined) {
      reasons.push(
        reason("critical_unknown", "Multi-character capability unknown.", "characters"),
      );
    } else if (model.characters.multiCharacter === false) {
      reasons.push(
        reason("unsupported_requirement", "Model does not support multiple characters.", "characters"),
      );
    } else if (
      model.characters.maxCharacters !== undefined &&
      requirements.characterCount > model.characters.maxCharacters
    ) {
      reasons.push(
        reason("unsupported_requirement", "Character count exceeds model maximum.", "characters"),
      );
    }
  } else if (requirements.characterCount === 1) {
    if (
      model.characters.maxCharacters !== undefined &&
      model.characters.maxCharacters < 1
    ) {
      reasons.push(
        reason("unsupported_requirement", "Model does not support characters.", "characters"),
      );
    }
  }

  if (requirements.region) {
    if (model.regions.length === 0 || model.regions.includes("unknown")) {
      warnings.push(warn("region_unknown", "Model regions unknown.", "regions"));
    } else if (
      !model.regions.includes(requirements.region) &&
      !model.regions.includes("global")
    ) {
      reasons.push(
        reason("incompatible_region", "Model not available in required region.", "regions"),
      );
    }
  }

  if (requirements.pricingRequired) {
    const validPricing = model.pricing.filter((p) => isPricingValidAt(p, at));
    if (model.pricing.length === 0) {
      reasons.push(reason("invalid_pricing", "No pricing definition available.", "pricing"));
    } else if (validPricing.length === 0) {
      reasons.push(reason("invalid_pricing", "All pricing lines expired or not yet valid.", "pricing"));
    } else if (validPricing.every((p) => p.confidence === "unknown")) {
      warnings.push(warn("pricing_confidence_unknown", "Pricing confidence unknown.", "pricing"));
    }
  }

  // Preference: unknown quality scores → warning only
  if (model.quality.quality === undefined) {
    warnings.push(warn("score_unknown", "Quality score unknown.", "quality"));
  }

  if (reasons.length > 0) {
    return { eligible: false, reasons, warnings };
  }
  return { eligible: true, warnings };
}

/** Check a single profile against a model (for dry-run listings). */
export function modelSupportsAnyProfile(
  model: ModelCapabilities,
  profiles: readonly CapabilityProfile[],
): boolean {
  return profiles.some((p) => supportsCapabilityProfile(model, p));
}
