/**
 * MT-013F — MV-001 execution readiness gates (prep evaluation).
 * Any missing gate → executable=false. No network side effects.
 */

import {
  evaluateMotionPrivacyDecisions,
  type MotionPrivacyDecisionSet,
} from "@/domain/motion/security/privacy-decision";
import { FAL_KLING_V3_PRO_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";
import {
  getMotionTransferFlags,
  type MotionTransferFlagsSnapshot,
} from "@/infrastructure/providers/motion-transfer/motion-transfer-flags";
import { deepFreeze } from "@/domain/motion/freeze";
import {
  MV001_ABSOLUTE_CAP_MINOR,
  MV001_BENCHMARK_ID,
  MV001_DURATION_SECONDS,
  MV001_ENDPOINT_ID,
  MV001_PRIVACY_EXPIRES_AT,
  MV001_PROVIDER_ID,
  MV001_RESERVATION_MINOR,
  assertProductionRegistryRemainsDisabled,
  buildMv001BenchmarkProfile,
} from "./mv001-benchmark-profile";
import { type FalKeyPresence, falKeyPresentFromFlag } from "./mv001-fal-key-presence";
import {
  allManifestEntriesValidated,
  type Mv001MediaManifest,
  manifestHasRequiredRoles,
} from "./mv001-media-manifest";
import {
  evaluateMv001RegistryException,
  type Mv001RegistryException,
} from "./mv001-registry-exception";

export const MV001_GATE_IDS = [
  "benchmark_id",
  "endpoint",
  "duration",
  "privacy_pack_accepted",
  "privacy_not_expired",
  "migrations_30",
  "budget_available_ge_62",
  "registry_exception_active",
  "production_registry_disabled",
  "source_video_validated",
  "identity_validated",
  "checksums_present",
  "private_references",
  "fal_key_present",
  "motion_flags_four",
  "worker_bounded_one_job",
  "no_fallback",
  "no_auto_retry",
  "no_concurrent_run",
  "no_prior_mv001_active",
  "closure_off_prepared",
  "estimate_51",
  "reservation_cap",
] as const;

export type Mv001GateId = (typeof MV001_GATE_IDS)[number];

export type Mv001BudgetSnapshot = {
  hardMinor: number;
  committedMinor: number;
  reservedMinor: number;
  availableMinor: number;
};

export type Mv001GateContext = {
  nowIso: string;
  benchmarkId: string;
  providerId: string;
  modelId: string;
  durationSeconds: number;
  privacySet: MotionPrivacyDecisionSet | null;
  migrationsCount: number;
  budget: Mv001BudgetSnapshot;
  registryException: Mv001RegistryException | null;
  mediaManifest: Mv001MediaManifest | null;
  falKey: FalKeyPresence;
  flags: MotionTransferFlagsSnapshot;
  /** Prep-time: declare intended worker bound (not live enqueue). */
  workerMaxJobsConfigured: number;
  fallbacksConfigured: number;
  autoRetryConfigured: number;
  concurrentActiveRuns: number;
  priorMv001ActiveResults: number;
  /** Emergency closure procedure registered in prep. */
  closureOffPrepared: boolean;
  estimateMinor: number;
  reservationMinor: number;
  absoluteCapMinor: number;
};

export type Mv001GateResult = {
  id: Mv001GateId;
  pass: boolean;
  detail?: string;
};

export type Mv001ReadinessEvaluation = {
  verdict: "READY_FOR_MEDIA_AND_DEPLOY_AUTH" | "NOT_READY";
  executable: boolean;
  mediaValidated: boolean;
  gates: readonly Mv001GateResult[];
  failed: readonly Mv001GateId[];
  profile: ReturnType<typeof buildMv001BenchmarkProfile>;
  observedBudget: Mv001BudgetSnapshot;
  privacyExpiresAt: string;
};

function gate(id: Mv001GateId, pass: boolean, detail?: string): Mv001GateResult {
  return { id, pass, detail };
}

/** Gates that await separate Auth (media / deploy / secrets) — fail → not executable, prep may still be READY. */
const AWAIT_AUTH_GATES: ReadonlySet<Mv001GateId> = new Set([
  "source_video_validated",
  "identity_validated",
  "checksums_present",
  "private_references",
  "fal_key_present",
  "motion_flags_four",
]);

export function evaluateMv001ExecutionGates(
  ctx: Mv001GateContext,
): Readonly<Mv001ReadinessEvaluation> {
  assertProductionRegistryRemainsDisabled();
  const profile = buildMv001BenchmarkProfile();
  const privacyEval = evaluateMotionPrivacyDecisions(ctx.privacySet, ctx.nowIso);
  const exceptionEval = evaluateMv001RegistryException(ctx.registryException, ctx.nowIso);

  const source = ctx.mediaManifest?.entries.find((e) => e.role === "motion_source_video");
  const identity = ctx.mediaManifest?.entries.find(
    (e) => e.role === "motion_identity_reference",
  );
  const checksumsOk =
    !!ctx.mediaManifest &&
    manifestHasRequiredRoles(ctx.mediaManifest) &&
    ctx.mediaManifest.entries.every(
      (e) =>
        /^[a-f0-9]{64}$/i.test(e.checksumSha256) &&
        e.checksumSha256.toLowerCase() !== "0".repeat(64),
    );
  const privateRefsOk =
    !!ctx.mediaManifest &&
    ctx.mediaManifest.entries.every(
      (e) =>
        !e.localRelativePath.includes("..") &&
        !/^https?:/i.test(e.localRelativePath) &&
        !e.localRelativePath.includes("\\"),
    );

  const flagsAll =
    ctx.flags.motionTransferEnabled &&
    ctx.flags.motionTransferPaidEnabled &&
    ctx.flags.motionTransferFalEnabled &&
    ctx.flags.motionTransferWorkerEnabled;

  const results: Mv001GateResult[] = [
    gate("benchmark_id", ctx.benchmarkId === MV001_BENCHMARK_ID),
    gate(
      "endpoint",
      ctx.providerId === MV001_PROVIDER_ID && ctx.modelId === MV001_ENDPOINT_ID,
    ),
    gate("duration", ctx.durationSeconds === MV001_DURATION_SECONDS),
    gate("privacy_pack_accepted", privacyEval.status === "accepted", privacyEval.status),
    gate(
      "privacy_not_expired",
      privacyEval.status === "accepted" && privacyEval.expired.length === 0,
    ),
    gate("migrations_30", ctx.migrationsCount === 30, `count=${ctx.migrationsCount}`),
    gate(
      "budget_available_ge_62",
      ctx.budget.availableMinor >= MV001_RESERVATION_MINOR,
      `available=${ctx.budget.availableMinor}`,
    ),
    gate("registry_exception_active", exceptionEval.ok, exceptionEval.reason),
    gate(
      "production_registry_disabled",
      FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled === false &&
        FAL_KLING_V3_PRO_REGISTRY_PROFILE.paidExecution === false,
    ),
    gate(
      "source_video_validated",
      !!source && source.validationStatus === "validated",
    ),
    gate(
      "identity_validated",
      !!identity && identity.validationStatus === "validated",
    ),
    gate("checksums_present", checksumsOk),
    gate("private_references", privateRefsOk),
    gate("fal_key_present", ctx.falKey.present),
    gate("motion_flags_four", flagsAll),
    gate("worker_bounded_one_job", ctx.workerMaxJobsConfigured === 1),
    gate("no_fallback", ctx.fallbacksConfigured === 0),
    gate("no_auto_retry", ctx.autoRetryConfigured === 0),
    gate("no_concurrent_run", ctx.concurrentActiveRuns === 0),
    gate("no_prior_mv001_active", ctx.priorMv001ActiveResults === 0),
    gate("closure_off_prepared", ctx.closureOffPrepared),
    gate("estimate_51", ctx.estimateMinor === 51 && profile.estimateMinor === 51),
    gate(
      "reservation_cap",
      ctx.reservationMinor === MV001_RESERVATION_MINOR &&
        ctx.absoluteCapMinor === MV001_ABSOLUTE_CAP_MINOR,
    ),
  ];

  const failed = results.filter((g) => !g.pass).map((g) => g.id);
  const mediaValidated =
    !!ctx.mediaManifest && allManifestEntriesValidated(ctx.mediaManifest);
  const structuralFail = failed.filter((id) => !AWAIT_AUTH_GATES.has(id));
  const executable = failed.length === 0;
  const verdict =
    structuralFail.length === 0
      ? "READY_FOR_MEDIA_AND_DEPLOY_AUTH"
      : "NOT_READY";

  return deepFreeze({
    verdict,
    executable,
    mediaValidated,
    gates: results,
    failed: [...new Set(failed)],
    profile,
    observedBudget: ctx.budget,
    privacyExpiresAt: MV001_PRIVACY_EXPIRES_AT,
  });
}

/** Default prep context — media pending, flags off, fal presence injected (never reads FAL_KEY). */
export function buildDefaultMv001PrepContext(input: {
  nowIso: string;
  privacySet: MotionPrivacyDecisionSet;
  registryException: Mv001RegistryException;
  mediaManifest: Mv001MediaManifest | null;
  budget?: Mv001BudgetSnapshot;
  falKeyPresent?: boolean;
  flags?: Partial<MotionTransferFlagsSnapshot>;
  migrationsCount?: number;
}): Mv001GateContext {
  const profile = buildMv001BenchmarkProfile();
  const baseFlags = getMotionTransferFlags({});
  return {
    nowIso: input.nowIso,
    benchmarkId: MV001_BENCHMARK_ID,
    providerId: MV001_PROVIDER_ID,
    modelId: MV001_ENDPOINT_ID,
    durationSeconds: MV001_DURATION_SECONDS,
    privacySet: input.privacySet,
    migrationsCount: input.migrationsCount ?? 30,
    budget: input.budget ?? {
      hardMinor: 174,
      committedMinor: 112,
      reservedMinor: 0,
      availableMinor: 62,
    },
    registryException: input.registryException,
    mediaManifest: input.mediaManifest,
    falKey: falKeyPresentFromFlag(input.falKeyPresent ?? false),
    flags: {
      ...baseFlags,
      ...input.flags,
    },
    workerMaxJobsConfigured: 1,
    fallbacksConfigured: 0,
    autoRetryConfigured: 0,
    concurrentActiveRuns: 0,
    priorMv001ActiveResults: 0,
    closureOffPrepared: true,
    estimateMinor: profile.estimateMinor,
    reservationMinor: MV001_RESERVATION_MINOR,
    absoluteCapMinor: MV001_ABSOLUTE_CAP_MINOR,
  };
}
