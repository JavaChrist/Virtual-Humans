import { publicMessageForMarketingFailureCode } from "@/application/directors/marketing/failures";

export type CreativeApiErrorBody = {
  error?: { code?: string; message?: string };
  missingInformation?: Array<{ message: string }>;
};

export function messageFromCreativeApiError(body: CreativeApiErrorBody, fallback = "Analyse créative impossible."): string {
  return body.error?.message ?? publicMessageForMarketingFailureCode(body.error?.code) ?? fallback;
}
