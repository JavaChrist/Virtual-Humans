/**
 * Pure step scheduler — dependency-aware, deterministic, bounded parallelism.
 */

import type { GenerationPlan } from "@/domain/routing/router/generation-plan";
import { ProductionDomainError } from "./errors";
import type { ProductionPolicy } from "./policy";
import type { ProductionRun } from "./production-run";
import { isActiveStepStatus, isFailedDefinitely } from "./step-run";
import type { StepRun } from "./scene-run";

export type ReadyStep = {
  sceneId: string;
  sceneOrder: number;
  stepId: string;
  order: number;
  reason: "deps_satisfied" | "fallback_ready";
};

function stepById(run: ProductionRun): Map<string, StepRun> {
  const map = new Map<string, StepRun>();
  for (const scene of run.scenes) {
    for (const step of scene.steps) {
      map.set(step.stepId, step);
    }
  }
  return map;
}

function detectCycle(plan: GenerationPlan): void {
  const deps = new Map<string, string[]>();
  for (const scene of plan.scenePlans) {
    for (const step of scene.steps) {
      deps.set(step.id, [...step.dependsOnStepIds]);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new ProductionDomainError("invalid_input", `Cycle de dépendances détecté: ${id}.`);
    }
    visiting.add(id);
    for (const d of deps.get(id) ?? []) visit(d);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of deps.keys()) visit(id);
}

/**
 * Mark steps whose dependency failed permanently as candidates for skip
 * (caller applies transition). Returns step IDs to skip.
 */
export function findStepsToSkip(run: ProductionRun): string[] {
  const byId = stepById(run);
  const toSkip: string[] = [];
  for (const scene of run.scenes) {
    if (scene.status === "skipped" || scene.status === "cancelled") continue;
    for (const step of scene.steps) {
      if (step.status !== "pending" && step.status !== "ready" && step.status !== "fallback_ready") {
        continue;
      }
      const depFailed = step.dependsOnStepIds.some((id) => {
        const dep = byId.get(id);
        return !dep || isFailedDefinitely(dep.status);
      });
      if (depFailed) toSkip.push(step.stepId);
    }
  }
  return toSkip;
}

export function findReadySteps(
  run: ProductionRun,
  plan: GenerationPlan,
  policy: ProductionPolicy
): ReadyStep[] {
  detectCycle(plan);

  if (run.status === "cancelling" || run.status === "cancelled") {
    return [];
  }

  const byId = stepById(run);
  const activeSteps = [...byId.values()].filter((s) => isActiveStepStatus(s.status)).length;
  const slots = Math.max(0, policy.maxConcurrentSteps - activeSteps);
  if (slots === 0) return [];

  const failedScenes = new Set(
    run.scenes.filter((s) => s.status === "failed").map((s) => s.sceneId)
  );
  const activeScenes = new Set(
    run.scenes
      .filter((s) => s.status === "running")
      .map((s) => s.sceneId)
  );

  const candidates: ReadyStep[] = [];

  const scenesSorted = [...run.scenes].sort((a, b) => a.sceneOrder - b.sceneOrder);

  for (const scene of scenesSorted) {
    if (scene.status === "completed" || scene.status === "skipped" || scene.status === "cancelled") {
      continue;
    }
    if (policy.stopProjectOnSceneFailure && failedScenes.size > 0 && !failedScenes.has(scene.sceneId)) {
      // Don't start new scenes after a definitive scene failure.
      const sceneHasActiveOrDone = scene.steps.some(
        (s) => s.status !== "pending" && s.status !== "ready"
      );
      if (!sceneHasActiveOrDone) continue;
    }

    const wouldStartNewScene =
      !activeScenes.has(scene.sceneId) &&
      scene.steps.every((s) => s.status === "pending" || s.status === "ready");
    if (
      wouldStartNewScene &&
      activeScenes.size >= policy.maxConcurrentScenes &&
      !scene.steps.some((s) => isActiveStepStatus(s.status) || s.status === "completed")
    ) {
      continue;
    }

    const stepsSorted = [...scene.steps].sort((a, b) => a.order - b.order);
    for (const step of stepsSorted) {
      if (step.status === "fallback_ready") {
        candidates.push({
          sceneId: scene.sceneId,
          sceneOrder: scene.sceneOrder,
          stepId: step.stepId,
          order: step.order,
          reason: "fallback_ready",
        });
        continue;
      }
      if (step.status !== "pending" && step.status !== "ready") continue;

      const depsOk = step.dependsOnStepIds.every((id) => {
        const dep = byId.get(id);
        return dep?.status === "completed";
      });
      if (!depsOk) continue;

      const depFailed = step.dependsOnStepIds.some((id) => {
        const dep = byId.get(id);
        return !dep || isFailedDefinitely(dep.status);
      });
      if (depFailed) continue;

      candidates.push({
        sceneId: scene.sceneId,
        sceneOrder: scene.sceneOrder,
        stepId: step.stepId,
        order: step.order,
        reason: "deps_satisfied",
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.sceneOrder !== b.sceneOrder) return a.sceneOrder - b.sceneOrder;
    return a.order - b.order;
  });

  // Bound by remaining slots; prefer not launching same step twice (already filtered by status).
  const selected: ReadyStep[] = [];
  const selectedScenes = new Set(activeScenes);
  for (const c of candidates) {
    if (selected.length >= slots) break;
    if (
      !selectedScenes.has(c.sceneId) &&
      selectedScenes.size >= policy.maxConcurrentScenes &&
      !run.scenes.find((s) => s.sceneId === c.sceneId)?.steps.some((s) => isActiveStepStatus(s.status))
    ) {
      continue;
    }
    selected.push(c);
    selectedScenes.add(c.sceneId);
  }
  return selected;
}
