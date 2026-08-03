/**
 * CreativeConcept contract (VHS-102).
 * Consumes MarketingPlan decisions; never writes dialogue, shots, or prompts.
 */

import type { ArtifactMetadata } from "@/domain/shared";

export const CREATIVE_CONCEPT_SCHEMA_VERSION = "1.0.0" as const;

export const NarrativeApproachValues = [
  "problem_solution",
  "demonstration",
  "testimonial",
  "transformation",
  "slice_of_life",
  "tutorial",
  "brand_story",
] as const;
export type NarrativeApproach = (typeof NarrativeApproachValues)[number];

export const CreativeRhythmValues = ["calm", "balanced", "dynamic"] as const;
export type CreativeRhythm = (typeof CreativeRhythmValues)[number];

export const EmotionalPurposeValues = [
  "attention",
  "recognition",
  "tension",
  "discovery",
  "confidence",
  "desire",
  "action",
] as const;
export type EmotionalPurpose = (typeof EmotionalPurposeValues)[number];

export const CreativeDeviceKindValues = [
  "question",
  "contrast",
  "demonstration",
  "reveal",
  "testimonial",
  "before_after",
  "challenge",
  "direct_address",
  "visual_metaphor",
] as const;
export type CreativeDeviceKind = (typeof CreativeDeviceKindValues)[number];

export const CreativeEvidenceSourceValues = [
  "marketing_plan",
  "brief",
  "user_constraint",
  "derived",
] as const;
export type CreativeEvidenceSource = (typeof CreativeEvidenceSourceValues)[number];

export const AssumptionStatusValues = ["explicit", "inferred", "unverified"] as const;
export type AssumptionStatus = (typeof AssumptionStatusValues)[number];

/** Generic creative attributes only — never living artists or providers. */
export const AllowedReferenceKeywordValues = [
  "premium",
  "minimal",
  "warm",
  "energetic",
  "documentary",
  "playful",
  "authentic",
  "technological",
  "cinematic",
] as const;
export type AllowedReferenceKeyword = (typeof AllowedReferenceKeywordValues)[number];

export const CREATIVE_FIELD_LIMITS = {
  title: 80,
  logline: 220,
  bigIdea: 200,
  emotion: 60,
  beatDescription: 200,
  deviceDescription: 200,
  referenceKeyword: 40,
  referenceKeywordsMax: 6,
  constraintText: 200,
  constraintsMax: 8,
  assumptionStatement: 300,
  assumptionJustification: 300,
  assumptionsMax: 12,
  evidenceSummary: 240,
  evidenceField: 80,
  evidenceSourcePath: 120,
  evidenceMax: 24,
  rationaleSummary: 500,
  decisionCountMax: 20,
  beatsMin: 2,
  beatsMax: 6,
} as const;

export type EmotionalBeat = {
  order: number;
  purpose: EmotionalPurpose;
  emotion: string;
  description: string;
};

export type CreativeDevice = {
  kind: CreativeDeviceKind;
  description: string;
};

export type CreativeConstraint = {
  id: string;
  text: string;
  source: "marketing_plan" | "brief" | "user_constraint" | "derived";
};

export type CreativeAssumption = {
  id: string;
  statement: string;
  status: AssumptionStatus;
  justification?: string;
  affectsFields?: string[];
};

export type CreativeEvidence = {
  field: string;
  source: CreativeEvidenceSource;
  sourcePath?: string;
  summary: string;
};

export type CreativeRationaleDecision = {
  field: string;
  summary: string;
  evidenceRefs: string[];
};

export type CreativeRationale = {
  summary: string;
  decisions: CreativeRationaleDecision[];
};

export type CreativeConceptFields = {
  marketingPlanRevisionId: string;
  title: string;
  logline: string;
  bigIdea: string;
  narrativeApproach: NarrativeApproach;
  emotionalArc: EmotionalBeat[];
  openingDevice: CreativeDevice;
  proofDevice?: CreativeDevice;
  endingDevice: CreativeDevice;
  rhythm: CreativeRhythm;
  referenceKeywords: string[];
  constraints: CreativeConstraint[];
  assumptions: CreativeAssumption[];
  evidence: CreativeEvidence[];
  rationale: CreativeRationale;
};

export type CreativeConcept = ArtifactMetadata & CreativeConceptFields;

/**
 * Untrusted analyzer output — never an approved CreativeConcept.
 */
export type CreativeAnalysisCandidate = {
  title: string;
  logline: string;
  bigIdea: string;
  narrativeApproach: NarrativeApproach;
  emotionalArc: EmotionalBeat[];
  openingDevice: CreativeDevice;
  proofDevice?: CreativeDevice;
  endingDevice: CreativeDevice;
  rhythm: CreativeRhythm;
  referenceKeywords: string[];
  constraints?: CreativeConstraint[];
  assumptions?: CreativeAssumption[];
  claimedEvidence?: CreativeEvidence[];
  notes?: string;
};

/** Max emotional beats suggested by video duration (still capped by FIELD_LIMITS). */
export function maxBeatsForDurationSeconds(durationSeconds: number): number {
  if (durationSeconds <= 15) return 3;
  if (durationSeconds <= 20) return 4;
  if (durationSeconds <= 30) return 5;
  return CREATIVE_FIELD_LIMITS.beatsMax;
}
