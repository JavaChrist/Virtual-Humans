export {
  MARKETING_FIELD_LIMITS,
  MARKETING_PLAN_SCHEMA_VERSION,
  AssumptionStatusValues,
  EvidenceSourceValues,
  MarketingObjectiveValues,
  SuccessMetricKindValues,
  ToneValues,
  VideoStyleValues,
  ctaTokensForObjective,
  defaultMetricKindForObjective,
  defaultVideoStyleForObjective,
  foldCtaText,
  mapBriefObjectiveToMarketing,
  type AssumptionStatus,
  type Audience,
  type EvidenceSource,
  type MarketingAnalysisCandidate,
  type MarketingAssumption,
  type MarketingEvidence,
  type MarketingObjective,
  type MarketingPlan,
  type MarketingPlanFields,
  type MarketingRationale,
  type MarketingRationaleDecision,
  type SuccessMetric,
  type SuccessMetricKind,
  type Tone,
  type VideoStyle,
} from "./marketing-plan";

export {
  MarketingDomainError,
  isMarketingDomainError,
  type MarketingErrorCode,
  type MarketingValidationIssue,
  type MarketingWarning,
  type MissingInformation,
} from "./errors";

export {
  AudienceSchema,
  MarketingAnalysisCandidateSchema,
  MarketingAssumptionSchema,
  MarketingEvidenceSchema,
  MarketingPlanFieldsSchema,
  MarketingPlanSchema,
  MarketingRationaleSchema,
  SuccessMetricSchema,
} from "./schemas";

export {
  cleanBoundedText,
  cleanStringList,
  normalizeAudience,
  normalizeMarketingCandidate,
} from "./normalization";

export {
  assertNoTechnicalLeakInPlan,
  collectUngroundedClaims,
  containsRegulatedClaim,
  containsSensitiveTargeting,
  containsUnsourcedPromise,
  isCtaCompatibleWithObjective,
  looksLikeFeatureOnlyBenefit,
  rebuildEvidence,
  validateAudienceSensitivity,
  validateCandidateAgainstBrief,
  validateFinalPlan,
} from "./validation";

export {
  assessMarketingBriefReadiness,
  type MarketingReadinessCheck,
  type MarketingReadinessCheckCode,
} from "./readiness";

export { finalizeMarketingPlan, type FinalizeMarketingPlanInput } from "./finalize";

export {
  buildMarketingRationale,
  toMarketingPlanViewModel,
  type MarketingPlanViewModel,
} from "./explanation";
