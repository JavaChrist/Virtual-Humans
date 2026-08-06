/**
 * OpenAI Creative analyzer dry-run — no network (VHS-118A).
 */

import type { VideoProjectBrief } from "@/domain/brief";
import type { BudgetDecision } from "@/domain/cost";
import {
  assessCreativeReadiness,
  resolveCreativeArcBeatBudget,
} from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import {
  canExecuteCreativeAi,
  isDirectorV2CreativeAiEnabled,
  isDirectorV2PaidAiEnabled,
} from "@/infrastructure/config/feature-flags";
import {
  openAICreativeConfigSnapshot,
  parseOpenAICreativeConfig,
  type OpenAICreativeConfig,
} from "../config";
import type { AiTokenPricingPort } from "../marketing/pricing";
import { createUnknownAiTokenPricing } from "../marketing/pricing";
import {
  CREATIVE_ANALYZER_PROMPT_VERSION,
  buildCreativeAnalyzerInstructions,
} from "./prompt";
import {
  approximateCreativeTokenCount,
  mapCreativeAnalysisRequest,
} from "./mapping";
import {
  CREATIVE_CANDIDATE_SCHEMA_VERSION,
  getCreativeCandidateJsonSchema,
  getCreativeCandidateTextFormat,
} from "./schema";

export type OpenAICreativeDryRunValidation = {
  code: string;
  passed: boolean;
  message: string;
};

export type OpenAICreativeDryRunWarning = {
  code: string;
  message: string;
};

export type OpenAICreativeDryRunResult = {
  executable: boolean;
  providerCalled: false;
  model: string;
  reasoningEffort: string;
  promptVersion: string;
  schemaVersion: string;
  pricingConfigured: boolean;
  budgetDecision?: BudgetDecision;
  validations: OpenAICreativeDryRunValidation[];
  warnings: OpenAICreativeDryRunWarning[];
  approximateInputTokens?: number;
  maxOutputTokens: number;
  /** Domain-computed once for this brief (8H-B). */
  durationSeconds?: number;
  maxBeats?: number;
};

export type OpenAICreativeDryRunDeps = {
  env?: Record<string, string | undefined>;
  config?: OpenAICreativeConfig;
  pricing?: AiTokenPricingPort;
  evaluateBudget?: (estimatedMaxMinor: number) => BudgetDecision | undefined;
};

export function runOpenAICreativeDryRun(
  brief: VideoProjectBrief,
  marketingPlan: MarketingPlan,
  deps: OpenAICreativeDryRunDeps = {}
): OpenAICreativeDryRunResult {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const validations: OpenAICreativeDryRunValidation[] = [];
  const warnings: OpenAICreativeDryRunWarning[] = [];

  let config: OpenAICreativeConfig;
  try {
    config = deps.config ?? parseOpenAICreativeConfig(env);
  } catch (e) {
    return {
      executable: false,
      providerCalled: false,
      model: "unknown",
      reasoningEffort: "unknown",
      promptVersion: CREATIVE_ANALYZER_PROMPT_VERSION,
      schemaVersion: CREATIVE_CANDIDATE_SCHEMA_VERSION,
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

  const snap = openAICreativeConfigSnapshot(config);
  const pricing = deps.pricing ?? createUnknownAiTokenPricing();
  const pricingConfigured = pricing.getPriceBook(config.model) != null;

  validations.push({
    code: "creative_ai_flag",
    passed: isDirectorV2CreativeAiEnabled(env),
    message: isDirectorV2CreativeAiEnabled(env)
      ? "Flag Creative AI activé."
      : "Flag Creative AI désactivé.",
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
    passed: getCreativeCandidateJsonSchema().type === "object",
    message: "Schema JSON Creative disponible.",
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

  const mapped = mapCreativeAnalysisRequest({ brief, marketingPlan });
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

  const readiness = assessCreativeReadiness(marketingPlan, brief);
  validations.push({
    code: "creative_readiness",
    passed: readiness.executable,
    message: readiness.executable
      ? "Brief + MarketingPlan prêts pour analyse Creative."
      : "Brief ou MarketingPlan non prêt pour Creative.",
  });

  if (!pricingConfigured) {
    warnings.push({
      code: "pricing_unknown",
      message: "Coût unknown — aucun price book injecté.",
    });
  }

  // 8H-B — same one-shot budget as adapter (prompt + schema maxItems).
  const arcBudget = resolveCreativeArcBeatBudget(brief.durationSeconds);
  const instructions = buildCreativeAnalyzerInstructions(arcBudget);
  const textFormat = getCreativeCandidateTextFormat({
    maxBeats: arcBudget.maxBeats,
  });
  const schemaMaxItems = (
    (textFormat.schema as { properties?: { emotionalArc?: { maxItems?: number } } })
      .properties?.emotionalArc?.maxItems
  );
  validations.push({
    code: "arc_beat_budget",
    passed: schemaMaxItems === arcBudget.maxBeats,
    message:
      schemaMaxItems === arcBudget.maxBeats
        ? `Arc duration=${arcBudget.durationSeconds}s → maxBeats=${arcBudget.maxBeats} (prompt + schema).`
        : `Incohérence maxBeats (budget=${arcBudget.maxBeats}, schema=${schemaMaxItems}).`,
  });

  const approxIn = approximateCreativeTokenCount(
    instructions + mapped.userMessage
  );
  warnings.push({
    code: "approx_tokens",
    message: `Estimation tokens d’entrée approximative: ${approxIn} (non facturable).`,
  });

  let budgetDecision: BudgetDecision | undefined;
  if (deps.evaluateBudget && pricingConfigured) {
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
    canExecuteCreativeAi(env) &&
    snap.apiKeyPresent &&
    mapped.blockingFindings.length === 0 &&
    readiness.executable &&
    (pricingConfigured || !config.requireFirmPricing) &&
    budgetDecision?.allowed !== false;

  return {
    executable,
    providerCalled: false,
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    promptVersion: CREATIVE_ANALYZER_PROMPT_VERSION,
    schemaVersion: CREATIVE_CANDIDATE_SCHEMA_VERSION,
    pricingConfigured,
    budgetDecision,
    validations,
    warnings,
    approximateInputTokens: approxIn,
    maxOutputTokens: config.maxOutputTokens,
    durationSeconds: arcBudget.durationSeconds,
    maxBeats: arcBudget.maxBeats,
  };
}
