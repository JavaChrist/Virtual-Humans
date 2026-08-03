import type { VideoProjectBrief } from "@/domain/brief";
import { CreativeConceptSchema, type CreativeConcept } from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import type { MissingInformation, ScriptWarning } from "./errors";
import { resolveSpeechTimingProfile } from "./timing";

export type ScriptReadinessCheckCode =
  | "brief_ok"
  | "marketing_plan_ok"
  | "creative_concept_ok"
  | "same_project"
  | "revision_links"
  | "cta_ok"
  | "language_profile"
  | "duration_supported"
  | "big_idea_ok"
  | "arc_ok"
  | "assumptions_ok"
  | "no_technical_leak"
  | "no_blocking_claim";

export type ScriptReadinessCheck = {
  code: ScriptReadinessCheckCode;
  passed: boolean;
  message: string;
};

const BLOCKING_CLAIM = /\b(garanti|guaranteed|100\s*%|miracle|sans risque)\b/i;

function hasTechLeak(obj: object): boolean {
  const record = obj as Record<string, unknown>;
  return ["provider", "modelId", "model", "prompt", "systemPrompt"].some((k) => k in record);
}

export function assessScriptReadiness(
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
): {
  executable: boolean;
  checks: ScriptReadinessCheck[];
  warnings: ScriptWarning[];
  missingInformation: MissingInformation[];
} {
  const checks: ScriptReadinessCheck[] = [];
  const warnings: ScriptWarning[] = [];
  const missingInformation: MissingInformation[] = [];
  const push = (code: ScriptReadinessCheckCode, passed: boolean, message: string) => {
    checks.push({ code, passed, message });
  };

  const briefOk = Boolean(brief.id && brief.projectId && brief.durationSeconds);
  push("brief_ok", briefOk, briefOk ? "Brief présent." : "Brief incomplet.");

  const planOk = MarketingPlanSchema.safeParse(plan).success;
  push("marketing_plan_ok", planOk, planOk ? "MarketingPlan valide." : "MarketingPlan invalide.");
  if (!planOk) {
    missingInformation.push({
      code: "marketing_plan_invalid",
      message: "Marketing Plan invalide.",
      required: true,
    });
  }

  const conceptOk = CreativeConceptSchema.safeParse(concept).success;
  push(
    "creative_concept_ok",
    conceptOk,
    conceptOk ? "CreativeConcept valide." : "CreativeConcept invalide.",
  );
  if (!conceptOk) {
    missingInformation.push({
      code: "creative_concept_invalid",
      message: "Creative Concept invalide.",
      required: true,
    });
  }

  const same =
    brief.projectId === plan.projectId && plan.projectId === concept.projectId;
  push("same_project", same, same ? "Même projet." : "Projets incompatibles.");
  if (!same) {
    missingInformation.push({
      code: "project_mismatch",
      field: "projectId",
      message: "Aligner brief, plan et concept sur le même projet.",
      required: true,
    });
  }

  const linksOk =
    concept.marketingPlanRevisionId === plan.id && plan.briefRevisionId === brief.id;
  push(
    "revision_links",
    linksOk,
    linksOk ? "Révisions cohérentes." : "Révisions marketing/créative incohérentes.",
  );
  if (!linksOk) {
    missingInformation.push({
      code: "revision_mismatch",
      message: "Chaîne brief → plan → concept incohérente.",
      required: true,
    });
  }

  const ctaOk = Boolean(plan.callToAction?.trim());
  push("cta_ok", ctaOk, ctaOk ? "CTA exploitable." : "CTA manquant.");
  if (!ctaOk) {
    missingInformation.push({
      code: "cta_missing",
      field: "callToAction",
      message: "CTA marketing requis.",
      required: true,
    });
  }

  const { usedFallback } = resolveSpeechTimingProfile(brief.language);
  push("language_profile", true, usedFallback
    ? "Langue avec profil fallback documenté."
    : "Profil linguistique dédié disponible.");
  if (usedFallback) {
    warnings.push({
      code: "language_fallback",
      field: "language",
      message: "Profil de timing fallback utilisé pour cette langue.",
    });
  }

  const durationOk = [15, 20, 30, 60].includes(brief.durationSeconds);
  push(
    "duration_supported",
    durationOk,
    durationOk ? "Durée cible supportée." : "Durée cible non supportée.",
  );

  const bigIdeaOk = Boolean(concept.bigIdea?.trim()) && concept.bigIdea.trim().length >= 12;
  push("big_idea_ok", bigIdeaOk, bigIdeaOk ? "Grande idée exploitable." : "Grande idée absente.");
  if (!bigIdeaOk) {
    missingInformation.push({
      code: "big_idea_missing",
      field: "bigIdea",
      message: "Grande idée créative requise.",
      required: true,
    });
  }

  const arcOk = Array.isArray(concept.emotionalArc) && concept.emotionalArc.length >= 2;
  push("arc_ok", arcOk, arcOk ? "Arc émotionnel exploitable." : "Arc inutilisable.");
  if (!arcOk) {
    missingInformation.push({
      code: "arc_unusable",
      field: "emotionalArc",
      message: "Arc émotionnel créatif requis.",
      required: true,
    });
  }

  const assumptionsOk =
    (plan.assumptions?.length ?? 0) > 0 || (concept.assumptions?.length ?? 0) > 0;
  push(
    "assumptions_ok",
    assumptionsOk,
    assumptionsOk ? "Hypothèses identifiées." : "Aucune hypothèse critique identifiée.",
  );
  if (!assumptionsOk) {
    missingInformation.push({
      code: "assumptions_missing",
      message: "Hypothèses sources manquantes.",
      required: true,
    });
  }

  const noLeak = !hasTechLeak(plan) && !hasTechLeak(concept);
  push("no_technical_leak", noLeak, noLeak ? "Pas de fuite technique." : "Fuite technique.");

  const claimText = [plan.emotionalHook, plan.uniqueSellingPoint, concept.bigIdea].join(" ");
  const noClaim = !BLOCKING_CLAIM.test(claimText);
  push(
    "no_blocking_claim",
    noClaim,
    noClaim ? "Pas d'allégation bloquante." : "Allégation non sourcée bloquante.",
  );
  if (!noClaim) {
    missingInformation.push({
      code: "unsourced_claim_blocking",
      message: "Corriger les allégations non sourcées des artifacts sources.",
      required: true,
    });
  }

  const blocking = missingInformation.some((m) => m.required);
  const criticalFailed = checks.some(
    (c) => !c.passed && c.code !== "language_profile",
  );
  return {
    executable: !blocking && !criticalFailed && briefOk && noLeak,
    checks,
    warnings,
    missingInformation,
  };
}
