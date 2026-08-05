/**
 * Local Responses API shape fixtures — synthetic only (7F-A).
 * No real provider payloads, briefs, or sensitive content.
 */

import { makeValidCandidate } from "@/domain/marketing/__tests__/fixtures";

export function candidateJson(overrides?: Record<string, unknown>): string {
  return JSON.stringify({ ...makeValidCandidate(), ...overrides });
}

/** Convenience root `output_text` (completed). */
export function fixtureRootOutputText(text = candidateJson()) {
  return {
    id: "resp_fixture_root",
    status: "completed",
    output_text: text,
    usage: {
      input_tokens: 100,
      output_tokens: 80,
      total_tokens: 180,
    },
  } as const;
}

/** Message item with single output_text part. */
export function fixtureMessageOutputText(text = candidateJson()) {
  return {
    id: "resp_fixture_message",
    status: "completed",
    output: [
      { type: "reasoning", id: "rs_1", summary: [] },
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text }],
      },
    ],
    usage: {
      input_tokens: 120,
      output_tokens: 90,
      total_tokens: 210,
    },
  } as const;
}

/** Multiple output_text parts concatenated. */
export function fixtureConcatenatedOutputText() {
  const full = candidateJson();
  const mid = Math.floor(full.length / 2);
  return {
    id: "resp_fixture_concat",
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [
          { type: "output_text", text: full.slice(0, mid) },
          { type: "output_text", text: full.slice(mid) },
        ],
      },
    ],
  } as const;
}

/** OpenAI-strict shape: optional fields present as null. */
export function fixtureOpenAiNullOptionals() {
  return fixtureRootOutputText(
    candidateJson({
      secondaryAudience: null,
      secondaryBenefits: null,
      assumptions: null,
      claimedEvidence: null,
      notes: null,
    })
  );
}

/** Nested optional nulls inside an assumption. */
export function fixtureNestedNullOptionals() {
  return fixtureRootOutputText(
    candidateJson({
      assumptions: [
        {
          id: "a1",
          statement: "Les navetteurs valorisent surtout le gain de temps.",
          status: "explicit",
          justification: null,
          affectsFields: null,
        },
      ],
      claimedEvidence: [
        {
          field: "mainBenefit",
          source: "brief",
          sourcePath: null,
          summary: "Benefice aligne au brief produit.",
        },
      ],
    })
  );
}

export function fixtureRefusalInMessage() {
  return {
    id: "resp_fixture_refusal",
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "refusal", refusal: "policy_refusal_fixture" }],
      },
    ],
  } as const;
}

export function fixtureIncomplete() {
  return {
    id: "resp_fixture_incomplete",
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens" },
    output: [],
    usage: { input_tokens: 50, output_tokens: 10, total_tokens: 60 },
  } as const;
}

export function fixtureInvalidJson() {
  return fixtureRootOutputText("{not-json");
}

export function fixtureDoubleEncodedJson() {
  return fixtureRootOutputText(JSON.stringify(candidateJson()));
}
