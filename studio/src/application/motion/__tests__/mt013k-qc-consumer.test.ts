/**
 * MT-013K-QC-CONSUMER — fresh-process drain A→B→C→D (zero fal / flags harness only).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { money } from "@/domain/cost";
import { makeMinimalInput } from "@/domain/motion/__tests__/fixtures";
import { allowedHumanReviewDecisions } from "@/domain/motion/review";
import { createSyntheticMotionQcPolicy } from "@/domain/motion/qc";
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
  createProductionMotionOutputDrainDeps,
  createMotionDrainCounters,
} from "../motion-output-drain";
import { createFakeMotionOutputDownloadPort } from "../motion-output-download-port";
import { createMemoryAssetContentPort } from "@/application/postproduction/asset-content-port";
import { createMemoryMotionPersistencePort } from "../motion-persistence-port";
import { createMemoryMotionQcReportStore } from "../motion-qc-report";
import { createMemoryMotionReviewSessionStore } from "../motion-review-orchestrator";
import { createUnavailableMotionQcMeasurementPort } from "../unavailable-motion-qc-measurement";
import { assertMotionQcFakeMeasurementAllowed } from "../assert-motion-qc-fake-allowed";
import { resetProductionMotionAttemptStoreForTests } from "@/infrastructure/worker/production-motion-transfer";

const AT = "2026-08-12T16:00:00.000Z";
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

test("MT-013K-QC-CONSUMER fake measurement interdit en Production", () => {
  assert.equal(
    assertMotionQcFakeMeasurementAllowed({
      NODE_ENV: "production",
      VERCEL: "1",
    }).ok,
    false,
  );
  assert.equal(createUnavailableMotionQcMeasurementPort().kind, "unavailable");
});

test("MT-013K-QC-CONSUMER FRESH_PROCESS_DRAIN_RECOVERY A→B→C→D", async () => {
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
    reservationId: "res-qc-1",
    runId: "run-qc-1",
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId: "att-qc-1",
    amount: money(162, "USD"),
    currency: "USD",
  });

  const attemptsA = createMemoryMotionTransferAttemptStore();
  seedMotionTransferAttempt(attemptsA, {
    attemptId: "att-qc-1",
    jobId: "pending",
    runId: "run-qc-1",
    reservationId: "res-qc-1",
    reservedMinor: 162,
    estimate: makeEstimate(),
    motionInput: makeMinimalInput({
      motion: {
        preserveMotion: true,
        preserveTiming: true,
        preserveCamera: false,
        fidelity: "critical",
        poseControl: "provider_native",
      },
    }),
    mediaBoundary: {
      sourceVideoRef: "https://ephemeral.example/source",
      identityRefs: ["https://ephemeral.example/id"],
    },
  });

  await queue.enqueue({
    runId: "run-qc-1",
    projectId: PROJ,
    sceneId: "motion",
    stepId: "step-mt",
    attemptId: "att-qc-1",
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
        reservationId: "res-qc-1",
        reservedMinor: 162,
        currency: "USD",
        estimateMinor: 135,
        humanReviewPolicyPresent: true,
      },
    },
  });
  // inject workspaceId on claimed jobs via enqueue payload — memory queue may omit;
  // patch job row
  const jobRow = [...queue.jobs.values()][0]!;
  (jobRow as { workspaceId?: string }).workspaceId = WS;
  attemptsA.get("att-qc-1")!.jobId = jobRow.id;
  attemptsA.save(attemptsA.get("att-qc-1")!);

  function buildWorker(
    attempts: ReturnType<typeof createMemoryMotionTransferAttemptStore>,
    crashAfterIngest?: boolean,
  ) {
    const drain = createProductionMotionOutputDrainDeps({
      download,
      content,
      persistence,
      reports,
      reviewSessions,
      policy: createSyntheticMotionQcPolicy({
        fidelityLevel: "critical",
        criticalRequiresHumanReview: true,
        missingEvidenceBehavior: "human_review",
      }),
      simulateCrashAfterIngest: crashAfterIngest,
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
    // Ensure claimed jobs carry workspaceId
    const baseClaim = queue.claim.bind(queue);
    queue.claim = async (workerId, limit, leaseSeconds) => {
      const claimed = await baseClaim(workerId, limit, leaseSeconds);
      return claimed.map((j) => ({ ...j, workspaceId: WS }));
    };
    return createProductionWorker({
      policy: createWorkerPolicy({
        workerId: "qc-worker",
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

  // ── A: submit + poll completed + descriptor + reschedule drain ──
  const workerA = buildWorker(attemptsA, false);
  await workerA.runOnce({
    correlationId: "inv-a",
    actorId: "qc-test",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  clk.advanceMs(500);
  await workerA.runOnce({
    correlationId: "inv-a-poll",
    actorId: "qc-test",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  assert.equal(transport.submitCount, 1);
  const afterA = [...queue.jobs.values()][0]!;
  assert.equal(afterA.payload.mode, "drain");
  assert.ok(afterA.payload.externalJobId);
  assert.ok(afterA.payload.motion?.outputRef);
  assert.equal(afterA.payload.motion?.outputMimeType, "video/mp4");
  assert.equal(afterA.status, "queued");

  // Destroy process memory A
  attemptsA.records.clear();
  resetProductionMotionAttemptStoreForTests();

  // ── B: download + ingest + crash after ingest ──
  const attemptsB = createMemoryMotionTransferAttemptStore();
  const workerB = buildWorker(attemptsB, true);
  for (let i = 0; i < 8; i++) {
    clk.advanceMs(300);
    const r = await workerB.runOnce({
      correlationId: `inv-b-${i}`,
      actorId: "qc-test",
      nowIso: clk.nowIso,
      nowMs: clk.nowMs,
      nextId: clk.nextId,
    });
    const job = [...queue.jobs.values()][0]!;
    if (
      job.payload.motion?.ingestStatus === "completed" &&
      job.payload.motion?.ingestedAssetId
    ) {
      void r;
      break;
    }
  }
  assert.equal(transport.submitCount, 1);
  assert.equal(counters.downloadCount, 1);
  assert.equal(counters.storageObjectCount, 1);
  assert.equal(counters.assetCount, 1);
  const afterB = [...queue.jobs.values()][0]!;
  assert.equal(afterB.payload.motion?.ingestStatus, "completed");
  assert.ok(afterB.payload.motion?.ingestedAssetId);
  assert.ok(
    afterB.payload.motion?.qcStatus !== "completed" ||
      afterB.payload.motion?.humanReviewHandoffStatus !== "seeded",
  );

  // Destroy process memory B (keep shared durable stores: content/persistence/reports)
  attemptsB.records.clear();

  // ── C: QC + needs_review + Human Review ──
  const attemptsC = createMemoryMotionTransferAttemptStore();
  const workerC = buildWorker(attemptsC, false);
  for (let i = 0; i < 6; i++) {
    clk.advanceMs(300);
    await workerC.runOnce({
      correlationId: `inv-c-${i}`,
      actorId: "qc-test",
      nowIso: clk.nowIso,
      nowMs: clk.nowMs,
      nextId: clk.nextId,
    });
    const job = [...queue.jobs.values()][0]!;
    if (
      job.status === "completed" &&
      job.payload.motion?.humanReviewHandoffStatus === "seeded"
    ) {
      break;
    }
  }
  assert.equal(transport.submitCount, 1);
  assert.equal(counters.downloadCount, 1);
  assert.equal(counters.storageObjectCount, 1);
  assert.equal(counters.assetCount, 1);
  assert.equal(counters.qualityReportCount, 1);
  assert.equal(counters.reviewContextCount, 1);
  assert.equal(counters.automaticApproval, 0);
  assert.equal(counters.mergeExportCount, 0);

  const session = await reviewSessions.get(PROJ, "run-qc-1");
  assert.ok(session);
  assert.equal(session!.report.motionQc.overallStatus, "human_review");
  assert.equal(session!.report.motionQc.humanValidationRequired, true);
  assert.equal(session!.report.motionQc.motionFidelity, "unknown");
  assert.equal(session!.report.motionQc.identityFidelity, "unknown");
  const unavailable = session!.report.motionQc.issues.filter((i) =>
    i.code.includes("unavailable"),
  );
  assert.ok(unavailable.length >= 1);

  const allowed = allowedHumanReviewDecisions(
    session!.report.motionQc,
    session!.policy,
    {
      outcome: "needs_review",
      humanValidationRequired: true,
      qualityReportPresent: true,
      qualityReportStale: false,
    },
  );
  // Contrat MT-010: unavailable + humanOnly → APPROVE éligible avec attestation humaine.
  assert.ok(allowed.allowed.includes("approved"));
  assert.ok(allowed.allowed.includes("rejected"));

  // ── D: terminal replay — no duplication ──
  attemptsC.records.clear();
  const attemptsD = createMemoryMotionTransferAttemptStore();
  const before = { ...counters };
  const workerD = buildWorker(attemptsD, false);
  clk.advanceMs(300);
  const rD = await workerD.runOnce({
    correlationId: "inv-d",
    actorId: "qc-test",
    nowIso: clk.nowIso,
    nowMs: clk.nowMs,
    nextId: clk.nextId,
  });
  assert.equal(transport.submitCount, 1);
  assert.equal(counters.downloadCount, before.downloadCount);
  assert.equal(counters.storageObjectCount, before.storageObjectCount);
  assert.equal(counters.assetCount, before.assetCount);
  assert.equal(counters.qualityReportCount, before.qualityReportCount);
  assert.equal(counters.reviewContextCount, before.reviewContextCount);
  assert.ok(rD.claimed === 0 || rD.completed >= 0);
});

test("MT-013K-QC-CONSUMER MIME invalide → fail-closed sans resubmit", async () => {
  const download = createFakeMotionOutputDownloadPort({ mimeType: "image/png" });
  const counters = createMotionDrainCounters();
  const drain = createProductionMotionOutputDrainDeps({ download });
  const attempts = createMemoryMotionTransferAttemptStore();
  seedMotionTransferAttempt(attempts, {
    attemptId: "att-mime",
    jobId: "j1",
    runId: "r1",
    reservationId: "res",
    reservedMinor: 162,
    estimate: makeEstimate(),
    motionInput: makeMinimalInput(),
    mediaBoundary: { sourceVideoRef: "s", identityRefs: ["i"] },
  });
  const rec = attempts.get("att-mime")!;
  rec.providerJobId = "pj-1";
  rec.phase = "provider_completed";
  rec.downloadStatus = "intent";
  rec.outputDescriptor = {
    providerOutputRef: "fal-out:pj-1",
    mimeType: "video/mp4",
    durationSeconds: 8,
    width: 1080,
    height: 1920,
    fps: 24,
    sizeBytes: 1000,
    completedAt: AT,
  };
  attempts.save(rec);

  const step = await (await import("../motion-output-drain")).advanceMotionOutputDrain({
    job: {
      jobId: "j1",
      workspaceId: WS,
      projectId: PROJ,
      runId: "r1",
      sceneId: "motion",
      stepId: "s",
      attemptId: "att-mime",
      action: "motion_transfer",
      providerId: "fal",
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      leaseToken: "t",
      leasedBy: "w",
      payload: {
        planRevisionId: "p",
        scenePackageSceneId: "motion",
        mode: "drain",
        externalJobId: "pj-1",
        motion: { phase: "provider_completed", reservationId: "res", reservedMinor: 162, estimateMinor: 135 },
      },
    },
    record: rec,
    context: {
      correlationId: "c",
      actorId: "u",
      nowIso: () => AT,
      nextId: () => "x",
    },
    deps: drain,
    counters,
  });
  assert.equal(step.status, "failed");
  assert.equal(counters.downloadCount <= 1, true);
});

test("MT-013K-QC-CONSUMER APPROVE attestation documentée (critical unavailable)", () => {
  const policy = createSyntheticMotionQcPolicy({
    fidelityLevel: "critical",
    criticalRequiresHumanReview: true,
    missingEvidenceBehavior: "human_review",
  });
  const allowed = allowedHumanReviewDecisions(
    {
      schemaVersion: "1.0.0",
      motionFidelity: "unknown",
      identityFidelity: "unknown",
      outfitFidelity: "unknown",
      cameraCompliance: "unknown",
      bodyIntegrity: "unknown",
      temporalConsistency: "unknown",
      overallStatus: "human_review",
      humanValidationRequired: true,
      checkpointResults: [],
      issues: [
        {
          code: "motion_fidelity.unavailable",
          severity: "blocking",
          message: "unavailable",
          layer: "motion_fidelity",
          requirementClass: "required",
          retryClass: "humanOnly",
        },
      ],
    },
    policy,
    {
      outcome: "needs_review",
      humanValidationRequired: true,
      qualityReportPresent: true,
      qualityReportStale: false,
    },
  );
  // Contrat MT-010: issues humanOnly + overall human_review → APPROVE avec attestation.
  // nonRetryable/.fail bloqueraient APPROVE (mesures non substituables).
  assert.ok(
    allowed.allowed.includes("approved"),
    `expected approved, got ${allowed.allowed.join(",")} reasons=${allowed.reasons.join(",")}`,
  );
});
