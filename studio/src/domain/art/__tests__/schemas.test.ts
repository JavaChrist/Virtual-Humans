import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeVisualDirection } from "../finalize";
import { ArtAnalysisCandidateSchema, VisualDirectionSchema } from "../schemas";
import type { ArtAnalysisCandidate } from "../visual-direction";
import { makeArtChain, makeGenericSnapshot, makeValidArtCandidate } from "./fixtures";

test("direction minimale valide", () => {
  const chain = makeArtChain();
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  const dir = finalizeVisualDirection({
    ...chain,
    candidate,
    metadata: { id: "art-1", createdBy: "tester", correlationId: "corr-art-1" },
  });
  assert.equal(VisualDirectionSchema.safeParse(dir).success, true);
  assert.equal(dir.segments.length, chain.videoScript.segments.length);
});

test("segment manquant refusé", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids);
  candidate.segments = candidate.segments.slice(0, -1);
  assert.throws(() =>
    finalizeVisualDirection({
      ...chain,
      candidate,
      metadata: { id: "art-1", createdBy: "tester", correlationId: "corr-art-1" },
    }),
  );
});

test("segment supplémentaire refusé", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids);
  candidate.segments.push({
    ...candidate.segments[0]!,
    id: "vd-extra",
    scriptSegmentId: "seg-unknown",
  });
  assert.throws(() =>
    finalizeVisualDirection({
      ...chain,
      candidate,
      metadata: { id: "art-1", createdBy: "tester", correlationId: "corr-art-1" },
    }),
  );
});

test("IDs dupliqués refusés", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids);
  // Porte 8R — Art id is derived from scriptSegmentId; duplicate script refs fail.
  candidate.segments[1]!.scriptSegmentId = candidate.segments[0]!.scriptSegmentId;
  assert.equal(ArtAnalysisCandidateSchema.safeParse(candidate).success, true);
  assert.throws(() =>
    finalizeVisualDirection({
      ...chain,
      candidate,
      metadata: { id: "art-1", createdBy: "tester", correlationId: "corr-art-1" },
    }),
  );
});

test("scriptSegmentId inconnu refusé", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids);
  candidate.segments[0]!.scriptSegmentId = "does-not-exist";
  assert.throws(() =>
    finalizeVisualDirection({
      ...chain,
      candidate,
      metadata: { id: "art-1", createdBy: "tester", correlationId: "corr-art-1" },
    }),
  );
});

test("caméra / lumière invalides refusées", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids);
  const bad = {
    ...candidate,
    segments: candidate.segments.map((s, i) =>
      i === 0
        ? {
            ...s,
            camera: { ...s.camera, shotSize: "ultra_wide" as "wide" },
          }
        : s,
    ),
  };
  assert.equal(ArtAnalysisCandidateSchema.safeParse(bad).success, false);
});

test("couleur invalide refusée", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids, {
    overrides: {
      palette: [{ name: "bad", hex: "blue", role: "primary" }],
    },
  });
  assert.equal(ArtAnalysisCandidateSchema.safeParse(candidate).success, false);
});

test("références non sérialisables refusées", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids) as ArtAnalysisCandidate & {
    circular?: unknown;
  };
  const a: { self?: unknown } = {};
  a.self = a;
  candidate.circular = a;
  // strict schema drops unknown via parse failure when passed raw
  const raw = { ...makeValidArtCandidate(ids), fn: () => 1 };
  assert.equal(ArtAnalysisCandidateSchema.safeParse(raw).success, false);
  void chain;
});

test("longueurs maximales", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids, {
    overrides: {
      globalStyle: {
        style: "commercial",
        mood: "x".repeat(500),
        realism: "photorealistic",
        colorIntent: "ok",
        brandAlignment: "ok",
      },
    },
  });
  assert.equal(ArtAnalysisCandidateSchema.safeParse(candidate).success, false);
});

test("round-trip JSON", () => {
  const chain = makeArtChain();
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  const dir = finalizeVisualDirection({
    ...chain,
    candidate,
    metadata: { id: "art-1", createdBy: "tester", correlationId: "corr-art-1" },
  });
  const again = VisualDirectionSchema.safeParse(JSON.parse(JSON.stringify(dir)));
  assert.equal(again.success, true);
});

test("snapshot avec personnage générique", () => {
  const chain = makeArtChain({ withCharacter: true });
  const snap = makeGenericSnapshot();
  const candidate = makeValidArtCandidate(
    chain.videoScript.segments.map((s) => s.id),
    { withCharacter: true },
  );
  const dir = finalizeVisualDirection({
    ...chain,
    candidate,
    characterCapabilities: snap,
    metadata: { id: "art-1", createdBy: "tester", correlationId: "corr-art-1" },
  });
  assert.equal(dir.segments.every((s) => s.character?.outfitId === "outfit-casual"), true);
});
