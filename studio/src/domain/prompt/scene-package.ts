/**
 * ScenePackage contract (VHS-106).
 * One immutable artifact per storyboard scene — no provider routing.
 */

import type { ArtifactMetadata } from "@/domain/shared";
import type { ProductionIntent } from "@/domain/storyboard";
import type {
  ActionBlock,
  AudioBlock,
  CameraBlock,
  CompositionBlock,
  DialogueBlock,
  EnvironmentBlock,
  LightingBlock,
  ScreenTextBlock,
  StyleBlock,
  SubjectBlock,
} from "./blocks";
import type { CapabilityProfile, MediaType } from "./capability-profiles";
import type { PromptBlockName } from "./blocks";
import type { ConstraintBlock } from "./constraints";
import type { PromptReference } from "./references";

export const SCENE_PACKAGE_SCHEMA_VERSION = "1.0.0" as const;
export const SCENE_PACKAGE_ARTIFACT_TYPE = "scene_package" as const;
/** Canonical atomic lot of ScenePackage[] (VHS-122). Never activate individual packages alone. */
export const SCENE_PACKAGE_SET_SCHEMA_VERSION = "1.0.0" as const;
export const SCENE_PACKAGE_SET_ARTIFACT_TYPE = "scene_package_set" as const;
export const PROMPT_RENDERER_VERSION = "prompt-renderer-v1" as const;

export const PROMPT_FIELD_LIMITS = {
  description: 320,
  action: 200,
  secondaryActionsMax: 6,
  identityReqMax: 8,
  identityReqItem: 120,
  positiveMax: 2500,
  negativeMax: 800,
  constraintDescription: 240,
  assumptionStatement: 300,
  evidenceSummary: 240,
  evidenceMax: 24,
  assumptionsMax: 12,
  variantsMax: 8,
  referencesMax: 16,
  rationaleSummary: 500,
} as const;

export type PromptVariant = {
  id: string;
  capabilityProfile: CapabilityProfile;
  mediaType: MediaType;
  positive: string;
  negative?: string;
  rendererVersion: string;
  language: string;
  includedBlocks: PromptBlockName[];
};

export type PromptAssumption = {
  id: string;
  statement: string;
  status: "explicit" | "inferred" | "unverified";
  justification?: string;
  affectsFields?: string[];
};

export type PromptEvidence = {
  field: string;
  source:
    | "marketing_plan"
    | "creative_concept"
    | "video_script"
    | "visual_direction"
    | "storyboard"
    | "brief"
    | "derived";
  sourcePath?: string;
  summary: string;
};

export type PromptRationale = {
  summary: string;
  decisions: Array<{ field: string; summary: string; evidenceRefs: string[] }>;
};

export type ScenePackageFields = {
  artifactType: typeof SCENE_PACKAGE_ARTIFACT_TYPE;
  storyboardRevisionId: string;
  sceneId: string;
  sceneOrder: number;
  productionIntent: ProductionIntent;
  subject: SubjectBlock;
  action: ActionBlock;
  environment: EnvironmentBlock;
  camera: CameraBlock;
  lighting: LightingBlock;
  style: StyleBlock;
  composition: CompositionBlock;
  dialogue?: DialogueBlock;
  audio?: AudioBlock;
  screenText?: ScreenTextBlock;
  references: PromptReference[];
  constraints: ConstraintBlock;
  variants: PromptVariant[];
  assumptions: PromptAssumption[];
  evidence: PromptEvidence[];
  rationale: PromptRationale;
};

export type ScenePackage = ArtifactMetadata & ScenePackageFields;

/** Application envelope — not a competing business artifact. */
export type PromptDirectorOutput = {
  storyboardRevisionId: string;
  packages: ScenePackage[];
};

/**
 * Persisted atomic lot — single active revision for the full ScenePackage[].
 * Individual scene_package rows are never activated independently.
 */
export type ScenePackageSetFields = {
  artifactType: typeof SCENE_PACKAGE_SET_ARTIFACT_TYPE;
  storyboardRevisionId: string;
  rendererVersion: typeof PROMPT_RENDERER_VERSION;
  packages: ScenePackage[];
};

export type ScenePackageSet = ArtifactMetadata & ScenePackageSetFields;

/**
 * Untrusted analyzer hints only. Director rebuilds blocks from sources.
 * Must not supply authoritative dialogue, references, or profiles.
 */
export type PromptAnalysisCandidate = {
  sceneHints?: Array<{
    sceneId: string;
    primaryActionHint?: string;
    motionIntensityHint?: ActionBlock["motionIntensity"];
    notes?: string;
  }>;
  assumptions?: PromptAssumption[];
  notes?: string;
};
