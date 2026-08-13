/**
 * Phase 11A-WIRE — VHS-124 OpenAI image Director exception (allowlist).
 * Disabled by default. No provider call, no ledger write, no Production job here.
 */

import { createHash } from "node:crypto";
import { estimateImage } from "@/lib/pricing";
import { parseStrictEnabledFlag } from "@/infrastructure/config/feature-flags";
import {
  assertPhase11ADoesNotInvokeMotionEndpoint,
  assertPhase11ADoesNotUseMotionProject,
  MV001_MOTION_PROJECT_ID,
  PHASE_11A_RESUME_BUDGET,
} from "./phase-11a-motion-isolation";

/** Explicit temporary exception id — not a general DIRECTOR_V2_* flag. */
export const VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION =
  "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION" as const;

/** Env key — only "1"/"true" enables the exception (default OFF). */
export const VHS124_OPENAI_IMAGE_EXCEPTION_ENV =
  "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION" as const;

export const PHASE_11A_WIRE_VERSION = "phase-11a-wire-openai-image-1.0.0" as const;

/**
 * Functional composition fingerprint — preflight must verify this (or the
 * deploying git SHA of the applicative commit), not a docs-only commit.
 */
export const PHASE_11A_RUNTIME_COMPOSITION_VERSION =
  "phase-11a-storage-plan-materialize-1.0.0" as const;

/** Smoke text project (≠ Motion MV-001). */
export const PHASE_11A_SMOKE_PROJECT_ID =
  "984507af-a89e-4644-8ea3-344797baa974" as const;

export const PHASE_11A_SMOKE_SCENE_ID = "scene-2" as const;
export const PHASE_11A_SMOKE_SCENE_ORDER = 2 as const;
export const PHASE_11A_SMOKE_INTENT = "text_motion" as const;
export const PHASE_11A_SMOKE_CAPABILITY = "image.text_to_image" as const;
export const PHASE_11A_SMOKE_PROVIDER = "openai" as const;
export const PHASE_11A_SMOKE_MODEL = "gpt-image-1" as const;
export const PHASE_11A_SMOKE_QUALITY = "low" as const;
export const PHASE_11A_SMOKE_SIZE = "1024x1024" as const;
export const PHASE_11A_SMOKE_ACTION = "image" as const;

/** Hard expiry of the temporary exception (UTC). */
export const VHS124_OPENAI_IMAGE_EXCEPTION_EXPIRES_AT =
  "2026-09-30T23:59:59.000Z" as const;

export const PHASE_11A_MAX_PROVIDER_CALLS = 1 as const;
export const PHASE_11A_MAX_JOBS = 1 as const;
export const PHASE_11A_MAX_OUTPUTS = 1 as const;
export const PHASE_11A_MAX_RESERVATION_MINOR = 2 as const;

export type Vhs124OpenAIImageAllowlistScope = {
  exceptionId: typeof VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION;
  projectId: typeof PHASE_11A_SMOKE_PROJECT_ID;
  sceneId: typeof PHASE_11A_SMOKE_SCENE_ID;
  sceneOrder: typeof PHASE_11A_SMOKE_SCENE_ORDER;
  productionIntent: typeof PHASE_11A_SMOKE_INTENT;
  capability: typeof PHASE_11A_SMOKE_CAPABILITY;
  providerId: typeof PHASE_11A_SMOKE_PROVIDER;
  modelId: typeof PHASE_11A_SMOKE_MODEL;
  quality: typeof PHASE_11A_SMOKE_QUALITY;
  size: typeof PHASE_11A_SMOKE_SIZE;
  action: typeof PHASE_11A_SMOKE_ACTION;
  maxCalls: typeof PHASE_11A_MAX_PROVIDER_CALLS;
  maxJobs: typeof PHASE_11A_MAX_JOBS;
  maxOutputs: typeof PHASE_11A_MAX_OUTPUTS;
  maxReservationMinor: typeof PHASE_11A_MAX_RESERVATION_MINOR;
  expiresAt: typeof VHS124_OPENAI_IMAGE_EXCEPTION_EXPIRES_AT;
  downstreamChaining: false;
  retryAllowed: false;
  fallbackAllowed: false;
  motionAllowed: false;
  legacyEndpointAllowed: false;
};

export const PHASE_11A_ALLOWLIST_SCOPE: Vhs124OpenAIImageAllowlistScope = {
  exceptionId: VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION,
  projectId: PHASE_11A_SMOKE_PROJECT_ID,
  sceneId: PHASE_11A_SMOKE_SCENE_ID,
  sceneOrder: PHASE_11A_SMOKE_SCENE_ORDER,
  productionIntent: PHASE_11A_SMOKE_INTENT,
  capability: PHASE_11A_SMOKE_CAPABILITY,
  providerId: PHASE_11A_SMOKE_PROVIDER,
  modelId: PHASE_11A_SMOKE_MODEL,
  quality: PHASE_11A_SMOKE_QUALITY,
  size: PHASE_11A_SMOKE_SIZE,
  action: PHASE_11A_SMOKE_ACTION,
  maxCalls: PHASE_11A_MAX_PROVIDER_CALLS,
  maxJobs: PHASE_11A_MAX_JOBS,
  maxOutputs: PHASE_11A_MAX_OUTPUTS,
  maxReservationMinor: PHASE_11A_MAX_RESERVATION_MINOR,
  expiresAt: VHS124_OPENAI_IMAGE_EXCEPTION_EXPIRES_AT,
  downstreamChaining: false,
  retryAllowed: false,
  fallbackAllowed: false,
  motionAllowed: false,
  legacyEndpointAllowed: false,
};

/** Observable audit surface — never includes secrets or prompts. */
export type Vhs124ExceptionAuditView = {
  exceptionId: typeof VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION;
  enabled: boolean;
  expired: boolean;
  expiresAt: string;
  projectId: string;
  sceneId: string;
  capability: string;
  providerId: string;
  modelId: string;
  quality: string;
  size: string;
  registryClaim: "DOES_NOT_DECLARE_GLOBAL_REAL_PROVIDER_COMPATIBILITY";
  motionAllowed: false;
  videoVoiceLipsyncComposeAllowed: false;
};

export function isVhs124OpenAIImageExceptionEnabled(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  return parseStrictEnabledFlag(env[VHS124_OPENAI_IMAGE_EXCEPTION_ENV]);
}

export function isVhs124OpenAIImageExceptionExpired(
  nowIso: string = new Date().toISOString(),
): boolean {
  return Date.parse(nowIso) > Date.parse(VHS124_OPENAI_IMAGE_EXCEPTION_EXPIRES_AT);
}

export function vhs124OpenAIImageExceptionAuditView(
  env: Record<string, string | undefined> = {},
  nowIso: string = new Date().toISOString(),
): Vhs124ExceptionAuditView {
  return {
    exceptionId: VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION,
    enabled: isVhs124OpenAIImageExceptionEnabled(env),
    expired: isVhs124OpenAIImageExceptionExpired(nowIso),
    expiresAt: VHS124_OPENAI_IMAGE_EXCEPTION_EXPIRES_AT,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    capability: PHASE_11A_SMOKE_CAPABILITY,
    providerId: PHASE_11A_SMOKE_PROVIDER,
    modelId: PHASE_11A_SMOKE_MODEL,
    quality: PHASE_11A_SMOKE_QUALITY,
    size: PHASE_11A_SMOKE_SIZE,
    registryClaim: "DOES_NOT_DECLARE_GLOBAL_REAL_PROVIDER_COMPATIBILITY",
    motionAllowed: false,
    videoVoiceLipsyncComposeAllowed: false,
  };
}

export function assertVhs124OpenAIImageExceptionActive(input: {
  env: Record<string, string | undefined>;
  nowIso?: string;
}): void {
  if (!isVhs124OpenAIImageExceptionEnabled(input.env)) {
    throw new Error(
      "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION is disabled — real OpenAI image adapter forbidden.",
    );
  }
  if (isVhs124OpenAIImageExceptionExpired(input.nowIso)) {
    throw new Error(
      "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION expired — real OpenAI image adapter forbidden.",
    );
  }
}

export type AllowlistCommandGate = {
  projectId: string;
  sceneId: string;
  action: string;
  capabilityProfile: string;
  providerId: string;
  modelId: string;
  stepCount?: number;
  jobCount?: number;
  outputCount?: number;
  fallbackRequested?: boolean;
  retryRequested?: boolean;
  downstreamRequested?: boolean;
  estimateMinor?: number;
  motionFlagsOrAssetsReferenced?: boolean;
  legacyEndpoint?: boolean;
  fakeAdapterOnRealPath?: boolean;
};

export function assertVhs124OpenAIImageAllowlistScope(
  gate: AllowlistCommandGate,
): void {
  assertPhase11ADoesNotUseMotionProject(gate.projectId);
  assertPhase11ADoesNotInvokeMotionEndpoint(gate.action);
  assertPhase11ADoesNotInvokeMotionEndpoint(gate.modelId);

  if (gate.projectId !== PHASE_11A_SMOKE_PROJECT_ID) {
    throw new Error("Phase 11A allowlist: projectId not in scope.");
  }
  if (gate.sceneId !== PHASE_11A_SMOKE_SCENE_ID) {
    throw new Error("Phase 11A allowlist: sceneId not in scope.");
  }
  if (gate.action !== PHASE_11A_SMOKE_ACTION) {
    throw new Error("Phase 11A allowlist: action not image.");
  }
  if (gate.capabilityProfile !== PHASE_11A_SMOKE_CAPABILITY) {
    throw new Error("Phase 11A allowlist: capability not image.text_to_image.");
  }
  if (gate.providerId !== PHASE_11A_SMOKE_PROVIDER) {
    throw new Error("Phase 11A allowlist: provider not openai.");
  }
  if (gate.modelId !== PHASE_11A_SMOKE_MODEL) {
    throw new Error("Phase 11A allowlist: model not gpt-image-1.");
  }
  if ((gate.stepCount ?? 1) !== 1) {
    throw new Error("Phase 11A allowlist: more than one step forbidden.");
  }
  if ((gate.jobCount ?? 1) !== 1) {
    throw new Error("Phase 11A allowlist: more than one job forbidden.");
  }
  if ((gate.outputCount ?? 1) !== 1) {
    throw new Error("Phase 11A allowlist: more than one output forbidden.");
  }
  if (gate.fallbackRequested) {
    throw new Error("Phase 11A allowlist: fallback forbidden.");
  }
  if (gate.retryRequested) {
    throw new Error("Phase 11A allowlist: retry forbidden.");
  }
  if (gate.downstreamRequested) {
    throw new Error("Phase 11A allowlist: downstream chaining forbidden.");
  }
  if (gate.motionFlagsOrAssetsReferenced) {
    throw new Error("Phase 11A allowlist: Motion flags/assets forbidden.");
  }
  if (gate.legacyEndpoint) {
    throw new Error("Phase 11A allowlist: legacy /api/generate/image forbidden.");
  }
  if (gate.fakeAdapterOnRealPath) {
    throw new Error("Phase 11A allowlist: fake adapter forbidden on real path.");
  }
  if (
    gate.estimateMinor != null &&
    gate.estimateMinor > PHASE_11A_MAX_RESERVATION_MINOR
  ) {
    throw new Error(
      "Phase 11A allowlist: estimate exceeds max reservation 2¢ — STOP before reserve.",
    );
  }
}

/** Canonical private Storage path for Phase 11A image ingest. */
export function buildPhase11AImageStoragePath(input: {
  workspaceId: string;
  projectId: string;
  assetId: string;
}): string {
  const workspaceId = input.workspaceId.trim();
  const projectId = input.projectId.trim();
  const assetId = input.assetId.trim();
  if (!workspaceId || !projectId || !assetId) {
    throw new Error("Phase 11A storage path requires workspace/project/asset ids.");
  }
  if (
    workspaceId.includes("..") ||
    projectId.includes("..") ||
    assetId.includes("..") ||
    workspaceId.includes("/") ||
    projectId.includes("/") ||
    assetId.includes("/")
  ) {
    throw new Error("Phase 11A storage path segments invalid.");
  }
  if (projectId === MV001_MOTION_PROJECT_ID) {
    throw new Error("Phase 11A storage path must not use Motion project.");
  }
  return `${workspaceId}/${projectId}/media/image/${assetId}.png`;
}

export type Phase11AWireDryRunResult = {
  providerCalled: false;
  executable: boolean;
  capability: typeof PHASE_11A_SMOKE_CAPABILITY;
  provider: typeof PHASE_11A_SMOKE_PROVIDER;
  model: typeof PHASE_11A_SMOKE_MODEL;
  quality: typeof PHASE_11A_SMOKE_QUALITY;
  size: typeof PHASE_11A_SMOKE_SIZE;
  maximumCalls: 1;
  maximumJobs: 1;
  maximumOutputs: 1;
  /** USD cents (integer). */
  estimateMinor: number;
  /** USD float from pricing catalogue (exact). */
  estimateUsd: number;
  reservationMinor: number;
  pricingConfigured: boolean;
  exceptionScoped: true;
  exceptionEnabled: boolean;
  exceptionExpired: boolean;
  downstream: false;
  motionIsolation: true;
  legacyIsolated: true;
  maxReservationMinor: typeof PHASE_11A_MAX_RESERVATION_MINOR;
  availableMinor: number;
  shortfallMinor: number;
  pathStatus: "WIRED_DISABLED" | "WIRED_EXCEPTION_ON_BUT_EXPIRED" | "WIRED_EXCEPTION_ACTIVE";
  registryClaim: "DOES_NOT_DECLARE_GLOBAL_REAL_PROVIDER_COMPATIBILITY";
  promptHashAlgo: "sha256";
  notes: string[];
  canonicalRouting: boolean;
  generationPlanMaterialized: boolean;
  singleStep: true;
  storageIngestWired: boolean;
  persistedMediaPayloadPossible: false;
  assetActive: false;
  humanReviewRequired: true;
  compositionFingerprint: string;
  compositionVersion: typeof PHASE_11A_RUNTIME_COMPOSITION_VERSION;
};

export function phase11AOpenAIImageAllowlistDryRun(input: {
  env?: Record<string, string | undefined>;
  nowIso?: string;
  availableMinor?: number;
  /** Override catalogue USD if env pricing differs — never invent. */
  estimateUsdOverride?: number;
}): Phase11AWireDryRunResult {
  const env = input.env ?? {};
  const nowIso = input.nowIso ?? new Date().toISOString();
  const estimateUsd =
    input.estimateUsdOverride ?? estimateImage(PHASE_11A_SMOKE_SIZE, PHASE_11A_SMOKE_QUALITY, 1);
  const estimateMinor = Math.round(estimateUsd * 100);
  const reservationMinor = Math.min(
    PHASE_11A_MAX_RESERVATION_MINOR,
    Math.max(estimateMinor, PHASE_11A_RESUME_BUDGET.imageReservationMinor),
  );
  const availableMinor =
    input.availableMinor ?? PHASE_11A_RESUME_BUDGET.availableMinor;
  const shortfallMinor = Math.max(0, reservationMinor - availableMinor);
  const exceptionEnabled = isVhs124OpenAIImageExceptionEnabled(env);
  const exceptionExpired = isVhs124OpenAIImageExceptionExpired(nowIso);

  let pathStatus: Phase11AWireDryRunResult["pathStatus"] = "WIRED_DISABLED";
  if (exceptionEnabled && exceptionExpired) {
    pathStatus = "WIRED_EXCEPTION_ON_BUT_EXPIRED";
  } else if (exceptionEnabled) {
    pathStatus = "WIRED_EXCEPTION_ACTIVE";
  }

  const notes: string[] = [];
  if (estimateUsd !== 0.011) {
    notes.push(`pricing catalogue differs from indicative 0.011 USD: ${estimateUsd}`);
  }
  if (estimateMinor > PHASE_11A_MAX_RESERVATION_MINOR) {
    notes.push("estimate exceeds max reservation — STOP before reserve");
  }

  return {
    providerCalled: false,
    // Path is executable for planning when pricing fits; exception still required for real adapters.
    executable: !exceptionExpired && estimateMinor <= PHASE_11A_MAX_RESERVATION_MINOR,
    capability: PHASE_11A_SMOKE_CAPABILITY,
    provider: PHASE_11A_SMOKE_PROVIDER,
    model: PHASE_11A_SMOKE_MODEL,
    quality: PHASE_11A_SMOKE_QUALITY,
    size: PHASE_11A_SMOKE_SIZE,
    maximumCalls: 1,
    maximumJobs: 1,
    maximumOutputs: 1,
    estimateMinor,
    estimateUsd,
    reservationMinor,
    pricingConfigured: Number.isFinite(estimateUsd) && estimateUsd > 0,
    exceptionScoped: true,
    exceptionEnabled,
    exceptionExpired,
    downstream: false,
    motionIsolation: true,
    legacyIsolated: true,
    maxReservationMinor: PHASE_11A_MAX_RESERVATION_MINOR,
    availableMinor,
    shortfallMinor,
    pathStatus,
    registryClaim: "DOES_NOT_DECLARE_GLOBAL_REAL_PROVIDER_COMPATIBILITY",
    promptHashAlgo: "sha256",
    notes,
    canonicalRouting: true,
    generationPlanMaterialized: true,
    singleStep: true,
    storageIngestWired: true,
    persistedMediaPayloadPossible: false,
    assetActive: false,
    humanReviewRequired: true,
    compositionFingerprint: phase11ARuntimeCompositionFingerprint(),
    compositionVersion: PHASE_11A_RUNTIME_COMPOSITION_VERSION,
  };
}

export function hashPhase11APrompt(prompt: string): string {
  return createHash("sha256").update(prompt, "utf8").digest("hex");
}

export type Phase11AWorkerCounters = {
  providerSubmitCount: number;
  outputDownloadCount: number;
  decodedImageCount: number;
  storageWriteCount: number;
  assetInsertCount: number;
  qualityReportCount: number;
  reviewContextCount: number;
  ledgerSettlementCount: number;
};

/**
 * Ledger settlement (reserve/commit/release) is owned by Production Director
 * and must run on durable provider success including QC `needs_review`.
 * Human Review APPROVE/REJECT must never be the financial closer.
 */

export function createPhase11AWorkerCounters(): Phase11AWorkerCounters {
  return {
    providerSubmitCount: 0,
    outputDownloadCount: 0,
    decodedImageCount: 0,
    storageWriteCount: 0,
    assetInsertCount: 0,
    qualityReportCount: 0,
    reviewContextCount: 0,
    ledgerSettlementCount: 0,
  };
}

export function assertPhase11AWorkerCountersWithinSmoke(
  counters: Phase11AWorkerCounters,
): void {
  const keys: (keyof Phase11AWorkerCounters)[] = [
    "providerSubmitCount",
    "outputDownloadCount",
    "decodedImageCount",
    "storageWriteCount",
    "assetInsertCount",
    "qualityReportCount",
    "reviewContextCount",
    "ledgerSettlementCount",
  ];
  for (const key of keys) {
    if (counters[key] > 1) {
      throw new Error(`Phase 11A: ${key} > 1`);
    }
  }
}

export function phase11ARuntimeCompositionFingerprint(): string {
  return createHash("sha256")
    .update(
      [
        PHASE_11A_RUNTIME_COMPOSITION_VERSION,
        PHASE_11A_WIRE_VERSION,
        "canonical_routing_single_step",
        "private_storage_ingest",
        "sanitize_persisted_state",
        "strip_inline_before_run_state",
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 16);
}
