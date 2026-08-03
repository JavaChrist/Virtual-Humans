/**
 * Provider-agnostic MergePlan (VHS-111).
 */

import type { BriefAspectRatio } from "@/domain/brief";
import type { GeneratedAssetSource } from "@/domain/generation";
import type { MergeTransitionKind } from "./merge-capabilities";
import { MERGE_POLICY_VERSION } from "./merge-capabilities";
import { PostProductionDomainError } from "./errors";

export const MERGE_PLAN_SCHEMA_VERSION = "1.0.0" as const;

export type MergeOutputContract = {
  kind: "video";
  container: "mp4";
  /** Optional — historical routes do not guarantee these. */
  videoCodec?: "h264";
  audioCodec?: "aac";
  aspectRatio: BriefAspectRatio;
  width?: number;
  height?: number;
  frameRate?: number;
};

export type TimelineItem = {
  sceneId: string;
  order: number;
  assetId: string;
  source: GeneratedAssetSource;
  startSeconds: number;
  durationSeconds: number;
  trim?: {
    startSeconds: number;
    endSeconds: number;
  };
};

export type MergeTransition = {
  fromSceneId: string;
  toSceneId: string;
  kind: MergeTransitionKind;
  durationSeconds: number;
};

export type AudioTrackRole =
  | "dialogue"
  | "voice_over"
  | "music"
  | "ambiance"
  | "embedded_video";

export type AudioTrackPlan = {
  id: string;
  role: AudioTrackRole;
  assetId?: string;
  /** embedded_video uses timeline scene asset */
  fromSceneId?: string;
  startSeconds: number;
  durationSeconds: number;
  /** Capability unknown unless engine declares support */
  gainDb?: number;
};

export type AudioMixPlan = {
  tracks: AudioTrackPlan[];
  /** Never claim applied unless engine supports LUFS. */
  targetLoudnessLufs?: number;
  preventClipping: boolean;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  /** How historical merge would treat embedded audio. */
  preserveEmbeddedAudio: boolean;
};

export type TextOverlayPlan = {
  kind: "text";
  sceneId: string;
  text: string;
  startSeconds: number;
  durationSeconds: number;
  safeAreaRequired: boolean;
  /** Canonical style token — no invented fonts. */
  style: "default_safe";
  source: "scene_package_screen_text";
};

export type ImageOverlayPlan = {
  kind: "image";
  sceneId: string;
  assetId: string;
  startSeconds: number;
  durationSeconds: number;
  source: "artifact";
};

export type OverlayPlan = TextOverlayPlan | ImageOverlayPlan;

export type MergePlan = {
  id: string;
  projectId: string;
  productionRunId: string;
  productionResultRevisionId: string;
  storyboardRevisionId: string;
  schemaVersion: typeof MERGE_PLAN_SCHEMA_VERSION;
  output: MergeOutputContract;
  timeline: TimelineItem[];
  audio: AudioMixPlan;
  transitions: MergeTransition[];
  overlays: OverlayPlan[];
  estimatedDurationSeconds: number;
  policyVersion: string;
  createdAt: string;
};

export function freezeMergePlan(plan: MergePlan): MergePlan {
  return Object.freeze(JSON.parse(JSON.stringify(plan)) as MergePlan);
}

export function assertTimelineDeterministic(plan: MergePlan): void {
  let expectedStart = 0;
  for (const item of [...plan.timeline].sort((a, b) => a.order - b.order)) {
    if (Math.abs(item.startSeconds - expectedStart) > 1e-9) {
      throw new PostProductionDomainError(
        "invalid_plan",
        `Start non déterministe pour ${item.sceneId}.`
      );
    }
    if (item.durationSeconds <= 0) {
      throw new PostProductionDomainError("duration_mismatch", "Durée timeline invalide.");
    }
    if (item.trim) {
      if (
        item.trim.startSeconds < 0 ||
        item.trim.endSeconds <= item.trim.startSeconds
      ) {
        throw new PostProductionDomainError("invalid_plan", "Trim invalide.");
      }
    }
    expectedStart += item.durationSeconds;
  }
  if (Math.abs(expectedStart - plan.estimatedDurationSeconds) > 1e-6) {
    throw new PostProductionDomainError(
      "duration_mismatch",
      "Somme des durées ≠ estimatedDurationSeconds."
    );
  }
}

export function defaultMergeOutput(aspectRatio: BriefAspectRatio): MergeOutputContract {
  return { kind: "video", container: "mp4", aspectRatio };
}

export { MERGE_POLICY_VERSION };
