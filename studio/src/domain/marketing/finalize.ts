import { createArtifactMetadata } from "@/domain/shared";
import type { VideoProjectBrief } from "@/domain/brief";
import { MarketingDomainError } from "./errors";
import { buildMarketingRationale } from "./explanation";
import {
  MARKETING_PLAN_SCHEMA_VERSION,
  foldCtaText,
  type MarketingAnalysisCandidate,
  type MarketingAssumption,
  type MarketingPlan,
} from "./marketing-plan";
import { normalizeMarketingCandidate } from "./normalization";
import { MarketingPlanSchema } from "./schemas";
import {
  rebuildEvidence,
  validateCandidateAgainstBrief,
  validateFinalPlan,
} from "./validation";

export type FinalizeMarketingPlanInput = {
  brief: VideoProjectBrief;
  candidate: MarketingAnalysisCandidate;
  metadata: {
    id: string;
    createdBy: string;
    correlationId: string;
    createdAt?: string;
    revision?: number;
  };
};

/**
 * Build an immutable MarketingPlan from an untrusted candidate + brief.
 * Does not mutate inputs. Throws MarketingDomainError on invariant failure.
 */
export function finalizeMarketingPlan(input: FinalizeMarketingPlanInput): MarketingPlan {
  const briefSnapshot = { ...input.brief, mediaReferences: [...input.brief.mediaReferences] };
  const normalized = normalizeMarketingCandidate(input.candidate);

  // Canonical CTA = Brief when present, else analyzer candidate.
  // Applied *before* the hard gate so a divergent model CTA cannot reject a
  // Brief-compatible plan. Provenance is recorded in assumptions (never silent).
  const objective = briefSnapshot.objective;
  const tone = briefSnapshot.tone;
  const briefCta = briefSnapshot.callToAction?.trim() || "";
  const analyzerCta = normalized.callToAction;
  const callToAction = briefCta || analyzerCta;
  const briefCtaOverrodeAnalyzer =
    Boolean(briefCta) && foldCtaText(briefCta) !== foldCtaText(analyzerCta);

  const candidateForValidation: MarketingAnalysisCandidate = {
    ...normalized,
    marketingObjective: objective,
    tone,
    callToAction,
  };

  const { issues } = validateCandidateAgainstBrief(candidateForValidation, briefSnapshot);
  if (issues.length > 0) {
    throw new MarketingDomainError(
      "invalid_candidate",
      issues[0]?.message ?? "Candidat marketing invalide.",
      issues[0]?.field,
    );
  }

  const evidence = rebuildEvidence(briefSnapshot, { ...normalized, callToAction });

  const assumptions: MarketingAssumption[] = [...(normalized.assumptions ?? [])];
  if (!briefSnapshot.audienceDescription?.trim()) {
    assumptions.push({
      id: "assumption-audience",
      statement: "L'audience principale est déduite faute de description détaillée dans le brief.",
      status: "inferred",
      justification: "audienceDescription absent du brief.",
      affectsFields: ["primaryAudience"],
    });
  }
  if (!briefCta) {
    assumptions.push({
      id: "assumption-cta",
      statement: "Le CTA a été proposé par l'analyse faute de CTA brief.",
      status: "inferred",
      justification: "callToAction absent du brief.",
      affectsFields: ["callToAction"],
    });
  } else if (briefCtaOverrodeAnalyzer) {
    assumptions.push({
      id: "assumption-cta-brief-authoritative",
      statement:
        "Le CTA du Brief prévaut ; le CTA proposé par l'analyse a été écarté.",
      status: "explicit",
      justification:
        "Brief.callToAction présent et divergent du candidat ; le plan conserve exclusivement le CTA Brief.",
      affectsFields: ["callToAction"],
    });
  }
  if (assumptions.length === 0) {
    assumptions.push({
      id: "assumption-single-idea",
      statement: "Une vidéo courte porte une seule idée forte liée au bénéfice principal.",
      status: "explicit",
      affectsFields: ["keyMessages", "mainBenefit"],
    });
  }

  const rationale = buildMarketingRationale(evidence, [
    { field: "marketingObjective", summary: `Objectif: ${objective}` },
    { field: "primaryAudience", summary: normalized.primaryAudience.label },
    { field: "mainBenefit", summary: normalized.mainBenefit },
    { field: "emotionalHook", summary: normalized.emotionalHook },
    { field: "callToAction", summary: callToAction },
  ]);

  const meta = createArtifactMetadata({
    id: input.metadata.id,
    projectId: briefSnapshot.projectId,
    createdBy: input.metadata.createdBy,
    correlationId: input.metadata.correlationId,
    createdAt: input.metadata.createdAt,
    revision: input.metadata.revision,
    schemaVersion: MARKETING_PLAN_SCHEMA_VERSION,
  });

  const plan: MarketingPlan = {
    ...meta,
    briefRevisionId: briefSnapshot.id,
    marketingObjective: objective,
    primaryAudience: normalized.primaryAudience,
    ...(normalized.secondaryAudience
      ? { secondaryAudience: normalized.secondaryAudience }
      : {}),
    mainProblem: normalized.mainProblem,
    mainBenefit: normalized.mainBenefit,
    secondaryBenefits: normalized.secondaryBenefits ?? [],
    uniqueSellingPoint: normalized.uniqueSellingPoint,
    emotionalHook: normalized.emotionalHook,
    videoStyle: normalized.videoStyle,
    tone,
    callToAction,
    keyMessages: normalized.keyMessages,
    successMetric: normalized.successMetric,
    assumptions,
    evidence,
    rationale,
  };

  const parsed = MarketingPlanSchema.safeParse(plan);
  if (!parsed.success) {
    throw new MarketingDomainError(
      "invalid_plan",
      parsed.error.issues[0]?.message ?? "Plan marketing invalide après finalisation.",
    );
  }

  const finalIssues = validateFinalPlan(parsed.data as MarketingPlan);
  if (finalIssues.length > 0) {
    throw new MarketingDomainError(
      "invariant_violation",
      finalIssues[0]?.message ?? "Invariant marketing violé.",
      finalIssues[0]?.field,
    );
  }

  // Drop undefined optionals so the artifact is revision-safe (JSON-serializable).
  const serializable = JSON.parse(JSON.stringify(parsed.data)) as MarketingPlan;
  return Object.freeze(serializable);
}
