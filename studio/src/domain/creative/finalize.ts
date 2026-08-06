import { createArtifactMetadata } from "@/domain/shared";
import type { VideoProjectBrief } from "@/domain/brief";
import type { MarketingPlan } from "@/domain/marketing";
import {
  CREATIVE_CONCEPT_SCHEMA_VERSION,
  CREATIVE_FIELD_LIMITS,
  type CreativeAnalysisCandidate,
  type CreativeAssumption,
  type CreativeConcept,
  type CreativeConstraint,
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
 * Does not mutate inputs.
 */
export function finalizeCreativeConcept(input: FinalizeCreativeConceptInput): CreativeConcept {
  const briefSnapshot: VideoProjectBrief = {
    ...input.brief,
    mediaReferences: input.brief.mediaReferences.map((m) => ({ ...m })),
  };
  const planSnapshot = JSON.parse(JSON.stringify(input.marketingPlan)) as MarketingPlan;
  const normalized = normalizeCreativeCandidate(input.candidate);

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

  const constraints: CreativeConstraint[] = [...(normalized.constraints ?? [])];
  if (briefSnapshot.brandConstraints?.trim()) {
    constraints.push({
      id: "constraint-brand",
      text: briefSnapshot.brandConstraints.trim().slice(0, 200),
      source: "user_constraint",
    });
  }
  constraints.push({
    id: "constraint-cta",
    text: `Conserver le CTA marketing: ${planSnapshot.callToAction}`,
    source: "marketing_plan",
  });

  const assumptions: CreativeAssumption[] = [...(normalized.assumptions ?? [])];
  if (assumptions.length === 0) {
    assumptions.push({
      id: "assumption-single-idea",
      statement: "Une seule grande idée porte le film court.",
      status: "explicit",
      affectsFields: ["bigIdea"],
    });
  }
  // 8H-A — technical provenance: order is derived from array index, never reordered.
  if (
    assumptions.length < CREATIVE_FIELD_LIMITS.assumptionsMax &&
    !assumptions.some((a) => a.id === "assumption-emotional-arc-array-order")
  ) {
    assumptions.push({
      id: "assumption-emotional-arc-array-order",
      statement:
        "Ordre des beats dérivé de la position du tableau (index+1); la séquence narrative n'est jamais réordonnée.",
      status: "explicit",
      affectsFields: ["emotionalArc"],
    });
  }
  for (const a of planSnapshot.assumptions) {
    if (a.status === "inferred" || a.status === "unverified") {
      assumptions.push({
        id: `from-mkt-${a.id}`,
        statement: `Hypothèse marketing reprise: ${a.statement.slice(0, 200)}`,
        status: "inferred",
        justification: "Portée depuis le Marketing Plan sans la transformer en fait.",
        affectsFields: ["logline", "bigIdea"],
      });
    }
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
    throw new CreativeDomainError(
      "invalid_concept",
      parsed.error.issues[0]?.message ?? "Concept créatif invalide après finalisation.",
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
