/**
 * Immutable ProductionResult artifact (VHS-110 / VHS-111).
 * 1.0.0 — execution scenes only.
 * 1.1.0 — additive `delivery` for postproduction (same artifactType).
 */

import type { Money } from "@/domain/cost";
import type { GeneratedAsset } from "@/domain/generation";
import type { CurrencyCode } from "@/domain/shared";
import type { ArtifactMetadata } from "@/domain/shared";
import type { ProductionAttempt } from "./attempts";
import {
  createInitialDelivery,
  type ProductionDelivery,
} from "./delivery";
import type { ProductionWarning } from "./errors";
import type { ProductionRun } from "./production-run";
import type { SceneRun } from "./scene-run";

export const PRODUCTION_RESULT_SCHEMA_VERSION_V1 = "1.0.0" as const;
export const PRODUCTION_RESULT_SCHEMA_VERSION = "1.1.0" as const;
export const PRODUCTION_RESULT_ARTIFACT_TYPE = "production_result" as const;

export type StepProductionResult = {
  stepId: string;
  order: number;
  status: "completed" | "failed" | "cancelled" | "skipped";
  attempts: ProductionAttempt[];
  outputAssets: GeneratedAsset[];
  estimatedCost: Money;
  committedCost: Money;
  warnings: ProductionWarning[];
};

export type SceneProductionResult = {
  sceneId: string;
  sceneOrder: number;
  status: "completed" | "failed" | "cancelled" | "skipped";
  steps: StepProductionResult[];
  outputAssets: GeneratedAsset[];
  estimatedCost: Money;
  committedCost: Money;
  warnings: ProductionWarning[];
};

export type ProductionManifestAttempt = {
  attemptId: string;
  stepId: string;
  sceneId: string;
  attemptNumber: number;
  kind: "primary" | "fallback";
  providerId: string;
  modelId: string;
  status: string;
  estimatedAmountMinor: number;
  actualAmountMinor?: number;
  costKind?: "actual" | "provisional";
  currency: string;
  errorCode?: string;
  externalJobId?: string;
  fallbackIndex?: number;
};

export type ProductionManifestScene = {
  sceneId: string;
  sceneOrder: number;
  status: string;
  stepIds: string[];
  committedAmountMinor: number;
  estimatedAmountMinor: number;
};

export type ProductionManifest = {
  planRevisionId: string;
  runId: string;
  policyVersion: string;
  scenes: ProductionManifestScene[];
  attempts: ProductionManifestAttempt[];
  generatedAt: string;
};

/** Execution-only contract (VHS-110). */
export type ProductionResultV1 = ArtifactMetadata & {
  artifactType: typeof PRODUCTION_RESULT_ARTIFACT_TYPE;
  schemaVersion: typeof PRODUCTION_RESULT_SCHEMA_VERSION_V1;
  generationPlanRevisionId: string;
  status: "completed" | "partial" | "failed" | "cancelled";
  scenes: SceneProductionResult[];
  estimatedCost: Money;
  committedCost: Money;
  releasedCost: Money;
  currency: CurrencyCode;
  startedAt: string;
  completedAt?: string;
  manifest: ProductionManifest;
  warnings: ProductionWarning[];
};

/**
 * Canonical ProductionResult 1.1.0.
 * `status` = scene execution; `delivery` = postproduction / export.
 */
export type ProductionResult = ArtifactMetadata & {
  artifactType: typeof PRODUCTION_RESULT_ARTIFACT_TYPE;
  schemaVersion: typeof PRODUCTION_RESULT_SCHEMA_VERSION | typeof PRODUCTION_RESULT_SCHEMA_VERSION_V1;
  generationPlanRevisionId: string;
  /** Scene execution outcome — unchanged semantics from 1.0.0. */
  status: "completed" | "partial" | "failed" | "cancelled";
  scenes: SceneProductionResult[];
  estimatedCost: Money;
  committedCost: Money;
  releasedCost: Money;
  currency: CurrencyCode;
  startedAt: string;
  completedAt?: string;
  manifest: ProductionManifest;
  warnings: ProductionWarning[];
  /** Present on 1.1.0+ — absent on raw 1.0.0 until migrated. */
  delivery?: ProductionDelivery;
};

function mapSceneStatus(
  status: SceneRun["status"]
): SceneProductionResult["status"] {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "skipped") return "skipped";
  return "failed";
}

function mapStepStatus(status: string): StepProductionResult["status"] {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "skipped") return "skipped";
  return "failed";
}

/** Redact asset sources for manifest-adjacent storage. */
export function redactAsset(asset: GeneratedAsset): GeneratedAsset {
  if (asset.source.kind === "temporary_external") {
    return {
      ...asset,
      source: {
        kind: "temporary_external",
        url: "[redacted]",
        expiresAt: asset.source.expiresAt,
      },
    };
  }
  if (asset.source.kind === "inline_data_url") {
    return {
      ...asset,
      source: { kind: "inline_data_url", dataUrl: "[redacted]" },
    };
  }
  return asset;
}

export function buildProductionManifest(
  run: ProductionRun,
  generatedAt: string
): ProductionManifest {
  const attempts: ProductionManifestAttempt[] = [];
  for (const scene of run.scenes) {
    for (const step of scene.steps) {
      for (const a of step.attempts) {
        attempts.push({
          attemptId: a.id,
          stepId: step.stepId,
          sceneId: scene.sceneId,
          attemptNumber: a.attemptNumber,
          kind: a.kind,
          providerId: a.providerId,
          modelId: a.modelId,
          status: a.status,
          estimatedAmountMinor: a.estimate.total.amountMinor,
          actualAmountMinor: a.actualCost?.amountMinor,
          costKind: a.costKind,
          currency: a.estimate.total.currency,
          errorCode: a.error?.code,
          externalJobId: a.providerJob?.externalJobId,
          fallbackIndex: a.fallbackIndex,
        });
      }
    }
  }

  return {
    planRevisionId: run.generationPlanRevisionId,
    runId: run.id,
    policyVersion: run.policy.version,
    scenes: run.scenes.map((s) => ({
      sceneId: s.sceneId,
      sceneOrder: s.sceneOrder,
      status: s.status,
      stepIds: s.steps.map((st) => st.stepId),
      committedAmountMinor: s.committedCost.amountMinor,
      estimatedAmountMinor: s.estimatedCost.amountMinor,
    })),
    attempts,
    generatedAt,
  };
}

export function buildProductionResult(input: {
  run: ProductionRun;
  meta: ArtifactMetadata;
  completedAt: string;
  status: ProductionResult["status"];
  warnings?: ProductionWarning[];
  /** Default true — emit 1.1.0 with delivery.not_started. */
  withDelivery?: boolean;
}): ProductionResult {
  const { run, meta, completedAt, status } = input;
  const withDelivery = input.withDelivery !== false;
  const scenes: SceneProductionResult[] = run.scenes.map((scene) => ({
    sceneId: scene.sceneId,
    sceneOrder: scene.sceneOrder,
    status: mapSceneStatus(scene.status),
    steps: scene.steps.map((step) => ({
      stepId: step.stepId,
      order: step.order,
      status: mapStepStatus(step.status),
      attempts: step.attempts.map((a) => ({
        ...a,
        output: a.output ? redactAsset(a.output) : undefined,
      })),
      outputAssets: step.outputAssets.map(redactAsset),
      estimatedCost: step.estimatedCost,
      committedCost: step.committedCost,
      warnings: step.warnings,
    })),
    outputAssets: scene.outputAssets.map(redactAsset),
    estimatedCost: scene.estimatedCost,
    committedCost: scene.committedCost,
    warnings: scene.warnings,
  }));

  const result: ProductionResult = {
    ...meta,
    schemaVersion: withDelivery
      ? PRODUCTION_RESULT_SCHEMA_VERSION
      : PRODUCTION_RESULT_SCHEMA_VERSION_V1,
    artifactType: PRODUCTION_RESULT_ARTIFACT_TYPE,
    generationPlanRevisionId: run.generationPlanRevisionId,
    status,
    scenes,
    estimatedCost: run.estimatedCost,
    committedCost: run.committedCost,
    releasedCost: run.releasedCost,
    currency: run.currency,
    startedAt: run.createdAt,
    completedAt,
    manifest: buildProductionManifest(run, completedAt),
    warnings: input.warnings ?? [],
    ...(withDelivery ? { delivery: createInitialDelivery(completedAt) } : {}),
  };

  return Object.freeze(JSON.parse(JSON.stringify(result)) as ProductionResult);
}

/** Immutable patch of delivery on a 1.1.0 result (new object). */
export function withDeliveryUpdate(
  result: ProductionResult,
  delivery: ProductionDelivery
): ProductionResult {
  return Object.freeze(
    JSON.parse(
      JSON.stringify({
        ...result,
        schemaVersion: PRODUCTION_RESULT_SCHEMA_VERSION,
        delivery,
      })
    ) as ProductionResult
  );
}
