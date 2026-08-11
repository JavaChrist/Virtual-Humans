/**
 * Strict synthetic Motion Transfer provider fake (MT-006).
 * TEST_ONLY — no network. Forbidden on Vercel/Production without harness.
 */

import { createHash } from "node:crypto";
import {
  MotionTransferDomainError,
  assertEstimateUsableForPaidReservation,
  assertProviderOutputDescriptorSafe,
  createProviderErrorEvidence,
  deepFreeze,
  mapProviderLifecycleStatus,
  MOTION_TRANSFER_PROVIDER_PORT_VERSION,
  type MotionTransferCancelResult,
  type MotionTransferEstimate,
  type MotionTransferJobStatus,
  type MotionTransferProviderCallCounters,
  type MotionTransferProviderContext,
  type MotionTransferProviderPort,
  type MotionTransferStatus,
  type MotionTransferSubmission,
} from "@/domain/motion";
import { assertMotionTransferFakeAdapterAllowed } from "./assert-fake-allowed";

export const FAKE_MOTION_TRANSFER_PROVIDER_ID = "fake-motion-transfer" as const;
export const FAKE_MOTION_TRANSFER_MODEL_ID = "synthetic-motion-v1" as const;

export type FakeMotionTransferScenario =
  | { kind: "success_sync" }
  | {
      kind: "success_async";
      /** Raw provider statuses before mapping (e.g. running → processing). */
      pollSequence?: readonly string[];
    }
  | { kind: "fail_submit"; code?: "provider_invalid_request" | "provider_failed" }
  | {
      kind: "fail_poll";
      code?:
        | "provider_failed"
        | "provider_rate_limited"
        | "provider_quota_exceeded"
        | "provider_timeout"
        | "provider_output_invalid";
    }
  | { kind: "rate_limit_submit" }
  | { kind: "quota_submit" }
  | { kind: "timeout_poll" }
  | { kind: "unknown_status_poll" }
  | { kind: "cancel_supported" }
  | { kind: "cancel_unsupported" }
  | { kind: "late_after_cancel" }
  | { kind: "job_not_found" };

export type FakeMotionTransferAdapterOptions = {
  scenario?: FakeMotionTransferScenario;
  providerId?: string;
  modelId?: string;
  /** Firm estimate amount (minor). Default deterministic from duration. */
  estimateCostMinor?: number;
  currency?: string;
  /** When true, estimate() throws provider_not_configured (Production-like). */
  refuseEstimate?: boolean;
  env?: Record<string, string | undefined>;
  nowIso?: () => string;
};

type JobRecord = {
  providerJobId: string;
  idempotencyKey: string;
  status: MotionTransferJobStatus;
  pollIndex: number;
  pollSequence: MotionTransferJobStatus[];
  cancelled: boolean;
  lateAfterCancel: boolean;
  submitCount: number;
  costMinor: number;
  currency: string;
  durationSeconds: number;
};

function stableJobId(idempotencyKey: string, providerId: string): string {
  const h = createHash("sha256")
    .update(`mt-fake|${providerId}|${idempotencyKey}`)
    .digest("hex")
    .slice(0, 24);
  return `fake-mt-${h}`;
}

function checkAbort(context: MotionTransferProviderContext): void {
  if (context.signal?.aborted) {
    throw new MotionTransferDomainError("cancelled", "Opération annulée.");
  }
}

function checkDeadline(context: MotionTransferProviderContext, now: string): void {
  if (context.deadlineAt && Date.parse(context.deadlineAt) <= Date.parse(now)) {
    throw new MotionTransferDomainError(
      "provider_timeout",
      "Deadline globale dépassée.",
      { diagnostic: "deadline_exceeded" },
    );
  }
}

/**
 * Create a TEST_ONLY Motion Transfer fake adapter.
 * Throws if Vercel/Production guards fail.
 */
export function createFakeMotionTransferProvider(
  options: FakeMotionTransferAdapterOptions = {},
): MotionTransferProviderPort & {
  readonly counters: MotionTransferProviderCallCounters;
  readonly scenario: FakeMotionTransferScenario;
  /** Inspect internal job (tests only). */
  getJob(providerJobId: string): JobRecord | undefined;
} {
  const guard = assertMotionTransferFakeAdapterAllowed(options.env);
  if (!guard.ok) {
    throw new MotionTransferDomainError(
      "provider_not_configured",
      "Fake Motion Transfer interdit hors harness de test.",
      { diagnostic: `fake_forbidden:${guard.reason}` },
    );
  }

  const providerId = options.providerId ?? FAKE_MOTION_TRANSFER_PROVIDER_ID;
  const modelId = options.modelId ?? FAKE_MOTION_TRANSFER_MODEL_ID;
  const scenario: FakeMotionTransferScenario = options.scenario ?? {
    kind: "success_async",
    pollSequence: ["queued", "running", "succeeded"],
  };
  const currency = options.currency ?? "USD";
  const nowIso = options.nowIso ?? (() => new Date().toISOString());

  const counters: MotionTransferProviderCallCounters = {
    estimate: 0,
    submit: 0,
    poll: 0,
    cancel: 0,
    network: 0,
  };

  const byIdem = new Map<string, string>();
  const jobs = new Map<string, JobRecord>();

  function defaultPollSequence(): MotionTransferJobStatus[] {
    if (scenario.kind === "success_sync") return ["completed"];
    if (scenario.kind === "timeout_poll") {
      return ["queued", "processing", "timed_out"];
    }
    if (scenario.kind === "fail_poll") {
      return ["queued", "processing", "failed"];
    }
    if (scenario.kind === "unknown_status_poll") {
      return ["queued"];
    }
    if (scenario.kind === "success_async") {
      const raw = scenario.pollSequence ?? ["queued", "running", "succeeded"];
      return raw.map((s) => mapProviderLifecycleStatus(s));
    }
    if (
      scenario.kind === "cancel_supported" ||
      scenario.kind === "late_after_cancel"
    ) {
      return ["queued", "processing", "completed"];
    }
    return ["queued", "processing", "completed"];
  }

  const port: MotionTransferProviderPort & {
    readonly counters: MotionTransferProviderCallCounters;
    readonly scenario: FakeMotionTransferScenario;
    getJob(providerJobId: string): JobRecord | undefined;
  } = {
    providerId,
    supportedModelIds: [modelId],
    portVersion: MOTION_TRANSFER_PROVIDER_PORT_VERSION,
    counters,
    scenario,
    getJob(id) {
      return jobs.get(id);
    },

    async estimate(input, context) {
      counters.estimate += 1;
      checkAbort(context);
      checkDeadline(context, nowIso());
      if (options.refuseEstimate) {
        throw new MotionTransferDomainError(
          "provider_not_configured",
          "Estimation Motion Transfer indisponible.",
        );
      }
      const duration = input.billableDurationSeconds;
      const cost =
        options.estimateCostMinor ??
        Math.max(0, Math.floor(duration * 12));
      const estimate: MotionTransferEstimate = {
        schemaVersion: "1.0.0",
        currency: input.currency || currency,
        estimatedCostMinor: cost,
        durationSeconds: duration,
        pricingUnit: "second",
        mode: "firm",
        pricingStrategy: "synthetic-per-second",
        pricingVersion: "fake-mt-pricing-v1",
        assumptions: ["synthetic", "no_network"],
        providerId,
        modelId,
        capability: "video.motion_transfer",
        capabilityVersion: "1.0.0",
        notes: ["fake_adapter"],
      };
      return deepFreeze(estimate);
    },

    async submit(input, context) {
      counters.submit += 1;
      checkAbort(context);
      const now = nowIso();
      checkDeadline(context, now);

      if (input.providerId !== providerId || input.modelId !== modelId) {
        throw new MotionTransferDomainError(
          "model_not_supported",
          "Modèle Motion Transfer non supporté par ce fake.",
        );
      }
      assertEstimateUsableForPaidReservation(input.estimate);

      if (scenario.kind === "rate_limit_submit") {
        const ev = createProviderErrorEvidence({
          code: "provider_rate_limited",
          publicMessage: "Rate limit provider.",
          httpStatus: 429,
          providerErrorCode: "rate_limited",
          stage: "submit",
          networkAttempts: 1,
        });
        throw new MotionTransferDomainError(ev.code, ev.publicMessage, {
          diagnostic: JSON.stringify(ev),
        });
      }
      if (scenario.kind === "quota_submit") {
        throw new MotionTransferDomainError(
          "provider_quota_exceeded",
          "Quota provider dépassé.",
        );
      }
      if (scenario.kind === "fail_submit") {
        throw new MotionTransferDomainError(
          scenario.code ?? "provider_failed",
          "Échec submit synthétique.",
        );
      }

      const existingId = byIdem.get(context.idempotencyKey);
      if (existingId) {
        const existing = jobs.get(existingId)!;
        existing.submitCount += 1;
        const submission: MotionTransferSubmission = {
          schemaVersion: "1.0.0",
          status: "submitted",
          providerJobId: existing.providerJobId,
          submittedAt: now,
          acceptedAt: now,
          syncOrAsync: scenario.kind === "success_sync" ? "sync" : "async",
          pollingRequired: scenario.kind !== "success_sync",
          requestMetadataRedacted: {
            idempotentReplay: true,
            attempt: context.attempt,
            mediaRefCount:
              1 +
              input.mediaBoundary.identityRefs.length +
              (input.mediaBoundary.outfitRef ? 1 : 0),
          },
        };
        return deepFreeze(submission);
      }

      const providerJobId = stableJobId(context.idempotencyKey, providerId);
      const seq = defaultPollSequence();
      const initial: MotionTransferJobStatus =
        scenario.kind === "success_sync" ? "completed" : seq[0] ?? "queued";

      const record: JobRecord = {
        providerJobId,
        idempotencyKey: context.idempotencyKey,
        status: initial,
        pollIndex: 0,
        pollSequence: seq,
        cancelled: false,
        lateAfterCancel: scenario.kind === "late_after_cancel",
        submitCount: 1,
        costMinor: input.estimate.estimatedCostMinor,
        currency: input.estimate.currency,
        durationSeconds:
          input.motion.output.durationSeconds ??
          input.estimate.durationSeconds ??
          8,
      };
      byIdem.set(context.idempotencyKey, providerJobId);
      jobs.set(providerJobId, record);

      const submission: MotionTransferSubmission = {
        schemaVersion: "1.0.0",
        status: "submitted",
        providerJobId,
        submittedAt: now,
        acceptedAt: now,
        syncOrAsync: scenario.kind === "success_sync" ? "sync" : "async",
        pollingRequired: scenario.kind !== "success_sync",
        estimatedCompletionAt:
          scenario.kind === "success_sync"
            ? now
            : new Date(Date.parse(now) + 60_000).toISOString(),
        requestMetadataRedacted: {
          attempt: context.attempt,
          correlationId: context.correlationId,
          reviewPolicyKeys: input.reviewPolicyProvenance
            ? Object.keys(input.reviewPolicyProvenance)
            : [],
          mediaRefCount:
            1 +
            input.mediaBoundary.identityRefs.length +
            (input.mediaBoundary.outfitRef ? 1 : 0),
        },
      };
      return deepFreeze(submission);
    },

    async poll(input, context) {
      counters.poll += 1;
      checkAbort(context);
      const now = nowIso();
      checkDeadline(context, now);

      if (scenario.kind === "job_not_found") {
        throw new MotionTransferDomainError(
          "provider_job_not_found",
          "Job provider introuvable.",
        );
      }

      const job = jobs.get(input.providerJobId);
      if (!job) {
        throw new MotionTransferDomainError(
          "provider_job_not_found",
          "Job provider introuvable.",
        );
      }

      if (job.cancelled) {
        if (job.lateAfterCancel && job.pollIndex < job.pollSequence.length) {
          // Late result after cancel — surface completed with late marker via failed quarantine path
          job.pollIndex += 1;
          const status: MotionTransferStatus = {
            schemaVersion: "1.0.0",
            status: "failed",
            providerJobId: job.providerJobId,
            errorCode: "late_result_ignored",
            updatedAt: now,
          };
          return deepFreeze(status);
        }
        return deepFreeze({
          schemaVersion: "1.0.0" as const,
          status: "cancelled" as const,
          providerJobId: job.providerJobId,
          updatedAt: now,
        });
      }

      if (scenario.kind === "unknown_status_poll" && job.pollIndex >= 1) {
        mapProviderLifecycleStatus("weird_provider_state_xyz");
      }

      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled" ||
        job.status === "timed_out"
      ) {
        return terminalStatus(job, now, scenario);
      }

      const next = job.pollSequence[Math.min(job.pollIndex, job.pollSequence.length - 1)]!;
      job.pollIndex += 1;
      job.status = next;

      if (scenario.kind === "fail_poll" && next === "failed") {
        return deepFreeze({
          schemaVersion: "1.0.0" as const,
          status: "failed" as const,
          providerJobId: job.providerJobId,
          errorCode: scenario.code ?? "provider_failed",
          updatedAt: now,
        });
      }

      if (next === "timed_out") {
        return deepFreeze({
          schemaVersion: "1.0.0" as const,
          status: "timed_out" as const,
          providerJobId: job.providerJobId,
          errorCode: "provider_timeout",
          updatedAt: now,
        });
      }

      if (next === "completed") {
        return terminalStatus(job, now, scenario);
      }

      return deepFreeze({
        schemaVersion: "1.0.0" as const,
        status: next,
        providerJobId: job.providerJobId,
        updatedAt: now,
      });
    },

    async cancel(input, context) {
      counters.cancel += 1;
      checkAbort(context);

      if (scenario.kind === "cancel_unsupported") {
        return deepFreeze({
          schemaVersion: "1.0.0" as const,
          status: "cancel_unsupported" as const,
          providerJobId: input.providerJobId,
        } satisfies MotionTransferCancelResult);
      }

      const job = jobs.get(input.providerJobId);
      if (!job) {
        throw new MotionTransferDomainError(
          "provider_job_not_found",
          "Job provider introuvable.",
        );
      }

      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "timed_out" ||
        job.status === "cancelled"
      ) {
        return deepFreeze({
          schemaVersion: "1.0.0" as const,
          status: "already_terminal" as const,
          providerJobId: job.providerJobId,
        });
      }

      job.cancelled = true;
      job.status = "cancelled";
      return deepFreeze({
        schemaVersion: "1.0.0" as const,
        status: "cancelled" as const,
        providerJobId: job.providerJobId,
        lateResultExpected: job.lateAfterCancel,
      });
    },
  };

  return port;
}

function terminalStatus(
  job: JobRecord,
  now: string,
  scenario: FakeMotionTransferScenario,
): Readonly<MotionTransferStatus> {
  if (scenario.kind === "fail_poll" && job.status === "failed") {
    return deepFreeze({
      schemaVersion: "1.0.0",
      status: "failed",
      providerJobId: job.providerJobId,
      errorCode: scenario.code ?? "provider_failed",
      updatedAt: now,
    });
  }
  if (job.status === "timed_out") {
    return deepFreeze({
      schemaVersion: "1.0.0",
      status: "timed_out",
      providerJobId: job.providerJobId,
      errorCode: "provider_timeout",
      updatedAt: now,
    });
  }
  if (scenario.kind === "fail_poll" && scenario.code === "provider_output_invalid") {
    return deepFreeze({
      schemaVersion: "1.0.0",
      status: "failed",
      providerJobId: job.providerJobId,
      errorCode: "provider_output_invalid",
      updatedAt: now,
    });
  }

  const output = {
    providerOutputRef: `provider-out/${job.providerJobId}`,
    mimeType: "video/mp4",
    sizeBytes: 1024,
    durationSeconds: job.durationSeconds,
    width: 1080,
    height: 1920,
    fps: 24,
    providerChecksum: `sha256:fake-${job.providerJobId}`,
    completedAt: now,
  };
  assertProviderOutputDescriptorSafe(output);

  return deepFreeze({
    schemaVersion: "1.0.0",
    status: "completed",
    providerJobId: job.providerJobId,
    updatedAt: now,
    output,
    usage: { durationSeconds: job.durationSeconds, units: 1 },
    actualCostMinor: job.costMinor,
    currency: job.currency,
  });
}

/** @deprecated Use createFakeMotionTransferProvider */
export const createFakeMotionTransferAdapter = createFakeMotionTransferProvider;
