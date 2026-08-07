/**
 * Pure UI message mapping for Art Director failures (Porte 8P).
 * No provider names, model ids, HTTP status, or stacks.
 */

import { publicMessageForArtFailureCode } from "@/application/directors/art/failures";

export type ArtApiErrorBody = {
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

/** Resolve a safe user-facing message from an Art API error payload. */
export function messageFromArtApiError(
  data: ArtApiErrorBody | null | undefined,
  fallback = "Direction art impossible."
): string {
  if (!data) return fallback;
  const err = data.error;
  if (typeof err === "string" && err.trim()) {
    // Never surface Marketing copy if an older payload leaked it.
    if (/analyse marketing/i.test(err)) {
      return publicMessageForArtFailureCode("internal_error");
    }
    return err;
  }
  if (err && typeof err === "object") {
    if (typeof err.code === "string" && err.code.trim()) {
      return publicMessageForArtFailureCode(err.code);
    }
    if (typeof err.message === "string" && err.message.trim()) {
      if (/analyse marketing/i.test(err.message)) {
        return publicMessageForArtFailureCode("internal_error");
      }
      return err.message;
    }
  }
  if (typeof data.code === "string" && data.code.trim()) {
    return publicMessageForArtFailureCode(data.code);
  }
  return fallback;
}
