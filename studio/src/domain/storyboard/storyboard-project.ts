/**
 * StoryboardProject contract (VHS-105).
 * Immutable production shooting contract for a given revision pair.
 *
 * Coexistence with historical Storyboard UI (`app/storyboard/page.tsx`):
 * - Historical `Shot` = UI execution unit (prompt, model, videoUrl, lip-sync).
 * - This artifact = domain shooting contract (no prompts/providers).
 * - One storyboard engine in the product: future extraction maps TO this domain;
 *   this increment does NOT create a second app or modify the historical page.
 */

import type { ArtifactMetadata } from "@/domain/shared";
import type { BriefAspectRatio, BriefDurationSeconds } from "@/domain/brief";
import type { StoryboardScene } from "./scene";
import type { StoryboardTimingReport } from "./timing";

export const STORYBOARD_PROJECT_SCHEMA_VERSION = "1.0.0" as const;

export const STORYBOARD_FIELD_LIMITS = {
  title: 100,
  sceneTitle: 80,
  screenText: 120,
  spokenText: 400,
  referenceRole: 80,
  continuityKey: 64,
  continuityKeysMax: 16,
  transitionJustification: 200,
  assumptionStatement: 300,
  assumptionJustification: 300,
  assumptionsMax: 12,
  evidenceSummary: 240,
  evidenceField: 80,
  evidenceSourcePath: 120,
  evidenceMax: 32,
  rationaleSummary: 500,
  decisionCountMax: 24,
  scenesMin: 1,
  scenesMax: 20,
  referencesMax: 16,
} as const;

/** Recommended scene counts by target duration — soft guidance (warnings only). */
export const RECOMMENDED_SCENE_RANGES: Record<
  BriefDurationSeconds,
  { min: number; max: number }
> = {
  15: { min: 2, max: 3 },
  20: { min: 3, max: 4 },
  30: { min: 4, max: 6 },
  60: { min: 6, max: 10 },
};

export type StoryboardAssumption = {
  id: string;
  statement: string;
  status: "explicit" | "inferred" | "unverified";
  justification?: string;
  affectsFields?: string[];
};

export type StoryboardEvidence = {
  field: string;
  source:
    | "marketing_plan"
    | "creative_concept"
    | "video_script"
    | "visual_direction"
    | "brief"
    | "user_constraint"
    | "derived";
  sourcePath?: string;
  summary: string;
};

export type StoryboardRationale = {
  summary: string;
  decisions: Array<{ field: string; summary: string; evidenceRefs: string[] }>;
};

export type StoryboardContinuityReport = {
  projectedRuleIds: string[];
  sceneKeys: Array<{ sceneId: string; keys: string[] }>;
  intentionalBreaks: Array<{
    sceneId: string;
    scope: string;
    justification: string;
  }>;
  warnings: Array<{ code: string; message: string; field?: string }>;
};

export type StoryboardProjectFields = {
  videoScriptRevisionId: string;
  visualDirectionRevisionId: string;
  title: string;
  durationSeconds: BriefDurationSeconds;
  aspectRatio: BriefAspectRatio;
  scenes: StoryboardScene[];
  timing: StoryboardTimingReport;
  continuity: StoryboardContinuityReport;
  assumptions: StoryboardAssumption[];
  evidence: StoryboardEvidence[];
  rationale: StoryboardRationale;
};

export type StoryboardProject = ArtifactMetadata & StoryboardProjectFields;

/** Untrusted analyzer candidate — no authoritative timing/metadata/prompts. */
export type StoryboardAnalysisCandidate = {
  title: string;
  scenes: Array<
    Omit<StoryboardScene, "durationSeconds" | "transition"> & {
      /** Proposed only — recalculated by domain. */
      durationSeconds?: number;
      transition: StoryboardScene["transition"];
    }
  >;
  intentionalBreaks?: StoryboardContinuityReport["intentionalBreaks"];
  assumptions?: StoryboardAssumption[];
  claimedEvidence?: StoryboardEvidence[];
  /** Ignored if present — never trusted. */
  claimedTotalDurationSeconds?: number;
  notes?: string;
  /** Optional structured justification when outside recommended scene count. */
  sceneCountJustification?: string;
};
