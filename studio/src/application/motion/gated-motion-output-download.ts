/**
 * MT-013K-OUTPUT-TRANSPORT — Production download gate.
 *
 * Resolver disabled by default. Real fal result+media path only when ALL gates pass.
 * Never reads FAL_KEY while gates fail. Fake download only via harness/tests.
 */

import { MotionTransferDomainError } from "@/domain/motion";
import { MV001_BENCHMARK_ID } from "@/application/motion/mv001/mv001-benchmark-profile";
import { isMv001PrivacyPackActive } from "@/application/motion/mv001/mv001-privacy-decisions";
import { canResolveFalMotionTransferAdapter } from "@/infrastructure/providers/motion-transfer/motion-transfer-flags";
import { createFalSdkMotionControlTransport } from "@/infrastructure/providers/motion-transfer/fal-sdk-motion-control-transport";
import type { FalMotionControlTransport } from "@/infrastructure/providers/motion-transfer/fal-motion-control-transport";
import type { SafeFetchLike } from "@/infrastructure/providers/motion-transfer/safe-fal-media-fetch";
import { MOTION_ASSETS_BUCKET } from "./motion-asset-path";
import { isMotionTransferFakeHarnessActive } from "./motion-transfer-worker-gates";
import {
  createFalMotionOutputDownloadPort,
} from "./fal-motion-output-download-port";
import {
  createFakeMotionOutputDownloadPort,
  type MotionOutputDownloadPort,
  type MotionOutputDownloadContext,
  type MotionOutputDownloadRequest,
} from "./motion-output-download-port";

export const GATED_MOTION_OUTPUT_DOWNLOAD_VERSION =
  "mt013k-output-transport-1.0.0" as const;

function isVercelOrProduction(
  env: Record<string, string | undefined>,
): boolean {
  if (env.VERCEL === "1") return true;
  if (env.VERCEL_ENV && env.VERCEL_ENV.length > 0) return true;
  return (env.NODE_ENV ?? "").toLowerCase() === "production";
}

export type MotionOutputTransportGateEvaluation = {
  ok: boolean;
  missing: string[];
  reason?: string;
};

/**
 * Production gates for fal output retrieval + private ingest download.
 * Default: blocked (flags OFF / privacy inactive / not MV-001 drain).
 */
export function evaluateMotionOutputTransportGates(input: {
  env: Record<string, string | undefined>;
  context: MotionOutputDownloadContext;
  request: MotionOutputDownloadRequest;
  nowIso: string;
  transportReady: boolean;
}): MotionOutputTransportGateEvaluation {
  const missing: string[] = [];
  const env = input.env;
  const ctx = input.context;

  if (!canResolveFalMotionTransferAdapter(env)) {
    missing.push("fal_result_transport_flags");
  }
  if (!isMv001PrivacyPackActive(env, input.nowIso)) {
    missing.push("privacy_pack_5_of_5");
  }

  const allowedProject = env.MV001_PROJECT_ID?.trim();
  if (!allowedProject || ctx.projectId !== allowedProject) {
    missing.push("mv001_project_exact");
  }
  if ((ctx.benchmarkId ?? MV001_BENCHMARK_ID) !== MV001_BENCHMARK_ID) {
    missing.push("mv001_benchmark_exact");
  }
  if (!input.request.providerJobId?.trim()) {
    missing.push("provider_job_id");
  }
  if (ctx.terminalProviderSuccess !== true) {
    missing.push("terminal_provider_success");
  }
  if (ctx.drainAuthorized !== true) {
    missing.push("drain_permission");
  }
  if (ctx.admissionOpen === true || ctx.submitAllowed === true) {
    missing.push("admission_submit_must_be_closed");
  }
  if (!input.transportReady) {
    missing.push("fal_result_transport_configured");
  }
  if (ctx.privateStorageValidated !== true) {
    missing.push("private_storage_validated");
  }
  if (MOTION_ASSETS_BUCKET !== "director-final-assets") {
    missing.push("private_storage_bucket");
  }

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      reason: `motion_output_transport_blocked:${missing.join(",")}`,
    };
  }
  return { ok: true, missing: [] };
}

export function createFailClosedMotionOutputDownloadPort(): MotionOutputDownloadPort {
  return {
    kind: "real",
    downloadCount: 0,
    async download() {
      throw new MotionTransferDomainError(
        "provider_not_configured",
        "Download Motion output indisponible — transport réel non armé / flags OFF.",
      );
    },
  };
}

export type ResolveProductionMotionOutputDownloadOptions = {
  testDownload?: MotionOutputDownloadPort;
  /** TEST ONLY — injectable transport (fake forbidden under Vercel/Production). */
  testTransport?: FalMotionControlTransport;
  /** TEST ONLY — injectable fetch (zero real network). */
  testFetch?: SafeFetchLike;
  nowIso?: () => string;
  /**
   * When true (tests), skip DNS rebind checks.
   * Production path keeps DNS checks.
   */
  skipDnsLookup?: boolean;
};

function isMotionOutputDownloadPort(
  value: unknown,
): value is MotionOutputDownloadPort {
  return (
    !!value &&
    typeof value === "object" &&
    "kind" in value &&
    typeof (value as MotionOutputDownloadPort).download === "function" &&
    !("testDownload" in value) &&
    !("testTransport" in value)
  );
}

/**
 * Resolve download port for Production composition.
 * - Explicit testDownload wins
 * - Harness (non-Vercel): fake
 * - Else: gated real fal port (fail-closed until gates pass; lazy FAL_KEY)
 */
export function resolveProductionMotionOutputDownloadPort(
  env: Record<string, string | undefined>,
  testDownloadOrOptions?:
    | MotionOutputDownloadPort
    | ResolveProductionMotionOutputDownloadOptions,
): MotionOutputDownloadPort {
  const options: ResolveProductionMotionOutputDownloadOptions =
    isMotionOutputDownloadPort(testDownloadOrOptions)
      ? { testDownload: testDownloadOrOptions }
      : ((testDownloadOrOptions as
          | ResolveProductionMotionOutputDownloadOptions
          | undefined) ?? {});

  if (options.testDownload) return options.testDownload;

  if (isMotionTransferFakeHarnessActive(env)) {
    return createFakeMotionOutputDownloadPort();
  }

  if (
    options.testTransport?.kind === "fake" &&
    isVercelOrProduction(env)
  ) {
    throw new MotionTransferDomainError(
      "provider_not_configured",
      "Fake Motion output transport interdit en Production.",
      { diagnostic: "fake_forbidden" },
    );
  }

  return createGatedFalMotionOutputDownloadPort({
    env,
    testTransport: options.testTransport,
    testFetch: options.testFetch,
    nowIso: options.nowIso,
    skipDnsLookup: options.skipDnsLookup,
  });
}

function createGatedFalMotionOutputDownloadPort(input: {
  env: Record<string, string | undefined>;
  testTransport?: FalMotionControlTransport;
  testFetch?: SafeFetchLike;
  nowIso?: () => string;
  skipDnsLookup?: boolean;
}): MotionOutputDownloadPort {
  let downloadCount = 0;
  let inner: ReturnType<typeof createFalMotionOutputDownloadPort> | undefined;

  function resolveInner(): ReturnType<typeof createFalMotionOutputDownloadPort> {
    if (inner) return inner;
    let transport = input.testTransport;
    if (!transport) {
      // Lazy — only when gates already passed. Reads FAL_KEY here only.
      transport = createFalSdkMotionControlTransport({ env: input.env });
    }
    if (transport.kind === "fake" && isVercelOrProduction(input.env)) {
      throw new MotionTransferDomainError(
        "provider_not_configured",
        "Fake Motion output transport interdit en Production.",
        { diagnostic: "fake_forbidden" },
      );
    }
    inner = createFalMotionOutputDownloadPort({
      transport,
      fetchImpl: input.testFetch,
      skipDnsLookup:
        input.skipDnsLookup === true || input.testFetch != null,
    });
    return inner;
  }

  return {
    kind: "real",
    get downloadCount() {
      return inner?.downloadCount ?? downloadCount;
    },
    get mediaDownloadCount() {
      return inner?.mediaDownloadCount;
    },
    get resultFetchCount() {
      return inner?.resultFetchCount;
    },
    async download(request, context) {
      const nowIso = input.nowIso?.() ?? context.nowIso;
      const transportReady =
        input.testTransport != null ||
        canResolveFalMotionTransferAdapter(input.env);

      const gates = evaluateMotionOutputTransportGates({
        env: input.env,
        context,
        request,
        nowIso,
        transportReady,
      });
      if (!gates.ok) {
        downloadCount += 1;
        throw new MotionTransferDomainError(
          "provider_not_configured",
          "Download Motion fal output bloqué — gates Production.",
          { diagnostic: gates.reason },
        );
      }

      // Flags OFF ⇒ gates fail above — no FAL_KEY read.
      return resolveInner().download(request, context);
    },
  };
}
