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
