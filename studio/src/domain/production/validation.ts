/**
 * Production domain validation helpers.
 */

import type { GenerationPlan } from "@/domain/routing/router/generation-plan";
import { ProductionDomainError, type ProductionIssue } from "./errors";
import { validateProductionPolicy, type ProductionPolicy } from "./policy";
import type { ProductionRun } from "./production-run";

export function validatePlanForProduction(plan: GenerationPlan): ProductionIssue[] {
  const issues: ProductionIssue[] = [];
  if (!plan?.id) {
    issues.push({ code: "invalid_input", message: "GenerationPlan.id requis.", path: "id" });
  }
  if (!plan.scenePlans?.length) {
    issues.push({
      code: "invalid_input",
      message: "Aucune scène dans le plan.",
      path: "scenePlans",
    });
  }
  if (plan.budgetDecision && plan.budgetDecision.allowed === false) {
    issues.push({
      code: "budget_reservation_failed",
      message: "Budget du plan non autorisé.",
      path: "budgetDecision",
    });
  }
  const seen = new Set<string>();
  for (const scene of plan.scenePlans ?? []) {
    for (const step of scene.steps) {
      if (seen.has(step.id)) {
        issues.push({
          code: "invalid_input",
          message: `stepId dupliqué: ${step.id}`,
          path: step.id,
        });
      }
      seen.add(step.id);
      if (step.fallbacks.length > 2) {
        issues.push({
          code: "invalid_input",
          message: "Plus de 2 fallbacks sur une étape.",
          path: step.id,
        });
      }
      for (const dep of step.dependsOnStepIds) {
        if (!seen.has(dep) && !scene.steps.some((s) => s.id === dep)) {
          // Cross-scene deps allowed if present elsewhere in plan
          const exists = plan.scenePlans.some((sp) => sp.steps.some((s) => s.id === dep));
          if (!exists) {
            issues.push({
              code: "invalid_input",
              message: `Dépendance inconnue: ${dep}`,
              path: step.id,
            });
          }
        }
      }
    }
  }
  return issues;
}

export function assertPolicyAndPlan(plan: GenerationPlan, policy: ProductionPolicy): void {
  validateProductionPolicy(policy);
  const issues = validatePlanForProduction(plan);
  if (issues.length > 0) {
    throw new ProductionDomainError(
      "invalid_input",
      issues[0]!.message,
      issues.map((i) => i.message).join("; ")
    );
  }
}

export function assertRunMatchesPlan(run: ProductionRun, plan: GenerationPlan): void {
  if (run.generationPlanRevisionId !== plan.id) {
    throw new ProductionDomainError(
      "invalid_input",
      "Le run ne correspond pas à la révision du plan."
    );
  }
  if (run.projectId !== plan.projectId) {
    throw new ProductionDomainError("invalid_input", "projectId incohérent.");
  }
}
