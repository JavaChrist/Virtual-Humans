/**
 * Fetch-based OpenAI Responses API client (VHS-117A).
 * Injectable via OpenAIResponsesClientPort — no SDK required.
 */

import type {
  OpenAIExecutionContext,
  OpenAIResponseRequest,
  OpenAIResponseResult,
  OpenAIResponsesClientPort,
} from "./contracts";
import {
  mapAbortError,
  mapOpenAIHttpError,
  OpenAIAiError,
} from "./errors";
import { normalizeAIUsage } from "./usage";

export type FetchLike = typeof fetch;

function extractOutputText(payload: Record<string, unknown>): {
  outputText?: string;
  refusal?: string;
} {
  // Convenience field when present
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return { outputText: payload.output_text };
  }

  const output = payload.output;
  if (!Array.isArray(output)) return {};

  let refusal: string | undefined;
  const texts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type === "message" && Array.isArray(row.content)) {
      for (const part of row.content) {
        if (!part || typeof part !== "object") continue;
        const p = part as Record<string, unknown>;
        if (p.type === "output_text" && typeof p.text === "string") {
          texts.push(p.text);
        }
        if (p.type === "refusal" && typeof p.refusal === "string") {
          refusal = p.refusal;
        }
      }
    }
  }
  return {
    outputText: texts.length ? texts.join("") : undefined,
    refusal,
  };
}

function buildBody(request: OpenAIResponseRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    instructions: request.instructions,
    input: request.input,
    store: false,
    max_output_tokens: request.maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: request.textFormat.name,
        strict: true,
        schema: request.textFormat.schema,
      },
    },
  };
  if (request.reasoningEffort) {
    body.reasoning = { effort: request.reasoningEffort };
  }
  if (request.safetyIdentifier) {
    body.safety_identifier = request.safetyIdentifier;
  }
  // Explicitly no tools / previous_response_id
  return body;
}

export function createFetchOpenAIResponsesClient(deps: {
  apiKey: string;
  fetchImpl?: FetchLike;
  baseUrl?: string;
}): OpenAIResponsesClientPort {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const baseUrl = (deps.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");

  return {
    async create(request, context: OpenAIExecutionContext): Promise<OpenAIResponseResult> {
      if (!deps.apiKey) {
        throw new OpenAIAiError("openai_not_configured");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort(new Error("timeout"));
      }, context.timeoutMs);

      const onExternalAbort = () => controller.abort(new Error("aborted"));
      context.signal?.addEventListener("abort", onExternalAbort, { once: true });

      try {
        const res = await fetchImpl(`${baseUrl}/responses`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${deps.apiKey}`,
            "Content-Type": "application/json",
            "X-Correlation-Id": context.correlationId,
          },
          body: JSON.stringify(buildBody(request)),
          signal: controller.signal,
        });

        if (!res.ok) {
          let providerCode: string | undefined;
          let providerErrorType: string | undefined;
          try {
            const errJson = (await res.json()) as {
              error?: { code?: string; type?: string };
            };
            providerCode = errJson.error?.code;
            providerErrorType = errJson.error?.type;
            if (!providerCode && providerErrorType) {
              providerCode = providerErrorType;
            }
          } catch {
            // ignore body — never log raw provider payload
          }
          throw mapOpenAIHttpError(res.status, providerCode, {
            retryAfterHeader: res.headers.get("retry-after"),
            providerErrorType,
            providerRequestId:
              res.headers.get("x-request-id") ??
              res.headers.get("request-id"),
            rateLimitLimitRequests: res.headers.get("x-ratelimit-limit-requests"),
            rateLimitRemainingRequests: res.headers.get(
              "x-ratelimit-remaining-requests"
            ),
            rateLimitResetRequests: res.headers.get("x-ratelimit-reset-requests"),
          });
        }

        const payload = (await res.json()) as Record<string, unknown>;
        const statusRaw = typeof payload.status === "string" ? payload.status : "completed";
        const { outputText, refusal } = extractOutputText(payload);
        const incomplete =
          payload.incomplete_details && typeof payload.incomplete_details === "object"
            ? (payload.incomplete_details as { reason?: string }).reason
            : undefined;

        let status: OpenAIResponseResult["status"] = "completed";
        if (statusRaw === "incomplete") status = "incomplete";
        else if (statusRaw === "failed") status = "failed";
        else if (statusRaw === "cancelled") status = "cancelled";

        return {
          id: typeof payload.id === "string" ? payload.id : undefined,
          status,
          outputText,
          refusal,
          incompleteReason: incomplete,
          usage: normalizeAIUsage(payload.usage),
          rawErrorCode:
            payload.error && typeof payload.error === "object"
              ? String((payload.error as { code?: string }).code ?? "")
              : undefined,
        };
      } catch (e) {
        if (e instanceof OpenAIAiError) throw e;
        throw mapAbortError(e);
      } finally {
        clearTimeout(timer);
        context.signal?.removeEventListener("abort", onExternalAbort);
      }
    },
  };
}
