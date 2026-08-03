/**
 * Server-side OpenAI analyzer config (VHS-117A / VHS-118A).
 * Never logs or returns the API key value.
 */

import {
  OPENAI_REASONING_EFFORT_VALUES,
  type OpenAIReasoningEffort,
} from "./contracts";
import { OpenAIAiError } from "./errors";

export const DEFAULT_OPENAI_MARKETING_MODEL = "gpt-5.6-terra";
export const DEFAULT_OPENAI_CREATIVE_MODEL = "gpt-5.6-terra";
export const DEFAULT_OPENAI_SCRIPT_MODEL = "gpt-5.6-terra";
export const DEFAULT_OPENAI_ART_MODEL = "gpt-5.6-terra";
export const DEFAULT_OPENAI_STORYBOARD_MODEL = "gpt-5.6-terra";
export const DEFAULT_OPENAI_MARKETING_REASONING_EFFORT: OpenAIReasoningEffort = "low";
export const DEFAULT_OPENAI_CREATIVE_REASONING_EFFORT: OpenAIReasoningEffort = "low";
export const DEFAULT_OPENAI_SCRIPT_REASONING_EFFORT: OpenAIReasoningEffort = "low";
export const DEFAULT_OPENAI_ART_REASONING_EFFORT: OpenAIReasoningEffort = "low";
export const DEFAULT_OPENAI_STORYBOARD_REASONING_EFFORT: OpenAIReasoningEffort = "low";
export const DEFAULT_OPENAI_MARKETING_MAX_OUTPUT_TOKENS = 4096;
export const DEFAULT_OPENAI_CREATIVE_MAX_OUTPUT_TOKENS = 1600;
export const DEFAULT_OPENAI_SCRIPT_MAX_OUTPUT_TOKENS = 2400;
export const DEFAULT_OPENAI_ART_MAX_OUTPUT_TOKENS = 2800;
export const DEFAULT_OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS = 3200;
export const OPENAI_MARKETING_MAX_OUTPUT_TOKENS_MIN = 256;
export const OPENAI_MARKETING_MAX_OUTPUT_TOKENS_MAX = 16_384;
export const OPENAI_CREATIVE_MAX_OUTPUT_TOKENS_MIN = 256;
export const OPENAI_CREATIVE_MAX_OUTPUT_TOKENS_MAX = 16_384;
export const OPENAI_SCRIPT_MAX_OUTPUT_TOKENS_MIN = 256;
export const OPENAI_SCRIPT_MAX_OUTPUT_TOKENS_MAX = 16_384;
export const OPENAI_ART_MAX_OUTPUT_TOKENS_MIN = 256;
export const OPENAI_ART_MAX_OUTPUT_TOKENS_MAX = 16_384;
export const OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS_MIN = 256;
export const OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS_MAX = 16_384;
export const DEFAULT_OPENAI_MARKETING_TIMEOUT_MS = 60_000;
export const DEFAULT_OPENAI_CREATIVE_TIMEOUT_MS = 60_000;
export const DEFAULT_OPENAI_SCRIPT_TIMEOUT_MS = 60_000;
export const DEFAULT_OPENAI_ART_TIMEOUT_MS = 60_000;
export const DEFAULT_OPENAI_STORYBOARD_TIMEOUT_MS = 60_000;
export const OPENAI_MARKETING_TIMEOUT_MS_MAX = 120_000;
export const OPENAI_CREATIVE_TIMEOUT_MS_MAX = 120_000;
export const OPENAI_SCRIPT_TIMEOUT_MS_MAX = 120_000;
export const OPENAI_ART_TIMEOUT_MS_MAX = 120_000;
export const OPENAI_STORYBOARD_TIMEOUT_MS_MAX = 120_000;

export type OpenAIMarketingConfig = {
  apiKeyPresent: boolean;
  apiKey: string | undefined;
  model: string;
  reasoningEffort: OpenAIReasoningEffort;
  maxOutputTokens: number;
  timeoutMs: number;
  /** When true, real calls require configured token pricing. Default false. */
  requireFirmPricing: boolean;
  workspaceId: string | undefined;
  safetyIdentifierSecret: string | undefined;
};

export type OpenAICreativeConfig = OpenAIMarketingConfig;
export type OpenAIScriptConfig = OpenAIMarketingConfig;
export type OpenAIArtConfig = OpenAIMarketingConfig;
export type OpenAIStoryboardConfig = OpenAIMarketingConfig;

function parseEffort(
  raw: string | undefined,
  defaultEffort: OpenAIReasoningEffort,
  label: string
): OpenAIReasoningEffort {
  const v = (raw ?? defaultEffort).trim().toLowerCase();
  if ((OPENAI_REASONING_EFFORT_VALUES as readonly string[]).includes(v)) {
    return v as OpenAIReasoningEffort;
  }
  throw new OpenAIAiError("invalid_request", {
    internalCode: "invalid_reasoning_effort",
    publicMessage: `Effort de raisonnement ${label} invalide.`,
  });
}

function parseMaxTokens(
  raw: string | undefined,
  defaultTokens: number,
  min: number,
  max: number
): number {
  if (raw == null || raw.trim() === "") return defaultTokens;
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new OpenAIAiError("invalid_request", {
      internalCode: "invalid_max_output_tokens",
      publicMessage: "Limite de tokens de sortie invalide.",
    });
  }
  if (n < min || n > max) {
    throw new OpenAIAiError("invalid_request", {
      internalCode: "max_output_tokens_out_of_bounds",
      publicMessage: "Limite de tokens de sortie hors bornes.",
    });
  }
  return n;
}

function parseModel(raw: string | undefined, defaultModel: string): string {
  const model = (raw ?? defaultModel).trim();
  if (!model || model.length > 120 || !/^[a-zA-Z0-9._:-]+$/.test(model)) {
    throw new OpenAIAiError("unsupported_model", {
      internalCode: "invalid_model_id",
    });
  }
  return model;
}

function sharedSecrets(
  env: Record<string, string | undefined>
): Pick<
  OpenAIMarketingConfig,
  "apiKeyPresent" | "apiKey" | "workspaceId" | "safetyIdentifierSecret"
> {
  const apiKey = env.OPENAI_API_KEY?.trim() || undefined;
  return {
    apiKeyPresent: Boolean(apiKey),
    apiKey,
    workspaceId: env.DIRECTOR_V2_WORKSPACE_ID?.trim() || undefined,
    safetyIdentifierSecret: env.OPENAI_SAFETY_IDENTIFIER_SECRET?.trim() || undefined,
  };
}

/** Parse config without throwing on missing key — adapter gates paid calls. */
export function parseOpenAIMarketingConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): OpenAIMarketingConfig {
  return {
    ...sharedSecrets(env),
    model: parseModel(env.OPENAI_MARKETING_MODEL, DEFAULT_OPENAI_MARKETING_MODEL),
    reasoningEffort: parseEffort(
      env.OPENAI_MARKETING_REASONING_EFFORT,
      DEFAULT_OPENAI_MARKETING_REASONING_EFFORT,
      "Marketing"
    ),
    maxOutputTokens: parseMaxTokens(
      env.OPENAI_MARKETING_MAX_OUTPUT_TOKENS,
      DEFAULT_OPENAI_MARKETING_MAX_OUTPUT_TOKENS,
      OPENAI_MARKETING_MAX_OUTPUT_TOKENS_MIN,
      OPENAI_MARKETING_MAX_OUTPUT_TOKENS_MAX
    ),
    timeoutMs: Math.min(
      OPENAI_MARKETING_TIMEOUT_MS_MAX,
      Math.max(
        1_000,
        Number(env.OPENAI_MARKETING_TIMEOUT_MS) || DEFAULT_OPENAI_MARKETING_TIMEOUT_MS
      )
    ),
    requireFirmPricing: env.OPENAI_MARKETING_REQUIRE_PRICING === "1",
  };
}

/** Creative analyzer config (VHS-118A) — separate model/token knobs, shared key. */
export function parseOpenAICreativeConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): OpenAICreativeConfig {
  return {
    ...sharedSecrets(env),
    model: parseModel(env.OPENAI_CREATIVE_MODEL, DEFAULT_OPENAI_CREATIVE_MODEL),
    reasoningEffort: parseEffort(
      env.OPENAI_CREATIVE_REASONING_EFFORT,
      DEFAULT_OPENAI_CREATIVE_REASONING_EFFORT,
      "Creative"
    ),
    maxOutputTokens: parseMaxTokens(
      env.OPENAI_CREATIVE_MAX_OUTPUT_TOKENS,
      DEFAULT_OPENAI_CREATIVE_MAX_OUTPUT_TOKENS,
      OPENAI_CREATIVE_MAX_OUTPUT_TOKENS_MIN,
      OPENAI_CREATIVE_MAX_OUTPUT_TOKENS_MAX
    ),
    timeoutMs: Math.min(
      OPENAI_CREATIVE_TIMEOUT_MS_MAX,
      Math.max(
        1_000,
        Number(env.OPENAI_CREATIVE_TIMEOUT_MS) || DEFAULT_OPENAI_CREATIVE_TIMEOUT_MS
      )
    ),
    requireFirmPricing: env.OPENAI_CREATIVE_REQUIRE_PRICING === "1",
  };
}

/** Script analyzer config (VHS-119A) — separate model/token knobs, shared key. */
export function parseOpenAIScriptConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): OpenAIScriptConfig {
  return {
    ...sharedSecrets(env),
    model: parseModel(env.OPENAI_SCRIPT_MODEL, DEFAULT_OPENAI_SCRIPT_MODEL),
    reasoningEffort: parseEffort(
      env.OPENAI_SCRIPT_REASONING_EFFORT,
      DEFAULT_OPENAI_SCRIPT_REASONING_EFFORT,
      "Script"
    ),
    maxOutputTokens: parseMaxTokens(
      env.OPENAI_SCRIPT_MAX_OUTPUT_TOKENS,
      DEFAULT_OPENAI_SCRIPT_MAX_OUTPUT_TOKENS,
      OPENAI_SCRIPT_MAX_OUTPUT_TOKENS_MIN,
      OPENAI_SCRIPT_MAX_OUTPUT_TOKENS_MAX
    ),
    timeoutMs: Math.min(
      OPENAI_SCRIPT_TIMEOUT_MS_MAX,
      Math.max(1_000, Number(env.OPENAI_SCRIPT_TIMEOUT_MS) || DEFAULT_OPENAI_SCRIPT_TIMEOUT_MS)
    ),
    requireFirmPricing: env.OPENAI_SCRIPT_REQUIRE_PRICING === "1",
  };
}

/** Art analyzer config (VHS-120A) — separate model/token knobs, shared key. */
export function parseOpenAIArtConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): OpenAIArtConfig {
  return {
    ...sharedSecrets(env),
    model: parseModel(env.OPENAI_ART_MODEL, DEFAULT_OPENAI_ART_MODEL),
    reasoningEffort: parseEffort(
      env.OPENAI_ART_REASONING_EFFORT,
      DEFAULT_OPENAI_ART_REASONING_EFFORT,
      "Art"
    ),
    maxOutputTokens: parseMaxTokens(
      env.OPENAI_ART_MAX_OUTPUT_TOKENS,
      DEFAULT_OPENAI_ART_MAX_OUTPUT_TOKENS,
      OPENAI_ART_MAX_OUTPUT_TOKENS_MIN,
      OPENAI_ART_MAX_OUTPUT_TOKENS_MAX
    ),
    timeoutMs: Math.min(
      OPENAI_ART_TIMEOUT_MS_MAX,
      Math.max(1_000, Number(env.OPENAI_ART_TIMEOUT_MS) || DEFAULT_OPENAI_ART_TIMEOUT_MS)
    ),
    requireFirmPricing: env.OPENAI_ART_REQUIRE_PRICING === "1",
  };
}

/** Storyboard analyzer config (VHS-121A) — separate model/token knobs, shared key. */
export function parseOpenAIStoryboardConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): OpenAIStoryboardConfig {
  return {
    ...sharedSecrets(env),
    model: parseModel(env.OPENAI_STORYBOARD_MODEL, DEFAULT_OPENAI_STORYBOARD_MODEL),
    reasoningEffort: parseEffort(
      env.OPENAI_STORYBOARD_REASONING_EFFORT,
      DEFAULT_OPENAI_STORYBOARD_REASONING_EFFORT,
      "Storyboard"
    ),
    maxOutputTokens: parseMaxTokens(
      env.OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS,
      DEFAULT_OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS,
      OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS_MIN,
      OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS_MAX
    ),
    timeoutMs: Math.min(
      OPENAI_STORYBOARD_TIMEOUT_MS_MAX,
      Math.max(1_000, Number(env.OPENAI_STORYBOARD_TIMEOUT_MS) || DEFAULT_OPENAI_STORYBOARD_TIMEOUT_MS)
    ),
    requireFirmPricing: env.OPENAI_STORYBOARD_REQUIRE_PRICING === "1",
  };
}

/** Public snapshot — never includes secrets. */
export function openAIMarketingConfigSnapshot(cfg: OpenAIMarketingConfig): {
  apiKeyPresent: boolean;
  model: string;
  reasoningEffort: OpenAIReasoningEffort;
  maxOutputTokens: number;
  timeoutMs: number;
  requireFirmPricing: boolean;
  workspaceConfigured: boolean;
  safetyIdentifierReady: boolean;
} {
  return {
    apiKeyPresent: cfg.apiKeyPresent,
    model: cfg.model,
    reasoningEffort: cfg.reasoningEffort,
    maxOutputTokens: cfg.maxOutputTokens,
    timeoutMs: cfg.timeoutMs,
    requireFirmPricing: cfg.requireFirmPricing,
    workspaceConfigured: Boolean(cfg.workspaceId),
    safetyIdentifierReady: Boolean(cfg.workspaceId && cfg.safetyIdentifierSecret),
  };
}

export const openAICreativeConfigSnapshot = openAIMarketingConfigSnapshot;
export const openAIScriptConfigSnapshot = openAIMarketingConfigSnapshot;
export const openAIArtConfigSnapshot = openAIMarketingConfigSnapshot;
export const openAIStoryboardConfigSnapshot = openAIMarketingConfigSnapshot;
