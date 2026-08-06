import { z } from "zod";
import {
  ArtifactMetadataSchema,
  DomainIdSchema,
  openaiAbsentOptional,
} from "@/domain/shared";
import type { CreativeRunCapacities } from "./array-capacities";
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

/** Domain / persisted beat — includes derived `order`. */
export const EmotionalBeatSchema = z.object({
  order: z.number().int().positive(),
  purpose: z.enum(EmotionalPurposeValues),
  emotion: z.string().min(1).max(L.emotion),
  description: z.string().min(1).max(L.beatDescription),
});

/**
 * OpenAI analyzer beat (schema 1.2.0 / 8H-A) — no `order`.
 * Array position is the narrative sequence; domain assigns order = index + 1.
 */
export const CreativeAnalyzerBeatSchema = z.object({
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
    justification: openaiAbsentOptional(
      z.string().min(1).max(L.assumptionJustification),
    ),
    affectsFields: openaiAbsentOptional(
      z.array(z.string().min(1).max(L.evidenceField)).max(8),
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

export const CreativeEvidenceSchema = z
  .object({
    field: z.string().min(1).max(L.evidenceField),
    source: z.enum(CreativeEvidenceSourceValues),
    sourcePath: openaiAbsentOptional(
      z.string().min(1).max(L.evidenceSourcePath),
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
    proofDevice: openaiAbsentOptional(CreativeDeviceSchema),
    endingDevice: CreativeDeviceSchema,
    rhythm: z.enum(CreativeRhythmValues),
    referenceKeywords: z
      .array(z.string().min(1).max(L.referenceKeyword))
      .max(L.referenceKeywordsMax),
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
    const uniqueKeywords = new Set(
      value.referenceKeywords.map((k) => k.toLowerCase()),
    );
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

export type CreativeCandidateArrayCaps = {
  assumptionsMax: number;
  constraintsMax: number;
  beatsMax: number;
  referenceKeywordsMax?: number;
  evidenceMax?: number;
};

function buildCandidateObjectSchema(caps: CreativeCandidateArrayCaps) {
  const beatsMax = Math.max(L.beatsMin, Math.min(caps.beatsMax, L.beatsMax));
  const assumptionsMax = Math.max(0, Math.min(caps.assumptionsMax, L.assumptionsMax));
  const constraintsMax = Math.max(0, Math.min(caps.constraintsMax, L.constraintsMax));
  const keywordsMax = caps.referenceKeywordsMax ?? L.referenceKeywordsMax;
  const evidenceMax = caps.evidenceMax ?? L.evidenceMax;

  return {
    title: z.string().min(1).max(L.title),
    logline: z.string().min(1).max(L.logline),
    bigIdea: z.string().min(1).max(L.bigIdea),
    narrativeApproach: z.enum(NarrativeApproachValues),
    emotionalArc: z
      .array(EmotionalBeatSchema)
      .min(L.beatsMin)
      .max(beatsMax),
    openingDevice: CreativeDeviceSchema,
    proofDevice: openaiAbsentOptional(CreativeDeviceSchema),
    endingDevice: CreativeDeviceSchema,
    rhythm: z.enum(CreativeRhythmValues),
    referenceKeywords: z
      .array(z.string().min(1).max(L.referenceKeyword))
      .max(keywordsMax),
    constraints: openaiAbsentOptional(
      z.array(CreativeConstraintSchema).max(constraintsMax),
    ),
    assumptions: openaiAbsentOptional(
      z.array(CreativeAssumptionSchema).max(assumptionsMax),
    ),
    claimedEvidence: openaiAbsentOptional(
      z.array(CreativeEvidenceSchema).max(evidenceMax),
    ),
    notes: openaiAbsentOptional(z.string().max(500)),
  };
}

/** Domain candidate schema with run-computed array maxima (8I-B). */
export function createCreativeAnalysisCandidateSchema(
  caps: CreativeCandidateArrayCaps,
) {
  return z
    .object(buildCandidateObjectSchema(caps))
    .superRefine((value, ctx) => {
      const orders = value.emotionalArc.map((b) => b.order).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          ctx.addIssue({
            code: "custom",
            message:
              "Emotional beat orders must be unique, contiguous, and start at 1.",
            path: ["emotionalArc"],
          });
          break;
        }
      }
    });
}

/** OpenAI analyzer schema (no beat.order) with run-computed maxima (8I-B / v1.2.0). */
export function createCreativeAnalyzerCandidateSchema(
  caps: CreativeCandidateArrayCaps,
) {
  const base = buildCandidateObjectSchema(caps);
  return z.object({
    ...base,
    emotionalArc: z
      .array(CreativeAnalyzerBeatSchema)
      .min(L.beatsMin)
      .max(Math.max(L.beatsMin, Math.min(caps.beatsMax, L.beatsMax))),
  });
}

export function candidateCapsFromRun(
  caps: CreativeRunCapacities,
): CreativeCandidateArrayCaps {
  return {
    assumptionsMax: caps.assumptions.candidateMax,
    constraintsMax: caps.constraints.candidateMax,
    beatsMax: caps.emotionalArc.maxBeats,
    referenceKeywordsMax: caps.referenceKeywords.candidateMax,
    evidenceMax: caps.evidence.candidateMax,
  };
}

/**
 * Ceiling schemas (final domain maxima) — used by tests and loose structural parse.
 * Runtime OpenAI + director validation must use {@link createCreativeAnalyzerCandidateSchema}
 * with {@link candidateCapsFromRun}.
 */
export const CreativeAnalysisCandidateSchema =
  createCreativeAnalysisCandidateSchema({
    assumptionsMax: L.assumptionsMax,
    constraintsMax: L.constraintsMax,
    beatsMax: L.beatsMax,
  });

export const CreativeAnalyzerCandidateSchema =
  createCreativeAnalyzerCandidateSchema({
    assumptionsMax: L.assumptionsMax,
    constraintsMax: L.constraintsMax,
    beatsMax: L.beatsMax,
  });

export type CreativeAnalyzerCandidate = z.infer<
  typeof CreativeAnalyzerCandidateSchema
>;
