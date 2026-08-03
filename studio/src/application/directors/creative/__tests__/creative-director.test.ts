import assert from "node:assert/strict";
import { test } from "node:test";
import {
  makeCreativeBrief,
  makeMarketingPlan,
  makeValidCreativeCandidate,
} from "@/domain/creative/__tests__/fixtures";
import type { CreativeAnalyzerPort } from "../analyzer-port";
import { createCreativeDirector } from "../creative-director";
import type { DirectorRunContext } from "../result";

function fakeAnalyzer(impl: CreativeAnalyzerPort["analyze"]): CreativeAnalyzerPort {
  return { analyze: impl };
}

const execCtx = (corr = "corr-cre-1"): DirectorRunContext => ({
  correlationId: corr,
  mode: "execute",
  createdBy: "tester",
  planId: "concept-fixed-1",
});

test("candidat valide → completed", async () => {
  let seenCorr: string | undefined;
  const director = createCreativeDirector({
    analyzer: fakeAnalyzer(async (_req, ctx) => {
      seenCorr = ctx.correlationId;
      return makeValidCreativeCandidate();
    }),
  });
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);
  const briefBefore = JSON.stringify(brief);
  const planBefore = JSON.stringify(plan);
  const result = await director.run({ brief, marketingPlan: plan }, execCtx("corr-xyz"));
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.concept.marketingPlanRevisionId, plan.id);
  assert.equal(result.concept.id, "concept-fixed-1");
  assert.equal(result.concept.correlationId, "corr-xyz");
  assert.equal(seenCorr, "corr-xyz");
  assert.equal(JSON.stringify(brief), briefBefore);
  assert.equal(JSON.stringify(plan), planBefore);
  assert.ok(Object.isFrozen(result.concept));
});

test("information critique absente → needs_input", async () => {
  const director = createCreativeDirector({
    analyzer: fakeAnalyzer(async () => makeValidCreativeCandidate()),
  });
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief, { assumptions: [] });
  const result = await director.run({ brief, marketingPlan: plan }, execCtx());
  assert.equal(result.status, "needs_input");
});

test("candidat invalide → invalid", async () => {
  const director = createCreativeDirector({
    analyzer: fakeAnalyzer(async () =>
      makeValidCreativeCandidate({
        openingDevice: {
          kind: "question",
          description: "Use a close-up then dolly with openai gpt-4 prompt:",
        },
      }),
    ),
  });
  const brief = makeCreativeBrief();
  const result = await director.run(
    { brief, marketingPlan: makeMarketingPlan(brief) },
    execCtx(),
  );
  assert.equal(result.status, "invalid");
});

test("candidat non fiable (schéma) rejeté", async () => {
  const director = createCreativeDirector({
    analyzer: fakeAnalyzer(async () => ({
      ...makeValidCreativeCandidate(),
      emotionalArc: [],
    })),
  });
  const brief = makeCreativeBrief();
  const result = await director.run(
    { brief, marketingPlan: makeMarketingPlan(brief) },
    execCtx(),
  );
  assert.equal(result.status, "invalid");
});

test("dry-run ne produit jamais un concept et n'appelle pas le port", async () => {
  let called = false;
  const director = createCreativeDirector({
    analyzer: fakeAnalyzer(async () => {
      called = true;
      return makeValidCreativeCandidate();
    }),
  });
  const brief = makeCreativeBrief();
  const result = await director.run(
    { brief, marketingPlan: makeMarketingPlan(brief) },
    { correlationId: "corr-dry", mode: "dry-run" },
  );
  assert.equal(called, false);
  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;
  assert.ok(result.missingInformation.some((m) => m.code === "analysis_not_executed"));
});

test("erreur du port gérée sans fuite sensible", async () => {
  const director = createCreativeDirector({
    analyzer: fakeAnalyzer(async () => {
      throw new Error("secret_api_key=sk-test leaked");
    }),
  });
  const brief = makeCreativeBrief();
  const result = await director.run(
    { brief, marketingPlan: makeMarketingPlan(brief) },
    execCtx(),
  );
  assert.equal(result.status, "provider_failed");
  if (result.status !== "provider_failed") return;
  assert.equal(result.failure.code, "internal_error");
  assert.equal(result.failure.publicMessage.includes("sk-test"), false);
  assert.equal(JSON.stringify(result).includes("sk-test"), false);
});
