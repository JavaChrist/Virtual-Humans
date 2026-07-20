import type { ValidationResult } from "./validate-schema";

/**
 * Validate a prompt definition.
 * Not implemented yet.
 */
export function validatePrompt(_input: unknown): ValidationResult {
  return {
    valid: false,
    issues: [
      {
        path: "$",
        code: "not_implemented",
        message: "Prompt validation is not implemented yet.",
        severity: "error",
      },
    ],
  };
}
