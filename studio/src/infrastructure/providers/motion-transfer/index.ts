export {
  assertMotionTransferFakeAdapterAllowed,
  type MotionTransferFakeAllowed,
} from "./assert-fake-allowed";

export {
  FAKE_MOTION_TRANSFER_MODEL_ID,
  FAKE_MOTION_TRANSFER_PROVIDER_ID,
  createFakeMotionTransferAdapter,
  createFakeMotionTransferProvider,
  type FakeMotionTransferAdapterOptions,
  type FakeMotionTransferScenario,
} from "./fake-adapter";

export { runMotionTransferProviderContractSuite } from "./contract-suite";

export {
  FAL_KLING_CONTRACT_SUITE_FEASIBILITY,
  FAL_KLING_ERROR_MAP,
  FAL_KLING_MOTION_CONTROL_SPIKE_VERSION,
  FAL_KLING_MOTION_CONTROL_USD_PER_SECOND,
  FAL_KLING_V26_PRO_MOTION_CONTROL_ENDPOINT,
  FAL_KLING_V26_STANDARD_MOTION_CONTROL_ENDPOINT,
  FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
  FAL_KLING_V3_STANDARD_MOTION_CONTROL_ENDPOINT,
  VHS_FAL_FALSE_POSITIVE_VIDEO_ENDPOINTS,
  assertNotI2vFalsePositive,
  buildFalKlingV3ProRequestPlan,
  estimateFalKlingIndicativeCostMinor,
  isFalKlingMotionControlEndpoint,
  mapFalQueueStatusToMotionJobStatus,
  type ContractSuiteFeasibility,
  type FalKlingCharacterOrientation,
  type FalKlingMotionControlRequestPlan,
} from "./fal-kling-motion-control-mapping";

export {
  FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION,
  FAL_KLING_MOTION_CONTROL_CONTRACT_VERSION,
  FAL_KLING_MOTION_CONTROL_PRICING_VERSION,
  FAL_KLING_V3_PRO_DECI_CENTS_PER_SECOND,
  FAL_KLING_V3_PRO_MAX_DURATION_IMAGE_SECONDS,
  FAL_KLING_V3_PRO_MAX_DURATION_VIDEO_SECONDS,
  FAL_KLING_V3_PRO_MIN_DURATION_SECONDS,
  FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  FAL_MOTION_TRANSFER_PROVIDER_ID,
  assertFalKlingDurationAllowed,
  buildFalKlingV3ProSubmitInput,
  computeFalKlingV3ProCostMinor,
  computeFalKlingV3ProCostMinorUnchecked,
  createFalKlingMotionControlAdapter,
  mapFalTransportErrorToEvidence,
  resolveFalKlingCharacterOrientation,
  type FalKlingMotionControlAdapterOptions,
} from "./fal-kling-motion-control-adapter";

export {
  createFakeFalMotionControlTransport,
  type FalMotionControlStatusResponse,
  type FalMotionControlSubmitRequest,
  type FalMotionControlSubmitResponse,
  type FalMotionControlTransport,
  type FakeFalMotionControlTransportOptions,
} from "./fal-motion-control-transport";

export {
  createFalSdkMotionControlTransport,
  type CreateFalSdkMotionControlTransportOptions,
} from "./fal-sdk-motion-control-transport";

export {
  requireFalKlingMotionControlAdapter,
  resolveFalKlingMotionControlAdapter,
  type ResolveFalKlingMotionControlOptions,
  type ResolveFalKlingMotionControlResult,
} from "./fal-kling-motion-control-resolver";

export {
  canResolveFalMotionTransferAdapter,
  getMotionTransferFlags,
  isMotionTransferEnabled,
  isMotionTransferFalEnabled,
  isMotionTransferPaidEnabled,
  isMotionTransferWorkerEnabled,
  type MotionTransferFlagName,
  type MotionTransferFlagsSnapshot,
} from "./motion-transfer-flags";

export {
  DEFAULT_MOTION_TRANSFER_PRIVACY_DECISIONS,
  MOTION_TRANSFER_PRIVACY_GATE_VERSION,
  assertMotionTransferPrivacyGateOpen,
  evaluateMotionTransferPrivacyGate,
  isMotionTransferPrivacyGateBlocked,
  type MotionTransferPrivacyDecisions,
  type MotionTransferPrivacyGateEvaluation,
  type MotionTransferPrivacyGateStatus,
} from "./privacy-gate";
