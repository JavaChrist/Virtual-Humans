import assert from "node:assert/strict";
import { test } from "node:test";
import type { ArtAnalysisCandidate } from "@/domain/art";
import {
  makeArtChain,
  makeGenericSnapshot,
  makeValidArtCandidate,
} from "@/domain/art/__tests__/fixtures";
import { createArtDirector } from "../art-director";
import type { ArtAnalyzerPort } from "../analyzer-port";

function fakeAnalyzer(candidate: ArtAnalysisCandidate): ArtAnalyzerPort {
  return {
    async analyze() {
      return { candidate };
    },
  };
}

test("candidat valide → completed", async () => {
  const chain = makeArtChain({ withCharacter: true });
  const snap = makeGenericSnapshot();
  const candidate = makeValidArtCandidate(
    chain.videoScript.segments.map((s) => s.id),
    { withCharacter: true },
  );
  const director = createArtDirector({ analyzer: fakeAnalyzer(candidate) });
  const brief = { ...chain.brief };
  const result = await director.run(
    {
      brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      characterCapabilities: snap,
    },
    { correlationId: "corr-art-run", mode: "execute", createdBy: "tester", planId: "art-fixed" },
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.visualDirection.id, "art-fixed");
  assert.equal(result.visualDirection.correlationId, "corr-art-run");
  assert.equal(result.visualDirection.videoScriptRevisionId, chain.videoScript.id);
  assert.ok(Object.isFrozen(result.visualDirection));
  assert.equal(brief.projectId, chain.brief.projectId);
});

test("asset essentiel absent → needs_input", async () => {
  const chain = makeArtChain({ withCharacter: true });
  const snap = makeGenericSnapshot({ availableOutfits: [] });
  const candidate = makeValidArtCandidate(
    chain.videoScript.segments.map((s) => s.id),
    { withCharacter: true },
  );
  const director = createArtDirector({ analyzer: fakeAnalyzer(candidate) });
  const result = await director.run(
    {
      ...chain,
      characterCapabilities: snap,
    },
    { correlationId: "corr-art-run", mode: "execute" },
  );
  assert.equal(result.status, "needs_input");
});

test("candidat invalide → invalid", async () => {
  const chain = makeArtChain();
  const bad = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  bad.segments = [];
  const director = createArtDirector({ analyzer: fakeAnalyzer(bad) });
  const result = await director.run(chain, {
    correlationId: "corr-art-run",
    mode: "execute",
  });
  assert.equal(result.status, "invalid");
});

test("erreur du port sans fuite sensible", async () => {
  const chain = makeArtChain();
  const director = createArtDirector({
    analyzer: {
      async analyze() {
        throw new Error("provider key sk-secretKEY123 leaked");
      },
    },
  });
  const result = await director.run(chain, {
    correlationId: "corr-art-run",
    mode: "execute",
  });
  assert.equal(result.status, "provider_failed");
  if (result.status !== "provider_failed") return;
  assert.equal(result.failure.code, "internal_error");
  assert.equal(result.failure.publicMessage.includes("sk-secretKEY123"), false);
});

test("entrées non mutées", async () => {
  const chain = makeArtChain();
  const snap = undefined;
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  const scriptCopy = JSON.stringify(chain.videoScript);
  const director = createArtDirector({ analyzer: fakeAnalyzer(candidate) });
  await director.run(
    { ...chain, characterCapabilities: snap },
    { correlationId: "corr-art-run", mode: "execute" },
  );
  assert.equal(JSON.stringify(chain.videoScript), scriptCopy);
});
