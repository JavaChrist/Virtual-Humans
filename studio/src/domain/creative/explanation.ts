import type {
  CreativeConcept,
  CreativeEvidence,
  CreativeRationale,
} from "./creative-concept";

/** Compact rationale — never embeds full brief or marketing plan. */
export function buildCreativeRationale(
  evidence: CreativeEvidence[],
  decisionSummaries: Array<{ field: string; summary: string }>,
): CreativeRationale {
  const decisions = decisionSummaries.map((d) => ({
    field: d.field,
    summary: d.summary,
    evidenceRefs: evidence
      .filter((e) => e.field === d.field || e.sourcePath?.includes(d.field))
      .map((e) => `${e.source}:${e.field}`)
      .slice(0, 6),
  }));

  return {
    summary:
      "Concept créatif validé contre le Marketing Plan ; décisions dérivées marquées et hypothéquées.",
    decisions,
  };
}

export type CreativeConceptViewModel = {
  title: string;
  logline: string;
  bigIdea: string;
  narrativeApproach: string;
  rhythm: string;
  opening: string;
  ending: string;
  beats: Array<{ order: number; purpose: string; emotion: string }>;
  referenceKeywords: string[];
  assumptions: string[];
  evidence: Array<{ field: string; source: string; summary: string }>;
};

export function toCreativeConceptViewModel(concept: CreativeConcept): CreativeConceptViewModel {
  return {
    title: concept.title,
    logline: concept.logline,
    bigIdea: concept.bigIdea,
    narrativeApproach: concept.narrativeApproach,
    rhythm: concept.rhythm,
    opening: `${concept.openingDevice.kind}: ${concept.openingDevice.description}`,
    ending: `${concept.endingDevice.kind}: ${concept.endingDevice.description}`,
    beats: concept.emotionalArc.map((b) => ({
      order: b.order,
      purpose: b.purpose,
      emotion: b.emotion,
    })),
    referenceKeywords: [...concept.referenceKeywords],
    assumptions: concept.assumptions.map((a) => a.statement),
    evidence: concept.evidence.map((e) => ({
      field: e.field,
      source: e.source,
      summary: e.summary,
    })),
  };
}
