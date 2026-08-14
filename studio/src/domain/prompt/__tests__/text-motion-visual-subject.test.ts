import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBlocksForScene, buildSubject } from "../builders";
import { makePromptChain } from "./fixtures";

const TITLE = "De l\u2019idée à la structure";
const CTA = "Découvrir Virtual Humans Studio";

test("text_motion n'utilise jamais screenText comme sujet", () => {
  const chain = makePromptChain();
  const base = chain.storyboard.scenes[0]!;
  const scene = {
    ...base,
    productionIntent: "text_motion" as const,
    screenText: TITLE,
    spokenContent: { kind: "none" as const },
  };
  const subject = buildSubject(scene, chain.visualDirection, chain.brief, chain.creativeConcept, [
    TITLE,
    CTA,
  ]);
  assert.notEqual(subject.description, TITLE);
  assert.equal(subject.description.includes(TITLE), false);
  assert.equal(subject.kind, "environment");

  const blocks = buildBlocksForScene({
    scene,
    brief: chain.brief,
    plan: chain.marketingPlan,
    script: { ...chain.videoScript, callToAction: { ...chain.videoScript.callToAction, text: CTA } },
    visual: chain.visualDirection,
    storyboard: chain.storyboard,
    concept: chain.creativeConcept,
  });
  assert.equal(blocks.screenText?.text, TITLE);
  assert.equal(blocks.screenText?.renderMode, "post_production");
  assert.equal(blocks.subject.description.includes(TITLE), false);
  assert.equal(blocks.constraints.required.some((c) => c.description.includes(CTA)), false);
});
