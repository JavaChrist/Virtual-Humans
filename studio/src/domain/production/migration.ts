/**
 * Pure in-memory migration ProductionResult 1.0.0 → 1.1.0 (VHS-111).
 * Never rewrites historical artifacts — returns a new object.
 */

import {
  PRODUCTION_RESULT_ARTIFACT_TYPE,
  PRODUCTION_RESULT_SCHEMA_VERSION,
  PRODUCTION_RESULT_SCHEMA_VERSION_V1,
  type ProductionResult,
  type ProductionResultV1,
} from "./production-result";
import { createInitialDelivery } from "./delivery";

export function isProductionResultV1(value: unknown): value is ProductionResultV1 {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.artifactType === PRODUCTION_RESULT_ARTIFACT_TYPE &&
    v.schemaVersion === PRODUCTION_RESULT_SCHEMA_VERSION_V1 &&
    Array.isArray(v.scenes) &&
    typeof v.status === "string" &&
    !("delivery" in v && v.delivery != null)
  );
}

/**
 * Migrate a 1.0.0 execution result to 1.1.0 with delivery.not_started.
 * Idempotent if already 1.1.0.
 */
export function migrateProductionResultToV11(
  input: ProductionResultV1 | ProductionResult,
  migratedAt: string
): ProductionResult {
  if (
    input.schemaVersion === PRODUCTION_RESULT_SCHEMA_VERSION &&
    "delivery" in input &&
    input.delivery
  ) {
    return Object.freeze(JSON.parse(JSON.stringify(input)) as ProductionResult);
  }

  if (input.schemaVersion !== PRODUCTION_RESULT_SCHEMA_VERSION_V1) {
    // Unknown version — still add delivery if missing without claiming full migration.
    const base = JSON.parse(JSON.stringify(input)) as ProductionResult;
    if (!base.delivery) {
      base.schemaVersion = PRODUCTION_RESULT_SCHEMA_VERSION;
      base.delivery = createInitialDelivery(migratedAt);
    }
    return Object.freeze(base);
  }

  const next: ProductionResult = {
    ...(JSON.parse(JSON.stringify(input)) as ProductionResultV1),
    schemaVersion: PRODUCTION_RESULT_SCHEMA_VERSION,
    delivery: createInitialDelivery(migratedAt),
  };
  return Object.freeze(next);
}
