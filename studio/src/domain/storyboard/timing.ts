/**
 * Deterministic storyboard duration allocator (VHS-105).
 * Candidate durations are never authoritative.
 *
 * Convention:
 * - Precision: 0.01 s
 * - Sum of scene durations === targetDurationSeconds exactly after controlled rounding
 * - Residual from rounding assigned to the last scene (deterministic)
 * - Transition durations are editorial metadata and are NOT added to the sum
 * - Spoken scenes must be ≥ estimated spoken duration of their fragment
 */

import type { BriefDurationSeconds } from "@/domain/brief";
import {
  countWords,
  estimateSpokenDuration,
  normalizeLanguageTag,
  resolveSpeechTimingProfile,
} from "@/domain/script";
import type { VideoScript } from "@/domain/script";
import type { StoryboardWarning } from "./errors";
import type { SceneSpokenContent } from "./scene";
import { RECOMMENDED_SCENE_RANGES } from "./storyboard-project";

export const STORYBOARD_TIMING_PRECISION = 0.01 as const;
export const MIN_SCENE_DURATION_SECONDS = 0.5 as const;

export type StoryboardSceneTiming = {
  sceneId: string;
  order: number;
  scriptSegmentId: string;
  durationSeconds: number;
  minimumSpokenSeconds: number;
};

export type StoryboardTimingWarning = {
  code: string;
  message: string;
  field?: string;
};

export type StoryboardTimingReport = {
  targetDurationSeconds: number;
  totalSceneDurationSeconds: number;
  differenceSeconds: number;
  precisionSeconds: number;
  status: "exact" | "invalid";
  sceneTimings: StoryboardSceneTiming[];
  warnings: StoryboardTimingWarning[];
};

export type SceneTimingInput = {
  id: string;
  order: number;
  scriptSegmentId: string;
  spokenContent: SceneSpokenContent;
  /** Untrusted proposal from candidate. */
  proposedDurationSeconds?: number;
};

function spokenText(content: SceneSpokenContent): string {
  if (content.kind === "dialogue" || content.kind === "voice_over") {
    return content.sourceText;
  }
  return "";
}

export function estimateSceneSpokenMinimum(
  content: SceneSpokenContent,
  language: string,
): number {
  const text = spokenText(content);
  if (!text.trim()) return MIN_SCENE_DURATION_SECONDS;
  const { profile } = resolveSpeechTimingProfile(normalizeLanguageTag(language));
  const est = estimateSpokenDuration(text, profile);
  return Math.max(MIN_SCENE_DURATION_SECONDS, est.seconds);
}

function roundToPrecision(value: number): number {
  return Math.round(value / STORYBOARD_TIMING_PRECISION) * STORYBOARD_TIMING_PRECISION;
}

/**
 * Allocate scene durations so they sum exactly to target.
 * Uses script segment timings as proportional weights (scaled to target).
 */
export function allocateStoryboardDurations(
  scenes: SceneTimingInput[],
  script: VideoScript,
): StoryboardTimingReport {
  const warnings: StoryboardTimingWarning[] = [];
  const target = script.targetDurationSeconds;
  const language = script.language;
  const sorted = [...scenes].sort((a, b) => a.order - b.order);

  if (sorted.length === 0) {
    return {
      targetDurationSeconds: target,
      totalSceneDurationSeconds: 0,
      differenceSeconds: target,
      precisionSeconds: STORYBOARD_TIMING_PRECISION,
      status: "invalid",
      sceneTimings: [],
      warnings: [{ code: "no_scenes", message: "Aucune scène à allouer." }],
    };
  }

  const segmentWeight = new Map<string, number>();
  for (const st of script.timing.segmentTimings) {
    segmentWeight.set(st.segmentId, Math.max(st.totalDurationSeconds, 0.01));
  }
  // Fallback equal weight for unknown segments
  for (const sc of sorted) {
    if (!segmentWeight.has(sc.scriptSegmentId)) {
      segmentWeight.set(sc.scriptSegmentId, 1);
    }
  }

  const mins = sorted.map((sc) => estimateSceneSpokenMinimum(sc.spokenContent, language));
  const minSum = mins.reduce((a, b) => a + b, 0);
  if (minSum > target + 1e-9) {
    return {
      targetDurationSeconds: target,
      totalSceneDurationSeconds: minSum,
      differenceSeconds: roundToPrecision(minSum - target),
      precisionSeconds: STORYBOARD_TIMING_PRECISION,
      status: "invalid",
      sceneTimings: sorted.map((sc, i) => ({
        sceneId: sc.id,
        order: sc.order,
        scriptSegmentId: sc.scriptSegmentId,
        durationSeconds: mins[i]!,
        minimumSpokenSeconds: mins[i]!,
      })),
      warnings: [
        {
          code: "spoken_exceeds_target",
          message: `Durée orale minimale (${minSum.toFixed(2)}s) > cible (${target}s).`,
        },
      ],
    };
  }

  // Group scenes by segment to distribute segment budget
  const bySegment = new Map<string, number[]>();
  sorted.forEach((sc, i) => {
    const list = bySegment.get(sc.scriptSegmentId) ?? [];
    list.push(i);
    bySegment.set(sc.scriptSegmentId, list);
  });

  const totalSegWeight = [...bySegment.keys()].reduce(
    (acc, sid) => acc + (segmentWeight.get(sid) ?? 1),
    0,
  );

  const raw: number[] = new Array(sorted.length).fill(0);
  for (const [sid, indices] of bySegment) {
    const segBudget = (target * (segmentWeight.get(sid) ?? 1)) / totalSegWeight;
    const segMins = indices.reduce((a, i) => a + mins[i]!, 0);
    const flexible = Math.max(segBudget - segMins, 0);

    // Prefer proposed durations if they respect mins and scale into budget
    const proposals = indices.map((i) => {
      const p = sorted[i]!.proposedDurationSeconds;
      if (typeof p === "number" && Number.isFinite(p) && p > 0) {
        return Math.max(p, mins[i]!);
      }
      return null;
    });
    const allProposed = proposals.every((p) => p != null);
    if (allProposed) {
      const propSum = proposals.reduce((a, p) => a + (p as number), 0);
      const scale = segBudget / propSum;
      indices.forEach((i, j) => {
        raw[i] = Math.max(mins[i]!, (proposals[j] as number) * scale);
      });
    } else {
      // Equal split of flexible remainder after mins
      const extraEach = flexible / indices.length;
      indices.forEach((i) => {
        raw[i] = mins[i]! + extraEach;
      });
    }
    void segMins;
  }

  // Scale all to exact target (handle float drift before rounding)
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const scaled = raw.map((v, i) => Math.max(mins[i]!, (v / rawSum) * target));

  // Round to precision; last scene absorbs residual
  const rounded = scaled.map((v) => roundToPrecision(v));
  for (let i = 0; i < rounded.length; i++) {
    if (rounded[i]! < mins[i]!) rounded[i] = roundToPrecision(mins[i]!);
  }
  let sumRounded = roundToPrecision(rounded.reduce((a, b) => a + b, 0));
  const residual = roundToPrecision(target - sumRounded);
  const last = rounded.length - 1;
  rounded[last] = roundToPrecision(rounded[last]! + residual);
  if (rounded[last]! < mins[last]!) {
    // Steal from earlier scenes with slack
    let need = roundToPrecision(mins[last]! - rounded[last]!);
    rounded[last] = mins[last]!;
    for (let i = last - 1; i >= 0 && need > 0; i--) {
      const slack = roundToPrecision(rounded[i]! - mins[i]!);
      if (slack <= 0) continue;
      const take = Math.min(slack, need);
      rounded[i] = roundToPrecision(rounded[i]! - take);
      need = roundToPrecision(need - take);
    }
    if (need > 0) {
      warnings.push({
        code: "residual_unallocated",
        message: "Impossible d'attribuer le résidu sans violer les minima oraux.",
      });
    }
  }

  sumRounded = roundToPrecision(rounded.reduce((a, b) => a + b, 0));
  const diff = roundToPrecision(sumRounded - target);
  const status = Math.abs(diff) < STORYBOARD_TIMING_PRECISION / 2 ? "exact" : "invalid";
  if (status !== "exact") {
    warnings.push({
      code: "sum_not_exact",
      message: `Somme ${sumRounded} ≠ cible ${target}.`,
    });
  }

  // Reject negatives / zeros
  for (let i = 0; i < rounded.length; i++) {
    if (!(rounded[i]! > 0)) {
      warnings.push({
        code: "non_positive_duration",
        message: `Durée non positive pour scène ${sorted[i]!.id}.`,
        field: `scenes.${sorted[i]!.id}`,
      });
    }
  }

  const sceneTimings: StoryboardSceneTiming[] = sorted.map((sc, i) => ({
    sceneId: sc.id,
    order: sc.order,
    scriptSegmentId: sc.scriptSegmentId,
    durationSeconds: rounded[i]!,
    minimumSpokenSeconds: mins[i]!,
  }));

  return {
    targetDurationSeconds: target,
    totalSceneDurationSeconds: sumRounded,
    differenceSeconds: diff,
    precisionSeconds: STORYBOARD_TIMING_PRECISION,
    status: status === "exact" && sceneTimings.every((t) => t.durationSeconds > 0) ? "exact" : "invalid",
    sceneTimings,
    warnings,
  };
}

export function assessRecommendedSceneCount(
  sceneCount: number,
  duration: BriefDurationSeconds,
  justification?: string,
): StoryboardWarning[] {
  const range = RECOMMENDED_SCENE_RANGES[duration];
  if (!range) return [];
  if (sceneCount >= range.min && sceneCount <= range.max) return [];
  if (justification?.trim()) {
    return [
      {
        code: "scene_count_outside_range_justified",
        message: `${sceneCount} scènes hors plage recommandée ${range.min}–${range.max} pour ${duration}s (justifié).`,
        field: "scenes",
      },
    ];
  }
  return [
    {
      code: "scene_count_outside_range",
      message: `${sceneCount} scènes hors plage recommandée ${range.min}–${range.max} pour ${duration}s.`,
      field: "scenes",
    },
  ];
}

export function spokenWordCount(content: SceneSpokenContent): number {
  return countWords(spokenText(content));
}
