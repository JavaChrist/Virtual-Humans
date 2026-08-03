/**
 * Model Router dry-run (VHS-108).
 * No GenerationPlan artifact finalized; providerCalled: false.
 */

import {
  addMoney,
  decideBudget,
  money,
  type BudgetDecision,
  type BudgetPolicy,
  type BudgetSnapshot,
  type Money,
} from "@/domain/cost";
import type { ScenePackage } from "@/domain/prompt";
import {
  deriveCapabilityRequirements,
  type CapabilityRegistrySnapshot,
} from "@/domain/routing/capabilities";
import {
  enumerateCombinations,
  instantiateStrategiesForScene,
  type RoutingPolicy,
  type RoutingWarning,
  type SceneRoutingFailure,
  estimateStepCost,
  policyToEstimateFlags,
  sumEstimates,
} from "@/domain/routing/router";
import type { StoryboardProject } from "@/domain/storyboard";

export type MoneyRange = {
  min: Money;
  max: Money;
};

export type EligibleStrategySummary = {
  sceneId: string;
  strategyId: string;
  combinationCount: number;
  estimatedCostMin?: Money;
  estimatedCostMax?: Money;
};

export type ModelRouterDryRunResult = {
  executable: boolean;
  providerCalled: false;
  eligibleStrategiesByScene: EligibleStrategySummary[];
  estimatedCostRange?: MoneyRange;
  budgetDecision?: BudgetDecision;
  warnings: RoutingWarning[];
  failures: SceneRoutingFailure[];
  /** Summary only — not a finalized GenerationPlan artifact. */
  wouldSelect?: Array<{ sceneId: string; strategyId: string; estimatedCost: Money }>;
};

export type ModelRouterDryRunInput = {
  storyboard: StoryboardProject;
  scenePackages: ScenePackage[];
  registry: CapabilityRegistrySnapshot;
  routingPolicy: RoutingPolicy;
  budgetPolicy: BudgetPolicy;
  budgetSnapshot: BudgetSnapshot;
  at: string;
  correlationId: string;
  createdBy?: string;
};

export function runModelRouterDryRun(
  input: ModelRouterDryRunInput,
): ModelRouterDryRunResult {
  const warnings: RoutingWarning[] = [];
  const failures: SceneRoutingFailure[] = [];
  const eligibleStrategiesByScene: EligibleStrategySummary[] = [];
  const wouldSelect: Array<{ sceneId: string; strategyId: string; estimatedCost: Money }> =
    [];

  const flags = policyToEstimateFlags(input.routingPolicy);
  const createdAt = input.at;
  const createdBy = input.createdBy ?? "dry-run";
  const currency = input.budgetSnapshot.limit.currency;

  let globalMin: Money | undefined;
  let globalMax: Money | undefined;

  const scenes = [...input.storyboard.scenes].sort((a, b) => a.order - b.order);
  const pkgByScene = new Map(input.scenePackages.map((p) => [p.sceneId, p]));

  for (const scene of scenes) {
    const pkg = pkgByScene.get(scene.id);
    if (!pkg) {
      failures.push({
        sceneId: scene.id,
        reasonCodes: ["missing_package"],
        message: "Missing scene package.",
      });
      continue;
    }

    let requirements;
    try {
      requirements = deriveCapabilityRequirements(pkg, input.storyboard);
    } catch {
      failures.push({
        sceneId: scene.id,
        reasonCodes: ["requirements_failed"],
        message: "Could not derive capability requirements.",
      });
      continue;
    }

    let instantiated;
    try {
      instantiated = instantiateStrategiesForScene({
        scenePackage: pkg,
        storyboard: input.storyboard,
        requirements,
        registry: input.registry,
        policy: input.routingPolicy,
        at: input.at,
      });
    } catch {
      failures.push({
        sceneId: scene.id,
        reasonCodes: ["registry_error"],
        message: "Registry not usable for dry-run.",
      });
      continue;
    }

    if (instantiated.length === 0) {
      failures.push({
        sceneId: scene.id,
        reasonCodes: ["no_strategy"],
        message: "No eligible strategy.",
      });
      continue;
    }

    let sceneBest: { strategyId: string; cost: Money } | undefined;

    for (const inst of instantiated) {
      let combos;
      try {
        combos = enumerateCombinations(
          inst,
          input.routingPolicy.maximumStrategyCombinations,
        );
      } catch {
        warnings.push({
          code: "combination_limit",
          message: "Combination limit hit during dry-run.",
          sceneId: scene.id,
        });
        continue;
      }

      let minC: Money | undefined;
      let maxC: Money | undefined;

      for (const combo of combos) {
        const estimates = [];
        let ok = true;
        for (let i = 0; i < combo.picks.length; i++) {
          try {
            const r = estimateStepCost(combo.picks[i]!.model, {
              projectId: input.storyboard.projectId,
              sceneId: scene.id,
              stepId: combo.stepIds[i]!,
              action: combo.templates[i]!.action,
              durationSeconds: scene.durationSeconds,
              characterCount: pkg.dialogue?.text?.length ?? 0,
              at: input.at,
              correlationId: input.correlationId,
              createdBy,
              createdAt,
              role: "primary",
              ...flags,
            });
            estimates.push(r.estimate);
          } catch {
            ok = false;
            break;
          }
        }
        if (!ok || estimates.length === 0) continue;
        const total = sumEstimates(estimates);
        if (!minC || total.amountMinor < minC.amountMinor) minC = total;
        if (!maxC || total.amountMinor > maxC.amountMinor) maxC = total;
        if (!sceneBest || total.amountMinor < sceneBest.cost.amountMinor) {
          sceneBest = { strategyId: combo.strategy.id, cost: total };
        }
      }

      eligibleStrategiesByScene.push({
        sceneId: scene.id,
        strategyId: inst.strategy.id,
        combinationCount: combos.length,
        estimatedCostMin: minC,
        estimatedCostMax: maxC,
      });

      if (minC) {
        globalMin = globalMin
          ? money(globalMin.amountMinor + minC.amountMinor, currency)
          : minC;
      }
      if (maxC) {
        globalMax = globalMax
          ? money(globalMax.amountMinor + maxC.amountMinor, currency)
          : maxC;
      }
    }

    if (sceneBest) {
      wouldSelect.push({
        sceneId: scene.id,
        strategyId: sceneBest.strategyId,
        estimatedCost: sceneBest.cost,
      });
    } else {
      failures.push({
        sceneId: scene.id,
        reasonCodes: ["estimation_failed"],
        message: "No estimable combination.",
      });
    }
  }

  const executable =
    failures.length === 0 && wouldSelect.length === scenes.length;

  let estimatedCostRange: MoneyRange | undefined;
  if (globalMin && globalMax) {
    estimatedCostRange = { min: globalMin, max: globalMax };
  }

  let budgetDecision: BudgetDecision | undefined;
  if (wouldSelect.length === scenes.length) {
    const committed = wouldSelect.reduce(
      (acc, s) => addMoney(acc, s.estimatedCost),
      money(0, currency),
    );
    budgetDecision = decideBudget(input.budgetSnapshot, committed);
    if (!budgetDecision.allowed) {
      warnings.push({
        code: "budget_insufficient",
        message: "Selected dry-run plan exceeds hard budget.",
      });
    }
  }

  void input.budgetPolicy;

  return {
    executable: executable && (budgetDecision?.allowed ?? false),
    providerCalled: false,
    eligibleStrategiesByScene,
    estimatedCostRange,
    budgetDecision,
    warnings,
    failures,
    wouldSelect: wouldSelect.length ? wouldSelect : undefined,
  };
}
