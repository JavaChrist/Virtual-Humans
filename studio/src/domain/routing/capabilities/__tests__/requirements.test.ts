import assert from "node:assert/strict";
import { test } from "node:test";
import { profilesForProductionIntent } from "@/domain/prompt";
import { deriveCapabilityRequirements, CapabilityDomainError } from "../index";
import { makeScenePackageChain } from "./fixtures";

test("dérivation pour chaque productionIntent + pas de mutation", () => {
  const chain = makeScenePackageChain({ withCharacter: true });
  const intents = new Set(chain.storyboard.scenes.map((s) => s.productionIntent));
  assert.ok(intents.size >= 1);

  for (const pkg of chain.packages) {
    const before = JSON.stringify(pkg);
    const req = deriveCapabilityRequirements(pkg, chain.storyboard);
    assert.equal(req.sceneId, pkg.sceneId);
    assert.deepEqual(
      req.requiredProfiles,
      profilesForProductionIntent(pkg.productionIntent).map((p) => p.profile),
    );
    assert.equal(req.aspectRatio, chain.storyboard.aspectRatio);
    assert.ok(req.durationSeconds > 0);
    assert.equal(JSON.stringify(pkg), before);
  }
});

test("dialogue / voix off / identité", () => {
  const chain = makeScenePackageChain({ withCharacter: true });
  const withDialogue = chain.packages.find((p) => p.dialogue?.kind === "dialogue");
  if (withDialogue) {
    const req = deriveCapabilityRequirements(withDialogue, chain.storyboard);
    assert.equal(req.needsDialogue, true);
    assert.equal(req.identityPriority, "high");
  }
  const vo = chain.packages.find((p) => p.dialogue?.kind === "voice_over");
  if (vo) {
    const req = deriveCapabilityRequirements(vo, chain.storyboard);
    assert.equal(req.needsDialogue, false);
  }
});

test("scène incomplète / projet différent échoue", () => {
  const chain = makeScenePackageChain();
  const pkg = chain.packages[0]!;
  assert.throws(
    () =>
      deriveCapabilityRequirements(
        { ...pkg, projectId: "other-project" },
        chain.storyboard,
      ),
    CapabilityDomainError,
  );
  assert.throws(
    () =>
      deriveCapabilityRequirements(
        { ...pkg, sceneId: "missing-scene" },
        chain.storyboard,
      ),
    CapabilityDomainError,
  );
});

test("carousel / image-to-video intents mappent expectedOutput", () => {
  const chain = makeScenePackageChain();
  for (const pkg of chain.packages) {
    const req = deriveCapabilityRequirements(pkg, chain.storyboard);
    if (pkg.productionIntent === "carousel") {
      assert.equal(req.expectedOutput, "carousel");
    } else if (pkg.productionIntent === "text_motion") {
      assert.equal(req.expectedOutput, "image");
    } else {
      assert.equal(req.expectedOutput, "video");
    }
  }
});
