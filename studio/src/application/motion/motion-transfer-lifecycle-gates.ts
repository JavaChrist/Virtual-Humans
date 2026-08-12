/**
 * MT-013K-WIRE — Separate Motion Transfer admission / submit / poll permissions.
 *
 * After a providerJobId is durably persisted:
 * - admission of new benchmarks = OFF
 * - new submit = OFF
 * - poll of the already-submitted providerJobId = ON
 * Closing flags must never abandon a billed async job.
 */

import { deepFreeze } from "@/domain/motion/freeze";
import {
  evaluateMotionTransferWorkerGates,
  type EvaluateMotionTransferWorkerGatesInput,
  type MotionTransferWorkerGateEvaluation,
} from "./motion-transfer-worker-gates";

export const MOTION_TRANSFER_LIFECYCLE_GATES_VERSION =
  "mt013k-lifecycle-1.0.0" as const;

export type MotionTransferAdmissionEvaluation = {
  allowed: boolean;
  reason: string;
  admissionOpen: boolean;
  submitAllowed: boolean;
};

export type MotionTransferPollEvaluation = {
  allowed: boolean;
  resubmitAllowed: false;
  reason: string;
};

export type MotionTransferLifecycleController = {
  readonly version: typeof MOTION_TRANSFER_LIFECYCLE_GATES_VERSION;
  /** New enqueue / new benchmark slot. */
  evaluateAdmission(): MotionTransferAdmissionEvaluation;
  /** First (and only) provider submit for an authorized attempt. */
  evaluateSubmit(): MotionTransferAdmissionEvaluation;
  /** Poll an already-persisted providerJobId — never resubmit. */
  evaluatePoll(input: {
    providerJobId?: string;
    submitCount: number;
    phase: string;
  }): MotionTransferPollEvaluation;
  /** Close admission + new submit after durable providerJobId persist. */
  onSubmitPersisted(attemptId: string): void;
  /** Explicit emergency close (flags OFF / shutdown) — poll retained. */
  closeAdmissionAndSubmit(reason?: string): void;
  snapshot(): {
    admissionOpen: boolean;
    submitAllowed: boolean;
    submittedAttemptIds: readonly string[];
    closeReason?: string;
  };
};

/**
 * Process-scoped lifecycle latch for Production Motion worker.
 * Starts open; closes after first persisted submit.
 */
export function createMotionTransferLifecycleController(): MotionTransferLifecycleController {
  let admissionOpen = true;
  let submitAllowed = true;
  let closeReason: string | undefined;
  const submittedAttemptIds: string[] = [];

  function baseAdmission(
    kind: "admission" | "submit",
  ): MotionTransferAdmissionEvaluation {
    if (kind === "admission" && !admissionOpen) {
      return {
        allowed: false,
        reason: closeReason ?? "motion_admission_closed",
        admissionOpen,
        submitAllowed,
      };
    }
    if (kind === "submit" && !submitAllowed) {
      return {
        allowed: false,
        reason: closeReason ?? "motion_submit_closed",
        admissionOpen,
        submitAllowed,
      };
    }
    return {
      allowed: true,
      reason: kind === "admission" ? "admission_open" : "submit_open",
      admissionOpen,
      submitAllowed,
    };
  }

  return {
    version: MOTION_TRANSFER_LIFECYCLE_GATES_VERSION,
    evaluateAdmission: () => baseAdmission("admission"),
    evaluateSubmit: () => baseAdmission("submit"),
    evaluatePoll(input) {
      if (input.phase === "submission_unknown") {
        return deepFreeze({
          allowed: true,
          resubmitAllowed: false as const,
          reason: "submission_unknown_reconcile_only",
        });
      }
      if (input.submitCount < 1 || !input.providerJobId?.trim()) {
        return deepFreeze({
          allowed: false,
          resubmitAllowed: false as const,
          reason: "poll_requires_persisted_provider_job",
        });
      }
      // Poll allowed even when admission/submit are closed (post-submit / shutdown).
      return deepFreeze({
        allowed: true,
        resubmitAllowed: false as const,
        reason: "poll_existing_async_job",
      });
    },
    onSubmitPersisted(attemptId: string) {
      if (!submittedAttemptIds.includes(attemptId)) {
        submittedAttemptIds.push(attemptId);
      }
      admissionOpen = false;
      submitAllowed = false;
      closeReason = "closed_after_submit_persisted";
    },
    closeAdmissionAndSubmit(reason = "motion_admission_closed") {
      admissionOpen = false;
      submitAllowed = false;
      closeReason = reason;
    },
    snapshot() {
      return {
        admissionOpen,
        submitAllowed,
        submittedAttemptIds: [...submittedAttemptIds],
        closeReason,
      };
    },
  };
}

/** Submit path: worker gates AND lifecycle submit latch. */
export function evaluateMotionTransferSubmitPath(input: {
  workerGates: EvaluateMotionTransferWorkerGatesInput;
  lifecycle?: MotionTransferLifecycleController;
}): {
  ok: boolean;
  reason?: string;
  worker: MotionTransferWorkerGateEvaluation;
  lifecycle: MotionTransferAdmissionEvaluation;
} {
  const lifecycle = input.lifecycle?.evaluateSubmit() ?? {
    allowed: true,
    reason: "lifecycle_unbounded",
    admissionOpen: true,
    submitAllowed: true,
  };
  const worker = evaluateMotionTransferWorkerGates(input.workerGates);
  if (!lifecycle.allowed) {
    return {
      ok: false,
      reason: lifecycle.reason,
      worker,
      lifecycle,
    };
  }
  if (!worker.ok) {
    return {
      ok: false,
      reason: worker.reason,
      worker,
      lifecycle,
    };
  }
  return { ok: true, worker, lifecycle };
}
