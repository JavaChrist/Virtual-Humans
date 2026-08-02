import { MARKETING_FIELD_LIMITS, type Audience, type MarketingAnalysisCandidate } from "./marketing-plan";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function cleanBoundedText(value: string, max: number): string {
  const cleaned = collapseWhitespace(value);
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).trimEnd();
}

export function cleanStringList(values: string[] | undefined, maxItem: number, maxItems: number): string[] {
  if (!values) return [];
  const out: string[] = [];
  for (const raw of values) {
    const cleaned = cleanBoundedText(raw, maxItem);
    if (!cleaned) continue;
    out.push(cleaned);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function normalizeAudience(audience: Audience): Audience {
  return {
    label: cleanBoundedText(audience.label, MARKETING_FIELD_LIMITS.audienceLabel),
    description: cleanBoundedText(audience.description, MARKETING_FIELD_LIMITS.audienceDescription),
    needs: cleanStringList(audience.needs, MARKETING_FIELD_LIMITS.needOrPain, MARKETING_FIELD_LIMITS.needsMax),
    painPoints: cleanStringList(
      audience.painPoints,
      MARKETING_FIELD_LIMITS.needOrPain,
      MARKETING_FIELD_LIMITS.painPointsMax,
    ),
  };
}

/**
 * Normalize an untrusted candidate before invariant checks.
 * Does not invent missing business content.
 */
export function normalizeMarketingCandidate(
  candidate: MarketingAnalysisCandidate,
): MarketingAnalysisCandidate {
  const L = MARKETING_FIELD_LIMITS;
  return {
    marketingObjective: candidate.marketingObjective,
    primaryAudience: normalizeAudience(candidate.primaryAudience),
    secondaryAudience: candidate.secondaryAudience
      ? normalizeAudience(candidate.secondaryAudience)
      : undefined,
    mainProblem: cleanBoundedText(candidate.mainProblem, L.mainProblem),
    mainBenefit: cleanBoundedText(candidate.mainBenefit, L.mainBenefit),
    secondaryBenefits: cleanStringList(
      candidate.secondaryBenefits,
      L.secondaryBenefit,
      L.secondaryBenefitsMax,
    ),
    uniqueSellingPoint: cleanBoundedText(candidate.uniqueSellingPoint, L.uniqueSellingPoint),
    emotionalHook: cleanBoundedText(candidate.emotionalHook, L.emotionalHook),
    videoStyle: candidate.videoStyle,
    tone: candidate.tone,
    callToAction: cleanBoundedText(candidate.callToAction, L.callToAction),
    keyMessages: cleanStringList(candidate.keyMessages, L.keyMessage, L.keyMessagesMax),
    successMetric: {
      kind: candidate.successMetric.kind,
      description: cleanBoundedText(candidate.successMetric.description, L.metricDescription),
    },
    assumptions: candidate.assumptions?.map((a) => ({
      ...a,
      statement: cleanBoundedText(a.statement, L.assumptionStatement),
      justification: a.justification
        ? cleanBoundedText(a.justification, L.assumptionJustification)
        : undefined,
    })),
    claimedEvidence: candidate.claimedEvidence?.map((e) => ({
      ...e,
      field: cleanBoundedText(e.field, L.evidenceField),
      summary: cleanBoundedText(e.summary, L.evidenceSummary),
      sourcePath: e.sourcePath
        ? cleanBoundedText(e.sourcePath, L.evidenceSourcePath)
        : undefined,
    })),
    notes: candidate.notes ? cleanBoundedText(candidate.notes, 500) : undefined,
  };
}
