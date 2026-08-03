/**
 * GenerationPlan artifact contract (VHS-108).
 */

import type { ArtifactMetadata } from "@/domain/shared";
import type { CurrencyCode } from "@/domain/shared";
import type { BudgetDecision, CostEstimate, MediaAction, Money } from "@/domain/cost";
import type { CapabilityProfile } from "@/domain/prompt";
import type { MediaOutputType, ModelId, ProviderId } from "@/domain/routing/capabilities";
import type {
  ModelSelectionExplanation,
  RoutingRationale,
  RoutingWarning,
  SceneRoutingRationale,
} from "./explanation";
import type { GenerationStrategyId } from "./strategies";

export const GENERATION_PLAN_SCHEMA_VERSION = "1.0.0" as const;
export const GENERATION_PLAN_ARTIFACT_TYPE = "generation_plan" as const;

export type GenerationInputRef = {
  kind: "scene_reference" | "step_output" | "prompt_variant" | "package_block";
  id: string;
  role: string;
};

export type OutputContract = {
  mediaType: MediaOutputType;
  aspectRatio?: string;
  durationSeconds?: number;
};

export type FallbackStep = {
  order: 1 | 2;
  providerId: ProviderId;
  modelId: ModelId;
  estimate: CostEstimate;
  reason: string;
  eligibilityEvidence: string[];
};

export type GenerationStep = {
  id: string;
  order: number;
  action: MediaAction;
  capabilityProfile: CapabilityProfile;
  providerId: ProviderId;
  modelId: ModelId;
  promptVariantId?: string;
  inputRefs: GenerationInputRef[];
  dependsOnStepIds: string[];
  expectedOutput: OutputContract;
  timeoutSeconds: number;
  estimate: CostEstimate;
  fallbacks: FallbackStep[];
  selection: ModelSelectionExplanation;
};

export type SceneGenerationPlan = {
  sceneId: string;
  sceneOrder: number;
  strategy: GenerationStrategyId;
  steps: GenerationStep[];
  estimatedCost: Money;
  estimatedDurationSeconds: number;
  /** Potential max exposure if all fallbacks fire (not committed). */
  fallbackExposure?: Money;
  rationale: SceneRoutingRationale;
};

export type GenerationPlanFields = {
  artifactType: typeof GENERATION_PLAN_ARTIFACT_TYPE;
  storyboardRevisionId: string;
  scenePackageRevisionIds: string[];
  registryVersion: string;
  policyVersion: string;
  currency: CurrencyCode;
  scenePlans: SceneGenerationPlan[];
  estimatedCost: Money;
  estimatedDurationSeconds: number;
  /** Max exposure including fallbacks when calculable. */
  fallbackExposure?: Money;
  budgetDecision: BudgetDecision;
  rationale: RoutingRationale;
  warnings: RoutingWarning[];
};

export type GenerationPlan = ArtifactMetadata & GenerationPlanFields;

export type RoutingContext = {
  at: string;
  correlationId: string;
};
