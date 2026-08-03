import { z } from "zod";
import { ArtifactMetadataSchema, DomainIdSchema } from "@/domain/shared";
import {
  AllowedReferenceKeywordValues,
  AssumptionStatusValues,
  CREATIVE_CONCEPT_SCHEMA_VERSION,
  CREATIVE_FIELD_LIMITS,
  CreativeDeviceKindValues,
  CreativeEvidenceSourceValues,
  CreativeRhythmValues,
  EmotionalPurposeValues,
  NarrativeApproachValues,
} from "./creative-concept";

const L = CREATIVE_FIELD_LIMITS;

export const EmotionalBeatSchema = z.object({
  order: z.number().int().positive(),
  purpose: z.enum(EmotionalPurposeValues),
  emotion: z.string().min(1).max(L.emotion),
  description: z.string().min(1).max(L.beatDescription),
});

export const CreativeDeviceSchema = z.object({
  kind: z.enum(CreativeDeviceKindValues),
  description: z.string().min(1).max(L.deviceDescription),
});

export const CreativeConstraintSchema = z.object({
  id: DomainIdSchema,
  text: z.string().min(1).max(L.constraintText),
  source: z.enum(["marketing_plan", "brief", "user_constraint", "derived"]),
});

export const CreativeAssumptionSchema = z
  .object({
    id: DomainIdSchema,
    statement: z.string().min(1).max(L.assumptionStatement),
    status: z.enum(AssumptionStatusValues),
    justification: z.string().min(1).max(L.assumptionJustification).optional(),
    affectsFields: z.array(z.string().min(1).max(L.evidenceField)).max(8).optional(),
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

export const CreativeEvidenceSchema = z
  .object({
    field: z.string().min(1).max(L.evidenceField),
    source: z.enum(CreativeEvidenceSourceValues),
    sourcePath: z.string().min(1).max(L.evidenceSourcePath).optional(),
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

export const CreativeRationaleSchema = z.object({
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

const allowedKeywordSet = new Set<string>(AllowedReferenceKeywordValues);

export const CreativeConceptFieldsSchema = z
  .object({
    marketingPlanRevisionId: DomainIdSchema,
    title: z.string().min(1).max(L.title),
    logline: z.string().min(1).max(L.logline),
    bigIdea: z.string().min(1).max(L.bigIdea),
    narrativeApproach: z.enum(NarrativeApproachValues),
    emotionalArc: z.array(EmotionalBeatSchema).min(L.beatsMin).max(L.beatsMax),
    openingDevice: CreativeDeviceSchema,
    proofDevice: CreativeDeviceSchema.optional(),
    endingDevice: CreativeDeviceSchema,
    rhythm: z.enum(CreativeRhythmValues),
    referenceKeywords: z.array(z.string().min(1).max(L.referenceKeyword)).max(L.referenceKeywordsMax),
    constraints: z.array(CreativeConstraintSchema).max(L.constraintsMax),
    assumptions: z.array(CreativeAssumptionSchema).max(L.assumptionsMax),
    evidence: z.array(CreativeEvidenceSchema).min(1).max(L.evidenceMax),
    rationale: CreativeRationaleSchema,
  })
  .superRefine((value, ctx) => {
    const orders = value.emotionalArc.map((b) => b.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        ctx.addIssue({
          code: "custom",
          message: "Emotional beat orders must be unique, contiguous, and start at 1.",
          path: ["emotionalArc"],
        });
        break;
      }
    }
    const uniqueKeywords = new Set(value.referenceKeywords.map((k) => k.toLowerCase()));
    if (uniqueKeywords.size !== value.referenceKeywords.length) {
      ctx.addIssue({
        code: "custom",
        message: "referenceKeywords must be unique.",
        path: ["referenceKeywords"],
      });
    }
    for (const kw of value.referenceKeywords) {
      if (!allowedKeywordSet.has(kw.toLowerCase())) {
        ctx.addIssue({
          code: "custom",
          message: `Reference keyword not allowed: ${kw}`,
          path: ["referenceKeywords"],
        });
      }
    }
  });

export const CreativeConceptSchema = ArtifactMetadataSchema.extend({
  schemaVersion: z.literal(CREATIVE_CONCEPT_SCHEMA_VERSION),
}).and(CreativeConceptFieldsSchema);

export const CreativeAnalysisCandidateSchema = z
  .object({
    title: z.string().min(1).max(L.title),
    logline: z.string().min(1).max(L.logline),
    bigIdea: z.string().min(1).max(L.bigIdea),
    narrativeApproach: z.enum(NarrativeApproachValues),
    emotionalArc: z.array(EmotionalBeatSchema).min(L.beatsMin).max(L.beatsMax),
    openingDevice: CreativeDeviceSchema,
    proofDevice: CreativeDeviceSchema.optional(),
    endingDevice: CreativeDeviceSchema,
    rhythm: z.enum(CreativeRhythmValues),
    referenceKeywords: z
      .array(z.string().min(1).max(L.referenceKeyword))
      .max(L.referenceKeywordsMax),
    constraints: z.array(CreativeConstraintSchema).max(L.constraintsMax).optional(),
    assumptions: z.array(CreativeAssumptionSchema).max(L.assumptionsMax).optional(),
    claimedEvidence: z.array(CreativeEvidenceSchema).max(L.evidenceMax).optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    const orders = value.emotionalArc.map((b) => b.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        ctx.addIssue({
          code: "custom",
          message: "Emotional beat orders must be unique, contiguous, and start at 1.",
          path: ["emotionalArc"],
        });
        break;
      }
    }
  });
