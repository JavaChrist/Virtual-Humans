import type { ValidationResult } from "./validate-schema";

/**
 * Validate a character lock file.
 * Not implemented yet.
 */
export function validateCharacterLock(_input: unknown): ValidationResult {
  return {
    valid: false,
    issues: [
      {
        path: "$",
        code: "not_implemented",
        message: "Character lock validation is not implemented yet.",
        severity: "error",
      },
    ],
  };
}
