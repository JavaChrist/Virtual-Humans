import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import { assessArtReadiness } from "@/domain/art";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import type { CharacterCapabilitiesSnapshot } from "@/domain/art";
import { canExecuteArtAi, isDirectorV2PaidAiEnabled, isDirectorV2ArtAiEnabled } from "@/infrastructure/config/feature-flags";
import { openAIArtConfigSnapshot, parseOpenAIArtConfig, type OpenAIArtConfig } from "../config";
import { createUnknownAiTokenPricing, type AiTokenPricingPort } from "../marketing/pricing";
import { approximateArtTokenCount, mapArtAnalysisRequest } from "./mapping";
import { ART_ANALYZER_PROMPT_VERSION, ART_ANALYZER_SYSTEM_PROMPT } from "./prompt";
import { getArtCandidateJsonSchema, ART_CANDIDATE_SCHEMA_VERSION } from "./schema";

export type OpenAIArtDryRunResult = {
  executable: boolean; providerCalled: false; model: string; promptVersion: string; schemaVersion: string;
  pricingConfigured: boolean; validations: Array<{ code: string; passed: boolean; message: string }>;
  warnings: Array<{ code: string; message: string }>; approximateInputTokens?: number; maxOutputTokens: number;
};
export type OpenAIArtDryRunDeps = {
  env?: Record<string, string | undefined>; config?: OpenAIArtConfig; pricing?: AiTokenPricingPort;
};

export function runOpenAIArtDryRun(
  brief: VideoProjectBrief, marketingPlan: MarketingPlan, creativeConcept: CreativeConcept,
  videoScript: VideoScript, characterCapabilities?: CharacterCapabilitiesSnapshot,
  deps: OpenAIArtDryRunDeps = {}
): OpenAIArtDryRunResult {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  let config: OpenAIArtConfig;
  try { config = deps.config ?? parseOpenAIArtConfig(env); } catch (e) {
    return { executable: false, providerCalled: false, model: "unknown", promptVersion: ART_ANALYZER_PROMPT_VERSION,
      schemaVersion: ART_CANDIDATE_SCHEMA_VERSION, pricingConfigured: false,
      validations: [{ code: "config", passed: false, message: e instanceof Error ? e.message : "Configuration invalide." }],
      warnings: [], maxOutputTokens: 0 };
  }
  const mapped = mapArtAnalysisRequest({ brief, marketingPlan, creativeConcept, videoScript, characterCapabilities });
  const readiness = assessArtReadiness(brief, marketingPlan, creativeConcept, videoScript, characterCapabilities);
  const pricing = deps.pricing ?? createUnknownAiTokenPricing();
  const pricingConfigured = pricing.getPriceBook(config.model) != null;
  const snap = openAIArtConfigSnapshot(config);
  const validations = [
    { code: "art_ai_flag", passed: isDirectorV2ArtAiEnabled(env), message: "Flag Art AI vérifié." },
    { code: "paid_ai_flag", passed: isDirectorV2PaidAiEnabled(env), message: "Flag Paid AI vérifié." },
    { code: "api_key", passed: snap.apiKeyPresent, message: snap.apiKeyPresent ? "Clé présente." : "Clé absente." },
    { code: "schema", passed: getArtCandidateJsonSchema().type === "object", message: "Schema Art disponible." },
    { code: "injection", passed: !mapped.blockingFindings.length, message: "Entrées vérifiées." },
    { code: "art_readiness", passed: readiness.executable, message: "Chaîne Brief/Marketing/Creative/Script vérifiée." },
    { code: "pricing", passed: pricingConfigured || !config.requireFirmPricing, message: "Tarification vérifiée." },
  ];
  const approximateInputTokens = approximateArtTokenCount(ART_ANALYZER_SYSTEM_PROMPT + mapped.userMessage);
  const warnings = [
    ...mapped.findings.filter((f) => f.severity === "warning").map((f) => ({ code: f.code, message: f.publicMessage })),
    { code: "approx_tokens", message: `Estimation tokens d'entrée approximative: ${approximateInputTokens} (non facturable).` },
    ...(pricingConfigured ? [] : [{ code: "pricing_unknown", message: "Coût unknown — aucun price book injecté." }]),
  ];
  return { executable: canExecuteArtAi(env) && snap.apiKeyPresent && !mapped.blockingFindings.length &&
      readiness.executable && (pricingConfigured || !config.requireFirmPricing), providerCalled: false,
    model: config.model, promptVersion: ART_ANALYZER_PROMPT_VERSION, schemaVersion: ART_CANDIDATE_SCHEMA_VERSION,
    pricingConfigured, validations, warnings, approximateInputTokens, maxOutputTokens: config.maxOutputTokens };
}
