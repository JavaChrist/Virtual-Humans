import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type {
  ScriptAnalysisCandidate,
  ScriptEvidence,
  ScriptSegment,
  VideoScript,
} from "./video-script";
import type { ScriptValidationIssue, ScriptWarning } from "./errors";
import { extractCtaActionTokens, foldText } from "./normalization";

const TECHNICAL_KEYS = ["provider", "providerId", "modelId", "model", "prompt", "systemPrompt"] as const;

const DECOR_LEAK =
  /\b(décor|decor|background set|studio set|lieu\s*[:=]|location\s*[:=]|intérieur moderne|exterieur urbain)\b/i;
const CAMERA_LEAK =
  /\b(close[- ]up|wide shot|dolly|pan left|tilt up|caméra\s+(sur|qui)|lens\s+\d+mm|cadrage\s*[:=])\b/i;
const POSE_LEAK =
  /\b(pose\s*[:=]|geste de la main|bras croisés|sourire forcé|expression faciale détaillée|mime\s+[a-z])/i;
const LIGHT_LEAK =
  /\b(éclairage|lighting|key light|rim light|softbox|trois points)\b/i;
const PROMPT_LEAK =
  /\b(negative prompt|system prompt|prompt\s*:|\/imagine|cfg\s*scale|seed\s*=)\b/i;
const PROVIDER_LEAK =
  /\b(openai|gpt-4|claude-3|fal\.ai|elevenlabs|midjourney|runway|sora\b|veo\s*\d|pulid)\b/i;
const COST_LEAK =
  /\b(costCents|budgetUSD|generation plan|model router|providerCalled)\b/i;
const STAT_LEAK =
  /(\d+\s*%|\b\d+\s*(clients|users|utilisateurs)\b|études montrent|studies show|statistique)/i;
const TESTIMONIAL_LEAK =
  /\b(témoignage réel|vrai client|real customer said|d'après Jean Dupont)\b/i;
const UNSOURCED =
  /\b(garanti|guaranteed|100\s*%|miracle|sans risque|risk[- ]free)\b/i;

function issue(code: string, message: string, field?: string): ScriptValidationIssue {
  return { code, message, field };
}

export function assertNoTechnicalLeak(
  value: ScriptAnalysisCandidate | VideoScript,
): ScriptValidationIssue[] {
  const issues: ScriptValidationIssue[] = [];
  const record = value as unknown as Record<string, unknown>;
  for (const key of TECHNICAL_KEYS) {
    if (key in record) {
      issues.push(issue("technical_leak", "Paramètre technique interdit.", key));
    }
  }
  return issues;
}

export function detectResponsibilityLeaks(text: string, field: string): ScriptValidationIssue[] {
  const issues: ScriptValidationIssue[] = [];
  if (DECOR_LEAK.test(text)) issues.push(issue("responsibility_leak", "Décors / lieu détecté.", field));
  if (CAMERA_LEAK.test(text)) issues.push(issue("responsibility_leak", "Instruction caméra détectée.", field));
  if (POSE_LEAK.test(text)) issues.push(issue("responsibility_leak", "Pose / geste de mise en scène détecté.", field));
  if (LIGHT_LEAK.test(text)) issues.push(issue("responsibility_leak", "Éclairage détecté.", field));
  if (PROMPT_LEAK.test(text)) issues.push(issue("responsibility_leak", "Prompt détecté.", field));
  if (PROVIDER_LEAK.test(text)) issues.push(issue("responsibility_leak", "Provider ou modèle détecté.", field));
  if (COST_LEAK.test(text)) issues.push(issue("responsibility_leak", "Coût ou stratégie de génération détecté.", field));
  return issues;
}

function collectTexts(candidate: ScriptAnalysisCandidate): Array<{ field: string; text: string }> {
  const out: Array<{ field: string; text: string }> = [
    { field: "title", text: candidate.title },
    { field: "summary", text: candidate.summary },
    { field: "hookText", text: candidate.hookText },
    { field: "callToActionText", text: candidate.callToActionText },
  ];
  if (candidate.notes) out.push({ field: "notes", text: candidate.notes });
  for (const seg of candidate.segments) {
    const prefix = `segments.${seg.id}`;
    if (seg.dialogue) out.push({ field: `${prefix}.dialogue`, text: seg.dialogue });
    if (seg.voiceOver) out.push({ field: `${prefix}.voiceOver`, text: seg.voiceOver });
    if (seg.screenText) out.push({ field: `${prefix}.screenText`, text: seg.screenText });
    out.push({ field: `${prefix}.emotion`, text: seg.emotion });
  }
  return out;
}

export function validateSegmentStructure(segments: ScriptSegment[]): ScriptValidationIssue[] {
  const issues: ScriptValidationIssue[] = [];
  const orders = segments.map((s) => s.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      issues.push(issue("invariant_violation", "Ordres de segments non contigus.", "segments"));
      break;
    }
  }
  const ids = segments.map((s) => s.id);
  if (new Set(ids).size !== ids.length) {
    issues.push(issue("invariant_violation", "IDs de segments dupliqués.", "segments"));
  }

  const sorted = [...segments].sort((a, b) => a.order - b.order);
  if (sorted[0]?.purpose !== "hook") {
    issues.push(issue("invariant_violation", "Le premier segment doit avoir purpose hook.", "segments"));
  }
  if (sorted[sorted.length - 1]?.purpose !== "cta") {
    issues.push(issue("invariant_violation", "Le dernier segment doit avoir purpose cta.", "segments"));
  }
  return issues;
}

export function isCtaActionPreserved(sourceCta: string, adaptedCta: string): boolean {
  const sourceTokens = extractCtaActionTokens(sourceCta);
  const adapted = foldText(adaptedCta);
  if (sourceTokens.length === 0) {
    // Fallback: significant overlap of content words
    return foldText(sourceCta)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5)
      .some((w) => adapted.includes(w));
  }
  // At least one core action token must remain
  return sourceTokens.some((t) => adapted.includes(t));
}

export function validateConservation(
  candidate: ScriptAnalysisCandidate,
  plan: MarketingPlan,
  concept: CreativeConcept,
): { issues: ScriptValidationIssue[]; warnings: ScriptWarning[] } {
  const issues: ScriptValidationIssue[] = [];
  const warnings: ScriptWarning[] = [];
  const corpus = collectTexts(candidate)
    .map((t) => t.text)
    .join(" ")
    .toLowerCase();

  if (!isCtaActionPreserved(plan.callToAction, candidate.callToActionText)) {
    issues.push(
      issue(
        "incoherent_with_sources",
        "L'action du CTA marketing a été modifiée.",
        "callToActionText",
      ),
    );
  }

  if (/\b(nouvelle cible|new target audience|audience principale\s*[:=])/i.test(corpus)) {
    issues.push(issue("incoherent_with_sources", "Nouvelle cible refusée.", "summary"));
  }

  const benefitWords = plan.mainBenefit
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôùûüç0-9]+/i)
    .filter((w) => w.length > 4);
  const ideaWords = concept.bigIdea
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôùûüç0-9]+/i)
    .filter((w) => w.length > 4);
  const hookFold = foldText(candidate.hookText + " " + candidate.summary);
  if (benefitWords.length >= 2 && !benefitWords.some((w) => foldText(candidate.hookText).includes(foldText(w)))) {
    // soft: hook should touch benefit — warning if none
    warnings.push({
      code: "hook_weak_benefit_link",
      message: "Le hook semble peu relié au bénéfice principal.",
      field: "hookText",
    });
  }

  // Replacing big idea
  if (
    /\b(nouvelle grande idée|new big idea|remplace le concept)\b/i.test(corpus) ||
    (ideaWords.length >= 3 &&
      ideaWords.filter((w) => hookFold.includes(foldText(w))).length === 0 &&
      /\b(plutôt|instead|contrairement au concept)\b/i.test(corpus))
  ) {
    issues.push(
      issue("incoherent_with_sources", "Remplacement de la grande idée refusé.", "summary"),
    );
  }

  for (const a of plan.assumptions) {
    if (a.status === "inferred" || a.status === "unverified") {
      const snippet = a.statement.toLowerCase().slice(0, 40);
      if (
        snippet.length > 12 &&
        corpus.includes(snippet) &&
        /\b(il est établi|it is a fact|prouvé que)\b/i.test(corpus)
      ) {
        issues.push(
          issue(
            "incoherent_with_sources",
            "Hypothèse transformée en fait refusée.",
            "summary",
          ),
        );
      }
    }
  }

  if (STAT_LEAK.test(corpus) && !plan.evidence.some((e) => /\d/.test(e.summary))) {
    issues.push(issue("unsourced_claim", "Statistique inventée refusée.", "summary"));
  }
  if (TESTIMONIAL_LEAK.test(corpus)) {
    issues.push(issue("unsourced_claim", "Faux témoignage refusé.", "summary"));
  }
  if (UNSOURCED.test(corpus)) {
    issues.push(issue("unsourced_claim", "Allégation non sourcée détectée.", "hookText"));
  }

  // Invented competing benefit
  if (
    /\bbénéfice principal\s*[:=]/i.test(corpus) &&
    !corpus.includes(plan.mainBenefit.toLowerCase().slice(0, 20))
  ) {
    issues.push(issue("incoherent_with_sources", "Bénéfice inventé refusé.", "summary"));
  }

  void benefitWords;
  return { issues, warnings };
}

export function validateCandidateAgainstSources(
  candidate: ScriptAnalysisCandidate,
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
): { issues: ScriptValidationIssue[]; warnings: ScriptWarning[] } {
  const issues: ScriptValidationIssue[] = [];
  const warnings: ScriptWarning[] = [];

  if (brief.projectId !== plan.projectId || plan.projectId !== concept.projectId) {
    issues.push(
      issue("incoherent_with_sources", "Artifacts de projets différents.", "projectId"),
    );
  }
  if (concept.marketingPlanRevisionId !== plan.id) {
    issues.push(
      issue(
        "incoherent_with_sources",
        "CreativeConcept.marketingPlanRevisionId incohérent.",
        "marketingPlanRevisionId",
      ),
    );
  }

  issues.push(...validateSegmentStructure(candidate.segments));
  issues.push(...assertNoTechnicalLeak(candidate));

  const sorted = [...candidate.segments].sort((a, b) => a.order - b.order);
  const first = sorted[0];
  if (first && !foldText(first.dialogue ?? first.voiceOver ?? first.screenText ?? "").includes(
    foldText(candidate.hookText).slice(0, 12),
  ) && first.purpose === "hook") {
    // Hook text should appear in first segment content (approx)
    const firstText = foldText(
      `${first.dialogue ?? ""} ${first.voiceOver ?? ""} ${first.screenText ?? ""}`,
    );
    const hookStart = foldText(candidate.hookText).slice(0, 16);
    if (hookStart.length >= 8 && !firstText.includes(hookStart.slice(0, 8))) {
      issues.push(
        issue(
          "invariant_violation",
          "Le hook doit apparaître dans le premier segment.",
          "hookText",
        ),
      );
    }
  }

  for (const { field, text } of collectTexts(candidate)) {
    issues.push(...detectResponsibilityLeaks(text, field));
  }

  // Emotion is vocal intent — accept simple emotion words; reject if looks like stage direction
  for (const seg of candidate.segments) {
    if (POSE_LEAK.test(seg.emotion) || CAMERA_LEAK.test(seg.emotion)) {
      issues.push(
        issue(
          "responsibility_leak",
          "emotion doit rester une intention vocale, pas une mise en scène.",
          `segments.${seg.id}.emotion`,
        ),
      );
    }
  }

  const conservation = validateConservation(candidate, plan, concept);
  issues.push(...conservation.issues);
  warnings.push(...conservation.warnings);

  return { issues, warnings };
}

export function rebuildScriptEvidence(
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
): ScriptEvidence[] {
  return [
    {
      field: "marketingObjective",
      source: "marketing_plan",
      sourcePath: "marketingObjective",
      summary: `Objectif: ${plan.marketingObjective}`,
    },
    {
      field: "primaryAudience",
      source: "marketing_plan",
      sourcePath: "primaryAudience.label",
      summary: `Audience: ${plan.primaryAudience.label}`,
    },
    {
      field: "mainBenefit",
      source: "marketing_plan",
      sourcePath: "mainBenefit",
      summary: "Bénéfice marketing conservé.",
    },
    {
      field: "tone",
      source: "marketing_plan",
      sourcePath: "tone",
      summary: `Ton: ${plan.tone}`,
    },
    {
      field: "callToAction",
      source: "marketing_plan",
      sourcePath: "callToAction",
      summary: "CTA marketing source de l'action.",
    },
    {
      field: "keyMessages",
      source: "marketing_plan",
      sourcePath: "keyMessages",
      summary: `${plan.keyMessages.length} message(s) clé(s).`,
    },
    {
      field: "bigIdea",
      source: "creative_concept",
      sourcePath: "bigIdea",
      summary: "Grande idée créative conservée.",
    },
    {
      field: "narrativeApproach",
      source: "creative_concept",
      sourcePath: "narrativeApproach",
      summary: `Approche: ${concept.narrativeApproach}`,
    },
    {
      field: "emotionalArc",
      source: "creative_concept",
      sourcePath: "emotionalArc",
      summary: `${concept.emotionalArc.length} beats émotionnels.`,
    },
    {
      field: "rhythm",
      source: "creative_concept",
      sourcePath: "rhythm",
      summary: `Rythme: ${concept.rhythm}`,
    },
    {
      field: "language",
      source: "brief",
      sourcePath: "language",
      summary: `Langue brief: ${brief.language}`,
    },
    {
      field: "targetDurationSeconds",
      source: "brief",
      sourcePath: "durationSeconds",
      summary: `Durée cible: ${brief.durationSeconds}s`,
    },
  ];
}
