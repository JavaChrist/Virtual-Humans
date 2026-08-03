/**
 * Narrow OpenAI Responses contracts (VHS-117A).
 * No Chat Completions. No SDK dependency required.
 */

export type OpenAIReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export const OPENAI_REASONING_EFFORT_VALUES = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const satisfies readonly OpenAIReasoningEffort[];

export type AIUsage = {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
};

export type OpenAIJsonSchemaFormat = {
  type: "json_schema";
  name: string;
  strict: true;
  schema: Record<string, unknown>;
};

export type OpenAIResponseRequest = {
  model: string;
  instructions: string;
  input: string;
  store: false;
  maxOutputTokens: number;
  reasoningEffort?: OpenAIReasoningEffort;
  textFormat: OpenAIJsonSchemaFormat;
  /** Privacy-preserving stable id — never password/email/raw workspace UUID. */
  safetyIdentifier?: string;
  /** Never set previous_response_id — each analysis is independent. */
};

export type OpenAIExecutionContext = {
  correlationId: string;
  signal?: AbortSignal;
  timeoutMs: number;
};

export type OpenAIResponseStatus =
  | "completed"
  | "incomplete"
  | "failed"
  | "cancelled";

export type OpenAIResponseResult = {
  id?: string;
  status: OpenAIResponseStatus;
  outputText?: string;
  refusal?: string;
  incompleteReason?: string;
  usage?: AIUsage;
  rawErrorCode?: string;
};

export interface OpenAIResponsesClientPort {
  create(
    request: OpenAIResponseRequest,
    context: OpenAIExecutionContext
  ): Promise<OpenAIResponseResult>;
}
