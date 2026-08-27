/**
 * Phase 11E — Director merge/export path. WIRED_DISABLED.
 * Reuses existing postproduction merge/export contracts. No engine selected.
 * No Vercel write. No Production mutation. No media read.
 */
import { parseStrictEnabledFlag } from "@/infrastructure/config/feature-flags";
import { STUB_MERGE_CAPABILITIES } from "@/domain/postproduction/merge-capabilities";
import {
  assertMotionRegistryStaysDisabled,
  assertMv002RemainsDeferred,
  assertPhase11ADoesNotInvokeMotionEndpoint,
  MV002_STATUS_DEFERRED,
} from "./phase-11a-motion-isolation";

export const PHASE_11E_MERGE_EXPORT_WIRING_AUTH =
  "AUTH_VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRING_IMPLEMENT_DISABLED_NO_PROVIDER_NO_DEPLOY_NO_FLAG_WRITE" as const;

export const PHASE_11E_MERGE_EXPORT_WIRING_VERDICT =
  "VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRED_DISABLED_READY" as const;

export const PHASE_11E_NEXT_AUTH =
  "AUTH_VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE" as const;

export const PHASE_11E_MERGE_CAPABILITY_FLAG_ENV = "VHS11E_MERGE_CAPABILITY_ENABLED" as const;
export const PHASE_11E_EXPORT_CAPABILITY_FLAG_ENV = "VHS11E_EXPORT_CAPABILITY_ENABLED" as const;
export const PHASE_11E_PAID_FLAG_ENV = "VHS11E_PAID_ENABLED" as const;
export const PHASE_11E_PROVIDER_FLAG_ENV = "VHS11E_PROVIDER_ENABLED" as const;
export const PHASE_11E_WORKER_FLAG_ENV = "VHS11E_WORKER_ENABLED" as const;
export const PHASE_11E_EXCEPTION_ENV = "VHS11E_DIRECTOR_EXCEPTION" as const;
export const PHASE_11E_PUBLISH_DOWNSTREAM_FLAG_ENV = "VHS11E_PUBLISH_DOWNSTREAM_ENABLED" as const;

export const PHASE_11E_WIRE_VERSION = "phase-11e-merge-export-wire-1.0.0" as const;
export const PHASE_11E_MERGE_CAPABILITY = "postproduction.merge" as const;
export const PHASE_11E_EXPORT_CAPABILITY = "postproduction.export" as const;
export const PHASE_11E_MERGE_ACTION = "merge" as const;
export const PHASE_11E_EXPORT_ACTION = "export" as const;
export const PHASE_11E_ENGINE = "unavailable" as const;
export const PHASE_11E_MODEL = "unavailable" as const;
export const PHASE_11E_LEGACY_MERGE_ROUTE = "/api/generate/merge" as const;
export const PHASE_11E_LEGACY_MERGE_AUDIO_ROUTE = "/api/generate/merge-audio" as const;

export const PHASE_11E_LIVE_BUDGET = {
  hard: 437,
  committed: 391,
  reserved: 0,
  available: 46,
} as const;

export const PHASE_11E_REUSED_MERGE_CAPABILITIES = STUB_MERGE_CAPABILITIES;

export type Vhs11EMergeExportAllowlistScope = {
  mergeCapability: typeof PHASE_11E_MERGE_CAPABILITY;
  exportCapability: typeof PHASE_11E_EXPORT_CAPABILITY;
  engineId: typeof PHASE_11E_ENGINE;
  modelId: typeof PHASE_11E_MODEL;
  engineSelected: false;
  realMergeAdapterPresent: false;
  realExportAdapterPresent: false;
  paidExecution: false;
  globallyEligible: false;
  retryAllowed: false;
  fallbackAllowed: false;
  mergeAuthorized: false;
  exportAuthorized: false;
  publicationAllowed: false;
  downloadAllowed: false;
  activationAllowed: false;
  legacyEndpointAllowed: false;
  universalFakeAllowedInProduction: false;
};

export const PHASE_11E_ALLOWLIST_SCOPE: Vhs11EMergeExportAllowlistScope = {
  mergeCapability: PHASE_11E_MERGE_CAPABILITY,
  exportCapability: PHASE_11E_EXPORT_CAPABILITY,
  engineId: PHASE_11E_ENGINE,
  modelId: PHASE_11E_MODEL,
  engineSelected: false,
  realMergeAdapterPresent: false,
  realExportAdapterPresent: false,
  paidExecution: false,
  globallyEligible: false,
  retryAllowed: false,
  fallbackAllowed: false,
  mergeAuthorized: false,
  exportAuthorized: false,
  publicationAllowed: false,
  downloadAllowed: false,
  activationAllowed: false,
  legacyEndpointAllowed: false,
  universalFakeAllowedInProduction: false,
};

export function phase11EMergeExportFlagsAuditView(
  env: Record<string, string | undefined> = {},
): {
  mergeCapability: boolean;
  exportCapability: boolean;
  paid: boolean;
  provider: boolean;
  worker: boolean;
  exception: boolean;
  publishDownstream: boolean;
  directorPaid: boolean;
  mergeExportAuthorized: false;
  engineSelected: false;
} {
  return {
    mergeCapability: parseStrictEnabledFlag(env[PHASE_11E_MERGE_CAPABILITY_FLAG_ENV]),
    exportCapability: parseStrictEnabledFlag(env[PHASE_11E_EXPORT_CAPABILITY_FLAG_ENV]),
    paid: parseStrictEnabledFlag(env[PHASE_11E_PAID_FLAG_ENV]),
    provider: parseStrictEnabledFlag(env[PHASE_11E_PROVIDER_FLAG_ENV]),
    worker: parseStrictEnabledFlag(env[PHASE_11E_WORKER_FLAG_ENV]),
    exception: parseStrictEnabledFlag(env[PHASE_11E_EXCEPTION_ENV]),
    publishDownstream: parseStrictEnabledFlag(env[PHASE_11E_PUBLISH_DOWNSTREAM_FLAG_ENV]),
    directorPaid: parseStrictEnabledFlag(env.DIRECTOR_V2_PAID_GENERATION_ENABLED),
    mergeExportAuthorized: false,
    engineSelected: false,
  };
}

export function assertPhase11EMergeExportFlagsRemainOff(
  env: Record<string, string | undefined> = {},
): void {
  const flags = phase11EMergeExportFlagsAuditView(env);
  if (
    flags.mergeCapability ||
    flags.exportCapability ||
    flags.paid ||
    flags.provider ||
    flags.worker ||
    flags.exception ||
    flags.publishDownstream ||
    flags.directorPaid
  ) {
    throw new Error("Phase 11E: merge/export flags must remain OFF during wiring.");
  }
  if (parseStrictEnabledFlag(env.DIRECTOR_V2_ENABLED)) {
    throw new Error("Phase 11E: DIRECTOR_V2_ENABLED must remain OFF.");
  }
  if (parseStrictEnabledFlag(env.VHS11D_LIPSYNC_CAPABILITY_ENABLED) || parseStrictEnabledFlag(env.VHS11D_LIPSYNC_PAID_ENABLED)) {
    throw new Error("Phase 11E: VHS11D flags must remain OFF.");
  }
  if (parseStrictEnabledFlag(env.VHS11C_VOICE_CAPABILITY_ENABLED) || parseStrictEnabledFlag(env.VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION)) {
    throw new Error("Phase 11E: VHS11C flags must remain OFF.");
  }
  if (parseStrictEnabledFlag(env.VHS11B_I2V_CAPABILITY_ENABLED) || parseStrictEnabledFlag(env.VHS11B_FAL_I2V_DIRECTOR_EXCEPTION)) {
    throw new Error("Phase 11E: VHS11B flags must remain OFF.");
  }
}

export function assertPhase11ERealExecutionGates(
  env: Record<string, string | undefined> = {},
): never {
  assertPhase11EMergeExportFlagsRemainOff(env);
  throw new Error("Phase 11E: real merge/export execution is refused while capability/paid/provider/worker/downstream remain OFF.");
}

export type Phase11EAllowlistGate = {
  action: string;
  capabilityProfile: string;
  engineId?: string;
  fallbackRequested?: boolean;
  retryRequested?: boolean;
  realMergeRequested?: boolean;
  realExportRequested?: boolean;
  publicationRequested?: boolean;
  downloadRequested?: boolean;
  activationRequested?: boolean;
  motionRequested?: boolean;
  legacyEndpoint?: boolean;
  binaryProcessRequested?: boolean;
};

export function assertVhs11EMergeExportAllowlistScope(gate: Phase11EAllowlistGate): void {
  assertPhase11ADoesNotInvokeMotionEndpoint(gate.action);
  assertMv002RemainsDeferred(MV002_STATUS_DEFERRED);
  assertMotionRegistryStaysDisabled({ enabled: false, paidExecution: false });

  if (gate.action !== PHASE_11E_MERGE_ACTION && gate.action !== PHASE_11E_EXPORT_ACTION) {
    throw new Error("Phase 11E allowlist: action must be merge or export.");
  }
  if (gate.action === PHASE_11E_MERGE_ACTION && gate.capabilityProfile !== PHASE_11E_MERGE_CAPABILITY) {
    throw new Error("Phase 11E allowlist: merge capability must be postproduction.merge.");
  }
  if (gate.action === PHASE_11E_EXPORT_ACTION && gate.capabilityProfile !== PHASE_11E_EXPORT_CAPABILITY) {
    throw new Error("Phase 11E allowlist: export capability must be postproduction.export.");
  }
  if (gate.engineId && gate.engineId !== PHASE_11E_ENGINE && gate.engineId !== "fake-local") {
    throw new Error("Phase 11E allowlist: no merge/export engine is selected.");
  }
  if (
    gate.fallbackRequested ||
    gate.retryRequested ||
    gate.publicationRequested ||
    gate.downloadRequested ||
    gate.activationRequested ||
    gate.motionRequested ||
    gate.legacyEndpoint ||
    gate.binaryProcessRequested
  ) {
    throw new Error("Phase 11E allowlist: forbidden publication/legacy/retry/binary path.");
  }
  if (gate.realMergeRequested || gate.realExportRequested) {
    throw new Error("Phase 11E allowlist: real merge/export submit is forbidden.");
  }
}

export function assertPhase11ENotLegacyMergeEndpoint(path: string): void {
  if (
    path.includes(PHASE_11E_LEGACY_MERGE_ROUTE) ||
    path.includes(PHASE_11E_LEGACY_MERGE_AUDIO_ROUTE) ||
    path.includes("/api/generate/merge")
  ) {
    throw new Error("Phase 11E must not use legacy /api/generate/merge as Production proof.");
  }
}

export function assertPhase11ERegistryDisabled(enabled: boolean): void {
  if (enabled) {
    throw new Error("Phase 11E: merge/export engine registry must remain disabled.");
  }
}

export function assertPhase11EMergeExportAuthorizedFalse(authorized: boolean): void {
  if (authorized) {
    throw new Error("Phase 11E: mergeExportAuthorized must remain false.");
  }
}

export function redactPhase11EError(message: string): string {
  return message
    .replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=]+/gi, "data:[redacted]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]");
}
