/**
 * Pure UI message mapping for Creative analysis failures.
 * Aligned with Marketing treatment (shared Director UX pattern) — 8I-A.
 * No provider names, model ids, HTTP status, or stacks.
 */

import { publicMessageForCreativeFailureCode } from "@/application/directors/creative/failures";

export type CreativeApiErrorBody = {
  status?: string;
  directorRunId?: string;
  error?:
    | string
    | {
        code?: string;
        retryable?: boolean;
        message?: string;
      };
  code?: string;
  missingInformation?: Array<{ message: string }>;
};

/** Resolve a safe user-facing message from a Creative API error payload. */
export function messageFromCreativeApiError(
  data: CreativeApiErrorBody | null | undefined,
  fallback = "Analyse créative impossible.",
): string {
  if (!data) return fallback;
  const err = data.error;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    if (typeof err.message === "string" && err.message.trim()) {
      return err.message;
    }
    if (typeof err.code === "string" && err.code.trim()) {
      return publicMessageForCreativeFailureCode(err.code);
    }
  }
  if (typeof data.code === "string" && data.code.trim()) {
    return publicMessageForCreativeFailureCode(data.code);
  }
  return fallback;
}
