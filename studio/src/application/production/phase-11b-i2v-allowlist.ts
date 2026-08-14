/**
 * Phase 11B — bounded fal Kling I2V Director exception.
 * Disabled by default. No provider call, no signed URL, no Production write.
 */
import { estimateVideo } from "@/lib/pricing";
import { parseStrictEnabledFlag } from "@/infrastructure/config/feature-flags";
import {
  assertMv002RemainsDeferred,
  assertMotionRegistryStaysDisabled,
  assertPhase11ADoesNotInvokeMotionEndpoint,
  assertPhase11ADoesNotUseMotionProject,
  MV002_STATUS_DEFERRED,
} from "./phase-11a-motion-isolation";
import { PHASE_11A_SMOKE_PROJECT_ID, PHASE_11A_SMOKE_SCENE_ID } from "./phase-11a-openai-image-allowlist";

export const PHASE_11B_I2V_WIRING_AUTH =
  "AUTH_11B_IMAGE_TO_VIDEO_PRODUCTION_WIRING_PREFLIGHT" as const;

export const VHS11B_FAL_I2V_DIRECTOR_EXCEPTION = "VHS11B_FAL_I2V_DIRECTOR_EXCEPTION" as const;
export const VHS11B_FAL_I2V_EXCEPTION_ENV = "VHS11B_FAL_I2V_DIRECTOR_EXCEPTION" as const;

export const PHASE_11B_I2V_CAPABILITY_FLAG_ENV = "VHS11B_I2V_CAPABILITY_ENABLED" as const;
export const PHASE_11B_I2V_PAID_FLAG_ENV = "VHS11B_I2V_PAID_ENABLED" as const;
export const PHASE_11B_I2V_PROVIDER_FLAG_ENV = "VHS11B_I2V_FAL_ENABLED" as const;
export const PHASE_11B_I2V_WORKER_FLAG_ENV = "VHS11B_I2V_WORKER_ENABLED" as const;
export const PHASE_11B_I2V_DOWNSTREAM_FLAG_ENV = "VHS11B_I2V_DOWNSTREAM_ENABLED" as const;

export const PHASE_11B_WIRE_VERSION = "phase-11b-i2v-wire-1.0.0" as const;
export const PHASE_11B_WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01" as const;
export const PHASE_11B_PROJECT_ID = PHASE_11A_SMOKE_PROJECT_ID;
export const PHASE_11B_SCENE_ID = PHASE_11A_SMOKE_SCENE_ID;
export const PHASE_11B_SCENE_ORDER = 2 as const;
export const PHASE_11B_CAPABILITY = "video.image_to_video" as const;
export const PHASE_11B_ACTION = "video" as const;
export const PHASE_11B_PROVIDER = "fal" as const;
export const PHASE_11B_MODEL = "fal-ai/kling-video/v2/master/image-to-video" as const;
export const PHASE_11B_RUNWAY_CANDIDATE = "fal-ai/runway-gen3/turbo/image-to-video" as const;
export const PHASE_11B_DURATION_SECONDS = 5 as const;
export const PHASE_11B_EXCEPTION_EXPIRES_AT = "2026-09-30T23:59:59.000Z" as const;
export const PHASE_11B_MAX_PROVIDER_CALLS = 1 as const;
export const PHASE_11B_MAX_JOBS = 1 as const;
export const PHASE_11B_MAX_OUTPUTS = 1 as const;
export const PHASE_11B_SIGNED_URL_TTL_SECONDS = 60 as const;

export const PHASE_11B_SOURCE_ASSET_ID = "49284892-d6ba-5249-b645-4f55084361cc" as const;
export const PHASE_11B_SOURCE_CHECKSUM =
  "9ac484b7a1db3264330ee09ddcb197fa8d83e6735a3476c7af5ab1547ff317f0" as const;
export const PHASE_11B_SOURCE_HR_DECISION_PREFIX = "fb2f886c" as const;

export const PHASE_11B_REJECTED_ASSET_PREFIXES = [
  "5d68ef64",
  "6a2beca9",
  "4429654f",
] as const;
export const PHASE_11B_PARENT_PENDING_PREFIX = "7832765d" as const;

export const PHASE_11B_LIVE_BUDGET = {
  hard: 274,
  committed: 249,
  reserved: 0,
  available: 25,
} as const;

export type Vhs11BFalI2vAllowlistScope = {
  exceptionId: typeof VHS11B_FAL_I2V_DIRECTOR_EXCEPTION;
  workspaceId: typeof PHASE_11B_WORKSPACE_ID;
  projectId: typeof PHASE_11B_PROJECT_ID;
  sceneId: typeof PHASE_11B_SCENE_ID;
  capability: typeof PHASE_11B_CAPABILITY;
  action: typeof PHASE_11B_ACTION;
  providerId: typeof PHASE_11B_PROVIDER;
  modelId: typeof PHASE_11B_MODEL;
  durationSeconds: typeof PHASE_11B_DURATION_SECONDS;
  maxCalls: typeof PHASE_11B_MAX_PROVIDER_CALLS;
  maxJobs: typeof PHASE_11B_MAX_JOBS;
  maxOutputs: typeof PHASE_11B_MAX_OUTPUTS;
  expiresAt: typeof PHASE_11B_EXCEPTION_EXPIRES_AT;
  downstreamChaining: false;
  retryAllowed: false;
  fallbackAllowed: false;
  motionAllowed: false;
  t2vAllowed: false;
  voiceAllowed: false;
  lipsyncAllowed: false;
  mergeExportAllowed: false;
  activationAllowed: false;
  legacyEndpointAllowed: false;
};

export const PHASE_11B_ALLOWLIST_SCOPE: Vhs11BFalI2vAllowlistScope = {
  exceptionId: VHS11B_FAL_I2V_DIRECTOR_EXCEPTION,
  workspaceId: PHASE_11B_WORKSPACE_ID,
  projectId: PHASE_11B_PROJECT_ID,
  sceneId: PHASE_11B_SCENE_ID,
  capability: PHASE_11B_CAPABILITY,
  action: PHASE_11B_ACTION,
  providerId: PHASE_11B_PROVIDER,
  modelId: PHASE_11B_MODEL,
  durationSeconds: PHASE_11B_DURATION_SECONDS,
  maxCalls: PHASE_11B_MAX_PROVIDER_CALLS,
  maxJobs: PHASE_11B_MAX_JOBS,
  maxOutputs: PHASE_11B_MAX_OUTPUTS,
  expiresAt: PHASE_11B_EXCEPTION_EXPIRES_AT,
  downstreamChaining: false,
  retryAllowed: false,
  fallbackAllowed: false,
  motionAllowed: false,
  t2vAllowed: false,
  voiceAllowed: false,
  lipsyncAllowed: false,
  mergeExportAllowed: false,
  activationAllowed: false,
  legacyEndpointAllowed: false,
};

export function isVhs11BFalI2vExceptionEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return parseStrictEnabledFlag(env[VHS11B_FAL_I2V_EXCEPTION_ENV]);
}

export function isVhs11BFalI2vExceptionExpired(nowIso = new Date().toISOString()): boolean {
  return Date.parse(nowIso) > Date.parse(PHASE_11B_EXCEPTION_EXPIRES_AT);
}

export function phase11BI2vFlagsAuditView(
  env: Record<string, string | undefined> = {},
): {
  capability: boolean;
  paid: boolean;
  provider: boolean;
  worker: boolean;
  exception: boolean;
  downstream: boolean;
  mergeExport: false;
  motion: false;
} {
  return {
    capability: parseStrictEnabledFlag(env[PHASE_11B_I2V_CAPABILITY_FLAG_ENV]),
    paid: parseStrictEnabledFlag(env[PHASE_11B_I2V_PAID_FLAG_ENV]),
    provider: parseStrictEnabledFlag(env[PHASE_11B_I2V_PROVIDER_FLAG_ENV]),
    worker: parseStrictEnabledFlag(env[PHASE_11B_I2V_WORKER_FLAG_ENV]),
    exception: isVhs11BFalI2vExceptionEnabled(env),
    downstream: parseStrictEnabledFlag(env[PHASE_11B_I2V_DOWNSTREAM_FLAG_ENV]),
    mergeExport: false,
    motion: false,
  };
}

export function assertVhs11BFalI2vExceptionActive(input: {
  env: Record<string, string | undefined>;
  nowIso?: string;
}): void {
  if (!isVhs11BFalI2vExceptionEnabled(input.env)) {
    throw new Error("VHS11B_FAL_I2V_DIRECTOR_EXCEPTION is disabled — real I2V adapter forbidden.");
  }
  if (isVhs11BFalI2vExceptionExpired(input.nowIso)) {
    throw new Error("VHS11B_FAL_I2V_DIRECTOR_EXCEPTION expired — real I2V adapter forbidden.");
  }
}

export function assertPhase11BI2vFlagsRemainOff(
  env: Record<string, string | undefined> = {},
): void {
  const flags = phase11BI2vFlagsAuditView(env);
  if (flags.capability || flags.paid || flags.provider || flags.worker || flags.exception || flags.downstream) {
    throw new Error("Phase 11B: I2V flags must remain OFF during wiring preflight.");
  }
}

export type Phase11BAllowlistGate = {
  workspaceId?: string;
  projectId: string;
  sceneId: string;
  action: string;
  capabilityProfile: string;
  providerId: string;
  modelId: string;
  durationSeconds?: number;
  stepCount?: number;
  jobCount?: number;
  outputCount?: number;
  fallbackRequested?: boolean;
  retryRequested?: boolean;
  downstreamRequested?: boolean;
  voiceRequested?: boolean;
  lipsyncRequested?: boolean;
  mergeRequested?: boolean;
  exportRequested?: boolean;
  activationRequested?: boolean;
  motionRequested?: boolean;
  t2vRequested?: boolean;
  legacyEndpoint?: boolean;
  openaiImageRequested?: boolean;
};

export function assertVhs11BFalI2vAllowlistScope(gate: Phase11BAllowlistGate): void {
  assertPhase11ADoesNotUseMotionProject(gate.projectId);
  assertPhase11ADoesNotInvokeMotionEndpoint(gate.action);
  assertPhase11ADoesNotInvokeMotionEndpoint(gate.modelId);
  assertMv002RemainsDeferred(MV002_STATUS_DEFERRED);
  assertMotionRegistryStaysDisabled({ enabled: false, paidExecution: false });

  if (gate.workspaceId && gate.workspaceId !== PHASE_11B_WORKSPACE_ID) {
    throw new Error("Phase 11B allowlist: workspace not in scope.");
  }
  if (gate.projectId !== PHASE_11B_PROJECT_ID) {
    throw new Error("Phase 11B allowlist: projectId not in scope.");
  }
  if (gate.sceneId !== PHASE_11B_SCENE_ID) {
    throw new Error("Phase 11B allowlist: sceneId not in scope.");
  }
  if (gate.action !== PHASE_11B_ACTION) {
    throw new Error("Phase 11B allowlist: action must be video (I2V).");
  }
  if (gate.capabilityProfile !== PHASE_11B_CAPABILITY) {
    throw new Error("Phase 11B allowlist: capability must be video.image_to_video.");
  }
  if (gate.providerId !== PHASE_11B_PROVIDER) {
    throw new Error("Phase 11B allowlist: provider must be fal.");
  }
  if (gate.modelId !== PHASE_11B_MODEL) {
    throw new Error("Phase 11B allowlist: model must be Kling I2V.");
  }
  if ((gate.durationSeconds ?? PHASE_11B_DURATION_SECONDS) !== PHASE_11B_DURATION_SECONDS) {
    throw new Error("Phase 11B allowlist: duration must be the documented minimum 5s.");
  }
  if ((gate.stepCount ?? 1) !== 1 || (gate.jobCount ?? 1) !== 1 || (gate.outputCount ?? 1) !== 1) {
    throw new Error("Phase 11B allowlist: single-step / single-job / single-output only.");
  }
  if (
    gate.fallbackRequested ||
    gate.retryRequested ||
    gate.downstreamRequested ||
    gate.voiceRequested ||
    gate.lipsyncRequested ||
    gate.mergeRequested ||
    gate.exportRequested ||
    gate.activationRequested ||
    gate.motionRequested ||
    gate.t2vRequested ||
    gate.legacyEndpoint ||
    gate.openaiImageRequested
  ) {
    throw new Error("Phase 11B allowlist: forbidden downstream/legacy/motion/T2V/OpenAI path.");
  }
}

export function estimatePhase11BKlingI2vUsd(seconds = PHASE_11B_DURATION_SECONDS): number {
  return estimateVideo(PHASE_11B_MODEL, seconds);
}

export function estimatePhase11BRunwayI2vUsd(seconds = PHASE_11B_DURATION_SECONDS): number {
  return estimateVideo(PHASE_11B_RUNWAY_CANDIDATE, seconds);
}

export function phase11BFutureBudgetCompare(input?: { availableMinor?: number }): {
  klingEstimateMinor: number;
  klingReservationMinor: number;
  klingCapMinor: number;
  klingShortfallMinor: number;
  runwayEstimateMinor: number;
  runwayReservationMinor: number;
  runwayShortfallMinor: number;
  availableMinor: number;
  hardLimitMinimumKling: number;
  hardLimitRecommendedKling: number;
  selectedModel: typeof PHASE_11B_MODEL;
  selectedReason: "adapter_and_transport_already_present";
  runwayStatus: "same_fal_transport_not_allowlisted";
} {
  const available = input?.availableMinor ?? PHASE_11B_LIVE_BUDGET.available;
  const klingUsd = estimatePhase11BKlingI2vUsd();
  const runwayUsd = estimatePhase11BRunwayI2vUsd();
  const klingEstimateMinor = Math.round(klingUsd * 100);
  const runwayEstimateMinor = Math.round(runwayUsd * 100);
  const klingReservationMinor = Math.ceil(klingEstimateMinor * 1.2);
  const runwayReservationMinor = Math.ceil(runwayEstimateMinor * 1.2);
  const klingCapMinor = klingReservationMinor;
  return {
    klingEstimateMinor,
    klingReservationMinor,
    klingCapMinor,
    klingShortfallMinor: Math.max(0, klingReservationMinor - available),
    runwayEstimateMinor,
    runwayReservationMinor,
    runwayShortfallMinor: Math.max(0, runwayReservationMinor - available),
    availableMinor: available,
    hardLimitMinimumKling: PHASE_11B_LIVE_BUDGET.committed + klingReservationMinor,
    hardLimitRecommendedKling: PHASE_11B_LIVE_BUDGET.committed + klingReservationMinor + 20,
    selectedModel: PHASE_11B_MODEL,
    selectedReason: "adapter_and_transport_already_present",
    runwayStatus: "same_fal_transport_not_allowlisted",
  };
}

export function assertPhase11BDoesNotCallOpenAIImage(openaiImageCalls: number): void {
  if (openaiImageCalls !== 0) {
    throw new Error("Phase 11B must not call OpenAI Image.");
  }
}

export function assertPhase11BDoesNotUseRejectedOrPendingSource(assetId: string): void {
  const prefix = assetId.slice(0, 8).toLowerCase();
  if (PHASE_11B_REJECTED_ASSET_PREFIXES.includes(prefix as (typeof PHASE_11B_REJECTED_ASSET_PREFIXES)[number])) {
    throw new Error("Phase 11B must not use a rejected composed/smoke asset.");
  }
  if (prefix === PHASE_11B_PARENT_PENDING_PREFIX) {
    throw new Error("Phase 11B must not use the pending parent provider asset.");
  }
}

export function assertPhase11BNotLegacyImageEndpoint(path: string): void {
  if (path.includes("/api/generate/image") || path.includes("/api/generate/video")) {
    throw new Error("Phase 11B must not use legacy generate endpoints as Production proof.");
  }
}

export function phase11BI2vWiringDryRun(): {
  providerCalled: false;
  signedUrlCount: 0;
  mediaReads: 0;
  productionWrites: 0;
  persistedPlan: false;
  activationRequested: false;
  capability: typeof PHASE_11B_CAPABILITY;
  provider: typeof PHASE_11B_PROVIDER;
  model: typeof PHASE_11B_MODEL;
  durationSeconds: typeof PHASE_11B_DURATION_SECONDS;
  maximumCalls: 1;
  maximumJobs: 1;
  maximumOutputs: 1;
} {
  assertPhase11BI2vFlagsRemainOff({});
  return {
    providerCalled: false,
    signedUrlCount: 0,
    mediaReads: 0,
    productionWrites: 0,
    persistedPlan: false,
    activationRequested: false,
    capability: PHASE_11B_CAPABILITY,
    provider: PHASE_11B_PROVIDER,
    model: PHASE_11B_MODEL,
    durationSeconds: PHASE_11B_DURATION_SECONDS,
    maximumCalls: 1,
    maximumJobs: 1,
    maximumOutputs: 1,
  };
}
