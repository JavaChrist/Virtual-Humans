/**
 * Canonical Motion Transfer synthetic E2E harness (MT-012).
 * Composes existing Registry/Router/Engine/Provider/Worker/QC/Review/ledger/obs —
 * does not reimplement them. Zero real provider / Production writes.
 */

import { money } from "@/domain/cost";
import {
  createFakeMotionTransferMediaResolver,
  runMotionTransferGenerationDryRun,
  type MotionTransferDryRunResult,
  type MotionTransferGenerationInput,
} from "@/domain/generation";
import type { MotionQcResult, MotionTransferInput } from "@/domain/motion";
import {
  createSyntheticMotionQcPolicy,
  MOTION_QC_MEASUREMENT_SET_VERSION,
  type MotionQcPolicy,
} from "@/domain/motion/qc";
import {
  assertMotionSurfaceRedacted,
  createSyntheticAcceptedPrivacyDecisions,
  evaluateMotionSecurityGates,
  type MotionPrivacyDecisionKey,
  type MotionPrivacyDecisionSet,
} from "@/domain/motion/security";
import {
  buildRegistrySnapshot,
  type CapabilityRegistrySnapshot,
  type ModelCapabilities,
} from "@/domain/routing/capabilities";
import {
  makeProvider,
  AT as REG_AT,
  CREATED,
  EXPIRES,
} from "@/domain/routing/capabilities/__tests__/fixtures";
import {
  makeSyntheticMotionTransferModel,
  SYNTHETIC_MT_PROVIDER_ID,
} from "@/domain/routing/capabilities/__tests__/motion-transfer-fixtures";
import { createMemoryBudgetPort } from "@/application/production/__tests__/fakes";
import { createMemoryJobQueue } from "@/application/worker/__tests__/fakes";
import { createProductionWorker } from "@/application/worker/production-worker";
import { createWorkerPolicy } from "@/application/worker/policy";
import type { ProductionDirector } from "@/application/production/production-director";
import type { GenerationEngine } from "@/application/generation";
import type { ProductionPorts } from "@/application/production/ports";
import type { FeatureFlagsSnapshot } from "@/infrastructure/config/feature-flags";
import {
  createFakeMotionTransferProvider,
  FAKE_MOTION_TRANSFER_MODEL_ID,
  FAKE_MOTION_TRANSFER_PROVIDER_ID,
  type FakeMotionTransferScenario,
} from "@/infrastructure/providers/motion-transfer";
import { createFakeMotionQcMeasurementPort } from "./fake-motion-qc-measurement";
import {
  applyMotionQcHandoffToAttempt,
  createMotionQcOrchestrator,
} from "./motion-qc-orchestrator";
import {
  buildMotionQcQualityReport,
  createMemoryMotionQcReportStore,
} from "./motion-qc-report";
import type { MotionQcEvent } from "./motion-qc-events";
import {
  createMemoryMotionReviewDecisionStore,
  createMemoryMotionReviewSessionStore,
  createMotionReviewOrchestrator,
  seedMotionReviewSession,
} from "./motion-review-orchestrator";
import type { MotionReviewEvent } from "./motion-review-events";
import {
  createMemoryMotionTransferAttemptStore,
  createMotionTransferWorkerOrchestrator,
  quarantineMotionLateResult,
  seedMotionTransferAttempt,
  type MotionTransferAttemptRecord,
} from "./motion-transfer-worker-orchestrator";
import type { MotionTransferWorkerEvent } from "./motion-transfer-worker-events";
import { runMotionTransferPublicDryRun } from "./motion-transfer-dry-run";
import {
  MT012_CORRELATION_ID,
  MT012_PROJECT_ID,
  MT012_WORKSPACE_ID,
  makeMv001LikeOpaqueInput,
} from "./__tests__/fixtures/mv001-like-opaque-input";

export const MOTION_TRANSFER_E2E_HARNESS_VERSION = "mt012-e2e-1.0.0" as const;

const HARNESS_ENV = {
  MOTION_TRANSFER_ENABLED: "1",
  MOTION_TRANSFER_PAID_ENABLED: "1",
  MOTION_TRANSFER_FAL_ENABLED: "1",
  MOTION_TRANSFER_WORKER_ENABLED: "1",
  MOTION_TRANSFER_FAKE_HARNESS: "1",
  NODE_ENV: "test",
} as const;

const PRIVACY_LEGACY_OK = {
  mediaRetentionAccepted: true,
  cdnExposureStrategyAccepted: true,
  biometricConsentConfirmed: true,
  commercialRightsConfirmed: true,
  geographicRestrictionsAccepted: true,
};

export type MotionE2EPhaseStatus =
  | "skipped"
  | "pass"
  | "blocked"
  | "failed"
  | "needs_review"
  | "approved"
  | "rejected"
  | "retry_intent"
  | "request_new_reference"
  | "quarantined"
  | "submission_unknown"
  | "timed_out"
  | "review_failed"
  | "budget_blocked";

export type MotionE2EHarnessOptions = {
  motionInput?: MotionTransferInput;
  workspaceId?: string;
  projectId?: string;
  correlationId?: string;
  at?: string;
  /** When false, skip reservation/enqueue (gate-only scenarios). */
  allowEnqueue?: boolean;
  /** Budget hard limit for dry-run / routing. */
  budgetLimitMinor?: number;
  /** Memory budget available for reserve. */
  budgetAvailableMinor?: number;
  estimateMinor?: number;
  reservedMinor?: number;
  /** Provider fake scenario. */
  providerScenario?: FakeMotionTransferScenario;
  /** Override estimate cost used by fake provider for ledger tests. */
  providerEstimateCostMinor?: number;
  simulateCrashAfterSubmit?: boolean;
  maxPolls?: number;
  /** Registry: synthetic verified (default) or unverified / absent. */
  registryMode?: "synthetic_verified" | "unverified" | "absent";
  privacy?: MotionPrivacyDecisionSet | null;
  /** Omit one privacy key for gate tests. */
  omitPrivacyKey?: MotionPrivacyDecisionKey;
  /** Expire all privacy decisions. */
  expirePrivacy?: boolean;
  /** Skip worker entirely after dry-run/gates. */
  stopAfterGates?: boolean;
  /** QC measurement overrides. */
  qcMeasurementOverrides?: Parameters<typeof createFakeMotionQcMeasurementPort>[0];
  qcPolicy?: MotionQcPolicy;
  /** Override MIME for QC technical layer (e.g. text/plain → reject). */
  qcOutputMimeType?: string;
  /**
   * When set, seed human review from this QC result instead of measured aggregate
   * (used for REQUEST_NEW_REFERENCE / non-retryable taxonomy without inventing QC rules).
   */
  reviewQcInject?: MotionQcResult;
  reviewOutcomeInject?: "needs_review" | "retry_recommended" | "qc_passed";
  /** Human review decision after QC (if needs_review / retry). */
  humanDecision?:
    | "approved"
    | "rejected"
    | "retry_same_reference"
    | "request_new_reference"
    | "none";
  reviewComment?: string;
  /** Inject hostile strings into captured event metadata for redaction checks. */
  hostileInjection?: string;
  /** After timeout/cancel, quarantine a late result. */
  quarantineLate?: boolean;
  /** Replay worker path after nominal completion (idempotence). */
  replayAfterComplete?: boolean;
};

export type MotionE2EHarnessResult = {
  version: typeof MOTION_TRANSFER_E2E_HARNESS_VERSION;
  phases: Record<string, MotionE2EPhaseStatus>;
  ids: {
    workspaceId: string;
    projectId: string;
    correlationId: string;
    runId: string | null;
    jobId: string | null;
    attemptId: string | null;
    reservationId: string | null;
    providerJobId: string | null;
    reviewRequestId: string | null;
  };
  fingerprints: {
    planFingerprint: string | null;
    inputFingerprint: string | null;
    requestFingerprint: string | null;
  };
  dryRun: Awaited<ReturnType<typeof runMotionTransferPublicDryRun>> | null;
  domainDryRun: Pick<
    MotionTransferDryRunResult,
    "executable" | "selected" | "estimate" | "planFingerprint" | "providerCalled"
  > | null;
  ledger: {
    estimateMinor: number | null;
    reservedMinor: number | null;
    committedMinor: number | null;
    releasedMinor: number | null;
    settled: boolean;
    reconciliationRequired: boolean;
  };
  counters: {
    enqueueCount: number;
    claimCount: number;
    providerSubmitCount: number;
    providerPollCount: number;
    pollResubmitCount: number;
    automaticRetryCount: number;
    automaticApprovalCount: number;
    automaticMergeCount: number;
    automaticExportCount: number;
    maximumJobsPerInvocation: number;
    realProviderCalls: number;
    productionWrites: number;
  };
  qc: {
    overallStatus: string | null;
    outcome: string | null;
    humanValidationRequired: boolean | null;
    allowedDecisions: readonly string[];
  };
  review: {
    decision: string | null;
    nextAllowedState: string | null;
    productionJobsDelta: number;
  };
  attemptPhase: string | null;
  terminalState: string | null;
  outputDescriptor: {
    providerOutputRef: string | null;
    mimeType: string | null;
    hasChecksum: boolean;
  };
  events: readonly { type: string; correlationId?: string }[];
  eventTypes: readonly string[];
  lateQuarantined: boolean;
  providerCalled: false;
  productionWrites: 0;
  invariants: {
    maximumJobsPerInvocation: 1;
    providerSubmitCount: number;
    pollResubmitCount: number;
    automaticRetryCount: 0;
    automaticApprovalCount: 0;
    automaticMergeCount: 0;
    automaticExportCount: 0;
    realProviderCalls: 0;
    productionWrites: 0;
  };
};

function withScores(model: ModelCapabilities): ModelCapabilities {
  return {
    ...model,
    quality: {
      quality: 80,
      identity: 80,
      speed: 50,
      reliability: 80,
    },
    evidence: [
      ...model.evidence,
      {
        field: "quality.quality",
        source: "manual",
        reference: "mt012-synth",
        confidence: "high",
      },
      {
        field: "quality.identity",
        source: "manual",
        reference: "mt012-synth",
        confidence: "high",
      },
      {
        field: "quality.speed",
        source: "manual",
        reference: "mt012-synth",
        confidence: "high",
      },
      {
        field: "quality.reliability",
        source: "manual",
        reference: "mt012-synth",
        confidence: "high",
      },
    ],
  };
}

export function makeMt012SyntheticRegistry(): CapabilityRegistrySnapshot {
  const model = withScores(
    makeSyntheticMotionTransferModel({
      pricing: [
        {
          id: "price:mt012",
          unit: "second",
          unitCost: money(5, "USD"),
          conditions: [],
          pricingVersion: "mt012-synth",
          source: "manual",
          confidence: "high",
        },
      ],
    }),
  );
  return buildRegistrySnapshot({
    registryVersion: "mt012-synth-registry-1.0.0",
    createdAt: CREATED,
    expiresAt: EXPIRES,
    providers: [
      makeProvider({
        id: SYNTHETIC_MT_PROVIDER_ID,
        displayName: "Synthetic MT (test)",
      }),
    ],
    models: [model],
  });
}

void REG_AT;

function clock(start: string) {
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

function buildPrivacy(
  opts: MotionE2EHarnessOptions,
  workspaceId: string,
  projectId: string,
  at: string,
): MotionPrivacyDecisionSet | null {
  if (opts.privacy === null) return null;
  if (opts.privacy) return opts.privacy;
  const base = createSyntheticAcceptedPrivacyDecisions({
    workspaceId,
    projectId,
    decidedAt: at,
    expiresAt: opts.expirePrivacy
      ? "2020-01-01T00:00:00.000Z"
      : "2099-01-01T00:00:00.000Z",
  });
  if (!opts.omitPrivacyKey) return base;
  return {
    ...base,
    records: base.records.filter((r) => r.key !== opts.omitPrivacyKey),
  };
}

function redactAssert(value: unknown): void {
  assertMotionSurfaceRedacted(value);
}

/**
 * Run full synthetic Motion Transfer E2E pipeline (or gated subset).
 */
export async function runMotionTransferE2E(
  options: MotionE2EHarnessOptions = {},
): Promise<Readonly<MotionE2EHarnessResult>> {
  const at = options.at ?? "2026-08-11T21:00:00.000Z";
  const workspaceId = options.workspaceId ?? MT012_WORKSPACE_ID;
  const projectId = options.projectId ?? MT012_PROJECT_ID;
  const correlationId = options.correlationId ?? MT012_CORRELATION_ID;
  const motionInput = options.motionInput ?? makeMv001LikeOpaqueInput();
  // When testing actual>reserved, seed firm estimate at the elevated cost so fake
  // provider actualCostMinor (from estimate) exceeds the reservation.
  const estimateMinor =
    options.providerEstimateCostMinor ?? options.estimateMinor ?? 135;
  const reservedMinor = options.reservedMinor ?? 162;
  const allowEnqueue = options.allowEnqueue !== false;
  const humanDecision = options.humanDecision ?? "approved";

  const phases: Record<string, MotionE2EPhaseStatus> = {
    validation: "skipped",
    media: "skipped",
    registry: "skipped",
    router: "skipped",
    plan: "skipped",
    securityGates: "skipped",
    reservation: "skipped",
    enqueue: "skipped",
    claim: "skipped",
    submit: "skipped",
    poll: "skipped",
    output: "skipped",
    ingest: "skipped",
    qc: "skipped",
    review: "skipped",
    terminal: "skipped",
  };

  const events: Array<{ type: string; correlationId?: string }> = [];
  const workerEvents: MotionTransferWorkerEvent[] = [];
  const qcEvents: MotionQcEvent[] = [];
  const reviewEvents: MotionReviewEvent[] = [];

  const privacy = buildPrivacy(options, workspaceId, projectId, at);
  const registryMode = options.registryMode ?? "synthetic_verified";
  const registry =
    registryMode === "synthetic_verified"
      ? makeMt012SyntheticRegistry()
      : registryMode === "unverified"
        ? null
        : null;

  // Public dry-run
  const publicDry = await runMotionTransferPublicDryRun({
    motion: motionInput,
    workspaceId,
    projectId,
    correlationId,
    at,
    budgetLimitMinor: options.budgetLimitMinor,
    registry,
    privacy,
    env: { ...HARNESS_ENV },
    remoteMigrationApplied: false,
  });
  redactAssert(publicDry);

  // Domain dry-run when registry present
  let domainDry: MotionTransferDryRunResult | null = null;
  if (registry) {
    const mediaResolver = createFakeMotionTransferMediaResolver();
    mediaResolver.register(motionInput.sourceVideo);
    for (const ref of motionInput.character.identityReferences) {
      mediaResolver.register(ref);
    }
    if (motionInput.character.outfitReference) {
      mediaResolver.register(motionInput.character.outfitReference);
    }
    const req: MotionTransferGenerationInput = {
      schemaVersion: "1.0.0",
      action: "motion_transfer",
      motion: motionInput,
      workspaceId,
      projectId,
      budgetLimitMinor: options.budgetLimitMinor,
      correlationId,
      at,
    };
    domainDry = await runMotionTransferGenerationDryRun(req, {
      registry,
      mediaResolver,
    });
    phases.validation = domainDry.inputValid ? "pass" : "failed";
    phases.media = domainDry.mediaResolvable ? "pass" : "failed";
    phases.registry = "pass";
    phases.router = domainDry.routeStatus === "selected" ? "pass" : "blocked";
    phases.plan = domainDry.planFingerprint ? "pass" : "failed";
  } else {
    phases.registry = "blocked";
    phases.router = "blocked";
    phases.validation = "pass";
  }

  const security = evaluateMotionSecurityGates({
    env: { ...HARNESS_ENV },
    privacy,
    nowIso: at,
    registry:
      registryMode === "synthetic_verified"
        ? { enabled: true, verificationStatus: "VERIFIED" }
        : { enabled: false, verificationStatus: "UNVERIFIED" },
    mediaValid: true,
    budgetValid: options.budgetLimitMinor === undefined || (domainDry?.budgetFits ?? true),
    remoteMigrationApplied: false,
    fakeRequested: true,
    workspaceId,
    projectWorkspaceId: workspaceId,
  });
  // Harness E2E tolerates remote_migration_absent (LOCAL_ONLY expected).
  const deniedForEnqueue = security.denied.filter(
    (d) => d !== "remote_migration_absent",
  );
  phases.securityGates =
    deniedForEnqueue.length === 0 && registryMode === "synthetic_verified"
      ? "pass"
      : "blocked";

  if (
    options.stopAfterGates ||
    !allowEnqueue ||
    deniedForEnqueue.length > 0 ||
    registryMode !== "synthetic_verified" ||
    !domainDry?.executable
  ) {
    const result: MotionE2EHarnessResult = {
      version: MOTION_TRANSFER_E2E_HARNESS_VERSION,
      phases,
      ids: {
        workspaceId,
        projectId,
        correlationId,
        runId: null,
        jobId: null,
        attemptId: null,
        reservationId: null,
        providerJobId: null,
        reviewRequestId: null,
      },
      fingerprints: {
        planFingerprint: domainDry?.planFingerprint ?? null,
        inputFingerprint: domainDry?.resolved?.inputFingerprint ?? null,
        requestFingerprint: null,
      },
      dryRun: publicDry,
      domainDryRun: domainDry
        ? {
            executable: domainDry.executable,
            selected: domainDry.selected,
            estimate: domainDry.estimate,
            planFingerprint: domainDry.planFingerprint,
            providerCalled: false,
          }
        : null,
      ledger: {
        estimateMinor: domainDry?.estimate?.amountMinor ?? estimateMinor,
        reservedMinor: null,
        committedMinor: null,
        releasedMinor: null,
        settled: false,
        reconciliationRequired: false,
      },
      counters: {
        enqueueCount: 0,
        claimCount: 0,
        providerSubmitCount: 0,
        providerPollCount: 0,
        pollResubmitCount: 0,
        automaticRetryCount: 0,
        automaticApprovalCount: 0,
        automaticMergeCount: 0,
        automaticExportCount: 0,
        maximumJobsPerInvocation: 1,
        realProviderCalls: 0,
        productionWrites: 0,
      },
      qc: {
        overallStatus: null,
        outcome: null,
        humanValidationRequired: null,
        allowedDecisions: [],
      },
      review: {
        decision: null,
        nextAllowedState: null,
        productionJobsDelta: 0,
      },
      attemptPhase: null,
      terminalState: "blocked",
      outputDescriptor: {
        providerOutputRef: null,
        mimeType: null,
        hasChecksum: false,
      },
      events,
      eventTypes: [],
      lateQuarantined: false,
      providerCalled: false,
      productionWrites: 0,
      invariants: {
        maximumJobsPerInvocation: 1,
        providerSubmitCount: 0,
        pollResubmitCount: 0,
        automaticRetryCount: 0,
        automaticApprovalCount: 0,
        automaticMergeCount: 0,
        automaticExportCount: 0,
        realProviderCalls: 0,
        productionWrites: 0,
      },
    };
    redactAssert(result);
    return Object.freeze(result);
  }

  // ── Enqueue + worker path ──────────────────────────────────────────────
  const clk = clock(at);
  const runId = `run-mt012-${correlationId.slice(-8)}`;
  const attemptId = `att-mt012-1`;
  const reservationId = `res-mt012-1`;
  const queue = createMemoryJobQueue(clk.nowIso);
  const budget = createMemoryBudgetPort(options.budgetAvailableMinor ?? 10_000);
  const attempts = createMemoryMotionTransferAttemptStore();

  const estimate = {
    schemaVersion: "1.0.0" as const,
    currency: "USD",
    estimatedCostMinor: estimateMinor,
    durationSeconds: motionInput.output.durationSeconds ?? 8,
    pricingUnit: "second" as const,
    mode: "firm" as const,
    pricingStrategy: "per_second",
    pricingVersion: "mt012-synth",
    providerId: FAKE_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
    capability: "video.motion_transfer" as const,
  };

  const reserveResult = await budget.reserve({
    reservationId,
    runId,
    sceneId: "motion",
    stepId: "motion_transfer",
    attemptId,
    amount: money(reservedMinor, "USD"),
    currency: "USD",
  });
  const reservedOk = reserveResult.status === "reserved";
  phases.reservation = reservedOk ? "pass" : "blocked";

  if (!reservedOk) {
    const result: MotionE2EHarnessResult = {
      version: MOTION_TRANSFER_E2E_HARNESS_VERSION,
      phases,
      ids: {
        workspaceId,
        projectId,
        correlationId,
        runId,
        jobId: null,
        attemptId,
        reservationId: null,
        providerJobId: null,
        reviewRequestId: null,
      },
      fingerprints: {
        planFingerprint: domainDry.planFingerprint ?? null,
        inputFingerprint: domainDry.resolved?.inputFingerprint ?? null,
        requestFingerprint: null,
      },
      dryRun: publicDry,
      domainDryRun: {
        executable: domainDry.executable,
        selected: domainDry.selected,
        estimate: domainDry.estimate,
        planFingerprint: domainDry.planFingerprint,
        providerCalled: false,
      },
      ledger: {
        estimateMinor,
        reservedMinor: null,
        committedMinor: null,
        releasedMinor: null,
        settled: false,
        reconciliationRequired: false,
      },
      counters: {
        enqueueCount: 0,
        claimCount: 0,
        providerSubmitCount: 0,
        providerPollCount: 0,
        pollResubmitCount: 0,
        automaticRetryCount: 0,
        automaticApprovalCount: 0,
        automaticMergeCount: 0,
        automaticExportCount: 0,
        maximumJobsPerInvocation: 1,
        realProviderCalls: 0,
        productionWrites: 0,
      },
      qc: {
        overallStatus: null,
        outcome: null,
        humanValidationRequired: null,
        allowedDecisions: [],
      },
      review: {
        decision: null,
        nextAllowedState: null,
        productionJobsDelta: 0,
      },
      attemptPhase: null,
      terminalState: "budget_blocked",
      outputDescriptor: {
        providerOutputRef: null,
        mimeType: null,
        hasChecksum: false,
      },
      events,
      eventTypes: [],
      lateQuarantined: false,
      providerCalled: false,
      productionWrites: 0,
      invariants: {
        maximumJobsPerInvocation: 1,
        providerSubmitCount: 0,
        pollResubmitCount: 0,
        automaticRetryCount: 0,
        automaticApprovalCount: 0,
        automaticMergeCount: 0,
        automaticExportCount: 0,
        realProviderCalls: 0,
        productionWrites: 0,
      },
    };
    redactAssert(result);
    return Object.freeze(result);
  }

  seedMotionTransferAttempt(attempts, {
    attemptId,
    jobId: "pending",
    runId,
    reservationId,
    reservedMinor,
    estimate,
    motionInput,
    mediaBoundary: {
      sourceVideoRef: "ref:source-opaque",
      identityRefs: ["ref:id-opaque-1"],
    },
  });

  await queue.enqueue({
    runId,
    projectId,
    sceneId: "motion",
    stepId: "step-mt",
    attemptId,
    action: "motion_transfer",
    providerId: FAKE_MOTION_TRANSFER_PROVIDER_ID,
    modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
    availableAt: at,
    payloadRef: {
      planRevisionId: domainDry.planFingerprint ?? "plan-mt012",
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
  phases.enqueue = "pass";
  const jobId = [...queue.jobs.values()][0]!.id;
  const rec = attempts.get(attemptId)!;
  rec.jobId = jobId;
  attempts.save(rec);

  const provider = createFakeMotionTransferProvider({
    scenario: options.providerScenario ?? {
      kind: "success_async",
      pollSequence: ["queued", "running", "succeeded"],
    },
    estimateCostMinor: options.providerEstimateCostMinor,
    env: { ...HARNESS_ENV, NODE_ENV: "test" },
  });

  const orchestrator = createMotionTransferWorkerOrchestrator({
    provider,
    budget,
    attempts,
    registryProfile: {
      enabled: true,
      paidExecution: true,
      status: "available",
    },
    privacyDecisions: PRIVACY_LEGACY_OK,
    env: { ...HARNESS_ENV },
    events: {
      emit: (e) => {
        workerEvents.push(e);
        events.push({ type: e.type, correlationId: e.correlationId });
      },
    },
    simulateCrashAfterSubmitBeforePersist: options.simulateCrashAfterSubmit,
    maxPolls: options.maxPolls,
    defaultPollAfterMs: 1_000,
  });

  const worker = createProductionWorker({
    policy: createWorkerPolicy({
      workerId: "mt012-worker-1",
      claimLimit: 1,
      maximumJobsPerRun: 1,
      leaseSeconds: 90,
    }),
    flags: flagsOn(),
    queue,
    director: directorStub(),
    engine: {} as GenerationEngine,
    ports: {} as ProductionPorts,
    motionTransfer: orchestrator,
  });

  let claimCount = 0;
  // submit + poll loop
  for (let i = 0; i < 12; i++) {
    const before = queue.jobs.get(jobId)!;
    if (before.status !== "queued" && before.status !== "leased") break;
    if (i > 0) clk.advanceMs(2_000);
    const r = await worker.runOnce({
      correlationId,
      actorId: "actor-mt012",
      nowIso: clk.nowIso,
      nowMs: clk.nowMs,
      nextId: clk.nextId,
    });
    claimCount += r.claimed ?? 0;
    const att = attempts.get(attemptId)!;
    if (att.submitCount > 0) phases.submit = "pass";
    if (att.pollCount > 0) phases.poll = "pass";
    if (att.phase === "submission_unknown") {
      phases.submit = "submission_unknown";
      phases.terminal = "submission_unknown";
      break;
    }
    if (att.terminal) break;
  }

  let attempt = attempts.get(attemptId)!;
  if (attempt.submitCount > 0 && attempt.phase !== "submission_unknown") {
    phases.claim = claimCount >= 1 ? "pass" : "failed";
  }

  if (options.quarantineLate && attempt.terminal) {
    quarantineMotionLateResult(attempts, attemptId);
    attempt = attempts.get(attemptId)!;
    phases.terminal = "quarantined";
  }

  // Replay terminal for idempotence
  if (options.replayAfterComplete && attempt.phase === "qc_pending") {
    await orchestrator.processClaimedJob(
      {
        jobId,
        projectId,
        runId,
        sceneId: "motion",
        stepId: "step-mt",
        attemptId,
        action: "motion_transfer",
        providerId: FAKE_MOTION_TRANSFER_PROVIDER_ID,
        modelId: FAKE_MOTION_TRANSFER_MODEL_ID,
        leaseToken: "replay",
        leasedBy: "mt012-worker-1",
        payload: {
          planRevisionId: domainDry.planFingerprint ?? "plan-mt012",
          scenePackageSceneId: "motion",
          mode: "poll",
          externalJobId: attempt.providerJobId,
        },
      },
      {
        workerId: "mt012-worker-1",
        leaseToken: "replay",
        leasedAt: at,
      },
      {
        correlationId,
        actorId: "actor-mt012",
        nowIso: clk.nowIso,
        nextId: clk.nextId,
        paidGenerationEnabled: true,
      },
    );
  }

  attempt = attempts.get(attemptId)!;

  let qcOverall: string | null = null;
  let qcOutcome: string | null = null;
  let humanValidationRequired: boolean | null = null;
  let allowedDecisions: string[] = [];
  let reviewDecision: string | null = null;
  let nextAllowedState: string | null = null;
  let productionJobsDelta = 0;
  let reviewRequestId: string | null = null;
  let outputMime: string | null = null;
  let hasChecksum = false;

  if (attempt.phase === "qc_pending" && attempt.outputRef) {
    phases.output = "pass";
    phases.ingest = "pass";
    const reports = createMemoryMotionQcReportStore();
    const qcOrch = createMotionQcOrchestrator({
      measurements: createFakeMotionQcMeasurementPort({
        env: { ...HARNESS_ENV, NODE_ENV: "test" },
        ...options.qcMeasurementOverrides,
      }),
      reports,
      events: {
        emit: (e) => {
          qcEvents.push(e);
          events.push({ type: e.type, correlationId: e.correlationId });
        },
      },
      defaultPolicy: options.qcPolicy ?? createSyntheticMotionQcPolicy(),
    });

    const output = {
      providerOutputRef: attempt.outputRef,
      mimeType: options.qcOutputMimeType ?? "video/mp4",
      sizeBytes: 1_024_000,
      durationSeconds: motionInput.output.durationSeconds ?? 8,
      width: 1080,
      height: 1920,
      fps: 24,
      providerChecksum: "sha256:mt012-synth-out",
      completedAt: at,
    };
    outputMime = output.mimeType;
    hasChecksum = Boolean(output.providerChecksum);

    const qcResult = await qcOrch.evaluate({
      attempt,
      output,
      motionInput,
      fidelity: motionInput.motion.fidelity,
      policy: options.qcPolicy,
      workspaceId,
      projectId,
      correlationId,
      actorId: "actor-mt012",
      nowIso: clk.nowIso(),
    });

    applyMotionQcHandoffToAttempt(attempt, qcResult.handoff);
    attempts.save(attempt);

    const policy = options.qcPolicy ?? createSyntheticMotionQcPolicy();
    const effectiveQc: MotionQcResult =
      options.reviewQcInject ?? qcResult.result;
    const effectiveOutcome =
      options.reviewOutcomeInject ??
      (options.reviewQcInject
        ? effectiveQc.overallStatus === "retry"
          ? "retry_recommended"
          : effectiveQc.overallStatus === "reject"
            ? "needs_review"
            : qcResult.handoff.outcome
        : qcResult.handoff.outcome);

    const reviewReport = options.reviewQcInject
      ? buildMotionQcQualityReport({
          result: effectiveQc,
          policy,
          measurementVersion: MOTION_QC_MEASUREMENT_SET_VERSION,
          runId,
          jobId,
          attemptId,
          outputRef: attempt.outputRef,
          correlationId,
          createdBy: "actor-mt012",
          createdAt: at,
        })
      : qcResult.report;

    qcOverall = effectiveQc.overallStatus;
    qcOutcome = effectiveOutcome;
    humanValidationRequired = effectiveQc.humanValidationRequired;
    phases.qc =
      qcOutcome === "needs_review"
        ? "needs_review"
        : qcOutcome === "retry_recommended"
          ? "failed"
          : qcOutcome === "qc_passed"
            ? "pass"
            : qcOutcome === "rejected"
              ? "failed"
              : "failed";

    if (
      qcOutcome === "needs_review" ||
      qcOutcome === "retry_recommended" ||
      qcOutcome === "rejected" ||
      humanDecision === "rejected"
    ) {
      const sessions = createMemoryMotionReviewSessionStore();
      const decisions = createMemoryMotionReviewDecisionStore();
      seedMotionReviewSession(sessions, {
        workspaceId,
        projectId,
        runId,
        jobId,
        attemptId,
        report: reviewReport,
        policy,
        outcome:
          qcOutcome === "retry_recommended"
            ? "retry_recommended"
            : "needs_review",
        qualityReportStale: false,
        lateQuarantined: attempt.lateQuarantined,
        evidence: qcResult.evidence,
      });
      const reviewOrch = createMotionReviewOrchestrator({
        sessions,
        decisions,
        events: {
          emit: (e) => {
            reviewEvents.push(e);
            events.push({ type: e.type, correlationId: e.correlationId });
          },
        },
        capabilityEnabled: true,
      });
      const ctx = await reviewOrch.getContext({
        projectId,
        workspaceId,
        correlationId,
      });
      if (ctx.status === "ok") {
        allowedDecisions = [...ctx.context.allowedDecisions];
      }

      if (humanDecision !== "none") {
        reviewRequestId = `req-mt012-${humanDecision}`;
        const comment =
          humanDecision === "rejected" ||
          humanDecision === "request_new_reference"
            ? options.reviewComment ??
              "Synthetic review comment — opaque defect note."
            : options.reviewComment;
        const recorded = await reviewOrch.recordDecision({
          projectId,
          workspaceId,
          decision: humanDecision,
          expectedRevision: 1,
          reviewRequestId,
          humanAttestation: humanDecision === "approved",
          confirmation: true,
          comment,
          actorId: "actor-mt012",
          correlationId,
          nowIso: clk.nowIso(),
        });
        if (recorded.status === "recorded") {
          reviewDecision = humanDecision;
          nextAllowedState = recorded.nextAllowedState;
          productionJobsDelta = recorded.sideEffects.productionJobsDelta;
          phases.review =
            humanDecision === "approved"
              ? "approved"
              : humanDecision === "rejected"
                ? "rejected"
                : humanDecision === "request_new_reference"
                  ? "request_new_reference"
                  : "retry_intent";
          phases.terminal = phases.review;
        } else {
          phases.review = "failed";
          phases.terminal = "review_failed";
        }
      } else {
        phases.review = "needs_review";
        phases.terminal = "needs_review";
      }
    } else {
      phases.terminal = phases.qc;
    }
  } else if (attempt.phase === "submission_unknown") {
    phases.terminal = "submission_unknown";
  } else if (attempt.phase === "timed_out") {
    phases.poll = "timed_out";
    phases.terminal = options.quarantineLate ? "quarantined" : "timed_out";
  } else if (attempt.phase === "late_quarantined" || attempt.lateQuarantined) {
    phases.terminal = "quarantined";
  } else if (attempt.terminal) {
    phases.terminal =
      attempt.phase === "provider_failed" ? "failed" : attempt.phase as MotionE2EPhaseStatus;
    if (attempt.submitCount > 0) phases.submit = "pass";
  }

  if (options.hostileInjection) {
    events.push({
      type: "motion.security.hostile_probe",
      correlationId: options.hostileInjection,
    });
  }

  const committed = budget.committed.get(reservationId);
  const released = budget.released.get(reservationId);
  const finalAttempt: MotionTransferAttemptRecord = attempts.get(attemptId)!;

  const allEventTypes = [
    ...workerEvents.map((e) => e.type),
    ...qcEvents.map((e) => e.type),
    ...reviewEvents.map((e) => e.type),
  ];

  const result: MotionE2EHarnessResult = {
    version: MOTION_TRANSFER_E2E_HARNESS_VERSION,
    phases,
    ids: {
      workspaceId,
      projectId,
      correlationId,
      runId,
      jobId,
      attemptId,
      reservationId,
      providerJobId: finalAttempt.providerJobId ?? null,
      reviewRequestId,
    },
    fingerprints: {
      planFingerprint: domainDry.planFingerprint ?? null,
      inputFingerprint: domainDry.resolved?.inputFingerprint ?? null,
      requestFingerprint: finalAttempt.requestFingerprint ?? null,
    },
    dryRun: publicDry,
    domainDryRun: {
      executable: domainDry.executable,
      selected: domainDry.selected,
      estimate: domainDry.estimate,
      planFingerprint: domainDry.planFingerprint,
      providerCalled: false,
    },
    ledger: {
      estimateMinor,
      reservedMinor,
      committedMinor: committed?.amount.amountMinor ?? null,
      releasedMinor: released?.amountMinor ?? null,
      settled: finalAttempt.ledgerSettled,
      reconciliationRequired: finalAttempt.reconciliationRequired,
    },
    counters: {
      enqueueCount: 1,
      claimCount,
      providerSubmitCount: provider.counters.submit,
      providerPollCount: provider.counters.poll,
      pollResubmitCount: finalAttempt.resubmitCount,
      automaticRetryCount: 0,
      automaticApprovalCount: 0,
      automaticMergeCount: 0,
      automaticExportCount: 0,
      maximumJobsPerInvocation: 1,
      realProviderCalls: 0,
      productionWrites: 0,
    },
    qc: {
      overallStatus: qcOverall,
      outcome: qcOutcome,
      humanValidationRequired,
      allowedDecisions,
    },
    review: {
      decision: reviewDecision,
      nextAllowedState,
      productionJobsDelta,
    },
    attemptPhase: finalAttempt.phase,
    terminalState: phases.terminal,
    outputDescriptor: {
      providerOutputRef: finalAttempt.outputRef ?? null,
      mimeType: outputMime,
      hasChecksum,
    },
    events: events.map((e) => ({
      type: e.type,
      correlationId:
        typeof e.correlationId === "string" &&
        !/fal\.|Bearer|https?:|data:|base64/i.test(e.correlationId)
          ? e.correlationId
          : e.correlationId
            ? "[REDACTED]"
            : undefined,
    })),
    eventTypes: allEventTypes,
    lateQuarantined: finalAttempt.lateQuarantined,
    providerCalled: false,
    productionWrites: 0,
    invariants: {
      maximumJobsPerInvocation: 1,
      providerSubmitCount: provider.counters.submit,
      pollResubmitCount: finalAttempt.resubmitCount,
      automaticRetryCount: 0,
      automaticApprovalCount: 0,
      automaticMergeCount: 0,
      automaticExportCount: 0,
      realProviderCalls: 0,
      productionWrites: 0,
    },
  };

  redactAssert(result);
  return Object.freeze(result);
}

export { HARNESS_ENV as MT012_HARNESS_ENV };
