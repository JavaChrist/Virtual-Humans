/**
 * Phase 11C — bounded ElevenLabs Voice/TTS Director exception.
 * Disabled by default. No provider call, no reservation, no Production write.
 */
import { estimateVoice } from "@/lib/pricing";
import { parseStrictEnabledFlag } from "@/infrastructure/config/feature-flags";
import {
  PHASE_11A_SMOKE_PROJECT_ID,
  PHASE_11A_SMOKE_SCENE_ID,
} from "./phase-11a-openai-image-allowlist";
import { PHASE_11B_WORKSPACE_ID } from "./phase-11b-i2v-allowlist";
import {
  assertMotionRegistryStaysDisabled,
  assertMv002RemainsDeferred,
  assertPhase11ADoesNotInvokeMotionEndpoint,
  MV002_STATUS_DEFERRED,
} from "./phase-11a-motion-isolation";

export const PHASE_11C_VOICE_WIRING_AUTH =
  "AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT" as const;

export const PHASE_11C_VOICE_WIRING_VERDICT =
  "VOICE_TTS_PATH_WIRED_DISABLED_BLOCKED_VOICE_OR_CONSENT" as const;

export const PHASE_11C_NEXT_AUTH =
  "AUTH_11C_VOICE_NARRATOR_BINDING_AND_CONSENT" as const;

export const VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION =
  "VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION" as const;
export const VHS11C_VOICE_EXCEPTION_ENV =
  "VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION" as const;

export const PHASE_11C_VOICE_CAPABILITY_FLAG_ENV = "VHS11C_VOICE_CAPABILITY_ENABLED" as const;
export const PHASE_11C_VOICE_PAID_FLAG_ENV = "VHS11C_VOICE_PAID_ENABLED" as const;
export const PHASE_11C_VOICE_PROVIDER_FLAG_ENV = "VHS11C_VOICE_ELEVENLABS_ENABLED" as const;
export const PHASE_11C_VOICE_WORKER_FLAG_ENV = "VHS11C_VOICE_WORKER_ENABLED" as const;
export const PHASE_11C_VOICE_DOWNSTREAM_FLAG_ENV = "VHS11C_VOICE_DOWNSTREAM_ENABLED" as const;

export const PHASE_11C_WIRE_VERSION = "phase-11c-voice-wire-1.0.0" as const;
export const PHASE_11C_WORKSPACE_ID = PHASE_11B_WORKSPACE_ID;
export const PHASE_11C_PROJECT_ID = PHASE_11A_SMOKE_PROJECT_ID;
export const PHASE_11C_SCENE_ID = PHASE_11A_SMOKE_SCENE_ID;
export const PHASE_11C_SCENE_ORDER = 2 as const;
export const PHASE_11C_CAPABILITY = "audio.voice" as const;
export const PHASE_11C_ACTION = "voice" as const;
export const PHASE_11C_PROVIDER = "elevenlabs" as const;
export const PHASE_11C_MODEL = "eleven_multilingual_v2" as const;
export const PHASE_11C_STRATEGY = "voice_over" as const;
export const PHASE_11C_STRATEGY_SLICE = "spoken_tts_single_step" as const;
export const PHASE_11C_MAX_PROVIDER_CALLS = 1 as const;
export const PHASE_11C_MAX_JOBS = 1 as const;
export const PHASE_11C_MAX_OUTPUTS = 1 as const;
export const PHASE_11C_MAX_TEXT_CHARS = 400 as const;
export const PHASE_11C_SUPPORTED_LANGUAGE = "fr" as const;
export const PHASE_11C_EXCEPTION_EXPIRES_AT = "2026-09-30T23:59:59.000Z" as const;

export const PHASE_11C_LIVE_BUDGET = {
  hard: 437,
  committed: 389,
  reserved: 0,
  available: 48,
} as const;

export const PHASE_11C_LEGACY_VOICE_ROUTE = "/api/generate/voice" as const;

export type Vhs11CVoiceAllowlistScope = {
  exceptionId: typeof VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION;
  workspaceId: typeof PHASE_11C_WORKSPACE_ID;
  projectId: typeof PHASE_11C_PROJECT_ID;
  sceneId: typeof PHASE_11C_SCENE_ID;
  capability: typeof PHASE_11C_CAPABILITY;
  action: typeof PHASE_11C_ACTION;
  providerId: typeof PHASE_11C_PROVIDER;
  modelId: typeof PHASE_11C_MODEL;
  maxCalls: typeof PHASE_11C_MAX_PROVIDER_CALLS;
  maxJobs: typeof PHASE_11C_MAX_JOBS;
  maxOutputs: typeof PHASE_11C_MAX_OUTPUTS;
  maxTextChars: typeof PHASE_11C_MAX_TEXT_CHARS;
  language: typeof PHASE_11C_SUPPORTED_LANGUAGE;
  expiresAt: typeof PHASE_11C_EXCEPTION_EXPIRES_AT;
  paidExecution: false;
  globallyEligible: false;
  downstreamChaining: false;
  retryAllowed: false;
  fallbackAllowed: false;
  lipsyncAllowed: false;
  mergeAllowed: false;
  exportAllowed: false;
  activationAllowed: false;
  legacyEndpointAllowed: false;
  envVoiceFallbackAllowed: false;
  universalFakeAllowed: false;
};

export const PHASE_11C_ALLOWLIST_SCOPE: Vhs11CVoiceAllowlistScope = {
  exceptionId: VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION,
  workspaceId: PHASE_11C_WORKSPACE_ID,
  projectId: PHASE_11C_PROJECT_ID,
  sceneId: PHASE_11C_SCENE_ID,
  capability: PHASE_11C_CAPABILITY,
  action: PHASE_11C_ACTION,
  providerId: PHASE_11C_PROVIDER,
  modelId: PHASE_11C_MODEL,
  maxCalls: PHASE_11C_MAX_PROVIDER_CALLS,
  maxJobs: PHASE_11C_MAX_JOBS,
  maxOutputs: PHASE_11C_MAX_OUTPUTS,
  maxTextChars: PHASE_11C_MAX_TEXT_CHARS,
  language: PHASE_11C_SUPPORTED_LANGUAGE,
  expiresAt: PHASE_11C_EXCEPTION_EXPIRES_AT,
  paidExecution: false,
  globallyEligible: false,
  downstreamChaining: false,
  retryAllowed: false,
  fallbackAllowed: false,
  lipsyncAllowed: false,
  mergeAllowed: false,
  exportAllowed: false,
  activationAllowed: false,
  legacyEndpointAllowed: false,
  envVoiceFallbackAllowed: false,
  universalFakeAllowed: false,
};

export function isVhs11CVoiceExceptionEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return parseStrictEnabledFlag(env[VHS11C_VOICE_EXCEPTION_ENV]);
}

export function phase11CVoiceFlagsAuditView(
  env: Record<string, string | undefined> = {},
): {
  capability: boolean;
  paid: boolean;
  provider: boolean;
  worker: boolean;
  exception: boolean;
  downstream: boolean;
  lipsync: false;
  mergeExport: false;
  motion: false;
  vhs11b: false;
  vhs124: false;
} {
  return {
    capability: parseStrictEnabledFlag(env[PHASE_11C_VOICE_CAPABILITY_FLAG_ENV]),
    paid: parseStrictEnabledFlag(env[PHASE_11C_VOICE_PAID_FLAG_ENV]),
    provider: parseStrictEnabledFlag(env[PHASE_11C_VOICE_PROVIDER_FLAG_ENV]),
    worker: parseStrictEnabledFlag(env[PHASE_11C_VOICE_WORKER_FLAG_ENV]),
    exception: isVhs11CVoiceExceptionEnabled(env),
    downstream: parseStrictEnabledFlag(env[PHASE_11C_VOICE_DOWNSTREAM_FLAG_ENV]),
    lipsync: false,
    mergeExport: false,
    motion: false,
    vhs11b: false,
    vhs124: false,
  };
}

export function assertPhase11CVoiceFlagsRemainOff(
  env: Record<string, string | undefined> = {},
): void {
  const flags = phase11CVoiceFlagsAuditView(env);
  if (
    flags.capability ||
    flags.paid ||
    flags.provider ||
    flags.worker ||
    flags.exception ||
    flags.downstream
  ) {
    throw new Error("Phase 11C: Voice flags must remain OFF during wiring preflight.");
  }
  if (parseStrictEnabledFlag(env.VHS11B_I2V_CAPABILITY_ENABLED) || parseStrictEnabledFlag(env.VHS11B_FAL_I2V_DIRECTOR_EXCEPTION)) {
    throw new Error("Phase 11C: VHS11B flags must remain OFF.");
  }
  if (parseStrictEnabledFlag(env.VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION)) {
    throw new Error("Phase 11C: VHS124 flags must remain OFF.");
  }
  if (parseStrictEnabledFlag(env.DIRECTOR_V2_PAID_GENERATION_ENABLED)) {
    throw new Error("Phase 11C: DIRECTOR_V2_PAID_GENERATION_ENABLED must remain OFF.");
  }
}

export type Phase11CAllowlistGate = {
  workspaceId?: string;
  projectId: string;
  sceneId: string;
  action: string;
  capabilityProfile: string;
  providerId: string;
  modelId: string;
  language?: string;
  textChars?: number;
  stepCount?: number;
  jobCount?: number;
  outputCount?: number;
  fallbackRequested?: boolean;
  retryRequested?: boolean;
  downstreamRequested?: boolean;
  lipsyncRequested?: boolean;
  mergeRequested?: boolean;
  mergeAudioRequested?: boolean;
  exportRequested?: boolean;
  activationRequested?: boolean;
  motionRequested?: boolean;
  videoRequested?: boolean;
  legacyEndpoint?: boolean;
  universalFake?: boolean;
  envVoiceFallback?: boolean;
  voiceMissing?: boolean;
  consentInsufficient?: boolean;
  foreignScript?: boolean;
  textEmpty?: boolean;
};

export function assertVhs11CVoiceAllowlistScope(gate: Phase11CAllowlistGate): void {
  assertPhase11ADoesNotInvokeMotionEndpoint(gate.action);
  assertPhase11ADoesNotInvokeMotionEndpoint(gate.modelId);
  assertMv002RemainsDeferred(MV002_STATUS_DEFERRED);
  assertMotionRegistryStaysDisabled({ enabled: false, paidExecution: false });

  if (gate.workspaceId && gate.workspaceId !== PHASE_11C_WORKSPACE_ID) {
    throw new Error("Phase 11C allowlist: workspace not in scope.");
  }
  if (gate.projectId !== PHASE_11C_PROJECT_ID) {
    throw new Error("Phase 11C allowlist: projectId not in scope.");
  }
  if (gate.sceneId !== PHASE_11C_SCENE_ID) {
    throw new Error("Phase 11C allowlist: sceneId not in scope.");
  }
  if (gate.action !== PHASE_11C_ACTION) {
    throw new Error("Phase 11C allowlist: action must be voice.");
  }
  if (gate.capabilityProfile !== PHASE_11C_CAPABILITY) {
    throw new Error("Phase 11C allowlist: capability must be audio.voice.");
  }
  if (gate.providerId !== PHASE_11C_PROVIDER) {
    throw new Error("Phase 11C allowlist: provider must be elevenlabs.");
  }
  if (gate.modelId !== PHASE_11C_MODEL) {
    throw new Error("Phase 11C allowlist: model is not allowlisted.");
  }
  if (gate.language && gate.language !== PHASE_11C_SUPPORTED_LANGUAGE) {
    throw new Error("Phase 11C allowlist: language is not supported.");
  }
  if (gate.textEmpty || gate.textChars === 0) {
    throw new Error("Phase 11C allowlist: spoken text is empty.");
  }
  if ((gate.textChars ?? 0) > PHASE_11C_MAX_TEXT_CHARS) {
    throw new Error("Phase 11C allowlist: spoken text exceeds max length.");
  }
  if ((gate.stepCount ?? 1) !== 1 || (gate.jobCount ?? 1) !== 1 || (gate.outputCount ?? 1) !== 1) {
    throw new Error("Phase 11C allowlist: single-step / single-job / single-output only.");
  }
  if (gate.voiceMissing) {
    throw new Error("Phase 11C allowlist: explicit voice reference is required.");
  }
  if (gate.consentInsufficient) {
    throw new Error("Phase 11C allowlist: Voice consent is insufficient.");
  }
  if (gate.foreignScript) {
    throw new Error("Phase 11C allowlist: script belongs to another project.");
  }
  if (gate.universalFake) {
    throw new Error("Phase 11C allowlist: universal fake is forbidden in Production.");
  }
  if (gate.envVoiceFallback) {
    throw new Error("Phase 11C allowlist: silent ELEVENLABS_VOICE_ID fallback is forbidden.");
  }
  if (
    gate.fallbackRequested ||
    gate.retryRequested ||
    gate.downstreamRequested ||
    gate.lipsyncRequested ||
    gate.mergeRequested ||
    gate.mergeAudioRequested ||
    gate.exportRequested ||
    gate.activationRequested ||
    gate.motionRequested ||
    gate.videoRequested ||
    gate.legacyEndpoint
  ) {
    throw new Error("Phase 11C allowlist: forbidden lipsync/merge/legacy/video/downstream path.");
  }
}

export type Phase11CVoicePricing = {
  catalogueUsdPer1kChars: number;
  creditsPerCharacter: 1;
  characterCount: number;
  catalogueEstimateUsd: number;
  catalogueEstimateMinor: number;
  reservationMinor: number;
  capMinor: number;
  availableMinor: number;
  shortfallMinor: number;
  firm: false;
  planKnown: false;
  budgetDecisionAllowed: false;
  reservationCreated: false;
};

export function estimatePhase11CVoiceCatalogue(characterCount: number): Phase11CVoicePricing {
  const { usd } = estimateVoice(characterCount);
  const catalogueEstimateMinor = Math.max(1, Math.round(usd * 100));
  const reservationMinor = Math.ceil(catalogueEstimateMinor * 1.2);
  const availableMinor = PHASE_11C_LIVE_BUDGET.available;
  return {
    catalogueUsdPer1kChars: 0.15,
    creditsPerCharacter: 1,
    characterCount,
    catalogueEstimateUsd: usd,
    catalogueEstimateMinor,
    reservationMinor,
    capMinor: reservationMinor,
    availableMinor,
    shortfallMinor: Math.max(0, reservationMinor - availableMinor),
    firm: false,
    planKnown: false,
    budgetDecisionAllowed: false,
    reservationCreated: false,
  };
}

export function assertPhase11CNotLegacyVoiceEndpoint(path: string): void {
  if (path.includes(PHASE_11C_LEGACY_VOICE_ROUTE) || path.includes("/api/generate/voice")) {
    throw new Error("Phase 11C must not use legacy /api/generate/voice as Production proof.");
  }
}

export function assertPhase11CRejectsUniversalFake(providerId: string): void {
  if (providerId === "fake" || providerId.includes("universal-fake")) {
    throw new Error("Phase 11C: universal fake is forbidden in Production.");
  }
}

export function redactPhase11CError(message: string): string {
  return message
    .replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=]+/gi, "data:[redacted]")
    .replace(/xi-api-key\s*[:=]\s*\S+/gi, "xi-api-key:[redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]");
}
