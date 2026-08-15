/**
 * Phase 11C — read-only I2V narrator_female binding preflight.
 * Prepares one deterministic project binding. No Production write, no provider.
 */
import { createHash } from "node:crypto";
import {
  PHASE_11B_ACTIVE_GENERATION_PLAN_ID,
  PHASE_11B_I2V_GENERATION_PLAN_ID,
  PHASE_11B_I2V_GENERATION_PLAN_REVISION,
} from "./phase-11b-artifact-pointer-coherence";
import {
  PHASE_11B_LIVE_PROJECT_ID,
  PHASE_11B_LIVE_RUN_ID,
  PHASE_11B_LIVE_VIDEO_ASSET_ID,
} from "./phase-11b-i2v-attempt-terminal-state";
import {
  PHASE_11C_CANONICAL_CHAR_COUNT,
  PHASE_11C_CANONICAL_SCRIPT_ID,
  PHASE_11C_CANONICAL_SCRIPT_REVISION,
  PHASE_11C_CANONICAL_SEGMENT_ID,
  PHASE_11C_CANONICAL_SPOKEN_KIND,
  PHASE_11C_CANONICAL_TEXT_SHA256,
  resolveCanonicalI2vSpokenSegment,
} from "./phase-11c-spoken-segment";
import {
  PHASE_11C_LIVE_BUDGET,
  PHASE_11C_MODEL,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_PROVIDER,
  PHASE_11C_SUPPORTED_LANGUAGE,
  PHASE_11C_WORKSPACE_ID,
  assertPhase11CVoiceFlagsRemainOff,
} from "./phase-11c-voice-allowlist";
import {
  VOICE_IDENTITY_LOCATORS,
  type VoiceIdentityRecord,
  type VoiceIdentityStableKey,
} from "./phase-11c-voice-identity-catalog";
import {
  PHASE_11C_VOICE_BINDING_VERSION,
  currentI2vProjectHasNarratorSelection,
  type ProjectVoiceBinding,
} from "./phase-11c-voice-identity-binding";
import {
  assertVoiceIdentityConsentAdmissible,
  type VoiceIdentityConsentAttestation,
} from "./phase-11c-voice-identity-consent";
import {
  PHASE_11C_POST_SEED_VOICE_ROWS,
  PHASE_11C_SEEDED_CONSENT_IDS,
  PHASE_11C_SEEDED_IDENTITY_IDS,
  PHASE_11C_VOICE_SEED_APPLY_NEXT_AUTH,
} from "./phase-11c-voice-identity-seed-apply";
import {
  assertNoHistoricalGlobalFallback,
  resolveVoiceIdentityForSegment,
} from "./phase-11c-voice-identity-resolver";
import { redactVoiceSecret } from "./phase-11c-voice-secret-locator";

export const PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_AUTH =
  "AUTH_11C_I2V_NARRATOR_BINDING_PREFLIGHT" as const;
export const PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_VERDICT =
  "I2V_NARRATOR_FEMALE_BINDING_PREFLIGHT_READY_FOR_SINGLE_WRITE_AUTH" as const;
export const PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_NEXT_AUTH =
  "AUTH_11C_I2V_NARRATOR_BINDING_SINGLE_WRITE" as const;

export const PHASE_11C_I2V_NARRATOR_DECISION_SOURCE =
  "christian_explicit_project_narrator_selection" as const;
export const PHASE_11C_I2V_CHOSEN_NARRATOR = "narrator_female" as const;
export const PHASE_11C_I2V_NARRATOR_FINGERPRINT_PREFIX = "99db51be34bc" as const;

export const PHASE_11C_EXPECTED_LIVE_VOICE_ROWS = PHASE_11C_POST_SEED_VOICE_ROWS;

export type BindingCasResult = "created" | "existing" | "conflict";

export type I2vNarratorBindingPlan = {
  id: string;
  workspaceId: typeof PHASE_11C_WORKSPACE_ID;
  projectId: typeof PHASE_11C_PROJECT_ID;
  scriptArtifactId: typeof PHASE_11C_CANONICAL_SCRIPT_ID;
  scriptRevision: typeof PHASE_11C_CANONICAL_SCRIPT_REVISION;
  bindingRole: "narrator";
  voiceIdentityStableKey: typeof PHASE_11C_I2V_CHOSEN_NARRATOR;
  voiceIdentityId: typeof PHASE_11C_SEEDED_IDENTITY_IDS.narrator_female;
  consentId: typeof PHASE_11C_SEEDED_CONSENT_IDS.narrator_female;
  allowedContentKind: "voice_over";
  locale: typeof PHASE_11C_SUPPORTED_LANGUAGE;
  status: "prepared";
  selectedBy: "christian";
  decisionSource: typeof PHASE_11C_I2V_NARRATOR_DECISION_SOURCE;
  secretLocator: typeof VOICE_IDENTITY_LOCATORS.narrator_female;
  voiceFingerprintPrefix: typeof PHASE_11C_I2V_NARRATOR_FINGERPRINT_PREFIX;
  provider: typeof PHASE_11C_PROVIDER;
  modelId: typeof PHASE_11C_MODEL;
  revocable: true;
  activeForProviderExecution: false;
  narratorMaleSelected: false;
  meiSubstituted: false;
  tomSubstituted: false;
  cloningAuthorized: false;
  lipsyncAuthorized: false;
  publicationAuthorized: false;
  providerCallAuthorized: false;
  fallbackAuthorized: false;
  idempotencyKey: string;
  revision: 1;
  version: typeof PHASE_11C_VOICE_BINDING_VERSION;
};

export type ExistingBindingRow = {
  id: string;
  idempotencyKey: string;
  projectId: string;
  voiceIdentityId: string;
  voiceIdentityStableKey: VoiceIdentityStableKey;
  allowedContentKind: string;
  secretLocator?: string;
};

function deterministicUuid(parts: readonly string[]): string {
  const digest = createHash("sha256").update(parts.join("\0"), "utf8").digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function i2vNarratorBindingDeterministicId(): string {
  return deterministicUuid([
    PHASE_11C_VOICE_BINDING_VERSION,
    "project_voice_binding",
    PHASE_11C_WORKSPACE_ID,
    PHASE_11C_PROJECT_ID,
    PHASE_11C_I2V_CHOSEN_NARRATOR,
  ]);
}

export function i2vNarratorBindingIdempotencyKey(): string {
  return [
    "vhs-11c-binding",
    PHASE_11C_VOICE_BINDING_VERSION,
    PHASE_11C_WORKSPACE_ID,
    PHASE_11C_PROJECT_ID,
    PHASE_11C_I2V_CHOSEN_NARRATOR,
  ].join(":");
}

export function assertChosenNarratorIsFemale(key: VoiceIdentityStableKey): void {
  if (key === "character_mei") {
    throw new Error("Phase 11C I2V binding preflight: Mei cannot be used as narrator.");
  }
  if (key === "character_tom") {
    throw new Error("Phase 11C I2V binding preflight: Tom cannot be used as narrator.");
  }
  if (key === "narrator_male") {
    throw new Error("Phase 11C I2V binding preflight: narrator_male is not selected.");
  }
  if (key !== "narrator_female") {
    throw new Error("Phase 11C I2V binding preflight: narrator choice is invalid.");
  }
}

export function buildI2vNarratorFemaleBindingPlan(): I2vNarratorBindingPlan {
  assertChosenNarratorIsFemale(PHASE_11C_I2V_CHOSEN_NARRATOR);
  if (PHASE_11C_PROJECT_ID !== PHASE_11B_LIVE_PROJECT_ID) {
    throw new Error("Phase 11C I2V binding preflight: project mismatch.");
  }
  return {
    id: i2vNarratorBindingDeterministicId(),
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
    scriptRevision: PHASE_11C_CANONICAL_SCRIPT_REVISION,
    bindingRole: "narrator",
    voiceIdentityStableKey: PHASE_11C_I2V_CHOSEN_NARRATOR,
    voiceIdentityId: PHASE_11C_SEEDED_IDENTITY_IDS.narrator_female,
    consentId: PHASE_11C_SEEDED_CONSENT_IDS.narrator_female,
    allowedContentKind: "voice_over",
    locale: PHASE_11C_SUPPORTED_LANGUAGE,
    status: "prepared",
    selectedBy: "christian",
    decisionSource: PHASE_11C_I2V_NARRATOR_DECISION_SOURCE,
    secretLocator: VOICE_IDENTITY_LOCATORS.narrator_female,
    voiceFingerprintPrefix: PHASE_11C_I2V_NARRATOR_FINGERPRINT_PREFIX,
    provider: PHASE_11C_PROVIDER,
    modelId: PHASE_11C_MODEL,
    revocable: true,
    activeForProviderExecution: false,
    narratorMaleSelected: false,
    meiSubstituted: false,
    tomSubstituted: false,
    cloningAuthorized: false,
    lipsyncAuthorized: false,
    publicationAuthorized: false,
    providerCallAuthorized: false,
    fallbackAuthorized: false,
    idempotencyKey: i2vNarratorBindingIdempotencyKey(),
    revision: 1,
    version: PHASE_11C_VOICE_BINDING_VERSION,
  };
}

export function evaluateBindingCas(input: {
  existing: ExistingBindingRow | null;
  desired: I2vNarratorBindingPlan;
}): BindingCasResult {
  if (!input.existing) return "created";
  const same =
    input.existing.id === input.desired.id
    && input.existing.idempotencyKey === input.desired.idempotencyKey
    && input.existing.projectId === input.desired.projectId
    && input.existing.voiceIdentityId === input.desired.voiceIdentityId
    && input.existing.voiceIdentityStableKey === input.desired.voiceIdentityStableKey
    && input.existing.allowedContentKind === input.desired.allowedContentKind
    && (
      input.existing.secretLocator === undefined
      || input.existing.secretLocator === input.desired.secretLocator
    );
  return same ? "existing" : "conflict";
}

export function simulateI2vNarratorBindingTransaction(input: {
  existingBindings: ExistingBindingRow[];
  desired: I2vNarratorBindingPlan;
}): {
  outcome: "created" | "existing" | "rollback";
  cas: BindingCasResult | null;
  productionWrites: 0;
  projectBindingsCreated: 0;
} {
  if (input.desired.activeForProviderExecution || input.desired.providerCallAuthorized) {
    return { outcome: "rollback", cas: null, productionWrites: 0, projectBindingsCreated: 0 };
  }
  if (input.desired.voiceIdentityStableKey !== "narrator_female") {
    return { outcome: "rollback", cas: null, productionWrites: 0, projectBindingsCreated: 0 };
  }
  if (input.existingBindings.length > 1) {
    return { outcome: "rollback", cas: null, productionWrites: 0, projectBindingsCreated: 0 };
  }
  const existing = input.existingBindings[0] ?? null;
  if (existing && existing.projectId !== input.desired.projectId) {
    return { outcome: "rollback", cas: "conflict", productionWrites: 0, projectBindingsCreated: 0 };
  }
  const cas = evaluateBindingCas({ existing, desired: input.desired });
  if (cas === "conflict") {
    return { outcome: "rollback", cas, productionWrites: 0, projectBindingsCreated: 0 };
  }
  return { outcome: cas, cas, productionWrites: 0, projectBindingsCreated: 0 };
}

export function bindingPlanToProjectVoiceBinding(plan: I2vNarratorBindingPlan): ProjectVoiceBinding {
  return {
    bindingVersion: PHASE_11C_VOICE_BINDING_VERSION,
    id: plan.id,
    workspaceId: plan.workspaceId,
    projectId: plan.projectId,
    scriptArtifactId: plan.scriptArtifactId,
    scriptRevision: plan.scriptRevision,
    bindingRole: plan.bindingRole,
    voiceIdentityStableKey: plan.voiceIdentityStableKey,
    allowedContentKind: plan.allowedContentKind,
    locale: plan.locale,
    status: plan.status,
    selectedBy: plan.selectedBy,
    idempotencyKey: plan.idempotencyKey,
    createdAt: "2026-08-16T00:00:00.000Z",
    revision: plan.revision,
  };
}

export function assertI2vBundleResolvedExplicitly(): {
  projectIdPrefix: string;
  runIdPrefix: string;
  scriptIdPrefix: string;
  spokenKind: typeof PHASE_11C_CANONICAL_SPOKEN_KIND;
  segmentId: typeof PHASE_11C_CANONICAL_SEGMENT_ID;
  textHashPrefix: string;
  charCount: typeof PHASE_11C_CANONICAL_CHAR_COUNT;
  i2vGenerationPlanIdPrefix: string;
  i2vGenerationPlanRevision: typeof PHASE_11B_I2V_GENERATION_PLAN_REVISION;
  activeGenerationPlanIdPrefix: string;
  usedMixedActivePointers: false;
  i2vPlanActivated: false;
  videoIdPrefix: string;
} {
  const spoken = resolveCanonicalI2vSpokenSegment();
  if (spoken.projectId !== PHASE_11C_PROJECT_ID || spoken.scriptArtifactId !== PHASE_11C_CANONICAL_SCRIPT_ID) {
    throw new Error("Phase 11C I2V binding preflight: spoken segment project/script mismatch.");
  }
  if (spoken.spokenKind !== "voice_over" || spoken.characterCount !== PHASE_11C_CANONICAL_CHAR_COUNT) {
    throw new Error("Phase 11C I2V binding preflight: spoken segment kind/length mismatch.");
  }
  if (spoken.textSha256 !== PHASE_11C_CANONICAL_TEXT_SHA256) {
    throw new Error("Phase 11C I2V binding preflight: spoken text hash mismatch.");
  }
  if (String(PHASE_11B_I2V_GENERATION_PLAN_ID) === String(PHASE_11B_ACTIVE_GENERATION_PLAN_ID)) {
    throw new Error("Phase 11C I2V binding preflight: I2V plan must stay distinct from the active 11A plan.");
  }
  return {
    projectIdPrefix: PHASE_11C_PROJECT_ID.slice(0, 8),
    runIdPrefix: PHASE_11B_LIVE_RUN_ID.slice(0, 8),
    scriptIdPrefix: PHASE_11C_CANONICAL_SCRIPT_ID.slice(0, 8),
    spokenKind: PHASE_11C_CANONICAL_SPOKEN_KIND,
    segmentId: PHASE_11C_CANONICAL_SEGMENT_ID,
    textHashPrefix: PHASE_11C_CANONICAL_TEXT_SHA256.slice(0, 8),
    charCount: PHASE_11C_CANONICAL_CHAR_COUNT,
    i2vGenerationPlanIdPrefix: PHASE_11B_I2V_GENERATION_PLAN_ID.slice(0, 8),
    i2vGenerationPlanRevision: PHASE_11B_I2V_GENERATION_PLAN_REVISION,
    activeGenerationPlanIdPrefix: PHASE_11B_ACTIVE_GENERATION_PLAN_ID.slice(0, 8),
    usedMixedActivePointers: false,
    i2vPlanActivated: false,
    videoIdPrefix: PHASE_11B_LIVE_VIDEO_ASSET_ID.slice(0, 8),
  };
}

export function resolveI2vVoiceOverFromPreparedBinding(input: {
  identities: Record<VoiceIdentityStableKey, VoiceIdentityRecord>;
  consents: Partial<Record<VoiceIdentityStableKey, VoiceIdentityConsentAttestation | undefined>>;
  binding: ProjectVoiceBinding;
}): ReturnType<typeof resolveVoiceIdentityForSegment> {
  assertChosenNarratorIsFemale(input.binding.voiceIdentityStableKey);
  assertNoHistoricalGlobalFallback(input.identities.narrator_female.secretLocator);
  assertVoiceIdentityConsentAdmissible(input.consents.narrator_female, "narrator_female");
  const resolved = resolveVoiceIdentityForSegment({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    spokenKind: "voice_over",
    speakerKind: "narrator",
    identities: input.identities,
    consents: input.consents,
    narratorBinding: input.binding,
  });
  if (resolved.stableKey !== "narrator_female" || resolved.usedHistoricalGlobalFallback) {
    throw new Error("Phase 11C I2V binding preflight: resolver did not use the explicit female binding.");
  }
  if (resolved.executionAuthorized || resolved.providerCallAllowed) {
    throw new Error("Phase 11C I2V binding preflight: resolver must stay execution-off.");
  }
  return resolved;
}

export function assertNoVoiceIdInBindingPayload(value: unknown): void {
  const serialized = redactVoiceSecret(JSON.stringify(value));
  if (/"voiceId"\s*:/i.test(serialized) || /ELEVENLABS_[A-Z_]*VOICE_ID\s*=/.test(serialized)) {
    throw new Error("Phase 11C I2V binding preflight: voiceId must not appear in the public payload.");
  }
}

export type I2vNarratorBindingPreflightDryRun = {
  auth: typeof PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_AUTH;
  verdict: typeof PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_VERDICT;
  nextAuth: typeof PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_NEXT_AUTH;
  seedNextAuth: typeof PHASE_11C_VOICE_SEED_APPLY_NEXT_AUTH;
  narratorSelected: typeof PHASE_11C_I2V_CHOSEN_NARRATOR;
  narratorMaleSelected: false;
  bindingIdRedacted: string;
  identityIdRedacted: string;
  consentIdRedacted: string;
  locator: typeof VOICE_IDENTITY_LOCATORS.narrator_female;
  fingerprintPrefix: typeof PHASE_11C_I2V_NARRATOR_FINGERPRINT_PREFIX;
  bindingAllowed: false;
  productionWrites: 0;
  projectBindingsCreated: 0;
  providerCalls: 0;
  activeForProviderExecution: false;
  voiceRuntime: "OFF";
  liveRows: typeof PHASE_11C_EXPECTED_LIVE_VOICE_ROWS;
  liveBindingPresent: false;
  budget: typeof PHASE_11C_LIVE_BUDGET;
  fingerprint: string;
};

export function runI2vNarratorBindingPreflightDryRun(input?: {
  env?: Record<string, string | undefined>;
  liveRows?: typeof PHASE_11C_EXPECTED_LIVE_VOICE_ROWS;
  liveBindingCount?: number;
}): I2vNarratorBindingPreflightDryRun {
  assertPhase11CVoiceFlagsRemainOff(input?.env ?? {});
  const liveRows = input?.liveRows ?? PHASE_11C_EXPECTED_LIVE_VOICE_ROWS;
  if (
    liveRows.voice_identities !== 4
    || liveRows.voice_consent_attestations !== 4
    || liveRows.project_voice_bindings !== 0
    || liveRows.providerActiveIdentities !== 0
  ) {
    throw new Error("Phase 11C I2V binding preflight: Voice row counts diverged.");
  }
  if ((input?.liveBindingCount ?? 0) !== 0 || currentI2vProjectHasNarratorSelection()) {
    throw new Error("Phase 11C I2V binding preflight: a live binding already exists.");
  }

  const plan = buildI2vNarratorFemaleBindingPlan();
  const created = simulateI2vNarratorBindingTransaction({ existingBindings: [], desired: plan });
  if (created.outcome !== "created") {
    throw new Error("Phase 11C I2V binding preflight: empty-table plan must be created.");
  }
  const replay = simulateI2vNarratorBindingTransaction({
    existingBindings: [{
      id: plan.id,
      idempotencyKey: plan.idempotencyKey,
      projectId: plan.projectId,
      voiceIdentityId: plan.voiceIdentityId,
      voiceIdentityStableKey: plan.voiceIdentityStableKey,
      allowedContentKind: plan.allowedContentKind,
      secretLocator: plan.secretLocator,
    }],
    desired: plan,
  });
  if (replay.outcome !== "existing" || replay.productionWrites !== 0) {
    throw new Error("Phase 11C I2V binding preflight: exact replay must be existing.");
  }

  const bundle = assertI2vBundleResolvedExplicitly();
  const payload = {
    plan: {
      id: plan.id,
      projectId: plan.projectId,
      stableKey: plan.voiceIdentityStableKey,
      identityId: plan.voiceIdentityId,
      locator: plan.secretLocator,
      prefix: plan.voiceFingerprintPrefix,
      kind: plan.allowedContentKind,
      source: plan.decisionSource,
      status: plan.status,
      activeForProviderExecution: plan.activeForProviderExecution,
    },
    bundle,
    bindings: 0,
  };
  assertNoVoiceIdInBindingPayload(payload);

  const fingerprint = createHash("sha256")
    .update(JSON.stringify({
      v: "i2v-narrator-binding-preflight-1.0.0",
      bindingVersion: PHASE_11C_VOICE_BINDING_VERSION,
      workspaceId: PHASE_11C_WORKSPACE_ID,
      projectId: PHASE_11C_PROJECT_ID,
      bindingId: plan.id,
      identityId: plan.voiceIdentityId,
      consentId: plan.consentId,
      stableKey: plan.voiceIdentityStableKey,
      locator: plan.secretLocator,
      prefix: plan.voiceFingerprintPrefix,
      source: plan.decisionSource,
      status: plan.status,
      bindingAllowed: false,
    }))
    .digest("hex");

  return {
    auth: PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_AUTH,
    verdict: PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_VERDICT,
    nextAuth: PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_NEXT_AUTH,
    seedNextAuth: PHASE_11C_VOICE_SEED_APPLY_NEXT_AUTH,
    narratorSelected: PHASE_11C_I2V_CHOSEN_NARRATOR,
    narratorMaleSelected: false,
    bindingIdRedacted: `${plan.id.slice(0, 8)}…`,
    identityIdRedacted: `${plan.voiceIdentityId.slice(0, 8)}…`,
    consentIdRedacted: `${plan.consentId.slice(0, 8)}…`,
    locator: VOICE_IDENTITY_LOCATORS.narrator_female,
    fingerprintPrefix: PHASE_11C_I2V_NARRATOR_FINGERPRINT_PREFIX,
    bindingAllowed: false,
    productionWrites: 0,
    projectBindingsCreated: 0,
    providerCalls: 0,
    activeForProviderExecution: false,
    voiceRuntime: "OFF",
    liveRows: PHASE_11C_EXPECTED_LIVE_VOICE_ROWS,
    liveBindingPresent: false,
    budget: PHASE_11C_LIVE_BUDGET,
    fingerprint,
  };
}
