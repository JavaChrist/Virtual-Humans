/**
 * Structured prompt constraints (VHS-106).
 */

export type PromptConstraintSource =
  | "brief"
  | "marketing_plan"
  | "creative_concept"
  | "video_script"
  | "visual_direction"
  | "storyboard";

export type PromptConstraint = {
  code: string;
  description: string;
  source: PromptConstraintSource;
  severity: "required" | "preferred";
};

export type ConstraintBlock = {
  required: PromptConstraint[];
  forbidden: PromptConstraint[];
  continuity: PromptConstraint[];
  safety: PromptConstraint[];
};

function norm(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function dedupeConstraints(list: PromptConstraint[]): PromptConstraint[] {
  const seen = new Set<string>();
  const out: PromptConstraint[] = [];
  for (const c of list) {
    const key = `${c.code}|${norm(c.description)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, description: c.description.trim() });
  }
  return out;
}

/** Detect required vs forbidden contradictions by overlapping normalized description tokens. */
export function findConstraintContradictions(
  block: ConstraintBlock,
): Array<{ code: string; message: string }> {
  const issues: Array<{ code: string; message: string }> = [];
  const required = [...block.required, ...block.continuity, ...block.safety].filter(
    (c) => c.severity === "required",
  );
  for (const r of required) {
    for (const f of block.forbidden) {
      if (r.code === f.code || norm(r.description) === norm(f.description)) {
        issues.push({
          code: "constraint_contradiction",
          message: `Contrainte contradictoire: ${r.code}`,
        });
      }
      // Explicit polarity pairs
      if (
        (r.code.startsWith("must_") && f.code === r.code.replace(/^must_/, "forbid_")) ||
        (f.code.startsWith("forbid_") && r.code === f.code.replace(/^forbid_/, "must_"))
      ) {
        issues.push({
          code: "constraint_contradiction",
          message: `Paire must/forbid contradictoire: ${r.code}`,
        });
      }
    }
  }
  return issues;
}
