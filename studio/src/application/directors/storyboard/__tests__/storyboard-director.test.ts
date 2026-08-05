import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoryboardAnalysisCandidate } from "@/domain/storyboard";
import {
  makeStoryboardChain,
  makeValidStoryboardCandidate,
} from "@/domain/storyboard/__tests__/fixtures";
import { createStoryboardDirector } from "../storyboard-director";
import type { StoryboardAnalyzerPort } from "../analyzer-port";

function fakeAnalyzer(candidate: StoryboardAnalysisCandidate): StoryboardAnalyzerPort {
  return {
    async analyze() {
      return { candidate };
    },
  };
}

test("candidat valide → completed", async () => {
  const chain = makeStoryboardChain({ withCharacter: true });
  const candidate = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
    { withCharacter: true },
  );
  const director = createStoryboardDirector({ analyzer: fakeAnalyzer(candidate) });
  const brief = { ...chain.brief };
  const result = await director.run(
    {
      brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      visualDirection: chain.visualDirection,
    },
    {
      correlationId: "corr-sb-run",
      mode: "execute",
      createdBy: "tester",
      planId: "sb-fixed",
    },
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.storyboard.id, "sb-fixed");
  assert.equal(result.storyboard.correlationId, "corr-sb-run");
  assert.equal(result.storyboard.videoScriptRevisionId, chain.videoScript.id);
  assert.equal(result.storyboard.visualDirectionRevisionId, chain.visualDirection.id);
  assert.ok(Object.isFrozen(result.storyboard));
  assert.equal(brief.projectId, chain.brief.projectId);
});

test("référence essentielle absente → needs_input", async () => {
  const chain = makeStoryboardChain({ withCharacter: true });
  const candidate = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
    { withCharacter: true },
  );
  for (const sc of candidate.scenes) {
    sc.references = [
      {
        id: "missing-outfit",
        kind: "outfit",
        sourceId: "outfit-does-not-exist",
        role: "wardrobe",
        required: true,
      },
    ];
  }
  const director = createStoryboardDirector({ analyzer: fakeAnalyzer(candidate) });
  const result = await director.run(
    {
      brief: chain.brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      visualDirection: chain.visualDirection,
    },
    { correlationId: "corr-sb-run", mode: "execute" },
  );
  assert.ok(result.status === "needs_input" || result.status === "invalid");
});

test("candidat invalide → invalid", async () => {
  const chain = makeStoryboardChain();
  const bad = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  bad.scenes = [];
  const director = createStoryboardDirector({ analyzer: fakeAnalyzer(bad) });
  const result = await director.run(
    {
      brief: chain.brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      visualDirection: chain.visualDirection,
    },
    { correlationId: "corr-sb-run", mode: "execute" },
  );
  assert.equal(result.status, "invalid");
});

test("erreur du port sans fuite", async () => {
  const chain = makeStoryboardChain();
  const director = createStoryboardDirector({
    analyzer: {
      async analyze() {
        throw new Error("provider key sk-secretKEY123 leaked");
      },
    },
  });
  const result = await director.run(
    {
      brief: chain.brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      visualDirection: chain.visualDirection,
    },
    { correlationId: "corr-sb-run", mode: "execute" },
  );
  assert.equal(result.status, "provider_failed");
  if (result.status !== "provider_failed") return;
  assert.equal(result.failure.code, "internal_error");
  assert.equal(result.failure.publicMessage.includes("sk-secretKEY123"), false);
});

test("entrées non mutées", async () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const scriptCopy = JSON.stringify(chain.videoScript);
  const visualCopy = JSON.stringify(chain.visualDirection);
  const director = createStoryboardDirector({ analyzer: fakeAnalyzer(candidate) });
  await director.run(
    {
      brief: chain.brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      visualDirection: chain.visualDirection,
    },
    { correlationId: "corr-sb-run", mode: "execute" },
  );
  assert.equal(JSON.stringify(chain.videoScript), scriptCopy);
  assert.equal(JSON.stringify(chain.visualDirection), visualCopy);
});
