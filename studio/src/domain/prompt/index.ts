export {
  SCENE_PACKAGE_SCHEMA_VERSION,
  SCENE_PACKAGE_ARTIFACT_TYPE,
  SCENE_PACKAGE_SET_SCHEMA_VERSION,
  SCENE_PACKAGE_SET_ARTIFACT_TYPE,
  PROMPT_RENDERER_VERSION,
  PROMPT_FIELD_LIMITS,
  type ScenePackage,
  type ScenePackageFields,
  type ScenePackageSet,
  type ScenePackageSetFields,
  type PromptVariant,
  type PromptAssumption,
  type PromptEvidence,
  type PromptRationale,
  type PromptDirectorOutput,
  type PromptAnalysisCandidate,
} from "./scene-package";

export {
  PromptBlockNameValues,
  type PromptBlockName,
  type SubjectBlock,
  type ActionBlock,
  type EnvironmentBlock,
  type CameraBlock,
  type LightingBlock,
  type StyleBlock,
  type CompositionBlock,
  type DialogueBlock,
  type AudioBlock,
  type ScreenTextBlock,
} from "./blocks";

export {
  CapabilityProfileValues,
  MediaTypeValues,
  profilesForProductionIntent,
  assertProfilesVendorAgnostic,
  type CapabilityProfile,
  type MediaType,
  type ProfileSpec,
} from "./capability-profiles";

export {
  dedupeConstraints,
  findConstraintContradictions,
  type PromptConstraint,
  type ConstraintBlock,
  type PromptConstraintSource,
} from "./constraints";

export { mapStoryboardReferences, type PromptReference } from "./references";

export {
  delimitUntrustedData,
  scanUntrustedText,
  findingsToIssues,
  type InjectionFinding,
} from "./injection-safety";

export {
  renderPromptVariant,
  renderAllVariants,
  type RenderableBlocks,
} from "./rendering";

export { buildBlocksForScene, buildSubject, buildAction } from "./builders";
export {
  deriveTextMotionVisualSubject,
  deriveTextMotionVisualAction,
  overlayForbiddenCopyFromScene,
  PHASE_11A_SCENE2_FUNCTIONAL_VISUAL_SUBJECT,
  PHASE_11A_SCENE2_FUNCTIONAL_VISUAL_ACTION,
} from "./visual-subject";

export {
  PromptDomainError,
  isPromptDomainError,
  type PromptErrorCode,
  type PromptValidationIssue,
  type PromptWarning,
  type MissingInformation,
} from "./errors";

export {
  SubjectBlockSchema,
  ActionBlockSchema,
  DialogueBlockSchema,
  ConstraintBlockSchema,
  PromptReferenceSchema,
  PromptVariantSchema,
  ScenePackageSchema,
  ScenePackageSetSchema,
  PromptAnalysisCandidateSchema,
} from "./schemas";

export { normalizePromptCandidate } from "./normalization";

export {
  assertNoTechnicalLeak,
  scanChainForInjection,
  validatePackageCoverage,
  validateFidelity,
  validateCandidateAgainstSources,
} from "./validation";

export {
  assessPromptReadiness,
  type PromptReadinessCheck,
  type PromptReadinessCheckCode,
} from "./readiness";

export {
  finalizePromptPackages,
  type FinalizePromptPackagesInput,
} from "./finalize";
