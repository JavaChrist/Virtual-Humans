import type {
  MarketingEvidence,
  MarketingPlan,
  MarketingRationale,
} from "./marketing-plan";

/**
 * Build a compact rationale — never embeds the full brief.
 */
export function buildMarketingRationale(
  evidence: MarketingEvidence[],
  decisionSummaries: Array<{ field: string; summary: string }>,
): MarketingRationale {
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
      "Décisions marketing validées contre le brief ; les éléments dérivés sont marqués et hypothéqués.",
    decisions,
  };
}

/** Pure view-model for a future UI — no React. */
export type MarketingPlanViewModel = {
  objective: string;
  audience: string;
  problem: string;
  benefit: string;
  hook: string;
  cta: string;
  keyMessages: string[];
  assumptions: string[];
  evidence: Array<{ field: string; source: string; summary: string }>;
};

export function toMarketingPlanViewModel(plan: MarketingPlan): MarketingPlanViewModel {
  return {
    objective: plan.marketingObjective,
    audience: `${plan.primaryAudience.label} — ${plan.primaryAudience.description}`,
    problem: plan.mainProblem,
    benefit: plan.mainBenefit,
    hook: plan.emotionalHook,
    cta: plan.callToAction,
    keyMessages: [...plan.keyMessages],
    assumptions: plan.assumptions.map((a) => a.statement),
    evidence: plan.evidence.map((e) => ({
      field: e.field,
      source: e.source,
      summary: e.summary,
    })),
  };
}
