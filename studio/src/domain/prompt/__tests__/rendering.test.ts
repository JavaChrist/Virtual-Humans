import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBlocksForScene } from "../builders";
import { profilesForProductionIntent } from "../capability-profiles";
import { PROMPT_RENDERER_VERSION } from "../scene-package";
import { renderAllVariants, renderPromptVariant } from "../rendering";
import { makePromptChain } from "./fixtures";

test("sortie déterministe et versionnée", () => {
  const chain = makePromptChain();
  const scene = chain.storyboard.scenes[0]!;
  const blocks = buildBlocksForScene({
    scene,
    brief: chain.brief,
    plan: chain.marketingPlan,
    script: chain.videoScript,
    visual: chain.visualDirection,
    storyboard: chain.storyboard,
  });
  const profiles = profilesForProductionIntent(scene.productionIntent);
  const a = renderAllVariants({
    sceneId: scene.id,
    language: "fr",
    profiles,
    blocks,
  });
  const b = renderAllVariants({
    sceneId: scene.id,
    language: "fr",
    profiles,
    blocks,
  });
  assert.deepEqual(a, b);
  assert.ok(a.every((v) => v.rendererVersion === PROMPT_RENDERER_VERSION));
});

test("dialogue verbatim dans le rendu", () => {
  const chain = makePromptChain();
  const scene = chain.storyboard.scenes.find((s) => s.spokenContent.kind === "dialogue")!;
  const blocks = buildBlocksForScene({
    scene,
    brief: chain.brief,
    plan: chain.marketingPlan,
    script: chain.videoScript,
    visual: chain.visualDirection,
    storyboard: chain.storyboard,
  });
  const variant = renderPromptVariant({
    sceneId: scene.id,
    profile: "video.dialogue",
    mediaType: "video",
    language: "fr",
    blocks,
  });
  assert.ok(scene.spokenContent.kind !== "none");
  assert.ok(variant.positive.includes(scene.spokenContent.sourceText));
  assert.ok(variant.includedBlocks.includes("dialogue"));
});

test("pas de chemins / URLs / secrets / providers", () => {
  const chain = makePromptChain();
  const scene = chain.storyboard.scenes[0]!;
  const blocks = buildBlocksForScene({
    scene,
    brief: chain.brief,
    plan: chain.marketingPlan,
    script: chain.videoScript,
    visual: chain.visualDirection,
    storyboard: chain.storyboard,
  });
  const variants = renderAllVariants({
    sceneId: scene.id,
    language: "fr",
    profiles: profilesForProductionIntent(scene.productionIntent),
    blocks,
  });
  const blob = JSON.stringify(variants);
  assert.equal(/https?:\/\//i.test(blob), false);
  assert.equal(/[\\/]Users[\\/]/i.test(blob), false);
  assert.equal(/\b(kling|veo|openai|fal\.ai)\b/i.test(blob), false);
  assert.equal(/sk-[a-zA-Z0-9]{10,}/.test(blob), false);
});

test("mapping productionIntent → profils", () => {
  assert.ok(profilesForProductionIntent("talking_head").some((p) => p.profile === "video.dialogue"));
  assert.ok(profilesForProductionIntent("carousel").some((p) => p.profile === "motion.carousel"));
  assert.ok(
    profilesForProductionIntent("voice_over_visual").some((p) => p.profile === "audio.voice"),
  );
  assert.ok(
    profilesForProductionIntent("image_to_video").some(
      (p) => p.profile === "video.image_to_video",
    ),
  );
});
