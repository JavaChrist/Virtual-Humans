import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateContinuityAgainstSegments,
  validateContinuityRules,
} from "../continuity";
import { normalizeArtCandidate } from "../normalization";
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
      appliesToSegmentIds: candidate.segments.map((s) => s.scriptSegmentId),
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
  const ids = ["seg-1", "seg-2"];
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

test("segment inconnu dans règle — fail-closed (pas de fuzzy)", () => {
  const { issues } = validateContinuityRules(
    [
      {
        id: "r1",
        scope: "palette",
        description: "Palette stable",
        appliesToSegmentIds: ["segment-1"],
        severity: "required",
      },
    ],
    ["seg-1", "seg-2"],
  );
  assert.ok(issues.some((i) => i.message.includes("inconnu")));
  assert.ok(issues.some((i) => i.message.includes("segment-1")));
});

test("IDs Script réels acceptés dans continuité", () => {
  const scriptIds = ["segment-1", "segment-2", "segment-3", "segment-4", "segment-5"];
  const { issues } = validateContinuityRules(
    [
      {
        id: "r1",
        scope: "location",
        description: "Lieu stable",
        appliesToSegmentIds: ["segment-1", "segment-3", "segment-5"],
        severity: "required",
      },
    ],
    scriptIds,
  );
  assert.equal(issues.length, 0);
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
      appliesToSegmentIds: candidate.segments.map((s) => s.scriptSegmentId),
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

test("normalize — id Art dérivé du scriptSegmentId (pas de fuzzy)", () => {
  const candidate = makeValidArtCandidate(["segment-1", "segment-2"]);
  candidate.segments[0]!.id = "vd-invented";
  candidate.segments[0]!.scriptSegmentId = "segment-1";
  candidate.continuityRules = [
    {
      id: "cr",
      scope: "palette",
      description: "Palette stable",
      appliesToSegmentIds: ["segment-1", "segment-2"],
      severity: "required",
    },
  ];
  const normalized = normalizeArtCandidate(candidate);
  assert.equal(normalized.segments[0]!.id, "segment-1");
  assert.equal(normalized.segments[0]!.scriptSegmentId, "segment-1");
  const { issues } = validateContinuityRules(
    normalized.continuityRules,
    ["segment-1", "segment-2"],
  );
  assert.equal(issues.length, 0);
});
