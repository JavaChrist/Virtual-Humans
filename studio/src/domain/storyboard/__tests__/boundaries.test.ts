import assert from "node:assert/strict";
import { test } from "node:test";
import { StoryboardAnalysisCandidateSchema } from "../schemas";
import { detectResponsibilityLeaks, validateCandidateAgainstSources } from "../validation";
import { finalizeStoryboardProject } from "../finalize";
import { makeStoryboardChain, makeValidStoryboardCandidate } from "./fixtures";

test("intention provider-agnostic valide", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const sb = finalizeStoryboardProject({
    ...chain,
    candidate,
    metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
  });
  assert.ok(sb.scenes.every((s) => typeof s.productionIntent === "string"));
  assert.ok(!("prompt" in sb));
  assert.ok(!("model" in sb));
});

test("champs structurés interdits", () => {
  const chain = makeStoryboardChain();
  const base = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  for (const key of [
    "prompt",
    "negativePrompt",
    "model",
    "provider",
    "costCents",
    "fallback",
    "apiParams",
    "merge",
  ]) {
    assert.equal(
      StoryboardAnalysisCandidateSchema.safeParse({ ...base, [key]: "x" }).success,
      false,
      `expected reject ${key}`,
    );
  }
});

test("fuites texte prompt/provider/coût/merge", () => {
  assert.ok(detectResponsibilityLeaks("negative prompt: blur", "notes").length > 0);
  assert.ok(detectResponsibilityLeaks("utiliser kling pour générer", "notes").length > 0);
  assert.ok(detectResponsibilityLeaks("costCents=12", "notes").length > 0);
  assert.ok(detectResponsibilityLeaks("call /api/generate/merge maintenant", "notes").length > 0);
});

test("mots ordinaires ne déclenchent pas de faux positifs", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection, {
    overrides: {
      notes: "Le modèle économique du client reste hors scope ; on cadre le rythme.",
    },
  });
  const { issues } = validateCandidateAgainstSources(
    candidate,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    chain.visualDirection,
  );
  assert.equal(issues.filter((i) => i.code === "responsibility_leak").length, 0);
});
