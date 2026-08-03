import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizePromptPackages } from "../finalize";
import { ScenePackageSchema, PromptAnalysisCandidateSchema } from "../schemas";
import { SCENE_PACKAGE_ARTIFACT_TYPE } from "../scene-package";
import { makePromptChain, makeValidPromptCandidate } from "./fixtures";

test("package minimal valide", () => {
  const chain = makePromptChain();
  const out = finalizePromptPackages({
    ...chain,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "corr-pkg-1", idPrefix: "pkg" },
  });
  assert.equal(out.packages.length, chain.storyboard.scenes.length);
  for (const pkg of out.packages) {
    assert.equal(ScenePackageSchema.safeParse(pkg).success, true);
    assert.equal(pkg.artifactType, SCENE_PACKAGE_ARTIFACT_TYPE);
  }
});

test("mauvais artifact type", () => {
  const chain = makePromptChain();
  const out = finalizePromptPackages({
    ...chain,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "c" },
  });
  const bad = { ...out.packages[0]!, artifactType: "generation_plan" };
  assert.equal(ScenePackageSchema.safeParse(bad).success, false);
});

test("profil inconnu / variante", () => {
  const chain = makePromptChain();
  const out = finalizePromptPackages({
    ...chain,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "c" },
  });
  const bad = {
    ...out.packages[0]!,
    variants: [
      {
        ...out.packages[0]!.variants[0]!,
        capabilityProfile: "video.kling_magic" as "video.dialogue",
      },
    ],
  };
  assert.equal(ScenePackageSchema.safeParse(bad).success, false);
});

test("candidat strict — champs interdits", () => {
  assert.equal(
    PromptAnalysisCandidateSchema.safeParse({
      notes: "ok",
      provider: "x",
    }).success,
    false,
  );
});

test("serialization JSON", () => {
  const chain = makePromptChain();
  const out = finalizePromptPackages({
    ...chain,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "c" },
  });
  const again = JSON.parse(JSON.stringify(out));
  assert.equal(again.packages.length, out.packages.length);
  assert.equal(ScenePackageSchema.safeParse(again.packages[0]).success, true);
});
