export {
  SCRIPT_FIELD_LIMITS,
  ScriptSegmentPurposeValues,
  ScriptSpeakerValues,
  VIDEO_SCRIPT_SCHEMA_VERSION,
  type PronunciationNote,
  type ScriptAnalysisCandidate,
  type ScriptAssumption,
  type ScriptCallToAction,
  type ScriptEvidence,
  type ScriptHook,
  type ScriptRationale,
  type ScriptRationaleDecision,
  type ScriptSegment,
  type ScriptSegmentPurpose,
  type ScriptSpeaker,
  type ScriptTimingReport,
  type SegmentTiming,
  type VideoScript,
  type VideoScriptFields,
} from "./video-script";

export {
  ScriptDomainError,
  isScriptDomainError,
  type MissingInformation,
  type ScriptErrorCode,
  type ScriptValidationIssue,
  type ScriptWarning,
} from "./errors";

export {
  DEFAULT_DURATION_TOLERANCE,
  SPEECH_TIMING_ENGINE_VERSION,
  SPEECH_TIMING_PROFILES,
  calculateScriptTiming,
  countWords,
  estimateScreenTextDuration,
  estimateSpokenDuration,
  normalizeLanguageTag,
  resolveSpeechTimingProfile,
  roundSeconds,
  validateTargetDuration,
  type BreathingMargin,
  type DurationTolerance,
  type SpeechTimingProfile,
} from "./timing";

export {
  PronunciationNoteSchema,
  ScriptAnalysisCandidateSchema,
  ScriptAssumptionSchema,
  ScriptCallToActionSchema,
  ScriptEvidenceSchema,
  ScriptHookSchema,
  ScriptRationaleSchema,
  ScriptSegmentSchema,
  ScriptTimingReportSchema,
  VideoScriptFieldsSchema,
  VideoScriptSchema,
} from "./schemas";

export {
  cleanBoundedText,
  extractCtaActionTokens,
  foldText,
  normalizeScriptCandidate,
  normalizeSegment,
} from "./normalization";

export {
  assertNoTechnicalLeak,
  detectResponsibilityLeaks,
  isCtaActionPreserved,
  rebuildScriptEvidence,
  validateCandidateAgainstSources,
  validateConservation,
  validateSegmentStructure,
} from "./validation";

export {
  assessScriptReadiness,
  type ScriptReadinessCheck,
  type ScriptReadinessCheckCode,
} from "./readiness";

export { finalizeVideoScript, type FinalizeVideoScriptInput } from "./finalize";

export {
  buildScriptRationale,
  toVideoScriptViewModel,
  type VideoScriptViewModel,
} from "./explanation";
