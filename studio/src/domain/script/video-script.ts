/**
 * VideoScript contract (VHS-103).
 * Spoken / on-screen narration only — no visual or generation decisions.
 */

import type { ArtifactMetadata } from "@/domain/shared";
import type { BriefDurationSeconds } from "@/domain/brief";

export const VIDEO_SCRIPT_SCHEMA_VERSION = "1.0.0" as const;

export const ScriptSegmentPurposeValues = [
  "hook",
  "problem",
  "presentation",
  "proof",
  "transition",
  "cta",
] as const;
export type ScriptSegmentPurpose = (typeof ScriptSegmentPurposeValues)[number];

export const ScriptSpeakerValues = ["character", "voice_over", "none"] as const;
export type ScriptSpeaker = (typeof ScriptSpeakerValues)[number];

export const SCRIPT_FIELD_LIMITS = {
  title: 80,
  summary: 400,
  hookText: 220,
  dialogue: 400,
  voiceOver: 400,
  screenText: 120,
  emotion: 60,
  pronunciationTerm: 80,
  pronunciationValue: 120,
  pronunciationNotesMax: 8,
  pauseAfterMsMin: 0,
  pauseAfterMsMax: 2000,
  segmentsMin: 2,
  segmentsMax: 12,
  assumptionStatement: 300,
  assumptionJustification: 300,
  assumptionsMax: 12,
  evidenceSummary: 240,
  evidenceField: 80,
  evidenceSourcePath: 120,
  evidenceMax: 28,
  rationaleSummary: 500,
  decisionCountMax: 24,
  ctaText: 160,
  ctaAdaptationNote: 240,
} as const;

export type PronunciationNote = {
  term: string;
  pronunciation: string;
  language?: string;
};

export type ScriptSegment = {
  id: string;
  order: number;
  purpose: ScriptSegmentPurpose;
  speaker: ScriptSpeaker;
  dialogue?: string;
  voiceOver?: string;
  screenText?: string;
  emotion: string;
  pauseAfterMs: number;
  pronunciationNotes: PronunciationNote[];
};

export type ScriptHook = {
  segmentId: string;
  text: string;
};

export type ScriptCallToAction = {
  segmentId: string;
  text: string;
  /** Marketing CTA text conserved as source of truth for the action. */
  sourceMarketingCta: string;
  /** Optional note when grammar/oral adaptation was applied (action unchanged). */
  adaptationNote?: string;
};

export type ScriptAssumption = {
  id: string;
  statement: string;
  status: "explicit" | "inferred" | "unverified";
  justification?: string;
  affectsFields?: string[];
};

export type ScriptEvidence = {
  field: string;
  source: "marketing_plan" | "creative_concept" | "brief" | "user_constraint" | "derived";
  sourcePath?: string;
  summary: string;
};

export type ScriptRationaleDecision = {
  field: string;
  summary: string;
  evidenceRefs: string[];
};

export type ScriptRationale = {
  summary: string;
  decisions: ScriptRationaleDecision[];
};

export type SegmentTiming = {
  segmentId: string;
  order: number;
  spokenDurationSeconds: number;
  screenDurationSeconds: number;
  pauseDurationSeconds: number;
  /** max(spoken, screen) + pause */
  totalDurationSeconds: number;
};

export type ScriptTimingReport = {
  profileId: string;
  spokenWordCount: number;
  screenWordCount: number;
  spokenDurationSeconds: number;
  screenDurationSeconds: number;
  pausesDurationSeconds: number;
  estimatedTotalSeconds: number;
  targetDurationSeconds: number;
  differenceSeconds: number;
  status: "within_target" | "too_short" | "too_long";
  segmentTimings: SegmentTiming[];
};

export type VideoScriptFields = {
  creativeConceptRevisionId: string;
  marketingPlanRevisionId: string;
  title: string;
  summary: string;
  language: string;
  targetDurationSeconds: BriefDurationSeconds;
  estimatedDurationSeconds: number;
  estimatedReadingSeconds: number;
  hook: ScriptHook;
  segments: ScriptSegment[];
  callToAction: ScriptCallToAction;
  timing: ScriptTimingReport;
  assumptions: ScriptAssumption[];
  evidence: ScriptEvidence[];
  rationale: ScriptRationale;
};

export type VideoScript = ArtifactMetadata & VideoScriptFields;

/** Untrusted analyzer output — timing from candidate is ignored. */
export type ScriptAnalysisCandidate = {
  title: string;
  summary: string;
  language: string;
  hookText: string;
  segments: ScriptSegment[];
  callToActionText: string;
  adaptationNote?: string;
  assumptions?: ScriptAssumption[];
  claimedEvidence?: ScriptEvidence[];
  notes?: string;
};
