import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeStoryboardProject } from "../finalize";
import { validateCandidateAgainstSources } from "../validation";
import { makeStoryboardChain, makeValidStoryboardCandidate } from "./fixtures";

test("texte, CTA et ordre conservés", () => {
  const chain = makeStoryboardChain();
  const beforeCta = chain.videoScript.callToAction.text;
  const beforeDialogues = chain.videoScript.segments.map((s) => s.dialogue);
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const sb = finalizeStoryboardProject({
    ...chain,
    candidate,
    metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
  });
  assert.deepEqual(
    chain.videoScript.segments.map((s) => s.dialogue),
    beforeDialogues,
  );
  assert.equal(chain.videoScript.callToAction.text, beforeCta);
  assert.deepEqual(
    [...new Set(sb.scenes.map((s) => s.scriptSegmentId))],
    chain.videoScript.segments.map((s) => s.id),
  );
});

test("direction artistique conservée", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const sb = finalizeStoryboardProject({
    ...chain,
    candidate,
    metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
  });
  assert.ok(sb.evidence.some((e) => e.field === "globalStyle"));
  assert.ok(sb.evidence.some((e) => e.field === "palette"));
});

test("asset changé refusé", () => {
  const chain = makeStoryboardChain({ withCharacter: true });
  const candidate = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
    { withCharacter: true },
  );
  const outfitRef = candidate.scenes[0]!.references.find((r) => r.kind === "outfit");
  if (outfitRef) outfitRef.sourceId = "outfit-smart";
  const { issues } = validateCandidateAgainstSources(
    candidate,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    chain.visualDirection,
  );
  assert.ok(issues.some((i) => i.message.includes("tenue") || i.code === "incoherent_with_sources"));
});

test("dialogue réécrit / segment refusé", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection, {
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
    chain.visualDirection,
  );
  assert.ok(issues.some((i) => i.code === "incoherent_with_sources"));
});

test("hypothèse transformée en fait refusée", () => {
  const chain = makeStoryboardChain();
  const script = {
    ...chain.videoScript,
    assumptions: [
      {
        id: "inf-1",
        statement: "Le rythme oral FR du profil speech-fr-v1 est acceptable pour ce spot.",
        status: "inferred" as const,
        affectsFields: ["timing"],
      },
    ],
  };
  const candidate = makeValidStoryboardCandidate(script, chain.visualDirection, {
    overrides: {
      notes:
        "Le rythme oral FR du profil speech-fr-v1 est acceptable pour ce spot — il est établi que c'est un fait.",
    },
  });
  const { issues } = validateCandidateAgainstSources(
    candidate,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    script,
    chain.visualDirection,
  );
  assert.ok(issues.some((i) => i.message.includes("Hypothèse")));
});
