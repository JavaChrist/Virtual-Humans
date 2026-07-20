import type { ValidationResult } from "./validate-schema";

/**
 * Validate a generation record.
 * Not implemented yet.
 */
export function validateGeneration(_input: unknown): ValidationResult {
  return {
    valid: false,
    issues: [
      {
        path: "$",
        code: "not_implemented",
        message: "Generation validation is not implemented yet.",
        severity: "error",
      },
    ],
  };
}
