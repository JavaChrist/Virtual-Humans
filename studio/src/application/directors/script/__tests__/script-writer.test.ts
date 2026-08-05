import assert from "node:assert/strict";
import { test } from "node:test";
import {
  makeScriptChain,
  makeValidScriptCandidate,
} from "@/domain/script/__tests__/fixtures";
import type { ScriptAnalyzerPort } from "../analyzer-port";
import { createScriptWriter } from "../script-writer";
import type { DirectorRunContext } from "../result";
import { calculateScriptTiming } from "@/domain/script";

function fakeAnalyzer(impl: ScriptAnalyzerPort["analyze"]): ScriptAnalyzerPort {
  return { analyze: impl };
}

const execCtx = (corr = "corr-scr"): DirectorRunContext => ({
  correlationId: corr,
  mode: "execute",
  createdBy: "tester",
  planId: "script-fixed-1",
});

test("candidat valide → completed avec timing recalculé", async () => {
  let seenCorr: string | undefined;
  const writer = createScriptWriter({
    analyzer: fakeAnalyzer(async (_req, ctx) => {
      seenCorr = ctx.correlationId;
      return { candidate: makeValidScriptCandidate() };
    }),
  });
  const chain = makeScriptChain();
  const beforeBrief = JSON.stringify(chain.brief);
  const beforePlan = JSON.stringify(chain.marketingPlan);
  const beforeConcept = JSON.stringify(chain.creativeConcept);
  const result = await writer.run(chain, execCtx("corr-xyz"));
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.script.id, "script-fixed-1");
  assert.equal(result.script.correlationId, "corr-xyz");
  assert.equal(result.script.marketingPlanRevisionId, chain.marketingPlan.id);
  assert.equal(result.script.creativeConceptRevisionId, chain.creativeConcept.id);
  assert.equal(seenCorr, "corr-xyz");
  assert.equal(JSON.stringify(chain.brief), beforeBrief);
  assert.equal(JSON.stringify(chain.marketingPlan), beforePlan);
  assert.equal(JSON.stringify(chain.creativeConcept), beforeConcept);
  assert.ok(Object.isFrozen(result.script));
  const recalculated = calculateScriptTiming(
    result.script.segments,
    result.script.language,
    result.script.targetDurationSeconds,
  );
  assert.equal(result.script.timing.estimatedTotalSeconds, recalculated.estimatedTotalSeconds);
});

test("script trop long → invalid", async () => {
  const longSpoken = "parole ".repeat(50).trim(); // stays under dialogue max length
  const writer = createScriptWriter({
    analyzer: fakeAnalyzer(async () => {
      const base = makeValidScriptCandidate();
      const hookPrefix = base.hookText;
      return {
        candidate: {
          ...base,
          segments: base.segments.map((s, i) => {
            if (i === 0) {
              const dialogue = `${hookPrefix} ${longSpoken}`.slice(0, 400);
              return { ...s, dialogue, voiceOver: undefined };
            }
            return {
              ...s,
              dialogue: s.speaker === "character" ? longSpoken : undefined,
              voiceOver: s.speaker === "voice_over" ? longSpoken : undefined,
            };
          }),
        },
      };
    }),
  });
  const result = await writer.run(makeScriptChain(), execCtx());
  assert.equal(result.status, "invalid");
  if (result.status !== "invalid") return;
  assert.ok(
    result.errors.some((e) => e.code === "duration_out_of_range"),
    JSON.stringify(result.errors),
  );
});

test("information critique absente → needs_input", async () => {
  const writer = createScriptWriter({
    analyzer: fakeAnalyzer(async () => ({ candidate: makeValidScriptCandidate() })),
  });
  const chain = makeScriptChain();
  const result = await writer.run(
    {
      ...chain,
      marketingPlan: { ...chain.marketingPlan, assumptions: [] },
      creativeConcept: { ...chain.creativeConcept, assumptions: [] },
    },
    execCtx(),
  );
  assert.equal(result.status, "needs_input");
});

test("dry-run n'appelle pas le port", async () => {
  let called = false;
  const writer = createScriptWriter({
    analyzer: fakeAnalyzer(async () => {
      called = true;
      return { candidate: makeValidScriptCandidate() };
    }),
  });
  const result = await writer.run(makeScriptChain(), {
    correlationId: "dry",
    mode: "dry-run",
  });
  assert.equal(called, false);
  assert.equal(result.status, "needs_input");
});

test("erreur du port sans fuite structurée", async () => {
  const writer = createScriptWriter({
    analyzer: fakeAnalyzer(async () => {
      throw new Error("secret_api_key=sk-test");
    }),
  });
  const result = await writer.run(makeScriptChain(), execCtx());
  assert.equal(result.status, "provider_failed");
  if (result.status !== "provider_failed") return;
  assert.equal(result.failure.code, "internal_error");
});
