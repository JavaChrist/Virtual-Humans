import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectForbiddenReferences,
  detectResponsibilityLeaks,
  validateCandidateAgainstMarketing,
} from "../validation";
import {
  makeCreativeBrief,
  makeMarketingPlan,
  makeValidCreativeCandidate,
} from "./fixtures";
import { finalizeCreativeConcept } from "../finalize";

test("dialogue définitif détecté", () => {
  const issues = detectResponsibilityLeaks(
    'Dialogue: "Bonjour, je m\'appelle Alex" — Personnage',
    "logline",
  );
  assert.ok(issues.some((i) => i.code === "responsibility_leak"));
});

test("liste de scènes détaillées détectée", () => {
  assert.ok(
    detectResponsibilityLeaks("Scène 1 — intro puis Scène 2 — preuve", "bigIdea").length > 0,
  );
});

test("instruction caméra détectée", () => {
  assert.ok(detectResponsibilityLeaks("Start with a close-up then dolly in", "openingDevice").length > 0);
});

test("prompt détecté", () => {
  assert.ok(detectResponsibilityLeaks("negative prompt: blurry face", "notes").length > 0);
});

test("provider ou modèle détecté", () => {
  assert.ok(detectResponsibilityLeaks("Use openai gpt-4 for copy", "notes").length > 0);
});

test("coût ou stratégie de génération détecté", () => {
  assert.ok(
    detectResponsibilityLeaks("Respect the generation plan and costCents", "notes").length > 0,
  );
});

test("idée créative valide acceptée", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);
  const concept = finalizeCreativeConcept({
    brief,
    marketingPlan: plan,
    candidate: makeValidCreativeCandidate(),
    metadata: { id: "cre-ok", createdBy: "t", correlationId: "c" },
  });
  assert.ok(concept.bigIdea.includes("attente") || concept.bigIdea.includes("vite"));
});

test("mots ordinaires ne bloquent pas (caméra au sens figuré absent)", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);
  const { issues } = validateCandidateAgainstMarketing(
    makeValidCreativeCandidate({
      logline:
        "Un navetteur prend une décision claire pour arriver plus vite sans stress inutile.",
    }),
    plan,
    brief,
  );
  assert.equal(
    issues.filter((i) => i.code === "responsibility_leak").length,
    0,
  );
});

test("artiste / IP refusés", () => {
  assert.ok(detectForbiddenReferences("dans le style exact de Picasso", "bigIdea").length > 0);
  assert.ok(detectForbiddenReferences("comme un film Marvel", "logline").length > 0);
  assert.ok(detectForbiddenReferences("à la manière de Wes Anderson", "notes").length > 0);
});

test("faux positifs français / plateforme / générique non refusés", () => {
  assert.equal(detectForbiddenReferences("comme un film documentaire", "logline").length, 0);
  assert.equal(detectForbiddenReferences("Publier sur LinkedIn", "openingDevice").length, 0);
  assert.equal(detectForbiddenReferences("Comme Objectif accélère", "bigIdea").length, 0);
  assert.equal(
    detectForbiddenReferences("palette chaude, rythme dynamique, texture grain", "notes").length,
    0,
  );
});
