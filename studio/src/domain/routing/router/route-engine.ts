/**
 * Pure Model Router engine (VHS-108).
 * Selects strategies and models — never executes generation.
 */

import {
  addMoney,
  decideBudget,
  money,
  type BudgetDecision,
  type BudgetPolicy,
  type BudgetSnapshot,
  type CostEstimate,
  type Money,
} from "@/domain/cost";
import type { ScenePackage } from "@/domain/prompt";
import {
  deriveCapabilityRequirements,
  type CapabilityRegistrySnapshot,
} from "@/domain/routing/capabilities";
import { createArtifactMetadata } from "@/domain/shared";
import type { StoryboardProject } from "@/domain/storyboard";
import {
  enumerateCombinations,
  inputRefsForStep,
  instantiateStrategiesForScene,
  promptVariantIdFor,
  type InstantiatedStrategy,
  type StrategyCombination,
} from "./candidates";
import {
  estimateStepCost,
  policyToEstimateFlags,
  sumEstimates,
} from "./cost-estimation";
import {
  buildSelectionExplanation,
  type RejectedCandidateSummary,
  type RoutingWarning,
} from "./explanation";
import { selectFallbacks } from "./fallback";
import { isRoutingDomainError } from "./errors";
import {
  GENERATION_PLAN_ARTIFACT_TYPE,
  GENERATION_PLAN_SCHEMA_VERSION,
  type GenerationPlan,
  type GenerationStep,
  type RoutingContext,
  type SceneGenerationPlan,
} from "./generation-plan";
import type { RoutingPolicy } from "./policy";
import {
  normalizeCostScores,
  scoreCandidate,
  sortScoredPicks,
  type ScoredPick,
} from "./scoring";
import {
  assertPlanValid,
  assertSerializablePlan,
  deepFreezePlan,
  type RoutingValidationIssue,
} from "./validation";

export type ModelRouterInput = {
  storyboard: StoryboardProject;
  scenePackages: ScenePackage[];
  registry: CapabilityRegistrySnapshot;
  routingPolicy: RoutingPolicy;
  budgetPolicy: BudgetPolicy;
  budgetSnapshot: BudgetSnapshot;
  metadata: {
    id: string;
    createdBy: string;
    createdAt?: string;
    revision?: number;
  };
};

export type SceneRoutingFailure = {
  sceneId: string;
  reasonCodes: string[];
  message: string;
};

export type BudgetAlternativeSummary = {
  strategyId: string;
  sceneId: string;
  estimatedCost: Money;
};

export type ModelRouterResult =
  | {
      status: "completed";
      plan: GenerationPlan;
      warnings: RoutingWarning[];
    }
  | {
      status: "no_eligible_strategy";
      sceneFailures: SceneRoutingFailure[];
      warnings: RoutingWarning[];
    }
  | {
      status: "budget_exceeded";
      required: Money;
      available: Money;
      alternatives: BudgetAlternativeSummary[];
      warnings: RoutingWarning[];
    }
  | {
      status: "invalid";
      errors: RoutingValidationIssue[];
    };

type EvaluatedCombination = {
  combination: StrategyCombination;
  sceneId: string;
  sceneOrder: number;
  steps: GenerationStep[];
  estimatedCost: Money;
  estimatedDurationSeconds: number;
  fallbackExposure: Money;
  score: ScoredPick;
  rationaleSummary: string;
};

function characterCountForPackage(pkg: ScenePackage): number {
  return pkg.dialogue?.text?.length ?? 0;
}

function validateInput(input: ModelRouterInput): RoutingValidationIssue[] {
  const errors: RoutingValidationIssue[] = [];
  const { storyboard, scenePackages } = input;
  if (storyboard.scenes.length === 0) {
    errors.push({ code: "empty_storyboard", message: "Storyboard has no scenes." });
  }
  if (scenePackages.length !== storyboard.scenes.length) {
    errors.push({
      code: "package_count",
      message: "Scene package count must match storyboard scenes.",
    });
  }
  const seen = new Set<string>();
  for (const pkg of scenePackages) {
    if (pkg.projectId !== storyboard.projectId) {
      errors.push({
        code: "project_mismatch",
        message: "Package project mismatch.",
        path: pkg.sceneId,
      });
    }
    if (pkg.storyboardRevisionId !== storyboard.id) {
      errors.push({
        code: "revision_mismatch",
        message: "Package storyboard revision mismatch.",
        path: pkg.sceneId,
      });
    }
    if (seen.has(pkg.sceneId)) {
      errors.push({
        code: "dup_package",
        message: "Duplicate scene package.",
        path: pkg.sceneId,
      });
    }
    seen.add(pkg.sceneId);
    if (!storyboard.scenes.some((s) => s.id === pkg.sceneId)) {
      errors.push({
        code: "orphan_package",
        message: "Package scene missing.",
        path: pkg.sceneId,
      });
    }
  }
  for (const sc of storyboard.scenes) {
    if (!seen.has(sc.id)) {
      errors.push({
        code: "missing_package",
        message: "Missing package for scene.",
        path: sc.id,
      });
    }
  }
  if (input.budgetPolicy.hardLimit.currency !== input.budgetSnapshot.limit.currency) {
    errors.push({
      code: "budget_currency",
      message: "Budget policy/snapshot currency mismatch.",
    });
  }
  return errors;
}

function evaluateCombination(input: {
  combination: StrategyCombination;
  scenePackage: ScenePackage;
  sceneOrder: number;
  durationSeconds: number;
  requirementsIdentityHigh: boolean;
  policy: RoutingPolicy;
  context: RoutingContext;
  projectId: string;
  createdBy: string;
  createdAt: string;
  instantiated: InstantiatedStrategy;
  currencyHint: string;
}): EvaluatedCombination | null {
  const flags = policyToEstimateFlags(input.policy);
  const steps: GenerationStep[] = [];
  const primaryEstimates: CostEstimate[] = [];

  const stepCostMaps: Map<string, number>[] = [];
  for (let i = 0; i < input.combination.picks.length; i++) {
    const template = input.combination.templates[i]!;
    const stepKeyPrefix = input.combination.stepIds[i]!;
    const alts = input.instantiated.steps[i]!.candidates;
    const costs: Array<{ key: string; amountMinor: number }> = [];
    for (const alt of alts) {
      try {
        const est = estimateStepCost(alt.model, {
          projectId: input.projectId,
          sceneId: input.scenePackage.sceneId,
          stepId: stepKeyPrefix,
          action: template.action,
          durationSeconds: input.durationSeconds,
          characterCount: characterCountForPackage(input.scenePackage),
          at: input.context.at,
          correlationId: input.context.correlationId,
          createdBy: input.createdBy,
          createdAt: input.createdAt,
          role: "primary",
          ...flags,
        });
        costs.push({
          key: `${alt.model.providerId}::${alt.model.modelId}`,
          amountMinor: est.estimate.total.amountMinor,
        });
      } catch {
        // skip
      }
    }
    stepCostMaps.push(normalizeCostScores(costs));
  }

  let fbExposureMinor = 0;
  let currency = input.currencyHint;

  for (let i = 0; i < input.combination.picks.length; i++) {
    const pick = input.combination.picks[i]!;
    const template = input.combination.templates[i]!;
    const sid = input.combination.stepIds[i]!;
    const costMap = stepCostMaps[i]!;
    const costScore = costMap.get(`${pick.providerId}::${pick.modelId}`);
    const score = scoreCandidate({
      model: pick.model,
      costScore,
      policy: input.policy,
      identityPriorityHigh: input.requirementsIdentityHigh,
    });
    if (!score) return null;

    let estimated: CostEstimate;
    let pricingEvidence: string[];
    try {
      const r = estimateStepCost(pick.model, {
        projectId: input.projectId,
        sceneId: input.scenePackage.sceneId,
        stepId: sid,
        action: template.action,
        durationSeconds: input.durationSeconds,
        characterCount: characterCountForPackage(input.scenePackage),
        at: input.context.at,
        correlationId: input.context.correlationId,
        createdBy: input.createdBy,
        createdAt: input.createdAt,
        role: "primary",
        ...flags,
      });
      estimated = r.estimate;
      pricingEvidence = r.pricingEvidence;
    } catch {
      return null;
    }
    currency = estimated.total.currency;
    primaryEstimates.push(estimated);

    const rejected: RejectedCandidateSummary[] = [];
    for (const alt of input.instantiated.steps[i]!.candidates) {
      if (
        alt.model.providerId === pick.providerId &&
        alt.model.modelId === pick.modelId
      ) {
        continue;
      }
      if (rejected.length >= input.policy.maxRejectedAlternatives) break;
      const altScore = scoreCandidate({
        model: alt.model,
        costScore: costMap.get(`${alt.model.providerId}::${alt.model.modelId}`),
        policy: input.policy,
        identityPriorityHigh: input.requirementsIdentityHigh,
      });
      rejected.push({
        providerId: alt.model.providerId,
        modelId: alt.model.modelId,
        reasonCodes: altScore ? ["lower_score"] : ["unscored_or_blocked"],
        message: altScore
          ? `Lower composite score (${altScore.total}).`
          : "Blocked by unknown hard score dimension or estimation failure.",
        scoreTotal: altScore?.total,
      });
    }

    const fallbacks = selectFallbacks({
      primaryProviderId: pick.providerId,
      primaryModelId: pick.modelId,
      alternatives: input.instantiated.steps[i]!.candidates.map((c) => ({
        model: c.model,
        eligibilityEvidence: c.eligibilityEvidence,
      })),
      estimateContext: {
        projectId: input.projectId,
        sceneId: input.scenePackage.sceneId,
        stepId: sid,
        action: template.action,
        durationSeconds: input.durationSeconds,
        characterCount: characterCountForPackage(input.scenePackage),
        at: input.context.at,
        correlationId: input.context.correlationId,
        createdBy: input.createdBy,
        createdAt: input.createdAt,
        ...flags,
      },
      policy: input.policy,
      identityPriorityHigh: input.requirementsIdentityHigh,
      stepCostScores: costMap,
    });

    for (const fb of fallbacks) {
      fbExposureMinor += fb.estimate.total.amountMinor;
    }

    const priorIds = input.combination.stepIds;
    const dependsOnStepIds = template.dependsOnOrders
      .map((o) => priorIds[o - 1]!)
      .filter(Boolean);

    steps.push({
      id: sid,
      order: template.order,
      action: template.action,
      capabilityProfile: template.capabilityProfile,
      providerId: pick.providerId,
      modelId: pick.modelId,
      promptVariantId: promptVariantIdFor(
        input.scenePackage,
        template.capabilityProfile,
      ),
      inputRefs: inputRefsForStep(input.scenePackage, template, priorIds),
      dependsOnStepIds,
      expectedOutput: {
        mediaType: template.expectedOutput,
        durationSeconds:
          template.expectedOutput === "video" ||
          template.expectedOutput === "lipsync_video" ||
          template.expectedOutput === "carousel"
            ? input.durationSeconds
            : undefined,
      },
      timeoutSeconds: template.defaultTimeoutSeconds,
      estimate: estimated,
      fallbacks,
      selection: buildSelectionExplanation({
        score,
        eligibilityEvidence: pick.eligibilityEvidence,
        pricingEvidence,
        rejected,
        withinBudget: true,
        identityPriorityHigh: input.requirementsIdentityHigh,
      }),
    });
  }

  if (primaryEstimates.length === 0) return null;
  const estimatedCost = sumEstimates(primaryEstimates);
  const avgTotal = Math.round(
    steps.reduce((a, s) => a + s.selection.score.total, 0) / steps.length,
  );

  const scored: ScoredPick = {
    providerId: input.combination.picks.map((p) => p.providerId).join("+"),
    modelId: input.combination.picks.map((p) => p.modelId).join("+"),
    cost: estimatedCost,
    estimatedDurationSeconds: input.durationSeconds,
    strategyId: input.combination.strategy.id,
    model: input.combination.picks[0]!.model,
    score: {
      total: avgTotal,
      missingDimensions: [],
      contributions: [],
    },
  };

  return {
    combination: input.combination,
    sceneId: input.scenePackage.sceneId,
    sceneOrder: input.sceneOrder,
    steps,
    estimatedCost,
    estimatedDurationSeconds: input.durationSeconds,
    fallbackExposure: money(fbExposureMinor, currency),
    score: scored,
    rationaleSummary: `Strategy ${input.combination.strategy.id} with ${steps.length} step(s).`,
  };
}

export function routeModelPlan(
  input: ModelRouterInput,
  context: RoutingContext,
): ModelRouterResult {
  const warnings: RoutingWarning[] = [];
  const errors = validateInput(input);
  if (errors.length) {
    return { status: "invalid", errors };
  }

  const createdAt = input.metadata.createdAt ?? context.at;
  const packagesByScene = new Map(input.scenePackages.map((p) => [p.sceneId, p]));
  const scenes = [...input.storyboard.scenes].sort((a, b) => a.order - b.order);

  const sceneFailures: SceneRoutingFailure[] = [];
  const bestPerScene: EvaluatedCombination[] = [];
  const budgetAlts: BudgetAlternativeSummary[] = [];

  try {
    for (const scene of scenes) {
      const pkg = packagesByScene.get(scene.id)!;
      let requirements;
      try {
        requirements = deriveCapabilityRequirements(pkg, input.storyboard);
      } catch (e) {
        sceneFailures.push({
          sceneId: scene.id,
          reasonCodes: ["requirements_failed"],
          message: e instanceof Error ? e.message : "Requirements derivation failed.",
        });
        continue;
      }

      let instantiated: InstantiatedStrategy[];
      try {
        instantiated = instantiateStrategiesForScene({
          scenePackage: pkg,
          storyboard: input.storyboard,
          requirements,
          registry: input.registry,
          policy: input.routingPolicy,
          at: context.at,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.toLowerCase().includes("expired") || (e as { code?: string }).code === "snapshot_expired") {
          return {
            status: "invalid",
            errors: [{ code: "snapshot_expired", message: "Registry snapshot expired." }],
          };
        }
        throw e;
      }

      if (instantiated.length === 0) {
        sceneFailures.push({
          sceneId: scene.id,
          reasonCodes: ["no_strategy"],
          message: "No strategy has eligible models for all steps.",
        });
        continue;
      }

      const evaluated: EvaluatedCombination[] = [];
      for (const inst of instantiated) {
        let combos: StrategyCombination[];
        try {
          combos = enumerateCombinations(
            inst,
            input.routingPolicy.maximumStrategyCombinations,
          );
        } catch (e) {
          if (isRoutingDomainError(e) && e.code === "combination_limit") {
            return {
              status: "invalid",
              errors: [{ code: "combination_limit", message: e.publicMessage }],
            };
          }
          throw e;
        }

        for (const combo of combos) {
          const ev = evaluateCombination({
            combination: combo,
            scenePackage: pkg,
            sceneOrder: scene.order,
            durationSeconds: scene.durationSeconds,
            requirementsIdentityHigh: requirements.identityPriority === "high",
            policy: input.routingPolicy,
            context,
            projectId: input.storyboard.projectId,
            createdBy: input.metadata.createdBy,
            createdAt,
            instantiated: inst,
            currencyHint: input.budgetSnapshot.limit.currency,
          });
          if (ev) {
            evaluated.push(ev);
            budgetAlts.push({
              strategyId: combo.strategy.id,
              sceneId: scene.id,
              estimatedCost: ev.estimatedCost,
            });
          }
        }
      }

      if (evaluated.length === 0) {
        sceneFailures.push({
          sceneId: scene.id,
          reasonCodes: ["no_scored_combination"],
          message: "All combinations failed scoring or estimation.",
        });
        continue;
      }

      const ranked = sortScoredPicks(
        evaluated.map((e) => e.score),
        input.routingPolicy.tieBreakers,
      );
      const bestScore = ranked[0]!;
      const best =
        evaluated.find(
          (e) =>
            e.score.strategyId === bestScore.strategyId &&
            e.score.providerId === bestScore.providerId &&
            e.score.modelId === bestScore.modelId &&
            e.score.cost.amountMinor === bestScore.cost.amountMinor,
        ) ?? evaluated[0]!;
      bestPerScene.push(best);
    }
  } catch (e) {
    if (isRoutingDomainError(e)) {
      return {
        status: "invalid",
        errors: [{ code: e.code, message: e.publicMessage }],
      };
    }
    throw e;
  }

  if (sceneFailures.length > 0 || bestPerScene.length !== scenes.length) {
    return {
      status: "no_eligible_strategy",
      sceneFailures:
        sceneFailures.length > 0
          ? sceneFailures
          : scenes
              .filter((s) => !bestPerScene.some((b) => b.sceneId === s.id))
              .map((s) => ({
                sceneId: s.id,
                reasonCodes: ["unresolved"],
                message: "Scene unresolved.",
              })),
      warnings,
    };
  }

  bestPerScene.sort((a, b) => a.sceneOrder - b.sceneOrder);
  const estimatedCost = bestPerScene.reduce(
    (acc, s) => addMoney(acc, s.estimatedCost),
    money(0, input.budgetSnapshot.limit.currency),
  );
  const estimatedDurationSeconds = bestPerScene.reduce(
    (a, s) => a + s.estimatedDurationSeconds,
    0,
  );
  const fallbackExposure = bestPerScene.reduce(
    (acc, s) => addMoney(acc, s.fallbackExposure),
    money(0, estimatedCost.currency),
  );

  void input.budgetPolicy;
  const budgetDecision: BudgetDecision = decideBudget(
    input.budgetSnapshot,
    estimatedCost,
  );

  if (!budgetDecision.allowed) {
    return {
      status: "budget_exceeded",
      required: estimatedCost,
      available: input.budgetSnapshot.available,
      alternatives: budgetAlts
        .slice()
        .sort((a, b) => a.estimatedCost.amountMinor - b.estimatedCost.amountMinor)
        .slice(0, 12),
      warnings,
    };
  }

  const scenePlans: SceneGenerationPlan[] = bestPerScene.map((ev) => ({
    sceneId: ev.sceneId,
    sceneOrder: ev.sceneOrder,
    strategy: ev.combination.strategy.id,
    steps: ev.steps,
    estimatedCost: ev.estimatedCost,
    estimatedDurationSeconds: ev.estimatedDurationSeconds,
    fallbackExposure: ev.fallbackExposure,
    rationale: {
      strategyId: ev.combination.strategy.id,
      summary: ev.rationaleSummary,
      reasons: [
        {
          code: "strategy_fit" as const,
          message: `Selected strategy ${ev.combination.strategy.id}.`,
        },
        {
          code: "best_score" as const,
          message: `Composite score ${ev.score.score.total}.`,
        },
      ],
    },
  }));

  const meta = createArtifactMetadata({
    id: input.metadata.id,
    projectId: input.storyboard.projectId,
    createdBy: input.metadata.createdBy,
    correlationId: context.correlationId,
    createdAt,
    revision: input.metadata.revision,
    schemaVersion: GENERATION_PLAN_SCHEMA_VERSION,
  });

  const plan: GenerationPlan = {
    ...meta,
    artifactType: GENERATION_PLAN_ARTIFACT_TYPE,
    storyboardRevisionId: input.storyboard.id,
    scenePackageRevisionIds: input.scenePackages
      .map((p) => p.id)
      .sort((a, b) => a.localeCompare(b)),
    registryVersion: input.registry.registryVersion,
    policyVersion: input.routingPolicy.version,
    currency: estimatedCost.currency,
    scenePlans,
    estimatedCost,
    estimatedDurationSeconds,
    fallbackExposure,
    budgetDecision,
    rationale: {
      summary: `Routed ${scenePlans.length} scene(s) under policy ${input.routingPolicy.version}.`,
      policyVersion: input.routingPolicy.version,
      registryVersion: input.registry.registryVersion,
      decisions: scenePlans.map((sp) => ({
        sceneId: sp.sceneId,
        strategyId: sp.strategy,
        summary: sp.rationale.summary,
      })),
    },
    warnings,
  };

  try {
    assertSerializablePlan(plan);
    assertPlanValid({
      plan,
      storyboard: input.storyboard,
      scenePackages: input.scenePackages,
    });
  } catch (e) {
    if (isRoutingDomainError(e)) {
      return {
        status: "invalid",
        errors: [{ code: e.code, message: e.publicMessage }],
      };
    }
    throw e;
  }

  return {
    status: "completed",
    plan: deepFreezePlan(structuredClone(plan)),
    warnings,
  };
}
