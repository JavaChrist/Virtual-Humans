import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizePromptPackages } from "../finalize";
import { validateFidelity } from "../validation";
import { makePromptChain, makeValidPromptCandidate } from "./fixtures";

test("dialogue identique verbatim", () => {
  const chain = makePromptChain();
  const out = finalizePromptPackages({
    ...chain,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "c" },
  });
  for (const scene of chain.storyboard.scenes) {
    if (scene.spokenContent.kind === "none") continue;
    const pkg = out.packages.find((p) => p.sceneId === scene.id)!;
    assert.equal(pkg.dialogue?.text, scene.spokenContent.sourceText);
    assert.equal(pkg.dialogue?.fidelity, "verbatim");
  }
});

test("dialogue modifié refusé", () => {
  const chain = makePromptChain();
  const out = finalizePromptPackages({
    ...chain,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "c" },
  });
  const pkg = out.packages.find((p) => p.dialogue)!;
  const tampered = {
    ...pkg,
    dialogue: { ...pkg.dialogue!, text: pkg.dialogue!.text + " EXTRA" },
  };
  const issues = validateFidelity(
    tampered,
    chain.storyboard,
    chain.videoScript,
    chain.visualDirection,
  );
  assert.ok(issues.some((i) => i.code === "fidelity_violation"));
});

test("caméra / style / intent conservés", () => {
  const chain = makePromptChain();
  const out = finalizePromptPackages({
    ...chain,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "c" },
  });
  for (const pkg of out.packages) {
    const scene = chain.storyboard.scenes.find((s) => s.id === pkg.sceneId)!;
    assert.equal(pkg.productionIntent, scene.productionIntent);
    assert.equal(pkg.style.style, chain.visualDirection.globalStyle.style);
  }
});

test("référence inventée refusée", () => {
  const chain = makePromptChain({ withCharacter: true });
  const out = finalizePromptPackages({
    ...chain,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "c" },
  });
  const pkg = out.packages[0]!;
  const tampered = {
    ...pkg,
    references: [
      ...pkg.references,
      {
        id: "fake",
        kind: "outfit" as const,
        sourceId: "outfit-invented",
        role: "x",
        required: false,
      },
    ],
  };
  const issues = validateFidelity(
    tampered,
    chain.storyboard,
    chain.videoScript,
    chain.visualDirection,
  );
  assert.ok(issues.some((i) => i.message.includes("Référence")));
});
