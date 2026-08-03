/**
 * Pure readiness checks before creative analysis.
 * Never invents a CreativeConcept.
 */

import type { VideoProjectBrief } from "@/domain/brief";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import type { CreativeWarning, MissingInformation } from "./errors";

export type CreativeReadinessCheckCode =
  | "marketing_plan_schema"
  | "marketing_revision"
  | "same_project"
  | "objective_ok"
  | "audience_ok"
  | "benefit_ok"
  | "tone_ok"
  | "cta_ok"
  | "duration_platform_ok"
  | "brand_constraints"
  | "assumptions_identified"
  | "no_technical_leak"
  | "no_blocking_unsourced_claim";

export type CreativeReadinessCheck = {
  code: CreativeReadinessCheckCode;
  passed: boolean;
  message: string;
};

function hasTechnicalLeak(plan: MarketingPlan): boolean {
  const record = plan as unknown as Record<string, unknown>;
  for (const key of ["provider", "modelId", "model", "prompt", "systemPrompt"]) {
    if (key in record) return true;
  }
  return false;
}

const BLOCKING_UNSOURCED =
  /\b(guaranteed|garanti|100\s*%|miracle|sans risque|risk[- ]free)\b/i;

export function assessCreativeReadiness(
  plan: MarketingPlan,
  brief: VideoProjectBrief,
): {
  executable: boolean;
  checks: CreativeReadinessCheck[];
  warnings: CreativeWarning[];
  missingInformation: MissingInformation[];
} {
  const checks: CreativeReadinessCheck[] = [];
  const warnings: CreativeWarning[] = [];
  const missingInformation: MissingInformation[] = [];

  const push = (code: CreativeReadinessCheckCode, passed: boolean, message: string) => {
    checks.push({ code, passed, message });
  };

  const schemaOk = MarketingPlanSchema.safeParse(plan).success;
  push(
    "marketing_plan_schema",
    schemaOk,
    schemaOk ? "MarketingPlan structurellement valide." : "MarketingPlan invalide.",
  );
  if (!schemaOk) {
    missingInformation.push({
      code: "marketing_plan_invalid",
      message: "Le Marketing Plan doit être valide avant l'analyse créative.",
      required: true,
    });
  }

  const revisionOk = Boolean(plan.id?.trim()) && plan.revision >= 1;
  push(
    "marketing_revision",
    revisionOk,
    revisionOk ? "Révision marketing présente." : "Révision marketing absente.",
  );
  if (!revisionOk) {
    missingInformation.push({
      code: "marketing_revision_missing",
      field: "id",
      message: "Identifiant / révision du Marketing Plan requis.",
      required: true,
    });
  }

  const sameProject = plan.projectId === brief.projectId;
  push(
    "same_project",
    sameProject,
    sameProject
      ? "Brief et plan appartiennent au même projet."
      : "Brief et plan appartiennent à des projets différents.",
  );
  if (!sameProject) {
    missingInformation.push({
      code: "project_mismatch",
      field: "projectId",
      message: "Aligner brief et Marketing Plan sur le même projectId.",
      required: true,
    });
  }

  push(
    "objective_ok",
    Boolean(plan.marketingObjective),
    "Objectif marketing exploitable.",
  );
  push(
    "audience_ok",
    Boolean(plan.primaryAudience?.label && plan.primaryAudience?.description),
    "Audience principale exploitable.",
  );
  if (!plan.primaryAudience?.label) {
    missingInformation.push({
      code: "audience_missing",
      field: "primaryAudience",
      message: "Audience principale manquante dans le plan.",
      required: true,
    });
  }

  push("benefit_ok", Boolean(plan.mainBenefit?.trim()), "Bénéfice principal exploitable.");
  if (!plan.mainBenefit?.trim()) {
    missingInformation.push({
      code: "benefit_missing",
      field: "mainBenefit",
      message: "Bénéfice principal manquant.",
      required: true,
    });
  }

  push("tone_ok", Boolean(plan.tone), "Ton exploitable.");

  const ctaOk = Boolean(plan.callToAction?.trim());
  push("cta_ok", ctaOk, ctaOk ? "CTA exploitable." : "CTA absent du plan marketing.");
  if (!ctaOk) {
    missingInformation.push({
      code: "cta_missing",
      field: "callToAction",
      message: "CTA marketing requis pour démarrer le concept.",
      required: true,
    });
  }

  const durationPlatformOk =
    Boolean(brief.durationSeconds) && Boolean(brief.platform) && Boolean(brief.aspectRatio);
  push(
    "duration_platform_ok",
    durationPlatformOk,
    durationPlatformOk
      ? "Durée et plateforme compatibles."
      : "Durée ou plateforme manquante dans le brief.",
  );

  const constraints = brief.brandConstraints?.trim() ?? "";
  push(
    "brand_constraints",
    true,
    constraints
      ? "Contraintes de marque disponibles."
      : "Aucune contrainte de marque (explicitement absente).",
  );
  if (!constraints) {
    warnings.push({
      code: "no_brand_constraints",
      field: "brandConstraints",
      message: "Aucune contrainte de marque fournie.",
    });
  }

  const assumptionsOk = Array.isArray(plan.assumptions) && plan.assumptions.length > 0;
  push(
    "assumptions_identified",
    assumptionsOk,
    assumptionsOk
      ? "Hypothèses marketing identifiées."
      : "Aucune hypothèse marketing identifiée.",
  );
  if (!assumptionsOk) {
    missingInformation.push({
      code: "assumptions_missing",
      field: "assumptions",
      message: "Les hypothèses du Marketing Plan doivent être explicites.",
      required: true,
    });
  }

  const noLeak = !hasTechnicalLeak(plan);
  push(
    "no_technical_leak",
    noLeak,
    noLeak ? "Pas de fuite technique dans le plan." : "Fuite technique détectée.",
  );

  const claimTexts = [plan.emotionalHook, plan.uniqueSellingPoint, plan.mainBenefit].join(" ");
  const noBlockingClaim = !BLOCKING_UNSOURCED.test(claimTexts);
  push(
    "no_blocking_unsourced_claim",
    noBlockingClaim,
    noBlockingClaim
      ? "Pas d'allégation bloquante non sourcée."
      : "Allégation non sourcée bloquante dans le plan.",
  );
  if (!noBlockingClaim) {
    missingInformation.push({
      code: "unsourced_claim_blocking",
      message: "Corriger les allégations non sourcées du Marketing Plan.",
      required: true,
    });
  }

  const blocking = missingInformation.some((m) => m.required);
  const criticalFailed = checks.some(
    (c) =>
      !c.passed &&
      c.code !== "brand_constraints",
  );
  const executable = schemaOk && !blocking && !criticalFailed && noLeak;

  return { executable, checks, warnings, missingInformation };
}
