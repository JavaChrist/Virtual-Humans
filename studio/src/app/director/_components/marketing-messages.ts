/**
 * Pure UI message mapping for Marketing analysis failures (VHS-117D).
 * No provider names, model ids, HTTP status, or stacks.
 */

import { publicMessageForMarketingFailureCode } from "@/application/directors/marketing/failures";

export type MarketingApiErrorBody = {
  status?: string;
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

/** Resolve a safe user-facing message from a Marketing API error payload. */
export function messageFromMarketingApiError(
  data: MarketingApiErrorBody | null | undefined,
  fallback = "Analyse impossible."
): string {
  if (!data) return fallback;
  const err = data.error;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    if (typeof err.message === "string" && err.message.trim()) {
      return err.message;
    }
    if (typeof err.code === "string" && err.code.trim()) {
      return publicMessageForMarketingFailureCode(err.code);
    }
  }
  if (typeof data.code === "string" && data.code.trim()) {
    return publicMessageForMarketingFailureCode(data.code);
  }
  return fallback;
}
