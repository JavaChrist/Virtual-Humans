/**
 * Phase 11C — generic Voice identity catalog. No provider call, no Production persist.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PHASE_11C_MODEL,
  PHASE_11C_PROVIDER,
  PHASE_11C_SUPPORTED_LANGUAGE,
  PHASE_11C_WORKSPACE_ID,
  assertPhase11CVoiceFlagsRemainOff,
} from "./phase-11c-voice-allowlist";
import { hashVoiceSecret, redactVoiceSecret } from "./phase-11c-voice-secret-locator";

export const PHASE_11C_VOICE_IDENTITY_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_AND_BINDING_MIGRATION_PREP" as const;
export const PHASE_11C_VOICE_IDENTITY_VERDICT_READY =
  "VOICE_IDENTITY_CATALOG_DESIGN_READY_FOR_REMOTE_MIGRATION_PREFLIGHT" as const;
export const PHASE_11C_VOICE_IDENTITY_VERDICT_MISSING =
  "VOICE_IDENTITY_CATALOG_DESIGN_READY_BLOCKED_MISSING_SECURE_CONFIG" as const;
export const PHASE_11C_VOICE_IDENTITY_NEXT_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT" as const;
export const PHASE_11C_VOICE_IDENTITY_MIGRATION =
  "20260815195207_vhs_11c_voice_identity_catalog.sql" as const;

export const VOICE_IDENTITY_STABLE_KEYS = [
  "character_mei",
  "character_tom",
  "narrator_female",
  "narrator_male",
] as const;
export type VoiceIdentityStableKey = (typeof VOICE_IDENTITY_STABLE_KEYS)[number];

export const VOICE_IDENTITY_LOCATORS = {
  character_mei: "character:mei:voice",
  character_tom: "character:tom:voice",
  narrator_female: "env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID",
  narrator_male: "env:ELEVENLABS_NARRATOR_MALE_VOICE_ID",
} as const;
export type VoiceIdentityLocator =
  (typeof VOICE_IDENTITY_LOCATORS)[VoiceIdentityStableKey];

export const HISTORICAL_GLOBAL_VOICE_LOCATOR = "env:ELEVENLABS_VOICE_ID" as const;
export const HISTORICAL_GLOBAL_VOICE_ENV = "ELEVENLABS_VOICE_ID" as const;
export const NARRATOR_FEMALE_VOICE_ENV = "ELEVENLABS_NARRATOR_FEMALE_VOICE_ID" as const;
export const NARRATOR_MALE_VOICE_ENV = "ELEVENLABS_NARRATOR_MALE_VOICE_ID" as const;

export const MEI_CHARACTER_ID = "mei" as const;
export const TOM_CHARACTER_ID = "tom" as const;
export const MEI_SDK_VOICE_REL = join("characters", "Mei SDK v1.0.0", "voice", "config.json");
export const TOM_SDK_VOICE_REL = join("characters", "Tom SDK v1.0.0", "voice", "config.json");

export type VoiceIdentityRole = "character" | "narrator";
export type VoiceIdentityStatus = "prepared" | "available" | "unavailable" | "blocked";

export type VoiceIdentityRecord = {
  stableKey: VoiceIdentityStableKey;
  workspaceId: typeof PHASE_11C_WORKSPACE_ID;
  role: VoiceIdentityRole;
  characterId: typeof MEI_CHARACTER_ID | typeof TOM_CHARACTER_ID | null;
  provider: typeof PHASE_11C_PROVIDER;
  modelId: typeof PHASE_11C_MODEL;
  locale: typeof PHASE_11C_SUPPORTED_LANGUAGE;
  secretLocator: VoiceIdentityLocator;
  voiceFingerprint: string | null;
  voiceFingerprintPrefix: string | null;
  status: VoiceIdentityStatus;
  revocable: true;
  activeForProviderExecution: false;
  allowedContentKinds: readonly ["dialogue"] | readonly ["voice_over"];
  usableAsNarrator: false | boolean;
  usableAsCharacterDialogue: boolean;
};

export type VoiceLocatorResolution = {
  locator: string;
  present: boolean;
  fingerprint: string | null;
  fingerprintPrefix: string | null;
  valueExposed: false;
};

function lengthClass(n: number): "empty" | "short" | "typical" | "long" {
  if (n === 0) return "empty";
  if (n < 8) return "short";
  if (n <= 32) return "typical";
  return "long";
}

function hashOrNull(value: string): VoiceLocatorResolution["fingerprint"] {
  const trimmed = value.trim();
  return trimmed ? hashVoiceSecret(trimmed) : null;
}

function readCharacterVoiceSecret(repoRoot: string, relative: string): string {
  const path = join(repoRoot, relative);
  if (!existsSync(path)) return "";
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { voiceId?: string };
  return String(parsed.voiceId ?? "").trim();
}

export function resolveVoiceIdentityLocator(input: {
  locator: string;
  env: Record<string, string | undefined>;
  repoRoot?: string;
}): VoiceLocatorResolution {
  if (input.locator === HISTORICAL_GLOBAL_VOICE_LOCATOR) {
    throw new Error("Phase 11C catalog: historical global env is not a catalog locator.");
  }
  let raw = "";
  if (input.locator === VOICE_IDENTITY_LOCATORS.character_mei) {
    if (!input.repoRoot) throw new Error("Phase 11C catalog: repoRoot required for character locator.");
    raw = readCharacterVoiceSecret(input.repoRoot, MEI_SDK_VOICE_REL);
  } else if (input.locator === VOICE_IDENTITY_LOCATORS.character_tom) {
    if (!input.repoRoot) throw new Error("Phase 11C catalog: repoRoot required for character locator.");
    raw = readCharacterVoiceSecret(input.repoRoot, TOM_SDK_VOICE_REL);
  } else if (input.locator === VOICE_IDENTITY_LOCATORS.narrator_female) {
    raw = String(input.env[NARRATOR_FEMALE_VOICE_ENV] ?? "").trim();
  } else if (input.locator === VOICE_IDENTITY_LOCATORS.narrator_male) {
    raw = String(input.env[NARRATOR_MALE_VOICE_ENV] ?? "").trim();
  } else {
    throw new Error("Phase 11C catalog: unsupported locator.");
  }
  const fingerprint = hashOrNull(raw);
  return {
    locator: input.locator,
    present: Boolean(fingerprint),
    fingerprint,
    fingerprintPrefix: fingerprint ? fingerprint.slice(0, 12) : null,
    valueExposed: false,
  };
}

export function inspectHistoricalGlobalVoice(input: {
  env: Record<string, string | undefined>;
  meiFingerprint?: string | null;
}): {
  locator: typeof HISTORICAL_GLOBAL_VOICE_LOCATOR;
  present: boolean;
  lengthClass: ReturnType<typeof lengthClass>;
  fingerprintPrefix: string | null;
  matchesMei: boolean;
  usableAsFallback: false;
  valueExposed: false;
} {
  const raw = String(input.env[HISTORICAL_GLOBAL_VOICE_ENV] ?? "").trim();
  const fingerprint = hashOrNull(raw);
  return {
    locator: HISTORICAL_GLOBAL_VOICE_LOCATOR,
    present: Boolean(fingerprint),
    lengthClass: lengthClass(raw.length),
    fingerprintPrefix: fingerprint ? fingerprint.slice(0, 12) : null,
    matchesMei: Boolean(fingerprint && input.meiFingerprint && fingerprint === input.meiFingerprint),
    usableAsFallback: false,
    valueExposed: false,
  };
}

export function assertDistinctVoiceFingerprints(
  fingerprints: Array<{ key: VoiceIdentityStableKey; fingerprint: string | null }>,
): void {
  const seen = new Map<string, VoiceIdentityStableKey>();
  for (const row of fingerprints) {
    if (!row.fingerprint) continue;
    const previous = seen.get(row.fingerprint);
    if (previous && previous !== row.key) {
      throw new Error("Phase 11C catalog: identity collision is forbidden.");
    }
    seen.set(row.fingerprint, row.key);
  }
}

function baseIdentity(input: {
  stableKey: VoiceIdentityStableKey;
  role: VoiceIdentityRole;
  characterId: VoiceIdentityRecord["characterId"];
  allowedContentKinds: VoiceIdentityRecord["allowedContentKinds"];
  usableAsNarrator: boolean;
  usableAsCharacterDialogue: boolean;
  resolution: VoiceLocatorResolution;
}): VoiceIdentityRecord {
  const present = Boolean(input.resolution.fingerprint);
  return {
    stableKey: input.stableKey,
    workspaceId: PHASE_11C_WORKSPACE_ID,
    role: input.role,
    characterId: input.characterId,
    provider: PHASE_11C_PROVIDER,
    modelId: PHASE_11C_MODEL,
    locale: PHASE_11C_SUPPORTED_LANGUAGE,
    secretLocator: VOICE_IDENTITY_LOCATORS[input.stableKey],
    voiceFingerprint: input.resolution.fingerprint,
    voiceFingerprintPrefix: input.resolution.fingerprintPrefix,
    status: present ? "prepared" : "unavailable",
    revocable: true,
    activeForProviderExecution: false,
    allowedContentKinds: input.allowedContentKinds,
    usableAsNarrator: input.usableAsNarrator,
    usableAsCharacterDialogue: input.usableAsCharacterDialogue,
  };
}

export function buildVoiceIdentityCatalog(input: {
  env: Record<string, string | undefined>;
  repoRoot?: string;
  resolutions?: Partial<Record<VoiceIdentityStableKey, VoiceLocatorResolution>>;
}): {
  identities: Record<VoiceIdentityStableKey, VoiceIdentityRecord>;
  historicalGlobal: ReturnType<typeof inspectHistoricalGlobalVoice>;
  collisions: false;
  productionPersisted: false;
  remoteMigrationApplied: false;
  executionAuthorized: false;
  providerCallAllowed: false;
} {
  assertPhase11CVoiceFlagsRemainOff(input.env);
  const resolve = (key: VoiceIdentityStableKey): VoiceLocatorResolution =>
    input.resolutions?.[key] ??
    resolveVoiceIdentityLocator({
      locator: VOICE_IDENTITY_LOCATORS[key],
      env: input.env,
      repoRoot: input.repoRoot,
    });

  const mei = resolve("character_mei");
  const tom = resolve("character_tom");
  const female = resolve("narrator_female");
  const male = resolve("narrator_male");
  assertDistinctVoiceFingerprints([
    { key: "character_mei", fingerprint: mei.fingerprint },
    { key: "character_tom", fingerprint: tom.fingerprint },
    { key: "narrator_female", fingerprint: female.fingerprint },
    { key: "narrator_male", fingerprint: male.fingerprint },
  ]);

  const identities = {
    character_mei: baseIdentity({
      stableKey: "character_mei",
      role: "character",
      characterId: MEI_CHARACTER_ID,
      allowedContentKinds: ["dialogue"],
      usableAsNarrator: false,
      usableAsCharacterDialogue: true,
      resolution: mei,
    }),
    character_tom: baseIdentity({
      stableKey: "character_tom",
      role: "character",
      characterId: TOM_CHARACTER_ID,
      allowedContentKinds: ["dialogue"],
      usableAsNarrator: false,
      usableAsCharacterDialogue: true,
      resolution: tom,
    }),
    narrator_female: baseIdentity({
      stableKey: "narrator_female",
      role: "narrator",
      characterId: null,
      allowedContentKinds: ["voice_over"],
      usableAsNarrator: true,
      usableAsCharacterDialogue: false,
      resolution: female,
    }),
    narrator_male: baseIdentity({
      stableKey: "narrator_male",
      role: "narrator",
      characterId: null,
      allowedContentKinds: ["voice_over"],
      usableAsNarrator: true,
      usableAsCharacterDialogue: false,
      resolution: male,
    }),
  } satisfies Record<VoiceIdentityStableKey, VoiceIdentityRecord>;

  return {
    identities,
    historicalGlobal: inspectHistoricalGlobalVoice({
      env: input.env,
      meiFingerprint: mei.fingerprint,
    }),
    collisions: false,
    productionPersisted: false,
    remoteMigrationApplied: false,
    executionAuthorized: false,
    providerCallAllowed: false,
  };
}

export function decideVoiceIdentityCatalogVerdict(catalog: {
  identities: Record<VoiceIdentityStableKey, VoiceIdentityRecord>;
}): typeof PHASE_11C_VOICE_IDENTITY_VERDICT_READY | typeof PHASE_11C_VOICE_IDENTITY_VERDICT_MISSING {
  const required: VoiceIdentityStableKey[] = [
    "character_mei",
    "character_tom",
    "narrator_female",
    "narrator_male",
  ];
  const missing = required.some((key) => catalog.identities[key].status === "unavailable");
  return missing ? PHASE_11C_VOICE_IDENTITY_VERDICT_MISSING : PHASE_11C_VOICE_IDENTITY_VERDICT_READY;
}

export function fingerprintCatalogSelection(input: {
  stableKey: VoiceIdentityStableKey;
  scriptArtifactId: string;
  scriptRevision: number;
  selectionRevision: number;
  expectedFingerprint: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: "voice-identity-selection-1.0.0",
        stableKey: input.stableKey,
        scriptArtifactId: input.scriptArtifactId,
        scriptRevision: input.scriptRevision,
        selectionRevision: input.selectionRevision,
        expectedFingerprint: input.expectedFingerprint,
      }),
    )
    .digest("hex");
}

export function redactVoiceIdentityError(message: string): string {
  return redactVoiceSecret(message);
}
