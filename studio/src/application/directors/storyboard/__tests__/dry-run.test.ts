import assert from "node:assert/strict";
import { test } from "node:test";
import { makeStoryboardChain } from "@/domain/storyboard/__tests__/fixtures";
import { createStoryboardDirector } from "../storyboard-director";
import { runStoryboardDryRun } from "../dry-run";
import type { StoryboardAnalyzerPort } from "../analyzer-port";

const noopAnalyzer: StoryboardAnalyzerPort = {
  async analyze() {
    throw new Error("analyzer must not be called in dry-run");
  },
};

test("dry-run prêt", () => {
  const chain = makeStoryboardChain();
  const dry = runStoryboardDryRun(
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    chain.visualDirection,
  );
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executable, true);
  assert.ok(!("storyboard" in dry));
});

test("projets incompatibles", () => {
  const chain = makeStoryboardChain();
  const dry = runStoryboardDryRun(
    chain.brief,
    { ...chain.marketingPlan, projectId: "other" },
    chain.creativeConcept,
    chain.videoScript,
    chain.visualDirection,
  );
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "project_mismatch"));
});

test("revision chain incorrecte", () => {
  const chain = makeStoryboardChain();
  const dry = runStoryboardDryRun(
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    { ...chain.visualDirection, videoScriptRevisionId: "wrong" },
  );
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "revision_mismatch"));
});

test("couverture Art incomplète", () => {
  const chain = makeStoryboardChain();
  const dry = runStoryboardDryRun(
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    {
      ...chain.visualDirection,
      segments: chain.visualDirection.segments.slice(0, 1),
    },
  );
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "art_coverage_incomplete"));
});

test("timing Script invalide", () => {
  const chain = makeStoryboardChain();
  const dry = runStoryboardDryRun(
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    {
      ...chain.videoScript,
      timing: { ...chain.videoScript.timing, status: "too_long" },
    },
    chain.visualDirection,
  );
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "script_timing_invalid"));
});

test("asset essentiel absent", () => {
  const chain = makeStoryboardChain({ withCharacter: true });
  const visual = {
    ...chain.visualDirection,
    segments: chain.visualDirection.segments.map((s) => {
      const rest = { ...s };
      delete rest.character;
      return rest;
    }),
  };
  const dry = runStoryboardDryRun(
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    visual as typeof chain.visualDirection,
  );
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "critical_asset_missing"));
});

test("director dry-run n'appelle pas le port", async () => {
  const chain = makeStoryboardChain();
  const director = createStoryboardDirector({ analyzer: noopAnalyzer });
  const result = await director.run(
    {
      brief: chain.brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      visualDirection: chain.visualDirection,
    },
    { correlationId: "corr-dry", mode: "dry-run" },
  );
  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;
  assert.ok(result.missingInformation.some((m) => m.code === "analysis_not_executed"));
  assert.ok(!("storyboard" in result));
});
