import { z } from "zod";
import {
  ArtifactMetadataSchema,
  DomainIdSchema,
  openaiAbsentOptional,
} from "@/domain/shared";
import {
  MARKETING_FIELD_LIMITS,
  MARKETING_PLAN_SCHEMA_VERSION,
  AssumptionStatusValues,
  EvidenceSourceValues,
  MarketingObjectiveValues,
  SuccessMetricKindValues,
  ToneValues,
  VideoStyleValues,
} from "./marketing-plan";

const L = MARKETING_FIELD_LIMITS;

export const AudienceSchema = z.object({
  label: z.string().min(1).max(L.audienceLabel),
  description: z.string().min(1).max(L.audienceDescription),
  needs: z.array(z.string().min(1).max(L.needOrPain)).max(L.needsMax),
  painPoints: z.array(z.string().min(1).max(L.needOrPain)).max(L.painPointsMax),
});

export const SuccessMetricSchema = z.object({
  kind: z.enum(SuccessMetricKindValues),
  description: z.string().min(1).max(L.metricDescription),
});

export const MarketingAssumptionSchema = z
  .object({
    id: DomainIdSchema,
    statement: z.string().min(1).max(L.assumptionStatement),
    status: z.enum(AssumptionStatusValues),
    justification: openaiAbsentOptional(
      z.string().min(1).max(L.assumptionJustification)
    ),
    affectsFields: openaiAbsentOptional(
      z.array(z.string().min(1).max(L.evidenceField)).max(8)
    ),
  })
  .superRefine((value, ctx) => {
    if (
      (value.status === "inferred" || value.status === "unverified") &&
      (!value.justification || !value.justification.trim())
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Derived/unverified assumptions require a justification.",
        path: ["justification"],
      });
    }
  });

export const MarketingEvidenceSchema = z
  .object({
    field: z.string().min(1).max(L.evidenceField),
    source: z.enum(EvidenceSourceValues),
    sourcePath: openaiAbsentOptional(
      z.string().min(1).max(L.evidenceSourcePath)
    ),
    summary: z.string().min(1).max(L.evidenceSummary),
  })
  .superRefine((value, ctx) => {
    if (value.source === "derived" && value.summary.trim().length < 8) {
      ctx.addIssue({
        code: "custom",
        message: "Derived evidence requires a non-trivial justification summary.",
        path: ["summary"],
      });
    }
    if (value.sourcePath != null && !/^[a-zA-Z0-9_.]+$/.test(value.sourcePath)) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid evidence sourcePath.",
        path: ["sourcePath"],
      });
    }
  });

export const MarketingRationaleSchema = z.object({
  summary: z.string().min(1).max(L.rationaleSummary),
  decisions: z
    .array(
      z.object({
        field: z.string().min(1).max(L.evidenceField),
        summary: z.string().min(1).max(L.evidenceSummary),
        evidenceRefs: z.array(z.string().min(1).max(64)).max(12),
      }),
    )
    .max(L.decisionCountMax),
});

export const MarketingPlanFieldsSchema = z.object({
  briefRevisionId: DomainIdSchema,
  marketingObjective: z.enum(MarketingObjectiveValues),
  primaryAudience: AudienceSchema,
  secondaryAudience: openaiAbsentOptional(AudienceSchema),
  mainProblem: z.string().min(1).max(L.mainProblem),
  mainBenefit: z.string().min(1).max(L.mainBenefit),
  secondaryBenefits: z
    .array(z.string().min(1).max(L.secondaryBenefit))
    .max(L.secondaryBenefitsMax),
  uniqueSellingPoint: z.string().min(1).max(L.uniqueSellingPoint),
  emotionalHook: z.string().min(1).max(L.emotionalHook),
  videoStyle: z.enum(VideoStyleValues),
  tone: z.enum(ToneValues),
  callToAction: z.string().min(1).max(L.callToAction),
  keyMessages: z
    .array(z.string().min(1).max(L.keyMessage))
    .min(L.keyMessagesMin)
    .max(L.keyMessagesMax),
  successMetric: SuccessMetricSchema,
  assumptions: z.array(MarketingAssumptionSchema).max(L.assumptionsMax),
  evidence: z.array(MarketingEvidenceSchema).min(1).max(L.evidenceMax),
  rationale: MarketingRationaleSchema,
});

export const MarketingPlanSchema = ArtifactMetadataSchema.extend({
  schemaVersion: z.literal(MARKETING_PLAN_SCHEMA_VERSION),
}).and(MarketingPlanFieldsSchema);

export const MarketingAnalysisCandidateSchema = z.object({
  marketingObjective: z.enum(MarketingObjectiveValues),
  primaryAudience: AudienceSchema,
  secondaryAudience: openaiAbsentOptional(AudienceSchema),
  mainProblem: z.string().min(1).max(L.mainProblem),
  mainBenefit: z.string().min(1).max(L.mainBenefit),
  secondaryBenefits: openaiAbsentOptional(
    z
      .array(z.string().min(1).max(L.secondaryBenefit))
      .max(L.secondaryBenefitsMax)
  ),
  uniqueSellingPoint: z.string().min(1).max(L.uniqueSellingPoint),
  emotionalHook: z.string().min(1).max(L.emotionalHook),
  videoStyle: z.enum(VideoStyleValues),
  tone: z.enum(ToneValues),
  callToAction: z.string().min(1).max(L.callToAction),
  keyMessages: z
    .array(z.string().min(1).max(L.keyMessage))
    .min(L.keyMessagesMin)
    .max(L.keyMessagesMax),
  successMetric: SuccessMetricSchema,
  assumptions: openaiAbsentOptional(
    z.array(MarketingAssumptionSchema).max(L.assumptionsMax)
  ),
  claimedEvidence: openaiAbsentOptional(
    z.array(MarketingEvidenceSchema).max(L.evidenceMax)
  ),
  notes: openaiAbsentOptional(z.string().max(500)),
});
