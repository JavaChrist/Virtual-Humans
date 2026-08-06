import { createArtifactMetadata } from "@/domain/shared";
import type { VideoProjectBrief } from "@/domain/brief";
import type { MarketingPlan } from "@/domain/marketing";
import {
  mergeCreativeAssumptions,
  mergeCreativeConstraints,
  resolveCreativeRunCapacities,
} from "./array-capacities";
import {
  CREATIVE_CONCEPT_SCHEMA_VERSION,
  type CreativeAnalysisCandidate,
  type CreativeConcept,
} from "./creative-concept";
import { CreativeDomainError } from "./errors";
import { buildCreativeRationale } from "./explanation";
import { normalizeCreativeCandidate } from "./normalization";
import { CreativeConceptSchema } from "./schemas";
import {
  rebuildCreativeEvidence,
  validateCandidateAgainstMarketing,
  validateFinalConcept,
} from "./validation";

export type FinalizeCreativeConceptInput = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  candidate: CreativeAnalysisCandidate;
  metadata: {
    id: string;
    createdBy: string;
    correlationId: string;
    createdAt?: string;
    revision?: number;
  };
};

/**
 * Build an immutable CreativeConcept from an untrusted candidate + marketing plan.
 * Does not mutate inputs. Never silently truncates arrays (8I-B).
 */
export function finalizeCreativeConcept(input: FinalizeCreativeConceptInput): CreativeConcept {
  const briefSnapshot: VideoProjectBrief = {
    ...input.brief,
    mediaReferences: input.brief.mediaReferences.map((m) => ({ ...m })),
  };
  const planSnapshot = JSON.parse(JSON.stringify(input.marketingPlan)) as MarketingPlan;
  const normalized = normalizeCreativeCandidate(input.candidate);
  const caps = resolveCreativeRunCapacities({
    brief: briefSnapshot,
    marketingPlan: planSnapshot,
  });

  if (caps.assumptions.enrichmentsExceedFinal) {
    throw new CreativeDomainError(
      "invalid_concept",
      `Enrichissements Creative (system+upstream=${caps.assumptions.systemCount + caps.assumptions.upstreamCount}) dépassent la capacité finale (${caps.assumptions.finalMax}).`,
      "assumptions",
      {
        schemaName: "CreativeConceptSchema",
        arrayName: "assumptions",
        arrayMax: caps.assumptions.finalMax,
        arrayLength:
          caps.assumptions.systemCount + caps.assumptions.upstreamCount,
        finalizeStep: "enrichment",
        sourceType: "marketing_plan",
      },
    );
  }
  if (caps.constraints.enrichmentsExceedFinal) {
    throw new CreativeDomainError(
      "invalid_concept",
      `Enrichissements Creative (system=${caps.constraints.systemCount}) dépassent la capacité constraints (${caps.constraints.finalMax}).`,
      "constraints",
      {
        schemaName: "CreativeConceptSchema",
        arrayName: "constraints",
        arrayMax: caps.constraints.finalMax,
        arrayLength: caps.constraints.systemCount,
        finalizeStep: "enrichment",
        sourceType: "candidate_field",
      },
    );
  }

  // Candidate must already respect candidateMax (schema / pre-call contract).
  const assumptionsBefore = normalized.assumptions?.length ?? 0;
  const constraintsBefore = normalized.constraints?.length ?? 0;
  if (assumptionsBefore > caps.assumptions.candidateMax) {
    throw new CreativeDomainError(
      "invalid_candidate",
      `Trop d'assumptions candidat (${assumptionsBefore}/${caps.assumptions.candidateMax}).`,
      "assumptions",
      {
        arrayName: "assumptions",
        arrayLength: assumptionsBefore,
        arrayMax: caps.assumptions.candidateMax,
        finalizeStep: "candidate",
        sourceType: "candidate_field",
      },
    );
  }
  if (constraintsBefore > caps.constraints.candidateMax) {
    throw new CreativeDomainError(
      "invalid_candidate",
      `Trop de constraints candidat (${constraintsBefore}/${caps.constraints.candidateMax}).`,
      "constraints",
      {
        arrayName: "constraints",
        arrayLength: constraintsBefore,
        arrayMax: caps.constraints.candidateMax,
        finalizeStep: "candidate",
        sourceType: "candidate_field",
      },
    );
  }

  const { issues } = validateCandidateAgainstMarketing(
    normalized,
    planSnapshot,
    briefSnapshot,
  );
  if (issues.length > 0) {
    throw new CreativeDomainError(
      "invalid_candidate",
      issues[0]?.message ?? "Candidat créatif invalide.",
      issues[0]?.field,
    );
  }

  const evidence = rebuildCreativeEvidence(planSnapshot, briefSnapshot);

  let assumptions;
  let constraints;
  try {
    assumptions = mergeCreativeAssumptions({
      candidate: normalized.assumptions ?? [],
      marketingPlan: planSnapshot,
      finalMax: caps.assumptions.finalMax,
    });
    constraints = mergeCreativeConstraints({
      candidate: normalized.constraints ?? [],
      brief: briefSnapshot,
      marketingPlan: planSnapshot,
      finalMax: caps.constraints.finalMax,
    });
  } catch (e) {
    throw new CreativeDomainError(
      "invalid_concept",
      e instanceof Error ? e.message : "Invariant de capacité Creative violé.",
      undefined,
      { finalizeStep: "enrichment", sourceType: "candidate_field" },
    );
  }

  const rationale = buildCreativeRationale(evidence, [
    { field: "bigIdea", summary: normalized.bigIdea },
    { field: "narrativeApproach", summary: normalized.narrativeApproach },
    { field: "openingDevice", summary: normalized.openingDevice.kind },
    { field: "endingDevice", summary: normalized.endingDevice.kind },
    { field: "rhythm", summary: normalized.rhythm },
  ]);

  const meta = createArtifactMetadata({
    id: input.metadata.id,
    projectId: planSnapshot.projectId,
    createdBy: input.metadata.createdBy,
    correlationId: input.metadata.correlationId,
    createdAt: input.metadata.createdAt,
    revision: input.metadata.revision,
    schemaVersion: CREATIVE_CONCEPT_SCHEMA_VERSION,
  });

  const concept: CreativeConcept = {
    ...meta,
    marketingPlanRevisionId: planSnapshot.id,
    title: normalized.title,
    logline: normalized.logline,
    bigIdea: normalized.bigIdea,
    narrativeApproach: normalized.narrativeApproach,
    emotionalArc: normalized.emotionalArc,
    openingDevice: normalized.openingDevice,
    ...(normalized.proofDevice ? { proofDevice: normalized.proofDevice } : {}),
    endingDevice: normalized.endingDevice,
    rhythm: normalized.rhythm,
    referenceKeywords: normalized.referenceKeywords,
    constraints,
    assumptions,
    evidence,
    rationale,
  };

  const parsed = CreativeConceptSchema.safeParse(concept);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const fieldPath = issue.path.map(String).join(".") || undefined;
    throw new CreativeDomainError(
      "invalid_concept",
      issue.message ?? "Concept créatif invalide après finalisation.",
      fieldPath,
      {
        schemaName: "CreativeConceptSchema",
        zodCode: issue.code,
        arrayName:
          fieldPath === "assumptions"
            ? "assumptions"
            : fieldPath === "constraints"
              ? "constraints"
              : undefined,
        arrayLength:
          fieldPath === "assumptions"
            ? assumptions.length
            : fieldPath === "constraints"
              ? constraints.length
              : undefined,
        arrayMax:
          fieldPath === "assumptions"
            ? caps.assumptions.finalMax
            : fieldPath === "constraints"
              ? caps.constraints.finalMax
              : undefined,
        lengthBeforeEnrichment:
          fieldPath === "assumptions"
            ? assumptionsBefore
            : fieldPath === "constraints"
              ? constraintsBefore
              : undefined,
        lengthAfterEnrichment:
          fieldPath === "assumptions"
            ? assumptions.length
            : fieldPath === "constraints"
              ? constraints.length
              : undefined,
        finalizeStep: "artifact_final",
        sourceType: "candidate_field",
      },
    );
  }

  const finalIssues = validateFinalConcept(parsed.data as CreativeConcept);
  if (finalIssues.length > 0) {
    throw new CreativeDomainError(
      "invariant_violation",
      finalIssues[0]?.message ?? "Invariant créatif violé.",
      finalIssues[0]?.field,
    );
  }

  return Object.freeze(JSON.parse(JSON.stringify(parsed.data)) as CreativeConcept);
}

