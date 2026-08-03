import assert from "node:assert/strict";
import { test } from "node:test";
import { detectResponsibilityLeaks, validateCandidateAgainstSources } from "../validation";
import { finalizeVideoScript } from "../finalize";
import { makeScriptChain, makeValidScriptCandidate } from "./fixtures";

test("décor / caméra / pose / éclairage / prompt / provider / coût refusés", () => {
  assert.ok(detectResponsibilityLeaks("Changer le décor intérieur moderne", "x").length > 0);
  assert.ok(detectResponsibilityLeaks("Start with a close-up then dolly", "x").length > 0);
  assert.ok(detectResponsibilityLeaks("Pose: bras croisés face caméra", "x").length > 0);
  assert.ok(detectResponsibilityLeaks("Utiliser un key light doux", "x").length > 0);
  assert.ok(detectResponsibilityLeaks("negative prompt: blur", "x").length > 0);
  assert.ok(detectResponsibilityLeaks("Use openai gpt-4", "x").length > 0);
  assert.ok(detectResponsibilityLeaks("Respect costCents in generation plan", "x").length > 0);
});

test("émotion vocale simple acceptée", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const script = finalizeVideoScript({
    brief,
    marketingPlan,
    creativeConcept,
    candidate: makeValidScriptCandidate(),
    metadata: { id: "scr-emo", createdBy: "t", correlationId: "c" },
  });
  assert.ok(script.segments.every((s) => s.emotion.length > 0));
});

test("mots ordinaires ne bloquent pas", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const { issues } = validateCandidateAgainstSources(
    makeValidScriptCandidate({
      summary:
        "Le message reste clair pour arriver plus vite sans stress inutile au quotidien.",
    }),
    brief,
    marketingPlan,
    creativeConcept,
  );
  assert.equal(issues.filter((i) => i.code === "responsibility_leak").length, 0);
});
