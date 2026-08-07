import assert from "node:assert/strict";
import { test } from "node:test";
import { CharacterNotFoundError } from "@/runtime/errors";
import { characterRegistry } from "@/runtime/character";
import {
  characterCapabilitiesIdentityFingerprint,
  resolveCharacterCapabilitiesForBrief,
  type CharacterPackageLookup,
} from "../resolve-character-capabilities";
import type { RuntimeCharacterCapabilitySource } from "../character-capabilities";
import { makeBrief } from "@/domain/marketing/__tests__/fixtures";
import type { VideoProjectBrief } from "@/domain/brief";

function briefWithCharacter(characterId?: string): VideoProjectBrief {
  return makeBrief(characterId ? { characterId } : {});
}

function fakeSource(
  characterId: string,
  overrides: Partial<RuntimeCharacterCapabilitySource> = {},
): RuntimeCharacterCapabilitySource {
  return {
    characterId,
    characterVersion: "1.0.0",
    outfits: [{ id: "LOOK_001", name: "Casual" }],
    expressions: [{ name: "Smile" }],
    poses: [{ name: "Standing" }],
    identityReferences: [{ name: "Portrait" }],
    voice: { present: true },
    ...overrides,
  };
}

function lookupFromMap(map: Record<string, RuntimeCharacterCapabilitySource>): CharacterPackageLookup {
  return {
    getCharacter(requestedId: string) {
      const key = requestedId.trim();
      // Mimic registry: accept folder name OR canonical id when registered under both.
      const hit =
        map[key] ??
        Object.values(map).find((p) => p.characterId === key);
      if (!hit) throw new CharacterNotFoundError(requestedId, Object.keys(map));
      return hit;
    },
  };
}

test("none — Brief sans characterId", () => {
  const r = resolveCharacterCapabilitiesForBrief(briefWithCharacter(), lookupFromMap({}));
  assert.equal(r.status, "none");
});

test("Tom versionné (dossier UI) → characterId canonique tom + snapshot", () => {
  const lookup = lookupFromMap({
    "Tom SDK v1.0.0": fakeSource("tom"),
    tom: fakeSource("tom"),
  });
  const r = resolveCharacterCapabilitiesForBrief(briefWithCharacter("Tom SDK v1.0.0"), lookup);
  assert.equal(r.status, "resolved");
  if (r.status !== "resolved") return;
  assert.equal(r.value.brief.characterId, "tom");
  assert.equal(r.value.snapshot.characterId, "tom");
  assert.equal(r.value.snapshot.snapshotVersion, "1.0.0");
  assert.ok(r.value.snapshot.availableOutfits.length >= 1);
  assert.ok(r.value.identityFingerprint.length === 32);
});

test("Mei versionnée (dossier UI) → characterId canonique mei", () => {
  const lookup = lookupFromMap({
    "Mei SDK v1.0.0": fakeSource("mei"),
  });
  const r = resolveCharacterCapabilitiesForBrief(briefWithCharacter("Mei SDK v1.0.0"), lookup);
  assert.equal(r.status, "resolved");
  if (r.status !== "resolved") return;
  assert.equal(r.value.brief.characterId, "mei");
  assert.equal(r.value.snapshot.characterId, "mei");
});

test("Character inconnu → fail-closed not_found (pas de fallback Tom/Mei)", () => {
  const lookup = lookupFromMap({
    "Tom SDK v1.0.0": fakeSource("tom"),
    "Mei SDK v1.0.0": fakeSource("mei"),
  });
  const r = resolveCharacterCapabilitiesForBrief(briefWithCharacter("does-not-exist"), lookup);
  assert.equal(r.status, "not_found");
  if (r.status !== "not_found") return;
  assert.equal(r.requestedId, "does-not-exist");
});

test("Character sans tenues → snapshot résolu mais outfits vides (readiness assets)", () => {
  const lookup = lookupFromMap({
    empty: fakeSource("empty", { outfits: [] }),
  });
  const r = resolveCharacterCapabilitiesForBrief(briefWithCharacter("empty"), lookup);
  assert.equal(r.status, "resolved");
  if (r.status !== "resolved") return;
  assert.equal(r.value.snapshot.availableOutfits.length, 0);
});

test("même Brief + même snapshot → même identityFingerprint", () => {
  const lookup = lookupFromMap({ tom: fakeSource("tom") });
  const a = resolveCharacterCapabilitiesForBrief(briefWithCharacter("tom"), lookup);
  const b = resolveCharacterCapabilitiesForBrief(briefWithCharacter("tom"), lookup);
  assert.equal(a.status, "resolved");
  assert.equal(b.status, "resolved");
  if (a.status !== "resolved" || b.status !== "resolved") return;
  assert.equal(a.value.identityFingerprint, b.value.identityFingerprint);
});

test("changement capabilities → fingerprint différent (idempotence Art)", () => {
  const r1 = resolveCharacterCapabilitiesForBrief(
    briefWithCharacter("tom"),
    lookupFromMap({ tom: fakeSource("tom") }),
  );
  const r2 = resolveCharacterCapabilitiesForBrief(
    briefWithCharacter("tom"),
    lookupFromMap({
      tom: fakeSource("tom", {
        outfits: [
          { id: "LOOK_001", name: "Casual" },
          { id: "LOOK_002", name: "Formal" },
        ],
      }),
    }),
  );
  assert.equal(r1.status, "resolved");
  assert.equal(r2.status, "resolved");
  if (r1.status !== "resolved" || r2.status !== "resolved") return;
  assert.notEqual(r1.value.identityFingerprint, r2.value.identityFingerprint);
  assert.notEqual(
    characterCapabilitiesIdentityFingerprint(r1.value.snapshot),
    characterCapabilitiesIdentityFingerprint(r2.value.snapshot),
  );
});

test("intégration registry disque — Tom SDK v1.0.0 et Mei SDK v1.0.0", () => {
  const tom = resolveCharacterCapabilitiesForBrief(
    briefWithCharacter("Tom SDK v1.0.0"),
    characterRegistry,
  );
  assert.equal(tom.status, "resolved");
  if (tom.status === "resolved") {
    assert.equal(tom.value.snapshot.characterId, "tom");
    assert.ok(tom.value.snapshot.availableOutfits.length > 0);
  }

  const mei = resolveCharacterCapabilitiesForBrief(
    briefWithCharacter("Mei SDK v1.0.0"),
    characterRegistry,
  );
  assert.equal(mei.status, "resolved");
  if (mei.status === "resolved") {
    assert.equal(mei.value.snapshot.characterId, "mei");
    assert.ok(mei.value.snapshot.availableOutfits.length > 0);
  }

  const unknown = resolveCharacterCapabilitiesForBrief(
    briefWithCharacter("Unknown SDK v9.9.9"),
    characterRegistry,
  );
  assert.equal(unknown.status, "not_found");
});

test("aucune donnée hardcodée Tom-only — lookup générique par requestedId", () => {
  const lookup = lookupFromMap({
    "Custom Human SDK v2.0.0": fakeSource("custom-human", { characterVersion: "2.0.0" }),
  });
  const r = resolveCharacterCapabilitiesForBrief(
    briefWithCharacter("Custom Human SDK v2.0.0"),
    lookup,
  );
  assert.equal(r.status, "resolved");
  if (r.status !== "resolved") return;
  assert.equal(r.value.snapshot.characterId, "custom-human");
  assert.equal(r.value.snapshot.snapshotVersion, "2.0.0");
});
