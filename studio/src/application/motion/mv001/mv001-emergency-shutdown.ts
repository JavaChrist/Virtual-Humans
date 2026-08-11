/**
 * MT-013F — Emergency closure for MV-001 (testable without Vercel).
 *
 * Flags OFF in `finally` must NOT abandon an already-submitted fal job:
 * - paid/provider/exception OFF → block new submits/enqueues
 * - worker can stay in poll-only mode for the in-flight attempt
 * - async job state preserved for controlled polling / reconciliation
 */

import { deepFreeze } from "@/domain/motion/freeze";
import { getMotionTransferFlags } from "@/infrastructure/providers/motion-transfer/motion-transfer-flags";
import { createMv001RegistryException } from "./mv001-registry-exception";

export const MV001_EMERGENCY_SHUTDOWN_VERSION = "mt013f-mv001-shutdown-1.0.0" as const;

export type Mv001FlagEnvPatch = {
  MOTION_TRANSFER_ENABLED: "0";
  MOTION_TRANSFER_PAID_ENABLED: "0";
  MOTION_TRANSFER_FAL_ENABLED: "0";
  /** Worker OFF for new work; poll-only uses retainAsyncJobForPolling. */
  MOTION_TRANSFER_WORKER_ENABLED: "0";
};

export type Mv001EmergencyShutdownResult = {
  schemaVersion: typeof MV001_EMERGENCY_SHUTDOWN_VERSION;
  flagsOff: Mv001FlagEnvPatch;
  workerOff: true;
  paidOff: true;
  providerFalOff: true;
  registryExceptionOff: true;
  runtimeUnavailable: true;
  /** Keep async attempt for polling — do not drop provider request id. */
  retainAsyncJobForPolling: true;
  allowNewEnqueue: false;
  allowNewSubmit: false;
  allowPollExisting: true;
  ledgerReconciliationRequired: true;
  lateResultPolicy: "quarantine";
  signedUrlRevocation: "revoke_in_memory_only";
  abandonedBilledJob: false;
};

/** Env patch that closes all Motion flags (local / test — not Vercel). */
export function buildMv001EmergencyFlagOffPatch(): Mv001FlagEnvPatch {
  return {
    MOTION_TRANSFER_ENABLED: "0",
    MOTION_TRANSFER_PAID_ENABLED: "0",
    MOTION_TRANSFER_FAL_ENABLED: "0",
    MOTION_TRANSFER_WORKER_ENABLED: "0",
  };
}

/**
 * Run emergency closure. Optional `finally` body receives the OFF env.
 * Does not call Vercel or mutate remote env.
 */
export function runMv001EmergencyShutdown(input?: {
  hadSubmittedAsyncJob?: boolean;
  onFinally?: (env: Mv001FlagEnvPatch) => void;
}): Readonly<Mv001EmergencyShutdownResult> {
  const flagsOff = buildMv001EmergencyFlagOffPatch();
  try {
    // Deactivate scoped exception (local object — Production registry stays disabled).
    createMv001RegistryException({ exceptionActive: false });
  } finally {
    input?.onFinally?.(flagsOff);
  }

  const snap = getMotionTransferFlags(flagsOff);
  const runtimeUnavailable =
    !snap.motionTransferEnabled &&
    !snap.motionTransferPaidEnabled &&
    !snap.motionTransferFalEnabled &&
    !snap.motionTransferWorkerEnabled;

  return deepFreeze({
    schemaVersion: MV001_EMERGENCY_SHUTDOWN_VERSION,
    flagsOff,
    workerOff: true,
    paidOff: true,
    providerFalOff: true,
    registryExceptionOff: true,
    runtimeUnavailable: runtimeUnavailable as true,
    retainAsyncJobForPolling: true,
    allowNewEnqueue: false,
    allowNewSubmit: false,
    allowPollExisting: true,
    ledgerReconciliationRequired: true,
    lateResultPolicy: "quarantine",
    signedUrlRevocation: "revoke_in_memory_only",
    abandonedBilledJob: false,
  });
}

/**
 * After shutdown: polling an already-submitted job is allowed; resubmit is not.
 */
export function canPollAfterMv001Shutdown(input: {
  shutdown: Mv001EmergencyShutdownResult;
  attemptSubmitCount: number;
  phase: string;
}): { pollAllowed: boolean; resubmitAllowed: false; reason: string } {
  if (!input.shutdown.allowPollExisting) {
    return {
      pollAllowed: false,
      resubmitAllowed: false,
      reason: "shutdown_poll_disabled",
    };
  }
  if (input.attemptSubmitCount < 1) {
    return {
      pollAllowed: false,
      resubmitAllowed: false,
      reason: "no_submitted_job",
    };
  }
  if (input.phase === "submission_unknown") {
    return {
      pollAllowed: true,
      resubmitAllowed: false,
      reason: "submission_unknown_reconcile_only",
    };
  }
  return {
    pollAllowed: true,
    resubmitAllowed: false,
    reason: "poll_existing_async_job",
  };
}
