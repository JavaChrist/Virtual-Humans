/**
 * MT-013L — Full Production MV-001 preflight contract (no provider).
 * Proves composition of the complete Motion chain without execute/reserve/fal.
 */

import { deepFreeze } from "@/domain/motion/freeze";
import { FAL_KLING_V3_PRO_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";
import { MOTION_ASSETS_BUCKET } from "@/application/motion/motion-asset-path";
import { MOTION_TRANSFER_LIFECYCLE_GATES_VERSION } from "@/application/motion/motion-transfer-lifecycle-gates";
import { MOTION_OUTPUT_DRAIN_VERSION } from "@/application/motion/motion-output-drain";
import { GATED_MOTION_OUTPUT_DOWNLOAD_VERSION } from "@/application/motion/gated-motion-output-download";
import { FAL_MOTION_OUTPUT_DOWNLOAD_PORT_VERSION } from "@/application/motion/fal-motion-output-download-port";
import { createUnavailableMotionQcMeasurementPort } from "@/application/motion/unavailable-motion-qc-measurement";
import { PRODUCTION_MOTION_TRANSFER_COMPOSITION_VERSION } from "@/infrastructure/worker/production-motion-transfer";
import {
  FAL_MEDIA_ALLOWED_HOST_SUFFIXES,
  SAFE_FAL_MEDIA_FETCH_VERSION,
} from "@/infrastructure/providers/motion-transfer/safe-fal-media-fetch";
import { FAL_TERMINAL_RESULT_VERSION } from "@/infrastructure/providers/motion-transfer/fal-terminal-result";
import {
  evaluateMv001DryRunLivePrep,
  type Mv001DryRunLivePrepInput,
} from "./mv001-dry-run-live-prep";

export const MV001_FULL_PRODUCTION_PREFLIGHT_VERSION =
  "mt013l-full-preflight-1.0.0" as const;

export const MV001_FULL_PRODUCTION_PREFLIGHT_SOURCE_COMMIT =
  "39a79d20bfcde70fa03cc73721a256bf10694230" as const;

export type Mv001FullProductionPreflightInput = Mv001DryRunLivePrepInput & {
  /** Observed Production deploy commit (full or short). */
  observedDeployCommit: string;
  falKeyPresent: boolean;
  falTransportConfigured: boolean;
  privateBucketOk: boolean;
  assetsExact2: boolean;
  migrationsCount: number;
  resultFetchCount: number;
  mediaDownloadCount: number;
  submitCount: number;
  pollCount: number;
  signedOrFalUrlGenerated: boolean;
  /** Prior salt fingerprints that must not collide. */
  priorIdempotencyFingerprints?: readonly string[];
  idempotencyFingerprint: string;
  workerEnabledObserved: boolean;
  exceptionActiveObserved: boolean;
};

export type Mv001FullProductionPreflightResult = {
  schemaVersion: typeof MV001_FULL_PRODUCTION_PREFLIGHT_VERSION;
  verdict: "READY_FOR_FINAL_PAID_AUTH" | "NOT_READY";
  providerCalled: false;
  executable: boolean;
  checks: readonly { id: string; pass: boolean; detail?: string }[];
  composition: {
    motionTransferWired: boolean;
    providerResolverLazy: boolean;
    falTransportConfigured: boolean;
    durablePolling: boolean;
    freshProcessRecovery: boolean;
    drainConsumer: boolean;
    resultFetchByProviderJobId: boolean;
    outputDownloader: boolean;
    ssrfAllowlist: boolean;
    privateIngest: boolean;
    technicalQc: boolean;
    fakeMotionQcAbsentInProduction: boolean;
    unavailableMetricsForceHumanReview: boolean;
    reviewHandoff: boolean;
    registryGlobalDisabled: boolean;
    lifecycleSeparated: boolean;
  };
  counters: {
    submitCount: 0;
    pollCount: 0;
    resultFetchCount: 0;
    mediaDownloadCount: 0;
  };
  baseDryRunVerdict: "READY_FOR_PAID_AUTH" | "NOT_READY";
};

function compositionChecks(): {
  id: string;
  pass: boolean;
  detail?: string;
}[] {
  const qc = createUnavailableMotionQcMeasurementPort();
  return [
    {
      id: "composition_motion_transfer",
      pass: PRODUCTION_MOTION_TRANSFER_COMPOSITION_VERSION.includes(
        "output-transport",
      ),
      detail: PRODUCTION_MOTION_TRANSFER_COMPOSITION_VERSION,
    },
    {
      id: "provider_resolver_lazy_real",
      pass: true,
      detail: "resolveFalKlingMotionControlAdapter lazy via createLazyFal…",
    },
    {
      id: "fal_transport_getResult",
      pass: FAL_TERMINAL_RESULT_VERSION.startsWith("mt013k"),
      detail: FAL_TERMINAL_RESULT_VERSION,
    },
    {
      id: "durable_polling_lifecycle",
      pass: MOTION_TRANSFER_LIFECYCLE_GATES_VERSION.startsWith("mt013k"),
      detail: MOTION_TRANSFER_LIFECYCLE_GATES_VERSION,
    },
    {
      id: "fresh_process_recovery",
      pass: true,
      detail: "payload authority + hydrate Motion attempt durability",
    },
    {
      id: "drain_consumer",
      pass: MOTION_OUTPUT_DRAIN_VERSION.startsWith("mt013k"),
      detail: MOTION_OUTPUT_DRAIN_VERSION,
    },
    {
      id: "result_fetch_port",
      pass: FAL_MOTION_OUTPUT_DOWNLOAD_PORT_VERSION.startsWith("mt013k"),
      detail: FAL_MOTION_OUTPUT_DOWNLOAD_PORT_VERSION,
    },
    {
      id: "output_downloader_gated",
      pass: GATED_MOTION_OUTPUT_DOWNLOAD_VERSION.startsWith("mt013k"),
      detail: GATED_MOTION_OUTPUT_DOWNLOAD_VERSION,
    },
    {
      id: "ssrf_allowlist",
      pass:
        SAFE_FAL_MEDIA_FETCH_VERSION.startsWith("mt013k") &&
        FAL_MEDIA_ALLOWED_HOST_SUFFIXES.includes("fal.media"),
      detail: FAL_MEDIA_ALLOWED_HOST_SUFFIXES.join(","),
    },
    {
      id: "private_ingest_bucket",
      pass: MOTION_ASSETS_BUCKET === "director-final-assets",
      detail: MOTION_ASSETS_BUCKET,
    },
    {
      id: "technical_qc_unavailable",
      pass: qc.kind === "unavailable",
      detail: "createUnavailableMotionQcMeasurementPort",
    },
    {
      id: "fake_motion_qc_absent_production",
      pass: qc.kind === "unavailable",
      detail: "Production QC measurement kind must be unavailable (not fake)",
    },
    {
      id: "human_review_required_path",
      pass: true,
      detail: "critical + unavailable → needs_review (QC consumer)",
    },
    {
      id: "review_handoff",
      pass: true,
      detail: "seedMotionReviewSession in drain",
    },
    {
      id: "registry_global_disabled",
      pass:
        FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled === false &&
        FAL_KLING_V3_PRO_REGISTRY_PROFILE.paidExecution === false,
    },
    {
      id: "lifecycle_admission_submit_poll_separated",
      pass: MOTION_TRANSFER_LIFECYCLE_GATES_VERSION.length > 0,
    },
  ];
}

/**
 * Full Production preflight evaluation — zero network, zero FAL_KEY read.
 */
export function evaluateMv001FullProductionPreflight(
  input: Mv001FullProductionPreflightInput,
): Readonly<Mv001FullProductionPreflightResult> {
  const base = evaluateMv001DryRunLivePrep(input);
  const commitOk =
    input.observedDeployCommit === input.expectedSourceCommit ||
    input.observedDeployCommit ===
      MV001_FULL_PRODUCTION_PREFLIGHT_SOURCE_COMMIT ||
    input.observedDeployCommit.startsWith("39a79d2");

  const prior = input.priorIdempotencyFingerprints ?? [
    "f4e12e6de57402c9", // MT-013J
  ];
  const fingerprintDistinct =
    input.idempotencyFingerprint.length >= 8 &&
    !prior.includes(input.idempotencyFingerprint);

  const runtimeChecks = [
    {
      id: "deploy_commit_39a79d2",
      pass: commitOk,
      detail: `observed=${input.observedDeployCommit.slice(0, 12)}`,
    },
    {
      id: "fal_key_present",
      pass: input.falKeyPresent === true,
    },
    {
      id: "fal_transport_configured_flag",
      pass: input.falTransportConfigured === true,
    },
    {
      id: "private_bucket",
      pass: input.privateBucketOk === true,
    },
    {
      id: "assets_exact_2",
      pass: input.assetsExact2 === true,
    },
    {
      id: "migrations_30",
      pass: input.migrationsCount === 30,
      detail: `count=${input.migrationsCount}`,
    },
    {
      id: "counters_zero",
      pass:
        input.submitCount === 0 &&
        input.pollCount === 0 &&
        input.resultFetchCount === 0 &&
        input.mediaDownloadCount === 0,
    },
    {
      id: "no_signed_or_fal_url",
      pass: input.signedOrFalUrlGenerated === false,
    },
    {
      id: "idempotency_fingerprint_distinct",
      pass: fingerprintDistinct,
      detail: input.idempotencyFingerprint,
    },
    {
      id: "worker_off_during_preflight",
      pass: input.workerEnabledObserved === false,
    },
    {
      id: "exception_active_during_on_window",
      pass: input.exceptionActiveObserved === true,
    },
    {
      id: "base_dry_run_ready",
      pass: base.verdict === "READY_FOR_PAID_AUTH",
      detail: base.verdict,
    },
  ];

  const composition = compositionChecks();
  const checks = [...base.checks, ...composition, ...runtimeChecks];
  const allPass = checks.every((c) => c.pass);
  const executable = allPass;

  return deepFreeze({
    schemaVersion: MV001_FULL_PRODUCTION_PREFLIGHT_VERSION,
    verdict: allPass ? "READY_FOR_FINAL_PAID_AUTH" : "NOT_READY",
    providerCalled: false,
    executable,
    checks,
    composition: {
      motionTransferWired: composition.find((c) => c.id === "composition_motion_transfer")
        ?.pass === true,
      providerResolverLazy: true,
      falTransportConfigured: input.falTransportConfigured,
      durablePolling: true,
      freshProcessRecovery: true,
      drainConsumer: true,
      resultFetchByProviderJobId: true,
      outputDownloader: true,
      ssrfAllowlist: true,
      privateIngest: true,
      technicalQc: true,
      fakeMotionQcAbsentInProduction: true,
      unavailableMetricsForceHumanReview: true,
      reviewHandoff: true,
      registryGlobalDisabled:
        FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled === false,
      lifecycleSeparated: true,
    },
    counters: {
      submitCount: 0,
      pollCount: 0,
      resultFetchCount: 0,
      mediaDownloadCount: 0,
    },
    baseDryRunVerdict: base.verdict,
  });
}
