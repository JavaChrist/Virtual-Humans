import assert from "node:assert/strict";
import { after, test } from "node:test";
import { makeFixtureRegistry } from "./fixtures";
import { characterDetailResponse } from "../http";
import { DuplicateCharacterCodeError, DuplicateCharacterIdError } from "../../errors";

test("two packages with the same characterId raise a collision", () => {
  const { registry, cleanup } = makeFixtureRegistry([
    { dir: "Alpha SDK v1.0.0", characterId: "dup", characterCode: "ALPHA-001" },
    { dir: "Beta SDK v1.0.0", characterId: "dup", characterCode: "BETA-001" },
  ]);
  after(cleanup);

  const conflicts = registry.getConflicts();
  const idConflict = conflicts.find((c) => c.code === "DUPLICATE_CHARACTER_ID");
  assert.ok(idConflict, "an id collision must be reported");
  assert.equal(idConflict!.value, "dup");
  assert.equal(idConflict!.packages.length, 2);
  const dirs = idConflict!.packages.map((p) => p.directoryName).sort();
  assert.deepEqual(dirs, ["Alpha SDK v1.0.0", "Beta SDK v1.0.0"]);
  const codes = idConflict!.packages.map((p) => p.characterCode).sort();
  assert.deepEqual(codes, ["ALPHA-001", "BETA-001"]);
});

test("getCharacter does not arbitrarily pick a package on id collision", () => {
  const { registry, cleanup } = makeFixtureRegistry([
    { dir: "Alpha SDK v1.0.0", characterId: "dup", characterCode: "ALPHA-001" },
    { dir: "Beta SDK v1.0.0", characterId: "dup", characterCode: "BETA-001" },
  ]);
  after(cleanup);

  assert.throws(() => registry.getCharacter("dup"), DuplicateCharacterIdError);
  // Explicit, unambiguous directory requests still resolve.
  assert.equal(registry.getCharacter("Alpha SDK v1.0.0").characterCode, "ALPHA-001");
  assert.equal(registry.getCharacter("Beta SDK v1.0.0").characterCode, "BETA-001");
});

test("detail API returns 409 on an ambiguous characterId", () => {
  const { registry, cleanup } = makeFixtureRegistry([
    { dir: "Alpha SDK v1.0.0", characterId: "dup", characterCode: "ALPHA-001" },
    { dir: "Beta SDK v1.0.0", characterId: "dup", characterCode: "BETA-001" },
  ]);
  after(cleanup);

  const res = characterDetailResponse(registry, "dup");
  assert.equal(res.status, 409);
  const body = res.body as { error: { code: string; details: { packages: unknown[] } } };
  assert.equal(body.error.code, "DUPLICATE_CHARACTER_ID");
  assert.equal(body.error.details.packages.length, 2);
});

test("character list exposes both directories with their conflict", () => {
  const { registry, cleanup } = makeFixtureRegistry([
    { dir: "Alpha SDK v1.0.0", characterId: "dup", characterCode: "ALPHA-001" },
    { dir: "Beta SDK v1.0.0", characterId: "dup", characterCode: "BETA-001" },
  ]);
  after(cleanup);

  const summaries = registry.listSummaries();
  assert.equal(summaries.length, 2);
  for (const s of summaries) {
    assert.ok(s.conflicts.length >= 1, `${s.directoryName} should report a conflict`);
    assert.ok(s.health.errors >= 1, `${s.directoryName} should count an error`);
  }
});

test("distinct characterIds stay valid", () => {
  const { registry, cleanup } = makeFixtureRegistry([
    { dir: "Alpha SDK v1.0.0", characterId: "alpha", characterCode: "ALPHA-001" },
    { dir: "Gamma SDK v1.0.0", characterId: "gamma", characterCode: "GAMMA-001" },
  ]);
  after(cleanup);

  assert.equal(registry.getConflicts().length, 0);
  assert.equal(registry.getCharacter("alpha").directoryName, "Alpha SDK v1.0.0");
  assert.equal(registry.getCharacter("gamma").directoryName, "Gamma SDK v1.0.0");
  assert.equal(characterDetailResponse(registry, "alpha").status, 200);
});

test("shared characterCode across distinct ids raises a dedicated error", () => {
  const { registry, cleanup } = makeFixtureRegistry([
    { dir: "Alpha SDK v1.0.0", characterId: "alpha", characterCode: "SHARED-001" },
    { dir: "Gamma SDK v1.0.0", characterId: "gamma", characterCode: "SHARED-001" },
  ]);
  after(cleanup);

  const codeConflict = registry.getConflicts().find((c) => c.code === "DUPLICATE_CHARACTER_CODE");
  assert.ok(codeConflict, "a characterCode collision must be reported");
  assert.equal(codeConflict!.value, "SHARED-001");

  // Ids remain individually resolvable...
  assert.equal(registry.getCharacter("alpha").characterCode, "SHARED-001");
  // ...but resolving by the shared code is ambiguous.
  assert.throws(() => registry.getCharacter("SHARED-001"), DuplicateCharacterCodeError);
  assert.equal(characterDetailResponse(registry, "SHARED-001").status, 409);
});
