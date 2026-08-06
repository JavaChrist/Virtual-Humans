/**
 * 8H-B — prove maxBeatsForDurationSeconds is the single functional source.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeCreativeArcBeatTiersFromDomain,
  formatCreativeArcBeatRunConstraint,
  maxBeatsForDurationSeconds,
  resolveCreativeArcBeatBudget,
} from "@/domain/creative";
import {
  buildCreativeAnalyzerInstructions,
  getCreativeCandidateTextFormat,
} from "@/infrastructure/ai/openai/creative";
import { validateEmotionalArcOrders } from "../validation";
import type { CreativeAnalysisCandidate } from "../creative-concept";

test("resolveCreativeArcBeatBudget — delegates only to maxBeatsForDurationSeconds", () => {
  for (const d of [1, 15, 16, 20, 21, 30, 31, 60]) {
    const b = resolveCreativeArcBeatBudget(d);
    assert.equal(b.durationSeconds, d);
    assert.equal(b.maxBeats, maxBeatsForDurationSeconds(d));
    assert.equal(b.minBeats, 2);
  }
});

test("8H-B single source — prompt + schema + hard gate share one budget for 30s", () => {
  const budget = resolveCreativeArcBeatBudget(30);
  assert.equal(budget.maxBeats, 5);

  const instructions = buildCreativeAnalyzerInstructions(budget);
  assert.match(instructions, /durationSeconds=30/);
  assert.match(instructions, /Never exceed 5 beats/);
  assert.match(instructions, /between 2 and 5 emotionalArc beats/);
  // Educational tiers derived via domain calls (not a parallel table).
  assert.match(describeCreativeArcBeatTiersFromDomain(), /≤30s → at most 5 beats/);
  assert.match(instructions, /≤30s → at most 5 beats/);

  const fmt = getCreativeCandidateTextFormat({ maxBeats: budget.maxBeats });
  const arc = (fmt.schema as { properties: { emotionalArc: { maxItems: number } } })
    .properties.emotionalArc;
  assert.equal(arc.maxItems, budget.maxBeats);

  const sixBeats = Array.from({ length: 6 }, (_, i) => ({
    order: i + 1,
    purpose: i === 5 ? ("action" as const) : ("hook" as const),
    intent: `beat-${i + 1}`,
    intensity: 3 as const,
  }));
  const candidate = {
    emotionalArc: sixBeats,
  } as unknown as CreativeAnalysisCandidate;
  const issues = validateEmotionalArcOrders(candidate, 30);
  assert.ok(
    issues.some((x) => /Trop de beats.*max 5/.test(x.message)),
    "hard gate must use the same domain max",
  );
});

test("formatCreativeArcBeatRunConstraint — uses budget values only", () => {
  const budget = resolveCreativeArcBeatBudget(20);
  const line = formatCreativeArcBeatRunConstraint(budget);
  assert.match(line, /durationSeconds=20/);
  assert.match(line, /Never exceed 4 beats/);
  assert.equal(line.includes("30"), false);
});
