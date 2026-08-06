import { publicMessageForCreativeFailureCode } from "@/application/directors/creative/failures";

export type CreativeApiErrorBody = {
  error?: { code?: string; message?: string };
  missingInformation?: Array<{ message: string }>;
};

export function messageFromCreativeApiError(
  body: CreativeApiErrorBody,
  fallback = "Analyse créative impossible.",
): string {
  // Prefer server publicMessage when present; never fall back to Marketing wording.
  return (
    body.error?.message ??
    publicMessageForCreativeFailureCode(body.error?.code) ??
    fallback
  );
}
