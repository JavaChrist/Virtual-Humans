import fs from "node:fs";
import path from "node:path";
import {
  CHARACTERS_ROOT,
  REPO_ROOT,
  getVoiceConfig,
  listAssets,
  listOutfits,
} from "@/lib/sdk";
import { CharacterDocumentMissingError, CharacterPackageInvalidError } from "../errors";
import { firstHeading, splitSections } from "./markdown";
import { parsePersonality } from "./personality";
import {
  CharacterPackageSchema,
  type CharacterPackage,
  type DataQualityIssue,
  type DocumentRef,
  type IdentitySection,
  type MemoryRef,
} from "./schema";

const IDENTITY_DOC = "memory/00_IDENTITY.md";
const APPEARANCE_DOC = "01_APPEARANCE.md";
const PERSONALITY_DOC = "02_PERSONALITY.md";
const CAPABILITIES_DOC = "11_CAPABILITIES.md";
const LIMITATIONS_DOC = "12_LIMITATIONS.md";
const VOICE_CONFIG = "voice/config.json";

/** Ordered set of memory documents expected in a complete character package. */
const MEMORY_FILES = [
  "00_IDENTITY.md",
  "01_CHARACTER_MEMORY.md",
  "02_PRODUCT_MEMORY.md",
  "03_BRAND_MEMORY.md",
  "04_MARKETING_MEMORY.md",
  "05_SOCIAL_MEMORY.md",
  "06_VIDEO_MEMORY.md",
  "07_LANGUAGE_MEMORY.md",
  "08_RELATIONSHIP_MEMORY.md",
  "09_PROJECT_MEMORY.md",
  "10_RUNTIME_MEMORY.md",
] as const;

function readText(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/** Turn a directory name into a stable, URL-safe id ("Mei SDK v1.0.0" → "mei-sdk-v1-0-0"). */
export function slugify(directoryName: string): string {
  return directoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function displayNameOf(directoryName: string): string {
  return directoryName.replace(/\s*SDK.*/i, "").trim() || directoryName;
}

/** Value following a plain "Label" line inside a block-style document. */
function valueAfterLabel(body: string, label: string): string | null {
  const lines = body.split(/\r?\n/).map((l) => l.trim());
  const idx = lines.findIndex((l) => l.toLowerCase() === label.toLowerCase());
  if (idx === -1) return null;
  for (let i = idx + 1; i < lines.length; i++) {
    if (lines[i].length > 0) return lines[i];
  }
  return null;
}

function docRef(dir: string, rel: string): DocumentRef {
  const md = readText(path.join(dir, rel));
  if (md === null) {
    return { present: false, source: rel, title: null, sectionCount: 0 };
  }
  return {
    present: true,
    source: rel,
    title: firstHeading(md),
    sectionCount: splitSections(md).length,
  };
}

function extractSdkVersion(identityMd: string | null): string | null {
  const repoVersion = readText(path.join(REPO_ROOT, "SDK_VERSION"))?.trim();
  if (repoVersion) return repoVersion;
  if (identityMd) {
    const m = /v?(\d+\.\d+\.\d+)/.exec(identityMd);
    if (m) return m[1];
  }
  return null;
}

function parseIdentity(dir: string): { section: IdentitySection; md: string | null } {
  const md = readText(path.join(dir, IDENTITY_DOC));
  if (md === null) {
    return {
      md,
      section: {
        present: false,
        source: IDENTITY_DOC,
        name: null,
        role: null,
        coreValues: [],
        languages: { primary: null, secondary: null },
      },
    };
  }
  const sections = splitSections(md);
  const identityBody = sections.find((s) => /character identity/i.test(s.heading))?.body ?? "";
  const langBody = sections.find((s) => /^languages/i.test(s.heading))?.body ?? "";
  const roleBody = sections.find((s) => /^role/i.test(s.heading))?.body ?? "";
  const valuesBody = sections.find((s) => /core values/i.test(s.heading))?.body ?? "";

  const role =
    roleBody
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? null;

  const coreValues = valuesBody
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== "---");

  return {
    md,
    section: {
      present: true,
      source: IDENTITY_DOC,
      name: valueAfterLabel(identityBody, "Character Name"),
      role,
      coreValues,
      languages: {
        primary: valueAfterLabel(langBody, "Primary"),
        secondary: valueAfterLabel(langBody, "Secondary"),
      },
    },
  };
}

function loadMemories(dir: string): MemoryRef[] {
  const memDir = path.join(dir, "memory");
  return MEMORY_FILES.map((file) => {
    const md = readText(path.join(memDir, file));
    return { file, present: md !== null, title: md ? firstHeading(md) : null };
  });
}

/**
 * Loads and validates a single character package from disk.
 *
 * Fatal problems (missing required documents, schema violations) throw a
 * typed runtime error. Non-fatal problems are collected in `dataQuality` so
 * the diagnostic UI can surface them without hiding the rest of the package.
 */
export class CharacterPackageLoader {
  constructor(private readonly charactersRoot: string = CHARACTERS_ROOT) {}

  load(directoryName: string): CharacterPackage {
    const dir = path.join(this.charactersRoot, directoryName);
    const slug = slugify(directoryName);
    const issues: DataQualityIssue[] = [];

    const { section: identity, md: identityMd } = parseIdentity(dir);
    if (!identity.present) {
      throw new CharacterDocumentMissingError(slug, IDENTITY_DOC);
    }

    const personalityMd = readText(path.join(dir, PERSONALITY_DOC));
    if (personalityMd === null) {
      throw new CharacterDocumentMissingError(slug, PERSONALITY_DOC);
    }
    const {
      profile: personality,
      issues: personalityIssues,
      declaredCharacterIds,
    } = parsePersonality(personalityMd, PERSONALITY_DOC);
    issues.push(...personalityIssues);

    const identityBody = identityMd
      ? (splitSections(identityMd).find((s) => /character identity/i.test(s.heading))?.body ?? "")
      : "";
    // Business code (permanent, human-readable): e.g. "MEI-001".
    const characterCode = valueAfterLabel(identityBody, "Character ID");
    const characterVersion = valueAfterLabel(identityBody, "Character Version");
    const status = valueAfterLabel(identityBody, "Status");

    // Canonical technical id: declared in the personality document, normalised
    // to a stable lowercase token; falls back to the directory slug.
    const declaredTechnicalId = declaredCharacterIds.summary ?? declaredCharacterIds.metadata;
    const characterId = (declaredTechnicalId ?? slug).trim().toLowerCase();
    if (!declaredTechnicalId) {
      issues.push({
        code: "CHARACTER_ID_UNDECLARED",
        severity: "warning",
        field: "characterId",
        message: `No character_id declared in ${PERSONALITY_DOC}; derived "${characterId}" from the directory name.`,
      });
    }

    const rawAssets = listAssets(directoryName);
    const rawOutfits = listOutfits(directoryName);
    const voiceConfig = getVoiceConfig(directoryName);
    const voicePresent = readText(path.join(dir, VOICE_CONFIG)) !== null;

    const capabilities = docRef(dir, CAPABILITIES_DOC);
    const limitations = docRef(dir, LIMITATIONS_DOC);
    const appearance = docRef(dir, APPEARANCE_DOC);
    const memories = loadMemories(dir);

    // Assets explicitly marked invalid (e.g. copied from another character and
    // not yet replaced) are never exposed as this character's references.
    const assetStatus = readAssetStatus(dir);
    const assetsInvalid = assetStatus?.valid === false;
    const identityReferences = assetsInvalid ? [] : rawAssets.identity;
    const poses = assetsInvalid ? [] : rawAssets.poses;
    const expressions = assetsInvalid ? [] : rawAssets.expressions;
    const outfits = assetsInvalid ? [] : rawOutfits;

    // --- Non-fatal data-quality checks -------------------------------------
    if (assetsInvalid) {
      const origin = assetStatus?.origin ? ` from "${assetStatus.origin}"` : "";
      for (const field of ["identityReferences", "expressions", "poses", "outfits"] as const) {
        issues.push(
          warn(
            "ASSET_PENDING_REPLACEMENT",
            field,
            `Assets are copied${origin} and pending character-specific replacement; excluded from this package.`
          )
        );
      }
    } else {
      if (outfits.length === 0) {
        issues.push(warn("OUTFITS_EMPTY", "outfits", "No outfits found under assets/outfits/."));
      }
      if (identityReferences.length === 0) {
        issues.push(
          warn("IDENTITY_REFS_EMPTY", "identityReferences", "No identity reference images found.")
        );
      }
      if (poses.length === 0) {
        issues.push(warn("POSES_EMPTY", "poses", "No pose images found."));
      }
      if (expressions.length === 0) {
        issues.push(warn("EXPRESSIONS_EMPTY", "expressions", "No expression images found."));
      }
    }
    if (!capabilities.present) {
      issues.push(warn("CAPABILITIES_MISSING", "capabilities", `${CAPABILITIES_DOC} is missing.`));
    }
    if (!limitations.present) {
      issues.push(warn("LIMITATIONS_MISSING", "limitations", `${LIMITATIONS_DOC} is missing.`));
    }
    if (!voicePresent) {
      issues.push(warn("VOICE_CONFIG_MISSING", "voice", `${VOICE_CONFIG} is missing.`));
    }
    const missingMemories = memories.filter((m) => !m.present).map((m) => m.file);
    if (missingMemories.length > 0) {
      issues.push({
        code: "MEMORIES_INCOMPLETE",
        severity: "info",
        field: "memories",
        message: `Missing memory document(s): ${missingMemories.join(", ")}.`,
      });
    }
    // A real contradiction only exists when two *canonical id* declarations
    // disagree — not when the technical id differs from the business code.
    const { summary: idSummary, metadata: idMetadata } = declaredCharacterIds;
    if (idSummary && idMetadata && normId(idSummary) !== normId(idMetadata)) {
      issues.push({
        code: "CHARACTER_ID_MISMATCH",
        severity: "warning",
        field: "characterId",
        message: `Conflicting character_id declarations in ${PERSONALITY_DOC}: core summary "${idSummary}" vs metadata "${idMetadata}".`,
      });
    }

    const pkg: CharacterPackage = {
      characterId,
      characterCode,
      directoryName,
      displayName: identity.name ?? displayNameOf(directoryName),
      sdkVersion: extractSdkVersion(identityMd),
      characterVersion,
      status,
      identity,
      appearance,
      personality,
      voice: { present: voicePresent, source: VOICE_CONFIG, config: voiceConfig },
      outfits,
      poses,
      expressions,
      identityReferences,
      memories,
      capabilities,
      limitations,
      dataQuality: issues,
      loadedAt: new Date().toISOString(),
    };

    const parsed = CharacterPackageSchema.safeParse(pkg);
    if (!parsed.success) {
      throw new CharacterPackageInvalidError(characterId, parsed.error.issues);
    }
    return parsed.data;
  }
}

function warn(code: string, field: string, message: string): DataQualityIssue {
  return { code, severity: "warning", field, message };
}

interface AssetStatus {
  valid: boolean;
  origin?: string;
  reason?: string;
}

/**
 * Read `assets/ASSET_STATUS.json` if present. It lets a package declare that its
 * image assets are invalid for this character (e.g. copied from another SDK and
 * not yet replaced), so the runtime never presents foreign assets as its own.
 */
function readAssetStatus(dir: string): AssetStatus | null {
  const raw = readText(path.join(dir, "assets", "ASSET_STATUS.json"));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed.valid === "boolean") {
      return {
        valid: parsed.valid,
        origin: typeof parsed.origin === "string" ? parsed.origin : undefined,
        reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
      };
    }
  } catch {
    /* malformed status file is ignored */
  }
  return null;
}

function normId(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}
