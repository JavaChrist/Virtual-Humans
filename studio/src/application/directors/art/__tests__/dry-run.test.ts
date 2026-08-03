import assert from "node:assert/strict";
import { test } from "node:test";
import {
  makeArtChain,
  makeGenericSnapshot,
} from "@/domain/art/__tests__/fixtures";
import { createArtDirector } from "../art-director";
import { runArtDryRun } from "../dry-run";
import type { ArtAnalyzerPort } from "../analyzer-port";

const noopAnalyzer: ArtAnalyzerPort = {
  async analyze() {
    throw new Error("analyzer must not be called in dry-run");
  },
};

test("dry-run prêt", () => {
  const chain = makeArtChain();
  const dry = runArtDryRun(
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executable, true);
  assert.ok(!("visualDirection" in dry));
});

test("projets incompatibles", () => {
  const chain = makeArtChain();
  const dry = runArtDryRun(
    chain.brief,
    { ...chain.marketingPlan, projectId: "other" },
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "project_mismatch"));
});

test("révision incohérente", () => {
  const chain = makeArtChain();
  const dry = runArtDryRun(
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    { ...chain.videoScript, creativeConceptRevisionId: "wrong" },
  );
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "revision_mismatch"));
});

test("personnage sans snapshot", () => {
  const chain = makeArtChain({ withCharacter: true });
  const dry = runArtDryRun(
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.equal(dry.executable, false);
  assert.ok(
    dry.missingInformation.some((m) => m.code === "character_snapshot_missing"),
  );
});

test("asset critique manquant", () => {
  const chain = makeArtChain({ withCharacter: true });
  const dry = runArtDryRun(
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    makeGenericSnapshot({ availableOutfits: [] }),
  );
  assert.equal(dry.executable, false);
  assert.ok(dry.missingInformation.some((m) => m.code === "critical_asset_missing"));
});

test("texte écran sans information de composition (dry-run)", () => {
  const chain = makeArtChain();
  assert.ok(chain.videoScript.segments.some((s) => s.screenText));
  const dry = runArtDryRun(
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.equal(dry.providerCalled, false);
  assert.ok(dry.validations.some((v) => v.code === "screen_text_composition" && v.passed));
  assert.ok(dry.warnings.some((w) => w.code === "screen_text_needs_composition"));
  assert.ok(
    dry.missingInformation.some((m) => m.code === "screen_text_composition_pending"),
  );
  assert.ok(!("visualDirection" in dry));
});

test("director dry-run n'appelle pas le port et ne génère pas de direction", async () => {
  const chain = makeArtChain();
  const director = createArtDirector({ analyzer: noopAnalyzer });
  const result = await director.run(chain, {
    correlationId: "corr-dry",
    mode: "dry-run",
  });
  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;
  assert.ok(result.missingInformation.some((m) => m.code === "analysis_not_executed"));
  assert.ok(!("visualDirection" in result));
});
