/**
 * Deterministic hard-gate for Creative forbidden references (VHS-8F-A).
 * Never logs or returns the full candidate text — only rule/category/hash.
 */

import { createHash } from "node:crypto";
import type { CreativeValidationIssue } from "./errors";

/** Categories requested for redacted observability. */
export type ForbiddenReferenceCategory =
  | "artiste"
  | "studio"
  | "oeuvre"
  | "franchise"
  | "marque"
  | "personnage"
  | "plateforme";

export type ForbiddenReferenceDiagnostics = {
  matchedRule: string;
  category: ForbiddenReferenceCategory;
  /** SHA-256 hex of the matched substring only (never the full field). */
  matchHash: string;
  matchLen: number;
  sourceType: "candidate_field";
};

type ForbiddenRule = {
  id: string;
  category: ForbiddenReferenceCategory;
  /** Must not use a bare `comme + word` with the `/i` flag — that FPs French prose. */
  pattern: RegExp;
};

/**
 * Hard rules — imitation / IP only.
 * Intentionally omits generic French "comme …" comparisons and Brief platforms.
 */
const FORBIDDEN_REFERENCE_RULES: readonly ForbiddenRule[] = [
  {
    id: "style_imitation_fr",
    category: "artiste",
    // Avoid `\b` before accented French — JS word chars are ASCII-only.
    pattern: /dans le style(?: exact)? de/i,
  },
  {
    id: "style_imitation_en",
    category: "artiste",
    pattern: /\bin the(?: exact)? style of\b/i,
  },
  {
    id: "manner_imitation_fr",
    category: "artiste",
    pattern: /à la (?:manière|façon) de/i,
  },
  {
    id: "manner_imitation_en",
    category: "artiste",
    pattern: /\bin the manner of\b/i,
  },
  {
    // Named inspiration only (capitalized token after par/by). No `/i` on the name class.
    // "inspiré par la lumière" / "inspired by soft light" stay allowed.
    id: "inspired_by_named",
    category: "artiste",
    pattern: /(?:^|[^\p{L}])(?:inspir(?:é|ée)|inspired)\s+(?:par|by)\s+[A-ZÀ-Ü]/u,
  },
  {
    // Celebrity-like "comme First Last dans/in…" — not bare product titles ("Comme Objectif X").
    id: "comme_proper_name_imitation",
    category: "artiste",
    pattern:
      /(?:^|[^\p{L}])[Cc]omme\s+[A-ZÀ-Ü][\p{L}'-]+(?:\s+[A-ZÀ-Ü][\p{L}'-]+)+\s+(?:dans|in|du|de)\b/u,
  },
  {
    id: "franchise_pixar",
    category: "franchise",
    pattern: /\bpixar\b/i,
  },
  {
    id: "franchise_disney",
    category: "franchise",
    pattern: /\bdisney\b/i,
  },
  {
    id: "franchise_marvel",
    category: "franchise",
    pattern: /\bmarvel\b/i,
  },
  {
    id: "franchise_star_wars",
    category: "franchise",
    pattern: /\bstar[\s-]?wars\b/i,
  },
  {
    id: "franchise_harry_potter",
    category: "franchise",
    pattern: /\bharry[\s-]?potter\b/i,
  },
  {
    id: "studio_dreamworks",
    category: "studio",
    pattern: /\bdreamworks\b/i,
  },
  {
    id: "studio_ghibli",
    category: "studio",
    pattern: /\b(?:studio\s+)?ghibli\b/i,
  },
  {
    id: "personnage_mickey",
    category: "personnage",
    pattern: /\bmickey\s+mouse\b/i,
  },
  {
    id: "evasion_pixar",
    category: "franchise",
    pattern: /\bp[i1l|]x[a@4]r\b/i,
  },
  {
    id: "evasion_disney",
    category: "franchise",
    pattern: /\bd[i1l|]sn[e3]y\b/i,
  },
  {
    id: "evasion_marvel",
    category: "franchise",
    pattern: /\bm[a@4]rv[e3]l\b/i,
  },
];

const PUBLIC_MESSAGE =
  "Référence à un artiste, imitation exacte ou IP non autorisée.";

function hashMatch(matched: string): string {
  return createHash("sha256").update(matched).digest("hex");
}

export function inspectForbiddenReferences(
  text: string,
): ForbiddenReferenceDiagnostics | null {
  for (const rule of FORBIDDEN_REFERENCE_RULES) {
    const m = text.match(rule.pattern);
    if (!m?.[0]) continue;
    const matched = m[0];
    return {
      matchedRule: rule.id,
      category: rule.category,
      matchHash: hashMatch(matched),
      matchLen: matched.length,
      sourceType: "candidate_field",
    };
  }
  return null;
}

export function detectForbiddenReferences(
  text: string,
  field: string,
): CreativeValidationIssue[] {
  const hit = inspectForbiddenReferences(text);
  if (!hit) return [];
  return [
    {
      code: "forbidden_reference",
      message: PUBLIC_MESSAGE,
      field,
      diagnostics: hit,
    },
  ];
}

/** Exposed for hostile-matrix tests — do not widen casually. */
export const FORBIDDEN_REFERENCE_RULE_IDS = FORBIDDEN_REFERENCE_RULES.map(
  (r) => r.id,
);
