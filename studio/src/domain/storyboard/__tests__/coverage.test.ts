import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSceneCoverage, reconstructSpokenFromScenes } from "../coverage";
import { finalizeStoryboardProject } from "../finalize";
import { makeStoryboardChain, makeValidStoryboardCandidate } from "./fixtures";

test("un segment → une scène", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const sb = finalizeStoryboardProject({
    ...chain,
    candidate,
    metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
  });
  assert.equal(sb.scenes.length, chain.videoScript.segments.length);
});

test("un segment → plusieurs scènes", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection, {
    splitFirstSegment: true,
  });
  const sb = finalizeStoryboardProject({
    ...chain,
    candidate,
    metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
  });
  assert.ok(sb.scenes.length > chain.videoScript.segments.length);
  const firstSegScenes = sb.scenes.filter((s) => s.scriptSegmentId === "seg-1");
  assert.equal(firstSegScenes.length, 2);
  assert.equal(firstSegScenes[1]!.order, firstSegScenes[0]!.order + 1);
});

test("segment manquant", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  candidate.scenes = candidate.scenes.slice(0, -1);
  const provisional = candidate.scenes.map((s) => ({ ...s, durationSeconds: 1 }));
  const issues = validateSceneCoverage(
    provisional,
    chain.videoScript,
    chain.visualDirection,
  );
  assert.ok(issues.some((i) => i.message.includes("non couvert")));
});

test("scène orpheline", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  candidate.scenes.push({
    ...candidate.scenes[0]!,
    id: "orphan",
    order: candidate.scenes.length + 1,
    scriptSegmentId: "ghost",
  });
  const provisional = candidate.scenes.map((s) => ({ ...s, durationSeconds: 1 }));
  const issues = validateSceneCoverage(
    provisional,
    chain.videoScript,
    chain.visualDirection,
  );
  assert.ok(issues.some((i) => i.message.includes("inconnu") || i.message.includes("orphe")));
});

test("segments réordonnés", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  // Swap first two segment ids while keeping orders 1..n
  const a = candidate.scenes[0]!;
  const b = candidate.scenes[1]!;
  candidate.scenes[0] = { ...a, scriptSegmentId: b.scriptSegmentId, visualDirectionSegmentId: b.visualDirectionSegmentId };
  candidate.scenes[1] = { ...b, scriptSegmentId: a.scriptSegmentId, visualDirectionSegmentId: a.visualDirectionSegmentId };
  const provisional = candidate.scenes.map((s) => ({ ...s, durationSeconds: 1 }));
  const issues = validateSceneCoverage(
    provisional,
    chain.videoScript,
    chain.visualDirection,
  );
  assert.ok(issues.some((i) => i.code === "coverage_violation"));
});

test("texte parlé reconstruit exactement", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection, {
    splitFirstSegment: true,
  });
  const parts = candidate.scenes
    .filter((s) => s.scriptSegmentId === "seg-1")
    .map((s) => (s.spokenContent.kind === "dialogue" ? s.spokenContent.sourceText : ""));
  const source = chain.videoScript.segments.find((s) => s.id === "seg-1")!.dialogue!;
  assert.equal(reconstructSpokenFromScenes(parts), source.replace(/\s+/g, " ").trim());
  finalizeStoryboardProject({
    ...chain,
    candidate,
    metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
  });
});

test("mot ajouté / modifié refusé", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  if (candidate.scenes[0]!.spokenContent.kind === "dialogue") {
    candidate.scenes[0]!.spokenContent = {
      kind: "dialogue",
      sourceText: candidate.scenes[0]!.spokenContent.sourceText + " EXTRA",
    };
  }
  assert.throws(() =>
    finalizeStoryboardProject({
      ...chain,
      candidate,
      metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
    }),
  );
});
