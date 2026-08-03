import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeStoryboardProject } from "../finalize";
import {
  StoryboardAnalysisCandidateSchema,
  StoryboardProjectSchema,
} from "../schemas";
import { makeStoryboardChain, makeValidStoryboardCandidate } from "./fixtures";

test("storyboard minimal valide", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const sb = finalizeStoryboardProject({
    ...chain,
    candidate,
    metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
  });
  assert.equal(StoryboardProjectSchema.safeParse(sb).success, true);
  assert.equal(sb.timing.status, "exact");
  assert.equal(sb.scenes.length, chain.videoScript.segments.length);
});

test("scènes vides refusées", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection, {
    overrides: { scenes: [] },
  });
  assert.equal(StoryboardAnalysisCandidateSchema.safeParse(candidate).success, false);
});

test("IDs ou ordres dupliqués", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  candidate.scenes[1]!.id = candidate.scenes[0]!.id;
  assert.throws(() =>
    finalizeStoryboardProject({
      ...chain,
      candidate,
      metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
    }),
  );
});

test("ordres non contigus", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  candidate.scenes[2]!.order = 99;
  assert.throws(() =>
    finalizeStoryboardProject({
      ...chain,
      candidate,
      metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
    }),
  );
});

test("segment inconnu", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  candidate.scenes[0]!.scriptSegmentId = "nope";
  assert.throws(() =>
    finalizeStoryboardProject({
      ...chain,
      candidate,
      metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
    }),
  );
});

test("direction visuelle inconnue", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  candidate.scenes[0]!.visualDirectionSegmentId = "vd-missing";
  assert.throws(() =>
    finalizeStoryboardProject({
      ...chain,
      candidate,
      metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
    }),
  );
});

test("transition invalide", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const bad = {
    ...candidate,
    scenes: candidate.scenes.map((s, i) =>
      i === 0
        ? { ...s, transition: { type: "whip_pan" as "cut" } }
        : s,
    ),
  };
  assert.equal(StoryboardAnalysisCandidateSchema.safeParse(bad).success, false);
});

test("serialization JSON", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const sb = finalizeStoryboardProject({
    ...chain,
    candidate,
    metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
  });
  assert.equal(
    StoryboardProjectSchema.safeParse(JSON.parse(JSON.stringify(sb))).success,
    true,
  );
});
