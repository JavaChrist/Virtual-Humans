import type { ValidationResult } from "./validate-schema";

/**
 * Validate a character manifest / character SDK entry.
 * Not implemented yet.
 */
export function validateCharacter(_input: unknown): ValidationResult {
  return {
    valid: false,
    issues: [
      {
        path: "$",
        code: "not_implemented",
        message: "Character validation is not implemented yet.",
        severity: "error",
      },
    ],
  };
}
