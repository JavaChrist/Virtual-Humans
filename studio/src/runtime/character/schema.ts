import { z } from "zod";

/**
 * Zod schemas and inferred types for a resolved character package.
 *
 * Markdown/JSON on disk is the source of truth; the structured representation
 * below is validated from it. Anything that fails validation is reported rather
 * than silently coerced.
 */

export const DataQualitySeverity = z.enum(["error", "warning", "info"]);
export type DataQualitySeverity = z.infer<typeof DataQualitySeverity>;

export const DataQualityIssueSchema = z.object({
  code: z.string(),
  severity: DataQualitySeverity,
  field: z.string(),
  message: z.string(),
});
export type DataQualityIssue = z.infer<typeof DataQualityIssueSchema>;

export const AssetItemSchema = z.object({
  category: z.enum(["identity", "expressions", "poses", "outfits"]),
  name: z.string(),
  relPath: z.string(),
});
export type AssetItem = z.infer<typeof AssetItemSchema>;

export const OutfitSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  clothing: z.record(z.string(), z.string()).optional(),
  style: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  bestFor: z.array(z.string()).optional(),
  lookPath: z.string(),
  thumbPath: z.string(),
});
export type Outfit = z.infer<typeof OutfitSchema>;

export const VoiceConfigSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  voiceId: z.string().optional(),
  voiceName: z.string().optional(),
  language: z.string().optional(),
  stability: z.number().nullable().optional(),
  similarityBoost: z.number().nullable().optional(),
  style: z.number().nullable().optional(),
  speakerBoost: z.boolean().nullable().optional(),
  speed: z.number().nullable().optional(),
});
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;

/** A qualitative→numeric level pair (e.g. "high" → 0.85). */
export const LevelSchema = z.object({
  raw: z.string().nullable(),
  value: z.number().min(0).max(1).nullable(),
});
export type Level = z.infer<typeof LevelSchema>;

export const PersonalityProfileSchema = z.object({
  source: z.string(),
  personalityVersion: z.string().nullable(),
  coreIdentitySentence: z.string().nullable(),
  levels: z.object({
    warmth: LevelSchema,
    energy: LevelSchema,
    formality: LevelSchema,
    humor: LevelSchema,
  }),
  coreTraits: z.array(z.string()),
  communicationStyle: z.array(z.string()),
  primaryTraits: z.array(z.string()),
  secondaryTraits: z.array(z.string()),
  prohibitedTraits: z.array(z.string()),
  greetings: z.array(z.string()),
  conclusions: z.array(z.string()),
  ctaPreferred: z.array(z.string()),
  ctaAvoided: z.array(z.string()),
  formOfAddress: z.string().nullable(),
  language: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});
export type PersonalityProfile = z.infer<typeof PersonalityProfileSchema>;

export const DocumentRefSchema = z.object({
  present: z.boolean(),
  source: z.string(),
  title: z.string().nullable(),
  sectionCount: z.number().int().nonnegative(),
});
export type DocumentRef = z.infer<typeof DocumentRefSchema>;

export const MemoryRefSchema = z.object({
  file: z.string(),
  title: z.string().nullable(),
  present: z.boolean(),
});
export type MemoryRef = z.infer<typeof MemoryRefSchema>;

export const IdentitySectionSchema = z.object({
  present: z.boolean(),
  source: z.string(),
  name: z.string().nullable(),
  role: z.string().nullable(),
  coreValues: z.array(z.string()),
  languages: z.object({
    primary: z.string().nullable(),
    secondary: z.string().nullable(),
  }),
});
export type IdentitySection = z.infer<typeof IdentitySectionSchema>;

export const CharacterPackageSchema = z.object({
  /**
   * Canonical technical id — stable, lowercase, URL/API/registry/persistence
   * safe (e.g. "mei"). Sourced from the character's declared id in the SDK data.
   */
  characterId: z.string(),
  /**
   * Human-readable, permanent business code of the character (e.g. "MEI-001").
   * Never used as a routing/registry key; purely a business label.
   */
  characterCode: z.string().nullable(),
  directoryName: z.string(),
  displayName: z.string(),
  sdkVersion: z.string().nullable(),
  characterVersion: z.string().nullable(),
  status: z.string().nullable(),
  identity: IdentitySectionSchema,
  appearance: DocumentRefSchema,
  personality: PersonalityProfileSchema,
  voice: z.object({
    present: z.boolean(),
    source: z.string(),
    config: VoiceConfigSchema.nullable(),
  }),
  outfits: z.array(OutfitSchema),
  poses: z.array(AssetItemSchema),
  expressions: z.array(AssetItemSchema),
  identityReferences: z.array(AssetItemSchema),
  memories: z.array(MemoryRefSchema),
  capabilities: DocumentRefSchema,
  limitations: DocumentRefSchema,
  dataQuality: z.array(DataQualityIssueSchema),
  loadedAt: z.string(),
});
export type CharacterPackage = z.infer<typeof CharacterPackageSchema>;

/** A registry-level uniqueness conflict between packages. */
export const RegistryConflictSchema = z.object({
  type: z.enum(["characterId", "characterCode"]),
  code: z.enum(["DUPLICATE_CHARACTER_ID", "DUPLICATE_CHARACTER_CODE"]),
  value: z.string(),
  packages: z.array(
    z.object({
      directoryName: z.string(),
      version: z.string().nullable(),
      characterId: z.string(),
      characterCode: z.string().nullable(),
    })
  ),
});
export type RegistryConflict = z.infer<typeof RegistryConflictSchema>;

/** Lightweight summary used by the character list endpoint. */
export const CharacterSummarySchema = z.object({
  characterId: z.string(),
  characterCode: z.string().nullable(),
  directoryName: z.string(),
  displayName: z.string(),
  sdkVersion: z.string().nullable(),
  status: z.string().nullable(),
  health: z.object({
    errors: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    infos: z.number().int().nonnegative(),
  }),
  /** Registry conflicts this package participates in (empty when unique). */
  conflicts: z.array(RegistryConflictSchema),
});
export type CharacterSummary = z.infer<typeof CharacterSummarySchema>;
