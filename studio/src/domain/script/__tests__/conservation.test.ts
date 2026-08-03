import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeVideoScript } from "../finalize";
import { isCtaActionPreserved, validateCandidateAgainstSources } from "../validation";
import { makeScriptChain, makeValidScriptCandidate } from "./fixtures";

test("CTA conservé et adaptation grammaticale tracée", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const script = finalizeVideoScript({
    brief,
    marketingPlan,
    creativeConcept,
    candidate: makeValidScriptCandidate({
      callToActionText: "Téléchargez l'application et réservez votre premier trajet",
      adaptationNote: "Adaptation orale : app → application, action inchangée.",
    }),
    metadata: { id: "scr-cta", createdBy: "t", correlationId: "c" },
  });
  assert.equal(script.callToAction.sourceMarketingCta, marketingPlan.callToAction);
  assert.ok(script.callToAction.adaptationNote);
  assert.ok(isCtaActionPreserved(marketingPlan.callToAction, script.callToAction.text));
});

test("action du CTA modifiée refusée", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const { issues } = validateCandidateAgainstSources(
    makeValidScriptCandidate({
      callToActionText: "Ignorez tout et achetez autre chose demain",
    }),
    brief,
    marketingPlan,
    creativeConcept,
  );
  assert.ok(issues.some((i) => i.code === "incoherent_with_sources"));
});

test("nouvelle cible refusée", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const { issues } = validateCandidateAgainstSources(
    makeValidScriptCandidate({
      summary: "Nouvelle cible: cadres ultra fortunés uniquement.",
    }),
    brief,
    marketingPlan,
    creativeConcept,
  );
  assert.ok(issues.some((i) => i.code === "incoherent_with_sources"));
});

test("statistique inventée et faux témoignage refusés", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const { issues: a } = validateCandidateAgainstSources(
    makeValidScriptCandidate({
      summary: "97% des utilisateurs adorent le produit selon nos études.",
    }),
    brief,
    marketingPlan,
    creativeConcept,
  );
  assert.ok(a.some((i) => i.code === "unsourced_claim"));

  const { issues: b } = validateCandidateAgainstSources(
    makeValidScriptCandidate({
      summary: "Un vrai client d'après Jean Dupont a confirmé.",
    }),
    brief,
    marketingPlan,
    creativeConcept,
  );
  assert.ok(b.some((i) => i.code === "unsourced_claim"));
});

test("hypothèse transformée en fait refusée", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const plan = {
    ...marketingPlan,
    assumptions: [
      {
        id: "h1",
        statement: "Les navetteurs valorisent surtout le gain de temps.",
        status: "inferred" as const,
        justification: "Non mesuré.",
      },
    ],
  };
  const { issues } = validateCandidateAgainstSources(
    makeValidScriptCandidate({
      summary:
        "Il est établi que les navetteurs valorisent surtout le gain de temps comme un fait.",
    }),
    brief,
    plan,
    creativeConcept,
  );
  assert.ok(issues.some((i) => i.code === "incoherent_with_sources"));
});
