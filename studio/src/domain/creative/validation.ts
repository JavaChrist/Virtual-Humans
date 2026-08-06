import type { VideoProjectBrief } from "@/domain/brief";
import type { MarketingPlan } from "@/domain/marketing";
import { resolveCreativeArcBeatBudget } from "./arc-beat-budget";
import {
  AllowedReferenceKeywordValues,
  CREATIVE_FIELD_LIMITS,
  type CreativeAnalysisCandidate,
  type CreativeConcept,
  type CreativeEvidence,
} from "./creative-concept";
import type { CreativeValidationIssue, CreativeWarning } from "./errors";
import { detectForbiddenReferences } from "./forbidden-references";

export { detectForbiddenReferences } from "./forbidden-references";

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

/** Structured responsibility leaks — prefer field-level + phrase patterns over bare words. */
const DIALOGUE_LEAK =
  /\b(dit\s*[:«"]|says\s*[:'"]|dialogue\s*:|réplique\s*:|line\s*\d+\s*:|"[^"]{12,}"\s*—\s*[A-ZÀ-Ü])/i;

const SCENE_BREAKDOWN_LEAK =
  /\b(scène\s*\d+|scene\s*\d+|shot\s*\d+|plan\s*\d+\s*[-:—]|découpage\s*:|storyboard\s*:)/i;

const CAMERA_LEAK =
  /\b(close[- ]up|wide shot|dolly|pan left|tilt up|caméra\s+(sur|qui)|lens\s+\d+mm|f\/\d|éclairage\s+key|three[- ]point lighting)\b/i;

const PROMPT_LEAK =
  /\b(negative prompt|system prompt|prompt\s*:|\/imagine|cfg\s*scale|seed\s*=|lora\b)/i;

const PROVIDER_MODEL_LEAK =
  /\b(openai|gpt-4|claude-3|fal\.ai|elevenlabs|midjourney|runway\s*ml|sora\b|veo\s*\d|flux\.1|pulid)\b/i;

const GENERATION_COST_LEAK =
  /\b(costCents|budgetUSD|generation plan|model router|providerCalled|idempotency key)\b/i;

const UNSOURCED_PROMISE =
  /\b(guaranteed|garanti|100\s*%|miracle|sans risque|risk[- ]free|double[rz]? (vos|your))\b/i;

const FEATURE_LIST =
  /^(?:[-*•]\s+.+\n){2,}/m;

function issue(code: string, message: string, field?: string): CreativeValidationIssue {
  return { code, message, field };
}

export function assertNoTechnicalLeakKeys(
  value: CreativeConcept | CreativeAnalysisCandidate,
): CreativeValidationIssue[] {
  const issues: CreativeValidationIssue[] = [];
  const record = value as unknown as Record<string, unknown>;
  for (const key of TECHNICAL_LEAK_KEYS) {
    if (key in record) {
      issues.push(issue("technical_leak", "Paramètre technique interdit dans le concept.", key));
    }
  }
  return issues;
}

export function detectResponsibilityLeaks(text: string, field: string): CreativeValidationIssue[] {
  const issues: CreativeValidationIssue[] = [];
  if (DIALOGUE_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Dialogue définitif détecté.", field));
  }
  if (SCENE_BREAKDOWN_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Découpage de scènes détaillé détecté.", field));
  }
  if (CAMERA_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Instruction caméra/éclairage détectée.", field));
  }
  if (PROMPT_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Prompt ou syntaxe de génération détecté.", field));
  }
  if (PROVIDER_MODEL_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Provider ou modèle détecté.", field));
  }
  if (GENERATION_COST_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Coût ou stratégie de génération détecté.", field));
  }
  return issues;
}

function collectCandidateTexts(candidate: CreativeAnalysisCandidate): Array<{ field: string; text: string }> {
  const texts: Array<{ field: string; text: string }> = [
    { field: "title", text: candidate.title },
    { field: "logline", text: candidate.logline },
    { field: "bigIdea", text: candidate.bigIdea },
    { field: "openingDevice", text: candidate.openingDevice.description },
    { field: "endingDevice", text: candidate.endingDevice.description },
  ];
  if (candidate.proofDevice) {
    texts.push({ field: "proofDevice", text: candidate.proofDevice.description });
  }
  for (const beat of candidate.emotionalArc) {
    texts.push({ field: `emotionalArc.${beat.order}`, text: `${beat.emotion} ${beat.description}` });
  }
  for (const kw of candidate.referenceKeywords) {
    texts.push({ field: "referenceKeywords", text: kw });
  }
  if (candidate.notes) texts.push({ field: "notes", text: candidate.notes });
  return texts;
}

export function validateEmotionalArcOrders(
  candidate: CreativeAnalysisCandidate,
  durationSeconds: number,
): CreativeValidationIssue[] {
  const issues: CreativeValidationIssue[] = [];
  const arc = candidate.emotionalArc;
  if (arc.length < CREATIVE_FIELD_LIMITS.beatsMin) {
    issues.push(issue("invariant_violation", "Arc émotionnel trop court.", "emotionalArc"));
  }
  const { maxBeats } = resolveCreativeArcBeatBudget(durationSeconds);
  if (arc.length > maxBeats) {
    issues.push(
      issue(
        "invariant_violation",
        `Trop de beats pour une durée de ${durationSeconds}s (max ${maxBeats}).`,
        "emotionalArc",
      ),
    );
  }
  const orders = arc.map((b) => b.order).sort((a, b) => a - b);
  const unique = new Set(orders);
  if (unique.size !== orders.length) {
    issues.push(issue("invariant_violation", "Ordres de beats dupliqués.", "emotionalArc"));
  }
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      issues.push(
        issue(
          "invariant_violation",
          "Les ordres doivent être uniques, contigus et commencer à 1.",
          "emotionalArc",
        ),
      );
      break;
    }
  }
  const hasAction = arc.some((b) => b.purpose === "action");
  if (!hasAction) {
    issues.push(
      issue(
        "invariant_violation",
        "L'arc doit mener à une intention d'action (CTA) sans le remplacer.",
        "emotionalArc",
      ),
    );
  }
  return issues;
}

export function validateMarketingConservation(
  candidate: CreativeAnalysisCandidate,
  plan: MarketingPlan,
): { issues: CreativeValidationIssue[]; warnings: CreativeWarning[] } {
  const issues: CreativeValidationIssue[] = [];
  const warnings: CreativeWarning[] = [];

  const corpus = [
    candidate.title,
    candidate.logline,
    candidate.bigIdea,
    candidate.openingDevice.description,
    candidate.endingDevice.description,
    candidate.proofDevice?.description ?? "",
    ...candidate.emotionalArc.map((b) => b.description),
  ]
    .join(" ")
    .toLowerCase();

  // CTA must not be changed — reject alternate CTAs presented as creative content
  const planCta = plan.callToAction.trim().toLowerCase();
  const ctaChange =
    /\bcta\s*[:=]\s*/i.test(corpus) ||
    /\bappel à l'action\s*[:=]/i.test(corpus);
  if (ctaChange) {
    issues.push(
      issue("incoherent_with_marketing", "Le concept ne doit pas redéfinir le CTA.", "logline"),
    );
  }

  // Benefit must remain grounded — inventing a competing primary benefit
  if (
    /\bbénéfice principal\s*[:=]/i.test(corpus) &&
    !corpus.includes(plan.mainBenefit.toLowerCase().slice(0, 24))
  ) {
    issues.push(
      issue(
        "incoherent_with_marketing",
        "Un bénéfice principal inventé est refusé.",
        "bigIdea",
      ),
    );
  }

  // New audience targeting
  if (/\bcible\s*[:=]\s*(?!.*navette)/i.test(candidate.logline + candidate.bigIdea)) {
    // Soft: only flag explicit "nouvelle cible" / "target audience:" redefinition
  }
  if (/\b(nouvelle cible|new target audience|audience principale\s*[:=])/i.test(corpus)) {
    issues.push(
      issue("incoherent_with_marketing", "Nouvelle cible refusée.", "logline"),
    );
  }

  // bigIdea should relate to main benefit (shared content words)
  const benefitWords = plan.mainBenefit
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôùûüç0-9]+/i)
    .filter((w) => w.length > 4);
  const idea = candidate.bigIdea.toLowerCase();
  const overlap = benefitWords.filter((w) => idea.includes(w));
  if (benefitWords.length >= 2 && overlap.length === 0) {
    issues.push(
      issue(
        "incoherent_with_marketing",
        "La grande idée doit soutenir le bénéfice principal du plan marketing.",
        "bigIdea",
      ),
    );
  }

  if (FEATURE_LIST.test(candidate.bigIdea) || FEATURE_LIST.test(candidate.logline)) {
    issues.push(
      issue("invariant_violation", "La grande idée ne doit pas être une liste de fonctionnalités.", "bigIdea"),
    );
  }

  if (UNSOURCED_PROMISE.test(candidate.bigIdea) || UNSOURCED_PROMISE.test(candidate.logline)) {
    issues.push(issue("unsourced_claim", "Promesse non sourcée dans le concept.", "bigIdea"));
  }

  // Turning marketing assumptions into stated facts
  for (const a of plan.assumptions) {
    if (a.status === "inferred" || a.status === "unverified") {
      const snippet = a.statement.toLowerCase().slice(0, 40);
      if (
        snippet.length > 12 &&
        corpus.includes(snippet) &&
        /\b(il est établi|it is a fact|prouvé que|proven that)\b/i.test(corpus)
      ) {
        issues.push(
          issue(
            "incoherent_with_marketing",
            "Une hypothèse marketing ne peut pas être présentée comme un fait.",
            "logline",
          ),
        );
      }
    }
  }

  if (!planCta) {
    warnings.push({
      code: "marketing_cta_empty",
      message: "Le plan marketing n'a pas de CTA exploitable.",
      field: "callToAction",
    });
  }

  return { issues, warnings };
}

export function validateReferenceKeywords(
  keywords: string[],
): CreativeValidationIssue[] {
  const issues: CreativeValidationIssue[] = [];
  const allowed = new Set<string>(AllowedReferenceKeywordValues);
  const seen = new Set<string>();
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    if (seen.has(lower)) {
      issues.push(issue("invariant_violation", "Mots-clés de référence en doublon.", "referenceKeywords"));
    }
    seen.add(lower);
    if (!allowed.has(lower)) {
      issues.push(
        issue("forbidden_reference", `Mot-clé de référence non autorisé: ${kw}`, "referenceKeywords"),
      );
    }
    issues.push(...detectForbiddenReferences(kw, "referenceKeywords"));
    issues.push(...detectResponsibilityLeaks(kw, "referenceKeywords"));
  }
  return issues;
}

export function validateCandidateAgainstMarketing(
  candidate: CreativeAnalysisCandidate,
  plan: MarketingPlan,
  brief: VideoProjectBrief,
): { issues: CreativeValidationIssue[]; warnings: CreativeWarning[] } {
  const issues: CreativeValidationIssue[] = [];
  const warnings: CreativeWarning[] = [];

  if (plan.projectId !== brief.projectId) {
    issues.push(
      issue(
        "incoherent_with_marketing",
        "Le brief et le Marketing Plan doivent appartenir au même projet.",
        "projectId",
      ),
    );
  }
  if (plan.briefRevisionId !== brief.id) {
    warnings.push({
      code: "brief_revision_mismatch",
      message: "Le brief fourni ne correspond pas à briefRevisionId du plan.",
      field: "briefRevisionId",
    });
  }

  issues.push(...validateEmotionalArcOrders(candidate, brief.durationSeconds));
  issues.push(...validateReferenceKeywords(candidate.referenceKeywords));
  issues.push(...assertNoTechnicalLeakKeys(candidate));

  for (const { field, text } of collectCandidateTexts(candidate)) {
    issues.push(...detectResponsibilityLeaks(text, field));
    issues.push(...detectForbiddenReferences(text, field));
  }

  const conservation = validateMarketingConservation(candidate, plan);
  issues.push(...conservation.issues);
  warnings.push(...conservation.warnings);

  if (!candidate.bigIdea.trim() || candidate.bigIdea.split(/\s+/).length < 4) {
    issues.push(issue("invariant_violation", "La grande idée doit être une phrase claire.", "bigIdea"));
  }

  for (const ev of candidate.claimedEvidence ?? []) {
    if (ev.source === "derived") {
      const hasAssumption = (candidate.assumptions ?? []).some(
        (a) => (a.affectsFields ?? []).includes(ev.field),
      );
      if (!hasAssumption) {
        issues.push(
          issue(
            "unsourced_claim",
            "Preuve dérivée sans hypothèse associée.",
            ev.field,
          ),
        );
      }
    }
  }

  return { issues, warnings };
}

export function rebuildCreativeEvidence(
  plan: MarketingPlan,
  brief: VideoProjectBrief,
): CreativeEvidence[] {
  const evidence: CreativeEvidence[] = [
    {
      field: "marketingObjective",
      source: "marketing_plan",
      sourcePath: "marketingObjective",
      summary: `Objectif conservé: ${plan.marketingObjective}`,
    },
    {
      field: "primaryAudience",
      source: "marketing_plan",
      sourcePath: "primaryAudience.label",
      summary: `Audience conservée: ${plan.primaryAudience.label}`,
    },
    {
      field: "mainProblem",
      source: "marketing_plan",
      sourcePath: "mainProblem",
      summary: "Problème principal du plan marketing.",
    },
    {
      field: "mainBenefit",
      source: "marketing_plan",
      sourcePath: "mainBenefit",
      summary: "Bénéfice principal du plan marketing.",
    },
    {
      field: "tone",
      source: "marketing_plan",
      sourcePath: "tone",
      summary: `Ton conservé: ${plan.tone}`,
    },
    {
      field: "callToAction",
      source: "marketing_plan",
      sourcePath: "callToAction",
      summary: "CTA marketing conservé (non réécrit).",
    },
    {
      field: "keyMessages",
      source: "marketing_plan",
      sourcePath: "keyMessages",
      summary: `${plan.keyMessages.length} message(s) clé(s) conservé(s).`,
    },
    {
      field: "successMetric",
      source: "marketing_plan",
      sourcePath: "successMetric.kind",
      summary: `Métrique: ${plan.successMetric.kind}`,
    },
    {
      field: "durationSeconds",
      source: "brief",
      sourcePath: "durationSeconds",
      summary: `Durée brief: ${brief.durationSeconds}s`,
    },
    {
      field: "platform",
      source: "brief",
      sourcePath: "platform",
      summary: `Plateforme: ${brief.platform}`,
    },
  ];

  if (brief.brandConstraints?.trim()) {
    evidence.push({
      field: "brandConstraints",
      source: "user_constraint",
      sourcePath: "brandConstraints",
      summary: "Contraintes de marque du brief.",
    });
  }

  return evidence;
}

export function validateFinalConcept(concept: CreativeConcept): CreativeValidationIssue[] {
  const issues: CreativeValidationIssue[] = [];
  if (!concept.evidence.length) {
    issues.push(issue("invariant_violation", "Au moins une preuve est requise.", "evidence"));
  }
  if (!concept.assumptions.length) {
    issues.push(issue("invariant_violation", "Au moins une hypothèse est requise.", "assumptions"));
  }
  issues.push(...assertNoTechnicalLeakKeys(concept));
  issues.push(...validateReferenceKeywords(concept.referenceKeywords));
  return issues;
}
