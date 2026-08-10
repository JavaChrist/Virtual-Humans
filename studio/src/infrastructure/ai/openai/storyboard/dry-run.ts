import type { VisualDirection } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import { assessStoryboardReadiness } from "@/domain/storyboard";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import { canExecuteStoryboardAi, isDirectorV2PaidAiEnabled, isDirectorV2StoryboardAiEnabled } from "@/infrastructure/config/feature-flags";
import { openAIStoryboardConfigSnapshot, parseOpenAIStoryboardConfig, type OpenAIStoryboardConfig } from "../config";
import { createUnknownAiTokenPricing, type AiTokenPricingPort } from "../marketing/pricing";
import { approximateStoryboardTokenCount, mapStoryboardAnalysisRequest } from "./mapping";
import { STORYBOARD_ANALYZER_PROMPT_VERSION, STORYBOARD_ANALYZER_SYSTEM_PROMPT } from "./prompt";
import { getStoryboardCandidateJsonSchema, STORYBOARD_CANDIDATE_SCHEMA_VERSION } from "./schema";
import {
  inspectStoryboardStructuredSchemaProjection,
  STORYBOARD_PROVIDER_ERROR_METADATA_CAPTURE,
  type StoryboardSchemaProjectionReport,
} from "./schema-projection";

export type OpenAIStoryboardDryRunResult = {
  executable: boolean;
  providerCalled: false;
  model: string;
  reasoningEffort: string;
  promptVersion: string;
  schemaVersion: string;
  pricingConfigured: boolean;
  validations: Array<{ code: string; passed: boolean; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  approximateInputTokens?: number;
  maxOutputTokens: number;
  structuredSchemaOneOfCount: number;
  structuredSchemaAnyOfCount: number;
  structuredSchemaProjection: StoryboardSchemaProjectionReport["structuredSchemaProjection"];
  providerErrorMetadataCapture: typeof STORYBOARD_PROVIDER_ERROR_METADATA_CAPTURE;
};
export type OpenAIStoryboardDryRunDeps = {
  env?: Record<string, string | undefined>; config?: OpenAIStoryboardConfig; pricing?: AiTokenPricingPort;
};

function emptySchemaFields(): Pick<
  OpenAIStoryboardDryRunResult,
  | "structuredSchemaOneOfCount"
  | "structuredSchemaAnyOfCount"
  | "structuredSchemaProjection"
  | "providerErrorMetadataCapture"
> {
  const projection = inspectStoryboardStructuredSchemaProjection();
  return {
    structuredSchemaOneOfCount: projection.structuredSchemaOneOfCount,
    structuredSchemaAnyOfCount: projection.structuredSchemaAnyOfCount,
    structuredSchemaProjection: projection.structuredSchemaProjection,
    providerErrorMetadataCapture: STORYBOARD_PROVIDER_ERROR_METADATA_CAPTURE,
  };
}

export function runOpenAIStoryboardDryRun(
  brief: VideoProjectBrief, marketingPlan: MarketingPlan, creativeConcept: CreativeConcept,
  videoScript: VideoScript, visualDirection: VisualDirection,
  deps: OpenAIStoryboardDryRunDeps = {}
): OpenAIStoryboardDryRunResult {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const schemaFields = emptySchemaFields();
  let config: OpenAIStoryboardConfig;
  try { config = deps.config ?? parseOpenAIStoryboardConfig(env); } catch (e) {
    return {
      executable: false,
      providerCalled: false,
      model: "unknown",
      reasoningEffort: "unknown",
      promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
      schemaVersion: STORYBOARD_CANDIDATE_SCHEMA_VERSION,
      pricingConfigured: false,
      validations: [{ code: "config", passed: false, message: e instanceof Error ? e.message : "Configuration invalide." }],
      warnings: [],
      maxOutputTokens: 0,
      ...schemaFields,
    };
  }
  const mapped = mapStoryboardAnalysisRequest({ brief, marketingPlan, creativeConcept, videoScript, visualDirection });
  const readiness = assessStoryboardReadiness(brief, marketingPlan, creativeConcept, videoScript, visualDirection);
  const pricing = deps.pricing ?? createUnknownAiTokenPricing();
  const pricingConfigured = pricing.getPriceBook(config.model) != null;
  const snap = openAIStoryboardConfigSnapshot(config);
  const schemaProjectionOk = schemaFields.structuredSchemaProjection === "anyOf-compatible";
  const validations = [
    { code: "storyboard_ai_flag", passed: isDirectorV2StoryboardAiEnabled(env), message: "Flag Storyboard AI vérifié." },
    { code: "paid_ai_flag", passed: isDirectorV2PaidAiEnabled(env), message: "Flag Paid AI vérifié." },
    { code: "api_key", passed: snap.apiKeyPresent, message: snap.apiKeyPresent ? "Clé présente." : "Clé absente." },
    { code: "schema", passed: getStoryboardCandidateJsonSchema().type === "object", message: "Schema Storyboard disponible." },
    {
      code: "structured_schema_projection",
      passed: schemaProjectionOk && schemaFields.structuredSchemaOneOfCount === 0,
      message: schemaProjectionOk
        ? "Projection OpenAI anyOf-compatible (oneOf=0)."
        : "Projection OpenAI invalide (oneOf ou spokenContent).",
    },
    {
      code: "provider_error_metadata_capture",
      passed: schemaFields.providerErrorMetadataCapture === "ready",
      message: "Capture métadonnées provider redacted prête.",
    },
    { code: "injection", passed: !mapped.blockingFindings.length, message: "Entrées vérifiées." },
    { code: "storyboard_readiness", passed: readiness.executable, message: "Chaîne complète vérifiée." },
    { code: "pricing", passed: pricingConfigured || !config.requireFirmPricing, message: "Tarification vérifiée." },
  ];
  const approximateInputTokens = approximateStoryboardTokenCount(STORYBOARD_ANALYZER_SYSTEM_PROMPT + mapped.userMessage);
  const warnings = [
    ...mapped.findings.filter((f) => f.severity === "warning").map((f) => ({ code: f.code, message: f.publicMessage })),
    { code: "approx_tokens", message: `Estimation tokens d'entrée approximative: ${approximateInputTokens} (non facturable).` },
    ...(pricingConfigured ? [] : [{ code: "pricing_unknown", message: "Coût unknown — aucun price book injecté." }]),
  ];
  return {
    executable:
      canExecuteStoryboardAi(env) &&
      snap.apiKeyPresent &&
      !mapped.blockingFindings.length &&
      readiness.executable &&
      (pricingConfigured || !config.requireFirmPricing) &&
      schemaProjectionOk &&
      schemaFields.structuredSchemaOneOfCount === 0,
    providerCalled: false,
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
    schemaVersion: STORYBOARD_CANDIDATE_SCHEMA_VERSION,
    pricingConfigured,
    validations,
    warnings,
    approximateInputTokens,
    maxOutputTokens: config.maxOutputTokens,
    ...schemaFields,
  };
}
