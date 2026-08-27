/**
 * Phase 11D — Director lipsync path. WIRED_DISABLED. No provider selected.
 * No Vercel write. No Production mutation. No media read.
 */
import { parseStrictEnabledFlag } from "@/infrastructure/config/feature-flags";
import {
  assertMotionRegistryStaysDisabled,
  assertMv002RemainsDeferred,
  assertPhase11ADoesNotInvokeMotionEndpoint,
  MV002_STATUS_DEFERRED,
} from "./phase-11a-motion-isolation";

export const PHASE_11D_LIPSYNC_WIRING_AUTH =
  "AUTH_VHS_DIRECTOR_LIPSYNC_PATH_WIRING_IMPLEMENT_DISABLED_NO_PROVIDER_NO_DEPLOY_NO_FLAG_WRITE" as const;

export const PHASE_11D_LIPSYNC_WIRING_VERDICT =
  "VHS_DIRECTOR_LIPSYNC_PATH_WIRED_DISABLED_READY" as const;

export const PHASE_11D_NEXT_AUTH =
  "AUTH_VHS_DIRECTOR_LIPSYNC_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE" as const;

export const PHASE_11D_LIPSYNC_CAPABILITY_FLAG_ENV = "VHS11D_LIPSYNC_CAPABILITY_ENABLED" as const;
export const PHASE_11D_LIPSYNC_PAID_FLAG_ENV = "VHS11D_LIPSYNC_PAID_ENABLED" as const;
export const PHASE_11D_LIPSYNC_PROVIDER_FLAG_ENV = "VHS11D_LIPSYNC_PROVIDER_ENABLED" as const;
export const PHASE_11D_LIPSYNC_WORKER_FLAG_ENV = "VHS11D_LIPSYNC_WORKER_ENABLED" as const;
export const PHASE_11D_LIPSYNC_DOWNSTREAM_FLAG_ENV = "VHS11D_LIPSYNC_DOWNSTREAM_ENABLED" as const;
export const PHASE_11D_LIPSYNC_EXCEPTION_ENV = "VHS11D_LIPSYNC_DIRECTOR_EXCEPTION" as const;

export const PHASE_11D_WIRE_VERSION = "phase-11d-lipsync-wire-1.0.0" as const;
export const PHASE_11D_CAPABILITY = "audio.lipsync" as const;
export const PHASE_11D_ACTION = "lipsync" as const;
export const PHASE_11D_PROVIDER = "unavailable" as const;
export const PHASE_11D_MODEL = "unavailable" as const;
export const PHASE_11D_LEGACY_LIPSYNC_ROUTE = "/api/generate/lipsync" as const;

export const PHASE_11D_LIVE_BUDGET = {
  hard: 437,
  committed: 391,
  reserved: 0,
  available: 46,
} as const;

export type Vhs11DLipsyncAllowlistScope = {
  capability: typeof PHASE_11D_CAPABILITY;
  action: typeof PHASE_11D_ACTION;
  providerId: typeof PHASE_11D_PROVIDER;
  modelId: typeof PHASE_11D_MODEL;
  providerSelected: false;
  realAdapterPresent: false;
  paidExecution: false;
  globallyEligible: false;
  downstreamChaining: false;
  retryAllowed: false;
  fallbackAllowed: false;
  mergeAllowed: false;
  exportAllowed: false;
  activationAllowed: false;
  legacyEndpointAllowed: false;
  universalFakeAllowedInProduction: false;
};

export const PHASE_11D_ALLOWLIST_SCOPE: Vhs11DLipsyncAllowlistScope = {
  capability: PHASE_11D_CAPABILITY,
  action: PHASE_11D_ACTION,
  providerId: PHASE_11D_PROVIDER,
  modelId: PHASE_11D_MODEL,
  providerSelected: false,
  realAdapterPresent: false,
  paidExecution: false,
  globallyEligible: false,
  downstreamChaining: false,
  retryAllowed: false,
  fallbackAllowed: false,
  mergeAllowed: false,
  exportAllowed: false,
  activationAllowed: false,
  legacyEndpointAllowed: false,
  universalFakeAllowedInProduction: false,
};

export function phase11DLipsyncFlagsAuditView(
  env: Record<string, string | undefined> = {},
): {
  capability: boolean;
  paid: boolean;
  provider: boolean;
  worker: boolean;
  exception: boolean;
  downstream: boolean;
  directorPaid: boolean;
  mergeExport: false;
  providerSelected: false;
} {
  return {
    capability: parseStrictEnabledFlag(env[PHASE_11D_LIPSYNC_CAPABILITY_FLAG_ENV]),
    paid: parseStrictEnabledFlag(env[PHASE_11D_LIPSYNC_PAID_FLAG_ENV]),
    provider: parseStrictEnabledFlag(env[PHASE_11D_LIPSYNC_PROVIDER_FLAG_ENV]),
    worker: parseStrictEnabledFlag(env[PHASE_11D_LIPSYNC_WORKER_FLAG_ENV]),
    exception: parseStrictEnabledFlag(env[PHASE_11D_LIPSYNC_EXCEPTION_ENV]),
    downstream: parseStrictEnabledFlag(env[PHASE_11D_LIPSYNC_DOWNSTREAM_FLAG_ENV]),
    directorPaid: parseStrictEnabledFlag(env.DIRECTOR_V2_PAID_GENERATION_ENABLED),
    mergeExport: false,
    providerSelected: false,
  };
}

export function assertPhase11DLipsyncFlagsRemainOff(
  env: Record<string, string | undefined> = {},
): void {
  const flags = phase11DLipsyncFlagsAuditView(env);
  if (
    flags.capability ||
    flags.paid ||
    flags.provider ||
    flags.worker ||
    flags.exception ||
    flags.downstream ||
    flags.directorPaid
  ) {
    throw new Error("Phase 11D: lipsync flags must remain OFF during wiring.");
  }
  if (parseStrictEnabledFlag(env.VHS11C_VOICE_CAPABILITY_ENABLED) || parseStrictEnabledFlag(env.VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION)) {
    throw new Error("Phase 11D: VHS11C flags must remain OFF.");
  }
  if (parseStrictEnabledFlag(env.VHS11B_I2V_CAPABILITY_ENABLED) || parseStrictEnabledFlag(env.VHS11B_FAL_I2V_DIRECTOR_EXCEPTION)) {
    throw new Error("Phase 11D: VHS11B flags must remain OFF.");
  }
  if (parseStrictEnabledFlag(env.VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION)) {
    throw new Error("Phase 11D: VHS124 flags must remain OFF.");
  }
}

export function assertPhase11DRealExecutionGates(
  env: Record<string, string | undefined> = {},
): never {
  assertPhase11DLipsyncFlagsRemainOff(env);
  throw new Error("Phase 11D: real lipsync execution is refused while capability/paid/provider/worker/downstream remain OFF.");
}

export type Phase11DAllowlistGate = {
  action: string;
  capabilityProfile: string;
  providerId?: string;
  fallbackRequested?: boolean;
  retryRequested?: boolean;
  downstreamRequested?: boolean;
  mergeRequested?: boolean;
  exportRequested?: boolean;
  activationRequested?: boolean;
  motionRequested?: boolean;
  legacyEndpoint?: boolean;
  realSubmitRequested?: boolean;
};

export function assertVhs11DLipsyncAllowlistScope(gate: Phase11DAllowlistGate): void {
  assertPhase11ADoesNotInvokeMotionEndpoint(gate.action);
  assertMv002RemainsDeferred(MV002_STATUS_DEFERRED);
  assertMotionRegistryStaysDisabled({ enabled: false, paidExecution: false });

  if (gate.action !== PHASE_11D_ACTION) {
    throw new Error("Phase 11D allowlist: action must be lipsync.");
  }
  if (gate.capabilityProfile !== PHASE_11D_CAPABILITY) {
    throw new Error("Phase 11D allowlist: capability must be audio.lipsync.");
  }
  if (gate.providerId && gate.providerId !== PHASE_11D_PROVIDER && gate.providerId !== "fake-local") {
    throw new Error("Phase 11D allowlist: no lipsync provider is selected.");
  }
  if (
    gate.fallbackRequested ||
    gate.retryRequested ||
    gate.downstreamRequested ||
    gate.mergeRequested ||
    gate.exportRequested ||
    gate.activationRequested ||
    gate.motionRequested ||
    gate.legacyEndpoint
  ) {
    throw new Error("Phase 11D allowlist: forbidden merge/legacy/downstream/retry path.");
  }
  if (gate.realSubmitRequested) {
    throw new Error("Phase 11D allowlist: real provider submit is forbidden.");
  }
}

export function assertPhase11DNotLegacyLipsyncEndpoint(path: string): void {
  if (path.includes(PHASE_11D_LEGACY_LIPSYNC_ROUTE) || path.includes("/api/generate/lipsync")) {
    throw new Error("Phase 11D must not use legacy /api/generate/lipsync as Production proof.");
  }
}

export function assertPhase11DRegistryDisabled(enabled: boolean): void {
  if (enabled) {
    throw new Error("Phase 11D: lipsync capability registry must remain disabled.");
  }
}

export function redactPhase11DError(message: string): string {
  return message
    .replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=]+/gi, "data:[redacted]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]");
}
