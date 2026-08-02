/**
 * Pure readiness checks for a VideoProjectBrief before marketing analysis.
 * Used by application dry-run — never invents a MarketingPlan.
 */

import {
  DurationValues,
  ObjectiveValues,
  PlatformValues,
  ToneValues,
  type VideoProjectBrief,
} from "@/domain/brief";
import type { MissingInformation, MarketingWarning } from "./errors";
import { ctaTokensForObjective, foldCtaText } from "./marketing-plan";

export type MarketingReadinessCheckCode =
  | "brief_schema"
  | "objective_supported"
  | "audience_described"
  | "subject_clear"
  | "cta_present"
  | "brand_constraints"
  | "media_references"
  | "language_ok"
  | "platform_ok"
  | "tone_ok"
  | "duration_ok"
  | "no_technical_leak";

export type MarketingReadinessCheck = {
  code: MarketingReadinessCheckCode;
  passed: boolean;
  message: string;
};

/** Entire description is a placeholder — not merely starting with a common noun. */
const VAGUE_SUBJECT_ONLY =
  /^(produit|service|application|app|truc|test|todo|tbd|n\/a|na)(\s+\w+){0,3}$/i;

function hasTechnicalLeakKeys(brief: VideoProjectBrief): boolean {
  const record = brief as unknown as Record<string, unknown>;
  for (const key of ["provider", "modelId", "model", "prompt", "systemPrompt"]) {
    if (key in record) return true;
  }
  return false;
}

/**
 * Assess whether a brief is ready for a future marketing analysis.
 * Does not produce marketing content.
 */
export function assessMarketingBriefReadiness(brief: VideoProjectBrief): {
  executable: boolean;
  checks: MarketingReadinessCheck[];
  warnings: MarketingWarning[];
  missingInformation: MissingInformation[];
} {
  const checks: MarketingReadinessCheck[] = [];
  const warnings: MarketingWarning[] = [];
  const missingInformation: MissingInformation[] = [];

  const push = (code: MarketingReadinessCheckCode, passed: boolean, message: string) => {
    checks.push({ code, passed, message });
  };

  // Structural presence (caller should pass a finalized brief)
  const structurallyOk =
    Boolean(brief.id) &&
    Boolean(brief.projectId) &&
    Boolean(brief.subjectName?.trim()) &&
    Boolean(brief.subjectDescription?.trim()) &&
    Boolean(brief.objective);
  push(
    "brief_schema",
    structurallyOk,
    structurallyOk ? "Brief structurellement présent." : "Brief incomplet ou non finalisé.",
  );
  if (!structurallyOk) {
    missingInformation.push({
      code: "brief_incomplete",
      message: "Le brief doit être finalisé avant l'analyse marketing.",
      required: true,
    });
  }

  const objectiveOk = (ObjectiveValues as readonly string[]).includes(brief.objective);
  push("objective_supported", objectiveOk, "Objectif marketing supporté.");

  const audienceText = brief.audienceDescription?.trim() ?? "";
  const audienceOk = audienceText.length >= 12;
  push(
    "audience_described",
    audienceOk,
    audienceOk
      ? "Audience suffisamment décrite."
      : "Audience absente ou trop courte.",
  );
  if (!audienceOk) {
    missingInformation.push({
      code: "audience_missing",
      field: "audienceDescription",
      message: "Décrire l'audience principale (besoins / contexte).",
      required: true,
    });
  }

  const subjectClear =
    brief.subjectName.trim().length >= 2 &&
    brief.subjectDescription.trim().length >= 24 &&
    !VAGUE_SUBJECT_ONLY.test(brief.subjectDescription.trim());
  push(
    "subject_clear",
    subjectClear,
    subjectClear
      ? "Sujet et proposition compréhensibles."
      : "Sujet ou description trop vagues.",
  );
  if (!subjectClear) {
    missingInformation.push({
      code: "subject_vague",
      field: "subjectDescription",
      message: "Préciser le sujet et la proposition de valeur.",
      required: true,
    });
  }

  const cta = brief.callToAction?.trim() ?? "";
  const ctaRequired =
    brief.objective === "conversion" ||
    brief.objective === "lead_generation" ||
    brief.objective === "traffic";
  const ctaOk = cta.length > 0;
  const foldedCta = foldCtaText(cta);
  const ctaCompatible =
    !ctaOk || ctaTokensForObjective(brief.objective).some((t) => foldedCta.includes(t));

  if (ctaRequired) {
    push(
      "cta_present",
      ctaOk && ctaCompatible,
      ctaOk
        ? ctaCompatible
          ? "CTA présent et cohérent."
          : "CTA présent mais peu compatible avec l'objectif."
        : "CTA requis pour cet objectif.",
    );
    if (!ctaOk) {
      missingInformation.push({
        code: "cta_missing",
        field: "callToAction",
        message: "Ajouter un appel à l'action compatible avec l'objectif.",
        required: true,
      });
    } else if (!ctaCompatible) {
      warnings.push({
        code: "cta_weak_for_objective",
        field: "callToAction",
        message: "Le CTA semble peu aligné avec l'objectif.",
      });
    }
  } else {
    push(
      "cta_present",
      true,
      ctaOk ? "CTA optionnel présent." : "CTA optionnel absent (acceptable pour cet objectif).",
    );
    if (!ctaOk) {
      missingInformation.push({
        code: "cta_optional_missing",
        field: "callToAction",
        message: "Un CTA clarifierait le message (optionnel).",
        required: false,
      });
    }
  }

  const constraints = brief.brandConstraints?.trim() ?? "";
  push(
    "brand_constraints",
    true,
    constraints
      ? "Contraintes de marque présentes."
      : "Aucune contrainte de marque (acceptable).",
  );
  if (!constraints) {
    warnings.push({
      code: "no_brand_constraints",
      field: "brandConstraints",
      message: "Aucune contrainte de marque fournie.",
    });
  }

  let mediaOk = true;
  for (const m of brief.mediaReferences) {
    if (!m.id || !m.label || !m.kind) {
      mediaOk = false;
      break;
    }
    if (m.uri && (/^data:/i.test(m.uri) || /^blob:/i.test(m.uri))) {
      mediaOk = false;
      break;
    }
  }
  push(
    "media_references",
    mediaOk,
    mediaOk
      ? "Références média structurées (ou absentes)."
      : "Référence média invalide (binaire ou champs manquants).",
  );
  if (!mediaOk) {
    missingInformation.push({
      code: "media_invalid",
      field: "mediaReferences",
      message: "Corriger les références média (pas de data/blob URI).",
      required: true,
    });
  }

  const languageOk = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(brief.language);
  push("language_ok", languageOk, languageOk ? "Langue normalisée." : "Langue invalide.");

  const platformOk = (PlatformValues as readonly string[]).includes(brief.platform);
  push("platform_ok", platformOk, platformOk ? "Plateforme supportée." : "Plateforme non supportée.");

  const toneOk = (ToneValues as readonly string[]).includes(brief.tone);
  push("tone_ok", toneOk, toneOk ? "Ton supporté." : "Ton non supporté.");

  const durationOk = (DurationValues as readonly number[]).includes(brief.durationSeconds);
  push("duration_ok", durationOk, durationOk ? "Durée supportée." : "Durée non supportée.");

  const noLeak = !hasTechnicalLeakKeys(brief);
  push(
    "no_technical_leak",
    noLeak,
    noLeak
      ? "Pas de paramètre technique interdit dans le brief."
      : "Paramètres techniques interdits détectés.",
  );

  const blockingMissing = missingInformation.some((m) => m.required);
  const criticalFailed = checks.some(
    (c) =>
      !c.passed &&
      (c.code === "brief_schema" ||
        c.code === "subject_clear" ||
        c.code === "audience_described" ||
        c.code === "cta_present" ||
        c.code === "media_references" ||
        c.code === "language_ok" ||
        c.code === "platform_ok" ||
        c.code === "tone_ok" ||
        c.code === "duration_ok" ||
        c.code === "no_technical_leak"),
  );

  // For non-cta-required objectives, cta_present always passes — audience/subject still block
  const executable = structurallyOk && !blockingMissing && !criticalFailed && noLeak;

  return { executable, checks, warnings, missingInformation };
}
