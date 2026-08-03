import assert from "node:assert/strict";
import { test } from "node:test";
import {
  makeCreativeBrief,
  makeMarketingPlan,
} from "@/domain/creative/__tests__/fixtures";
import { runCreativeDryRun } from "../dry-run";

test("plan complet exécutable", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);
  const result = runCreativeDryRun(plan, brief);
  assert.equal(result.providerCalled, false);
  assert.equal(result.executable, true);
  assert.equal("concept" in result, false);
});

test("plan et brief de projets différents", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief, { projectId: "other-proj" });
  const result = runCreativeDryRun(plan, brief);
  assert.equal(result.executable, false);
  assert.ok(result.missingInformation.some((m) => m.code === "project_mismatch"));
});

test("révision absente", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief, { id: "" });
  const result = runCreativeDryRun(plan, brief);
  assert.equal(result.executable, false);
});

test("CTA absent", () => {
  const brief = makeCreativeBrief();
  // Empty CTA breaks MarketingPlan schema → rejected at boundary
  const plan = makeMarketingPlan(brief, { callToAction: "" });
  const result = runCreativeDryRun(plan, brief);
  assert.equal(result.executable, false);
  assert.ok(
    result.missingInformation.some(
      (m) => m.code === "cta_missing" || m.code === "marketing_plan_invalid",
    ),
  );
});

test("hypothèse non identifiée", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief, { assumptions: [] });
  const result = runCreativeDryRun(plan, brief);
  assert.equal(result.executable, false);
  assert.ok(result.missingInformation.some((m) => m.code === "assumptions_missing"));
});

test("allégation non sourcée", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief, {
    emotionalHook: "Garantie 100% miracle sans risque",
  });
  const result = runCreativeDryRun(plan, brief);
  assert.equal(result.executable, false);
  assert.ok(result.missingInformation.some((m) => m.code === "unsourced_claim_blocking"));
});

test("providerCalled false et aucun concept", () => {
  const brief = makeCreativeBrief();
  const result = runCreativeDryRun(makeMarketingPlan(brief), brief);
  assert.equal(result.providerCalled, false);
  assert.ok(!Object.keys(result).includes("concept"));
});
