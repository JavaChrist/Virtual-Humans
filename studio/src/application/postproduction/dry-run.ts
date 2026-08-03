/**
 * Postproduction dry-run — no merge, no destination, no fabricated assets.
 */

import type { BriefAspectRatio } from "@/domain/brief";
import type { ScenePackage } from "@/domain/prompt";
import {
  migrateProductionResultToV11,
  type ProductionResult,
} from "@/domain/production";
import type { StoryboardProject } from "@/domain/storyboard";
import {
  buildMergePlan,
  evaluateFinalQuality,
  isPostProductionDomainError,
  validateMergePlanAgainstCapabilities,
  type FinalQualityReport,
  type MergePlan,
  type PostProductionValidation,
  type PostProductionWarning,
} from "@/domain/postproduction";
import { AICCOS_MAX_BYTES } from "@/infrastructure/export/aiccos";
import { mapMergePlanToFalComposeInput } from "./map-merge-plan";
import type { ExportDestinationAdapter, MergeEngine } from "./ports";

export type PostProductionDryRunResult = {
  executable: boolean;
  providerCalled: false;
  quality: FinalQualityReport;
  mergePlan?: MergePlan;
  validations: PostProductionValidation[];
  warnings: PostProductionWarning[];
  exportReady: boolean;
  blockingReasons: string[];
};

export type PostProductionDryRunInput = {
  productionResult: ProductionResult;
  storyboard: StoryboardProject;
  scenePackages: ScenePackage[];
  aspectRatio: BriefAspectRatio;
  mergeEngine: MergeEngine;
  /** Optional AICCOS destination — never called (providerCalled false). */
  aiccosExport?: ExportDestinationAdapter | null;
  allowPartial?: boolean;
  at: string;
};

export function runPostProductionDryRun(
  input: PostProductionDryRunInput
): PostProductionDryRunResult {
  const validations: PostProductionValidation[] = [];
  const warnings: PostProductionWarning[] = [];
  const blockingReasons: string[] = [];
  let executable = true;

  const push = (code: string, passed: boolean, message: string) => {
    validations.push({ code, passed, message });
    if (!passed) {
      executable = false;
      blockingReasons.push(message);
    }
  };

  const result = migrateProductionResultToV11(input.productionResult, input.at);

  const terminal =
    result.status === "completed" || result.status === "partial";
  push(
    "terminal_result",
    terminal,
    terminal
      ? "ProductionResult terminal pour postproduction."
      : `Statut d'exécution non livrable: ${result.status}`
  );

  const quality = evaluateFinalQuality({
    productionResult: result,
    storyboard: input.storyboard,
    scenePackages: input.scenePackages,
    nowIso: input.at,
    allowPartial: input.allowPartial ?? result.status === "partial",
  });

  push(
    "quality_not_rejected",
    quality.status !== "rejected",
    quality.status === "rejected"
      ? "Qualité refusée — merge bloqué."
      : `Qualité: ${quality.status}`
  );

  if (quality.status === "needs_review") {
    warnings.push({
      code: "needs_review",
      message: "Revue humaine requise — export automatique bloqué.",
    });
  }

  const built = buildMergePlan({
    id: "dry-run-merge-plan",
    productionResult: result,
    storyboard: input.storyboard,
    scenePackages: input.scenePackages,
    aspectRatio: input.aspectRatio,
    createdAt: input.at,
    nowIso: input.at,
  });

  let mergePlan: MergePlan | undefined;
  if (!built.ok) {
    for (const e of built.errors) {
      push(e.code, false, e.message);
    }
  } else {
    mergePlan = built.plan;
    push("merge_plan", true, "MergePlan construit.");
    for (const w of built.warnings) {
      if (w.startsWith("overlay_unsupported:")) {
        warnings.push({
          code: "overlay_unsupported",
          message: `Texte postproduction projeté mais non exécutable: ${w.split(":")[1]}`,
          sceneId: w.split(":")[1],
        });
        push(
          "overlay_executable",
          false,
          "Overlays postproduction non supportés par l'engine — exportReady false."
        );
      } else {
        warnings.push({ code: "merge_plan_warning", message: w });
      }
    }

    const capVal = validateMergePlanAgainstCapabilities(
      mergePlan,
      input.mergeEngine.capabilities
    );
    for (const issue of capVal.issues) {
      push(issue.code, !issue.blocking, issue.message);
    }
    for (const w of capVal.warnings) {
      warnings.push({ code: w.code, message: w.message });
    }

    if (!input.mergeEngine.capabilities.executionEnabled) {
      push(
        "merge_adapter_absent",
        false,
        "MergeEngine non configuré (stub) — merge_adapter_not_configured."
      );
    } else {
      push("merge_adapter_configured", true, "Adapter merge configuré (exécution activée).");
      push(
        "polling_available",
        input.mergeEngine.capabilities.asyncSubmitPoll &&
          typeof input.mergeEngine.poll === "function",
        input.mergeEngine.poll
          ? "Polling disponible."
          : "Polling non exposé sur l'engine."
      );
      try {
        mapMergePlanToFalComposeInput(mergePlan, input.at);
        push("plan_fal_mappable", true, "MergePlan compatible fal compose.");
      } catch (e) {
        push(
          "plan_fal_mappable",
          false,
          isPostProductionDomainError(e) ? e.publicMessage : "Plan incompatible fal compose."
        );
      }
    }
  }

  // AICCOS destination dry checks — only when explicitly provided; never calls pipeline
  if (input.aiccosExport !== undefined) {
    if (input.aiccosExport == null) {
      push(
        "aiccos_adapter_absent",
        false,
        "Adapter AICCOS absent (stub / non fourni)."
      );
    } else if (input.aiccosExport.destinationId !== "aiccos") {
      push(
        "aiccos_adapter_configured",
        false,
        "Destination fournie n'est pas aiccos."
      );
    } else {
      push("aiccos_adapter_configured", true, "Adapter AICCOS configuré.");
      push(
        "aiccos_pipeline_configured",
        true,
        "Pipeline AICCOS injectable présent (non appelé en dry-run)."
      );
      if (quality.status === "rejected") {
        push("aiccos_quality", false, "Qualité refusée — export AICCOS bloqué.");
      } else if (quality.status === "needs_review") {
        push("aiccos_quality", false, "Revue humaine requise avant export AICCOS.");
      } else {
        push("aiccos_quality", true, "Qualité acceptable pour export.");
      }
    }
  }

  // Force exportReady false when overlays unsupported, quality review, or merge stub
  const finalExportReady =
    executable &&
    quality.status === "accepted" &&
    built.ok &&
    !!mergePlan &&
    input.mergeEngine.capabilities.executionEnabled &&
    !warnings.some((w) => w.code === "overlay_unsupported") &&
    !(built.ok ? built.warnings : []).some((w) => w.startsWith("overlay_unsupported:"));

  return {
    executable: executable && quality.status !== "rejected",
    providerCalled: false,
    quality,
    mergePlan,
    validations,
    warnings,
    exportReady: finalExportReady,
    blockingReasons,
  };
}

/** Pure dry checks on a hypothetical final asset for AICCOS (no I/O). */
export function dryCheckAiccosFinalAsset(input: {
  sizeBytes?: number;
  mimeType?: string;
  sourceKind?: string;
  expiresAt?: string;
  at: string;
}): PostProductionValidation[] {
  const out: PostProductionValidation[] = [];
  if (input.sizeBytes == null) {
    out.push({
      code: "aiccos_size_unknown",
      passed: true,
      message: "Taille asset inconnue — warning uniquement.",
    });
  } else if (input.sizeBytes > AICCOS_MAX_BYTES) {
    out.push({
      code: "aiccos_size",
      passed: false,
      message: "Vidéo trop lourde pour AICCOS (max 50 Mo).",
    });
  } else {
    out.push({
      code: "aiccos_size",
      passed: true,
      message: "Taille sous la limite AICCOS.",
    });
  }

  const mime = input.mimeType ?? "";
  if (mime && !mime.startsWith("video/")) {
    out.push({
      code: "aiccos_mime",
      passed: false,
      message: "MIME non vidéo.",
    });
  } else {
    out.push({
      code: "aiccos_mime",
      passed: true,
      message: mime ? `MIME: ${mime}` : "MIME inconnu — fallback historique video/mp4 possible.",
    });
  }

  if (input.expiresAt && Date.parse(input.expiresAt) <= Date.parse(input.at)) {
    out.push({
      code: "aiccos_source_expired",
      passed: false,
      message: "Source expirée.",
    });
  } else {
    out.push({
      code: "aiccos_source_fresh",
      passed: true,
      message: "Source non expirée (ou sans expiry).",
    });
  }

  return out;
}
