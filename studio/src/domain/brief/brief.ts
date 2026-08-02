import {
  createArtifactMetadata,
  type ArtifactMetadata,
} from "@/domain/shared";
import { BriefDomainError } from "./errors";

export const BRIEF_SCHEMA_VERSION = "1.0.0" as const;
export const BRIEF_DRAFT_VERSION = "1.0.0" as const;

export const SubjectTypeValues = ["product", "service", "brand", "event", "other"] as const;
export type SubjectType = (typeof SubjectTypeValues)[number];

export const ObjectiveValues = [
  "awareness",
  "traffic",
  "lead_generation",
  "conversion",
  "education",
  "engagement",
] as const;
export type BriefObjective = (typeof ObjectiveValues)[number];

export const PlatformValues = [
  "instagram",
  "tiktok",
  "linkedin",
  "facebook",
  "youtube_shorts",
] as const;
export type BriefPlatform = (typeof PlatformValues)[number];

export const DurationValues = [15, 20, 30, 60] as const;
export type BriefDurationSeconds = (typeof DurationValues)[number];

export const AspectRatioValues = ["9:16", "1:1", "16:9"] as const;
export type BriefAspectRatio = (typeof AspectRatioValues)[number];

export const ToneValues = [
  "warm",
  "professional",
  "energetic",
  "calm",
  "playful",
  "authoritative",
] as const;
export type Tone = (typeof ToneValues)[number];

export const MediaKindValues = [
  "product_screen",
  "logo",
  "reference_image",
  "other",
] as const;
export type BriefMediaKind = (typeof MediaKindValues)[number];

export type BriefMediaReference = {
  id: string;
  kind: BriefMediaKind;
  label: string;
  /** Non-binary reference (URL or asset path). Never a data URL / blob. */
  uri?: string;
};

/** Business fields only — no ArtifactMetadata. */
export type VideoProjectBriefFields = {
  projectName: string;
  subjectType: SubjectType;
  subjectName: string;
  subjectDescription: string;
  objective: BriefObjective;
  platform: BriefPlatform;
  durationSeconds: BriefDurationSeconds;
  aspectRatio: BriefAspectRatio;
  language: string;
  tone: Tone;
  characterId?: string;
  callToAction?: string;
  audienceDescription?: string;
  brandConstraints?: string;
  mediaReferences: BriefMediaReference[];
};

export type VideoProjectBrief = ArtifactMetadata & VideoProjectBriefFields;

export type VideoProjectBriefDraft = {
  draftVersion: string;
  updatedAt: string;
  currentStep: number;
  fields: Partial<VideoProjectBriefFields>;
};

export const FIELD_LIMITS = {
  projectName: 80,
  subjectName: 120,
  subjectDescription: 800,
  callToAction: 160,
  audienceDescription: 400,
  brandConstraints: 400,
  mediaLabel: 80,
  mediaUri: 500,
  mediaMax: 10,
} as const;

/** Suggested default aspect ratio per platform (user may override). */
export function defaultAspectRatioForPlatform(platform: BriefPlatform): BriefAspectRatio {
  switch (platform) {
    case "linkedin":
      return "16:9";
    case "facebook":
      return "1:1";
    case "instagram":
    case "tiktok":
    case "youtube_shorts":
    default:
      return "9:16";
  }
}

export function createEmptyBriefDraft(step = 0): VideoProjectBriefDraft {
  return {
    draftVersion: BRIEF_DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
    currentStep: step,
    fields: {
      language: "fr",
      mediaReferences: [],
    },
  };
}

function trimBounded(value: string, max: number, field: string): string {
  const t = value.trim().replace(/\s+/g, " ");
  if (!t) {
    throw new BriefDomainError("missing_field", `Le champ « ${field} » est requis.`, field);
  }
  if (t.length > max) {
    throw new BriefDomainError(
      "invalid_length",
      `Le champ « ${field} » dépasse ${max} caractères.`,
      field,
    );
  }
  return t;
}

function optionalTrimBounded(
  value: string | undefined,
  max: number,
  field: string,
): string | undefined {
  if (value == null || value.trim() === "") return undefined;
  const t = value.trim().replace(/\s+/g, " ");
  if (t.length > max) {
    throw new BriefDomainError(
      "invalid_length",
      `Le champ « ${field} » dépasse ${max} caractères.`,
      field,
    );
  }
  return t;
}

/** BCP-47-ish: language or language-region (e.g. fr, en, fr-FR). */
export function normalizeLanguage(raw: string): string {
  const t = raw.trim();
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(t)) {
    throw new BriefDomainError("invalid_language", "Code de langue invalide.", "language");
  }
  const [lang, region] = t.split("-");
  return region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase();
}

function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new BriefDomainError("invalid_brief", `Valeur invalide pour « ${field} ».`, field);
  }
  return value as T;
}

function normalizeMediaReferences(raw: unknown): BriefMediaReference[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new BriefDomainError("invalid_brief", "Références média invalides.", "mediaReferences");
  }
  if (raw.length > FIELD_LIMITS.mediaMax) {
    throw new BriefDomainError(
      "invalid_length",
      `Maximum ${FIELD_LIMITS.mediaMax} références média.`,
      "mediaReferences",
    );
  }
  return raw.map((item, i) => {
    if (!item || typeof item !== "object") {
      throw new BriefDomainError("invalid_brief", "Référence média invalide.", "mediaReferences");
    }
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `media_${i + 1}`;
    const kind = assertEnum(o.kind, MediaKindValues, "mediaReferences.kind");
    const label = trimBounded(String(o.label ?? ""), FIELD_LIMITS.mediaLabel, "mediaReferences.label");
    let uri: string | undefined;
    if (typeof o.uri === "string" && o.uri.trim()) {
      uri = o.uri.trim();
      if (uri.length > FIELD_LIMITS.mediaUri) {
        throw new BriefDomainError("invalid_length", "URI média trop longue.", "mediaReferences.uri");
      }
      if (/^data:/i.test(uri) || /^blob:/i.test(uri)) {
        throw new BriefDomainError(
          "invalid_brief",
          "Les médias binaires ne sont pas acceptés dans le brief.",
          "mediaReferences.uri",
        );
      }
    }
    const ref: BriefMediaReference = { id, kind, label };
    if (uri) ref.uri = uri;
    return ref;
  });
}

/**
 * Normalize and validate business fields from a partial draft.
 * Does not invent missing required values.
 */
export function normalizeBriefFields(fields: Partial<VideoProjectBriefFields>): VideoProjectBriefFields {
  const projectName = trimBounded(
    String(fields.projectName ?? ""),
    FIELD_LIMITS.projectName,
    "projectName",
  );
  const subjectType = assertEnum(fields.subjectType, SubjectTypeValues, "subjectType");
  const subjectName = trimBounded(
    String(fields.subjectName ?? ""),
    FIELD_LIMITS.subjectName,
    "subjectName",
  );
  const subjectDescription = trimBounded(
    String(fields.subjectDescription ?? ""),
    FIELD_LIMITS.subjectDescription,
    "subjectDescription",
  );
  const objective = assertEnum(fields.objective, ObjectiveValues, "objective");
  const platform = assertEnum(fields.platform, PlatformValues, "platform");
  const durationSeconds = fields.durationSeconds;
  if (
    typeof durationSeconds !== "number" ||
    !(DurationValues as readonly number[]).includes(durationSeconds)
  ) {
    throw new BriefDomainError("invalid_brief", "Durée non supportée.", "durationSeconds");
  }
  const aspectRatio = assertEnum(fields.aspectRatio, AspectRatioValues, "aspectRatio");
  const language = normalizeLanguage(String(fields.language ?? ""));
  const tone = assertEnum(fields.tone, ToneValues, "tone");

  let characterId: string | undefined;
  if (fields.characterId != null && String(fields.characterId).trim() !== "") {
    characterId = String(fields.characterId).trim();
    if (characterId.length > 128) {
      throw new BriefDomainError("invalid_length", "Identifiant personnage trop long.", "characterId");
    }
  }

  const callToAction = optionalTrimBounded(fields.callToAction, FIELD_LIMITS.callToAction, "callToAction");
  const audienceDescription = optionalTrimBounded(
    fields.audienceDescription,
    FIELD_LIMITS.audienceDescription,
    "audienceDescription",
  );
  const brandConstraints = optionalTrimBounded(
    fields.brandConstraints,
    FIELD_LIMITS.brandConstraints,
    "brandConstraints",
  );
  const mediaReferences = normalizeMediaReferences(fields.mediaReferences);

  const result: VideoProjectBriefFields = {
    projectName,
    subjectType,
    subjectName,
    subjectDescription,
    objective,
    platform,
    durationSeconds: durationSeconds as BriefDurationSeconds,
    aspectRatio,
    language,
    tone,
    mediaReferences,
  };
  if (characterId) result.characterId = characterId;
  if (callToAction) result.callToAction = callToAction;
  if (audienceDescription) result.audienceDescription = audienceDescription;
  if (brandConstraints) result.brandConstraints = brandConstraints;
  return result;
}

export type FinalizeBriefMetadata = {
  id: string;
  projectId: string;
  createdBy: string;
  correlationId: string;
  createdAt?: string;
  revision?: number;
};

/**
 * Finalize a draft into an immutable VideoProjectBrief artifact.
 * Does not mutate the draft.
 */
export function finalizeBrief(
  draft: VideoProjectBriefDraft,
  metadata: FinalizeBriefMetadata,
): VideoProjectBrief {
  // Shallow copy of fields to prove non-mutation of caller object
  const fieldsCopy = { ...draft.fields };
  if (draft.fields.mediaReferences) {
    fieldsCopy.mediaReferences = draft.fields.mediaReferences.map((m) => ({ ...m }));
  }

  const fields = normalizeBriefFields(fieldsCopy);
  const meta = createArtifactMetadata({
    id: metadata.id,
    projectId: metadata.projectId,
    createdBy: metadata.createdBy,
    correlationId: metadata.correlationId,
    createdAt: metadata.createdAt,
    revision: metadata.revision,
    schemaVersion: BRIEF_SCHEMA_VERSION,
  });

  return Object.freeze({
    ...meta,
    ...fields,
    mediaReferences: Object.freeze(fields.mediaReferences.map((m) => Object.freeze({ ...m }))),
  }) as VideoProjectBrief;
}

/** Guard: finalized brief must never carry provider/model/prompt keys. */
export function assertNoTechnicalLeak(brief: VideoProjectBrief): void {
  const json = JSON.stringify(brief);
  const forbidden = ["provider", "modelId", "fal-ai", "openai", "prompt", "temperature"];
  for (const key of forbidden) {
    if (json.toLowerCase().includes(key.toLowerCase())) {
      // Only fail on structural keys we might have accidentally added
    }
  }
  const record = brief as unknown as Record<string, unknown>;
  for (const bad of ["provider", "providerId", "modelId", "model", "prompt", "systemPrompt"]) {
    if (bad in record) {
      throw new BriefDomainError("invalid_brief", "Le brief ne doit pas contenir de paramètres techniques.");
    }
  }
}
