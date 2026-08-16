/**
 * Phase 11C — first paid Voice/TTS single execution contracts.
 * One ElevenLabs submit max. No lipsync, no catalog mutation, no second submit.
 */
import { createHash } from "node:crypto";
import {
  PHASE_11C_FUTURE_FLAG_CLOSE_ORDER,
  PHASE_11C_FUTURE_FLAG_OPEN_ORDER,
  PHASE_11C_FUTURE_FLAGS_ALWAYS_OFF,
  PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_NEXT_AUTH,
  PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_VERSION,
  auditPhase11CExecutionActivationContract,
  refusePhase11CHistoricalVoiceFallback,
  refusePhase11CNarratorSubstitution,
} from "./phase-11c-voice-tts-live-preflight";
import {
  PHASE_11C_BOUND_NARRATOR_BINDING_ID,
} from "./phase-11c-i2v-narrator-binding-apply";
import {
  PHASE_11C_I2V_CHOSEN_NARRATOR,
  PHASE_11C_I2V_NARRATOR_FINGERPRINT_PREFIX,
  assertChosenNarratorIsFemale,
} from "./phase-11c-i2v-narrator-binding-preflight";
import {
  PHASE_11C_CANONICAL_CHAR_COUNT,
  PHASE_11C_CANONICAL_SCRIPT_ID,
  PHASE_11C_CANONICAL_SEGMENT_ID,
  PHASE_11C_CANONICAL_TEXT_SHA256,
  hashSpokenText,
} from "./phase-11c-spoken-segment";
import {
  PHASE_11C_LIVE_BUDGET,
  PHASE_11C_MODEL,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_PROVIDER,
  PHASE_11C_WORKSPACE_ID,
  assertPhase11CVoiceFlagsRemainOff,
  redactPhase11CError,
} from "./phase-11c-voice-allowlist";
import {
  HISTORICAL_GLOBAL_VOICE_ENV,
  NARRATOR_FEMALE_VOICE_ENV,
  VOICE_IDENTITY_LOCATORS,
  type VoiceIdentityStableKey,
} from "./phase-11c-voice-identity-catalog";
import { hashVoiceSecret, redactVoiceSecret } from "./phase-11c-voice-secret-locator";
import {
  PHASE_11C_VOICE_OUTPUT_MIME_ALLOWLIST,
  assertPhase11CVoiceNoDataUrl,
  assertPhase11CVoiceOutputMime,
  assertPhase11CVoiceOutputSize,
  checksumPhase11CVoiceBuffer,
} from "./phase-11c-voice-ingest";
import { evaluatePhase11CVoiceTechnicalQuality } from "./phase-11c-voice-qc";
import {
  createPhase11CVoiceJobState,
  persistPhase11CVoiceSubmitIntent,
  recordPhase11CVoiceSyntheticCompletion,
  type Phase11CVoiceJobState,
} from "./phase-11c-voice-worker";

export const PHASE_11C_VOICE_TTS_FIRST_PAID_AUTH =
  "AUTH_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION" as const;
export const PHASE_11C_VOICE_TTS_FIRST_PAID_VERSION =
  "phase-11c-voice-tts-first-paid-1.0.0" as const;
export const PHASE_11C_VOICE_TTS_FIRST_PAID_NEXT_AUTH =
  "AUTH_11C_VOICE_TTS_PRIVATE_PREVIEW_AND_HUMAN_DECISION" as const;
export const PHASE_11C_VOICE_TTS_FIRST_PAID_VERDICT =
  "VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING" as const;

export const PHASE_11C_VOICE_TTS_PAID_SCRIPT_AUTH_CONSUMED = true as const;

export const PHASE_11C_VOICE_TTS_PAID_CAP_MINOR = 2 as const;
export const PHASE_11C_VOICE_TTS_PAID_ESTIMATE_MINOR = 1 as const;
export const PHASE_11C_VOICE_TTS_PREFLIGHT_FINGERPRINT =
  "2e86cee67f9902c1df8f8c3d14d6bff2b8b7e476789feba6c1abcbb044215c7b" as const;
export const PHASE_11C_VOICE_TTS_PREFLIGHT_PLAN_FINGERPRINT =
  "cc7db8aa9c661bf0282604f9cec68d81ab12854b88ed4b7eee7c64a4905343e6" as const;

export const PHASE_11C_VOICE_TTS_PAID_FLAG_OPEN_ORDER = PHASE_11C_FUTURE_FLAG_OPEN_ORDER;
export const PHASE_11C_VOICE_TTS_PAID_FLAG_CLOSE_ORDER = PHASE_11C_FUTURE_FLAG_CLOSE_ORDER;
export const PHASE_11C_VOICE_TTS_PAID_FLAGS_ALWAYS_OFF = PHASE_11C_FUTURE_FLAGS_ALWAYS_OFF;
export const PHASE_11C_VOICE_TTS_PAID_BUCKET = "director-final-assets" as const;
export const PHASE_11C_VOICE_TTS_PAID_PLAN_REVISION = 4 as const;

export function assertPhase11CVoiceTtsPaidScriptMustNotResubmit(authConsumed: boolean): void {
  if (authConsumed) {
    throw new Error("AUTH_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION consumed — no resubmit");
  }
}

function deterministicUuid(parts: readonly string[]): string {
  const digest = createHash("sha256").update(parts.join("\0"), "utf8").digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function buildPhase11CVoiceTtsPaidIdempotencyKey(): string {
  return createHash("sha256")
    .update([
      PHASE_11C_VOICE_TTS_FIRST_PAID_VERSION,
      PHASE_11C_WORKSPACE_ID,
      PHASE_11C_PROJECT_ID,
      PHASE_11C_CANONICAL_SEGMENT_ID,
      PHASE_11C_BOUND_NARRATOR_BINDING_ID,
      PHASE_11C_MODEL,
      PHASE_11C_CANONICAL_TEXT_SHA256,
      PHASE_11C_VOICE_TTS_PREFLIGHT_PLAN_FINGERPRINT,
      PHASE_11C_VOICE_TTS_PREFLIGHT_FINGERPRINT,
    ].join("|"))
    .digest("hex");
}

export function phase11CVoiceTtsPaidDeterministicIds(): {
  reservationId: string;
  runId: string;
  jobId: string;
  attemptId: string;
  outputAssetId: string;
  planId: string;
} {
  const key = buildPhase11CVoiceTtsPaidIdempotencyKey();
  return {
    reservationId: deterministicUuid([key, "reservation"]),
    runId: deterministicUuid([key, "run"]),
    jobId: deterministicUuid([key, "job"]),
    attemptId: deterministicUuid([key, "attempt"]),
    outputAssetId: deterministicUuid([key, "output"]),
    planId: deterministicUuid([key, "plan"]),
  };
}

export function assertPhase11CVoiceTtsPaidCap(amountMinor: number): void {
  if (amountMinor !== PHASE_11C_VOICE_TTS_PAID_CAP_MINOR) {
    throw new Error("Phase 11C paid TTS: reservation cap must be exactly 2¢.");
  }
}

export function assertPhase11CVoiceTtsPaidBudgetSufficient(availableMinor: number): void {
  if (availableMinor < PHASE_11C_VOICE_TTS_PAID_CAP_MINOR) {
    throw new Error("Phase 11C paid TTS: available budget is below the 2¢ cap.");
  }
}

export function settlePhase11CVoiceTtsPaid(input: {
  demonstratedMinor: number | null;
}): { amountMinor: number; costKind: "provisional" | "committed"; remainderReleasedMinor: number } {
  if (input.demonstratedMinor == null) {
    return { amountMinor: PHASE_11C_VOICE_TTS_PAID_CAP_MINOR, costKind: "provisional", remainderReleasedMinor: 0 };
  }
  if (input.demonstratedMinor < 1 || input.demonstratedMinor > PHASE_11C_VOICE_TTS_PAID_CAP_MINOR) {
    throw new Error("Phase 11C paid TTS: demonstrated cost is outside the 2¢ cap.");
  }
  return {
    amountMinor: input.demonstratedMinor,
    costKind: "committed",
    remainderReleasedMinor: PHASE_11C_VOICE_TTS_PAID_CAP_MINOR - input.demonstratedMinor,
  };
}

export function extractSegmentVoiceOverCandidate(value: unknown): {
  length: number;
  textSha256: string;
  text: string;
} {
  if (!value || typeof value !== "object") {
    throw new Error("Phase 11C paid TTS: script artifact is not an object.");
  }
  const segments = (value as { segments?: unknown }).segments;
  if (!Array.isArray(segments)) {
    throw new Error("Phase 11C paid TTS: script segments are missing.");
  }
  const match = segments.find((row) => row && typeof row === "object" && (row as { id?: string }).id === PHASE_11C_CANONICAL_SEGMENT_ID);
  if (!match || typeof match !== "object") {
    throw new Error("Phase 11C paid TTS: segment-2 is missing.");
  }
  const speaker = (match as { speaker?: string }).speaker;
  const text = String((match as { voiceOver?: string }).voiceOver ?? "").trim();
  if (speaker !== "voice_over") {
    throw new Error("Phase 11C paid TTS: segment-2 is not voice_over.");
  }
  return { length: text.length, textSha256: hashSpokenText(text), text };
}

export function assertCanonicalSpokenFingerprint(input: { length: number; textSha256: string }): void {
  if (input.length !== PHASE_11C_CANONICAL_CHAR_COUNT || input.textSha256 !== PHASE_11C_CANONICAL_TEXT_SHA256) {
    throw new Error("Phase 11C paid TTS: spoken hash/length diverged.");
  }
}

export function extractCanonicalSegmentVoiceOver(value: unknown): {
  length: number;
  textSha256: string;
  text: string;
} {
  const extracted = extractSegmentVoiceOverCandidate(value);
  assertCanonicalSpokenFingerprint(extracted);
  return extracted;
}

export function refuseHistoricalVoiceEnvFallback(requestedEnvKey: string): void {
  if (requestedEnvKey === HISTORICAL_GLOBAL_VOICE_ENV) {
    refusePhase11CHistoricalVoiceFallback(`env:${requestedEnvKey}`);
  }
}

export function assertCallTimeNarratorFemaleLocator(env: Record<string, string | undefined>): {
  present: true;
  fingerprintPrefix: string;
  valueExposed: false;
  historicalFallbackUsed: false;
} {
  const raw = String(env[NARRATOR_FEMALE_VOICE_ENV] ?? "").trim();
  if (!raw) {
    throw new Error("Phase 11C paid TTS: narrator_female locator is absent.");
  }
  const fingerprint = hashVoiceSecret(raw);
  const prefix = fingerprint.slice(0, 12);
  if (prefix !== PHASE_11C_I2V_NARRATOR_FINGERPRINT_PREFIX) {
    throw new Error("Phase 11C paid TTS: narrator_female fingerprint mismatch.");
  }
  return {
    present: true,
    fingerprintPrefix: prefix,
    valueExposed: false,
    historicalFallbackUsed: false,
  };
}

export function readCallTimeNarratorFemaleVoiceId(env: Record<string, string | undefined>): string {
  assertCallTimeNarratorFemaleLocator(env);
  return String(env[NARRATOR_FEMALE_VOICE_ENV] ?? "").trim();
}

export function assertPhase11CVoiceMpegMagic(bytes: Uint8Array): void {
  if (bytes.byteLength < 3) {
    throw new Error("Phase 11C paid TTS: audio buffer is empty.");
  }
  const id3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const mpeg = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  if (!id3 && !mpeg) {
    throw new Error("Phase 11C paid TTS: audio magic is not MPEG.");
  }
}

export function buildPhase11CVoiceTtsPaidStoragePath(outputAssetId: string): string {
  return `${PHASE_11C_WORKSPACE_ID}/${PHASE_11C_PROJECT_ID}/media/audio/voice/${outputAssetId}.mp3`;
}

export type Phase11CVoiceTtsPaidExisting = {
  reservationId?: string;
  runId?: string;
  jobId?: string;
  attemptId?: string;
  outputAssetId?: string;
  submitCount: number;
  providerJobId?: string | null;
  reservationActive: boolean;
  submissionUnknown?: boolean;
};

export function planPhase11CVoiceTtsPaidExecution(existing: Phase11CVoiceTtsPaidExisting | null): {
  outcome: "created" | "existing";
  maySubmit: boolean;
  submitCount: number;
  reservationCreated: boolean;
  runCreated: boolean;
  jobCreated: boolean;
  attemptCreated: boolean;
  outputCreated: boolean;
} {
  if (!existing) {
    return {
      outcome: "created",
      maySubmit: true,
      submitCount: 0,
      reservationCreated: true,
      runCreated: true,
      jobCreated: true,
      attemptCreated: true,
      outputCreated: false,
    };
  }
  if (existing.submitCount >= 1 || existing.providerJobId || existing.submissionUnknown) {
    return {
      outcome: "existing",
      maySubmit: false,
      submitCount: existing.submitCount || 1,
      reservationCreated: false,
      runCreated: false,
      jobCreated: false,
      attemptCreated: false,
      outputCreated: false,
    };
  }
  return {
    outcome: "existing",
    maySubmit: existing.submitCount === 0,
    submitCount: existing.submitCount,
    reservationCreated: false,
    runCreated: false,
    jobCreated: false,
    attemptCreated: false,
    outputCreated: false,
  };
}

export function incrementPhase11CVoiceTtsSubmitCount(state: Phase11CVoiceJobState): Phase11CVoiceJobState {
  if (state.submitCount >= 1) {
    throw new Error("Phase 11C paid TTS: second submit is forbidden.");
  }
  return { ...state, submitCount: 1, status: "calling" };
}

export function applyPhase11CVoiceTtsFlagWindow<T>(input: {
  env: Record<string, string | undefined>;
  open: (keys: readonly string[]) => void;
  close: (keys: readonly string[]) => void;
  keepOff: (keys: readonly string[]) => void;
  run: () => T;
}): { result: T; flagsFinalOff: true; finallyRan: true } {
  assertPhase11CVoiceFlagsRemainOff(input.env);
  input.keepOff(PHASE_11C_VOICE_TTS_PAID_FLAGS_ALWAYS_OFF);
  input.open(PHASE_11C_VOICE_TTS_PAID_FLAG_OPEN_ORDER);
  try {
    const result = input.run();
    return { result, flagsFinalOff: true, finallyRan: true };
  } finally {
    input.close(PHASE_11C_VOICE_TTS_PAID_FLAG_CLOSE_ORDER);
    input.keepOff(PHASE_11C_VOICE_TTS_PAID_FLAGS_ALWAYS_OFF);
  }
}

export function evaluatePhase11CVoiceTtsPaidOutput(input: {
  mime: string;
  bytes: Uint8Array;
}): ReturnType<typeof evaluatePhase11CVoiceTechnicalQuality> {
  assertPhase11CVoiceOutputMime(input.mime);
  assertPhase11CVoiceOutputSize(input.bytes.byteLength);
  assertPhase11CVoiceMpegMagic(input.bytes);
  const checksum = checksumPhase11CVoiceBuffer(input.bytes);
  return evaluatePhase11CVoiceTechnicalQuality({
    mime: input.mime,
    bytes: input.bytes.byteLength,
    checksum,
    expectedChecksum: checksum,
    probeAvailable: false,
    provenanceOk: true,
    estimateOk: true,
  });
}

export function assertPhase11CVoiceTtsPaidPayloadRedacted(value: unknown): void {
  const serialized = redactVoiceSecret(JSON.stringify(value));
  if (/"voiceId"\s*:/i.test(serialized) || /ELEVENLABS_[A-Z_]*VOICE_ID\s*=/.test(serialized)) {
    throw new Error("Phase 11C paid TTS: voiceId must not appear in persisted payload.");
  }
  if (/xi-api-key/i.test(serialized) || /sk-[A-Za-z0-9]{8,}/.test(serialized)) {
    throw new Error("Phase 11C paid TTS: API key must not appear in persisted payload.");
  }
  assertPhase11CVoiceNoDataUrl(value);
}

export function assertPhase11CVoiceTtsPaidNarrator(key: VoiceIdentityStableKey): void {
  refusePhase11CNarratorSubstitution(key);
  assertChosenNarratorIsFemale(key);
}

export function buildPhase11CVoiceTtsPaidJobIntent(): Phase11CVoiceJobState {
  return persistPhase11CVoiceSubmitIntent(createPhase11CVoiceJobState());
}

export function assertPhase11CVoiceTtsPaidNoDownstream(input: {
  lipsyncRequested?: boolean;
  mergeRequested?: boolean;
  exportRequested?: boolean;
  activationRequested?: boolean;
}): void {
  if (input.lipsyncRequested || input.mergeRequested || input.exportRequested || input.activationRequested) {
    throw new Error("Phase 11C paid TTS: downstream/lipsync/activation is forbidden.");
  }
}

export function redactPhase11CVoiceTtsPaidError(message: string): string {
  return redactPhase11CError(redactVoiceSecret(message));
}

export function phase11CVoiceTtsPaidActivationContract(): "C" {
  const contract = auditPhase11CExecutionActivationContract();
  if (contract.selected !== "C" || contract.thisGateActivates) {
    throw new Error("Phase 11C paid TTS: activation contract C is required.");
  }
  return "C";
}

export function assertPhase11CVoiceTtsPaidPreflightAuth(): void {
  if (PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_NEXT_AUTH !== PHASE_11C_VOICE_TTS_FIRST_PAID_AUTH) {
    throw new Error("Phase 11C paid TTS: live preflight next Auth diverged.");
  }
  if (PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_VERSION !== "phase-11c-voice-tts-live-preflight-1.0.0") {
    throw new Error("Phase 11C paid TTS: live preflight version diverged.");
  }
}

export const PHASE_11C_VOICE_TTS_PAID_SCOPE = {
  auth: PHASE_11C_VOICE_TTS_FIRST_PAID_AUTH,
  previousAuth: PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_NEXT_AUTH,
  nextAuth: PHASE_11C_VOICE_TTS_FIRST_PAID_NEXT_AUTH,
  workspaceId: PHASE_11C_WORKSPACE_ID,
  projectId: PHASE_11C_PROJECT_ID,
  scriptId: PHASE_11C_CANONICAL_SCRIPT_ID,
  segmentId: PHASE_11C_CANONICAL_SEGMENT_ID,
  bindingId: PHASE_11C_BOUND_NARRATOR_BINDING_ID,
  narrator: PHASE_11C_I2V_CHOSEN_NARRATOR,
  locator: VOICE_IDENTITY_LOCATORS.narrator_female,
  fingerprintPrefix: PHASE_11C_I2V_NARRATOR_FINGERPRINT_PREFIX,
  provider: PHASE_11C_PROVIDER,
  model: PHASE_11C_MODEL,
  capMinor: PHASE_11C_VOICE_TTS_PAID_CAP_MINOR,
  estimateMinor: PHASE_11C_VOICE_TTS_PAID_ESTIMATE_MINOR,
  budget: PHASE_11C_LIVE_BUDGET,
  bucket: PHASE_11C_VOICE_TTS_PAID_BUCKET,
  mimeAllowlist: PHASE_11C_VOICE_OUTPUT_MIME_ALLOWLIST,
  catalogExecutionStaysFalse: true,
  humanReviewDecision: "none",
  outputLifecycle: "pending_review",
  outputActive: false,
  outputPublished: false,
} as const;

export { recordPhase11CVoiceSyntheticCompletion };
