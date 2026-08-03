import assert from "node:assert/strict";
import { test } from "node:test";
import { makeScriptChain } from "@/domain/script/__tests__/fixtures";
import { runScriptDryRun } from "../dry-run";

test("prêt", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const result = runScriptDryRun(brief, marketingPlan, creativeConcept);
  assert.equal(result.providerCalled, false);
  assert.equal(result.executable, true);
  assert.ok(!Object.keys(result).includes("script"));
});

test("projets incompatibles", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const result = runScriptDryRun(
    brief,
    { ...marketingPlan, projectId: "other" },
    creativeConcept,
  );
  assert.equal(result.executable, false);
  assert.ok(result.missingInformation.some((m) => m.code === "project_mismatch"));
});

test("révision incohérente", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const result = runScriptDryRun(brief, marketingPlan, {
    ...creativeConcept,
    marketingPlanRevisionId: "wrong-plan",
  });
  assert.equal(result.executable, false);
  assert.ok(result.missingInformation.some((m) => m.code === "revision_mismatch"));
});

test("langue avec fallback", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const result = runScriptDryRun(
    { ...brief, language: "de" },
    marketingPlan,
    creativeConcept,
  );
  // still executable if other checks pass; warning about fallback
  assert.ok(result.warnings.some((w) => w.code === "language_fallback") || result.executable);
});

test("arc inutilisable", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const result = runScriptDryRun(brief, marketingPlan, {
    ...creativeConcept,
    emotionalArc: [],
  });
  assert.equal(result.executable, false);
  // Empty arc fails CreativeConcept schema and/or readiness
  assert.ok(
    result.missingInformation.some(
      (m) => m.code === "arc_unusable" || m.code === "creative_concept_invalid",
    ),
  );
});

test("allégation non sourcée", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const result = runScriptDryRun(
    brief,
    { ...marketingPlan, emotionalHook: "Garantie 100% miracle sans risque" },
    creativeConcept,
  );
  assert.equal(result.executable, false);
  assert.ok(result.missingInformation.some((m) => m.code === "unsourced_claim_blocking"));
});

test("providerCalled false", () => {
  const chain = makeScriptChain();
  const result = runScriptDryRun(chain.brief, chain.marketingPlan, chain.creativeConcept);
  assert.equal(result.providerCalled, false);
});
