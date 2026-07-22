import assert from "node:assert/strict";
import { test } from "node:test";
import { CharacterRegistry } from "../registry";
import { CharacterNotFoundError } from "../../errors";

/**
 * Integration test against the real Mei SDK data on disk.
 * Run from the studio/ directory so REPO_ROOT resolves to the repo root.
 */

const registry = new CharacterRegistry();
// Resolve Mei by explicit directory name so these assertions stay deterministic
// even while a temporary duplicate (Tom, still declaring characterId "mei")
// exists on disk before it is personalised.
const MEI_DIR = "Mei SDK v1.0.0";

test("lists at least the Mei character", () => {
  const summaries = registry.listSummaries();
  assert.ok(summaries.length >= 1);
  const mei = summaries.find((s) => s.displayName.toLowerCase().includes("mei"));
  assert.ok(mei, "Mei summary should be present");
});

test("resolves Mei by explicit directory name and slug", () => {
  const byDir = registry.getCharacter(MEI_DIR);
  const bySlug = registry.getCharacter("mei-sdk-v1-0-0");
  assert.equal(byDir.directoryName, MEI_DIR);
  assert.equal(bySlug.directoryName, MEI_DIR);
});

test("distinguishes canonical characterId from business characterCode", () => {
  const pkg = registry.getCharacter(MEI_DIR);
  assert.equal(pkg.characterId, "mei", "canonical technical id");
  assert.equal(pkg.characterCode, "MEI-001", "business code");
  const mismatch = pkg.dataQuality.find((i) => i.code === "CHARACTER_ID_MISMATCH");
  assert.equal(
    mismatch,
    undefined,
    "id vs code difference must not be reported as a contradiction"
  );
});

test("loads the full Mei package (VH-001 acceptance)", () => {
  const pkg = registry.getCharacter(MEI_DIR);
  assert.equal(pkg.identity.present, true);
  assert.ok(pkg.identity.name);
  assert.ok(pkg.personality.coreTraits.length > 0, "personality core traits parsed");
  assert.ok(pkg.personality.primaryTraits.length > 0, "primary traits parsed");
  assert.ok(pkg.personality.prohibitedTraits.length > 0, "prohibited traits parsed");
  assert.ok(pkg.outfits.length > 0, "outfits loaded");
  assert.ok(pkg.identityReferences.length > 0, "identity references loaded");
  assert.equal(pkg.memories.length, 11, "eleven memory documents enumerated");
  assert.equal(pkg.capabilities.present, true, "capabilities document present");
  assert.equal(pkg.limitations.present, true, "limitations document present");
  assert.ok(pkg.sdkVersion, "sdk version resolved");
});

test("throws CharacterNotFoundError for unknown ids", () => {
  assert.throws(() => registry.getCharacter("does-not-exist"), CharacterNotFoundError);
});

test("keeps Mei as the active character (never a duplicate)", () => {
  const active = registry.getActiveCharacter();
  assert.equal(active.directoryName, MEI_DIR);
  assert.equal(active.characterId, "mei");
});

test("caches packages and clears the cache", () => {
  const a = registry.getCharacter(MEI_DIR);
  const b = registry.getCharacter(MEI_DIR);
  assert.equal(a, b, "same cached instance");
  registry.clearCache();
  const c = registry.getCharacter(MEI_DIR);
  assert.notEqual(a, c, "new instance after cache clear");
});
