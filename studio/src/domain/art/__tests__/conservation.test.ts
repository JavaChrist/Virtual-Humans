import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeVisualDirection } from "../finalize";
import { validateCandidateAgainstSources } from "../validation";
import { makeArtChain, makeValidArtCandidate } from "./fixtures";

test("segments et ordre conservés", () => {
  const chain = makeArtChain();
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  const dir = finalizeVisualDirection({
    ...chain,
    candidate,
    metadata: { id: "art-1", createdBy: "tester", correlationId: "corr-art-1" },
  });
  assert.deepEqual(
    dir.segments.map((s) => s.scriptSegmentId),
    chain.videoScript.segments.map((s) => s.id),
  );
});

test("dialogues et CTA inchangés (références script)", () => {
  const chain = makeArtChain();
  const beforeDialogues = chain.videoScript.segments.map((s) => s.dialogue);
  const beforeCta = chain.videoScript.callToAction.text;
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  finalizeVisualDirection({
    ...chain,
    candidate,
    metadata: { id: "art-1", createdBy: "tester", correlationId: "corr-art-1" },
  });
  assert.deepEqual(
    chain.videoScript.segments.map((s) => s.dialogue),
    beforeDialogues,
  );
  assert.equal(chain.videoScript.callToAction.text, beforeCta);
});

test("grande idée et bénéfice conservés dans evidence", () => {
  const chain = makeArtChain();
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  const dir = finalizeVisualDirection({
    ...chain,
    candidate,
    metadata: { id: "art-1", createdBy: "tester", correlationId: "corr-art-1" },
  });
  assert.ok(dir.evidence.some((e) => e.field === "bigIdea"));
  assert.ok(dir.evidence.some((e) => e.field === "mainBenefit"));
  assert.ok(dir.globalStyle.brandAlignment.includes("attente"));
});

test("texte modifié / segment ajouté refusés", () => {
  const chain = makeArtChain();
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id), {
    overrides: {
      notes: "On modifie le texte du dialogue et on ajoute un segment.",
    },
  });
  const { issues } = validateCandidateAgainstSources(
    candidate,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.ok(issues.some((i) => i.code === "incoherent_with_sources"));
});

test("hypothèse transformée en fait refusée", () => {
  const chain = makeArtChain();
  const plan = {
    ...chain.marketingPlan,
    assumptions: [
      {
        id: "inferred-a1",
        statement: "Les navetteurs valorisent surtout le gain de temps en heure de pointe.",
        status: "inferred" as const,
        affectsFields: ["mainBenefit"],
      },
    ],
  };
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id), {
    overrides: {
      notes:
        "Les navetteurs valorisent surtout le gain de temps en heure de pointe — il est établi que c'est un fait.",
    },
  });
  const { issues } = validateCandidateAgainstSources(
    candidate,
    chain.brief,
    plan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.ok(issues.some((i) => i.message.includes("Hypothèse")));
});
