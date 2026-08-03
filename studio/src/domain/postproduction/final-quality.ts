/**
 * Pure extended quality evaluation against ProductionResult + Storyboard + packages.
 */

import type { GeneratedAsset } from "@/domain/generation";
import type { ScenePackage } from "@/domain/prompt";
import type {
  ProductionResult,
  SceneProductionResult,
} from "@/domain/production";
import type { StoryboardProject } from "@/domain/storyboard";
import {
  deriveQualityStatus,
  finalizeQualityReport,
  FINAL_QUALITY_VALIDATOR_VERSION,
  type FinalQualityReport,
  type QualityCheck,
  type QualityIssue,
  type QualityWarning,
} from "./quality-report";

export type FinalQualityInput = {
  productionResult: ProductionResult;
  storyboard: StoryboardProject;
  scenePackages: ScenePackage[];
  nowIso: string;
  /** When false, partial execution blocks contractual coverage. */
  allowPartial: boolean;
};

function sourceUsable(asset: GeneratedAsset, nowIso: string): {
  present: boolean;
  expired: boolean;
} {
  const s = asset.source;
  if (s.kind === "temporary_external") {
    const expired = Date.parse(s.expiresAt) <= Date.parse(nowIso);
    return { present: Boolean(s.url) && s.url !== "[redacted]", expired };
  }
  if (s.kind === "inline_data_url") {
    return { present: Boolean(s.dataUrl) && s.dataUrl !== "[redacted]", expired: false };
  }
  return { present: Boolean(s.storagePath), expired: false };
}

function primaryAsset(scene: SceneProductionResult): GeneratedAsset | undefined {
  return scene.outputAssets[0] ?? scene.steps.flatMap((s) => s.outputAssets)[0];
}

export function evaluateFinalQuality(input: FinalQualityInput): FinalQualityReport {
  const { productionResult, storyboard, scenePackages, nowIso, allowPartial } = input;
  const technicalChecks: QualityCheck[] = [];
  const contractualChecks: QualityCheck[] = [];
  const editorialChecks: QualityCheck[] = [];
  const blockingIssues: QualityIssue[] = [];
  const warnings: QualityWarning[] = [];

  const pushT = (c: Omit<QualityCheck, "layer">) =>
    technicalChecks.push({ ...c, layer: "technical" });
  const pushC = (c: Omit<QualityCheck, "layer">) =>
    contractualChecks.push({ ...c, layer: "contractual" });
  const pushE = (c: Omit<QualityCheck, "layer">) =>
    editorialChecks.push({ ...c, layer: "editorial" });

  // --- Terminal execution ---
  const terminal =
    productionResult.status === "completed" ||
    productionResult.status === "partial" ||
    productionResult.status === "failed" ||
    productionResult.status === "cancelled";
  pushC({
    code: "execution_terminal",
    passed: terminal,
    outcome: terminal ? "pass" : "fail",
    detail: productionResult.status,
  });
  if (!terminal) {
    blockingIssues.push({
      code: "execution_not_terminal",
      message: "ProductionResult non terminal.",
      blocking: true,
      layer: "contractual",
    });
  }

  if (productionResult.status === "partial" && !allowPartial) {
    pushC({
      code: "partial_allowed",
      passed: false,
      outcome: "fail",
    });
    blockingIssues.push({
      code: "partial_not_allowed",
      message: "Résultat partiel non autorisé.",
      blocking: true,
      layer: "contractual",
    });
  } else {
    pushC({
      code: "partial_allowed",
      passed: true,
      outcome: "pass",
      detail: productionResult.status,
    });
  }

  const sbScenes = [...storyboard.scenes].sort((a, b) => a.order - b.order);
  const prScenes = [...productionResult.scenes].sort((a, b) => a.sceneOrder - b.sceneOrder);
  const prById = new Map(prScenes.map((s) => [s.sceneId, s]));
  const sbIds = new Set(sbScenes.map((s) => s.id));

  // Foreign scenes
  for (const s of prScenes) {
    if (!sbIds.has(s.sceneId)) {
      pushC({
        code: "foreign_scene",
        passed: false,
        outcome: "fail",
        detail: s.sceneId,
      });
      blockingIssues.push({
        code: "foreign_scene",
        message: `Scène étrangère: ${s.sceneId}`,
        blocking: true,
        layer: "contractual",
        sceneId: s.sceneId,
      });
    }
  }

  // Order
  const orderOk = prScenes.every((s, i) => {
    const sb = sbScenes.find((x) => x.id === s.sceneId);
    return !sb || sb.order === s.sceneOrder || sbScenes[i]?.id === s.sceneId;
  });
  // Stricter: completed scenes follow storyboard order among themselves
  const completedOrdered = prScenes
    .filter((s) => s.status === "completed")
    .map((s) => s.sceneId);
  const expectedOrder = sbScenes.map((s) => s.id).filter((id) => completedOrdered.includes(id));
  const orderMatch =
    completedOrdered.length === expectedOrder.length &&
    completedOrdered.every((id, i) => id === expectedOrder[i]);
  pushC({
    code: "scene_order",
    passed: orderMatch,
    outcome: orderMatch ? "pass" : "fail",
  });
  if (!orderMatch) {
    blockingIssues.push({
      code: "scene_order",
      message: "Ordre des scènes incorrect.",
      blocking: true,
      layer: "contractual",
    });
  }
  void orderOk;

  // Coverage + CTA
  let hasCta = false;
  for (const sb of sbScenes) {
    if (sb.purpose === "cta") hasCta = true;
    const pr = prById.get(sb.id);
    const required = true;
    if (!pr) {
      pushC({
        code: "scene_coverage",
        passed: false,
        outcome: allowPartial ? "needs_review" : "fail",
        detail: sb.id,
      });
      if (!allowPartial) {
        blockingIssues.push({
          code: "missing_scene",
          message: `Scène absente: ${sb.id}`,
          blocking: true,
          layer: "contractual",
          sceneId: sb.id,
        });
      }
      continue;
    }
    if (required && pr.status !== "completed" && !allowPartial) {
      pushC({
        code: "scene_completed",
        passed: false,
        outcome: "fail",
        detail: sb.id,
      });
      blockingIssues.push({
        code: "scene_not_completed",
        message: `Scène non complétée: ${sb.id}`,
        blocking: true,
        layer: "contractual",
        sceneId: sb.id,
      });
    } else if (pr.status === "completed") {
      pushC({
        code: "scene_completed",
        passed: true,
        outcome: "pass",
        detail: sb.id,
      });
    }
  }
  pushC({
    code: "cta_present",
    passed: hasCta,
    outcome: hasCta ? "pass" : "fail",
  });
  if (!hasCta) {
    blockingIssues.push({
      code: "cta_missing",
      message: "Scène CTA absente du Storyboard.",
      blocking: true,
      layer: "contractual",
    });
  }

  // Technical per completed scene
  for (const scene of prScenes.filter((s) => s.status === "completed")) {
    const asset = primaryAsset(scene);
    if (!asset) {
      pushT({
        code: "asset_present",
        passed: false,
        outcome: "fail",
        detail: scene.sceneId,
      });
      blockingIssues.push({
        code: "asset_absent",
        message: `Asset absent: ${scene.sceneId}`,
        blocking: true,
        layer: "technical",
        sceneId: scene.sceneId,
      });
      continue;
    }
    pushT({ code: "asset_present", passed: true, outcome: "pass", detail: scene.sceneId });

    const { present, expired } = sourceUsable(asset, nowIso);
    pushT({
      code: "source_accessible",
      passed: present && !expired,
      outcome: !present ? "fail" : expired ? "fail" : "pass",
    });
    if (!present) {
      blockingIssues.push({
        code: "missing_asset",
        message: "Source absente.",
        blocking: true,
        layer: "technical",
        sceneId: scene.sceneId,
      });
    }
    if (expired) {
      blockingIssues.push({
        code: "source_expired",
        message: "Source expirée.",
        blocking: true,
        layer: "technical",
        sceneId: scene.sceneId,
      });
    }

    const mimeOk = typeof asset.mimeType === "string" && asset.mimeType.includes("/");
    const videoMime =
      asset.kind === "video" || asset.kind === "lipsync" || asset.kind === "carousel"
        ? asset.mimeType.startsWith("video/")
        : true;
    pushT({
      code: "mime_allowed",
      passed: mimeOk && videoMime,
      outcome: mimeOk && videoMime ? "pass" : "fail",
      detail: asset.mimeType,
    });
    if (!mimeOk || !videoMime) {
      blockingIssues.push({
        code: "invalid_mime",
        message: "MIME invalide.",
        blocking: true,
        layer: "technical",
        sceneId: scene.sceneId,
      });
    }

    if (asset.sizeBytes === 0) {
      pushT({ code: "non_empty", passed: false, outcome: "fail" });
      blockingIssues.push({
        code: "empty_file",
        message: "Fichier vide.",
        blocking: true,
        layer: "technical",
        sceneId: scene.sceneId,
      });
    } else if (asset.sizeBytes == null) {
      pushT({ code: "non_empty", passed: false, outcome: "unknown", detail: "size unknown" });
    } else {
      pushT({ code: "non_empty", passed: true, outcome: "pass" });
    }

    const sb = sbScenes.find((s) => s.id === scene.sceneId);
    if (asset.durationSeconds == null) {
      pushT({ code: "duration_present", passed: false, outcome: "needs_review" });
      warnings.push({
        code: "duration_missing",
        message: "Durée absente — revue.",
        sceneId: scene.sceneId,
      });
    } else {
      pushT({
        code: "duration_present",
        passed: true,
        outcome: "pass",
        detail: String(asset.durationSeconds),
      });
      if (sb && Math.abs(asset.durationSeconds - sb.durationSeconds) > sb.durationSeconds * 0.5 + 0.5) {
        pushC({
          code: "duration_vs_storyboard",
          passed: false,
          outcome: "needs_review",
          detail: scene.sceneId,
        });
      } else {
        pushC({
          code: "duration_vs_storyboard",
          passed: true,
          outcome: "pass",
          detail: scene.sceneId,
        });
      }
    }

    if (asset.width == null || asset.height == null) {
      pushT({ code: "dimensions", passed: false, outcome: "unknown" });
      warnings.push({
        code: "dimensions_unknown",
        message: "Dimensions inconnues.",
        sceneId: scene.sceneId,
      });
    } else {
      pushT({
        code: "dimensions",
        passed: true,
        outcome: "pass",
        detail: `${asset.width}x${asset.height}`,
      });
    }

    // Codec — unknown without probe
    pushT({
      code: "codec_compatibility",
      passed: false,
      outcome: "unknown",
      detail: "no codec metadata",
    });

    // Audio track presence when talking_head / lipsync intent — unknown without probe
    const needsAudio =
      sb?.productionIntent === "talking_head" ||
      sb?.productionIntent === "voice_over_visual";
    if (needsAudio) {
      pushT({
        code: "audio_track_present",
        passed: false,
        outcome: "unknown",
        detail: "cannot probe embedded audio",
      });
    }

    // Provenance
    const hasAttempt = scene.steps.some((st) => st.attempts.length > 0);
    pushC({
      code: "provenance",
      passed: hasAttempt,
      outcome: hasAttempt ? "pass" : "fail",
      detail: scene.sceneId,
    });
    if (!hasAttempt) {
      blockingIssues.push({
        code: "provenance_missing",
        message: "Provenance absente.",
        blocking: true,
        layer: "contractual",
        sceneId: scene.sceneId,
      });
    }
  }

  // Editorial — deterministic coverage only
  const purposes = new Set(sbScenes.map((s) => s.purpose));
  for (const p of ["hook", "problem", "proof", "cta"] as const) {
    const ok = purposes.has(p);
    pushE({
      code: `coverage_${p}`,
      passed: ok,
      outcome: ok ? "pass" : "needs_review",
    });
  }

  const durationSum = sbScenes.reduce((a, s) => a + s.durationSeconds, 0);
  const targetOk = Math.abs(durationSum - storyboard.durationSeconds) < 0.05;
  pushE({
    code: "duration_sum",
    passed: targetOk,
    outcome: targetOk ? "pass" : "fail",
    detail: `${durationSum} vs ${storyboard.durationSeconds}`,
  });

  // Continuity / safe areas — declarative only
  pushE({
    code: "continuity_declared",
    passed: true,
    outcome: "pass",
    detail: "storyboard continuity rules present as metadata",
  });

  for (const pkg of scenePackages) {
    if (pkg.screenText?.safeAreaRequired) {
      const ok = pkg.composition.textSafeArea !== "none";
      pushE({
        code: "safe_area_declared",
        passed: ok,
        outcome: ok ? "pass" : "needs_review",
        detail: pkg.sceneId,
      });
    }
  }

  // Visual quality — never invent
  pushE({
    code: "visual_identity",
    passed: false,
    outcome: "unknown",
    detail: "requires human review — not measured",
  });
  pushE({
    code: "lip_sync_quality",
    passed: false,
    outcome: "unknown",
    detail: "requires human review — not measured",
  });

  const status = deriveQualityStatus(
    [...technicalChecks, ...contractualChecks, ...editorialChecks],
    blockingIssues
  );

  return finalizeQualityReport({
    status,
    technicalChecks,
    contractualChecks,
    editorialChecks,
    blockingIssues,
    warnings,
    reviewedAt: nowIso,
    validatorVersion: FINAL_QUALITY_VALIDATOR_VERSION,
  });
}
