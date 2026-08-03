import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateContinuityAgainstSegments,
  validateContinuityRules,
} from "../continuity";
import { makeArtChain, makeValidArtCandidate } from "./fixtures";

test("tenue stable respectée", () => {
  const chain = makeArtChain({ withCharacter: true });
  const candidate = makeValidArtCandidate(
    chain.videoScript.segments.map((s) => s.id),
    { withCharacter: true },
  );
  const { issues } = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  assert.equal(issues.length, 0);
});

test("lieu stable respecté", () => {
  const chain = makeArtChain();
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  const { issues } = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  assert.equal(
    issues.filter((i) => i.message.includes("lieu")).length,
    0,
  );
});

test("rupture intentionnelle documentée", () => {
  const chain = makeArtChain();
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  candidate.segments[2]!.location.continuityKey = "studio-set";
  candidate.continuityRules = [
    {
      id: "cr-break",
      scope: "location",
      description: "Rupture intentionnelle vers studio pour le proof.",
      appliesToSegmentIds: candidate.segments.map((s) => s.id),
      severity: "preferred",
    },
  ];
  const { issues } = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  assert.equal(issues.length, 0);
});

test("règles required contradictoires", () => {
  const ids = ["vd-1", "vd-2"];
  const { issues } = validateContinuityRules(
    [
      {
        id: "a",
        scope: "outfit",
        description: "Tenue stable sur toute la vidéo.",
        appliesToSegmentIds: ids,
        severity: "required",
      },
      {
        id: "b",
        scope: "outfit",
        description: "Rupture de tenue au milieu.",
        appliesToSegmentIds: ids,
        severity: "required",
      },
    ],
    ids,
  );
  assert.ok(issues.some((i) => i.code === "continuity_violation"));
});

test("segment inconnu dans règle", () => {
  const { issues } = validateContinuityRules(
    [
      {
        id: "r1",
        scope: "palette",
        description: "Palette stable",
        appliesToSegmentIds: ["missing"],
        severity: "required",
      },
    ],
    ["vd-1"],
  );
  assert.ok(issues.some((i) => i.message.includes("inconnu")));
});

test("continuité obligatoire non respectée", () => {
  const chain = makeArtChain({ withCharacter: true });
  const candidate = makeValidArtCandidate(
    chain.videoScript.segments.map((s) => s.id),
    { withCharacter: true },
  );
  candidate.segments[1]!.character!.outfitId = "outfit-smart";
  const { issues } = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  assert.ok(issues.some((i) => i.code === "continuity_violation"));
});

test("changement préféré → warning seulement", () => {
  const chain = makeArtChain();
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  candidate.continuityRules = [
    {
      id: "cr-pref",
      scope: "location",
      description: "Lieu stable préféré.",
      appliesToSegmentIds: candidate.segments.map((s) => s.id),
      severity: "preferred",
    },
  ];
  candidate.segments[1]!.location.continuityKey = "other-place";
  const { issues, warnings } = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  assert.equal(issues.length, 0);
  assert.ok(warnings.some((w) => w.code === "continuity_preferred"));
});
