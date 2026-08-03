/**
 * OpenAI Marketing analyzer dry-run — no network (VHS-117A).
 */

import type { VideoProjectBrief } from "@/domain/brief";
import type { BudgetDecision } from "@/domain/cost";
import { assessMarketingBriefReadiness } from "@/domain/marketing";
import {
  canExecuteMarketingAi,
  isDirectorV2MarketingAiEnabled,
  isDirectorV2PaidAiEnabled,
} from "@/infrastructure/config/feature-flags";
import {
  openAIMarketingConfigSnapshot,
  parseOpenAIMarketingConfig,
  type OpenAIMarketingConfig,
} from "../config";
import type { AiTokenPricingPort } from "./pricing";
import { createUnknownAiTokenPricing } from "./pricing";
import {
  MARKETING_ANALYZER_PROMPT_VERSION,
  MARKETING_ANALYZER_SYSTEM_PROMPT,
} from "./prompt";
import {
  approximateTokenCount,
  mapMarketingAnalysisRequest,
} from "./request-mapper";
import {
  MARKETING_CANDIDATE_SCHEMA_VERSION,
  getMarketingCandidateJsonSchema,
} from "./response-schema";

export type OpenAIMarketingDryRunValidation = {
  code: string;
  passed: boolean;
  message: string;
};

export type OpenAIMarketingDryRunWarning = {
  code: string;
  message: string;
};

export type OpenAIMarketingDryRunResult = {
  executable: boolean;
  providerCalled: false;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  pricingConfigured: boolean;
  budgetDecision?: BudgetDecision;
  validations: OpenAIMarketingDryRunValidation[];
  warnings: OpenAIMarketingDryRunWarning[];
  /** Clearly approximate — not billed usage. */
  approximateInputTokens?: number;
  maxOutputTokens: number;
};

export type OpenAIMarketingDryRunDeps = {
  env?: Record<string, string | undefined>;
  config?: OpenAIMarketingConfig;
  pricing?: AiTokenPricingPort;
  /** Optional firm budget check against approximate max cost when pricing known. */
  evaluateBudget?: (estimatedMaxMinor: number) => BudgetDecision | undefined;
};

export function runOpenAIMarketingDryRun(
  brief: VideoProjectBrief,
  deps: OpenAIMarketingDryRunDeps = {}
): OpenAIMarketingDryRunResult {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const validations: OpenAIMarketingDryRunValidation[] = [];
  const warnings: OpenAIMarketingDryRunWarning[] = [];

  let config: OpenAIMarketingConfig;
  try {
    config = deps.config ?? parseOpenAIMarketingConfig(env);
  } catch (e) {
    return {
      executable: false,
      providerCalled: false,
      model: "unknown",
      promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
      schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
      pricingConfigured: false,
      validations: [
        {
          code: "config",
          passed: false,
          message: e instanceof Error ? e.message : "Configuration invalide.",
        },
      ],
      warnings: [],
      maxOutputTokens: 0,
    };
  }

  const snap = openAIMarketingConfigSnapshot(config);
  const pricing = deps.pricing ?? createUnknownAiTokenPricing();
  const pricingConfigured = pricing.getPriceBook(config.model) != null;

  validations.push({
    code: "marketing_ai_flag",
    passed: isDirectorV2MarketingAiEnabled(env),
    message: isDirectorV2MarketingAiEnabled(env)
      ? "Flag Marketing AI activé."
      : "Flag Marketing AI désactivé.",
  });
  validations.push({
    code: "paid_ai_flag",
    passed: isDirectorV2PaidAiEnabled(env),
    message: isDirectorV2PaidAiEnabled(env)
      ? "Flag Paid AI activé."
      : "Flag Paid AI désactivé.",
  });
  validations.push({
    code: "api_key",
    passed: snap.apiKeyPresent,
    message: snap.apiKeyPresent ? "Clé OpenAI présente." : "Clé OpenAI absente.",
  });
  validations.push({
    code: "schema",
    passed: getMarketingCandidateJsonSchema().type === "object",
    message: "Schema JSON Marketing disponible.",
  });
  validations.push({
    code: "pricing",
    passed: pricingConfigured || !config.requireFirmPricing,
    message: pricingConfigured
      ? "Tarification injectée disponible."
      : config.requireFirmPricing
        ? "Tarification absente alors qu’une estimation ferme est exigée."
        : "Tarification absente — coût unknown autorisé.",
  });

  const mapped = mapMarketingAnalysisRequest({ brief });
  validations.push({
    code: "injection",
    passed: mapped.blockingFindings.length === 0,
    message:
      mapped.blockingFindings.length === 0
        ? "Aucun blocage d’injection."
        : "Injection bloquante détectée.",
  });
  for (const f of mapped.findings.filter((x) => x.severity === "warning")) {
    warnings.push({ code: f.code, message: f.publicMessage });
  }

  const readiness = assessMarketingBriefReadiness(brief);
  validations.push({
    code: "marketing_readiness",
    passed: readiness.executable,
    message: readiness.executable
      ? "Brief prêt pour analyse Marketing."
      : "Brief Marketing non prêt.",
  });

  if (!pricingConfigured) {
    warnings.push({
      code: "pricing_unknown",
      message: "Coût unknown — aucun price book injecté.",
    });
  }

  const approxIn = approximateTokenCount(
    MARKETING_ANALYZER_SYSTEM_PROMPT + mapped.userMessage
  );
  warnings.push({
    code: "approx_tokens",
    message: `Estimation tokens d’entrée approximative: ${approxIn} (non facturable).`,
  });

  let budgetDecision: BudgetDecision | undefined;
  if (deps.evaluateBudget && pricingConfigured) {
    // Conservative upper bound using max output tokens if price book exists
    const book = pricing.getPriceBook(config.model)!;
    const maxMinor =
      Math.floor((approxIn * book.inputPerMillionMinor) / 1_000_000) +
      Math.floor(
        (config.maxOutputTokens * book.outputPerMillionMinor) / 1_000_000
      );
    budgetDecision = deps.evaluateBudget(maxMinor);
    validations.push({
      code: "budget",
      passed: budgetDecision?.allowed !== false,
      message:
        budgetDecision?.allowed === false
          ? "Budget insuffisant pour l’estimation haute."
          : "Budget OK pour l’estimation haute.",
    });
  }

  const executable =
    canExecuteMarketingAi(env) &&
    snap.apiKeyPresent &&
    mapped.blockingFindings.length === 0 &&
    readiness.executable &&
    (pricingConfigured || !config.requireFirmPricing) &&
    budgetDecision?.allowed !== false;

  return {
    executable,
    providerCalled: false,
    model: config.model,
    promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
    schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
    pricingConfigured,
    budgetDecision,
    validations,
    warnings,
    approximateInputTokens: approxIn,
    maxOutputTokens: config.maxOutputTokens,
  };
}
