import type { VideoProjectBrief } from "@/domain/brief";
import {
  ctaTokensForObjective,
  defaultMetricKindForObjective,
  foldCtaText,
  type MarketingAnalysisCandidate,
  type MarketingEvidence,
  type MarketingObjective,
  type MarketingPlan,
} from "./marketing-plan";
import type { MarketingValidationIssue, MarketingWarning } from "./errors";

const SENSITIVE_TARGETING =
  /\b(race|ethnique|ethnicity|religion|croyance|orientation sexuelle|disability|handicap|genre assigné|pregnant|enceinte|political affiliation|parti politique|origine nationale)\b/i;

const UNSOURCED_PROMISE =
  /\b(guaranteed|garanti|100\s*%|miracle|cure|guérison|risk[- ]free|sans risque|double[rz]? (vos|your) (revenus|sales|ventes)|meilleur que|better than|n°\s*1|number one|#1)\b/i;

const REGULATED_CLAIM =
  /\b(médical|medical|diagnos|investissement|investment returns?|conseil juridique|legal advice|FDA|EMA|ROI garanti)\b/i;

const FEATURE_ONLY_BENEFIT =
  /^(fonctionnalite\w*|feature\w*|outil\b|tool\b|module\b|api\b|dashboard\b|tableau de bord\b)/i;

const TECHNICAL_LEAK_KEYS = [
  "provider",
  "providerId",
  "modelId",
  "model",
  "prompt",
  "systemPrompt",
  "temperature",
  "fal-ai",
  "openai",
] as const;

function issue(
  code: string,
  message: string,
  field?: string,
): MarketingValidationIssue {
  return { code, message, field };
}

export function assertNoTechnicalLeakInPlan(plan: MarketingPlan | MarketingAnalysisCandidate): MarketingValidationIssue[] {
  const issues: MarketingValidationIssue[] = [];
  const record = plan as unknown as Record<string, unknown>;
  for (const key of TECHNICAL_LEAK_KEYS) {
    if (key in record) {
      issues.push(issue("technical_leak", "Le plan ne doit pas contenir de paramètres techniques.", key));
    }
  }
  return issues;
}

export function isCtaCompatibleWithObjective(cta: string, objective: MarketingObjective): boolean {
  const folded = foldCtaText(cta);
  return ctaTokensForObjective(objective).some((token) => folded.includes(token));
}

export function looksLikeFeatureOnlyBenefit(benefit: string): boolean {
  return FEATURE_ONLY_BENEFIT.test(foldCtaText(benefit.trim()));
}

export function containsSensitiveTargeting(text: string): boolean {
  return SENSITIVE_TARGETING.test(text);
}

export function containsUnsourcedPromise(text: string): boolean {
  return UNSOURCED_PROMISE.test(text);
}

export function containsRegulatedClaim(text: string): boolean {
  return REGULATED_CLAIM.test(text);
}

/**
 * Check that candidate strings can be grounded in brief text or are covered by assumptions.
 */
export function collectUngroundedClaims(
  candidate: MarketingAnalysisCandidate,
  brief: VideoProjectBrief,
): MarketingValidationIssue[] {
  const issues: MarketingValidationIssue[] = [];
  const briefCorpus = [
    brief.subjectName,
    brief.subjectDescription,
    brief.audienceDescription ?? "",
    brief.callToAction ?? "",
    brief.brandConstraints ?? "",
    brief.projectName,
  ]
    .join(" ")
    .toLowerCase();

  const assumptionCorpus = (candidate.assumptions ?? [])
    .map((a) => a.statement.toLowerCase())
    .join(" ");

  const check = (field: string, value: string, minNovelWords = 3) => {
    const words = value
      .toLowerCase()
      .split(/[^a-zàâäéèêëïîôùûüç0-9]+/i)
      .filter((w) => w.length > 3);
    const novel = words.filter((w) => !briefCorpus.includes(w) && !assumptionCorpus.includes(w));
    // Heuristic: many novel content words without assumptions → likely invented fact
    if (novel.length >= minNovelWords && words.length >= minNovelWords + 1) {
      const coveredByAssumption = (candidate.assumptions ?? []).some((a) =>
        (a.affectsFields ?? []).includes(field),
      );
      if (!coveredByAssumption && containsUnsourcedPromise(value)) {
        issues.push(
          issue(
            "unsourced_claim",
            "Promesse non sourcée par le brief ni couverte par une hypothèse.",
            field,
          ),
        );
      }
    }
  };

  check("emotionalHook", candidate.emotionalHook, 2);
  check("uniqueSellingPoint", candidate.uniqueSellingPoint, 3);
  check("mainBenefit", candidate.mainBenefit, 3);

  if (containsRegulatedClaim(candidate.emotionalHook) || containsRegulatedClaim(candidate.mainBenefit)) {
    issues.push(
      issue(
        "unsourced_claim",
        "Allégation réglementée détectée sans source explicite.",
        "emotionalHook",
      ),
    );
  }

  return issues;
}

export function validateAudienceSensitivity(candidate: MarketingAnalysisCandidate): MarketingValidationIssue[] {
  const issues: MarketingValidationIssue[] = [];
  const texts = [
    candidate.primaryAudience.label,
    candidate.primaryAudience.description,
    ...(candidate.primaryAudience.needs ?? []),
    ...(candidate.primaryAudience.painPoints ?? []),
  ];
  if (candidate.secondaryAudience) {
    texts.push(
      candidate.secondaryAudience.label,
      candidate.secondaryAudience.description,
      ...candidate.secondaryAudience.needs,
      ...candidate.secondaryAudience.painPoints,
    );
  }
  for (const t of texts) {
    if (containsSensitiveTargeting(t)) {
      issues.push(
        issue(
          "sensitive_targeting",
          "Ciblage fondé sur une caractéristique protégée ou sensible interdit.",
          "primaryAudience",
        ),
      );
      break;
    }
  }
  return issues;
}

export function validateCandidateAgainstBrief(
  candidate: MarketingAnalysisCandidate,
  brief: VideoProjectBrief,
): { issues: MarketingValidationIssue[]; warnings: MarketingWarning[] } {
  const issues: MarketingValidationIssue[] = [];
  const warnings: MarketingWarning[] = [];

  if (candidate.marketingObjective !== brief.objective) {
    issues.push(
      issue(
        "incoherent_with_brief",
        "L'objectif marketing doit correspondre à l'objectif du brief.",
        "marketingObjective",
      ),
    );
  }

  if (candidate.tone !== brief.tone) {
    warnings.push({
      code: "tone_differs_from_brief",
      message: "Le ton du candidat diffère du brief ; le brief prévaut à la finalisation.",
      field: "tone",
    });
  }

  if (!candidate.primaryAudience.label || !candidate.primaryAudience.description) {
    issues.push(issue("missing_information", "Audience principale incomplète.", "primaryAudience"));
  }

  if (!candidate.mainProblem.trim()) {
    issues.push(issue("invariant_violation", "Problème principal requis.", "mainProblem"));
  }
  if (!candidate.mainBenefit.trim()) {
    issues.push(issue("invariant_violation", "Bénéfice principal requis.", "mainBenefit"));
  }
  if (looksLikeFeatureOnlyBenefit(candidate.mainBenefit)) {
    issues.push(
      issue(
        "invariant_violation",
        "Le bénéfice doit décrire une valeur utilisateur, pas seulement une fonctionnalité.",
        "mainBenefit",
      ),
    );
  }
  if (!candidate.uniqueSellingPoint.trim()) {
    issues.push(issue("invariant_violation", "Proposition de valeur unique requise.", "uniqueSellingPoint"));
  }
  if (!candidate.emotionalHook.trim()) {
    issues.push(issue("invariant_violation", "Hook émotionnel requis.", "emotionalHook"));
  }
  if (!candidate.callToAction.trim()) {
    issues.push(issue("invariant_violation", "CTA requis.", "callToAction"));
  } else if (!isCtaCompatibleWithObjective(candidate.callToAction, candidate.marketingObjective)) {
    issues.push(
      issue(
        "invariant_violation",
        "Le CTA n'est pas compatible avec l'objectif marketing.",
        "callToAction",
      ),
    );
  }

  if (candidate.keyMessages.length < 1 || candidate.keyMessages.length > 3) {
    issues.push(
      issue("invariant_violation", "Il faut entre 1 et 3 messages clés.", "keyMessages"),
    );
  }

  if (containsUnsourcedPromise(candidate.emotionalHook)) {
    issues.push(
      issue("unsourced_claim", "Le hook contient une promesse non prouvée.", "emotionalHook"),
    );
  }

  issues.push(...validateAudienceSensitivity(candidate));
  issues.push(...collectUngroundedClaims(candidate, brief));
  issues.push(...assertNoTechnicalLeakInPlan(candidate));

  // Brief CTA preference
  if (brief.callToAction && candidate.callToAction !== brief.callToAction.trim()) {
    warnings.push({
      code: "cta_differs_from_brief",
      message: "Le CTA candidat diffère du CTA du brief.",
      field: "callToAction",
    });
  }

  const expectedMetric = defaultMetricKindForObjective(brief.objective);
  if (candidate.successMetric.kind !== expectedMetric) {
    warnings.push({
      code: "metric_kind_unusual",
      message: `Métrique inhabituelle pour l'objectif ${brief.objective}.`,
      field: "successMetric",
    });
  }

  // Derived evidence must have matching assumptions when they affect messaging
  for (const ev of candidate.claimedEvidence ?? []) {
    if (ev.source === "derived") {
      const hasAssumption = (candidate.assumptions ?? []).some(
        (a) =>
          (a.affectsFields ?? []).includes(ev.field) ||
          a.statement.toLowerCase().includes(ev.summary.toLowerCase().slice(0, 24)),
      );
      if (!hasAssumption) {
        issues.push(
          issue(
            "unsourced_claim",
            "Une preuve dérivée doit être accompagnée d'une hypothèse explicite.",
            ev.field,
          ),
        );
      }
    }
  }

  return { issues, warnings };
}

export function validateFinalPlan(plan: MarketingPlan): MarketingValidationIssue[] {
  const issues: MarketingValidationIssue[] = [];
  if (!plan.evidence.length) {
    issues.push(issue("invariant_violation", "Au moins une preuve est requise.", "evidence"));
  }
  if (!plan.assumptions.length) {
    issues.push(issue("invariant_violation", "Au moins une hypothèse explicite est requise.", "assumptions"));
  }
  for (const ev of plan.evidence) {
    if (ev.source === "derived" && ev.summary.trim().length < 8) {
      issues.push(issue("unsourced_claim", "Preuve dérivée sans justification.", ev.field));
    }
  }
  issues.push(...assertNoTechnicalLeakInPlan(plan));
  return issues;
}

/** Build authoritative evidence from brief + candidate (Director-owned). */
export function rebuildEvidence(
  brief: VideoProjectBrief,
  candidate: MarketingAnalysisCandidate,
): MarketingEvidence[] {
  const evidence: MarketingEvidence[] = [
    {
      field: "marketingObjective",
      source: "brief",
      sourcePath: "objective",
      summary: `Objectif brief: ${brief.objective}`,
    },
    {
      field: "tone",
      source: "brief",
      sourcePath: "tone",
      summary: `Ton brief: ${brief.tone}`,
    },
    {
      field: "mainProblem",
      source: "brief",
      sourcePath: "subjectDescription",
      summary: "Problème ancré dans la description du sujet.",
    },
    {
      field: "mainBenefit",
      source: brief.subjectDescription ? "brief" : "derived",
      sourcePath: "subjectDescription",
      summary: brief.subjectDescription
        ? "Bénéfice relié à la description du sujet."
        : "Bénéfice formulé par analyse ; traité comme non factuel sans hypothèse.",
    },
  ];

  if (brief.audienceDescription) {
    evidence.push({
      field: "primaryAudience",
      source: "brief",
      sourcePath: "audienceDescription",
      summary: "Audience décrite dans le brief.",
    });
  } else {
    evidence.push({
      field: "primaryAudience",
      source: "derived",
      summary: "Audience non détaillée dans le brief ; dépend d'hypothèses.",
    });
  }

  if (brief.callToAction) {
    evidence.push({
      field: "callToAction",
      source: "brief",
      sourcePath: "callToAction",
      summary: "CTA fourni par le brief.",
    });
  } else if (candidate.callToAction) {
    evidence.push({
      field: "callToAction",
      source: "derived",
      summary: "CTA proposé faute de CTA brief ; hypothèse requise.",
    });
  }

  if (brief.brandConstraints) {
    evidence.push({
      field: "brandConstraints",
      source: "user_constraint",
      sourcePath: "brandConstraints",
      summary: "Contraintes de marque fournies par l'utilisateur.",
    });
  }

  for (const media of brief.mediaReferences.slice(0, 5)) {
    const safeId = media.id.replace(/[^a-zA-Z0-9_]/g, "_");
    evidence.push({
      field: "mediaReferences",
      source: "media_reference",
      sourcePath: `mediaReferences.${safeId}`,
      summary: `Référence média: ${media.kind} — ${media.label}`,
    });
  }

  return evidence;
}
