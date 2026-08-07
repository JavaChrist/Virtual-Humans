/**
 * Porte 8R — Script segment references in Art candidate (local, no provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeVisualDirection } from "../finalize";
import { normalizeArtCandidate } from "../normalization";
import { validateCandidateAgainstSources } from "../validation";
import { makeArtChain, makeValidArtCandidate } from "./fixtures";

test("IDs Script réels acceptés de bout en bout", () => {
  const chain = makeArtChain();
  // Preserve fixture segment count; rename IDs to Production-like segment-N.
  const scriptIds = chain.videoScript.segments.map((_, i) => `segment-${i + 1}`);
  chain.videoScript = {
    ...chain.videoScript,
    segments: chain.videoScript.segments.map((s, i) => ({
      ...s,
      id: scriptIds[i]!,
      order: i + 1,
    })),
  };
  const candidate = makeValidArtCandidate(scriptIds);
  const { issues } = validateCandidateAgainstSources(
    normalizeArtCandidate(candidate),
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.equal(
    issues.filter((i) =>
      i.code === "continuity_violation" || i.code === "invariant_violation",
    ).length,
    0,
    issues.map((i) => i.message).join(" | "),
  );
});

test("segment-1 inconnu refusé sans fuzzy mapping", () => {
  const chain = makeArtChain();
  const scriptIds = chain.videoScript.segments.map((s) => s.id); // seg-1..
  const candidate = makeValidArtCandidate(scriptIds);
  candidate.continuityRules = [
    {
      id: "bad",
      scope: "location",
      description: "Lieu stable",
      appliesToSegmentIds: ["segment-1"],
      severity: "required",
    },
  ];
  const { issues } = validateCandidateAgainstSources(
    normalizeArtCandidate(candidate),
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.ok(issues.some((i) => i.code === "continuity_violation"));
  assert.ok(issues.some((i) => i.message.includes("segment-1")));
  assert.throws(
    () =>
      finalizeVisualDirection({
        brief: chain.brief,
        marketingPlan: chain.marketingPlan,
        creativeConcept: chain.creativeConcept,
        videoScript: chain.videoScript,
        candidate,
        metadata: {
          id: "vd-test",
          createdBy: "tester",
          correlationId: "corr-8r",
        },
      }),
    (e: unknown) =>
      e instanceof Error && /segment-1|invalide/i.test(e.message),
  );
});

test("chaque continuityRule ne référence que des segments existants", () => {
  const chain = makeArtChain();
  const scriptIds = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(scriptIds);
  candidate.continuityRules.push({
    id: "extra",
    scope: "lighting",
    description: "Lumière stable",
    appliesToSegmentIds: [scriptIds[0]!, "invented-seg"],
    severity: "required",
  });
  const { issues } = validateCandidateAgainstSources(
    normalizeArtCandidate(candidate),
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.ok(issues.some((i) => i.message.includes("invented-seg")));
});

test("IDs multiples valides dans une règle", () => {
  const chain = makeArtChain();
  const scriptIds = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(scriptIds);
  candidate.continuityRules = [
    {
      id: "multi",
      scope: "palette",
      description: "Palette stable",
      appliesToSegmentIds: [...scriptIds],
      severity: "required",
    },
  ];
  const { issues } = validateCandidateAgainstSources(
    normalizeArtCandidate(candidate),
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.equal(
    issues.filter((i) => i.code === "continuity_violation").length,
    0,
  );
});

test("changement de Script rev → nouveau set d'IDs (ancien ID rejeté)", () => {
  const chain = makeArtChain();
  const oldIds = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(oldIds);
  // New script revision with different IDs
  const newIds = oldIds.map((id) => `${id}-rev2`);
  chain.videoScript = {
    ...chain.videoScript,
    segments: chain.videoScript.segments.map((s, i) => ({
      ...s,
      id: newIds[i]!,
    })),
  };
  const { issues } = validateCandidateAgainstSources(
    normalizeArtCandidate(candidate),
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.ok(
    issues.some(
      (i) =>
        i.code === "continuity_violation" ||
        i.code === "invariant_violation",
    ),
  );
});

test("aucun fuzzy — vd-1 n'est pas réécrit vers seg-1 dans appliesToSegmentIds", () => {
  const chain = makeArtChain();
  const scriptIds = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(scriptIds);
  candidate.continuityRules = [
    {
      id: "fuzzy",
      scope: "location",
      description: "Lieu stable",
      appliesToSegmentIds: ["vd-1"],
      severity: "required",
    },
  ];
  const normalized = normalizeArtCandidate(candidate);
  assert.deepEqual(normalized.continuityRules[0]!.appliesToSegmentIds, ["vd-1"]);
  const { issues } = validateCandidateAgainstSources(
    normalized,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.ok(issues.some((i) => i.message.includes("vd-1")));
});
