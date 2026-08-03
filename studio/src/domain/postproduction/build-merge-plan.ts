/**
 * Deterministic MergePlan builder from ProductionResult + Storyboard + packages.
 */

import type { BriefAspectRatio } from "@/domain/brief";
import type { ScenePackage } from "@/domain/prompt";
import type { ProductionResult } from "@/domain/production";
import type { StoryboardProject } from "@/domain/storyboard";
import { PostProductionDomainError } from "./errors";
import {
  FAL_COMPOSE_DECLARED_CAPABILITIES,
  type MergeEngineCapabilities,
  type MergeTransitionKind,
} from "./merge-capabilities";
import {
  assertTimelineDeterministic,
  defaultMergeOutput,
  freezeMergePlan,
  MERGE_PLAN_SCHEMA_VERSION,
  MERGE_POLICY_VERSION,
  type AudioMixPlan,
  type MergePlan,
  type MergeTransition,
  type OverlayPlan,
  type TimelineItem,
} from "./merge-plan";

export type BuildMergePlanInput = {
  id: string;
  productionResult: ProductionResult;
  storyboard: StoryboardProject;
  scenePackages: ScenePackage[];
  aspectRatio: BriefAspectRatio;
  createdAt: string;
  nowIso: string;
  preserveEmbeddedAudio?: boolean;
  capabilities?: MergeEngineCapabilities;
};

export type BuildMergePlanResult =
  | { ok: true; plan: MergePlan; warnings: string[] }
  | { ok: false; errors: { code: string; message: string }[]; warnings: string[] };

function isSourceExpired(
  source: TimelineItem["source"],
  nowIso: string
): boolean {
  if (source.kind === "temporary_external") {
    return Date.parse(source.expiresAt) <= Date.parse(nowIso);
  }
  return false;
}

export function buildMergePlan(input: BuildMergePlanInput): BuildMergePlanResult {
  const errors: { code: string; message: string }[] = [];
  const warnings: string[] = [];
  const caps = input.capabilities ?? FAL_COMPOSE_DECLARED_CAPABILITIES;
  const sbScenes = [...input.storyboard.scenes].sort((a, b) => a.order - b.order);
  const prById = new Map(input.productionResult.scenes.map((s) => [s.sceneId, s]));
  const pkgById = new Map(input.scenePackages.map((p) => [p.sceneId, p]));

  const timeline: TimelineItem[] = [];
  let cursor = 0;
  let order = 1;

  for (const sb of sbScenes) {
    const pr = prById.get(sb.id);
    if (!pr || pr.status !== "completed") {
      if (input.productionResult.status === "partial") {
        warnings.push(`scene_skipped:${sb.id}`);
        continue;
      }
      errors.push({ code: "missing_asset", message: `Scène manquante ou incomplète: ${sb.id}` });
      continue;
    }
    const asset =
      pr.outputAssets[0] ?? pr.steps.flatMap((st) => st.outputAssets)[0];
    if (!asset) {
      errors.push({ code: "missing_asset", message: `Asset manquant: ${sb.id}` });
      continue;
    }
    if (isSourceExpired(asset.source, input.nowIso)) {
      errors.push({ code: "expired_asset", message: `Source expirée: ${sb.id}` });
      continue;
    }
    const duration = asset.durationSeconds ?? sb.durationSeconds;
    timeline.push({
      sceneId: sb.id,
      order: order++,
      assetId: asset.id,
      source: asset.source,
      startSeconds: cursor,
      durationSeconds: duration,
    });
    cursor += duration;
  }

  if (timeline.length < 1) {
    errors.push({ code: "invalid_plan", message: "Timeline vide." });
  }

  // Transitions from storyboard — adjacent only
  const transitions: MergeTransition[] = [];
  for (let i = 0; i < timeline.length - 1; i++) {
    const from = timeline[i]!;
    const to = timeline[i + 1]!;
    const sbFrom = sbScenes.find((s) => s.id === from.sceneId);
    const kind = (sbFrom?.transition.type ?? "cut") as MergeTransitionKind;
    const durationSeconds = sbFrom?.transition.durationSeconds ?? 0;

    if (kind !== "cut" && kind !== "none") {
      if (!caps.supportedTransitions.includes(kind)) {
        errors.push({
          code: "unsupported_transition",
          message: `Transition non supportée: ${kind} (${from.sceneId}→${to.sceneId}).`,
        });
      }
    }
    transitions.push({
      fromSceneId: from.sceneId,
      toSceneId: to.sceneId,
      kind,
      durationSeconds: Math.min(Math.max(0, durationSeconds), 1),
    });
  }

  // Overlays from post_production screen text
  const overlays: OverlayPlan[] = [];
  for (const item of timeline) {
    const pkg = pkgById.get(item.sceneId);
    if (pkg?.screenText?.renderMode === "post_production") {
      overlays.push({
        kind: "text",
        sceneId: item.sceneId,
        text: pkg.screenText.text,
        startSeconds: item.startSeconds,
        durationSeconds: item.durationSeconds,
        safeAreaRequired: pkg.screenText.safeAreaRequired,
        style: "default_safe",
        source: "scene_package_screen_text",
      });
      if (!caps.postProductionText) {
        warnings.push(`overlay_unsupported:${item.sceneId}`);
      }
    }
  }

  const preserve = input.preserveEmbeddedAudio !== false;
  const audio: AudioMixPlan = {
    tracks: timeline.map((t, i) => ({
      id: `embedded-${i}`,
      role: "embedded_video" as const,
      fromSceneId: t.sceneId,
      startSeconds: t.startSeconds,
      durationSeconds: t.durationSeconds,
    })),
    preventClipping: true,
    preserveEmbeddedAudio: preserve,
  };

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const plan = freezeMergePlan({
    id: input.id,
    projectId: input.productionResult.projectId,
    productionRunId: input.productionResult.manifest.runId,
    productionResultRevisionId: input.productionResult.id,
    storyboardRevisionId: input.storyboard.id,
    schemaVersion: MERGE_PLAN_SCHEMA_VERSION,
    output: defaultMergeOutput(input.aspectRatio),
    timeline,
    audio,
    transitions,
    overlays,
    estimatedDurationSeconds: cursor,
    policyVersion: MERGE_POLICY_VERSION,
    createdAt: input.createdAt,
  });

  try {
    assertTimelineDeterministic(plan);
  } catch (e) {
    if (e instanceof PostProductionDomainError) {
      return {
        ok: false,
        errors: [{ code: e.code, message: e.publicMessage }],
        warnings,
      };
    }
    throw e;
  }

  return { ok: true, plan, warnings };
}
