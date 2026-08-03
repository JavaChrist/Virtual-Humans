/**
 * Scene run aggregate (serializable).
 */

import type { Money } from "@/domain/cost";
import type { GeneratedAsset } from "@/domain/generation";
import type { ProductionAttempt } from "./attempts";
import type { ProductionWarning } from "./errors";
import type { StepRunStatus } from "./step-run";

export const SCENE_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "skipped",
] as const;

export type SceneRunStatus = (typeof SCENE_RUN_STATUSES)[number];

export type StepRun = {
  stepId: string;
  sceneId: string;
  order: number;
  status: StepRunStatus;
  dependsOnStepIds: string[];
  attempts: ProductionAttempt[];
  outputAssets: GeneratedAsset[];
  estimatedCost: Money;
  committedCost: Money;
  warnings: ProductionWarning[];
  activeAttemptId?: string;
  updatedAt: string;
};

export type SceneRun = {
  sceneId: string;
  sceneOrder: number;
  status: SceneRunStatus;
  steps: StepRun[];
  outputAssets: GeneratedAsset[];
  estimatedCost: Money;
  committedCost: Money;
  warnings: ProductionWarning[];
  updatedAt: string;
};

export function deriveSceneStatus(steps: readonly StepRun[]): SceneRunStatus {
  if (steps.length === 0) return "skipped";
  if (steps.every((s) => s.status === "completed")) return "completed";
  if (steps.every((s) => s.status === "cancelled")) return "cancelled";
  if (steps.every((s) => s.status === "skipped" || s.status === "cancelled")) return "skipped";
  if (
    steps.some((s) => s.status === "failed") &&
    steps.every(
      (s) =>
        s.status === "completed" ||
        s.status === "failed" ||
        s.status === "cancelled" ||
        s.status === "skipped"
    )
  ) {
    return "failed";
  }
  if (
    steps.some(
      (s) =>
        s.status === "ready" ||
        s.status === "reserved" ||
        s.status === "executing" ||
        s.status === "submitted" ||
        s.status === "polling" ||
        s.status === "validating" ||
        s.status === "fallback_ready" ||
        s.status === "pending"
    )
  ) {
    return "running";
  }
  return "pending";
}
