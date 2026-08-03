/**
 * Strategy templates — provider-agnostic (VHS-108).
 */

import type { CapabilityProfile } from "@/domain/prompt";
import type { MediaAction } from "@/domain/cost";
import type { ProductionIntent } from "@/domain/storyboard";
import type { MediaOutputType } from "@/domain/routing/capabilities";

export const GenerationStrategyIdValues = [
  "direct_video",
  "image_to_video",
  "talking_head",
  "voice_over",
  "carousel",
  "product_demo",
  "tutorial",
  "multi_character",
] as const;
export type GenerationStrategyId = (typeof GenerationStrategyIdValues)[number];

export type StrategyStepTemplate = {
  order: number;
  action: MediaAction;
  capabilityProfile: CapabilityProfile;
  expectedOutput: MediaOutputType;
  /** Relative dependency on prior template orders. */
  dependsOnOrders: number[];
  /** Seconds timeout default for the step. */
  defaultTimeoutSeconds: number;
};

export type StrategyConstraint = {
  code: string;
  description: string;
};

export type StrategyDefinition = {
  id: GenerationStrategyId;
  supportedProductionIntents: ProductionIntent[];
  requiredProfiles: CapabilityProfile[];
  steps: StrategyStepTemplate[];
  constraints: StrategyConstraint[];
  version: string;
};

export const STRATEGY_LIBRARY_VERSION = "strategy-library-v1" as const;
