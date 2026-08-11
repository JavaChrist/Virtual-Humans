export {
  MOTION_DATA_CLASSIFICATION,
  MotionDataClassValues,
  isAllowedOnPublicEvent,
  isForbiddenInLogs,
  type MotionDataClass,
} from "./classification";

export {
  MOTION_SANITIZER_VERSION,
  REDACTED_MOTION,
  assertMotionSurfaceRedacted,
  sanitizeMotionString,
  sanitizeMotionValue,
  type SanitizeMotionOptions,
} from "./sanitize";

export {
  MOTION_PRIVACY_DECISION_CONTRACT_VERSION,
  MOTION_PRIVACY_LEGACY_KEY_MAP,
  assertMotionPrivacyDecisionsOpen,
  createSyntheticAcceptedPrivacyDecisions,
  evaluateMotionPrivacyDecisions,
  normalizePrivacyDecisionFlags,
  type MotionPrivacyDecisionKey,
  type MotionPrivacyDecisionRecord,
  type MotionPrivacyDecisionSet,
  type MotionPrivacyGateEvaluation,
} from "./privacy-decision";

export {
  MOTION_SECURITY_GATES_VERSION,
  evaluateMotionSecurityGates,
  type MotionSecurityGateCode,
  type MotionSecurityGateInput,
  type MotionSecurityGateResult,
} from "./gates";
