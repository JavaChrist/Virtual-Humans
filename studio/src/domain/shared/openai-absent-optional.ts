/**
 * OpenAI strict Structured Outputs represent absent optionals as `null`
 * (required + nullable). Zod `.optional()` rejects `null`.
 * Map `null` → undefined before optional validation — no business loosening.
 */

import { z, type ZodTypeAny } from "zod";

export function openaiAbsentOptional<T extends ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (value === null ? undefined : value),
    schema.optional()
  );
}
