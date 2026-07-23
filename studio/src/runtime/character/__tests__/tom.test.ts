import assert from "node:assert/strict";
import { test } from "node:test";
import { CharacterRegistry } from "../registry";
import { characterDetailResponse } from "../http";

/**
 * Integration test against the real Tom SDK package on disk, after
 * personalisation. Run from the studio/ directory so REPO_ROOT resolves to the
 * repo root.
 */

const registry = new CharacterRegistry();
const TOM_DIR = "Tom SDK v1.0.0";

test("Mei and Tom no longer collide", () => {
  assert.equal(registry.getConflicts().length, 0, "no id/code collisions after personalisation");
});

test("resolves Tom by canonical characterId and directory", () => {
  const byId = registry.getCharacter("tom");
  const byDir = registry.getCharacter(TOM_DIR);
  assert.equal(byId.directoryName, TOM_DIR);
  assert.equal(byDir.directoryName, TOM_DIR);
  assert.equal(byId.characterId, "tom");
  assert.equal(byId.characterCode, "TOM-001");
});

test("Mei and Tom resolve to distinct packages", () => {
  const mei = registry.getCharacter("mei");
  const tom = registry.getCharacter("tom");
  assert.notEqual(mei.directoryName, tom.directoryName);
  assert.equal(mei.characterId, "mei");
  assert.equal(tom.characterId, "tom");
});

test("detail API returns 200 for both mei and tom", () => {
  assert.equal(characterDetailResponse(registry, "mei").status, 200);
  assert.equal(characterDetailResponse(registry, "tom").status, 200);
});

test("Tom exposes its own assets (Mei placeholders replaced)", () => {
  const tom = registry.getCharacter("tom");
  assert.ok(tom.identityReferences.length > 0, "identity refs present");
  assert.ok(tom.outfits.length > 0, "outfits present");
  assert.ok(tom.poses.length > 0, "poses present");
  assert.ok(tom.expressions.length > 0, "expressions present");
  const pending = tom.dataQuality.filter((i) => i.code === "ASSET_PENDING_REPLACEMENT");
  assert.equal(pending.length, 0, "no pending/copied-asset warnings remain");
});

test("Tom personality is a parsed provisional base with its own candidate phrases", () => {
  const tom = registry.getCharacter("tom");
  assert.ok(tom.personality.coreTraits.length > 0, "provisional core traits parsed");
  assert.ok(tom.personality.primaryTraits.length > 0, "provisional primary traits parsed");
  // Tom now has candidate opening/closing phrases (provided by Christian) —
  // extracted as candidates, never invented, and never Mei's phrases.
  assert.ok(tom.personality.greetings.length > 0, "greeting candidate parsed");
  assert.ok(tom.personality.conclusions.length > 0, "conclusion candidate parsed");
  // Since candidates now exist, the "missing phrases" warning must be gone.
  const phrasesMissing = tom.dataQuality.find((i) => i.code === "PHRASES_MISSING");
  assert.equal(phrasesMissing, undefined, "phrases are now present");
  // The id/code distinction must not be reported as a contradiction.
  const mismatch = tom.dataQuality.find((i) => i.code === "CHARACTER_ID_MISMATCH");
  assert.equal(mismatch, undefined);
});

test("Tom enumerates its memory documents", () => {
  const tom = registry.getCharacter("tom");
  assert.equal(tom.memories.length, 11, "eleven memory documents enumerated");
  assert.match(tom.displayName, /Tom/);
});
