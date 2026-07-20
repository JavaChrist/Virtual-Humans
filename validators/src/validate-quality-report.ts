import type { ValidationResult } from "./validate-schema";

/**
 * Validate a quality report.
 * Not implemented yet.
 */
export function validateQualityReport(_input: unknown): ValidationResult {
  return {
    valid: false,
    issues: [
      {
        path: "$",
        code: "not_implemented",
        message: "Quality report validation is not implemented yet.",
        severity: "error",
      },
    ],
  };
}
