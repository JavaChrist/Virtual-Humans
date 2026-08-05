/**
 * Extract assistant text / refusal from OpenAI Responses payloads (VHS-117A / 7F-A).
 * Never logs payload bodies.
 */

export function extractOutputText(payload: Record<string, unknown>): {
  outputText?: string;
  refusal?: string;
} {
  let refusal: string | undefined;
  const texts: string[] = [];

  const output = payload.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (row.type !== "message" || !Array.isArray(row.content)) continue;
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

  // Root convenience field — prefer when non-empty (SDK / some Responses shapes).
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return {
      outputText: payload.output_text,
      refusal,
    };
  }

  return {
    outputText: texts.length ? texts.join("") : undefined,
    refusal,
  };
}
