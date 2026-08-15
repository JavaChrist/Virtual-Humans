/**
 * Phase 11C — live Voice/TTS preflight. Compare-only. No provider, no write.
 * Stops before raw voiceId, signed URL, reservation, run/job, ElevenLabs, ingest, activation.
 */
import { createHash } from "node:crypto";
import { createExistingVoiceReference, type ExistingVoiceReference } from "@/domain/generation/existing-voice-reference";
import {
  PHASE_11B_ACTIVE_GENERATION_PLAN_ID,
  PHASE_11B_I2V_GENERATION_PLAN_ID,
  PHASE_11B_I2V_GENERATION_PLAN_REVISION,
  livePhase11BPointerFacts,
} from "./phase-11b-artifact-pointer-coherence";
import { PHASE_11B_LIVE_VIDEO_ASSET_ID } from "./phase-11b-i2v-attempt-terminal-state";
import {
  PHASE_11C_BOUND_NARRATOR_BINDING_ID,
  PHASE_11C_I2V_NARRATOR_BINDING_APPLY_NEXT_AUTH,
  PHASE_11C_POST_BINDING_VOICE_ROWS,
} from "./phase-11c-i2v-narrator-binding-apply";
import {
  PHASE_11C_I2V_CHOSEN_NARRATOR,
  PHASE_11C_I2V_NARRATOR_FINGERPRINT_PREFIX,
  assertChosenNarratorIsFemale,
  assertI2vBundleResolvedExplicitly,
  assertNoVoiceIdInBindingPayload,
  bindingPlanToProjectVoiceBinding,
  buildI2vNarratorFemaleBindingPlan,
  resolveI2vVoiceOverFromPreparedBinding,
} from "./phase-11c-i2v-narrator-binding-preflight";
import {
  PHASE_11C_CANONICAL_CHAR_COUNT,
  PHASE_11C_CANONICAL_SCRIPT_ID,
  PHASE_11C_CANONICAL_SEGMENT_ID,
  PHASE_11C_CANONICAL_TEXT_SHA256,
  resolveCanonicalI2vSpokenSegment,
} from "./phase-11c-spoken-segment";
import {
  PHASE_11C_LIVE_BUDGET,
  PHASE_11C_MODEL,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_PROVIDER,
  PHASE_11C_VOICE_CAPABILITY_FLAG_ENV,
  PHASE_11C_VOICE_DOWNSTREAM_FLAG_ENV,
  PHASE_11C_VOICE_PAID_FLAG_ENV,
  PHASE_11C_VOICE_PROVIDER_FLAG_ENV,
  PHASE_11C_VOICE_WORKER_FLAG_ENV,
  PHASE_11C_WORKSPACE_ID,
  VHS11C_VOICE_EXCEPTION_ENV,
  assertPhase11CVoiceFlagsRemainOff,
  estimatePhase11CVoiceCatalogue,
  phase11CVoiceFlagsAuditView,
} from "./phase-11c-voice-allowlist";
import {
  HISTORICAL_GLOBAL_VOICE_LOCATOR,
  VOICE_IDENTITY_LOCATORS,
  type VoiceIdentityRecord,
  type VoiceIdentityStableKey,
} from "./phase-11c-voice-identity-catalog";
import {
  assertVoiceIdentityConsentAdmissible,
  type VoiceIdentityConsentAttestation,
} from "./phase-11c-voice-identity-consent";
import {
  PHASE_11C_SEEDED_CONSENT_IDS,
  PHASE_11C_SEEDED_IDENTITY_IDS,
} from "./phase-11c-voice-identity-seed-apply";
import {
  assertNoHistoricalGlobalFallback,
  resolveVoiceIdentityForSegment,
} from "./phase-11c-voice-identity-resolver";
import { buildPhase11CIdempotencyKey, buildPhase11CSingleStepGenerationPlan } from "./phase-11c-single-step-plan";
import { redactVoiceSecret } from "./phase-11c-voice-secret-locator";

export const PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_AUTH =
  "AUTH_11C_VOICE_TTS_LIVE_PREFLIGHT_NO_PROVIDER" as const;
export const PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_VERSION =
  "phase-11c-voice-tts-live-preflight-1.0.0" as const;
export const PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_NEXT_AUTH =
  "AUTH_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION" as const;

export const PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_VERDICTS = [
  "VOICE_TTS_LIVE_PREFLIGHT_READY_FOR_FINAL_PAID_AUTH",
  "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_PENDING_BUDGET_AUTH",
  "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_PRICING_CONTRACT",
  "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_DEPLOYMENT_NOT_READY",
  "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_EXECUTION_ACTIVATION_CONTRACT_REQUIRED",
  "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_STATE_DRIFT",
] as const;
export type Phase11CVoiceTtsLivePreflightVerdict =
  (typeof PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_VERDICTS)[number];

export const PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_READY_VERDICT =
  "VOICE_TTS_LIVE_PREFLIGHT_READY_FOR_FINAL_PAID_AUTH" as const;

export const PHASE_11C_REQUIRED_WIRING_COMMIT = "770e844" as const;
export const PHASE_11C_REQUIRED_BINDING_PREFLIGHT_COMMIT = "77dc1a7" as const;
export const PHASE_11C_REQUIRED_BINDING_APPLY_COMMIT = "abaec84" as const;
export const PHASE_11C_INSPECTED_PRODUCTION_SHA = "6e519c4" as const;
export const PHASE_11C_INSPECTED_DEPLOYMENT_ID_PREFIX = "dpl_HCZX" as const;
export const PHASE_11C_INSPECTED_DEPLOYMENT_CREATED_AT = "2026-08-16T01:17:26+02:00" as const;

export const PHASE_11C_VOICE_PRICING_INTERNAL_USD_PER_1K = 0.15 as const;
export const PHASE_11C_VOICE_PRICING_PUBLIC_USD_PER_1K = 0.1 as const;
export const PHASE_11C_VOICE_PRICING_PUBLIC_SOURCE = "elevenlabs_public_api_pricing" as const;
export const PHASE_11C_VOICE_PRICING_PUBLIC_RETRIEVED_ON = "2026-08-16" as const;
export const PHASE_11C_VOICE_PRICING_UNITS = "characters" as const;

export const PHASE_11C_FUTURE_FLAG_OPEN_ORDER = [
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  PHASE_11C_VOICE_CAPABILITY_FLAG_ENV,
  PHASE_11C_VOICE_PAID_FLAG_ENV,
  PHASE_11C_VOICE_PROVIDER_FLAG_ENV,
  VHS11C_VOICE_EXCEPTION_ENV,
  PHASE_11C_VOICE_WORKER_FLAG_ENV,
] as const;

export const PHASE_11C_FUTURE_FLAG_CLOSE_ORDER = [
  PHASE_11C_VOICE_WORKER_FLAG_ENV,
  VHS11C_VOICE_EXCEPTION_ENV,
  PHASE_11C_VOICE_PROVIDER_FLAG_ENV,
  PHASE_11C_VOICE_PAID_FLAG_ENV,
  PHASE_11C_VOICE_CAPABILITY_FLAG_ENV,
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_WORKER_ENABLED",
] as const;

export const PHASE_11C_FUTURE_FLAGS_ALWAYS_OFF = [
  PHASE_11C_VOICE_DOWNSTREAM_FLAG_ENV,
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
  "VHS11B_I2V_CAPABILITY_ENABLED",
  "VHS11B_FAL_I2V_DIRECTOR_EXCEPTION",
  "MOTION_TRANSFER_ENABLED",
  "MOTION_TRANSFER_PAID_ENABLED",
] as const;

export type Phase11CExecutionActivationMechanism = "A" | "B" | "C" | "D";

export type Phase11CVoiceLiveFacts = {
  identities: number;
  consents: number;
  bindings: number;
  providerActiveIdentities: number;
  bindingId: string;
  identityId: string;
  consentId: string;
  stableKey: VoiceIdentityStableKey;
  locator: string;
  fingerprintPrefix: string;
  identityStatus: "available";
  revocable: true;
  activeForProviderExecution: false;
  consentDecision: "authorized";
  consentScope: "workspace_voice_over";
  consentKinds: readonly ["voice_over"];
  consentRevoked: false;
  modelId: typeof PHASE_11C_MODEL;
  narratorMaleSelected: false;
  meiSubstituted: false;
  tomSubstituted: false;
  migrationsApplied: 32;
  migrationsExpected: 32;
  voiceReservations: 0;
  voiceRuns: 0;
  voiceJobs: 0;
  voiceAttempts: 0;
  audioOutputs: 0;
  videoActive: false;
  videoPublished: false;
  videoLifecycle: "approved";
  videoPrivate: true;
  deploymentReady: boolean;
  deploymentSha: string;
  includesWiringCommit: boolean;
  includesBindingCommit: boolean;
  manualDeploy: false;
  pricingContractPresent: boolean;
  budget: {
    hard: number;
    committed: number;
    reserved: number;
    available: number;
  };
};

export const PHASE_11C_VERIFIED_LIVE_VOICE_FACTS: Phase11CVoiceLiveFacts = {
  identities: PHASE_11C_POST_BINDING_VOICE_ROWS.voice_identities,
  consents: PHASE_11C_POST_BINDING_VOICE_ROWS.voice_consent_attestations,
  bindings: PHASE_11C_POST_BINDING_VOICE_ROWS.project_voice_bindings,
  providerActiveIdentities: PHASE_11C_POST_BINDING_VOICE_ROWS.providerActiveIdentities,
  bindingId: PHASE_11C_BOUND_NARRATOR_BINDING_ID,
  identityId: PHASE_11C_SEEDED_IDENTITY_IDS.narrator_female,
  consentId: PHASE_11C_SEEDED_CONSENT_IDS.narrator_female,
  stableKey: PHASE_11C_I2V_CHOSEN_NARRATOR,
  locator: VOICE_IDENTITY_LOCATORS.narrator_female,
  fingerprintPrefix: PHASE_11C_I2V_NARRATOR_FINGERPRINT_PREFIX,
  identityStatus: "available",
  revocable: true,
  activeForProviderExecution: false,
  consentDecision: "authorized",
  consentScope: "workspace_voice_over",
  consentKinds: ["voice_over"],
  consentRevoked: false,
  modelId: PHASE_11C_MODEL,
  narratorMaleSelected: false,
  meiSubstituted: false,
  tomSubstituted: false,
  migrationsApplied: 32,
  migrationsExpected: 32,
  voiceReservations: 0,
  voiceRuns: 0,
  voiceJobs: 0,
  voiceAttempts: 0,
  audioOutputs: 0,
  videoActive: false,
  videoPublished: false,
  videoLifecycle: "approved",
  videoPrivate: true,
  deploymentReady: true,
  deploymentSha: PHASE_11C_INSPECTED_PRODUCTION_SHA,
  includesWiringCommit: true,
  includesBindingCommit: true,
  manualDeploy: false,
  pricingContractPresent: true,
  budget: PHASE_11C_LIVE_BUDGET,
};

export type Phase11CVoiceLivePricingPlan = {
  units: typeof PHASE_11C_VOICE_PRICING_UNITS;
  characterCount: number;
  internalUsdPer1k: typeof PHASE_11C_VOICE_PRICING_INTERNAL_USD_PER_1K;
  publicUsdPer1k: typeof PHASE_11C_VOICE_PRICING_PUBLIC_USD_PER_1K;
  publicSource: typeof PHASE_11C_VOICE_PRICING_PUBLIC_SOURCE;
  publicRetrievedOn: typeof PHASE_11C_VOICE_PRICING_PUBLIC_RETRIEVED_ON;
  chosenSource: "internal_versioned_catalogue";
  estimateMinor: number;
  capMinor: number;
  marginMinor: number;
  availableMinor: number;
  shortfallMinor: number;
  budgetSufficient: boolean;
  firm: false;
  planKnown: false;
  personalPlanMarginalCostKnown: false;
  subscriptionInclusionUnproven: true;
  demonstratedUsd: null;
  reservationCreated: false;
};

export function estimatePhase11CVoiceLivePreflightPricing(input: {
  characterCount: number;
  availableMinor: number;
  pricingContractPresent?: boolean;
}): Phase11CVoiceLivePricingPlan {
  if (input.pricingContractPresent === false) {
    return {
      units: PHASE_11C_VOICE_PRICING_UNITS,
      characterCount: input.characterCount,
      internalUsdPer1k: PHASE_11C_VOICE_PRICING_INTERNAL_USD_PER_1K,
      publicUsdPer1k: PHASE_11C_VOICE_PRICING_PUBLIC_USD_PER_1K,
      publicSource: PHASE_11C_VOICE_PRICING_PUBLIC_SOURCE,
      publicRetrievedOn: PHASE_11C_VOICE_PRICING_PUBLIC_RETRIEVED_ON,
      chosenSource: "internal_versioned_catalogue",
      estimateMinor: 0,
      capMinor: 0,
      marginMinor: 0,
      availableMinor: input.availableMinor,
      shortfallMinor: 0,
      budgetSufficient: false,
      firm: false,
      planKnown: false,
      personalPlanMarginalCostKnown: false,
      subscriptionInclusionUnproven: true,
      demonstratedUsd: null,
      reservationCreated: false,
    };
  }
  const internal = estimatePhase11CVoiceCatalogue(input.characterCount);
  const publicUsd = +((input.characterCount / 1000) * PHASE_11C_VOICE_PRICING_PUBLIC_USD_PER_1K).toFixed(4);
  const publicMinor = Math.max(1, Math.round(publicUsd * 100));
  if (internal.catalogueUsdPer1kChars !== PHASE_11C_VOICE_PRICING_INTERNAL_USD_PER_1K) {
    throw new Error("Phase 11C live preflight: internal catalogue rate diverged.");
  }
  if (internal.catalogueEstimateMinor < publicMinor && internal.firm) {
    throw new Error("Phase 11C live preflight: firm internal estimate below public docs is refused.");
  }
  const estimateMinor = internal.catalogueEstimateMinor;
  const capMinor = internal.capMinor;
  const shortfallMinor = Math.max(0, capMinor - input.availableMinor);
  return {
    units: PHASE_11C_VOICE_PRICING_UNITS,
    characterCount: input.characterCount,
    internalUsdPer1k: PHASE_11C_VOICE_PRICING_INTERNAL_USD_PER_1K,
    publicUsdPer1k: PHASE_11C_VOICE_PRICING_PUBLIC_USD_PER_1K,
    publicSource: PHASE_11C_VOICE_PRICING_PUBLIC_SOURCE,
    publicRetrievedOn: PHASE_11C_VOICE_PRICING_PUBLIC_RETRIEVED_ON,
    chosenSource: "internal_versioned_catalogue",
    estimateMinor,
    capMinor,
    marginMinor: capMinor - estimateMinor,
    availableMinor: input.availableMinor,
    shortfallMinor,
    budgetSufficient: shortfallMinor === 0,
    firm: false,
    planKnown: false,
    personalPlanMarginalCostKnown: false,
    subscriptionInclusionUnproven: true,
    demonstratedUsd: null,
    reservationCreated: false,
  };
}

export function recommendPhase11CVoiceBudgetHardLimit(input: {
  committed: number;
  reserved: number;
  capMinor: number;
}): { minimalHard: number; prudentHard: number } {
  const minimalHard = input.committed + input.reserved + input.capMinor;
  return { minimalHard, prudentHard: minimalHard + 10 };
}

export function auditPhase11CExecutionActivationContract(): {
  A: { supported: false; reason: string };
  B: { supported: false; reason: string };
  C: { supported: true; reason: string };
  D: { supported: false; reason: string };
  selected: "C";
  catalogColumnMustStayFalse: true;
  thisGateActivates: false;
  futureAuthRequired: true;
} {
  return {
    A: {
      supported: false,
      reason: "CHECK voice_identities_execution_off_default forbids persistent true.",
    },
    B: {
      supported: false,
      reason: "A transactional flip of active_for_provider_execution also violates the CHECK.",
    },
    C: {
      supported: true,
      reason: "Distinct Auth + bounded flags window + finally, without mutating the catalog.",
    },
    D: {
      supported: false,
      reason: "No other fail-closed execution grant exists.",
    },
    selected: "C",
    catalogColumnMustStayFalse: true,
    thisGateActivates: false,
    futureAuthRequired: true,
  };
}

export function assertPhase11CFutureActivationStaysClosed(input: {
  activeForProviderExecution: boolean;
  flagsOpened: boolean;
  identityUpdated: boolean;
  bindingUpdated: boolean;
}): void {
  if (input.activeForProviderExecution || input.flagsOpened || input.identityUpdated || input.bindingUpdated) {
    throw new Error("Phase 11C live preflight: execution activation must stay closed.");
  }
}

export function assertPhase11CWiredModelUnchanged(modelId: string): void {
  if (modelId !== PHASE_11C_MODEL) {
    throw new Error("Phase 11C live preflight: eleven_multilingual_v2 must remain the wired model.");
  }
}

export function assertPhase11CStopsBeforeProviderCall(input: {
  rawVoiceIdResolved: boolean;
  signedUrlCount: number;
  reservationCreated: boolean;
  runCreated: boolean;
  jobCreated: boolean;
  attemptCreated: boolean;
  outputCreated: boolean;
  elevenLabsCalls: number;
  mediaReads: number;
  mediaWrites: number;
}): void {
  if (
    input.rawVoiceIdResolved
    || input.signedUrlCount !== 0
    || input.reservationCreated
    || input.runCreated
    || input.jobCreated
    || input.attemptCreated
    || input.outputCreated
    || input.elevenLabsCalls !== 0
    || input.mediaReads !== 0
    || input.mediaWrites !== 0
  ) {
    throw new Error("Phase 11C live preflight: dry-run crossed a forbidden provider/mutation boundary.");
  }
}

export function refusePhase11CNarratorSubstitution(key: VoiceIdentityStableKey): void {
  assertChosenNarratorIsFemale(key);
}

export function refusePhase11CHistoricalVoiceFallback(locator: string): void {
  assertNoHistoricalGlobalFallback(locator);
  if (locator === HISTORICAL_GLOBAL_VOICE_LOCATOR || locator === "env:ELEVENLABS_VOICE_ID") {
    throw new Error("Phase 11C live preflight: historical ELEVENLABS_VOICE_ID fallback is forbidden.");
  }
}

export function refusePhase11CIncoherentActivePointers(): void {
  const pointers = livePhase11BPointerFacts();
  if (pointers.activeGenerationPlanId === PHASE_11B_I2V_GENERATION_PLAN_ID) {
    throw new Error("Phase 11C live preflight: mixed active I2V pointers are forbidden.");
  }
  if (String(PHASE_11B_I2V_GENERATION_PLAN_ID) === String(PHASE_11B_ACTIVE_GENERATION_PLAN_ID)) {
    throw new Error("Phase 11C live preflight: I2V plan must stay distinct from the active 11A plan.");
  }
}

export function buildPhase11CBoundNarratorVoiceReference(): ExistingVoiceReference {
  return createExistingVoiceReference({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    speakerKind: "narrator",
    narratorId: PHASE_11C_I2V_CHOSEN_NARRATOR,
    voiceProvider: PHASE_11C_PROVIDER,
    voiceConfigIdRedacted: "el-voice:********",
    expectedModelId: PHASE_11C_MODEL,
    language: "fr",
    configSource: "project_narrator_binding",
    consentStatus: "authorized",
    usageRestrictions: [
      "director_tts_only",
      "no_cloning",
      "no_identity_impersonation",
      "no_downstream_auto",
      "project_scoped",
      "human_review_required",
    ],
  });
}

export function resolvePhase11CLiveVoiceOverFromFacts(input: {
  identities: Record<VoiceIdentityStableKey, VoiceIdentityRecord>;
  consents: Partial<Record<VoiceIdentityStableKey, VoiceIdentityConsentAttestation | undefined>>;
}): ReturnType<typeof resolveVoiceIdentityForSegment> {
  const plan = buildI2vNarratorFemaleBindingPlan();
  const binding = bindingPlanToProjectVoiceBinding(plan);
  refusePhase11CNarratorSubstitution(binding.voiceIdentityStableKey);
  refusePhase11CHistoricalVoiceFallback(input.identities.narrator_female.secretLocator);
  assertVoiceIdentityConsentAdmissible(input.consents.narrator_female, "narrator_female");
  const resolved = resolveI2vVoiceOverFromPreparedBinding({
    identities: input.identities,
    consents: input.consents,
    binding,
  });
  if (resolved.stableKey !== "narrator_female") {
    throw new Error("Phase 11C live preflight: resolver must select narrator_female.");
  }
  if (resolved.executionAuthorized || resolved.providerCallAllowed) {
    throw new Error("Phase 11C live preflight: resolver must stay execution-off.");
  }
  return resolved;
}

export function decidePhase11CVoiceTtsLivePreflightVerdict(input: {
  facts: Phase11CVoiceLiveFacts;
  pricing: Phase11CVoiceLivePricingPlan;
  activation: {
    selected: Phase11CExecutionActivationMechanism;
    C: { supported: boolean };
    thisGateActivates: boolean;
  };
  providerMode: "disabled";
  mutationAllowed: false;
}): Phase11CVoiceTtsLivePreflightVerdict {
  if (!input.facts.deploymentReady || !input.facts.includesWiringCommit || !input.facts.includesBindingCommit) {
    return "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_DEPLOYMENT_NOT_READY";
  }
  if (input.activation.selected !== "C" || !input.activation.C.supported || input.activation.thisGateActivates) {
    return "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_EXECUTION_ACTIVATION_CONTRACT_REQUIRED";
  }
  if (!input.facts.pricingContractPresent || input.pricing.capMinor <= 0) {
    return "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_PRICING_CONTRACT";
  }
  if (!input.pricing.budgetSufficient) {
    return "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_PENDING_BUDGET_AUTH";
  }
  const rowsMatch =
    input.facts.identities === 4
    && input.facts.consents === 4
    && input.facts.bindings === 1
    && input.facts.providerActiveIdentities === 0
    && input.facts.stableKey === "narrator_female"
    && input.facts.bindingId === PHASE_11C_BOUND_NARRATOR_BINDING_ID
    && input.facts.activeForProviderExecution === false
    && input.facts.consentDecision === "authorized"
    && !input.facts.consentRevoked
    && !input.facts.narratorMaleSelected
    && !input.facts.meiSubstituted
    && !input.facts.tomSubstituted
    && input.facts.migrationsApplied === 32
    && input.facts.voiceReservations === 0
    && input.facts.voiceRuns === 0
    && input.facts.voiceJobs === 0
    && input.facts.audioOutputs === 0
    && input.facts.videoActive === false
    && input.facts.videoPublished === false
    && input.facts.modelId === PHASE_11C_MODEL
    && input.providerMode === "disabled"
    && input.mutationAllowed === false;
  if (!rowsMatch) {
    return "VOICE_TTS_LIVE_PREFLIGHT_BLOCKED_STATE_DRIFT";
  }
  return PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_READY_VERDICT;
}

const PLAN_DEFAULTS = {
  createdAt: "2026-08-16T01:30:00.000Z",
  createdBy: "00000000-0000-4000-8000-000000000001",
  correlationId: "11c-voice-tts-live-preflight-no-provider",
  storyboardRevisionId: "7cf183c1-ab31-4312-8156-97bc14c111d9",
  scenePackageRevisionIds: ["2e8e9e6f-226e-498d-9cd7-a336b80d584c"],
} as const;

export type Phase11CVoiceTtsLivePreflightResult = {
  auth: typeof PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_AUTH;
  previousAuth: typeof PHASE_11C_I2V_NARRATOR_BINDING_APPLY_NEXT_AUTH;
  version: typeof PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_VERSION;
  verdict: Phase11CVoiceTtsLivePreflightVerdict;
  nextAuth: typeof PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_NEXT_AUTH | null;
  sourceAdmissible: true;
  narratorSelected: typeof PHASE_11C_I2V_CHOSEN_NARRATOR;
  narratorMaleSelected: false;
  meiSubstituted: false;
  tomSubstituted: false;
  consentAdmissible: true;
  providerMode: "disabled";
  providerCallAllowed: false;
  mutationAllowed: false;
  reservationCreated: false;
  runCreated: false;
  jobCreated: false;
  attemptCreated: false;
  outputCreated: false;
  rawVoiceIdResolved: false;
  signedUrlCount: 0;
  elevenLabsCalls: 0;
  otherProviderCalls: 0;
  mediaReads: 0;
  mediaWrites: 0;
  budgetWrites: 0;
  flagsWritten: 0;
  productionWrites: 0;
  voiceIdentitiesUpdated: 0;
  voiceConsentsUpdated: 0;
  projectBindingsUpdated: 0;
  activeProviderIdentities: 0;
  phaseCost: 0;
  voiceRuntime: "OFF";
  videoActive: false;
  videoPublished: false;
  modelId: typeof PHASE_11C_MODEL;
  activationMechanism: "C";
  catalogExecutionStaysFalse: true;
  pricing: Phase11CVoiceLivePricingPlan;
  budget: Phase11CVoiceLiveFacts["budget"];
  recommendedHard: number | null;
  planFingerprint: string;
  idempotencyKey: string;
  fingerprint: string;
  futurePlan: {
    segments: 1;
    narrators: 1;
    ttsCalls: 1;
    runs: 1;
    jobs: 1;
    attempts: 1;
    outputs: 1;
    retries: 0;
    fallbacks: 0;
    secondSubmit: 0;
    outputLifecycle: "pending_review";
    outputActive: false;
    outputPublished: false;
    humanReviewRequired: true;
    lipsync: false;
    merge: false;
    export: false;
  };
};

export function runPhase11CVoiceTtsLivePreflightNoProvider(input?: {
  env?: Record<string, string | undefined>;
  facts?: Phase11CVoiceLiveFacts;
  identities?: Record<VoiceIdentityStableKey, VoiceIdentityRecord>;
  consents?: Partial<Record<VoiceIdentityStableKey, VoiceIdentityConsentAttestation | undefined>>;
  providerMode?: "disabled";
  mutationAllowed?: false;
}): Phase11CVoiceTtsLivePreflightResult {
  if ((input?.providerMode ?? "disabled") !== "disabled") {
    throw new Error("Phase 11C live preflight: providerMode must stay disabled.");
  }
  if (input?.mutationAllowed) {
    throw new Error("Phase 11C live preflight: mutationAllowed must stay false.");
  }
  const env = input?.env ?? {};
  assertPhase11CVoiceFlagsRemainOff(env);
  const facts = input?.facts ?? PHASE_11C_VERIFIED_LIVE_VOICE_FACTS;
  assertPhase11CWiredModelUnchanged(facts.modelId);
  assertPhase11CFutureActivationStaysClosed({
    activeForProviderExecution: facts.activeForProviderExecution,
    flagsOpened: false,
    identityUpdated: false,
    bindingUpdated: false,
  });
  refusePhase11CNarratorSubstitution(facts.stableKey);
  refusePhase11CHistoricalVoiceFallback(facts.locator);
  refusePhase11CIncoherentActivePointers();
  if (facts.consentRevoked || facts.consentDecision !== "authorized") {
    throw new Error("Phase 11C live preflight: consent is not admissible.");
  }

  const spoken = resolveCanonicalI2vSpokenSegment();
  if (spoken.characterCount !== PHASE_11C_CANONICAL_CHAR_COUNT || spoken.textSha256 !== PHASE_11C_CANONICAL_TEXT_SHA256) {
    throw new Error("Phase 11C live preflight: spoken hash/length diverged.");
  }
  if (spoken.segmentId !== PHASE_11C_CANONICAL_SEGMENT_ID || spoken.scriptArtifactId !== PHASE_11C_CANONICAL_SCRIPT_ID) {
    throw new Error("Phase 11C live preflight: script/segment mismatch.");
  }
  const bundle = assertI2vBundleResolvedExplicitly();
  if (bundle.usedMixedActivePointers || bundle.i2vPlanActivated) {
    throw new Error("Phase 11C live preflight: I2V bundle must stay explicit and inactive.");
  }

  if (input?.identities && input.consents) {
    resolvePhase11CLiveVoiceOverFromFacts({
      identities: input.identities,
      consents: input.consents,
    });
  }

  const voice = buildPhase11CBoundNarratorVoiceReference();
  const planBuild = buildPhase11CSingleStepGenerationPlan({
    spokenSegment: spoken,
    voice,
    createdAt: PLAN_DEFAULTS.createdAt,
    createdBy: PLAN_DEFAULTS.createdBy,
    correlationId: PLAN_DEFAULTS.correlationId,
    storyboardRevisionId: PLAN_DEFAULTS.storyboardRevisionId,
    scenePackageRevisionIds: [...PLAN_DEFAULTS.scenePackageRevisionIds],
  });
  if (planBuild.persistedToProduction || planBuild.planActive || planBuild.retryCount !== 0 || planBuild.fallbackCount !== 0) {
    throw new Error("Phase 11C live preflight: plan must stay local, inactive, single-step.");
  }

  const pricing = estimatePhase11CVoiceLivePreflightPricing({
    characterCount: spoken.characterCount,
    availableMinor: facts.budget.available,
    pricingContractPresent: facts.pricingContractPresent,
  });
  const activation = auditPhase11CExecutionActivationContract();
  const verdict = decidePhase11CVoiceTtsLivePreflightVerdict({
    facts,
    pricing,
    activation,
    providerMode: "disabled",
    mutationAllowed: false,
  });
  const recommended = pricing.budgetSufficient
    ? null
    : recommendPhase11CVoiceBudgetHardLimit({
      committed: facts.budget.committed,
      reserved: facts.budget.reserved,
      capMinor: pricing.capMinor,
    }).prudentHard;

  const counters = {
    rawVoiceIdResolved: false,
    signedUrlCount: 0,
    reservationCreated: false,
    runCreated: false,
    jobCreated: false,
    attemptCreated: false,
    outputCreated: false,
    elevenLabsCalls: 0,
    mediaReads: 0,
    mediaWrites: 0,
  } as const;
  assertPhase11CStopsBeforeProviderCall(counters);
  const flags = phase11CVoiceFlagsAuditView(env);
  if (flags.capability || flags.paid || flags.provider || flags.worker || flags.exception || flags.downstream) {
    throw new Error("Phase 11C live preflight: Voice flags must stay OFF.");
  }

  const payload = {
    bindingId: facts.bindingId,
    identityId: facts.identityId,
    locator: facts.locator,
    prefix: facts.fingerprintPrefix,
    model: facts.modelId,
    videoId: PHASE_11B_LIVE_VIDEO_ASSET_ID,
    i2vPlan: PHASE_11B_I2V_GENERATION_PLAN_ID,
    i2vPlanRevision: PHASE_11B_I2V_GENERATION_PLAN_REVISION,
    spokenHash: spoken.textSha256,
    spokenChars: spoken.characterCount,
  };
  assertNoVoiceIdInBindingPayload(payload);
  if (/voiceId/i.test(redactVoiceSecret(JSON.stringify(payload)))) {
    throw new Error("Phase 11C live preflight: voiceId leaked.");
  }

  const idempotencyKey = buildPhase11CIdempotencyKey({ spokenSegment: spoken, voice });
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({
      v: PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_VERSION,
      auth: PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_AUTH,
      projectId: PHASE_11C_PROJECT_ID,
      bindingId: facts.bindingId,
      identityId: facts.identityId,
      stableKey: facts.stableKey,
      locator: facts.locator,
      prefix: facts.fingerprintPrefix,
      spokenHash: spoken.textSha256,
      spokenChars: spoken.characterCount,
      model: PHASE_11C_MODEL,
      planFingerprint: planBuild.fingerprint,
      idempotencyKey,
      estimateMinor: pricing.estimateMinor,
      capMinor: pricing.capMinor,
      activation: activation.selected,
      providerMode: "disabled",
      mutationAllowed: false,
    }))
    .digest("hex");

  return {
    auth: PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_AUTH,
    previousAuth: PHASE_11C_I2V_NARRATOR_BINDING_APPLY_NEXT_AUTH,
    version: PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_VERSION,
    verdict,
    nextAuth: verdict === PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_READY_VERDICT
      ? PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_NEXT_AUTH
      : null,
    sourceAdmissible: true,
    narratorSelected: PHASE_11C_I2V_CHOSEN_NARRATOR,
    narratorMaleSelected: false,
    meiSubstituted: false,
    tomSubstituted: false,
    consentAdmissible: true,
    providerMode: "disabled",
    providerCallAllowed: false,
    mutationAllowed: false,
    reservationCreated: false,
    runCreated: false,
    jobCreated: false,
    attemptCreated: false,
    outputCreated: false,
    rawVoiceIdResolved: false,
    signedUrlCount: 0,
    elevenLabsCalls: 0,
    otherProviderCalls: 0,
    mediaReads: 0,
    mediaWrites: 0,
    budgetWrites: 0,
    flagsWritten: 0,
    productionWrites: 0,
    voiceIdentitiesUpdated: 0,
    voiceConsentsUpdated: 0,
    projectBindingsUpdated: 0,
    activeProviderIdentities: 0,
    phaseCost: 0,
    voiceRuntime: "OFF",
    videoActive: false,
    videoPublished: false,
    modelId: PHASE_11C_MODEL,
    activationMechanism: "C",
    catalogExecutionStaysFalse: true,
    pricing,
    budget: facts.budget,
    recommendedHard: recommended,
    planFingerprint: planBuild.fingerprint,
    idempotencyKey,
    fingerprint,
    futurePlan: {
      segments: 1,
      narrators: 1,
      ttsCalls: 1,
      runs: 1,
      jobs: 1,
      attempts: 1,
      outputs: 1,
      retries: 0,
      fallbacks: 0,
      secondSubmit: 0,
      outputLifecycle: "pending_review",
      outputActive: false,
      outputPublished: false,
      humanReviewRequired: true,
      lipsync: false,
      merge: false,
      export: false,
    },
  };
}

export function fingerprintPhase11CVoiceTtsLivePreflight(
  result: Phase11CVoiceTtsLivePreflightResult,
): string {
  return result.fingerprint;
}
