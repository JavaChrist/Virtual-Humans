import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizePromptPackages } from "../finalize";
import { validatePackageCoverage } from "../validation";
import { makePromptChain, makeValidPromptCandidate } from "./fixtures";

test("exactement un package par scène", () => {
  const chain = makePromptChain();
  const out = finalizePromptPackages({
    ...chain,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "c" },
  });
  assert.equal(out.packages.length, chain.storyboard.scenes.length);
  assert.deepEqual(
    out.packages.map((p) => p.sceneId),
    [...chain.storyboard.scenes].sort((a, b) => a.order - b.order).map((s) => s.id),
  );
});

test("package manquant / supplémentaire", () => {
  const chain = makePromptChain();
  const out = finalizePromptPackages({
    ...chain,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "c" },
  });
  const missing = out.packages.slice(0, -1);
  assert.ok(validatePackageCoverage(missing, chain.storyboard).length > 0);
  const extra = [
    ...out.packages,
    { ...out.packages[0]!, sceneId: "ghost", id: "ghost-pkg" },
  ];
  assert.ok(validatePackageCoverage(extra, chain.storyboard).length > 0);
});

test("ordre et révision", () => {
  const chain = makePromptChain();
  const out = finalizePromptPackages({
    ...chain,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "c" },
  });
  const wrongOrder = out.packages.map((p, i) =>
    i === 0 ? { ...p, sceneOrder: 99 } : p,
  );
  assert.ok(validatePackageCoverage(wrongOrder, chain.storyboard).length > 0);
  const wrongRev = out.packages.map((p) => ({
    ...p,
    storyboardRevisionId: "other",
  }));
  assert.ok(validatePackageCoverage(wrongRev, chain.storyboard).length > 0);
});
