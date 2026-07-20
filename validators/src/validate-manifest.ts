import type { ValidationResult } from "./validate-schema";

/**
 * Validate a character.manifest.json file.
 * Not implemented yet.
 */
export function validateManifest(_input: unknown): ValidationResult {
  return {
    valid: false,
    issues: [
      {
        path: "$",
        code: "not_implemented",
        message: "Manifest validation is not implemented yet.",
        severity: "error",
      },
    ],
  };
}
