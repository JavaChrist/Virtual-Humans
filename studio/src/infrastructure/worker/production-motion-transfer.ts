/**
 * MT-013K-WIRE — Production composition for Motion Transfer on the canonical worker.
 *
 * Path: createWorker → createProductionWorkerFromDeps → claimed-job-processor
 *        → createMotionTransferWorkerOrchestrator
 *
 * - No parallel worker / route / off-queue execution
 * - Fal adapter resolved lazily (never at module import)
 * - Fake transport forbidden on Vercel/Production
 * - Flags OFF ⇒ submit blocked; composition still wired (fail-closed)
 * - After submit persist: admission+submit OFF; poll retained
 */

import {
  MotionTransferDomainError,
  MOTION_TRANSFER_PROVIDER_PORT_VERSION,
  type MotionTransferCancelResult,
  type MotionTransferEstimate,
  type MotionTransferProviderCancelInput,
  type MotionTransferProviderContext,
  type MotionTransferProviderEstimateInput,
  type MotionTransferProviderPollInput,
  type MotionTransferProviderPort,
  type MotionTransferProviderSubmitInput,
  type MotionTransferStatus,
  type MotionTransferSubmission,
} from "@/domain/motion";
import { FAL_KLING_V3_PRO_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";
import {
  createMemoryMotionTransferAttemptStore,
  createMotionTransferWorkerOrchestrator,
  type MotionTransferAttemptStore,
  type MotionTransferWorkerProcessor,
} from "@/application/motion/motion-transfer-worker-orchestrator";
import {
  createMotionTransferLifecycleController,
  type MotionTransferLifecycleController,
} from "@/application/motion/motion-transfer-lifecycle-gates";
import type { MotionTransferWorkerEventSink } from "@/application/motion/motion-transfer-worker-events";
import type { BudgetReservationPort } from "@/application/production/ports";
import {
  assertProductionRegistryRemainsDisabled,
  MV001_BENCHMARK_ID,
} from "@/application/motion/mv001/mv001-benchmark-profile";
import {
  createMv001RegistryException,
  evaluateMv001RegistryException,
} from "@/application/motion/mv001/mv001-registry-exception";
import { resolveMv001PrivacyDecisions } from "@/application/motion/mv001/mv001-privacy-decisions";
import { parseStrictEnabledFlag } from "@/infrastructure/config/feature-flags";
import {
  FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  FAL_MOTION_TRANSFER_PROVIDER_ID,
} from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-adapter";
import { resolveFalKlingMotionControlAdapter } from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-resolver";
import type { FalMotionControlTransport } from "@/infrastructure/providers/motion-transfer/fal-motion-control-transport";
import type { MotionTransferPrivacyDecisions } from "@/infrastructure/providers/motion-transfer/privacy-gate";
import type { MotionTransferRegistryGateProfile } from "@/application/motion/motion-transfer-worker-gates";

export const PRODUCTION_MOTION_TRANSFER_COMPOSITION_VERSION =
  "mt013k-wire-1.0.0" as const;

/** Process-scoped attempt store — job.payload.externalJobId remains durable across instances. */
let processAttemptStore: MotionTransferAttemptStore | undefined;

export function getProductionMotionAttemptStore(): MotionTransferAttemptStore {
  if (!processAttemptStore) {
    processAttemptStore = createMemoryMotionTransferAttemptStore();
  }
  return processAttemptStore;
}

/** Test-only reset between unit cases. */
export function resetProductionMotionAttemptStoreForTests(): void {
  processAttemptStore = createMemoryMotionTransferAttemptStore();
}

function isVercelOrProduction(
  env: Record<string, string | undefined>,
): boolean {
  if (env.VERCEL === "1") return true;
  if (env.VERCEL_ENV && env.VERCEL_ENV.length > 0) return true;
  return (env.NODE_ENV ?? "").toLowerCase() === "production";
}

export function resolveProductionMotionRegistryProfile(input: {
  env: Record<string, string | undefined>;
  nowIso: string;
}): MotionTransferRegistryGateProfile {
  assertProductionRegistryRemainsDisabled();
  const exceptionActive = parseStrictEnabledFlag(
    input.env.MV001_REGISTRY_EXCEPTION_ACTIVE,
  );
  const benchmarkOk =
    (input.env.MV001_BENCHMARK_ID ?? MV001_BENCHMARK_ID) === MV001_BENCHMARK_ID;
  if (exceptionActive && benchmarkOk) {
    const exception = createMv001RegistryException({ exceptionActive: true });
    const evalResult = evaluateMv001RegistryException(exception, input.nowIso);
    if (evalResult.ok) {
      return {
        enabled: true,
        paidExecution: true,
        status: "available",
      };
    }
  }
  return {
    enabled: FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled,
    paidExecution: FAL_KLING_V3_PRO_REGISTRY_PROFILE.paidExecution,
    status: FAL_KLING_V3_PRO_REGISTRY_PROFILE.status,
  };
}

/**
 * Lazy fal provider — transport/FAL_KEY only resolved on first estimate/submit/poll.
 * Never reads FAL_KEY at module import or composition construction.
 */
export function createLazyFalMotionTransferProvider(options: {
  env: Record<string, string | undefined>;
  privacyDecisions?: Partial<MotionTransferPrivacyDecisions>;
  /**
   * TEST ONLY — inject fake/real transport. Forbidden when Vercel/Production + fake.
   */
  testTransport?: FalMotionControlTransport;
}): MotionTransferProviderPort {
  let cached: MotionTransferProviderPort | undefined;

  function resolve(mode: "submit" | "poll"): MotionTransferProviderPort {
    if (cached) return cached;
    if (
      options.testTransport?.kind === "fake" &&
      isVercelOrProduction(options.env)
    ) {
      throw new MotionTransferDomainError(
        "provider_not_configured",
        "Fake Motion Transfer transport interdit en Production.",
        { diagnostic: "fake_forbidden" },
      );
    }
    const result = resolveFalKlingMotionControlAdapter({
      env: options.env,
      privacyDecisions: options.privacyDecisions,
      transport: options.testTransport,
      // Submit requires full live gates; poll may continue after flag shutdown.
      requireLiveGates: mode === "submit",
    });
    if (!result.ok) {
      throw new MotionTransferDomainError(
        "provider_not_configured",
        "Adapter fal Kling motion-control indisponible.",
        { diagnostic: result.reason },
      );
    }
    cached = result.port;
    return cached;
  }

  return {
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    supportedModelIds: [FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID],
    portVersion: MOTION_TRANSFER_PROVIDER_PORT_VERSION,
    async estimate(
      input: MotionTransferProviderEstimateInput,
      context: MotionTransferProviderContext,
    ): Promise<MotionTransferEstimate> {
      return resolve("submit").estimate(input, context);
    },
    async submit(
      input: MotionTransferProviderSubmitInput,
      context: MotionTransferProviderContext,
    ): Promise<MotionTransferSubmission> {
      return resolve("submit").submit(input, context);
    },
    async poll(
      input: MotionTransferProviderPollInput,
      context: MotionTransferProviderContext,
    ): Promise<MotionTransferStatus> {
      return resolve("poll").poll(input, context);
    },
    async cancel(
      input: MotionTransferProviderCancelInput,
      context: MotionTransferProviderContext,
    ): Promise<MotionTransferCancelResult> {
      const port = resolve("poll");
      if (!port.cancel) {
        return {
          schemaVersion: "1.0.0",
          status: "cancel_unsupported",
          providerJobId: input.providerJobId,
          lateResultExpected: true,
        };
      }
      return port.cancel(input, context);
    },
  };
}

export type ProductionMotionTransferComposition = {
  schemaVersion: typeof PRODUCTION_MOTION_TRANSFER_COMPOSITION_VERSION;
  wired: true;
  motionTransfer: MotionTransferWorkerProcessor;
  lifecycle: MotionTransferLifecycleController;
  attempts: MotionTransferAttemptStore;
  registryProfile: MotionTransferRegistryGateProfile;
  privacyDecisions: Partial<MotionTransferPrivacyDecisions>;
  /** True when scoped MV-001 exception yields injectable registry profile. */
  mv001ExceptionActive: boolean;
};

export type CreateProductionMotionTransferCompositionInput = {
  budget: BudgetReservationPort;
  env?: Record<string, string | undefined>;
  nowIso?: () => string;
  attempts?: MotionTransferAttemptStore;
  lifecycle?: MotionTransferLifecycleController;
  events?: MotionTransferWorkerEventSink;
  privacyDecisions?: Partial<MotionTransferPrivacyDecisions>;
  /** TEST ONLY — never pass a fake transport under Vercel/Production. */
  testTransport?: FalMotionControlTransport;
};

/**
 * Build Production Motion Transfer processor for injection into createWorker.
 * Always returns a wired orchestrator when budget is present — gates fail-closed at submit.
 */
export function createProductionMotionTransferComposition(
  input: CreateProductionMotionTransferCompositionInput,
): ProductionMotionTransferComposition {
  const env =
    input.env ?? (process.env as Record<string, string | undefined>);
  const nowIso = input.nowIso ?? (() => new Date().toISOString());

  if (
    input.testTransport?.kind === "fake" &&
    isVercelOrProduction(env)
  ) {
    throw new MotionTransferDomainError(
      "provider_not_configured",
      "Fake Motion Transfer interdit dans la composition Production.",
      { diagnostic: "fake_forbidden" },
    );
  }

  const privacyDecisions =
    input.privacyDecisions ?? resolveMv001PrivacyDecisions(env, nowIso());
  const registryProfile = resolveProductionMotionRegistryProfile({
    env,
    nowIso: nowIso(),
  });
  const attempts = input.attempts ?? getProductionMotionAttemptStore();
  const lifecycle =
    input.lifecycle ?? createMotionTransferLifecycleController();

  const provider = createLazyFalMotionTransferProvider({
    env,
    privacyDecisions,
    testTransport: input.testTransport,
  });

  const allowedProjectIds = env.MV001_PROJECT_ID?.trim()
    ? [env.MV001_PROJECT_ID.trim()]
    : undefined;

  const motionTransfer = createMotionTransferWorkerOrchestrator({
    provider,
    budget: input.budget,
    attempts,
    registryProfile,
    privacyDecisions,
    env,
    events: input.events,
    lifecycle,
    allowedProjectIds,
  });

  return {
    schemaVersion: PRODUCTION_MOTION_TRANSFER_COMPOSITION_VERSION,
    wired: true,
    motionTransfer,
    lifecycle,
    attempts,
    registryProfile,
    privacyDecisions,
    mv001ExceptionActive:
      registryProfile.enabled === true &&
      registryProfile.paidExecution === true &&
      registryProfile.status === "available",
  };
}
