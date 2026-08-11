export {
  STORYBOARD_FIELD_LIMITS,
  STORYBOARD_PROJECT_SCHEMA_VERSION,
  RECOMMENDED_SCENE_RANGES,
  type StoryboardAnalysisCandidate,
  type StoryboardAssumption,
  type StoryboardContinuityReport,
  type StoryboardEvidence,
  type StoryboardProject,
  type StoryboardProjectFields,
  type StoryboardRationale,
} from "./storyboard-project";

export {
  SCRIPT_PURPOSE_TO_SCENE,
  ScenePurposeValues,
  ProductionIntentValues,
  SceneReferenceKindValues,
  type ScenePurpose,
  type ProductionIntent,
  type SceneReferenceKind,
  type SceneSpokenContent,
  type SceneReference,
  type StoryboardScene,
} from "./scene";

export {
  TransitionTypeValues,
  TRANSITION_DURATION_MAX_SECONDS,
  defaultTransitionForScene,
  type TransitionType,
  type StoryboardTransition,
} from "./transitions";

export {
  STORYBOARD_TIMING_PRECISION,
  MIN_SCENE_DURATION_SECONDS,
  allocateStoryboardDurations,
  assessRecommendedSceneCount,
  estimateSceneSpokenMinimum,
  spokenWordCount,
  type StoryboardSceneTiming,
  type StoryboardTimingReport,
  type StoryboardTimingWarning,
  type SceneTimingInput,
} from "./timing";

export {
  normalizeSpokenText,
  reconstructSpokenFromScenes,
  validateSceneCoverage,
  validateSpokenReconstruction,
} from "./coverage";

export {
  defaultContinuityKeys,
  projectContinuity,
  mandatoryContinuityKeysByVisualSegmentId,
  requiredContinuityKeysByVisualSegmentId,
  fingerprintMandatoryContinuityMap,
  inventoryRequiredContinuity,
  type MandatoryContinuityInventory,
  type RequiredContinuityInventory,
} from "./continuity";

export {
  StoryboardDomainError,
  isStoryboardDomainError,
  type StoryboardErrorCode,
  type StoryboardValidationIssue,
  type StoryboardWarning,
  type MissingInformation,
} from "./errors";

export {
  SceneSpokenContentSchema,
  SceneReferenceSchema,
  StoryboardTransitionSchema,
  StoryboardSceneSchema,
  StoryboardTimingReportSchema,
  StoryboardContinuityReportSchema,
  StoryboardAssumptionSchema,
  StoryboardEvidenceSchema,
  StoryboardRationaleSchema,
  StoryboardProjectSchema,
  StoryboardAnalysisCandidateSchema,
} from "./schemas";

export { normalizeStoryboardCandidate } from "./normalization";

export {
  assertNoTechnicalLeak,
  detectResponsibilityLeaks,
  rebuildStoryboardEvidence,
  validateCandidateAgainstSources,
  validateConservation,
  validateReferences,
} from "./validation";

export {
  assessStoryboardReadiness,
  type StoryboardReadinessCheck,
  type StoryboardReadinessCheckCode,
} from "./readiness";

export {
  finalizeStoryboardProject,
  type FinalizeStoryboardInput,
} from "./finalize";

export {
  buildStoryboardRationale,
  toStoryboardProjectViewModel,
  type StoryboardProjectViewModel,
} from "./explanation";

export {
  HISTORICAL_SHOT_REUSABLE_CONCEPTS,
  HISTORICAL_SHOT_INCOMPATIBLE_FIELDS,
  STORYBOARD_EXTRACTION_STRATEGY,
} from "./historical-mapping";
