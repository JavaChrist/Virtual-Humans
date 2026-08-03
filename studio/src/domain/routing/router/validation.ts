/**
 * GenerationPlan validation (VHS-108).
 */

import { addMoney, money, type Money } from "@/domain/cost";
import type { ScenePackage } from "@/domain/prompt";
import type { StoryboardProject } from "@/domain/storyboard";
import { RoutingDomainError } from "./errors";
import type { GenerationPlan, GenerationStep } from "./generation-plan";
import { getStrategy } from "./strategy-library";

export type RoutingValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

function issue(code: string, message: string, path?: string): RoutingValidationIssue {
  return { code, message, path };
}

function hasCycle(steps: GenerationStep[]): boolean {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string): boolean => {
    if (done.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);
    const step = byId.get(id);
    if (!step) return false;
    for (const dep of step.dependsOnStepIds) {
      if (visit(dep)) return true;
    }
    visiting.delete(id);
    done.add(id);
    return false;
  };
  return steps.some((s) => visit(s.id));
}

export function validateGenerationPlan(input: {
  plan: GenerationPlan;
  storyboard: StoryboardProject;
  scenePackages: ScenePackage[];
}): RoutingValidationIssue[] {
  const issues: RoutingValidationIssue[] = [];
  const { plan, storyboard, scenePackages } = input;

  if (plan.storyboardRevisionId !== storyboard.id) {
    issues.push(issue("revision_mismatch", "storyboardRevisionId mismatch.", "storyboardRevisionId"));
  }
  if (plan.projectId !== storyboard.projectId) {
    issues.push(issue("project_mismatch", "projectId mismatch.", "projectId"));
  }

  const scenes = [...storyboard.scenes].sort((a, b) => a.order - b.order);
  const plans = [...plan.scenePlans].sort((a, b) => a.sceneOrder - b.sceneOrder);

  if (plans.length !== scenes.length) {
    issues.push(issue("coverage", "Scene plan count differs from storyboard.", "scenePlans"));
  }

  const pkgByScene = new Map(scenePackages.map((p) => [p.sceneId, p]));
  const planByScene = new Map(plans.map((p) => [p.sceneId, p]));

  for (const sc of scenes) {
    if (!planByScene.has(sc.id)) {
      issues.push(issue("missing_scene", "Missing scene plan.", sc.id));
    }
    if (!pkgByScene.has(sc.id)) {
      issues.push(issue("missing_package", "Missing scene package.", sc.id));
    }
  }
  for (const p of plans) {
    if (!scenes.some((s) => s.id === p.sceneId)) {
      issues.push(issue("extra_scene", "Extra scene plan.", p.sceneId));
    }
  }

  const allStepIds = new Set<string>();
  let costSum = money(0, plan.currency);

  for (const sp of plans) {
    try {
      getStrategy(sp.strategy);
    } catch {
      issues.push(issue("unknown_strategy", "Unknown strategy.", sp.sceneId));
    }

    const orders = sp.steps.map((s) => s.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        issues.push(issue("step_order", "Non-contiguous step orders.", sp.sceneId));
        break;
      }
    }

    if (hasCycle(sp.steps)) {
      issues.push(issue("cycle", "Dependency cycle detected.", sp.sceneId));
    }

    for (const step of sp.steps) {
      if (allStepIds.has(step.id)) {
        issues.push(issue("duplicate_step_id", "Duplicate step id.", step.id));
      }
      allStepIds.add(step.id);

      for (const dep of step.dependsOnStepIds) {
        const depStep = sp.steps.find((s) => s.id === dep);
        if (!depStep) {
          issues.push(issue("missing_dep", "Unknown dependency.", step.id));
        } else if (depStep.order >= step.order) {
          issues.push(issue("future_dep", "Dependency on non-prior step.", step.id));
        }
      }

      if (step.fallbacks.length > 2) {
        issues.push(issue("fallback_max", "More than two fallbacks.", step.id));
      }
      const fbKeys = new Set<string>();
      for (const fb of step.fallbacks) {
        const k = `${fb.providerId}::${fb.modelId}`;
        if (k === `${step.providerId}::${step.modelId}`) {
          issues.push(issue("fallback_same", "Fallback equals primary.", step.id));
        }
        if (fbKeys.has(k)) {
          issues.push(issue("fallback_dup", "Duplicate fallback.", step.id));
        }
        fbKeys.add(k);
      }

      if (step.estimate.total.currency !== plan.currency) {
        issues.push(issue("currency", "Step estimate currency mismatch.", step.id));
      }
    }

    let sceneSum = money(0, plan.currency);
    for (const step of sp.steps) {
      sceneSum = addMoney(sceneSum, step.estimate.total);
    }
    if (sceneSum.amountMinor !== sp.estimatedCost.amountMinor) {
      issues.push(issue("scene_cost", "Scene cost mismatch.", sp.sceneId));
    }
    costSum = addMoney(costSum, sceneSum);
  }

  if (costSum.amountMinor !== plan.estimatedCost.amountMinor) {
    issues.push(issue("plan_cost", "Plan cost mismatch.", "estimatedCost"));
  }

  if (plan.budgetDecision.allowed) {
    if (plan.budgetDecision.estimated.amountMinor !== plan.estimatedCost.amountMinor) {
      issues.push(issue("budget_est", "Budget decision estimate mismatch.", "budgetDecision"));
    }
  }

  // No merge steps unless explicitly defined as strategy capability (none today)
  for (const sp of plans) {
    for (const step of sp.steps) {
      if (step.action === "merge" || step.action === "merge_audio") {
        issues.push(issue("merge_forbidden", "Merge steps are not routable yet.", step.id));
      }
    }
  }

  return issues;
}

export function assertPlanValid(input: {
  plan: GenerationPlan;
  storyboard: StoryboardProject;
  scenePackages: ScenePackage[];
}): void {
  const issues = validateGenerationPlan(input);
  if (issues.length) {
    throw new RoutingDomainError(
      "invalid_plan",
      "GenerationPlan validation failed.",
      issues.map((i) => i.code).join(","),
    );
  }
}

export function deepFreezePlan<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) {
      deepFreezePlan(v);
    }
  }
  return value;
}

export function assertSerializablePlan(value: unknown, path = "plan"): void {
  const t = typeof value;
  if (value === null || t === "string" || t === "boolean") return;
  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new RoutingDomainError("non_serializable", "Non-finite number.", path);
    }
    return;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    throw new RoutingDomainError("non_serializable", "Non-serializable value.", path);
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertSerializablePlan(v, `${path}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    assertSerializablePlan(v, `${path}.${k}`);
  }
}

export type { Money };
