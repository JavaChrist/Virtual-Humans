/**
 * VisualDirection contract (VHS-104).
 * Visual intent per script segment — no prompts, models, or shot breakdown.
 */

import type { ArtifactMetadata } from "@/domain/shared";
import type { CharacterDirection } from "./runtime-capabilities";

export const VISUAL_DIRECTION_SCHEMA_VERSION = "1.0.0" as const;

export const GlobalStyleValues = [
  "corporate",
  "lifestyle",
  "premium",
  "cinematic",
  "commercial",
  "minimal",
  "technological",
  "natural",
] as const;
export type GlobalStyleKind = (typeof GlobalStyleValues)[number];

export const RealismValues = ["stylized", "semi_realistic", "photorealistic"] as const;
export type Realism = (typeof RealismValues)[number];

export const ColorRoleValues = [
  "primary",
  "secondary",
  "accent",
  "background",
  "text",
] as const;
export type ColorRole = (typeof ColorRoleValues)[number];

export const LocationKindValues = ["interior", "exterior", "studio", "abstract"] as const;
export const TimeOfDayValues = ["dawn", "day", "golden_hour", "dusk", "night"] as const;
export const ShotSizeValues = [
  "extreme_close_up",
  "close_up",
  "medium",
  "medium_wide",
  "full",
  "wide",
] as const;
export const CameraAngleValues = [
  "eye_level",
  "high",
  "low",
  "over_shoulder",
  "top_down",
] as const;
export const CameraMovementValues = [
  "static",
  "pan",
  "tilt",
  "tracking",
  "dolly",
  "handheld",
] as const;
export const DepthOfFieldValues = ["shallow", "medium", "deep"] as const;
export const LightSourceValues = ["natural", "studio", "mixed", "practical", "neon"] as const;
export const LightQualityValues = ["soft", "hard", "diffused"] as const;
export const LightTemperatureValues = ["warm", "neutral", "cool"] as const;
export const LightContrastValues = ["low", "medium", "high"] as const;
export const TransitionIntentValues = [
  "cut",
  "match",
  "dissolve",
  "hold",
  "reveal",
  "continuation",
] as const;
export const ContinuityScopeValues = [
  "character",
  "outfit",
  "location",
  "lighting",
  "palette",
  "product",
  "screen_direction",
] as const;

export const ART_FIELD_LIMITS = {
  mood: 120,
  colorIntent: 160,
  textureIntent: 160,
  brandAlignment: 200,
  colorName: 40,
  locationDescription: 240,
  weather: 60,
  continuityKey: 64,
  cameraIntent: 160,
  lightingIntent: 160,
  environmentDescription: 240,
  compositionNote: 200,
  framingIntent: 160,
  subjectPosition: 80,
  lookDirection: 80,
  continuityDescription: 240,
  assumptionStatement: 300,
  assumptionJustification: 300,
  assumptionsMax: 12,
  evidenceSummary: 240,
  evidenceField: 80,
  evidenceSourcePath: 120,
  evidenceMax: 32,
  rationaleSummary: 500,
  decisionCountMax: 24,
  continuityRulesMax: 16,
  paletteMax: 8,
} as const;

export type GlobalVisualStyle = {
  style: GlobalStyleKind;
  mood: string;
  realism: Realism;
  colorIntent: string;
  textureIntent?: string;
  brandAlignment: string;
};

export type ColorToken = {
  name: string;
  hex: string;
  role: ColorRole;
};

export type LocationDirection = {
  kind: (typeof LocationKindValues)[number];
  description: string;
  timeOfDay?: (typeof TimeOfDayValues)[number];
  weather?: string;
  continuityKey: string;
};

export type CameraDirection = {
  shotSize: (typeof ShotSizeValues)[number];
  angle: (typeof CameraAngleValues)[number];
  movement: (typeof CameraMovementValues)[number];
  depthOfField: (typeof DepthOfFieldValues)[number];
  intent: string;
};

export type LightingDirection = {
  source: (typeof LightSourceValues)[number];
  quality: (typeof LightQualityValues)[number];
  temperature: (typeof LightTemperatureValues)[number];
  contrast: (typeof LightContrastValues)[number];
  intent: string;
};

export type EnvironmentDirection = {
  description: string;
  productVisibility: "none" | "secondary" | "hero";
  clutterLevel: "minimal" | "balanced" | "busy";
};

export type CompositionDirection = {
  subjectPosition: "center" | "left_third" | "right_third";
  lookDirection: "camera" | "left" | "right" | "away" | "product";
  visualHierarchy: string;
  textSafeArea: "none" | "top" | "bottom" | "left" | "right";
  productPlacement?: string;
};

export type TransitionIntent = (typeof TransitionIntentValues)[number];

export type SegmentVisualDirection = {
  id: string;
  scriptSegmentId: string;
  location: LocationDirection;
  camera: CameraDirection;
  lighting: LightingDirection;
  character?: CharacterDirection;
  environment: EnvironmentDirection;
  composition: CompositionDirection;
  transitionIntent: TransitionIntent;
};

export type ContinuityRule = {
  id: string;
  scope: (typeof ContinuityScopeValues)[number];
  description: string;
  appliesToSegmentIds: string[];
  severity: "required" | "preferred";
};

export type ArtAssumption = {
  id: string;
  statement: string;
  status: "explicit" | "inferred" | "unverified";
  justification?: string;
  affectsFields?: string[];
};

export type ArtEvidence = {
  field: string;
  source:
    | "marketing_plan"
    | "creative_concept"
    | "video_script"
    | "brief"
    | "runtime_snapshot"
    | "user_constraint"
    | "derived";
  sourcePath?: string;
  summary: string;
};

export type ArtRationale = {
  summary: string;
  decisions: Array<{ field: string; summary: string; evidenceRefs: string[] }>;
};

export type VisualDirectionFields = {
  videoScriptRevisionId: string;
  creativeConceptRevisionId: string;
  globalStyle: GlobalVisualStyle;
  palette: ColorToken[];
  continuityRules: ContinuityRule[];
  segments: SegmentVisualDirection[];
  assumptions: ArtAssumption[];
  evidence: ArtEvidence[];
  rationale: ArtRationale;
};

export type VisualDirection = ArtifactMetadata & VisualDirectionFields;

export type ArtAnalysisCandidate = {
  globalStyle: GlobalVisualStyle;
  palette: ColorToken[];
  continuityRules: ContinuityRule[];
  segments: SegmentVisualDirection[];
  assumptions?: ArtAssumption[];
  claimedEvidence?: ArtEvidence[];
  notes?: string;
};
