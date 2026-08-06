/**
 * Single source of truth for Creative array capacities (8I-B).
 *
 * Capacities are computed from active brief + marketing plan BEFORE the model
 * call. Finalize must never silently truncate — it only concatenates, dedupes
 * by stable id, and fails closed on invariant breach.
 *
 * Assumptions equation:
 *   final = candidate + system + selectedUpstream - deterministicDuplicates(by id)
 *
 * Constraints equation:
 *   final = candidate + brandIfPresent + ctaAlways - deterministicDuplicates(by id)
 */

import type { VideoProjectBrief } from "@/domain/brief";
import type { MarketingPlan } from "@/domain/marketing";
import {
  CREATIVE_FIELD_LIMITS,
  type CreativeAssumption,
  type CreativeConstraint,
} from "./creative-concept";
import { resolveCreativeArcBeatBudget } from "./arc-beat-budget";

/** Stable system assumption ids injected by finalize. */
export const CREATIVE_SYSTEM_ASSUMPTION_IDS = {
  emotionalArcArrayOrder: "assumption-emotional-arc-array-order",
} as const;

export const CREATIVE_SYSTEM_CONSTRAINT_IDS = {
  brand: "constraint-brand",
  cta: "constraint-cta",
} as const;

export type CreativeAssumptionsCapacity = {
  finalMax: number;
  systemCount: number;
  upstreamCount: number;
  /** Max the model may emit. May be 0 when enrichments fill the budget. */
  candidateMax: number;
  /** True when system+upstream alone exceed finalMax. */
  enrichmentsExceedFinal: boolean;
  selectedUpstreamIds: string[];
};

export type CreativeConstraintsCapacity = {
  finalMax: number;
  /** brand (0|1) + cta (1). */
  systemCount: number;
  brandPresent: boolean;
  ctaPresent: true;
  candidateMax: number;
  enrichmentsExceedFinal: boolean;
};

export type CreativeRunCapacities = {
  assumptions: CreativeAssumptionsCapacity;
  constraints: CreativeConstraintsCapacity;
  emotionalArc: {
    durationSeconds: number;
    minBeats: number;
    maxBeats: number;
    finalMax: number;
  };
  referenceKeywords: { finalMax: number; candidateMax: number };
  evidence: { finalMax: number; candidateMax: number };
};

/** Upstream marketing assumptions copied into the Creative Concept (deterministic). */
export function selectUpstreamCreativeAssumptions(
  plan: MarketingPlan,
): CreativeAssumption[] {
  return [...plan.assumptions]
    .filter((a) => a.status === "inferred" || a.status === "unverified")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((a) => {
      const prefix = "Hypothèse marketing reprise: ";
      const maxBody = Math.max(
        0,
        CREATIVE_FIELD_LIMITS.assumptionStatement - prefix.length,
      );
      const body =
        a.statement.length <= maxBody
          ? a.statement
          : a.statement.slice(0, maxBody).trimEnd();
      return {
        id: upstreamAssumptionId(a.id),
        statement: `${prefix}${body}`,
        status: "inferred" as const,
        justification:
          "Portée depuis le Marketing Plan sans la transformer en fait.",
        affectsFields: ["logline", "bigIdea"],
      };
    });
}

export function upstreamAssumptionId(marketingAssumptionId: string): string {
  return `from-mkt-${marketingAssumptionId}`;
}

export function buildSystemCreativeAssumptions(): CreativeAssumption[] {
  return [
    {
      id: CREATIVE_SYSTEM_ASSUMPTION_IDS.emotionalArcArrayOrder,
      statement:
        "Ordre des beats dérivé de la position du tableau (index+1); la séquence narrative n'est jamais réordonnée.",
      status: "explicit",
      affectsFields: ["emotionalArc"],
    },
  ];
}

export function buildSystemCreativeConstraints(input: {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
}): CreativeConstraint[] {
  const out: CreativeConstraint[] = [];
  if (input.brief.brandConstraints?.trim()) {
    out.push({
      id: CREATIVE_SYSTEM_CONSTRAINT_IDS.brand,
      text: input.brief.brandConstraints
        .trim()
        .slice(0, CREATIVE_FIELD_LIMITS.constraintText),
      source: "user_constraint",
    });
  }
  out.push({
    id: CREATIVE_SYSTEM_CONSTRAINT_IDS.cta,
    text: `Conserver le CTA marketing: ${input.marketingPlan.callToAction}`.slice(
      0,
      CREATIVE_FIELD_LIMITS.constraintText,
    ),
    source: "marketing_plan",
  });
  return out;
}

/**
 * Compute run capacities from active inputs — shared by schema, prompt,
 * dry-run, adapter, and finalize.
 */
export function resolveCreativeRunCapacities(input: {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
}): CreativeRunCapacities {
  const upstream = selectUpstreamCreativeAssumptions(input.marketingPlan);
  const systemAssumptions = buildSystemCreativeAssumptions();
  const assumptionsFinal = CREATIVE_FIELD_LIMITS.assumptionsMax;
  const assumptionsReserved = systemAssumptions.length + upstream.length;
  const assumptionsCandidateMax = Math.max(0, assumptionsFinal - assumptionsReserved);

  const systemConstraints = buildSystemCreativeConstraints(input);
  const constraintsFinal = CREATIVE_FIELD_LIMITS.constraintsMax;
  const constraintsReserved = systemConstraints.length;
  const constraintsCandidateMax = Math.max(0, constraintsFinal - constraintsReserved);

  const arc = resolveCreativeArcBeatBudget(input.brief.durationSeconds);

  return {
    assumptions: {
      finalMax: assumptionsFinal,
      systemCount: systemAssumptions.length,
      upstreamCount: upstream.length,
      candidateMax: assumptionsCandidateMax,
      enrichmentsExceedFinal: assumptionsReserved > assumptionsFinal,
      selectedUpstreamIds: upstream.map((a) => a.id),
    },
    constraints: {
      finalMax: constraintsFinal,
      systemCount: constraintsReserved,
      brandPresent: systemConstraints.some(
        (c) => c.id === CREATIVE_SYSTEM_CONSTRAINT_IDS.brand,
      ),
      ctaPresent: true,
      candidateMax: constraintsCandidateMax,
      enrichmentsExceedFinal: constraintsReserved > constraintsFinal,
    },
    emotionalArc: {
      durationSeconds: arc.durationSeconds,
      minBeats: arc.minBeats,
      maxBeats: arc.maxBeats,
      finalMax: CREATIVE_FIELD_LIMITS.beatsMax,
    },
    referenceKeywords: {
      finalMax: CREATIVE_FIELD_LIMITS.referenceKeywordsMax,
      candidateMax: CREATIVE_FIELD_LIMITS.referenceKeywordsMax,
    },
    evidence: {
      finalMax: CREATIVE_FIELD_LIMITS.evidenceMax,
      candidateMax: CREATIVE_FIELD_LIMITS.evidenceMax,
    },
  };
}

/** Dedupe by stable id — first occurrence wins (deterministic concatenation order). */
export function dedupeByStableId<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Merge candidate + system + upstream without truncation.
 * Throws if the result exceeds finalMax (invariant — should be impossible
 * when candidate was capped by the same capacities before the model call).
 */
export function mergeCreativeAssumptions(input: {
  candidate: CreativeAssumption[];
  marketingPlan: MarketingPlan;
  finalMax: number;
}): CreativeAssumption[] {
  const system = buildSystemCreativeAssumptions();
  const upstream = selectUpstreamCreativeAssumptions(input.marketingPlan);
  const merged = dedupeByStableId([
    ...input.candidate,
    ...system,
    ...upstream,
  ]);
  if (merged.length > input.finalMax) {
    throw new Error(
      `Creative assumptions invariant breached: ${merged.length} > ${input.finalMax}`,
    );
  }
  return merged;
}

export function mergeCreativeConstraints(input: {
  candidate: CreativeConstraint[];
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  finalMax: number;
}): CreativeConstraint[] {
  const system = buildSystemCreativeConstraints({
    brief: input.brief,
    marketingPlan: input.marketingPlan,
  });
  const merged = dedupeByStableId([...input.candidate, ...system]);
  if (merged.length > input.finalMax) {
    throw new Error(
      `Creative constraints invariant breached: ${merged.length} > ${input.finalMax}`,
    );
  }
  return merged;
}

/** Prompt-facing capacity summary (no prose from inputs). */
export function formatCreativeCapacityRunConstraint(
  caps: CreativeRunCapacities,
): string {
  return [
    `Capacity for this run: assumptions at most ${caps.assumptions.candidateMax}`,
    `(finalMax=${caps.assumptions.finalMax}, system=${caps.assumptions.systemCount},`,
    `upstream=${caps.assumptions.upstreamCount});`,
    `constraints at most ${caps.constraints.candidateMax}`,
    `(finalMax=${caps.constraints.finalMax}, system=${caps.constraints.systemCount}).`,
  ].join(" ");
}
