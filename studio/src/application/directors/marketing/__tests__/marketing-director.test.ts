import assert from "node:assert/strict";
import { test } from "node:test";
import { makeBrief, makeValidCandidate } from "@/domain/marketing/__tests__/fixtures";
import type { MarketingAnalyzerPort } from "../analyzer-port";
import { createMarketingDirector } from "../marketing-director";
import type { DirectorRunContext } from "../result";

function fakeAnalyzer(
  impl: MarketingAnalyzerPort["analyze"],
): MarketingAnalyzerPort {
  return { analyze: impl };
}

const execCtx = (corr = "corr-exec-1"): DirectorRunContext => ({
  correlationId: corr,
  mode: "execute",
  createdBy: "tester",
  planId: "plan-fixed-1",
});

test("candidat valide → completed", async () => {
  let seenCorr: string | undefined;
  const director = createMarketingDirector({
    analyzer: fakeAnalyzer(async (_req, ctx) => {
      seenCorr = ctx.correlationId;
      return { candidate: makeValidCandidate() };
    }),
  });
  const brief = makeBrief();
  const before = JSON.stringify(brief);
  const result = await director.run({ brief }, execCtx("corr-xyz"));
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.plan.briefRevisionId, brief.id);
  assert.equal(result.plan.id, "plan-fixed-1");
  assert.equal(result.plan.correlationId, "corr-xyz");
  assert.equal(seenCorr, "corr-xyz");
  assert.equal(JSON.stringify(brief), before);
  assert.ok(Object.isFrozen(result.plan));
});

test("données critiques absentes → needs_input", async () => {
  const director = createMarketingDirector({
    analyzer: fakeAnalyzer(async () => ({ candidate: makeValidCandidate() })),
  });
  const brief = makeBrief({ audienceDescription: "x", callToAction: undefined });
  const result = await director.run({ brief }, execCtx());
  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;
  assert.ok(result.missingInformation.some((m) => m.required));
});

test("candidat invalide → invalid", async () => {
  const director = createMarketingDirector({
    analyzer: fakeAnalyzer(async () => ({
      candidate: makeValidCandidate({
        callToAction: "Bonne soirée",
        emotionalHook: "Garantie 100% miracle sans risque",
      }),
    })),
  });
  const result = await director.run({ brief: makeBrief() }, execCtx());
  assert.equal(result.status, "invalid");
});

test("candidat non fiable (schéma) rejeté", async () => {
  const director = createMarketingDirector({
    analyzer: fakeAnalyzer(async () => ({
      candidate: {
        ...makeValidCandidate(),
        keyMessages: [],
      },
    })),
  });
  const result = await director.run({ brief: makeBrief() }, execCtx());
  assert.equal(result.status, "invalid");
});

test("dry-run ne produit jamais un plan et n'appelle pas le port", async () => {
  let called = false;
  const director = createMarketingDirector({
    analyzer: fakeAnalyzer(async () => {
      called = true;
      return { candidate: makeValidCandidate() };
    }),
  });
  const result = await director.run(
    { brief: makeBrief() },
    { correlationId: "corr-dry", mode: "dry-run" },
  );
  assert.equal(called, false);
  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;
  assert.ok(result.missingInformation.some((m) => m.code === "analysis_not_executed"));
  assert.equal("plan" in result, false);
});

test("aucune dépendance provider dans le résultat completed", async () => {
  const director = createMarketingDirector({
    analyzer: fakeAnalyzer(async () => ({ candidate: makeValidCandidate() })),
  });
  const result = await director.run({ brief: makeBrief() }, execCtx());
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  const json = JSON.stringify(result.plan);
  assert.equal(json.includes('"provider"'), false);
  assert.equal(json.includes('"modelId"'), false);
  assert.equal(json.includes("openai"), false);
});
