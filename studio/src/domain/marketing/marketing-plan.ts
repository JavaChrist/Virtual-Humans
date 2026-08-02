/**
 * MarketingPlan contract (VHS-101).
 * Consumes VideoProjectBrief facts; never invents unverified claims as facts.
 */

import type { ArtifactMetadata } from "@/domain/shared";
import {
  ObjectiveValues,
  ToneValues,
  type BriefObjective,
  type Tone,
} from "@/domain/brief";

export const MARKETING_PLAN_SCHEMA_VERSION = "1.0.0" as const;

/**
 * Same vocabulary as the brief objective — no incompatible second enum.
 * Mapping is identity: BriefObjective → MarketingObjective.
 */
export const MarketingObjectiveValues = ObjectiveValues;
export type MarketingObjective = BriefObjective;

export function mapBriefObjectiveToMarketing(objective: BriefObjective): MarketingObjective {
  return objective;
}

export { ToneValues };
export type { Tone };

export const VideoStyleValues = [
  "educational",
  "commercial",
  "testimonial",
  "product_demo",
  "brand_story",
  "corporate",
  "social",
] as const;
export type VideoStyle = (typeof VideoStyleValues)[number];

export const SuccessMetricKindValues = [
  "view",
  "completion",
  "engagement",
  "click",
  "lead",
  "conversion",
  "download",
  "contact",
] as const;
export type SuccessMetricKind = (typeof SuccessMetricKindValues)[number];

export const EvidenceSourceValues = [
  "brief",
  "media_reference",
  "user_constraint",
  "derived",
] as const;
export type EvidenceSource = (typeof EvidenceSourceValues)[number];

export const AssumptionStatusValues = ["explicit", "inferred", "unverified"] as const;
export type AssumptionStatus = (typeof AssumptionStatusValues)[number];

export const MARKETING_FIELD_LIMITS = {
  audienceLabel: 80,
  audienceDescription: 400,
  needOrPain: 160,
  needsMax: 5,
  painPointsMax: 5,
  mainProblem: 240,
  mainBenefit: 240,
  secondaryBenefit: 200,
  secondaryBenefitsMax: 3,
  uniqueSellingPoint: 240,
  emotionalHook: 200,
  callToAction: 160,
  keyMessage: 180,
  keyMessagesMin: 1,
  keyMessagesMax: 3,
  metricDescription: 200,
  assumptionStatement: 300,
  assumptionJustification: 300,
  assumptionsMax: 12,
  evidenceSummary: 240,
  evidenceField: 80,
  evidenceSourcePath: 120,
  evidenceMax: 24,
  rationaleSummary: 500,
  decisionCountMax: 20,
} as const;

export type Audience = {
  label: string;
  description: string;
  needs: string[];
  painPoints: string[];
};

export type SuccessMetric = {
  kind: SuccessMetricKind;
  description: string;
};

export type MarketingAssumption = {
  id: string;
  statement: string;
  status: AssumptionStatus;
  /** Required when status is inferred/unverified or when linked to derived evidence. */
  justification?: string;
  affectsFields?: string[];
};

export type MarketingEvidence = {
  field: string;
  source: EvidenceSource;
  sourcePath?: string;
  summary: string;
};

export type MarketingRationaleDecision = {
  field: string;
  summary: string;
  evidenceRefs: string[];
};

export type MarketingRationale = {
  summary: string;
  decisions: MarketingRationaleDecision[];
};

/** Business payload — compose with ArtifactMetadata for the artifact. */
export type MarketingPlanFields = {
  /** Id of the brief artifact this plan was derived from (not a revision chain pointer alone). */
  briefRevisionId: string;
  marketingObjective: MarketingObjective;
  primaryAudience: Audience;
  secondaryAudience?: Audience;
  mainProblem: string;
  mainBenefit: string;
  secondaryBenefits: string[];
  uniqueSellingPoint: string;
  emotionalHook: string;
  videoStyle: VideoStyle;
  tone: Tone;
  callToAction: string;
  keyMessages: string[];
  successMetric: SuccessMetric;
  assumptions: MarketingAssumption[];
  evidence: MarketingEvidence[];
  rationale: MarketingRationale;
};

export type MarketingPlan = ArtifactMetadata & MarketingPlanFields;

/**
 * Untrusted analyzer output — never an approved MarketingPlan.
 * Lacks artifact metadata; Director owns finalization.
 */
export type MarketingAnalysisCandidate = {
  marketingObjective: MarketingObjective;
  primaryAudience: Audience;
  secondaryAudience?: Audience;
  mainProblem: string;
  mainBenefit: string;
  secondaryBenefits?: string[];
  uniqueSellingPoint: string;
  emotionalHook: string;
  videoStyle: VideoStyle;
  tone: Tone;
  callToAction: string;
  keyMessages: string[];
  successMetric: SuccessMetric;
  assumptions?: MarketingAssumption[];
  /** Optional hints; Director rebuilds authoritative evidence. */
  claimedEvidence?: MarketingEvidence[];
  notes?: string;
};

/** Suggested default metric kind for a brief objective (not a numeric target). */
export function defaultMetricKindForObjective(objective: MarketingObjective): SuccessMetricKind {
  switch (objective) {
    case "awareness":
      return "view";
    case "traffic":
      return "click";
    case "lead_generation":
      return "lead";
    case "conversion":
      return "conversion";
    case "education":
      return "completion";
    case "engagement":
      return "engagement";
  }
}

/** Fold accents for CTA token matching (fr/en). */
export function foldCtaText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** CTA verbs typically compatible with each objective (lowercase, accent-folded tokens). */
export function ctaTokensForObjective(objective: MarketingObjective): readonly string[] {
  switch (objective) {
    case "awareness":
      return ["decouv", "discover", "learn", "suiv", "follow", "visite", "visit", "en savoir"];
    case "traffic":
      return ["cliqu", "click", "visite", "visit", "ouvre", "open", "lien", "link", "site"];
    case "lead_generation":
      return ["inscri", "sign", "essai", "trial", "demo", "rdv", "contact", "telecharg", "download"];
    case "conversion":
      return [
        "achet",
        "buy",
        "command",
        "order",
        "souscri",
        "subscribe",
        "reserv",
        "book",
        "telecharg",
        "download",
      ];
    case "education":
      return ["appren", "learn", "guide", "tuto", "comprend", "understand", "decouv"];
    case "engagement":
      return ["comment", "partag", "share", "like", "reagi", "reagis", "rejoign", "join"];
  }
}

export function defaultVideoStyleForObjective(objective: MarketingObjective): VideoStyle {
  switch (objective) {
    case "education":
      return "educational";
    case "conversion":
    case "lead_generation":
      return "commercial";
    case "awareness":
      return "brand_story";
    case "engagement":
      return "social";
    case "traffic":
      return "product_demo";
  }
}
