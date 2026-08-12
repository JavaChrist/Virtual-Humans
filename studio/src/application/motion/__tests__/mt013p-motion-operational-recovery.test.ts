/**
 * MT-013P — operational recovery hardening (fake / synthetic only).
 * Zero fal · zero Production media · zero MV-001 mutation.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { money } from "@/domain/cost";
import {
  createFalKlingMotionControlAdapter,
  FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  FAL_MOTION_TRANSFER_PROVIDER_ID,
} from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-adapter";
import { createFakeFalMotionControlTransport } from "@/infrastructure/providers/motion-transfer/fal-motion-control-transport";
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
  createMotionTransferWorkerOrchestrator,
  seedMotionTransferAttempt,
} from "../motion-transfer-worker-orchestrator";
import { createMotionTransferLifecycleController } from "../motion-transfer-lifecycle-gates";
import {
  buildDurableMotionPayload,
  hydrateMotionTransferAttemptFromJob,
  serializeMotionAttemptAuthority,
} from "../motion-transfer-attempt-durability";
import {
  assertNoSignedUrlInResumeInput,
  isDurableResumeMotionInputComplete,
  isLegacyPollHydrateStubInput,
  MOTION_TRANSFER_QUEUE_RECLAIM_MAX_ATTEMPTS,
  toDurableResumeMotionTransferInput,
} from "../durable-resume-motion-input";
import {
  advanceMotionOutputDrain,
  createProductionMotionOutputDrainDeps,
  createMotionDrainCounters,
} from "../motion-output-drain";
import { createFakeMotionOutputDownloadPort } from "../motion-output-download-port";
import { createMemoryAssetContentPort } from "@/application/postproduction/asset-content-port";
import { createMemoryMotionPersistencePort } from "../motion-persistence-port";
import { createMemoryMotionQcReportStore } from "../motion-qc-report";
import { createMemoryMotionReviewSessionStore } from "../motion-review-orchestrator";
import { resetProductionMotionAttemptStoreForTests } from "@/infrastructure/worker/production-motion-transfer";
import { makeMv001LikeOpaqueInput } from "./fixtures/mv001-like-opaque-input";

const AT = "2026-08-12T22:00:00.000Z";
const WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PROJ = "390c25db-69e1-403a-83c5-7afcb4b85e84";

const ENV = {
  MOTION_TRANSFER_ENABLED: "1",
  MOTION_TRANSFER_PAID_ENABLED: "1",
  MOTION_TRANSFER_FAL_ENABLED: "1",
  MOTION_TRANSFER_WORKER_ENABLED: "1",
  MOTION_TRANSFER_FAKE_HARNESS: "1",
  NODE_ENV: "test",
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

function makeEstimate() {
  return {
    schemaVersion: "1.0.0" as const,
    currency: "USD",
    estimatedCostMinor: 135,
    durationSeconds: 8,
    pricingUnit: "second" as const,
    mode: "firm" as const,
    pricingStrategy: "per_second",
    pricingVersion: "fal-llms.txt-2026-08-11",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    capability: "video.motion_transfer" as const,
  };
}

test("MT-013P resumeInput redact — no signed URL / preserves QC gates", () => {
  const input = makeMv001LikeOpaqueInput({
    sourceVideo: {
      role: "source_video",
      asset: {
        assetId: "src-signed",
        kind: "video",
        mimeType: "video/mp4",
        checksum: "sha256:src",
        access: {
          kind: "signed_url",
          url: "https://cdn.example/secret.mp4?token=abc",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      },
      durationSeconds: 8,
    },
  });
  const durable = toDurableResumeMotionTransferInput(input);
  assertNoSignedUrlInResumeInput(durable);
  assert.equal(durable.sourceVideo.asset.access.kind, "internal");
  assert.equal(durable.prompt, undefined);
  assert.ok(isDurableResumeMotionInputComplete(durable));
  assert.equal(isLegacyPollHydrateStubInput(durable), false);
  assert.equal(durable.qcRequirements.some((q) => q.humanValidationRequired), true);
  assert.equal(durable.referenceSpec?.humanValidationRequired, true);
  assert.equal(MOTION_TRANSFER_QUEUE_RECLAIM_MAX_ATTEMPTS >= 64, true);
});

test("MT-013P serialize persist resumeInput · hydrate cold-start QC-complete", () => {
  const motionInput = makeMv001LikeOpaqueInput();
  const attempts = createMemoryMotionTransferAttemptStore();
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-p1",
    jobId: "job-p1",
    runId: "run-p1",
    reservationId: "res-p1",
    reservedMinor: 162,
    estimate: makeEstimate(),
    motionInput,
    mediaBoundary: {
      sourceVideoRef: "https://ephemeral.example/source",
      identityRefs: ["https://ephemeral.example/id"],
    },
  });
  const record = attempts.get("att-p1")!;
  record.submitCount = 1;
  record.providerJobId = "fal-req-p1";
  record.phase = "polling";
  const meta = serializeMotionAttemptAuthority(record);
  assert.ok(meta.resumeInput);
  assert.ok(isDurableResumeMotionInputComplete(meta.resumeInput));
  assertNoSignedUrlInResumeInput(meta.resumeInput!);

  const hydrated = hydrateMotionTransferAttemptFromJob({
    jobId: "job-p1",
    projectId: PROJ,
    runId: "run-p1",
    sceneId: "motion",
    stepId: "step",
    attemptId: "att-p1",
    action: "motion_transfer",
    providerId: "fal",
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    leaseToken: "t",
    leasedBy: "w",
    payload: {
      planRevisionId: "plan",
      scenePackageSceneId: "motion",
      mode: "poll",
      externalJobId: "fal-req-p1",
      motion: meta,
    },
  });
  assert.ok(hydrated);
  assert.equal(hydrated!.submitCount, 1);
  assert.equal(hydrated!.mediaBoundary.sourceVideoRef, "durable:omitted");
  assert.ok(isDurableResumeMotionInputComplete(hydrated!.motionInput));
  assert.equal(hydrated!.reconciliationRequired, false);
});

test("MT-013P cold-start drain with durable resumeInput → needs_review, not qc_rejected", async () => {
  resetProductionMotionAttemptStoreForTests();
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  const budget = createMemoryBudgetPort(10_000);
  const lifecycle = createMotionTransferLifecycleController();
  const transport = createFakeFalMotionControlTransport({
    statusSequence: ["COMPLETED"],
  });
  const download = createFakeMotionOutputDownloadPort();
  const content = createMemoryAssetContentPort();
  const persistence = createMemoryMotionPersistencePort();
  const reports = createMemoryMotionQcReportStore();
  const reviewSessions = createMemoryMotionReviewSessionStore();
  const counters = createMotionDrainCounters();

  await budget.reserve({
    reservationId: "res-p-cold",
    runId: "run-p-cold",
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId: "att-p-cold",
    amount: money(162, "USD"),
    currency: "USD",
  });

  const attemptsA = createMemoryMotionTransferAttemptStore();
  seedMotionTransferAttempt(attemptsA, {
    attemptId: "att-p-cold",
    jobId: "pending",
    runId: "run-p-cold",
    reservationId: "res-p-cold",
    reservedMinor: 162,
    estimate: makeEstimate(),
    motionInput: makeMv001LikeOpaqueInput(),
    mediaBoundary: {
      sourceVideoRef: "https://ephemeral.example/source",
      identityRefs: ["https://ephemeral.example/id"],
    },
  });

  await queue.enqueue({
    runId: "run-p-cold",
    projectId: PROJ,
    sceneId: "motion",
    stepId: "step-mt",
    attemptId: "att-p-cold",
    action: "motion_transfer",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    availableAt: AT,
    maxAttempts: MOTION_TRANSFER_QUEUE_RECLAIM_MAX_ATTEMPTS,
    payloadRef: {
      planRevisionId: "plan-mt",
      scenePackageSceneId: "motion",
      mode: "execute",
      motion: {
        phase: "submitting",
        reservationId: "res-p-cold",
        reservedMinor: 162,
        currency: "USD",
        estimateMinor: 135,
        humanReviewPolicyPresent: true,
      },
    },
  });
  const jobId = [...queue.jobs.values()][0]!.id;
  attemptsA.get("att-p-cold")!.jobId = jobId;

  function buildWorker(
    attempts: ReturnType<typeof createMemoryMotionTransferAttemptStore>,
  ) {
    const drain = createProductionMotionOutputDrainDeps({
      download,
      content,
      persistence,
      reports,
      reviewSessions,
    });
    const orch = createMotionTransferWorkerOrchestrator({
      provider: createFalKlingMotionControlAdapter({
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
      env: ENV,
      lifecycle,
      maxPolls: 20,
      defaultPollAfterMs: 200,
      persistLeasedPayload: async (job, lease, payload) => {
        await queue.persistLeasedPayload!(
          job.jobId,
          lease.leaseToken,
          lease.workerId,
          payload,
        );
      },
      drain,
      drainCounters: counters,
    });
    const baseClaim = queue.claim.bind(queue);
    queue.claim = async (workerId, limit, leaseSeconds) => {
      const claimed = await baseClaim(workerId, limit, leaseSeconds);
      return claimed.map((j) => ({ ...j, workspaceId: WS }));
    };
    return createProductionWorker({
      policy: createWorkerPolicy({
        workerId: "p-worker",
        claimLimit: 1,
        maximumJobsPerRun: 1,
        maximumProviderCallsPerRun: 1,
        leaseSeconds: 90,
      }),
      flags: flagsOn(),
      queue,
      director: directorStub(),
      engine: {} as GenerationEngine,
      ports: {} as ProductionPorts,
      motionTransfer: orch,
    });
  }

  // A: submit + poll → drain queued with resumeInput
  const workerA = buildWorker(attemptsA);
  await workerA.runOnce({
    correlationId: "p-a",
    actorId: "p-test",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  for (let i = 0; i < 6; i++) {
    clk.advanceMs(400);
    await workerA.runOnce({
      correlationId: `p-a-poll-${i}`,
      actorId: "p-test",
      nowIso: clk.nowIso,
      nowMs: clk.nowMs,
      nextId: clk.nextId,
    });
    const j = [...queue.jobs.values()][0]!;
    if (j.payload.mode === "drain") break;
  }
  assert.equal(transport.submitCount, 1);
  const afterA = [...queue.jobs.values()][0]!;
  assert.equal(afterA.payload.mode, "drain");
  assert.equal(afterA.status, "queued");
  assert.ok(afterA.payload.motion?.resumeInput);
  assert.ok(
    isDurableResumeMotionInputComplete(afterA.payload.motion!.resumeInput),
  );

  // Destroy process memory
  attemptsA.records.clear();
  resetProductionMotionAttemptStoreForTests();

  // B: multi-invocation drain cold-start (download → ingest → QC → HR seed)
  const attemptsB = createMemoryMotionTransferAttemptStore();
  const workerB = buildWorker(attemptsB);
  for (let i = 0; i < 16; i++) {
    clk.advanceMs(300);
    await workerB.runOnce({
      correlationId: `p-b-${i}`,
      actorId: "p-test",
      nowIso: clk.nowIso,
      nowMs: clk.nowMs,
      nextId: clk.nextId,
    });
    const j = [...queue.jobs.values()][0]!;
    if (
      j.status === "completed" ||
      j.payload.motion?.humanReviewHandoffStatus === "seeded" ||
      j.error?.code === "qc_rejected" ||
      j.payload.motion?.drainErrorCode === "qc_rejected"
    ) {
      break;
    }
  }
  assert.equal(transport.submitCount, 1);
  const final = [...queue.jobs.values()][0]!;
  assert.notEqual(
    final.payload.motion?.drainErrorCode,
    "qc_rejected",
    `unexpected drainError=${final.payload.motion?.drainErrorCode} phase=${final.payload.motion?.phase} status=${final.status} err=${final.error?.code}`,
  );
  assert.notEqual(final.error?.code, "qc_rejected");
  assert.equal(
    final.payload.motion?.humanReviewHandoffStatus,
    "seeded",
    `expected HR seeded; got phase=${final.payload.motion?.phase} status=${final.status} drainErr=${final.payload.motion?.drainErrorCode} err=${final.error?.code}`,
  );
});

test("MT-013P incomplete resumeInput → motion_resume_input_missing, never qc_rejected", async () => {
  const hydrated = hydrateMotionTransferAttemptFromJob({
    jobId: "job-miss",
    workspaceId: WS,
    projectId: PROJ,
    runId: "run-miss",
    sceneId: "motion",
    stepId: "s",
    attemptId: "att-miss",
    action: "motion_transfer",
    providerId: "fal",
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    leaseToken: "t",
    leasedBy: "w",
    payload: {
      planRevisionId: "plan",
      scenePackageSceneId: "motion",
      mode: "drain",
      externalJobId: "fal-miss",
      motion: {
        phase: "qc_pending",
        reservationId: "res-miss",
        reservedMinor: 162,
        estimateMinor: 135,
        submitCount: 1,
        ledgerSettled: true,
        outputRef: "out-ref-1",
        outputMimeType: "video/mp4",
        outputSizeBytes: 1024,
        outputDurationSeconds: 8,
        outputWidth: 1080,
        outputHeight: 1920,
        outputFps: 24,
        outputCompletedAt: AT,
        downloadStatus: "completed",
        downloadChecksum: "abc",
        ingestStatus: "completed",
        ingestedAssetId: "asset-miss",
        humanReviewPolicyPresent: true,
      },
    },
  });
  assert.ok(hydrated);
  assert.equal(isDurableResumeMotionInputComplete(hydrated!.motionInput), false);

  const deps = createProductionMotionOutputDrainDeps({
    download: createFakeMotionOutputDownloadPort(),
    content: createMemoryAssetContentPort(),
    persistence: createMemoryMotionPersistencePort(),
    reports: createMemoryMotionQcReportStore(),
    reviewSessions: createMemoryMotionReviewSessionStore(),
  });
  const out = await advanceMotionOutputDrain({
    job: {
      jobId: "job-miss",
      workspaceId: WS,
      projectId: PROJ,
      runId: "run-miss",
      sceneId: "motion",
      stepId: "s",
      attemptId: "att-miss",
      action: "motion_transfer",
      providerId: "fal",
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      leaseToken: "t",
      leasedBy: "w",
      payload: {
        planRevisionId: "plan",
        scenePackageSceneId: "motion",
        mode: "drain",
        externalJobId: "fal-miss",
        motion: {
          phase: "qc_pending",
          reservationId: "res-miss",
          reservedMinor: 162,
          estimateMinor: 135,
          submitCount: 1,
        },
      },
    },
    record: hydrated!,
    context: {
      correlationId: "corr-miss",
      actorId: "p-test",
      nowIso: () => AT,
      nextId: () => "nid",
    },
    deps,
    counters: createMotionDrainCounters(),
  });
  assert.equal(out.status, "failed");
  assert.equal(out.errorCode, "motion_resume_input_missing");
  assert.notEqual(out.errorCode, "qc_rejected");
  assert.equal(out.record.reconciliationRequired, true);
});

test("MT-013P multi-invocation poll — submit stays 1 · reclaim budget ≠ provider attempt", async () => {
  resetProductionMotionAttemptStoreForTests();
  const clk = clock();
  const queue = createMemoryJobQueue(clk.nowIso);
  const budget = createMemoryBudgetPort(10_000);
  const attempts = createMemoryMotionTransferAttemptStore();
  const transport = createFakeFalMotionControlTransport({
    statusSequence: [
      "IN_QUEUE",
      "IN_PROGRESS",
      "IN_PROGRESS",
      "IN_PROGRESS",
      "IN_PROGRESS",
      "COMPLETED",
    ],
  });

  await budget.reserve({
    reservationId: "res-multi",
    runId: "run-multi",
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId: "att-multi",
    amount: money(162, "USD"),
    currency: "USD",
  });
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-multi",
    jobId: "pending",
    runId: "run-multi",
    reservationId: "res-multi",
    reservedMinor: 162,
    estimate: makeEstimate(),
    motionInput: makeMv001LikeOpaqueInput(),
    mediaBoundary: {
      sourceVideoRef: "https://ephemeral.example/source",
      identityRefs: ["https://ephemeral.example/id"],
    },
  });
  await queue.enqueue({
    runId: "run-multi",
    projectId: PROJ,
    sceneId: "motion",
    stepId: "step-mt",
    attemptId: "att-multi",
    action: "motion_transfer",
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    availableAt: AT,
    maxAttempts: MOTION_TRANSFER_QUEUE_RECLAIM_MAX_ATTEMPTS,
    payloadRef: {
      planRevisionId: "plan",
      scenePackageSceneId: "motion",
      mode: "execute",
      motion: {
        phase: "submitting",
        reservationId: "res-multi",
        reservedMinor: 162,
        currency: "USD",
        estimateMinor: 135,
        humanReviewPolicyPresent: true,
      },
    },
  });
  attempts.get("att-multi")!.jobId = [...queue.jobs.values()][0]!.id;

  const lifecycle = createMotionTransferLifecycleController();
  const orch = createMotionTransferWorkerOrchestrator({
    provider: createFalKlingMotionControlAdapter({
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
    env: ENV,
    lifecycle,
    maxPolls: 40,
  });
  const worker = createProductionWorker({
    policy: createWorkerPolicy({
      workerId: "multi-w",
      claimLimit: 1,
      maximumJobsPerRun: 1,
      maximumProviderCallsPerRun: 1,
      leaseSeconds: 90,
    }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: orch,
  });

  let claims = 0;
  for (let i = 0; i < 12; i++) {
    clk.advanceMs(200);
    const r = await worker.runOnce({
      correlationId: `multi-${i}`,
      actorId: "p-test",
      nowIso: clk.nowIso,
      nowMs: clk.nowMs,
      nextId: clk.nextId,
    });
    claims += r.claimed ?? 0;
    // Simulate cold start every 3 invocations
    if (i % 3 === 2) {
      attempts.records.clear();
      resetProductionMotionAttemptStoreForTests();
    }
    const job = [...queue.jobs.values()][0]!;
    if (job.payload.mode === "drain" || job.status === "completed") break;
  }
  assert.equal(transport.submitCount, 1);
  const job = [...queue.jobs.values()][0]!;
  assert.equal(job.payload.motion?.submitCount, 1);
  assert.equal(job.payload.motion?.resubmitCount ?? 0, 0);
  assert.ok(claims >= 2, "multi-invocation claims expected");
  // queue claimCount (memory) can exceed 1 while provider submit stays 1
  assert.ok(queue.claimCount >= 2);
  assert.ok(MOTION_TRANSFER_QUEUE_RECLAIM_MAX_ATTEMPTS > 1);
});

test("MT-013P buildDurableMotionPayload includes resumeInput fingerprint-safe", () => {
  const attempts = createMemoryMotionTransferAttemptStore();
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-fp",
    jobId: "job-fp",
    runId: "run-fp",
    reservationId: "res-fp",
    reservedMinor: 162,
    estimate: makeEstimate(),
    motionInput: makeMv001LikeOpaqueInput({
      prompt: "secret prompt must not persist",
    }),
    mediaBoundary: {
      sourceVideoRef: "https://signed.example/x",
      identityRefs: ["https://signed.example/y"],
    },
  });
  const record = attempts.get("att-fp")!;
  record.submitCount = 1;
  record.providerJobId = "prov-1";
  const payload = buildDurableMotionPayload(
    {
      jobId: "job-fp",
      projectId: PROJ,
      runId: "run-fp",
      sceneId: "motion",
      stepId: "s",
      attemptId: "att-fp",
      action: "motion_transfer",
      providerId: "fal",
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      leaseToken: "t",
      leasedBy: "w",
      payload: {
        planRevisionId: "plan",
        scenePackageSceneId: "motion",
        mode: "poll",
      },
    },
    record,
    "poll",
  );
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("secret prompt"), false);
  assert.equal(serialized.includes("signed.example"), false);
  assert.ok(payload.motion?.resumeInput);
  assert.equal(payload.motion?.resumeInput?.prompt, undefined);
});
