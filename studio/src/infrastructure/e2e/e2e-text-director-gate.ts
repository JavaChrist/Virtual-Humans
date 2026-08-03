/**
 * Shared dry-run / execute gate helpers for E2E fake text directors.
 */

import {
  E2E_FAKE_MODEL_ID,
  isDirectorE2eFakeMode,
} from "@/infrastructure/config/e2e-fake-mode";

export { E2E_FAKE_MODEL_ID, isDirectorE2eFakeMode };

/** Synthetic OpenAI-shaped config used only when E2E fake mode is active. */
export function e2eFakeOpenAiConfig() {
  return {
    apiKey: undefined as string | undefined,
    apiKeyPresent: false,
    model: E2E_FAKE_MODEL_ID,
    reasoningEffort: "low" as const,
    maxOutputTokens: 1024,
    timeoutMs: 30_000,
    requireFirmPricing: false,
    workspaceId: undefined as string | undefined,
    safetyIdentifierSecret: undefined as string | undefined,
  };
}

/**
 * executionAvailable when E2E fake mode OR (paid AI path + pricing).
 */
export function textDirectorExecutionAvailable(opts: {
  env: Record<string, string | undefined>;
  domainExecutable: boolean;
  paidPathAvailable: boolean;
  pricingConfigured: boolean;
}): boolean {
  if (!opts.domainExecutable) return false;
  if (isDirectorE2eFakeMode(opts.env)) return true;
  return opts.paidPathAvailable && opts.pricingConfigured;
}
