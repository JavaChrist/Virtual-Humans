import assert from "node:assert/strict";
import { test } from "node:test";
import { ArtAnalysisCandidateSchema } from "../schemas";
import { detectResponsibilityLeaks, validateCandidateAgainstSources } from "../validation";
import { finalizeVisualDirection } from "../finalize";
import { makeArtChain, makeValidArtCandidate } from "./fixtures";

test("direction visuelle valide acceptée", () => {
  const chain = makeArtChain();
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  const dir = finalizeVisualDirection({
    ...chain,
    candidate,
    metadata: { id: "art-1", createdBy: "tester", correlationId: "corr-art-1" },
  });
  assert.equal(dir.schemaVersion, "1.0.0");
  assert.ok(!("prompt" in dir));
  assert.ok(!("model" in dir));
});

test("champs structurés interdits dans le candidat", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const base = makeValidArtCandidate(ids);
  for (const key of [
    "prompt",
    "negativePrompt",
    "model",
    "provider",
    "costCents",
    "fallback",
    "apiParams",
    "shotBreakdown",
  ]) {
    const raw = { ...base, [key]: "x" };
    assert.equal(
      ArtAnalysisCandidateSchema.safeParse(raw).success,
      false,
      `expected reject ${key}`,
    );
  }
});

test("prompt / negative / model / coût détectés dans textes", () => {
  assert.ok(detectResponsibilityLeaks("negative prompt: blur", "notes").length > 0);
  assert.ok(detectResponsibilityLeaks("utiliser fal.ai pour générer", "notes").length > 0);
  assert.ok(detectResponsibilityLeaks("costCents=12", "notes").length > 0);
  assert.ok(detectResponsibilityLeaks("découpage technique plan 3 :=", "notes").length > 0);
});

test("mots ordinaires ne déclenchent pas de faux positifs naïfs", () => {
  const chain = makeArtChain();
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id), {
    overrides: {
      notes: "Le modèle économique du client reste hors scope ; on cadre le sujet.",
    },
  });
  const { issues } = validateCandidateAgainstSources(
    candidate,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.equal(
    issues.filter((i) => i.code === "responsibility_leak").length,
    0,
  );
});
