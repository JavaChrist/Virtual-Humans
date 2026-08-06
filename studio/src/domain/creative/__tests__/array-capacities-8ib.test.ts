/**
 * 8I-B — dynamic Creative capacities without silent truncation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { MarketingAssumption, MarketingPlan } from "@/domain/marketing";
import {
  CREATIVE_FIELD_LIMITS,
  CREATIVE_SYSTEM_ASSUMPTION_IDS,
  CREATIVE_SYSTEM_CONSTRAINT_IDS,
  buildSystemCreativeAssumptions,
  candidateCapsFromRun,
  createCreativeAnalyzerCandidateSchema,
  dedupeByStableId,
  finalizeCreativeConcept,
  mergeCreativeAssumptions,
  mergeCreativeConstraints,
  resolveCreativeRunCapacities,
  selectUpstreamCreativeAssumptions,
  upstreamAssumptionId,
} from "@/domain/creative";
import {
  getCreativeCandidateTextFormatForRun,
} from "@/infrastructure/ai/openai/creative/schema";
import { buildCreativeAnalyzerInstructions } from "@/infrastructure/ai/openai/creative/prompt";
import { resolveCreativeArcBeatBudget } from "@/domain/creative";
import {
  makeCreativeBrief,
  makeMarketingPlan,
  makeValidCreativeCandidate,
} from "./fixtures";

function mktAssumption(
  id: string,
  status: MarketingAssumption["status"] = "inferred",
): MarketingAssumption {
  return {
    id,
    statement: `Assumption marketing ${id}`,
    status,
    justification: "Fixture 8I-B",
  };
}

function planWithUpstream(
  count: number,
  opts?: { brand?: string | null; extraStatuses?: MarketingAssumption[] },
): { brief: ReturnType<typeof makeCreativeBrief>; plan: MarketingPlan } {
  const brief = makeCreativeBrief({
    durationSeconds: 30,
    brandConstraints:
      opts?.brand === null ? undefined : (opts?.brand ?? "Ton marque sobre"),
  });
  const base = makeMarketingPlan(brief);
  const upstream = Array.from({ length: count }, (_, i) =>
    mktAssumption(`mkt-up-${String(i + 1).padStart(2, "0")}`, "inferred"),
  );
  const plan: MarketingPlan = {
    ...base,
    assumptions: [...upstream, ...(opts?.extraStatuses ?? [])],
  };
  return { brief, plan };
}

test("equation assumptions — 0 / 1 / 6 / 12 upstream", () => {
  for (const n of [0, 1, 6, 12]) {
    const { brief, plan } = planWithUpstream(n);
    const caps = resolveCreativeRunCapacities({ brief, marketingPlan: plan });
    assert.equal(caps.assumptions.systemCount, 1);
    assert.equal(caps.assumptions.upstreamCount, n);
    assert.equal(
      caps.assumptions.candidateMax,
      Math.max(0, caps.assumptions.finalMax - 1 - n),
    );
    assert.equal(
      caps.assumptions.enrichmentsExceedFinal,
      1 + n > caps.assumptions.finalMax,
    );
    assert.equal(selectUpstreamCreativeAssumptions(plan).length, n);
  }
});

test("candidateMax = 0 when enrichments fill the budget", () => {
  const { brief, plan } = planWithUpstream(11);
  const caps = resolveCreativeRunCapacities({ brief, marketingPlan: plan });
  assert.equal(caps.assumptions.candidateMax, 0);
  assert.equal(caps.assumptions.enrichmentsExceedFinal, false);
});

test("enrichments alone exceeding finalMax — explicit failure, no slice", () => {
  const { brief, plan } = planWithUpstream(12);
  const caps = resolveCreativeRunCapacities({ brief, marketingPlan: plan });
  assert.equal(caps.assumptions.enrichmentsExceedFinal, true);
  assert.equal(caps.assumptions.candidateMax, 0);
  assert.throws(
    () =>
      finalizeCreativeConcept({
        brief,
        marketingPlan: plan,
        candidate: makeValidCreativeCandidate({ assumptions: [] }),
        metadata: {
          id: "concept-overflow",
          createdBy: "tester",
          correlationId: "corr-overflow",
        },
      }),
    (e: unknown) =>
      e instanceof Error && /Enrichissements Creative/.test(e.message),
  );
});

test("system assumption — exactly one emotional-arc-array-order", () => {
  const system = buildSystemCreativeAssumptions();
  assert.equal(system.length, 1);
  assert.equal(
    system[0]!.id,
    CREATIVE_SYSTEM_ASSUMPTION_IDS.emotionalArcArrayOrder,
  );
});

test("upstream selection — inferred|unverified only, sorted by id", () => {
  const { brief, plan } = planWithUpstream(0, {
    extraStatuses: [
      mktAssumption("z-last", "inferred"),
      mktAssumption("a-first", "unverified"),
      mktAssumption("skip-fact", "explicit"),
    ],
  });
  const selected = selectUpstreamCreativeAssumptions(plan);
  assert.deepEqual(
    selected.map((a) => a.id),
    [upstreamAssumptionId("a-first"), upstreamAssumptionId("z-last")],
  );
  const caps = resolveCreativeRunCapacities({ brief, marketingPlan: plan });
  assert.equal(caps.assumptions.upstreamCount, 2);
});

test("dedupe by stable id — first wins; incompatible content same id collapsed", () => {
  const merged = dedupeByStableId([
    { id: "a", statement: "first" },
    { id: "a", statement: "second-incompatible" },
    { id: "b", statement: "keep" },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]!.statement, "first");
});

test("same content different ids — both kept (no content-hash dedupe)", () => {
  const { brief, plan } = planWithUpstream(0);
  const candidate = [
    {
      id: "cand-1",
      statement: "Same text",
      status: "explicit" as const,
    },
    {
      id: "cand-2",
      statement: "Same text",
      status: "explicit" as const,
    },
  ];
  const out = mergeCreativeAssumptions({
    candidate,
    marketingPlan: plan,
    finalMax: CREATIVE_FIELD_LIMITS.assumptionsMax,
  });
  assert.ok(out.some((a) => a.id === "cand-1"));
  assert.ok(out.some((a) => a.id === "cand-2"));
  void brief;
});

test("candidate/upstream duplicate id — first (candidate) wins; capacity not inflated", () => {
  const { brief, plan } = planWithUpstream(1);
  const up = selectUpstreamCreativeAssumptions(plan)[0]!;
  const caps = resolveCreativeRunCapacities({ brief, marketingPlan: plan });
  // Possible duplicate is NOT counted as guaranteed → candidateMax still reserves upstream.
  assert.equal(caps.assumptions.candidateMax, 12 - 1 - 1);
  const out = mergeCreativeAssumptions({
    candidate: [
      {
        id: up.id,
        statement: "Candidate version wins",
        status: "explicit",
      },
    ],
    marketingPlan: plan,
    finalMax: caps.assumptions.finalMax,
  });
  assert.equal(out.filter((a) => a.id === up.id).length, 1);
  assert.equal(
    out.find((a) => a.id === up.id)?.statement,
    "Candidate version wins",
  );
});

test("upstream/system duplicate id — first wins; order stable", () => {
  const { brief, plan } = planWithUpstream(0);
  const systemId = CREATIVE_SYSTEM_ASSUMPTION_IDS.emotionalArcArrayOrder;
  const out = mergeCreativeAssumptions({
    candidate: [
      {
        id: systemId,
        statement: "Candidate already stated system rule",
        status: "explicit",
      },
    ],
    marketingPlan: plan,
    finalMax: 12,
  });
  assert.equal(out[0]!.id, systemId);
  assert.equal(out[0]!.statement, "Candidate already stated system rule");
  assert.equal(
    out.filter((a) => a.id === systemId).length,
    1,
  );
  void brief;
});

test("constraints — brand conditional + CTA always", () => {
  const withBrand = planWithUpstream(0, { brand: "Brand tone" });
  const noBrand = planWithUpstream(0, { brand: null });
  const c1 = resolveCreativeRunCapacities({
    brief: withBrand.brief,
    marketingPlan: withBrand.plan,
  });
  const c2 = resolveCreativeRunCapacities({
    brief: noBrand.brief,
    marketingPlan: noBrand.plan,
  });
  assert.equal(c1.constraints.brandPresent, true);
  assert.equal(c1.constraints.ctaPresent, true);
  assert.equal(c1.constraints.systemCount, 2);
  assert.equal(c1.constraints.candidateMax, 8 - 2);
  assert.equal(c2.constraints.brandPresent, false);
  assert.equal(c2.constraints.systemCount, 1);
  assert.equal(c2.constraints.candidateMax, 8 - 1);
});

test("constraints dedupe — candidate brand/cta id preserved", () => {
  const { brief, plan } = planWithUpstream(0, { brand: "Brand" });
  const out = mergeCreativeConstraints({
    candidate: [
      {
        id: CREATIVE_SYSTEM_CONSTRAINT_IDS.brand,
        text: "Candidate brand",
        source: "user_constraint",
      },
      {
        id: CREATIVE_SYSTEM_CONSTRAINT_IDS.cta,
        text: "Candidate cta",
        source: "marketing_plan",
      },
    ],
    brief,
    marketingPlan: plan,
    finalMax: 8,
  });
  assert.equal(
    out.find((c) => c.id === CREATIVE_SYSTEM_CONSTRAINT_IDS.brand)?.text,
    "Candidate brand",
  );
  assert.equal(
    out.find((c) => c.id === CREATIVE_SYSTEM_CONSTRAINT_IDS.cta)?.text,
    "Candidate cta",
  );
});

test("prompt + JSON schema + Zod share candidateMax", () => {
  const { brief, plan } = planWithUpstream(6);
  const caps = resolveCreativeRunCapacities({ brief, marketingPlan: plan });
  assert.equal(caps.assumptions.candidateMax, 5);
  const budget = resolveCreativeArcBeatBudget(brief.durationSeconds);
  const instructions = buildCreativeAnalyzerInstructions(budget, caps);
  assert.match(instructions, /assumptions at most 5/);
  assert.match(instructions, /constraints at most/);

  const fmt = getCreativeCandidateTextFormatForRun(caps);
  const props = (
    fmt.schema as {
      properties: {
        assumptions: { maxItems: number };
        constraints: { maxItems: number };
      };
    }
  ).properties;
  assert.equal(props.assumptions.maxItems, caps.assumptions.candidateMax);
  assert.equal(props.constraints.maxItems, caps.constraints.candidateMax);

  const zod = createCreativeAnalyzerCandidateSchema(candidateCapsFromRun(caps));
  const tooMany = makeValidCreativeCandidate({
    assumptions: Array.from({ length: caps.assumptions.candidateMax + 1 }, (_, i) => ({
      id: `a-${i}`,
      statement: `A${i}`,
      status: "explicit" as const,
    })),
  });
  // Analyzer schema has no order on beats — strip for openAI-shaped object
  const { emotionalArc, ...rest } = tooMany;
  const analyzerShape = {
    ...rest,
    emotionalArc: emotionalArc.map(({ purpose, emotion, description }) => ({
      purpose,
      emotion,
      description,
    })),
  };
  const parsed = zod.safeParse(analyzerShape);
  assert.equal(parsed.success, false);
});

test("exact capacity reached — final concept valid; no array slice repair", () => {
  const { brief, plan } = planWithUpstream(2);
  const caps = resolveCreativeRunCapacities({ brief, marketingPlan: plan });
  const candidateAssumptions = Array.from(
    { length: caps.assumptions.candidateMax },
    (_, i) => ({
      id: `cand-${i}`,
      statement: `Candidate assumption ${i}`,
      status: "explicit" as const,
    }),
  );
  const concept = finalizeCreativeConcept({
    brief,
    marketingPlan: plan,
    candidate: makeValidCreativeCandidate({ assumptions: candidateAssumptions }),
    metadata: {
      id: "concept-exact",
      createdBy: "tester",
      correlationId: "corr-exact",
    },
  });
  assert.equal(concept.assumptions.length, caps.assumptions.finalMax);
  assert.ok(
    concept.assumptions.some(
      (a) => a.id === CREATIVE_SYSTEM_ASSUMPTION_IDS.emotionalArcArrayOrder,
    ),
  );
  assert.ok(
    concept.assumptions.some((a) => a.id.startsWith("from-mkt-")),
  );
});

test("overflow by construction impossible — finalize throws, never slices", () => {
  const { brief, plan } = planWithUpstream(0);
  assert.throws(
    () =>
      finalizeCreativeConcept({
        brief,
        marketingPlan: plan,
        candidate: makeValidCreativeCandidate({
          assumptions: Array.from({ length: 12 }, (_, i) => ({
            id: `overflow-${i}`,
            statement: `O${i}`,
            status: "explicit" as const,
          })),
        }),
        metadata: {
          id: "concept-cand-overflow",
          createdBy: "tester",
          correlationId: "corr-cand-overflow",
        },
      }),
    (e: unknown) =>
      e instanceof Error && /Trop d'assumptions candidat/.test(e.message),
  );
});

test("source files — no silent takeUpTo / slice repair on assumptions arrays", () => {
  const root = join(process.cwd(), "src", "domain", "creative");
  const finalizeSrc = readFileSync(join(root, "finalize.ts"), "utf8");
  const capacitiesSrc = readFileSync(join(root, "array-capacities.ts"), "utf8");
  assert.equal(/takeUpTo/.test(finalizeSrc), false);
  assert.equal(/\.slice\(\s*0\s*,\s*caps/.test(finalizeSrc), false);
  assert.equal(/assumptions\.slice\(/.test(finalizeSrc), false);
  assert.equal(/constraints\.slice\(/.test(finalizeSrc), false);
  assert.equal(/assumptions\.slice\(/.test(capacitiesSrc), false);
  assert.equal(/constraints\.slice\(/.test(capacitiesSrc), false);
});

test("v5 contract versions", async () => {
  const { CREATIVE_ANALYZER_PROMPT_VERSION } = await import(
    "@/infrastructure/ai/openai/creative/prompt"
  );
  const { CREATIVE_CANDIDATE_SCHEMA_VERSION, CREATIVE_CANDIDATE_SCHEMA_NAME } =
    await import("@/infrastructure/ai/openai/creative/schema");
  assert.equal(CREATIVE_ANALYZER_PROMPT_VERSION, "creative-analyzer-v5");
  assert.equal(CREATIVE_CANDIDATE_SCHEMA_VERSION, "1.2.0");
  assert.equal(CREATIVE_CANDIDATE_SCHEMA_NAME, "creative-analysis-candidate-v1_2");
});
