/**
 * Application routing helpers (VHS-107).
 * No Model Router — registry build / legacy adapter only.
 */

export {
  buildRegistryFromLegacyPricing,
  type BuildRegistryFromLegacyPricingInput,
  type LegacyVideoModelInput,
  type LegacyLipsyncModelInput,
  type LegacyImagePriceTable,
} from "./legacy-pricing-adapter";

export {
  buildCapabilityRegistry,
  type BuildCapabilityRegistryInput,
} from "./registry-builder";

export { buildRegistryFromStudioPricing } from "./build-from-studio-pricing";

export {
  createModelRouter,
  runModelRouterDryRun,
  type ModelRouter,
  type ModelRouterDryRunInput,
  type ModelRouterDryRunResult,
  type ModelRouterInput,
  type ModelRouterResult,
  type RoutingContext,
  type GenerationPlan,
} from "./model-router";

