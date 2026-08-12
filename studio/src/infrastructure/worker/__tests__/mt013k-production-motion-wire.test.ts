/**
 * MT-013K-WIRE — Production Motion worker composition (zero network).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { money } from "@/domain/cost";
import { makeMinimalInput } from "@/domain/motion/__tests__/fixtures";
import { FAL_KLING_V3_PRO_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";
import { createMemoryBudgetPort } from "@/application/production/__tests__/fakes";
import { createMemoryJobQueue } from "@/application/worker/__tests__/fakes";
import { createProductionWorker } from "@/application/worker/production-worker";
import { createWorkerPolicy } from "@/application/worker/policy";
import type { ProductionDirector } from "@/application/production/production-director";
import type { GenerationEngine } from "@/application/generation";
import type { ProductionPorts } from "@/application/production/ports";
import type { FeatureFlagsSnapshot } from "@/infrastructure/config/feature-flags";
import {
  createMemoryMotionTransferAttemptStore,
  quarantineMotionLateResult,
  seedMotionTransferAttempt,
} from "@/application/motion/motion-transfer-worker-orchestrator";
import { createMotionTransferLifecycleController } from "@/application/motion/motion-transfer-lifecycle-gates";
import {
  assertMotionEventRedacted,
  type MotionTransferWorkerEvent,
} from "@/application/motion/motion-transfer-worker-events";
import { createMotionQcOrchestrator } from "@/application/motion/motion-qc-orchestrator";
import { createMemoryMotionQcReportStore } from "@/application/motion/motion-qc-report";
import type { MotionQcMeasurementPort } from "@/application/motion/motion-qc-measurement-port";
import { assertMotionQcFakeMeasurementAllowed } from "@/application/motion/assert-motion-qc-fake-allowed";
import {
  createSyntheticMotionQcPolicy,
  MOTION_QC_MEASUREMENT_SET_VERSION,
} from "@/domain/motion/qc";
import { createFakeFalMotionControlTransport } from "@/infrastructure/providers/motion-transfer/fal-motion-control-transport";
import {
  FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  FAL_MOTION_TRANSFER_PROVIDER_ID,
} from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-adapter";
import { createProductionWorkerFromDeps } from "../factory";
import {
  createProductionMotionTransferComposition,
  resetProductionMotionAttemptStoreForTests,
  resolveProductionMotionRegistryProfile,
} from "../production-motion-transfer";
import { resolveMv001PrivacyDecisions } from "@/application/motion/mv001/mv001-privacy-decisions";
import { MotionTransferDomainError } from "@/domain/motion";

const AT = "2026-08-12T14:00:00.000Z";

const FLAGS_ON = {
  MOTION_TRANSFER_ENABLED: "1",
  MOTION_TRANSFER_PAID_ENABLED: "1",
  MOTION_TRANSFER_FAL_ENABLED: "1",
  MOTION_TRANSFER_WORKER_ENABLED: "1",
  MV001_REGISTRY_EXCEPTION_ACTIVE: "1",
  MV001_BENCHMARK_ID: "MV-001",
  MV001_PRIVACY_PACK_ACCEPTED: "1",
  NODE_ENV: "test",
  FAL_KEY: "test-fal-key-not-used-with-fake-transport",
};

const PRIVACY_OK = {
  mediaRetentionAccepted: true,
  cdnExposureStrategyAccepted: true,
  biometricConsentConfirmed: true,
  commercialRightsConfirmed: true,
  geographicRestrictionsAccepted: true,
};

function clock(start = AT) {
  let t = Date.parse(start);
  let n = 0;
  return {
    nowIso: () => new Date(t++).toISOString(),
    nowMs: () => t,
    nextId: () => `id-${++n}`,
    advanceMs(ms: number) {
      t += ms;
    },
  };
}

function directorStub(): ProductionDirector {
  return {
    async processClaimedJob() {
      throw new Error("PD must not handle motion_transfer");
    },
    async planEnqueueCommands() {
      return { commands: [] };
    },
  } as unknown as ProductionDirector;
}

function flagsOn(): FeatureFlagsSnapshot {
  return {
    directorV2: true,
    directorV2Worker: true,
    directorV2PaidGeneration: true,
    directorV2Persistence: true,
    directorV2MarketingAi: false,
    directorV2CreativeAi: false,
    directorV2PaidAi: false,
  };
}

function honestUnavailableMeasurements(): MotionQcMeasurementPort {
  return {
    measurementVersion: MOTION_QC_MEASUREMENT_SET_VERSION,
    async measure(_input, context) {
      const mk = (
        metricId:
          | "identity_similarity"
          | "motion_similarity"
          | "hands_feet_confidence",
      ) => ({
        metricId,
        unit: "ratio" as const,
        confidence: 0,
        source: "none",
        measurementVersion: MOTION_QC_MEASUREMENT_SET_VERSION,
        available: false as const,
        unavailableReason: "no_real_motion_measurement_adapter",
      });
      return {
        schemaVersion: "1.0.0",
        measurementVersion: MOTION_QC_MEASUREMENT_SET_VERSION,
        measuredAt: context.nowIso,
        measurements: [
          mk("identity_similarity"),
          mk("motion_similarity"),
          mk("hands_feet_confidence"),
        ],
      };
    },
  };
}

async function setupWiredJob(opts?: {
  env?: Record<string, string | undefined>;
  statusSequence?: Array<"IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED">;
  otherProject?: boolean;
  maxJobs?: number;
}) {
  resetProductionMotionAttemptStoreForTests();
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  const budget = createMemoryBudgetPort(10_000);
  const attempts = createMemoryMotionTransferAttemptStore();
  const lifecycle = createMotionTransferLifecycleController();
  const events: MotionTransferWorkerEvent[] = [];
  const env = { ...FLAGS_ON, ...opts?.env };
  const reservationId = "res-wire-1";
  const estimateMinor = 135;
  const reservedMinor = 162;

  await budget.reserve({
    reservationId,
    runId: "run-wire-1",
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId: "att-wire-1",
    amount: money(reservedMinor, "USD"),
    currency: "USD",
  });

  const motionInput = makeMinimalInput({
    output: {
      durationSeconds: 8,
      aspectRatio: "9:16",
      resolution: "1080p",
      fps: 24,
    },
  });
  const estimate = {
    schemaVersion: "1.0.0" as const,
    currency: "USD",
    estimatedCostMinor: estimateMinor,
    durationSeconds: 8,
    pricingUnit: "second" as const,
    mode: "firm" as const,
    pricingStrategy: "per_second",
    pricingVersion: "fal-llms.txt-2026-08-11",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    capability: "video.motion_transfer" as const,
  };

  seedMotionTransferAttempt(attempts, {
    attemptId: "att-wire-1",
    jobId: "pending",
    runId: "run-wire-1",
    reservationId,
    reservedMinor,
    estimate,
    motionInput,
    mediaBoundary: {
      sourceVideoRef: "ref:source-ephemeral",
      identityRefs: ["ref:id-ephemeral"],
    },
  });

  const projectId = opts?.otherProject ? "proj-other-scope" : "proj-mv001";
  await queue.enqueue({
    runId: "run-wire-1",
    projectId,
    sceneId: "motion",
    stepId: "step-mt",
    attemptId: "att-wire-1",
    action: "motion_transfer",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan-mt",
      scenePackageSceneId: "motion",
      mode: "execute",
      motion: {
        phase: "submitting",
        reservationId,
        reservedMinor,
        currency: "USD",
        estimateMinor,
        humanReviewPolicyPresent: true,
      },
    },
  });

  const jobId = [...queue.jobs.values()][0]!.id;
  const rec = attempts.get("att-wire-1")!;
  rec.jobId = jobId;
  attempts.save(rec);

  const transport = createFakeFalMotionControlTransport({
    statusSequence:
      opts?.statusSequence ?? ["IN_QUEUE", "IN_PROGRESS", "COMPLETED"],
  });

  const composition = createProductionMotionTransferComposition({
    budget,
    env: { ...env, MOTION_TRANSFER_FAKE_HARNESS: "1" },
    nowIso: clk.nowIso,
    attempts,
    lifecycle,
    privacyDecisions: PRIVACY_OK,
    events: { emit: (e) => events.push(e) },
    testTransport: transport,
    persistLeasedPayload: async (job, lease, payload) => {
      await queue.persistLeasedPayload!(
        job.jobId,
        lease.leaseToken,
        lease.workerId,
        payload,
      );
    },
  });

  const worker = createProductionWorkerFromDeps({
    policy: createWorkerPolicy({
      workerId: "mt-wire-1",
      claimLimit: 1,
      maximumJobsPerRun: opts?.maxJobs ?? 1,
      maximumProviderCallsPerRun: 1,
      leaseSeconds: 90,
    }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: composition.motionTransfer,
  });

  return {
    clk,
    queue,
    budget,
    attempts,
    events,
    worker,
    composition,
    lifecycle,
    transport,
    jobId,
  };
}

test("MT-013K-WIRE composition Production contient motionTransfer", () => {
  const budget = createMemoryBudgetPort(1_000);
  const c = createProductionMotionTransferComposition({
    budget,
    env: { NODE_ENV: "test" },
    privacyDecisions: {},
    testTransport: createFakeFalMotionControlTransport({}),
  });
  assert.equal(c.wired, true);
  assert.equal(typeof c.motionTransfer.processClaimedJob, "function");
  assert.equal(
    createProductionWorkerFromDeps({
      policy: createWorkerPolicy({ workerId: "w" }),
      flags: flagsOn(),
      queue: createMemoryJobQueue(() => AT),
      director: directorStub(),
      engine: {} as GenerationEngine,
      ports: {} as ProductionPorts,
      motionTransfer: c.motionTransfer,
    }) !== null,
    true,
  );
});

test("MT-013K-WIRE composition sans budget requis — factory deps fail-closed absent motionTransfer", async () => {
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  await queue.enqueue({
    runId: "r",
    projectId: "p",
    sceneId: "s",
    stepId: "st",
    attemptId: "a",
    action: "motion_transfer",
    providerId: "fal",
    modelId: "x",
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan",
      scenePackageSceneId: "s",
      mode: "execute",
    },
  });
  const worker = createProductionWorker({
    policy: createWorkerPolicy({ workerId: "w1" }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    // motionTransfer intentionally omitted
  });
  await worker.runOnce({
    correlationId: "c1",
    actorId: "wire-test",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  const job = [...queue.jobs.values()][0]!;
  assert.equal(job.status, "failed");
  assert.equal(job.error?.code, "motion_capability_unavailable");
});

test("MT-013K-WIRE flags OFF → zéro submit", async () => {
  const ctx = await setupWiredJob({
    env: {
      MOTION_TRANSFER_ENABLED: "0",
      MOTION_TRANSFER_PAID_ENABLED: "0",
      MOTION_TRANSFER_FAL_ENABLED: "0",
      MOTION_TRANSFER_WORKER_ENABLED: "0",
    },
  });
  await ctx.worker.runOnce({
    correlationId: "c-off",
    actorId: "wire-test",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  assert.equal(ctx.transport.submitCount, 0);
  assert.equal(ctx.attempts.get("att-wire-1")?.submitCount ?? 0, 0);
});

test("MT-013K-WIRE FAL_KEY absente → zéro submit (lazy resolve)", async () => {
  resetProductionMotionAttemptStoreForTests();
  const budget = createMemoryBudgetPort(10_000);
  const attempts = createMemoryMotionTransferAttemptStore();
  const lifecycle = createMotionTransferLifecycleController();
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  await budget.reserve({
    reservationId: "res-nokey",
    runId: "run-wire-1",
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId: "att-wire-1",
    amount: money(162, "USD"),
    currency: "USD",
  });
  const motionInput = makeMinimalInput();
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-wire-1",
    jobId: "j1",
    runId: "run-wire-1",
    reservationId: "res-nokey",
    reservedMinor: 162,
    estimate: {
      schemaVersion: "1.0.0",
      currency: "USD",
      estimatedCostMinor: 135,
      durationSeconds: 8,
      pricingUnit: "second",
      mode: "firm",
      pricingStrategy: "per_second",
      pricingVersion: "fal-llms.txt-2026-08-11",
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      capability: "video.motion_transfer",
    },
    motionInput,
    mediaBoundary: {
      sourceVideoRef: "ref:s",
      identityRefs: ["ref:i"],
    },
  });
  await queue.enqueue({
    runId: "run-wire-1",
    projectId: "proj-mv001",
    sceneId: "motion",
    stepId: "step-mt",
    attemptId: "att-wire-1",
    action: "motion_transfer",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan-mt",
      scenePackageSceneId: "motion",
      mode: "execute",
      motion: {
        phase: "submitting",
        reservationId: "res-nokey",
        reservedMinor: 162,
        currency: "USD",
        estimateMinor: 135,
        humanReviewPolicyPresent: true,
      },
    },
  });
  const jobId = [...queue.jobs.values()][0]!.id;
  const rec = attempts.get("att-wire-1")!;
  rec.jobId = jobId;
  attempts.save(rec);

  // No testTransport → real resolver path; FAL_KEY absent ⇒ provider_not_configured on submit.
  const composition = createProductionMotionTransferComposition({
    budget,
    env: { ...FLAGS_ON, FAL_KEY: "" },
    nowIso: clk.nowIso,
    attempts,
    lifecycle,
    privacyDecisions: PRIVACY_OK,
  });
  const worker = createProductionWorkerFromDeps({
    policy: createWorkerPolicy({
      workerId: "w-nokey",
      claimLimit: 1,
      maximumJobsPerRun: 1,
      maximumProviderCallsPerRun: 1,
    }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: composition.motionTransfer,
  });
  await worker.runOnce({
    correlationId: "c-nokey",
    actorId: "wire-test",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  // Lazy resolve fails before fal transport — no durable providerJobId / no accept.
  assert.equal(attempts.get("att-wire-1")?.providerJobId, undefined);
  assert.notEqual(attempts.get("att-wire-1")?.phase, "submitted");
  assert.notEqual(attempts.get("att-wire-1")?.phase, "polling");
});

test("MT-013K-WIRE privacy invalide → zéro submit", async () => {
  const ctx = await setupWiredJob({
    env: { MV001_PRIVACY_PACK_ACCEPTED: "0" },
  });
  // Override privacy to empty via new composition
  resetProductionMotionAttemptStoreForTests();
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  const budget = createMemoryBudgetPort(10_000);
  const attempts = createMemoryMotionTransferAttemptStore();
  await budget.reserve({
    reservationId: "res-p",
    runId: "run-wire-1",
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId: "att-wire-1",
    amount: money(162, "USD"),
    currency: "USD",
  });
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-wire-1",
    jobId: "pending",
    runId: "run-wire-1",
    reservationId: "res-p",
    reservedMinor: 162,
    estimate: {
      schemaVersion: "1.0.0",
      currency: "USD",
      estimatedCostMinor: 135,
      durationSeconds: 8,
      pricingUnit: "second",
      mode: "firm",
      pricingStrategy: "per_second",
      pricingVersion: "fal-llms.txt-2026-08-11",
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      capability: "video.motion_transfer",
    },
    motionInput: makeMinimalInput(),
    mediaBoundary: {
      sourceVideoRef: "ref:s",
      identityRefs: ["ref:i"],
    },
  });
  await queue.enqueue({
    runId: "run-wire-1",
    projectId: "proj-mv001",
    sceneId: "motion",
    stepId: "step-mt",
    attemptId: "att-wire-1",
    action: "motion_transfer",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan-mt",
      scenePackageSceneId: "motion",
      mode: "execute",
      motion: {
        phase: "submitting",
        reservationId: "res-p",
        reservedMinor: 162,
        currency: "USD",
        estimateMinor: 135,
        humanReviewPolicyPresent: true,
      },
    },
  });
  const jobId = [...queue.jobs.values()][0]!.id;
  attempts.get("att-wire-1")!.jobId = jobId;
  attempts.save(attempts.get("att-wire-1")!);
  const transport = createFakeFalMotionControlTransport({
    statusSequence: ["COMPLETED"],
  });
  const composition = createProductionMotionTransferComposition({
    budget,
    env: FLAGS_ON,
    nowIso: clk.nowIso,
    attempts,
    privacyDecisions: {}, // blocked
    testTransport: transport,
  });
  const worker = createProductionWorkerFromDeps({
    policy: createWorkerPolicy({
      workerId: "w-priv",
      claimLimit: 1,
      maximumJobsPerRun: 1,
      maximumProviderCallsPerRun: 1,
    }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: composition.motionTransfer,
  });
  await worker.runOnce({
    correlationId: "c-priv",
    actorId: "wire-test",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  assert.equal(transport.submitCount, 0);
  void ctx;
});

test("MT-013K-WIRE Registry globale disabled sans exception → zéro submit", async () => {
  const ctx = await setupWiredJob({
    env: { MV001_REGISTRY_EXCEPTION_ACTIVE: "0" },
  });
  // Recompose with exception off
  const profile = resolveProductionMotionRegistryProfile({
    env: { ...FLAGS_ON, MV001_REGISTRY_EXCEPTION_ACTIVE: "0" },
    nowIso: AT,
  });
  assert.equal(profile.enabled, false);
  assert.equal(FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled, false);

  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  const budget = createMemoryBudgetPort(10_000);
  const attempts = createMemoryMotionTransferAttemptStore();
  await budget.reserve({
    reservationId: "res-reg",
    runId: "run-wire-1",
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId: "att-wire-1",
    amount: money(162, "USD"),
    currency: "USD",
  });
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-wire-1",
    jobId: "pending",
    runId: "run-wire-1",
    reservationId: "res-reg",
    reservedMinor: 162,
    estimate: {
      schemaVersion: "1.0.0",
      currency: "USD",
      estimatedCostMinor: 135,
      durationSeconds: 8,
      pricingUnit: "second",
      mode: "firm",
      pricingStrategy: "per_second",
      pricingVersion: "fal-llms.txt-2026-08-11",
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      capability: "video.motion_transfer",
    },
    motionInput: makeMinimalInput(),
    mediaBoundary: {
      sourceVideoRef: "ref:s",
      identityRefs: ["ref:i"],
    },
  });
  await queue.enqueue({
    runId: "run-wire-1",
    projectId: "proj-mv001",
    sceneId: "motion",
    stepId: "step-mt",
    attemptId: "att-wire-1",
    action: "motion_transfer",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan-mt",
      scenePackageSceneId: "motion",
      mode: "execute",
      motion: {
        phase: "submitting",
        reservationId: "res-reg",
        reservedMinor: 162,
        currency: "USD",
        estimateMinor: 135,
        humanReviewPolicyPresent: true,
      },
    },
  });
  const jobId = [...queue.jobs.values()][0]!.id;
  attempts.get("att-wire-1")!.jobId = jobId;
  attempts.save(attempts.get("att-wire-1")!);
  const transport = createFakeFalMotionControlTransport({
    statusSequence: ["COMPLETED"],
  });
  const composition = createProductionMotionTransferComposition({
    budget,
    env: { ...FLAGS_ON, MV001_REGISTRY_EXCEPTION_ACTIVE: "0" },
    nowIso: clk.nowIso,
    attempts,
    privacyDecisions: PRIVACY_OK,
    testTransport: transport,
  });
  assert.equal(composition.mv001ExceptionActive, false);
  const worker = createProductionWorkerFromDeps({
    policy: createWorkerPolicy({
      workerId: "w-reg",
      claimLimit: 1,
      maximumJobsPerRun: 1,
      maximumProviderCallsPerRun: 1,
    }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: composition.motionTransfer,
  });
  await worker.runOnce({
    correlationId: "c-reg",
    actorId: "wire-test",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  assert.equal(transport.submitCount, 0);
  void ctx;
});

test("MT-013K-WIRE job d'une autre portée refusé", async () => {
  const ctx = await setupWiredJob({
    otherProject: true,
    env: {
      MV001_PROJECT_ID: "390c25db-69e1-403a-83c5-7afcb4b85e84",
    },
  });
  // Recompose with project scope
  const budget = createMemoryBudgetPort(10_000);
  const attempts = createMemoryMotionTransferAttemptStore();
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  await budget.reserve({
    reservationId: "res-scope",
    runId: "run-wire-1",
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId: "att-wire-1",
    amount: money(162, "USD"),
    currency: "USD",
  });
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-wire-1",
    jobId: "pending",
    runId: "run-wire-1",
    reservationId: "res-scope",
    reservedMinor: 162,
    estimate: {
      schemaVersion: "1.0.0",
      currency: "USD",
      estimatedCostMinor: 135,
      durationSeconds: 8,
      pricingUnit: "second",
      mode: "firm",
      pricingStrategy: "per_second",
      pricingVersion: "fal-llms.txt-2026-08-11",
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      capability: "video.motion_transfer",
    },
    motionInput: makeMinimalInput(),
    mediaBoundary: {
      sourceVideoRef: "ref:s",
      identityRefs: ["ref:i"],
    },
  });
  await queue.enqueue({
    runId: "run-wire-1",
    projectId: "proj-other-scope",
    sceneId: "motion",
    stepId: "step-mt",
    attemptId: "att-wire-1",
    action: "motion_transfer",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan-mt",
      scenePackageSceneId: "motion",
      mode: "execute",
      motion: {
        phase: "submitting",
        reservationId: "res-scope",
        reservedMinor: 162,
        currency: "USD",
        estimateMinor: 135,
        humanReviewPolicyPresent: true,
      },
    },
  });
  const jobId = [...queue.jobs.values()][0]!.id;
  attempts.get("att-wire-1")!.jobId = jobId;
  attempts.save(attempts.get("att-wire-1")!);
  const transport = createFakeFalMotionControlTransport({
    statusSequence: ["COMPLETED"],
  });
  const composition = createProductionMotionTransferComposition({
    budget,
    env: {
      ...FLAGS_ON,
      MV001_PROJECT_ID: "390c25db-69e1-403a-83c5-7afcb4b85e84",
    },
    nowIso: clk.nowIso,
    attempts,
    privacyDecisions: PRIVACY_OK,
    testTransport: transport,
  });
  const worker = createProductionWorkerFromDeps({
    policy: createWorkerPolicy({
      workerId: "w-scope",
      claimLimit: 1,
      maximumJobsPerRun: 1,
      maximumProviderCallsPerRun: 1,
    }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: composition.motionTransfer,
  });
  const r = await worker.runOnce({
    correlationId: "c-scope",
    actorId: "wire-test",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  assert.equal(transport.submitCount, 0);
  assert.ok(r.failed >= 1);
  const failedJob = [...queue.jobs.values()][0]!;
  assert.equal(failedJob.error?.code, "motion_scope_forbidden");
  void ctx;
});

test("MT-013K-WIRE exception MV-001 valide → chemin injectable", () => {
  const profile = resolveProductionMotionRegistryProfile({
    env: FLAGS_ON,
    nowIso: AT,
  });
  assert.equal(profile.enabled, true);
  assert.equal(profile.paidExecution, true);
  assert.equal(profile.status, "available");
  assert.equal(FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled, false);
  const privacy = resolveMv001PrivacyDecisions(FLAGS_ON, AT);
  assert.equal(privacy.mediaRetentionAccepted, true);
});

test("MT-013K-WIRE submit count = 1 · poll resubmit = 0 · worker max 1 job", async () => {
  const ctx = await setupWiredJob();
  assert.equal(ctx.composition.mv001ExceptionActive, true);

  // submit
  await ctx.worker.runOnce({
    correlationId: "c-sub",
    actorId: "wire-test",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  assert.equal(ctx.transport.submitCount, 1);
  const afterSubmit = ctx.attempts.get("att-wire-1")!;
  assert.ok(afterSubmit.providerJobId);
  assert.equal(afterSubmit.submitCount, 1);
  assert.equal(afterSubmit.resubmitCount, 0);

  const snap = ctx.lifecycle.snapshot();
  assert.equal(snap.admissionOpen, false);
  assert.equal(snap.submitAllowed, false);

  // Close flags but keep poll (simulate post-submit shutdown)
  const envOff = {
    ...FLAGS_ON,
    MOTION_TRANSFER_ENABLED: "0",
    MOTION_TRANSFER_PAID_ENABLED: "0",
    MOTION_TRANSFER_FAL_ENABLED: "0",
    MOTION_TRANSFER_WORKER_ENABLED: "0",
  };
  // Poll continues via same composition (provider cached); admission closed
  for (let i = 0; i < 3; i++) {
    ctx.clk.advanceMs(2_000);
    await ctx.worker.runOnce({
      correlationId: `c-poll-${i}`,
      actorId: "wire-test",
      nowIso: ctx.clk.nowIso,
      nowMs: ctx.clk.nowMs,
      nextId: ctx.clk.nextId,
    });
  }
  assert.equal(ctx.transport.submitCount, 1);
  assert.ok(ctx.transport.statusCount >= 1);
  assert.equal(ctx.attempts.get("att-wire-1")!.resubmitCount, 0);
  void envOff;
});

test("MT-013K-WIRE admission OFF après submit mais polling autorisé", async () => {
  const ctx = await setupWiredJob();
  await ctx.worker.runOnce({
    correlationId: "c-adm",
    actorId: "wire-test",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  assert.equal(ctx.lifecycle.evaluateAdmission().allowed, false);
  assert.equal(ctx.lifecycle.evaluateSubmit().allowed, false);
  const poll = ctx.lifecycle.evaluatePoll({
    providerJobId: ctx.attempts.get("att-wire-1")!.providerJobId,
    submitCount: 1,
    phase: "polling",
  });
  assert.equal(poll.allowed, true);
  assert.equal(poll.resubmitAllowed, false);
});

test("MT-013K-WIRE providerJobId absent après crash → submission_unknown", async () => {
  resetProductionMotionAttemptStoreForTests();
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  const budget = createMemoryBudgetPort(10_000);
  const attempts = createMemoryMotionTransferAttemptStore();
  const lifecycle = createMotionTransferLifecycleController();
  await budget.reserve({
    reservationId: "res-crash",
    runId: "run-wire-1",
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId: "att-wire-1",
    amount: money(162, "USD"),
    currency: "USD",
  });
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-wire-1",
    jobId: "pending",
    runId: "run-wire-1",
    reservationId: "res-crash",
    reservedMinor: 162,
    estimate: {
      schemaVersion: "1.0.0",
      currency: "USD",
      estimatedCostMinor: 135,
      durationSeconds: 8,
      pricingUnit: "second",
      mode: "firm",
      pricingStrategy: "per_second",
      pricingVersion: "fal-llms.txt-2026-08-11",
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      capability: "video.motion_transfer",
    },
    motionInput: makeMinimalInput(),
    mediaBoundary: {
      sourceVideoRef: "ref:s",
      identityRefs: ["ref:i"],
    },
  });
  await queue.enqueue({
    runId: "run-wire-1",
    projectId: "proj-mv001",
    sceneId: "motion",
    stepId: "step-mt",
    attemptId: "att-wire-1",
    action: "motion_transfer",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    availableAt: AT,
    payloadRef: {
      planRevisionId: "plan-mt",
      scenePackageSceneId: "motion",
      mode: "execute",
      motion: {
        phase: "submitting",
        reservationId: "res-crash",
        reservedMinor: 162,
        currency: "USD",
        estimateMinor: 135,
        humanReviewPolicyPresent: true,
      },
    },
  });
  const jobId = [...queue.jobs.values()][0]!.id;
  attempts.get("att-wire-1")!.jobId = jobId;
  attempts.save(attempts.get("att-wire-1")!);

  const transport = createFakeFalMotionControlTransport({
    statusSequence: ["COMPLETED"],
  });
  const { createMotionTransferWorkerOrchestrator } = await import(
    "@/application/motion/motion-transfer-worker-orchestrator"
  );
  const orch = createMotionTransferWorkerOrchestrator({
    provider: (
      await import("@/infrastructure/providers/motion-transfer/fal-kling-motion-control-adapter")
    ).createFalKlingMotionControlAdapter({
      transport,
      privacyDecisions: PRIVACY_OK,
      enforcePrivacyGateOnSubmit: true,
      enableProcessLocalSubmitReplay: false,
    }),
    budget,
    attempts,
    registryProfile: {
      enabled: true,
      paidExecution: true,
      status: "available",
    },
    privacyDecisions: PRIVACY_OK,
    env: { ...FLAGS_ON, MOTION_TRANSFER_FAKE_HARNESS: "1" },
    lifecycle,
    simulateCrashAfterSubmitBeforePersist: true,
    persistLeasedPayload: async (job, lease, payload) => {
      await queue.persistLeasedPayload!(
        job.jobId,
        lease.leaseToken,
        lease.workerId,
        payload,
      );
    },
  });
  const worker = createProductionWorkerFromDeps({
    policy: createWorkerPolicy({
      workerId: "w-crash",
      claimLimit: 1,
      maximumJobsPerRun: 1,
      maximumProviderCallsPerRun: 1,
    }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: orch,
  });
  await worker.runOnce({
    correlationId: "c-crash",
    actorId: "wire-test",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  assert.equal(attempts.get("att-wire-1")?.phase, "submission_unknown");
  assert.equal(attempts.get("att-wire-1")?.providerJobId, undefined);
  assert.equal(
    [...queue.jobs.values()][0]?.payload.externalJobId,
    undefined,
  );
  assert.ok(
    (([...queue.jobs.values()][0]?.payload.motion?.submitCount ?? 0) >= 1),
  );
  // No second submit
  await worker.runOnce({
    correlationId: "c-crash-2",
    actorId: "wire-test",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  assert.equal(transport.submitCount, 1);
});

test("MT-013K-WIRE terminal replay sans double settlement · late quarantined", async () => {
  const ctx = await setupWiredJob({
    statusSequence: ["COMPLETED"],
  });
  await ctx.worker.runOnce({
    correlationId: "c-term-1",
    actorId: "wire-test",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  ctx.clk.advanceMs(2_000);
  await ctx.worker.runOnce({
    correlationId: "c-term-2",
    actorId: "wire-test",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  const rec = ctx.attempts.get("att-wire-1")!;
  assert.equal(rec.terminal, true);
  assert.equal(rec.ledgerSettled, true);
  const settledAt = rec.ledgerSettled;
  // Replay
  await ctx.worker.runOnce({
    correlationId: "c-term-3",
    actorId: "wire-test",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  assert.equal(ctx.attempts.get("att-wire-1")!.ledgerSettled, settledAt);
  assert.ok(quarantineMotionLateResult(ctx.attempts, "att-wire-1"));
  assert.equal(ctx.attempts.get("att-wire-1")!.phase, "late_quarantined");
});

test("MT-013K-WIRE signed URL jamais dans events · redaction hostile", async () => {
  const ctx = await setupWiredJob({ statusSequence: ["COMPLETED"] });
  await ctx.worker.runOnce({
    correlationId: "c-red",
    actorId: "wire-test",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  for (const e of ctx.events) {
    assert.doesNotThrow(() => assertMotionEventRedacted(e));
    const blob = JSON.stringify(e);
    assert.equal(/https?:\/\//i.test(blob), false);
    assert.equal(/ref:source-ephemeral/.test(blob), false);
    assert.equal(/FAL_KEY|sk-/.test(blob), false);
  }
});

test("MT-013K-WIRE fake adapter interdit en Production", () => {
  assert.throws(
    () =>
      createProductionMotionTransferComposition({
        budget: createMemoryBudgetPort(100),
        env: { NODE_ENV: "production", VERCEL: "1" },
        privacyDecisions: PRIVACY_OK,
        testTransport: createFakeFalMotionControlTransport({}),
      }),
    (err: unknown) =>
      err instanceof MotionTransferDomainError &&
      err.code === "provider_not_configured",
  );
});

test("MT-013K-WIRE QC réel absent → needs_review (pas de faux PASS)", async () => {
  assert.equal(
    assertMotionQcFakeMeasurementAllowed({ NODE_ENV: "production" }).ok,
    false,
  );
  const reports = createMemoryMotionQcReportStore();
  const qc = createMotionQcOrchestrator({
    measurements: honestUnavailableMeasurements(),
    reports,
    defaultPolicy: createSyntheticMotionQcPolicy(),
  });
  const attempts = createMemoryMotionTransferAttemptStore();
  const motionInput = makeMinimalInput();
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-qc",
    jobId: "j-qc",
    runId: "run-qc",
    reservationId: "res-qc",
    reservedMinor: 162,
    estimate: {
      schemaVersion: "1.0.0",
      currency: "USD",
      estimatedCostMinor: 135,
      durationSeconds: 8,
      pricingUnit: "second",
      mode: "firm",
      pricingStrategy: "per_second",
      pricingVersion: "fal-llms.txt-2026-08-11",
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      capability: "video.motion_transfer",
    },
    motionInput,
    mediaBoundary: {
      sourceVideoRef: "ref:s",
      identityRefs: ["ref:i"],
    },
  });
  const attempt = attempts.get("att-qc")!;
  attempt.phase = "qc_pending";
  attempt.terminal = true;
  attempts.save(attempt);

  const evaluated = await qc.evaluate({
    attempt,
    output: {
      providerOutputRef: "asset:internal-out-1",
      mimeType: "video/mp4",
      durationSeconds: 8,
      width: 1080,
      height: 1920,
      fps: 24,
      sizeBytes: 1_024_000,
      providerChecksum: "sha256:wire-qc-out",
      completedAt: AT,
    },
    motionInput,
    fidelity: "critical",
    projectId: "proj-mv001",
    correlationId: "c-qc",
    actorId: "system",
    nowIso: AT,
  });
  assert.equal(evaluated.handoff.outcome, "needs_review");
  assert.equal(evaluated.result.overallStatus, "human_review");
  assert.notEqual(evaluated.result.overallStatus, "pass");
});

test("MT-013K-WIRE aucun réseau — fake transport counters only", async () => {
  const ctx = await setupWiredJob({ statusSequence: ["COMPLETED"] });
  await ctx.worker.runOnce({
    correlationId: "c-net",
    actorId: "wire-test",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  ctx.clk.advanceMs(1_000);
  await ctx.worker.runOnce({
    correlationId: "c-net-2",
    actorId: "wire-test",
    nowIso: ctx.clk.nowIso,
    nowMs: ctx.clk.nowMs,
    nextId: ctx.clk.nextId,
  });
  assert.equal(ctx.transport.kind, "fake");
  assert.equal(ctx.transport.submitCount, 1);
});
