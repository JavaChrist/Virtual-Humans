/**
 * Fail-closed resolver for fal Kling motion-control adapter (MT-007B).
 * Real transport + FAL_KEY only when ALL flags ON and privacy gate accepted.
 * Never falls back to fake. Fake forbidden in Production.
 */

import { MotionTransferDomainError, type MotionTransferProviderPort } from "@/domain/motion";
import { createFalKlingMotionControlAdapter } from "./fal-kling-motion-control-adapter";
import type { FalMotionControlTransport } from "./fal-motion-control-transport";
import { createFalSdkMotionControlTransport } from "./fal-sdk-motion-control-transport";
import { canResolveFalMotionTransferAdapter } from "./motion-transfer-flags";
import {
  evaluateMotionTransferPrivacyGate,
  type MotionTransferPrivacyDecisions,
} from "./privacy-gate";

export type ResolveFalKlingMotionControlResult =
  | {
      ok: true;
      port: MotionTransferProviderPort;
      transportKind: "fal_sdk";
    }
  | {
      ok: false;
      reason:
        | "flags_incomplete"
        | "privacy_gate_blocked"
        | "fal_key_missing"
        | "vercel_or_production_without_flags"
        | "fake_forbidden";
      detail?: string;
    };

export type ResolveFalKlingMotionControlOptions = {
  env?: Record<string, string | undefined>;
  privacyDecisions?: Partial<MotionTransferPrivacyDecisions>;
  /**
   * Injected transport — tests only. Production must omit (real SDK factory).
   * Providing a fake transport still requires flags+privacy if resolveProductionPath.
   */
  transport?: FalMotionControlTransport;
  /** When true (default for Production resolve), require flags+privacy+FAL_KEY. */
  requireLiveGates?: boolean;
};

function isVercelOrProduction(
  env: Record<string, string | undefined>,
): boolean {
  if (env.VERCEL === "1") return true;
  if (env.VERCEL_ENV && env.VERCEL_ENV.length > 0) return true;
  const nodeEnv = (env.NODE_ENV ?? "").toLowerCase();
  return nodeEnv === "production";
}

/**
 * Resolve the real fal Kling motion-control adapter.
 * Default: unavailable (flags OFF, privacy blocked).
 */
export function resolveFalKlingMotionControlAdapter(
  options: ResolveFalKlingMotionControlOptions = {},
): ResolveFalKlingMotionControlResult {
  const env =
    options.env ?? (process.env as Record<string, string | undefined>);
  const requireLive = options.requireLiveGates !== false;

  if (requireLive && !canResolveFalMotionTransferAdapter(env)) {
    return {
      ok: false,
      reason: "flags_incomplete",
      detail:
        "MOTION_TRANSFER_ENABLED + MOTION_TRANSFER_PAID_ENABLED + MOTION_TRANSFER_FAL_ENABLED required",
    };
  }

  const gate = evaluateMotionTransferPrivacyGate(options.privacyDecisions);
  if (requireLive && gate.status !== "accepted") {
    return {
      ok: false,
      reason: "privacy_gate_blocked",
      detail: `missing:${gate.missing.join(",")}`,
    };
  }

  if (options.transport) {
    if (options.transport.kind === "fake" && isVercelOrProduction(env)) {
      return { ok: false, reason: "fake_forbidden" };
    }
    const port = createFalKlingMotionControlAdapter({
      transport: options.transport,
      privacyDecisions: options.privacyDecisions,
      enforcePrivacyGateOnSubmit: requireLive,
      enableProcessLocalSubmitReplay: false,
    });
    return {
      ok: true,
      port,
      transportKind: "fal_sdk",
    };
  }

  if (!env.FAL_KEY?.trim()) {
    return { ok: false, reason: "fal_key_missing" };
  }

  // FAL_KEY is read only inside createFalSdkMotionControlTransport (not at module import).
  let transport: FalMotionControlTransport;
  try {
    transport = createFalSdkMotionControlTransport({ env });
  } catch {
    return { ok: false, reason: "fal_key_missing" };
  }

  const port = createFalKlingMotionControlAdapter({
    transport,
    privacyDecisions: options.privacyDecisions,
    enforcePrivacyGateOnSubmit: true,
    enableProcessLocalSubmitReplay: false,
  });

  return { ok: true, port, transportKind: "fal_sdk" };
}

/**
 * Convenience: throw MotionTransferDomainError when unavailable.
 */
export function requireFalKlingMotionControlAdapter(
  options: ResolveFalKlingMotionControlOptions = {},
): MotionTransferProviderPort {
  const result = resolveFalKlingMotionControlAdapter(options);
  if (!result.ok) {
    throw new MotionTransferDomainError(
      "provider_not_configured",
      "Adapter fal Kling motion-control indisponible.",
      { diagnostic: result.reason },
    );
  }
  return result.port;
}
