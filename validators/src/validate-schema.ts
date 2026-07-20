export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Placeholder for JSON Schema Draft 2020-12 validation.
 * Not implemented yet: returns a single "not implemented" error.
 */
export function validateSchema(_schema: unknown, _data: unknown): ValidationResult {
  return {
    valid: false,
    issues: [
      {
        path: "$",
        code: "not_implemented",
        message: "Schema validation is not implemented yet.",
        severity: "error",
      },
    ],
  };
}
