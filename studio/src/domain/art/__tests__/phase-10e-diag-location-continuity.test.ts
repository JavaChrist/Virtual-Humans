/**
 * Phase 10E-DIAG — isolate Zod structural vs business location continuity.
 * Synthetic fixture reproducing « Continuité lieu required non respectée. »
 * No provider. No Production writes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ArtAnalysisCandidateSchema } from "../schemas";
import {
  validateContinuityAgainstSegments,
  validateContinuityRules,
} from "../continuity";
import { validateCandidateAgainstSources } from "../validation";
import { makeArtChain, makeValidArtCandidate } from "./fixtures";
import { ART_ANALYZER_PROMPT_VERSION, ART_ANALYZER_SYSTEM_PROMPT } from "@/infrastructure/ai/openai/art";

test("10E-DIAG — Zod OK + métier FAIL sur lieu required stable divergent", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids);
  // Exact failure shape inferred from Production message + continuity.ts
  candidate.continuityRules = [
    {
      id: "cr-loc-required",
      scope: "location",
      description: "Lieu stable sur tous les segments.",
      appliesToSegmentIds: ids,
      severity: "required",
    },
  ];
  candidate.segments[2]!.location.continuityKey = "other-place";
  candidate.segments[4]!.location.continuityKey = "cta-place";

  const zod = ArtAnalysisCandidateSchema.safeParse(candidate);
  assert.equal(zod.success, true, "structural Zod must pass");

  const rulesOnly = validateContinuityRules(
    candidate.continuityRules,
    ids,
  );
  assert.equal(
    rulesOnly.issues.length,
    0,
    "rule graph alone must not reject divergent keys",
  );

  const againstSegs = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  assert.ok(
    againstSegs.issues.some(
      (i) =>
        i.code === "continuity_violation" &&
        i.message === "Continuité lieu required non respectée." &&
        i.field === "continuityRules.cr-loc-required",
    ),
  );

  const full = validateCandidateAgainstSources(
    candidate,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
  );
  assert.ok(
    full.issues.some((i) => i.message === "Continuité lieu required non respectée."),
  );
});

test("10E-DIAG — Zod OK + métier OK quand continuityKey identique", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids);
  candidate.continuityRules = [
    {
      id: "cr-loc-required",
      scope: "location",
      description: "Lieu stable sur tous les segments.",
      appliesToSegmentIds: ids,
      severity: "required",
    },
  ];
  for (const seg of candidate.segments) {
    seg.location.continuityKey = "primary-set";
  }
  assert.equal(ArtAnalysisCandidateSchema.safeParse(candidate).success, true);
  const { issues } = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  assert.equal(issues.length, 0);
});

test("10E-DIAG — rupture preferred → warning, pas invalid", () => {
  const chain = makeArtChain();
  const ids = chain.videoScript.segments.map((s) => s.id);
  const candidate = makeValidArtCandidate(ids);
  candidate.segments[3]!.location.continuityKey = "proof-set";
  candidate.continuityRules = [
    {
      id: "cr-loc-pref",
      scope: "location",
      description: "Lieu stable préféré.",
      appliesToSegmentIds: ids,
      severity: "preferred",
    },
  ];
  const { issues, warnings } = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  assert.equal(issues.length, 0);
  assert.ok(warnings.some((w) => w.code === "continuity_preferred"));
});

test("10E-DIAG — prompt v3 explicite continuityKey / required", () => {
  assert.equal(ART_ANALYZER_PROMPT_VERSION, "art-analyzer-v3");
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /continuityKey/);
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /required/);
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /stable|même|same|conserve/i);
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /rupture|change|break/i);
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /Visual variation of the same place/i);
});
