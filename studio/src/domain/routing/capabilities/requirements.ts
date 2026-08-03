/**
 * Capability requirements derived from ScenePackage + Storyboard (VHS-107).
 * Pure — never selects a model.
 */

import type { CapabilityProfile } from "@/domain/prompt";
import { profilesForProductionIntent } from "@/domain/prompt";
import type { ScenePackage } from "@/domain/prompt";
import type { StoryboardProject } from "@/domain/storyboard";
import { CapabilityDomainError } from "./errors";
import type { AspectRatio, MediaInputType, MediaOutputType } from "./model";
import type { RegionCode } from "./provider";

export type ReferenceRequirement = {
  kind: string;
  required: boolean;
  role?: string;
};

export type CapabilityRequirements = {
  sceneId: string;
  requiredProfiles: CapabilityProfile[];
  mediaInputs: MediaInputType[];
  expectedOutput: MediaOutputType;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  requiredReferences: ReferenceRequirement[];
  needsDialogue: boolean;
  needsNativeAudio: boolean;
  characterCount: number;
  identityPriority: "low" | "medium" | "high";
  region?: RegionCode;
  /** When true, eligibility requires at least one valid pricing line. */
  pricingRequired: boolean;
};

function expectedOutputForIntent(
  intent: ScenePackage["productionIntent"],
): MediaOutputType {
  switch (intent) {
    case "carousel":
      return "carousel";
    case "text_motion":
      return "image";
    case "talking_head":
      return "video";
    default:
      return "video";
  }
}

function mediaInputsForPackage(pkg: ScenePackage): MediaInputType[] {
  const inputs: MediaInputType[] = ["text"];
  const hasStart = pkg.references.some(
    (r) => r.kind === "character" || r.kind === "pose" || r.kind === "expression",
  );
  const hasProduct = pkg.references.some((r) => r.kind === "product" || r.kind === "screen");
  if (hasStart || pkg.productionIntent === "image_to_video") {
    inputs.push("start_frame", "reference_image");
  }
  if (hasProduct) inputs.push("image");
  if (pkg.dialogue || pkg.audio) inputs.push("audio");
  return [...new Set(inputs)];
}

function characterCountFromPackage(pkg: ScenePackage): number {
  const ids = new Set<string>();
  if (pkg.subject.characterId) ids.add(pkg.subject.characterId);
  for (const r of pkg.references) {
    if (r.kind === "character") ids.add(r.sourceId);
  }
  if (ids.size > 0) return ids.size;
  if (pkg.subject.kind === "character") return 1;
  return 0;
}

function identityPriority(pkg: ScenePackage): "low" | "medium" | "high" {
  const hasIdentityRef = pkg.references.some(
    (r) => r.kind === "character" && r.required,
  );
  if (
    pkg.productionIntent === "talking_head" ||
    pkg.productionIntent === "image_to_video" ||
    hasIdentityRef
  ) {
    return "high";
  }
  if (pkg.subject.kind === "character") return "medium";
  return "low";
}

/**
 * Derive pure requirements from an immutable ScenePackage + its storyboard.
 * Fails if indispensable information is missing.
 */
export function deriveCapabilityRequirements(
  scenePackage: ScenePackage,
  storyboard: StoryboardProject,
): CapabilityRequirements {
  if (scenePackage.projectId !== storyboard.projectId) {
    throw new CapabilityDomainError(
      "unsupported_requirement",
      "Scene package and storyboard belong to different projects.",
    );
  }
  if (scenePackage.storyboardRevisionId !== storyboard.id) {
    throw new CapabilityDomainError(
      "unsupported_requirement",
      "Scene package revision does not match storyboard revision.",
    );
  }

  const scene = storyboard.scenes.find((s) => s.id === scenePackage.sceneId);
  if (!scene) {
    throw new CapabilityDomainError(
      "unsupported_requirement",
      "Scene not found in storyboard.",
      `sceneId=${scenePackage.sceneId}`,
    );
  }

  if (!(scene.durationSeconds > 0)) {
    throw new CapabilityDomainError(
      "unsupported_requirement",
      "Scene duration is missing or invalid.",
    );
  }

  const profiles = profilesForProductionIntent(scenePackage.productionIntent).map(
    (p) => p.profile,
  );
  const needsDialogue =
    scenePackage.dialogue?.kind === "dialogue" ||
    scene.spokenContent.kind === "dialogue";
  const needsVoiceOver =
    scenePackage.dialogue?.kind === "voice_over" ||
    scene.spokenContent.kind === "voice_over" ||
    Boolean(scenePackage.audio);

  return {
    sceneId: scenePackage.sceneId,
    requiredProfiles: [...profiles],
    mediaInputs: mediaInputsForPackage(scenePackage),
    expectedOutput: expectedOutputForIntent(scenePackage.productionIntent),
    aspectRatio: storyboard.aspectRatio,
    durationSeconds: scene.durationSeconds,
    requiredReferences: scenePackage.references
      .filter((r) => r.required)
      .map((r) => ({ kind: r.kind, required: true, role: r.role })),
    needsDialogue,
    needsNativeAudio: needsDialogue || needsVoiceOver,
    characterCount: characterCountFromPackage(scenePackage),
    identityPriority: identityPriority(scenePackage),
    pricingRequired: true,
    // region intentionally omitted unless explicitly known
  };
}
