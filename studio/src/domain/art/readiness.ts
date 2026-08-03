/**
 * Dry-run readiness for Art Director (no VisualDirection produced).
 */

import type { VideoProjectBrief } from "@/domain/brief";
import { CreativeConceptSchema, type CreativeConcept } from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import { VideoScriptSchema, type VideoScript } from "@/domain/script";
import type { ArtWarning, MissingInformation } from "./errors";
import type { CharacterCapabilitiesSnapshot } from "./runtime-capabilities";
import { CharacterCapabilitiesSnapshotSchema } from "./schemas";

export type ArtReadinessCheckCode =
  | "brief_ok"
  | "marketing_plan_ok"
  | "creative_concept_ok"
  | "video_script_ok"
  | "same_project"
  | "revision_links"
  | "script_complete"
  | "timing_ok"
  | "visual_constraints_ok"
  | "character_snapshot"
  | "assets_ok"
  | "product_refs_ok"
  | "aspect_ratio_ok"
  | "screen_text_composition"
  | "no_technical_leak"
  | "assumptions_ok";

export type ArtReadinessCheck = {
  code: ArtReadinessCheckCode;
  passed: boolean;
  message: string;
};

function hasTechLeak(obj: object): boolean {
  const record = obj as Record<string, unknown>;
  return [
    "provider",
    "modelId",
    "model",
    "prompt",
    "negativePrompt",
    "systemPrompt",
    "costCents",
    "fallback",
  ].some((k) => k in record);
}

export function assessArtReadiness(
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
  script: VideoScript,
  snapshot?: CharacterCapabilitiesSnapshot,
): {
  executable: boolean;
  checks: ArtReadinessCheck[];
  warnings: ArtWarning[];
  missingInformation: MissingInformation[];
} {
  const checks: ArtReadinessCheck[] = [];
  const warnings: ArtWarning[] = [];
  const missingInformation: MissingInformation[] = [];
  const push = (code: ArtReadinessCheckCode, passed: boolean, message: string) => {
    checks.push({ code, passed, message });
  };

  const briefOk = Boolean(brief.id && brief.projectId && brief.aspectRatio);
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

  const scriptOk = VideoScriptSchema.safeParse(script).success;
  push("video_script_ok", scriptOk, scriptOk ? "VideoScript valide." : "VideoScript invalide.");
  if (!scriptOk) {
    missingInformation.push({
      code: "video_script_invalid",
      message: "Video Script invalide.",
      required: true,
    });
  }

  const same =
    brief.projectId === plan.projectId &&
    plan.projectId === concept.projectId &&
    concept.projectId === script.projectId;
  push("same_project", same, same ? "Même projet." : "Projets incompatibles.");
  if (!same) {
    missingInformation.push({
      code: "project_mismatch",
      field: "projectId",
      message: "Aligner brief, plan, concept et script sur le même projet.",
      required: true,
    });
  }

  const linksOk =
    script.creativeConceptRevisionId === concept.id &&
    concept.marketingPlanRevisionId === plan.id &&
    plan.briefRevisionId === brief.id;
  push(
    "revision_links",
    linksOk,
    linksOk ? "Révisions cohérentes." : "Chaîne de révisions incohérente.",
  );
  if (!linksOk) {
    missingInformation.push({
      code: "revision_mismatch",
      message: "Révisions brief → marketing → creative → script incohérentes.",
      required: true,
    });
  }

  const scriptComplete =
    script.segments.length >= 2 &&
    Boolean(script.hook?.text) &&
    Boolean(script.callToAction?.text);
  push(
    "script_complete",
    scriptComplete,
    scriptComplete ? "Script complet." : "Script incomplet.",
  );
  if (!scriptComplete) {
    missingInformation.push({
      code: "script_incomplete",
      message: "Script incomplet pour la direction visuelle.",
      required: true,
    });
  }

  const timingOk =
    script.timing?.status === "within_target" ||
    script.timing?.status === "too_short";
  push(
    "timing_ok",
    timingOk,
    timingOk ? "Timing acceptable." : "Timing script hors plage.",
  );
  if (!timingOk) {
    missingInformation.push({
      code: "timing_invalid",
      field: "timing",
      message: "Corriger le timing du script avant Art Director.",
      required: true,
    });
  }

  const visualOk = Boolean(brief.tone && plan.tone && concept.bigIdea);
  push(
    "visual_constraints_ok",
    visualOk,
    visualOk ? "Contraintes visuelles exploitables." : "Contraintes visuelles insuffisantes.",
  );

  const needsCharacter = Boolean(brief.characterId);
  if (!needsCharacter) {
    push("character_snapshot", true, "Aucun personnage requis.");
    push("assets_ok", true, "Aucun asset personnage requis.");
  } else if (!snapshot) {
    push("character_snapshot", false, "Snapshot Runtime manquant.");
    push("assets_ok", false, "Assets non vérifiables.");
    missingInformation.push({
      code: "character_snapshot_missing",
      field: "characterCapabilities",
      message: "Personnage requis mais snapshot Runtime absent.",
      required: true,
    });
  } else {
    const snapOk = CharacterCapabilitiesSnapshotSchema.safeParse(snapshot).success;
    push(
      "character_snapshot",
      snapOk,
      snapOk ? "Snapshot Runtime valide." : "Snapshot Runtime invalide.",
    );
    if (!snapOk) {
      missingInformation.push({
        code: "character_snapshot_invalid",
        field: "characterCapabilities",
        message: "Snapshot Runtime invalide.",
        required: true,
      });
    }
    const outfitsOk = (snapshot.availableOutfits?.length ?? 0) > 0;
    push(
      "assets_ok",
      outfitsOk,
      outfitsOk ? "Tenues disponibles." : "Aucune tenue dans le snapshot.",
    );
    if (!outfitsOk) {
      missingInformation.push({
        code: "critical_asset_missing",
        field: "characterCapabilities.availableOutfits",
        message: "Au moins une tenue Runtime est requise.",
        required: true,
      });
    }
    if (snapshot.characterId !== brief.characterId) {
      missingInformation.push({
        code: "character_id_mismatch",
        field: "characterCapabilities.characterId",
        message: "characterId snapshot ≠ brief.",
        required: true,
      });
    }
  }

  const hasProduct = brief.mediaReferences?.some(
    (m) => m.kind === "product_screen" || m.kind === "logo",
  );
  push(
    "product_refs_ok",
    true,
    hasProduct ? "Références produit structurées présentes." : "Pas de produit structuré (ok).",
  );
  if (!hasProduct) {
    warnings.push({
      code: "product_ref_absent",
      message: "Aucune référence produit structurée — composition produit limitée.",
    });
  }

  const ratioOk = Boolean(brief.aspectRatio);
  push(
    "aspect_ratio_ok",
    ratioOk,
    ratioOk
      ? `Ratio ${brief.aspectRatio} compatible avec compositions futures.`
      : "Ratio absent.",
  );

  // Dry-run cannot see composition yet — flag screen-text segments that will require it.
  const screenTextSegments = script.segments.filter((s) => Boolean(s.screenText?.trim()));
  if (screenTextSegments.length > 0) {
    push(
      "screen_text_composition",
      true,
      `${screenTextSegments.length} segment(s) avec texte écran — safe areas / hiérarchie obligatoires à l'analyse.`,
    );
    warnings.push({
      code: "screen_text_needs_composition",
      message:
        "Texte écran présent : la direction visuelle devra fournir textSafeArea et hiérarchie (pas seulement la couleur).",
      field: "segments",
    });
    missingInformation.push({
      code: "screen_text_composition_pending",
      field: "composition",
      message:
        "Information de composition (safe area) requise pour le texte écran — non vérifiable avant analyse.",
      required: false,
    });
  } else {
    push("screen_text_composition", true, "Aucun texte écran — composition texte non bloquante.");
  }

  const noLeak =
    !hasTechLeak(brief as object) &&
    !hasTechLeak(plan as object) &&
    !hasTechLeak(concept as object) &&
    !hasTechLeak(script as object);
  push(
    "no_technical_leak",
    noLeak,
    noLeak ? "Pas de prompt/provider/modèle dans les sources." : "Fuite technique détectée.",
  );
  if (!noLeak) {
    missingInformation.push({
      code: "technical_leak",
      message: "Sources contaminées par des champs techniques.",
      required: true,
    });
  }

  const assumptionsOk = (plan.assumptions?.length ?? 0) + (concept.assumptions?.length ?? 0) >= 0;
  push("assumptions_ok", assumptionsOk, "Hypothèses amont identifiées.");
  if ((concept.assumptions ?? []).some((a) => a.status === "unverified")) {
    warnings.push({
      code: "unverified_assumption",
      message: "Des hypothèses créatives non vérifiées restent actives.",
    });
  }

  const requiredMissing = missingInformation.filter((m) => m.required);
  const criticalFailed = checks.some(
    (c) =>
      !c.passed &&
      [
        "brief_ok",
        "marketing_plan_ok",
        "creative_concept_ok",
        "video_script_ok",
        "same_project",
        "revision_links",
        "script_complete",
        "timing_ok",
        "character_snapshot",
        "assets_ok",
        "no_technical_leak",
      ].includes(c.code),
  );

  return {
    executable: requiredMissing.length === 0 && !criticalFailed,
    checks,
    warnings,
    missingInformation,
  };
}
