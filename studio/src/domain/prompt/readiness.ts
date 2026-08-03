/**
 * Dry-run readiness for Prompt Director (no ScenePackage produced).
 */

import { VisualDirectionSchema, type VisualDirection } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import { CreativeConceptSchema, type CreativeConcept } from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import { VideoScriptSchema, type VideoScript } from "@/domain/script";
import {
  StoryboardProjectSchema,
  type StoryboardProject,
} from "@/domain/storyboard";
import { profilesForProductionIntent } from "./capability-profiles";
import { findConstraintContradictions } from "./constraints";
import { buildBlocksForScene } from "./builders";
import type { MissingInformation, PromptWarning } from "./errors";
import { findingsToIssues, scanUntrustedText } from "./injection-safety";

export type PromptReadinessCheckCode =
  | "brief_ok"
  | "chain_ok"
  | "same_project"
  | "revision_links"
  | "storyboard_ok"
  | "references_ok"
  | "blocks_ok"
  | "profiles_ok"
  | "constraints_ok"
  | "injection_ok"
  | "no_technical_leak";

export type PromptReadinessCheck = {
  code: PromptReadinessCheckCode;
  passed: boolean;
  message: string;
};

function hasTechLeak(obj: object): boolean {
  const record = obj as Record<string, unknown>;
  return ["provider", "modelId", "model", "costCents", "fallback", "generationPlan"].some(
    (k) => k in record,
  );
}

export function assessPromptReadiness(
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
  script: VideoScript,
  visual: VisualDirection,
  storyboard: StoryboardProject,
): {
  executable: boolean;
  checks: PromptReadinessCheck[];
  warnings: PromptWarning[];
  missingInformation: MissingInformation[];
} {
  const checks: PromptReadinessCheck[] = [];
  const warnings: PromptWarning[] = [];
  const missingInformation: MissingInformation[] = [];
  const push = (code: PromptReadinessCheckCode, passed: boolean, message: string) => {
    checks.push({ code, passed, message });
  };

  const briefOk = Boolean(brief.id && brief.projectId);
  push("brief_ok", briefOk, briefOk ? "Brief présent." : "Brief incomplet.");

  const chainOk =
    MarketingPlanSchema.safeParse(plan).success &&
    CreativeConceptSchema.safeParse(concept).success &&
    VideoScriptSchema.safeParse(script).success &&
    VisualDirectionSchema.safeParse(visual).success;
  push("chain_ok", chainOk, chainOk ? "Chaîne amont valide." : "Chaîne amont invalide.");
  if (!chainOk) {
    missingInformation.push({
      code: "chain_invalid",
      message: "Artifacts amont invalides.",
      required: true,
    });
  }

  const same =
    brief.projectId === plan.projectId &&
    plan.projectId === concept.projectId &&
    concept.projectId === script.projectId &&
    script.projectId === visual.projectId &&
    visual.projectId === storyboard.projectId;
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
    storyboard.visualDirectionRevisionId === visual.id &&
    storyboard.videoScriptRevisionId === script.id &&
    visual.videoScriptRevisionId === script.id &&
    script.creativeConceptRevisionId === concept.id &&
    concept.marketingPlanRevisionId === plan.id &&
    plan.briefRevisionId === brief.id;
  push(
    "revision_links",
    linksOk,
    linksOk ? "Révisions cohérentes." : "Révisions incohérentes.",
  );
  if (!linksOk) {
    missingInformation.push({
      code: "revision_mismatch",
      message: "Chaîne de révisions incorrecte.",
      required: true,
    });
  }

  const sbOk = StoryboardProjectSchema.safeParse(storyboard).success;
  push("storyboard_ok", sbOk, sbOk ? "Storyboard valide." : "Storyboard invalide.");
  if (!sbOk) {
    missingInformation.push({
      code: "storyboard_invalid",
      message: "Storyboard invalide.",
      required: true,
    });
  }

  let refsOk = true;
  for (const sc of storyboard.scenes) {
    for (const ref of sc.references.filter((r) => r.required)) {
      if (!ref.sourceId) {
        refsOk = false;
        missingInformation.push({
          code: "reference_unavailable",
          field: `scenes.${sc.id}.references`,
          message: `Référence absente: ${ref.kind}`,
          required: true,
        });
      }
    }
  }
  push("references_ok", refsOk, refsOk ? "Références présentes." : "Référence absente.");

  let blocksOk = true;
  let constraintsOk = true;
  try {
    for (const scene of storyboard.scenes) {
      const blocks = buildBlocksForScene({
        scene,
        brief,
        plan,
        script,
        visual,
        storyboard,
      });
      if (!blocks.subject.description || !blocks.action.primaryAction) blocksOk = false;
      if (findConstraintContradictions(blocks.constraints).length) {
        constraintsOk = false;
        missingInformation.push({
          code: "constraint_contradiction",
          field: `scenes.${scene.id}.constraints`,
          message: "Contraintes contradictoires.",
          required: true,
        });
      }
    }
  } catch {
    blocksOk = false;
  }
  push("blocks_ok", blocksOk, blocksOk ? "Blocs reconstructibles." : "Blocs incomplets.");
  push(
    "constraints_ok",
    constraintsOk,
    constraintsOk ? "Contraintes cohérentes." : "Contraintes contradictoires.",
  );

  let profilesOk = true;
  for (const scene of storyboard.scenes) {
    if (profilesForProductionIntent(scene.productionIntent).length === 0) {
      profilesOk = false;
    }
  }
  push(
    "profiles_ok",
    profilesOk,
    profilesOk ? "Profils abstraits déterminables." : "Profils indéterminables.",
  );

  const inj = findingsToIssues([
    ...scanUntrustedText(brief.subjectDescription, "brief.subjectDescription"),
    ...scanUntrustedText(brief.brandConstraints, "brief.brandConstraints"),
  ]);
  const injectionOk = inj.issues.length === 0;
  push(
    "injection_ok",
    injectionOk,
    injectionOk ? "Pas d'injection bloquante." : "Injection bloquante.",
  );
  if (!injectionOk) {
    missingInformation.push({
      code: "injection_blocked",
      message: "Contenu non fiable bloquant dans les sources.",
      required: true,
    });
  }
  warnings.push(...inj.warnings);

  const noLeak =
    !hasTechLeak(brief as object) &&
    !hasTechLeak(plan as object) &&
    !hasTechLeak(storyboard as object);
  push(
    "no_technical_leak",
    noLeak,
    noLeak ? "Pas de provider/model/coût/fallback." : "Fuite technique.",
  );
  if (!noLeak) {
    missingInformation.push({
      code: "technical_leak",
      message: "Sources contaminées.",
      required: true,
    });
  }

  const requiredMissing = missingInformation.filter((m) => m.required);
  const criticalFailed = checks.some(
    (c) =>
      !c.passed &&
      [
        "brief_ok",
        "chain_ok",
        "same_project",
        "revision_links",
        "storyboard_ok",
        "references_ok",
        "blocks_ok",
        "profiles_ok",
        "constraints_ok",
        "injection_ok",
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
