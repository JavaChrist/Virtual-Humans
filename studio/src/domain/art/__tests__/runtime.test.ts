import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCharacterCapabilitiesSnapshot } from "@/application/runtime/character-capabilities";
import { CharacterCapabilitiesSnapshotSchema } from "../schemas";
import { validateRuntimeAssets } from "../validation";
import { makeArtChain, makeGenericSnapshot, makeValidArtCandidate } from "./fixtures";

test("snapshot valide et sérialisable", () => {
  const snap = buildCharacterCapabilitiesSnapshot({
    characterId: "char-alpha",
    characterVersion: "2.1.0",
    outfits: [
      { id: "o1", name: "Look A", style: ["casual"], locations: ["city"] },
      { id: "o1", name: "Look A dup", style: ["casual"] },
    ],
    expressions: [{ name: "Smile" }, { name: "Smile" }],
    poses: [{ name: "Standing" }],
    identityReferences: [{ name: "Face Front" }],
    voice: { present: true },
  });
  assert.equal(CharacterCapabilitiesSnapshotSchema.safeParse(snap).success, true);
  assert.equal(snap.availableOutfits.length, 1);
  assert.equal(snap.availableExpressions.length, 1);
  assert.equal(snap.supportsVoiceReference, true);
  assert.ok(!JSON.stringify(snap).includes("relPath"));
  assert.ok(!JSON.stringify(snap).includes("lookPath"));
});

test("déduplication des assets", () => {
  const snap = buildCharacterCapabilitiesSnapshot({
    characterId: "char-beta",
    outfits: [
      { id: "dup", name: "One" },
      { id: "dup", name: "Two" },
    ],
    expressions: [],
    poses: [],
    identityReferences: [],
    voice: { present: false },
  });
  assert.equal(snap.availableOutfits.length, 1);
  assert.equal(snap.availableOutfits[0]!.label, "One");
});

test("asset demandé disponible", () => {
  const chain = makeArtChain({ withCharacter: true });
  const snap = makeGenericSnapshot();
  const candidate = makeValidArtCandidate(
    chain.videoScript.segments.map((s) => s.id),
    { withCharacter: true },
  );
  const { issues, missing } = validateRuntimeAssets(
    candidate.segments,
    chain.brief,
    snap,
  );
  assert.equal(issues.filter((i) => i.code === "asset_unavailable").length, 0);
  assert.equal(missing.filter((m) => m.required).length, 0);
});

test("asset absent → missing", () => {
  const chain = makeArtChain({ withCharacter: true });
  const snap = makeGenericSnapshot();
  const candidate = makeValidArtCandidate(
    chain.videoScript.segments.map((s) => s.id),
    { withCharacter: true },
  );
  candidate.segments[0]!.character!.outfitId = "outfit-does-not-exist";
  const { missing, issues } = validateRuntimeAssets(
    candidate.segments,
    chain.brief,
    snap,
  );
  assert.ok(missing.some((m) => m.code === "asset_unavailable"));
  assert.ok(issues.some((i) => i.code === "asset_unavailable"));
});

test("personnage requis sans snapshot", () => {
  const chain = makeArtChain({ withCharacter: true });
  const candidate = makeValidArtCandidate(
    chain.videoScript.segments.map((s) => s.id),
    { withCharacter: true },
  );
  const { missing } = validateRuntimeAssets(candidate.segments, chain.brief, undefined);
  assert.ok(missing.some((m) => m.code === "character_snapshot_missing"));
});

test("aucun personnage → CharacterDirection absente ok", () => {
  const chain = makeArtChain({ withCharacter: false });
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  const { issues, missing } = validateRuntimeAssets(
    candidate.segments,
    chain.brief,
    undefined,
  );
  assert.equal(missing.length, 0);
  assert.equal(issues.length, 0);
  assert.ok(candidate.segments.every((s) => !s.character));
});

test("aucune dépendance à Tom/Mei", () => {
  const src = JSON.stringify(
    buildCharacterCapabilitiesSnapshot({
      characterId: "char-gamma-99",
      outfits: [{ id: "o-x", name: "X" }],
      expressions: [{ name: "calm" }],
      poses: [{ name: "sit" }],
      identityReferences: [],
      voice: { present: false },
    }),
  );
  assert.equal(/tom|mei/i.test(src), false);
});

test("absence de chemins et URLs sensibles", () => {
  const snap = makeGenericSnapshot({
    availableOutfits: [
      {
        id: "o1",
        label: "Clean",
        tags: ["ok"],
      },
    ],
  });
  const blob = JSON.stringify(snap);
  assert.equal(/https?:\/\//i.test(blob), false);
  assert.equal(/[\\/]Users[\\/]/i.test(blob), false);
  assert.equal(/signed/i.test(blob), false);
});
