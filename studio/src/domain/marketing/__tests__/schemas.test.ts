import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeMarketingPlan } from "../finalize";
import {
  MARKETING_FIELD_LIMITS,
  MARKETING_PLAN_SCHEMA_VERSION,
} from "../marketing-plan";
import {
  MarketingAnalysisCandidateSchema,
  MarketingPlanSchema,
} from "../schemas";
import { makeBrief, makeValidCandidate } from "./fixtures";

test("plan minimal valide via finalize", () => {
  const plan = finalizeMarketingPlan({
    brief: makeBrief(),
    candidate: makeValidCandidate(),
    metadata: {
      id: "plan-1",
      createdBy: "tester",
      correlationId: "corr-1",
    },
  });
  const parsed = MarketingPlanSchema.safeParse(plan);
  assert.equal(parsed.success, true);
  assert.equal(plan.schemaVersion, MARKETING_PLAN_SCHEMA_VERSION);
  assert.equal(plan.briefRevisionId, "brief-1");
});

test("objectif invalide rejeté par schéma candidat", () => {
  const r = MarketingAnalysisCandidateSchema.safeParse({
    ...makeValidCandidate(),
    marketingObjective: "viral",
  });
  assert.equal(r.success, false);
});

test("audience vide rejetée", () => {
  const r = MarketingAnalysisCandidateSchema.safeParse({
    ...makeValidCandidate(),
    primaryAudience: { label: "", description: "", needs: [], painPoints: [] },
  });
  assert.equal(r.success, false);
});

test("bénéfice vide rejeté", () => {
  const r = MarketingAnalysisCandidateSchema.safeParse({
    ...makeValidCandidate(),
    mainBenefit: "",
  });
  assert.equal(r.success, false);
});

test("zéro ou trop de messages clés", () => {
  assert.equal(
    MarketingAnalysisCandidateSchema.safeParse({
      ...makeValidCandidate(),
      keyMessages: [],
    }).success,
    false,
  );
  assert.equal(
    MarketingAnalysisCandidateSchema.safeParse({
      ...makeValidCandidate(),
      keyMessages: ["a", "b", "c", "d"],
    }).success,
    false,
  );
});

test("CTA absent rejeté", () => {
  assert.equal(
    MarketingAnalysisCandidateSchema.safeParse({
      ...makeValidCandidate(),
      callToAction: "",
    }).success,
    false,
  );
});

test("métrique invalide", () => {
  assert.equal(
    MarketingAnalysisCandidateSchema.safeParse({
      ...makeValidCandidate(),
      successMetric: { kind: "likes", description: "x" },
    }).success,
    false,
  );
});

test("hypothèse dérivée sans justification", () => {
  const r = MarketingAnalysisCandidateSchema.safeParse({
    ...makeValidCandidate(),
    assumptions: [
      {
        id: "a-bad",
        statement: "Hypothèse sans justification",
        status: "inferred",
      },
    ],
  });
  assert.equal(r.success, false);
});

test("evidence avec chemin invalide", () => {
  const r = MarketingAnalysisCandidateSchema.safeParse({
    ...makeValidCandidate(),
    claimedEvidence: [
      {
        field: "mainBenefit",
        source: "brief",
        sourcePath: "subject description!",
        summary: "bad path",
      },
    ],
  });
  assert.equal(r.success, false);
});

test("longueurs maximales", () => {
  const tooLong = "x".repeat(MARKETING_FIELD_LIMITS.mainBenefit + 1);
  assert.equal(
    MarketingAnalysisCandidateSchema.safeParse({
      ...makeValidCandidate(),
      mainBenefit: tooLong,
    }).success,
    false,
  );
});

test("sérialisation complète JSON", () => {
  const plan = finalizeMarketingPlan({
    brief: makeBrief(),
    candidate: makeValidCandidate(),
    metadata: { id: "plan-ser", createdBy: "tester", correlationId: "corr-ser" },
  });
  const raw = JSON.stringify(plan);
  const again = JSON.parse(raw);
  assert.equal(MarketingPlanSchema.safeParse(again).success, true);
});
