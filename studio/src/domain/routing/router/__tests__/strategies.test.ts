import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertStrategyLibraryValid,
  getStrategy,
  listStrategies,
  strategiesForIntent,
} from "../strategy-library";

test("chaque stratégie valide — aucune fuite provider", () => {
  assert.doesNotThrow(() => assertStrategyLibraryValid());
  for (const s of listStrategies()) {
    assert.ok(s.steps.length >= 1);
    assert.ok(s.version);
    const blob = JSON.stringify(s).toLowerCase();
    assert.equal(/\b(openai|kling|veo|fal\.ai|elevenlabs)\b/.test(blob), false);
  }
});

test("productionIntent compatible / incompatible", () => {
  assert.ok(strategiesForIntent("talking_head").some((s) => s.id === "talking_head"));
  assert.ok(strategiesForIntent("carousel").every((s) => s.id === "carousel"));
  assert.equal(strategiesForIntent("text_motion").length, 0);
});

test("dépendances et profils", () => {
  const th = getStrategy("talking_head");
  const lipsync = th.steps.find((s) => s.action === "lipsync")!;
  assert.deepEqual(lipsync.dependsOnOrders, [2, 3]);
  for (const p of th.requiredProfiles) {
    assert.ok(th.steps.some((s) => s.capabilityProfile === p));
  }
});
