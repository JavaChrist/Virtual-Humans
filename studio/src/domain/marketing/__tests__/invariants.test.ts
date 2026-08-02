import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCtaCompatibleWithObjective,
  looksLikeFeatureOnlyBenefit,
  validateCandidateAgainstBrief,
} from "../validation";
import { finalizeMarketingPlan } from "../finalize";
import { makeBrief, makeValidCandidate } from "./fixtures";

test("objectif et CTA cohérents", () => {
  assert.equal(
    isCtaCompatibleWithObjective("Téléchargez l'app maintenant", "conversion"),
    true,
  );
  assert.equal(
    isCtaCompatibleWithObjective("Achetez dès aujourd'hui", "conversion"),
    true,
  );
});

test("CTA incompatible détecté", () => {
  const { issues } = validateCandidateAgainstBrief(
    makeValidCandidate({
      marketingObjective: "conversion",
      callToAction: "Bonne journée à tous",
    }),
    makeBrief(),
  );
  assert.ok(issues.some((i) => i.field === "callToAction"));
});

test("bénéfice qui répète seulement une fonctionnalité", () => {
  assert.equal(looksLikeFeatureOnlyBenefit("Fonctionnalité de géolocalisation"), true);
  const { issues } = validateCandidateAgainstBrief(
    makeValidCandidate({ mainBenefit: "Feature GPS intégrée" }),
    makeBrief(),
  );
  assert.ok(issues.some((i) => i.field === "mainBenefit"));
});

test("promesse non sourcée dans le hook", () => {
  const { issues } = validateCandidateAgainstBrief(
    makeValidCandidate({
      emotionalHook: "Garantie 100% de doubler vos revenus sans risque",
    }),
    makeBrief(),
  );
  assert.ok(issues.some((i) => i.code === "unsourced_claim"));
});

test("cible sensible inventée rejetée", () => {
  const { issues } = validateCandidateAgainstBrief(
    makeValidCandidate({
      primaryAudience: {
        label: "Cible",
        description: "Personnes d'une race spécifique pour le produit",
        needs: ["x"],
        painPoints: ["y"],
      },
    }),
    makeBrief(),
  );
  assert.ok(issues.some((i) => i.code === "sensitive_targeting"));
});

test("objectif incohérent avec le brief", () => {
  const { issues } = validateCandidateAgainstBrief(
    makeValidCandidate({ marketingObjective: "awareness" }),
    makeBrief({ objective: "conversion" }),
  );
  assert.ok(issues.some((i) => i.code === "incoherent_with_brief"));
});

test("preuve dérivée sans hypothèse", () => {
  const { issues } = validateCandidateAgainstBrief(
    makeValidCandidate({
      assumptions: [],
      claimedEvidence: [
        {
          field: "uniqueSellingPoint",
          source: "derived",
          summary: "USP inventée sans hypothèse associée claire",
        },
      ],
    }),
    makeBrief(),
  );
  assert.ok(issues.some((i) => i.code === "unsourced_claim"));
});

test("information dérivée correctement marquée après finalize", () => {
  const base = makeBrief({
    objective: "awareness",
    callToAction: "Découvrez notre solution",
  });
  const brief = {
    ...base,
    audienceDescription: undefined,
    callToAction: undefined,
  };
  const candidate = makeValidCandidate({
    marketingObjective: "awareness",
    callToAction: "Découvrez RideCloud aujourd'hui",
    successMetric: { kind: "view", description: "Vues de la vidéo" },
    assumptions: [
      {
        id: "a-aud",
        statement: "Audience hypothétique navetteurs",
        status: "inferred",
        justification: "Pas d'audience dans le brief",
        affectsFields: ["primaryAudience"],
      },
    ],
  });
  const plan = finalizeMarketingPlan({
    brief,
    candidate,
    metadata: { id: "p-der", createdBy: "t", correlationId: "c-der" },
  });
  assert.ok(plan.evidence.some((e) => e.source === "derived"));
  assert.ok(plan.assumptions.some((a) => a.status === "inferred"));
});

test("absence de provider/model/prompt dans le plan", () => {
  const plan = finalizeMarketingPlan({
    brief: makeBrief(),
    candidate: makeValidCandidate(),
    metadata: { id: "p-tech", createdBy: "t", correlationId: "c-tech" },
  });
  const record = plan as unknown as Record<string, unknown>;
  for (const bad of ["provider", "modelId", "model", "prompt", "systemPrompt"]) {
    assert.equal(bad in record, false);
  }
});
