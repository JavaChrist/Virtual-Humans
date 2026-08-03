/**
 * MergeEngine stub — explicitly unavailable (VHS-111).
 * Does not duplicate fal compose tracks/keyframes (see backlog VHS-111B).
 * Never fabricates a final asset.
 */

import {
  STUB_MERGE_CAPABILITIES,
  validateMergePlanAgainstCapabilities,
  type MergeExecutionContext,
  type MergePlan,
  type MergeResult,
  type MergeValidationResult,
} from "@/domain/postproduction";
import type { MergeEngine } from "./ports";

export function createUnavailableMergeEngine(): MergeEngine {
  return {
    capabilities: STUB_MERGE_CAPABILITIES,

    async validate(plan): Promise<MergeValidationResult> {
      return validateMergePlanAgainstCapabilities(plan, STUB_MERGE_CAPABILITIES);
    },

    async execute(plan: MergePlan, context: MergeExecutionContext): Promise<MergeResult> {
      void plan;
      return {
        status: "failed",
        failedAt: context.requestedAt,
        error: {
          code: "merge_adapter_not_configured",
          retryable: false,
          publicMessage:
            "Merge adapter non configuré. Utiliser createFalComposeMergeEngine({ client }).",
        },
      };
    },

    // poll / cancel intentionally omitted — unsupported
  };
}
