/**
 * Dry-run readiness for Storyboard Director (no StoryboardProject produced).
 */

import { VisualDirectionSchema, type VisualDirection } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import { CreativeConceptSchema, type CreativeConcept } from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import { VideoScriptSchema, type VideoScript } from "@/domain/script";
import type { MissingInformation, StoryboardWarning } from "./errors";

export type StoryboardReadinessCheckCode =
  | "brief_ok"
  | "marketing_plan_ok"
  | "creative_concept_ok"
  | "video_script_ok"
  | "visual_direction_ok"
  | "same_project"
  | "revision_links"
  | "script_timing_ok"
  | "art_coverage_ok"
  | "assets_ok"
  | "continuity_ok"
  | "aspect_duration_ok"
  | "no_technical_leak";

export type StoryboardReadinessCheck = {
  code: StoryboardReadinessCheckCode;
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

export function assessStoryboardReadiness(
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
  script: VideoScript,
  visual: VisualDirection,
): {
  executable: boolean;
  checks: StoryboardReadinessCheck[];
  warnings: StoryboardWarning[];
  missingInformation: MissingInformation[];
} {
  const checks: StoryboardReadinessCheck[] = [];
  const warnings: StoryboardWarning[] = [];
  const missingInformation: MissingInformation[] = [];
  const push = (code: StoryboardReadinessCheckCode, passed: boolean, message: string) => {
    checks.push({ code, passed, message });
  };

  push("brief_ok", Boolean(brief.id && brief.projectId), brief.id ? "Brief présent." : "Brief incomplet.");

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

  const visualOk = VisualDirectionSchema.safeParse(visual).success;
  push(
    "visual_direction_ok",
    visualOk,
    visualOk ? "VisualDirection valide." : "VisualDirection invalide.",
  );
  if (!visualOk) {
    missingInformation.push({
      code: "visual_direction_invalid",
      message: "Visual Direction invalide.",
      required: true,
    });
  }

  const same =
    brief.projectId === plan.projectId &&
    plan.projectId === concept.projectId &&
    concept.projectId === script.projectId &&
    script.projectId === visual.projectId;
  push("same_project", same, same ? "Même projet." : "Projets incompatibles.");
  if (!same) {
    missingInformation.push({
      code: "project_mismatch",
      field: "projectId",
      message: "Aligner toute la chaîne sur le même projet.",
      required: true,
    });
  }

  const linksOk =
    visual.videoScriptRevisionId === script.id &&
    visual.creativeConceptRevisionId === concept.id &&
    script.creativeConceptRevisionId === concept.id &&
    concept.marketingPlanRevisionId === plan.id &&
    plan.briefRevisionId === brief.id;
  push(
    "revision_links",
    linksOk,
    linksOk ? "Chaîne de révisions cohérente." : "Chaîne de révisions incorrecte.",
  );
  if (!linksOk) {
    missingInformation.push({
      code: "revision_mismatch",
      message: "Révisions brief→…→script→art incohérentes.",
      required: true,
    });
  }

  const timingOk =
    script.timing?.status === "within_target" || script.timing?.status === "too_short";
  push(
    "script_timing_ok",
    timingOk,
    timingOk ? "Timing script acceptable." : "Timing script invalide.",
  );
  if (!timingOk) {
    missingInformation.push({
      code: "script_timing_invalid",
      field: "timing",
      message: "Corriger le timing du script avant Storyboard.",
      required: true,
    });
  }

  const scriptIds = new Set(script.segments.map((s) => s.id));
  const covered = new Set(visual.segments.map((s) => s.scriptSegmentId));
  const artCoverage =
    script.segments.length === visual.segments.length &&
    [...scriptIds].every((id) => covered.has(id));
  push(
    "art_coverage_ok",
    artCoverage,
    artCoverage ? "Direction visuelle couvre tous les segments." : "Couverture Art incomplète.",
  );
  if (!artCoverage) {
    missingInformation.push({
      code: "art_coverage_incomplete",
      field: "visualDirection.segments",
      message: "VisualDirection ne couvre pas tous les segments du script.",
      required: true,
    });
  }

  const needsCharacter = Boolean(brief.characterId);
  const hasCharacterAssets = visual.segments.some((s) => s.character?.outfitId);
  const assetsOk = !needsCharacter || hasCharacterAssets;
  push(
    "assets_ok",
    assetsOk,
    assetsOk ? "Assets essentiels présents ou non requis." : "Asset personnage essentiel absent.",
  );
  if (!assetsOk) {
    missingInformation.push({
      code: "critical_asset_missing",
      field: "visualDirection.segments.character",
      message: "Personnage requis sans tenue dans VisualDirection.",
      required: true,
    });
  }

  const continuityOk = (visual.continuityRules?.length ?? 0) >= 0;
  push(
    "continuity_ok",
    continuityOk,
    visual.continuityRules.length
      ? "Règles de continuité exploitables."
      : "Aucune règle de continuité (ok).",
  );

  const aspectDurationOk = Boolean(brief.aspectRatio && script.targetDurationSeconds);
  push(
    "aspect_duration_ok",
    aspectDurationOk,
    aspectDurationOk
      ? `Ratio ${brief.aspectRatio} / ${script.targetDurationSeconds}s supportés.`
      : "Ratio ou durée absents.",
  );

  const noLeak =
    !hasTechLeak(brief as object) &&
    !hasTechLeak(plan as object) &&
    !hasTechLeak(concept as object) &&
    !hasTechLeak(script as object) &&
    !hasTechLeak(visual as object);
  push(
    "no_technical_leak",
    noLeak,
    noLeak ? "Pas de fuite prompt/provider/modèle/coût." : "Fuite technique détectée.",
  );
  if (!noLeak) {
    missingInformation.push({
      code: "technical_leak",
      message: "Sources contaminées par des champs techniques.",
      required: true,
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
        "visual_direction_ok",
        "same_project",
        "revision_links",
        "script_timing_ok",
        "art_coverage_ok",
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
