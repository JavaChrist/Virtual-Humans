/**
 * Mutable-controlled ProductionRun (serializable application state).
 * Updates are immutable: new object + revision bump + injected clock.
 */

import { money, type Money } from "@/domain/cost";
import type { GenerationPlan } from "@/domain/routing/router/generation-plan";
import { ProductionDomainError } from "./errors";
import type { ProductionPolicy } from "./policy";
import { deriveSceneStatus, type SceneRun, type StepRun } from "./scene-run";
import { assertStepTransition, type StepRunStatus } from "./step-run";

export const PRODUCTION_RUN_STATUSES = [
  "pending",
  "validating",
  "running",
  "cancelling",
  "completed",
  "partial",
  "failed",
  "cancelled",
] as const;

export type ProductionRunStatus = (typeof PRODUCTION_RUN_STATUSES)[number];

export type ProductionRun = {
  id: string;
  projectId: string;
  generationPlanRevisionId: string;
  status: ProductionRunStatus;
  scenes: SceneRun[];
  policy: ProductionPolicy;
  estimatedCost: Money;
  committedCost: Money;
  releasedCost: Money;
  currency: Money["currency"];
  createdAt: string;
  updatedAt: string;
  revision: number;
  correlationId: string;
  waitingReason?: string;
  reviewRequest?: {
    sceneId: string;
    stepId: string;
    attemptId: string;
    reasons: { code: string; message: string }[];
  };
};

export type CreateProductionRunInput = {
  id: string;
  projectId: string;
  plan: GenerationPlan;
  policy: ProductionPolicy;
  createdAt: string;
  correlationId: string;
};

export function createProductionRun(input: CreateProductionRunInput): ProductionRun {
  const scenes: SceneRun[] = [...input.plan.scenePlans]
    .sort((a, b) => a.sceneOrder - b.sceneOrder)
    .map((sp) => {
      const steps: StepRun[] = [...sp.steps]
        .sort((a, b) => a.order - b.order)
        .map((st) => ({
          stepId: st.id,
          sceneId: sp.sceneId,
          order: st.order,
          status: "pending" as const,
          dependsOnStepIds: [...st.dependsOnStepIds],
          attempts: [],
          outputAssets: [],
          estimatedCost: st.estimate.total,
          committedCost: money(0, input.plan.currency),
          warnings: [],
          updatedAt: input.createdAt,
        }));
      return {
        sceneId: sp.sceneId,
        sceneOrder: sp.sceneOrder,
        status: "pending" as const,
        steps,
        outputAssets: [],
        estimatedCost: sp.estimatedCost,
        committedCost: money(0, input.plan.currency),
        warnings: [],
        updatedAt: input.createdAt,
      };
    });

  return {
    id: input.id,
    projectId: input.projectId,
    generationPlanRevisionId: input.plan.id,
    status: "pending",
    scenes,
    policy: input.policy,
    estimatedCost: input.plan.estimatedCost,
    committedCost: money(0, input.plan.currency),
    releasedCost: money(0, input.plan.currency),
    currency: input.plan.currency,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    revision: 1,
    correlationId: input.correlationId,
  };
}

export function withRunUpdate(
  run: ProductionRun,
  patch: Partial<Omit<ProductionRun, "id" | "revision" | "createdAt">>,
  updatedAt: string
): ProductionRun {
  return {
    ...run,
    ...patch,
    scenes: patch.scenes ?? run.scenes,
    updatedAt,
    revision: run.revision + 1,
  };
}

export function updateStepStatus(
  run: ProductionRun,
  stepId: string,
  to: StepRunStatus,
  updatedAt: string,
  mutate?: (step: StepRun) => StepRun
): ProductionRun {
  const scenes = run.scenes.map((scene) => {
    const idx = scene.steps.findIndex((s) => s.stepId === stepId);
    if (idx < 0) return scene;
    const prev = scene.steps[idx]!;
    assertStepTransition(prev.status, to);
    const nextBase: StepRun = {
      ...prev,
      status: to,
      updatedAt,
    };
    const next = mutate ? mutate(nextBase) : nextBase;
    const steps = scene.steps.map((s, i) => (i === idx ? next : s));
    return {
      ...scene,
      steps,
      status: deriveSceneStatus(steps),
      updatedAt,
      outputAssets: steps.flatMap((s) => s.outputAssets),
      committedCost: steps.reduce(
        (acc, s) => money(acc.amountMinor + s.committedCost.amountMinor, acc.currency),
        money(0, run.currency)
      ),
    };
  });

  if (!scenes.some((sc) => sc.steps.some((s) => s.stepId === stepId))) {
    throw new ProductionDomainError("invalid_input", `Étape inconnue: ${stepId}.`);
  }

  return withRunUpdate(run, { scenes, status: run.status === "pending" ? "running" : run.status }, updatedAt);
}

export function findStep(run: ProductionRun, stepId: string): StepRun | undefined {
  for (const scene of run.scenes) {
    const step = scene.steps.find((s) => s.stepId === stepId);
    if (step) return step;
  }
  return undefined;
}

export function serializeProductionRun(run: ProductionRun): string {
  return JSON.stringify(run);
}

export function deserializeProductionRun(json: string): ProductionRun {
  return JSON.parse(json) as ProductionRun;
}

export function isTerminalRunStatus(status: ProductionRunStatus): boolean {
  return (
    status === "completed" ||
    status === "partial" ||
    status === "failed" ||
    status === "cancelled"
  );
}

export function deriveTerminalRunStatus(
  run: ProductionRun,
  policy: ProductionPolicy
): ProductionRunStatus | null {
  const scenes = run.scenes;
  const anyActive = scenes.some(
    (s) =>
      s.status === "running" ||
      s.status === "pending" ||
      s.steps.some(
        (st) =>
          st.status === "ready" ||
          st.status === "reserved" ||
          st.status === "executing" ||
          st.status === "submitted" ||
          st.status === "polling" ||
          st.status === "validating" ||
          st.status === "fallback_ready" ||
          st.status === "pending"
      )
  );
  if (anyActive) return null;

  const completed = scenes.filter((s) => s.status === "completed").length;
  const failedish = scenes.filter(
    (s) => s.status === "failed" || s.status === "skipped" || s.status === "cancelled"
  ).length;

  if (run.status === "cancelling") {
    return "cancelled";
  }

  if (completed === scenes.length && scenes.length > 0) {
    return "completed";
  }

  if (policy.allowPartialResult && completed > 0 && failedish > 0) {
    return "partial";
  }

  if (completed === 0 && failedish > 0) {
    return "failed";
  }

  return "failed";
}
