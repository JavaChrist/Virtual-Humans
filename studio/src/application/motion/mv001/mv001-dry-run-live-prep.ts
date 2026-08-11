/**
 * MT-013F — Future post-deploy dry-run contract for MV-001.
 * Prep evaluates local expectations; does not call fal, reserve, or write Production.
 */

import { deepFreeze } from "@/domain/motion/freeze";
import {
  MV001_ABSOLUTE_CAP_MINOR,
  MV001_BENCHMARK_ID,
  MV001_DURATION_SECONDS,
  MV001_ENDPOINT_ID,
  MV001_PRIVACY_EXPIRES_AT,
  MV001_PROVIDER_ID,
  MV001_RESERVATION_MINOR,
  buildMv001BenchmarkProfile,
} from "./mv001-benchmark-profile";
import type { Mv001BudgetSnapshot } from "./mv001-execution-gates";

export const MV001_DRY_RUN_LIVE_PREP_VERSION = "mt013f-mv001-dry-run-1.0.0" as const;

export type Mv001DryRunLivePrepInput = {
  /** Exact source commit SHA expected after deploy Auth. */
  expectedSourceCommit: string;
  observedSourceCommit: string;
  privacyAccepted5of5: boolean;
  privacyExpiresAt: string;
  nowIso: string;
  budget: Mv001BudgetSnapshot;
  providerCalled: boolean;
  reservationCount: number;
  runCount: number;
  jobCount: number;
  assetCount: number;
  workerExecuted: boolean;
};

export type Mv001DryRunLivePrepResult = {
  schemaVersion: typeof MV001_DRY_RUN_LIVE_PREP_VERSION;
  verdict: "READY_FOR_PAID_AUTH" | "NOT_READY";
  checks: readonly { id: string; pass: boolean; detail?: string }[];
  providerCalled: false;
  reservations: 0;
  runs: 0;
  jobs: 0;
  assets: 0;
  workerExecuted: false;
  profile: ReturnType<typeof buildMv001BenchmarkProfile>;
};

/**
 * Evaluate dry-run readiness for a future live gate (no network).
 * In MT-013F prep, this documents the contract; a failing commit match is expected
 * until deploy Auth lands the exact SHA.
 */
export function evaluateMv001DryRunLivePrep(
  input: Mv001DryRunLivePrepInput,
): Readonly<Mv001DryRunLivePrepResult> {
  const profile = buildMv001BenchmarkProfile();
  const privacyNotExpired =
    Date.parse(input.privacyExpiresAt) > Date.parse(input.nowIso);

  const checks = [
    {
      id: "source_commit",
      pass:
        input.expectedSourceCommit.length >= 7 &&
        input.observedSourceCommit === input.expectedSourceCommit,
      detail: "exact SHA match after deploy",
    },
    {
      id: "benchmark_profile",
      pass:
        profile.benchmarkId === MV001_BENCHMARK_ID &&
        profile.maxCalls === 1 &&
        profile.fallbacks === 0 &&
        profile.autoRetry === 0 &&
        profile.mergeExport === "disabled",
    },
    {
      id: "privacy_5_of_5",
      pass: input.privacyAccepted5of5 === true,
    },
    {
      id: "privacy_expiration",
      pass:
        privacyNotExpired &&
        input.privacyExpiresAt.startsWith("2026-09-10") &&
        MV001_PRIVACY_EXPIRES_AT.startsWith("2026-09-10"),
    },
    {
      id: "endpoint_model",
      pass:
        profile.provider === MV001_PROVIDER_ID &&
        profile.model === MV001_ENDPOINT_ID,
    },
    {
      id: "duration",
      pass: profile.durationSeconds === MV001_DURATION_SECONDS,
    },
    {
      id: "estimate_51",
      pass: profile.estimateMinor === 51,
    },
    {
      id: "reservation_62",
      pass: profile.reservationMinor === MV001_RESERVATION_MINOR,
    },
    {
      id: "absolute_cap_100",
      pass: profile.absoluteCapMinor === MV001_ABSOLUTE_CAP_MINOR,
    },
    {
      id: "budget_174_112_0_62",
      pass:
        input.budget.hardMinor === 174 &&
        input.budget.committedMinor === 112 &&
        input.budget.reservedMinor === 0 &&
        input.budget.availableMinor === 62,
    },
    {
      id: "provider_called_false",
      pass: input.providerCalled === false,
    },
    {
      id: "no_reservation",
      pass: input.reservationCount === 0,
    },
    {
      id: "no_run_job_asset",
      pass:
        input.runCount === 0 && input.jobCount === 0 && input.assetCount === 0,
    },
    {
      id: "worker_not_executed",
      pass: input.workerExecuted === false,
    },
  ] as const;

  const allPass = checks.every((c) => c.pass);

  return deepFreeze({
    schemaVersion: MV001_DRY_RUN_LIVE_PREP_VERSION,
    verdict: allPass ? "READY_FOR_PAID_AUTH" : "NOT_READY",
    checks,
    providerCalled: false,
    reservations: 0,
    runs: 0,
    jobs: 0,
    assets: 0,
    workerExecuted: false,
    profile,
  });
}

/** Prep scaffold — documents expected dry-run output shape without claiming deploy. */
export function buildMv001DryRunLivePrepScaffold(sourceCommit: string): {
  expectedVerdict: "READY_FOR_PAID_AUTH";
  expectedSourceCommit: string;
  note: string;
} {
  return {
    expectedVerdict: "READY_FOR_PAID_AUTH",
    expectedSourceCommit: sourceCommit,
    note: "Execute only after deploy Auth; MT-013F prepares the script only.",
  };
}
