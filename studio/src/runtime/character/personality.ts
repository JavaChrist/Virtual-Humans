import { load } from "js-yaml";
import {
  bulletItems,
  fencedBlocks,
  findSection,
  nonEmptyLines,
  splitSections,
} from "./markdown";
import type { DataQualityIssue, Level, PersonalityProfile } from "./schema";

/** Map a qualitative level label to a normalised 0..1 value. */
function levelValue(raw: string | null): number | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  const table: Record<string, number> = {
    "very high": 0.95,
    "high": 0.85,
    "medium-high": 0.7,
    "medium high": 0.7,
    "medium": 0.5,
    "low-medium": 0.35,
    "low medium": 0.35,
    "medium-low": 0.35,
    "low": 0.25,
    "very low": 0.1,
    "none": 0,
  };
  return key in table ? table[key] : null;
}

function toLevel(raw: unknown): Level {
  const asString = typeof raw === "string" ? raw : raw == null ? null : String(raw);
  return { raw: asString, value: levelValue(asString) };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function parseYamlRecord(block: string | undefined): Record<string, unknown> {
  if (!block) return {};
  try {
    const parsed = load(block);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Split a section body into "preferred" (before an Avoid marker) and "avoided". */
function splitPreferredAvoided(body: string): { preferred: string; avoided: string } {
  const lines = body.split(/\r?\n/);
  const idx = lines.findIndex((l) => /^\s*avoid[:\s]/i.test(l));
  if (idx === -1) return { preferred: body, avoided: "" };
  return {
    preferred: lines.slice(0, idx).join("\n"),
    avoided: lines.slice(idx).join("\n"),
  };
}

/**
 * PHRASE REGISTRY — future work (NOT implemented yet, pending validation).
 *
 * For now the runtime only extracts candidate phrases (greetings, conclusions,
 * CTA) from the Markdown and never invents or picks a canonical one. A future
 * canonical phrase registry — created only once validated — is expected to
 * distinguish, per phrase:
 *   - opening.default / closing.default
 *   - CTA
 *   - variants
 *   - language
 *   - context
 *   - status: locked | editable
 * The current `greetings` / `conclusions` / `ctaPreferred` / `ctaAvoided`
 * arrays remain the temporary candidate source until then.
 */
export interface PersonalityParseResult {
  profile: PersonalityProfile;
  issues: DataQualityIssue[];
  /**
   * Raw `character_id` values declared in the personality document, gathered
   * from the core-summary block (§4) and the metadata block (§83). Used by the
   * loader to detect a *real* contradiction between two canonical id
   * declarations — never the difference between id and business code.
   */
  declaredCharacterIds: { summary: string | null; metadata: string | null };
}

/**
 * Parse the structured personality from `02_PERSONALITY.md`.
 * The Markdown remains the source of truth; this produces a validated,
 * queryable projection and reports anything that could not be resolved.
 */
export function parsePersonality(md: string, source: string): PersonalityParseResult {
  const issues: DataQualityIssue[] = [];
  const sections = splitSections(md);

  const summaryYaml = parseYamlRecord(
    fencedBlocks(findSection(sections, "core personality summary")?.body ?? "", "yaml")[0]
  );
  const metadataYaml = parseYamlRecord(
    fencedBlocks(findSection(sections, "personality metadata")?.body ?? "", "yaml")[0]
  );

  const coreTraits = asStringArray(summaryYaml.core_traits);
  const communicationStyle = asStringArray(summaryYaml.communication_style);

  const primaryTraits = nonEmptyLines(
    fencedBlocks(findSection(sections, "primary traits")?.body ?? "", "text")[0] ?? ""
  );
  const secondaryTraits = nonEmptyLines(
    fencedBlocks(findSection(sections, "secondary traits")?.body ?? "", "text")[0] ?? ""
  );
  const prohibitedTraits = bulletItems(
    findSection(sections, "prohibited personality traits")?.body ?? ""
  );

  const coreIdentitySentence =
    nonEmptyLines(
      fencedBlocks(findSection(sections, "core identity sentence")?.body ?? "", "text")[0] ?? ""
    )[0] ?? null;

  const greetings = fencedBlocks(findSection(sections, "greetings")?.body ?? "", "text").map((b) =>
    b.trim()
  );
  const conclusions = fencedBlocks(
    findSection(sections, "conclusions")?.body ?? "",
    "text"
  ).map((b) => b.trim());

  const ctaSection = findSection(sections, "calls to action")?.body ?? "";
  const { preferred: ctaPref, avoided: ctaAvoid } = splitPreferredAvoided(ctaSection);
  const ctaPreferred = fencedBlocks(ctaPref, "text").map((b) => b.trim());
  const ctaAvoided = fencedBlocks(ctaAvoid, "text").map((b) => b.trim());

  const profile: PersonalityProfile = {
    source,
    personalityVersion:
      typeof summaryYaml.personality_version === "string"
        ? summaryYaml.personality_version
        : typeof metadataYaml.personality_version === "string"
          ? metadataYaml.personality_version
          : null,
    coreIdentitySentence,
    levels: {
      warmth: toLevel(metadataYaml.warmth_level),
      energy: toLevel(metadataYaml.energy_level),
      formality: toLevel(metadataYaml.formality_level),
      humor: toLevel(metadataYaml.humor_level),
    },
    coreTraits,
    communicationStyle,
    primaryTraits,
    secondaryTraits,
    prohibitedTraits,
    greetings,
    conclusions,
    ctaPreferred,
    ctaAvoided,
    formOfAddress:
      typeof metadataYaml.form_of_address === "string" ? metadataYaml.form_of_address : null,
    language: typeof metadataYaml.language === "string" ? metadataYaml.language : null,
    metadata: metadataYaml,
  };

  // Data-quality signals (non-fatal; surfaced in the diagnostic screen).
  if (coreTraits.length === 0) {
    issues.push({
      code: "PERSONALITY_CORE_TRAITS_EMPTY",
      severity: "error",
      field: "personality.coreTraits",
      message: "No core traits parsed from the personality core summary YAML block.",
    });
  }
  if (primaryTraits.length === 0) {
    issues.push({
      code: "PERSONALITY_PRIMARY_TRAITS_EMPTY",
      severity: "warning",
      field: "personality.primaryTraits",
      message: "No locked primary traits parsed.",
    });
  }
  if (greetings.length === 0 && conclusions.length === 0) {
    issues.push({
      code: "PHRASES_MISSING",
      severity: "warning",
      field: "personality.phrases",
      message: "No greeting or conclusion phrases could be extracted.",
    });
  } else {
    issues.push({
      code: "PHRASES_NOT_CANONICAL",
      severity: "info",
      field: "personality.phrases",
      message: `No single canonical opening/closing phrase is declared; extracted ${greetings.length} greeting and ${conclusions.length} conclusion candidate(s).`,
    });
  }
  const missingLevels = Object.entries(profile.levels)
    .filter(([, l]) => l.value === null)
    .map(([k]) => k);
  if (missingLevels.length > 0) {
    issues.push({
      code: "PERSONALITY_LEVELS_UNMAPPED",
      severity: "info",
      field: "personality.levels",
      message: `Unmapped personality level(s): ${missingLevels.join(", ")}.`,
    });
  }

  return {
    profile,
    issues,
    declaredCharacterIds: {
      summary: typeof summaryYaml.character_id === "string" ? summaryYaml.character_id : null,
      metadata: typeof metadataYaml.character_id === "string" ? metadataYaml.character_id : null,
    },
  };
}
