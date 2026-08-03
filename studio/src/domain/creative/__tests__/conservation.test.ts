import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeCreativeConcept } from "../finalize";
import { validateCandidateAgainstMarketing } from "../validation";
import {
  makeCreativeBrief,
  makeMarketingPlan,
  makeValidCreativeCandidate,
} from "./fixtures";

test("objectif audience bénéfice ton CTA métrique conservés via evidence", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);
  const concept = finalizeCreativeConcept({
    brief,
    marketingPlan: plan,
    candidate: makeValidCreativeCandidate(),
    metadata: { id: "cre-cons", createdBy: "t", correlationId: "c" },
  });
  const fields = concept.evidence.map((e) => e.field);
  for (const f of [
    "marketingObjective",
    "primaryAudience",
    "mainBenefit",
    "tone",
    "callToAction",
    "keyMessages",
    "successMetric",
  ]) {
    assert.ok(fields.includes(f), `missing evidence for ${f}`);
  }
  assert.equal(concept.marketingPlanRevisionId, plan.id);
});

test("changement de CTA refusé", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);
  const { issues } = validateCandidateAgainstMarketing(
    makeValidCreativeCandidate({
      logline: "CTA: Achetez autre chose immédiatement aujourd'hui",
    }),
    plan,
    brief,
  );
  assert.ok(issues.some((i) => i.code === "incoherent_with_marketing"));
});

test("nouvelle cible refusée", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);
  const { issues } = validateCandidateAgainstMarketing(
    makeValidCreativeCandidate({
      logline: "Nouvelle cible: cadres seniors ultra fortunés uniquement.",
      bigIdea:
        "Nouvelle cible cadre premium sans lien avec le bénéfice mobilité partagée urbaine.",
    }),
    plan,
    brief,
  );
  assert.ok(issues.some((i) => i.code === "incoherent_with_marketing"));
});

test("bénéfice inventé / idée sans lien refusé", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);
  const { issues } = validateCandidateAgainstMarketing(
    makeValidCreativeCandidate({
      bigIdea: "Vendre des chaussures de luxe sans aucun rapport avec le trajet.",
    }),
    plan,
    brief,
  );
  assert.ok(issues.some((i) => i.field === "bigIdea"));
});

test("hypothèse transformée en fait refusée", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief, {
    assumptions: [
      {
        id: "h1",
        statement: "Les navetteurs valorisent surtout le gain de temps.",
        status: "inferred",
        justification: "Non mesuré dans le brief.",
      },
    ],
  });
  const { issues } = validateCandidateAgainstMarketing(
    makeValidCreativeCandidate({
      logline:
        "Il est établi que les navetteurs valorisent surtout le gain de temps comme un fait.",
    }),
    plan,
    brief,
  );
  assert.ok(issues.some((i) => i.code === "incoherent_with_marketing"));
});
