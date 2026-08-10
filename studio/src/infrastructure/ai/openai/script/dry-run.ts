import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import { assessScriptReadiness } from "@/domain/script";
import type { MarketingPlan } from "@/domain/marketing";
import { canExecuteScriptAi, isDirectorV2PaidAiEnabled, isDirectorV2ScriptAiEnabled } from "@/infrastructure/config/feature-flags";
import { openAIScriptConfigSnapshot, parseOpenAIScriptConfig, type OpenAIScriptConfig } from "../config";
import { createUnknownAiTokenPricing, type AiTokenPricingPort } from "../marketing/pricing";
import { approximateScriptTokenCount, mapScriptAnalysisRequest } from "./mapping";
import { SCRIPT_ANALYZER_SYSTEM_PROMPT, SCRIPT_ANALYZER_PROMPT_VERSION } from "./prompt";
import { getScriptCandidateJsonSchema, SCRIPT_CANDIDATE_SCHEMA_VERSION } from "./schema";

export type OpenAIScriptDryRunResult = {
  executable: boolean; providerCalled: false; model: string; reasoningEffort: string; promptVersion: string; schemaVersion: string;
  pricingConfigured: boolean; validations: Array<{ code: string; passed: boolean; message: string }>;
  warnings: Array<{ code: string; message: string }>; approximateInputTokens?: number; maxOutputTokens: number;
};
export type OpenAIScriptDryRunDeps = {
  env?: Record<string, string | undefined>; config?: OpenAIScriptConfig; pricing?: AiTokenPricingPort;
};

export function runOpenAIScriptDryRun(
  brief: VideoProjectBrief, marketingPlan: MarketingPlan, creativeConcept: CreativeConcept,
  deps: OpenAIScriptDryRunDeps = {}
): OpenAIScriptDryRunResult {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  let config: OpenAIScriptConfig;
  try { config = deps.config ?? parseOpenAIScriptConfig(env); } catch (e) {
    return { executable: false, providerCalled: false, model: "unknown", reasoningEffort: "unknown",
      promptVersion: SCRIPT_ANALYZER_PROMPT_VERSION, schemaVersion: SCRIPT_CANDIDATE_SCHEMA_VERSION, pricingConfigured: false,
      validations: [{ code: "config", passed: false, message: e instanceof Error ? e.message : "Configuration invalide." }],
      warnings: [], maxOutputTokens: 0 };
  }
  const mapped = mapScriptAnalysisRequest({ brief, marketingPlan, creativeConcept });
  const readiness = assessScriptReadiness(brief, marketingPlan, creativeConcept);
  const pricing = deps.pricing ?? createUnknownAiTokenPricing();
  const pricingConfigured = pricing.getPriceBook(config.model) != null;
  const snap = openAIScriptConfigSnapshot(config);
  const validations = [
    { code: "script_ai_flag", passed: isDirectorV2ScriptAiEnabled(env), message: "Flag Script AI vérifié." },
    { code: "paid_ai_flag", passed: isDirectorV2PaidAiEnabled(env), message: "Flag Paid AI vérifié." },
    { code: "api_key", passed: snap.apiKeyPresent, message: snap.apiKeyPresent ? "Clé présente." : "Clé absente." },
    { code: "schema", passed: getScriptCandidateJsonSchema().type === "object", message: "Schema Script disponible." },
    { code: "injection", passed: !mapped.blockingFindings.length, message: "Entrées vérifiées." },
    { code: "script_readiness", passed: readiness.executable, message: "Chaîne Brief/Marketing/Creative vérifiée." },
    { code: "pricing", passed: pricingConfigured || !config.requireFirmPricing, message: "Tarification vérifiée." },
  ];
  const approximateInputTokens = approximateScriptTokenCount(SCRIPT_ANALYZER_SYSTEM_PROMPT + mapped.userMessage);
  const warnings = [
    ...mapped.findings.filter((f) => f.severity === "warning").map((f) => ({ code: f.code, message: f.publicMessage })),
    { code: "approx_tokens", message: `Estimation tokens d’entrée approximative: ${approximateInputTokens} (non facturable).` },
    ...(pricingConfigured ? [] : [{ code: "pricing_unknown", message: "Coût unknown — aucun price book injecté." }]),
  ];
  return { executable: canExecuteScriptAi(env) && snap.apiKeyPresent && !mapped.blockingFindings.length &&
      readiness.executable && (pricingConfigured || !config.requireFirmPricing), providerCalled: false,
    model: config.model, reasoningEffort: config.reasoningEffort,
    promptVersion: SCRIPT_ANALYZER_PROMPT_VERSION, schemaVersion: SCRIPT_CANDIDATE_SCHEMA_VERSION,
    pricingConfigured, validations, warnings, approximateInputTokens, maxOutputTokens: config.maxOutputTokens };
}
