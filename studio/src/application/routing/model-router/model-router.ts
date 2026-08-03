/**
 * Model Router application façade (VHS-108).
 * Pure orchestration — no providers, no persistence, no UI.
 */

import {
  routeModelPlan,
  type ModelRouterInput,
  type ModelRouterResult,
  type RoutingContext,
} from "@/domain/routing/router";

export interface ModelRouter {
  route(input: ModelRouterInput, context: RoutingContext): ModelRouterResult;
}

export function createModelRouter(): ModelRouter {
  return {
    route(input, context) {
      // Defensive shallow freeze of inputs is not required; engine must not mutate.
      const snapshotPackages = input.scenePackages;
      const snapshotStoryboard = input.storyboard;
      const result = routeModelPlan(input, context);
      // Ensure references unchanged
      if (input.scenePackages !== snapshotPackages || input.storyboard !== snapshotStoryboard) {
        throw new Error("ModelRouter must not replace input references.");
      }
      return result;
    },
  };
}
