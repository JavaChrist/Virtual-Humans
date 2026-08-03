/**
 * Production orchestration policy (pure validation).
 */

import { ProductionDomainError } from "./errors";

export const PRODUCTION_POLICY_VERSION = "production-policy.v1" as const;

export type ProductionPolicy = {
  version: string;
  maxConcurrentScenes: number;
  maxConcurrentSteps: number;
  stopProjectOnSceneFailure: boolean;
  allowPartialResult: boolean;
  qualityFailureAllowsFallback: boolean;
};

export const DEFAULT_PRODUCTION_POLICY: ProductionPolicy = Object.freeze({
  version: PRODUCTION_POLICY_VERSION,
  maxConcurrentScenes: 2,
  maxConcurrentSteps: 4,
  stopProjectOnSceneFailure: false,
  allowPartialResult: true,
  qualityFailureAllowsFallback: false,
});

export function validateProductionPolicy(policy: ProductionPolicy): ProductionPolicy {
  if (!policy || typeof policy !== "object") {
    throw new ProductionDomainError("invalid_policy", "Politique de production invalide.");
  }
  if (typeof policy.version !== "string" || policy.version.trim().length === 0) {
    throw new ProductionDomainError("invalid_policy", "version de politique requise.");
  }
  if (
    !Number.isInteger(policy.maxConcurrentScenes) ||
    policy.maxConcurrentScenes < 1 ||
    policy.maxConcurrentScenes > 32
  ) {
    throw new ProductionDomainError(
      "invalid_policy",
      "maxConcurrentScenes doit être un entier entre 1 et 32."
    );
  }
  if (
    !Number.isInteger(policy.maxConcurrentSteps) ||
    policy.maxConcurrentSteps < 1 ||
    policy.maxConcurrentSteps > 64
  ) {
    throw new ProductionDomainError(
      "invalid_policy",
      "maxConcurrentSteps doit être un entier entre 1 et 64."
    );
  }
  if (typeof policy.stopProjectOnSceneFailure !== "boolean") {
    throw new ProductionDomainError("invalid_policy", "stopProjectOnSceneFailure booléen requis.");
  }
  if (typeof policy.allowPartialResult !== "boolean") {
    throw new ProductionDomainError("invalid_policy", "allowPartialResult booléen requis.");
  }
  if (typeof policy.qualityFailureAllowsFallback !== "boolean") {
    throw new ProductionDomainError(
      "invalid_policy",
      "qualityFailureAllowsFallback booléen requis."
    );
  }
  return Object.freeze({ ...policy });
}
