/**
 * Single source of truth for Creative emotionalArc length vs duration (8H-B).
 *
 * All run-applied constraints (prompt injection, OpenAI maxItems, hard gate)
 * must go through {@link resolveCreativeArcBeatBudget} / {@link maxBeatsForDurationSeconds}.
 * Do not re-copy duration thresholds in adapters or static prompt strings.
 */

import {
  CREATIVE_FIELD_LIMITS,
  maxBeatsForDurationSeconds,
} from "./creative-concept";

export type CreativeArcBeatBudget = {
  durationSeconds: number;
  minBeats: number;
  maxBeats: number;
};

/** Compute once per run — reuse for prompt, schema, dry-run, and gates. */
export function resolveCreativeArcBeatBudget(
  durationSeconds: number,
): CreativeArcBeatBudget {
  return {
    durationSeconds,
    minBeats: CREATIVE_FIELD_LIMITS.beatsMin,
    maxBeats: maxBeatsForDurationSeconds(durationSeconds),
  };
}

/**
 * Educational tier summary derived by calling the domain function — never a
 * parallel table of magic numbers.
 */
export function describeCreativeArcBeatTiersFromDomain(): string {
  const samples: Array<[label: string, duration: number]> = [
    ["≤15s", 15],
    ["≤20s", 20],
    ["≤30s", 30],
    [">30s", 31],
  ];
  return samples
    .map(
      ([label, d]) =>
        `${label} → at most ${maxBeatsForDurationSeconds(d)} beats`,
    )
    .join("; ");
}

/** Run-applied constraint line — uses the precomputed budget only. */
export function formatCreativeArcBeatRunConstraint(
  budget: CreativeArcBeatBudget,
): string {
  return [
    `For this brief (durationSeconds=${budget.durationSeconds}),`,
    `emit between ${budget.minBeats} and ${budget.maxBeats} emotionalArc beats`,
    `(array order = narrative order).`,
    `Never exceed ${budget.maxBeats} beats.`,
  ].join(" ");
}
