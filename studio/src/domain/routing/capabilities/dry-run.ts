/**
 * Pure registry dry-run (VHS-107).
 * Lists eligible models with exclusion reasons — no ranking or GenerationPlan.
 */

import { isExpired } from "./availability";
import {
  evaluateEligibility,
  type EligibilityWarning,
  type IneligibilityReason,
} from "./eligibility";
import type { CapabilityRegistrySnapshot } from "./registry";
import { findProvider } from "./registry";
import type { CapabilityRequirements } from "./requirements";
import { CapabilityRegistrySnapshotSchema } from "./schemas";

export type RegistryDryRunModelResult = {
  providerId: string;
  modelId: string;
  eligible: boolean;
  reasons: IneligibilityReason[];
  warnings: EligibilityWarning[];
};

export type RegistryDryRunResult = {
  snapshotValid: boolean;
  snapshotExpired: boolean;
  eligibleModels: Array<{ providerId: string; modelId: string }>;
  results: RegistryDryRunModelResult[];
  freshnessWarnings: EligibilityWarning[];
  providerCalled: false;
};

export function runRegistryDryRun(
  snapshot: CapabilityRegistrySnapshot,
  requirements: CapabilityRequirements,
  at: string,
): RegistryDryRunResult {
  const parsed = CapabilityRegistrySnapshotSchema.safeParse(snapshot);
  const snapshotValid = parsed.success;
  const snapshotExpired = isExpired(snapshot.expiresAt, at);
  const freshnessWarnings: EligibilityWarning[] = [];

  if (snapshotExpired) {
    freshnessWarnings.push({
      code: "snapshot_expired",
      message: "Registry snapshot is expired at evaluation time.",
      field: "expiresAt",
    });
  }

  if (!snapshotValid) {
    return {
      snapshotValid: false,
      snapshotExpired,
      eligibleModels: [],
      results: [],
      freshnessWarnings,
      providerCalled: false,
    };
  }

  const results: RegistryDryRunModelResult[] = [];
  for (const model of snapshot.models) {
    const provider = findProvider(snapshot, model.providerId);
    const verdict = evaluateEligibility(model, requirements, at, provider);
    results.push({
      providerId: model.providerId,
      modelId: model.modelId,
      eligible: verdict.eligible,
      reasons: verdict.eligible ? [] : verdict.reasons,
      warnings: verdict.warnings,
    });
  }

  // Stable order already from snapshot; do not rank by score
  const eligibleModels = results
    .filter((r) => r.eligible)
    .map((r) => ({ providerId: r.providerId, modelId: r.modelId }));

  return {
    snapshotValid: true,
    snapshotExpired,
    eligibleModels,
    results,
    freshnessWarnings,
    providerCalled: false,
  };
}
