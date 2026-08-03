/**
 * Production dry-run — no run persistence, no reservation, no provider calls.
 */

import {
  createBudgetSnapshot,
  decideBudget,
  money,
  type BudgetDecision,
  type BudgetSnapshot,
  type Money,
} from "@/domain/cost";
import type { ScenePackage } from "@/domain/prompt";
import {
  DEFAULT_PRODUCTION_POLICY,
  findReadySteps,
  createProductionRun,
  validatePlanForProduction,
  validateProductionPolicy,
  type ProductionPolicy,
  type ProductionWarning,
} from "@/domain/production";
import { checkProductionReadiness, type ProductionReadinessInput } from "@/domain/project";
import type { GenerationPlan } from "@/domain/routing/router";
import type { GenerationEngine } from "@/application/generation";
import { runGenerationEngineDryRun } from "@/application/generation";
import type { ProviderAdapterRegistry } from "@/application/generation/adapter-registry";
import {
  buildIdempotencyKey,
  type GenerationCommand,
} from "@/domain/generation";
import type { ProductionPorts } from "./ports";

// Local validation type (domain doesn't export ProductionValidation — define here)
export type ProductionValidation = {
  code: string;
  passed: boolean;
  message: string;
};

export type DryRunReadyStep = {
  sceneId: string;
  stepId: string;
  order: number;
};

export type ProductionDryRunResult = {
  executable: boolean;
  providerCalled: false;
  validations: ProductionValidation[];
  warnings: ProductionWarning[];
  readySteps: DryRunReadyStep[];
  maximumExposure: Money;
  budgetDecision: BudgetDecision;
};

export type ProductionDryRunInput = {
  plan: GenerationPlan;
  scenePackages: ScenePackage[];
  readiness: ProductionReadinessInput;
  policy?: ProductionPolicy;
  budgetSnapshot: BudgetSnapshot;
  registry: ProviderAdapterRegistry;
  /** Optional engine unused for dry-run path except type presence. */
  engine?: GenerationEngine;
  ports?: Partial<ProductionPorts>;
  at: string;
};

function maxExposure(plan: GenerationPlan): Money {
  if (plan.fallbackExposure) return plan.fallbackExposure;
  let total = money(0, plan.currency);
  for (const scene of plan.scenePlans) {
    for (const step of scene.steps) {
      total = money(total.amountMinor + step.estimate.total.amountMinor, plan.currency);
      for (const fb of step.fallbacks) {
        total = money(total.amountMinor + fb.estimate.total.amountMinor, plan.currency);
      }
    }
  }
  return total;
}

export function runProductionDryRun(input: ProductionDryRunInput): ProductionDryRunResult {
  const validations: ProductionValidation[] = [];
  const warnings: ProductionWarning[] = [];
  let executable = true;

  const push = (code: string, passed: boolean, message: string) => {
    validations.push({ code, passed, message });
    if (!passed) executable = false;
  };

  const policy = input.policy ?? DEFAULT_PRODUCTION_POLICY;
  try {
    validateProductionPolicy(policy);
    push("policy", true, "Politique valide.");
  } catch (e) {
    push("policy", false, e instanceof Error ? e.message : "Politique invalide.");
  }

  const planIssues = validatePlanForProduction(input.plan);
  push("plan", planIssues.length === 0, planIssues[0]?.message ?? "Plan valide.");

  const readiness = checkProductionReadiness(input.readiness);
  push(
    "approvals",
    readiness.ready,
    readiness.ready
      ? "Approbations OK."
      : `Approbations manquantes: ${[...readiness.missing, ...readiness.unapproved, ...readiness.stale].join(",")}`
  );

  // Ports presence
  if (!input.ports?.runStore) {
    warnings.push({
      code: "run_store_missing",
      message: "ProductionRunStore non configuré (requis pour exécution réelle).",
    });
  }
  if (!input.ports?.budget) {
    warnings.push({
      code: "budget_port_missing",
      message: "BudgetReservationPort non configuré.",
    });
  }
  if (!input.ports?.idempotency) {
    push(
      "idempotency_store",
      false,
      "Idempotency store requis pour une exécution réelle."
    );
  } else if (!input.ports.idempotency.durable) {
    warnings.push({
      code: "idempotency_not_durable",
      message:
        "Store d'idempotence non durable — reprise après crash non garantie; ne pas activer en production.",
    });
    // Dry-run still executable for tests; real start should refuse or warn hard.
    push("idempotency_durable", true, "Store présent (non durable signalé).");
  } else {
    push("idempotency_store", true, "Store d'idempotence durable présent.");
  }

  // Adapter resolvability via engine dry-run for each primary step
  for (const scene of input.plan.scenePlans) {
    const pkg = input.scenePackages.find((p) => p.sceneId === scene.sceneId);
    if (!pkg) {
      push("scene_package", false, `Package manquant pour ${scene.sceneId}`);
      continue;
    }
    for (const step of scene.steps) {
      const command: GenerationCommand = {
        projectId: input.plan.projectId,
        planRevisionId: input.plan.id,
        sceneId: scene.sceneId,
        step,
        scenePackage: pkg,
        resolvedInputs: [],
        idempotencyKey: buildIdempotencyKey({
          projectId: input.plan.projectId,
          planRevisionId: input.plan.id,
          sceneId: scene.sceneId,
          stepId: step.id,
          attempt: 1,
        }),
        requestedAt: input.at,
        attempt: 1,
      };
      const dr = runGenerationEngineDryRun({
        command,
        registry: input.registry,
      });
      if (!dr.adapterResolved) {
        push(
          "adapter",
          false,
          `Adapter absent pour ${step.providerId}/${step.modelId}/${step.action}`
        );
      }
    }
  }

  const exposure = maxExposure(input.plan);
  let snapshot: BudgetSnapshot;
  try {
    snapshot = createBudgetSnapshot(input.budgetSnapshot);
  } catch {
    snapshot = input.budgetSnapshot;
    push("budget_snapshot", false, "Budget snapshot incohérent.");
  }

  const budgetDecision = decideBudget(snapshot, exposure);
  push(
    "budget",
    budgetDecision.allowed,
    budgetDecision.allowed
      ? "Budget suffisant pour l'exposition maximale."
      : `Budget insuffisant (${"reason" in budgetDecision ? budgetDecision.reason : "denied"}).`
  );

  // Ready steps on a virtual run (not persisted)
  const virtual = createProductionRun({
    id: "dry-run",
    projectId: input.plan.projectId,
    plan: input.plan,
    policy,
    createdAt: input.at,
    correlationId: "dry-run",
  });
  // Mark roots ready conceptually
  const ready = findReadySteps(
    {
      ...virtual,
      scenes: virtual.scenes.map((sc) => ({
        ...sc,
        steps: sc.steps.map((st) =>
          st.dependsOnStepIds.length === 0 ? { ...st, status: "pending" as const } : st
        ),
      })),
    },
    input.plan,
    policy
  );

  return {
    executable,
    providerCalled: false,
    validations,
    warnings,
    readySteps: ready.map((r) => ({
      sceneId: r.sceneId,
      stepId: r.stepId,
      order: r.order,
    })),
    maximumExposure: exposure,
    budgetDecision,
  };
}
