/**
 * Quality validation via port — default uses structured domain checks.
 */

import {
  evaluateStructuredQuality,
  type QualityValidationRequest,
  type QualityValidationResult,
} from "@/domain/production";
import type { QualityValidatorPort } from "./ports";

export function createStructuredQualityValidator(): QualityValidatorPort {
  return {
    async validate(request, context) {
      return evaluateStructuredQuality({
        ...request,
        nowIso: context.nowIso,
      });
    },
  };
}

export async function validateAttemptQuality(
  port: QualityValidatorPort,
  request: QualityValidationRequest,
  context: { correlationId: string; nowIso: string }
): Promise<QualityValidationResult> {
  return port.validate(request, context);
}
