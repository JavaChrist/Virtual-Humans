export {
  BRIEF_DRAFT_VERSION,
  BRIEF_SCHEMA_VERSION,
  FIELD_LIMITS,
  AspectRatioValues,
  DurationValues,
  MediaKindValues,
  ObjectiveValues,
  PlatformValues,
  SubjectTypeValues,
  ToneValues,
  assertNoTechnicalLeak,
  createEmptyBriefDraft,
  defaultAspectRatioForPlatform,
  finalizeBrief,
  normalizeBriefFields,
  normalizeLanguage,
  type BriefAspectRatio,
  type BriefDurationSeconds,
  type BriefMediaKind,
  type BriefMediaReference,
  type BriefObjective,
  type BriefPlatform,
  type FinalizeBriefMetadata,
  type SubjectType,
  type Tone,
  type VideoProjectBrief,
  type VideoProjectBriefDraft,
  type VideoProjectBriefFields,
} from "./brief";

export { BriefDomainError, isBriefDomainError, type BriefErrorCode } from "./errors";

export {
  BriefMediaReferenceSchema,
  VideoProjectBriefDraftSchema,
  VideoProjectBriefFieldsSchema,
  VideoProjectBriefSchema,
} from "./schemas";
