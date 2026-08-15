/**
 * Phase 11C — read-only seed + consent preflight.
 * Prepares an atomic in-memory plan. No Production write, no provider.
 */
import { createHash } from "node:crypto";
import {
  PHASE_11C_LIVE_BUDGET,
  PHASE_11C_MODEL,
  PHASE_11C_PROVIDER,
  PHASE_11C_SUPPORTED_LANGUAGE,
  PHASE_11C_WORKSPACE_ID,
  assertPhase11CVoiceFlagsRemainOff,
} from "./phase-11c-voice-allowlist";
import {
  MEI_CHARACTER_ID,
  TOM_CHARACTER_ID,
  VOICE_IDENTITY_LOCATORS,
  VOICE_IDENTITY_STABLE_KEYS,
  assertDistinctVoiceFingerprints,
  buildVoiceIdentityCatalog,
  resolveVoiceIdentityLocator,
  type VoiceIdentityStableKey,
  type VoiceLocatorResolution,
} from "./phase-11c-voice-identity-catalog";
import { currentI2vProjectHasNarratorSelection } from "./phase-11c-voice-identity-binding";
import {
  PHASE_11C_TARGET_VOICE_GRANTS,
  diffVoiceGrantMatrices,
  type VoiceTableGrantSnapshot,
} from "./phase-11c-voice-identity-grant-hardening-preflight";
import {
  PHASE_11C_GRANT_HARDENING_POST_APPLY_MIGRATION_COUNT,
  PHASE_11C_GRANT_HARDENING_POST_APPLY_VOICE_ROWS,
} from "./phase-11c-voice-identity-grant-hardening-remote-apply";
import { PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES } from "./phase-11c-voice-identity-remote-preflight";
import { redactVoiceSecret } from "./phase-11c-voice-secret-locator";

export const PHASE_11C_VOICE_SEED_PREFLIGHT_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT" as const;
export const PHASE_11C_VOICE_SEED_PREFLIGHT_VERDICT =
  "VOICE_IDENTITY_CATALOG_SEED_PREFLIGHT_READY_FOR_SINGLE_TRANSACTION_AUTH" as const;
export const PHASE_11C_VOICE_SEED_PREFLIGHT_NEXT_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_SINGLE_TRANSACTION" as const;

export const PHASE_11C_VOICE_CATALOG_VERSION = "voice-identity-catalog-1.0.0" as const;
export const PHASE_11C_VOICE_SEED_CONSENT_VERSION = "voice-identity-consent-1.0.0" as const;
export const PHASE_11C_VOICE_SEED_AUTHORIZATION_SOURCE =
  "christian_explicit_workspace_voice_authorization" as const;

export const PHASE_11C_SEED_EXPECTED_ROWS = {
  identities: 4,
  consents: 4,
  bindings: 0,
  providerActiveIdentities: 0,
} as const;

export type SeedCasResult = "created" | "existing" | "conflict";

export type VoiceSeedIdentityPlan = {
  id: string;
  workspaceId: typeof PHASE_11C_WORKSPACE_ID;
  stableKey: VoiceIdentityStableKey;
  role: "character" | "narrator";
  characterId: typeof MEI_CHARACTER_ID | typeof TOM_CHARACTER_ID | null;
  provider: typeof PHASE_11C_PROVIDER;
  modelId: typeof PHASE_11C_MODEL;
  locale: typeof PHASE_11C_SUPPORTED_LANGUAGE;
  secretLocator: (typeof VOICE_IDENTITY_LOCATORS)[VoiceIdentityStableKey];
  voiceFingerprint: string;
  voiceFingerprintPrefix: string;
  status: "available";
  revocable: true;
  activeForProviderExecution: false;
  allowedContentKinds: readonly ["dialogue"] | readonly ["voice_over"];
  idempotencyKey: string;
  metadata: {
    catalogVersion: typeof PHASE_11C_VOICE_CATALOG_VERSION;
    allowedContentKinds: readonly ["dialogue"] | readonly ["voice_over"];
  };
};

export type VoiceSeedConsentPlan = {
  id: string;
  workspaceId: typeof PHASE_11C_WORKSPACE_ID;
  voiceIdentityId: string;
  voiceIdentityStableKey: VoiceIdentityStableKey;
  scope: "character_dialogue" | "workspace_voice_over";
  allowedContentKinds: readonly ["dialogue"] | readonly ["voice_over"];
  allowedProjectId: null;
  allowedLocale: "fr";
  authorizationSource: typeof PHASE_11C_VOICE_SEED_AUTHORIZATION_SOURCE;
  decision: "authorized";
  revocable: true;
  revokedAt: null;
  createdBy: "christian";
  version: typeof PHASE_11C_VOICE_SEED_CONSENT_VERSION;
  idempotencyKey: string;
  globalConsent: false;
  cloningAuthorized: false;
  substitutionAuthorized: false;
  lipsyncAuthorized: false;
  publicationAuthorized: false;
  providerCallAuthorized: false;
  otherWorkspaceAuthorized: false;
};

export type ExistingSeedRow = {
  id: string;
  stableKey?: VoiceIdentityStableKey;
  secretLocator?: string;
  voiceFingerprint?: string;
  voiceIdentityId?: string;
  decision?: string;
  idempotencyKey: string;
};

function deterministicUuid(parts: readonly string[]): string {
  const digest = createHash("sha256").update(parts.join("\0"), "utf8").digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function voiceIdentityDeterministicId(stableKey: VoiceIdentityStableKey): string {
  return deterministicUuid([
    PHASE_11C_VOICE_CATALOG_VERSION,
    "voice_identity",
    PHASE_11C_WORKSPACE_ID,
    stableKey,
  ]);
}

export function voiceConsentDeterministicId(stableKey: VoiceIdentityStableKey): string {
  return deterministicUuid([
    PHASE_11C_VOICE_SEED_CONSENT_VERSION,
    "voice_consent",
    PHASE_11C_WORKSPACE_ID,
    stableKey,
  ]);
}

export function voiceIdentityIdempotencyKey(stableKey: VoiceIdentityStableKey): string {
  return `vhs-11c-identity:${PHASE_11C_VOICE_CATALOG_VERSION}:${PHASE_11C_WORKSPACE_ID}:${stableKey}`;
}

export function voiceConsentIdempotencyKey(stableKey: VoiceIdentityStableKey): string {
  return `vhs-11c-consent:${PHASE_11C_VOICE_SEED_CONSENT_VERSION}:${PHASE_11C_WORKSPACE_ID}:${stableKey}`;
}

function roleFor(key: VoiceIdentityStableKey): VoiceSeedIdentityPlan["role"] {
  return key === "character_mei" || key === "character_tom" ? "character" : "narrator";
}

function characterIdFor(key: VoiceIdentityStableKey): VoiceSeedIdentityPlan["characterId"] {
  if (key === "character_mei") return MEI_CHARACTER_ID;
  if (key === "character_tom") return TOM_CHARACTER_ID;
  return null;
}

function kindsFor(key: VoiceIdentityStableKey): VoiceSeedIdentityPlan["allowedContentKinds"] {
  return roleFor(key) === "character" ? ["dialogue"] : ["voice_over"];
}

function scopeFor(key: VoiceIdentityStableKey): VoiceSeedConsentPlan["scope"] {
  return roleFor(key) === "character" ? "character_dialogue" : "workspace_voice_over";
}

export function evaluateSeedCas(input: {
  existing: ExistingSeedRow | null;
  desired: { id: string; idempotencyKey: string; voiceFingerprint?: string; secretLocator?: string; decision?: string };
}): SeedCasResult {
  if (!input.existing) return "created";
  const sameId = input.existing.id === input.desired.id;
  const sameKey = input.existing.idempotencyKey === input.desired.idempotencyKey;
  const sameFingerprint =
    input.desired.voiceFingerprint === undefined
    || input.existing.voiceFingerprint === input.desired.voiceFingerprint;
  const sameLocator =
    input.desired.secretLocator === undefined
    || input.existing.secretLocator === input.desired.secretLocator;
  const sameDecision =
    input.desired.decision === undefined
    || input.existing.decision === input.desired.decision;
  if (sameId && sameKey && sameFingerprint && sameLocator && sameDecision) return "existing";
  return "conflict";
}

export function assertSeedAclHardened(
  actual: readonly VoiceTableGrantSnapshot[] = PHASE_11C_TARGET_VOICE_GRANTS,
): void {
  if (diffVoiceGrantMatrices(actual, PHASE_11C_TARGET_VOICE_GRANTS).length > 0) {
    throw new Error("Phase 11C seed preflight: ACL are not hardened.");
  }
}

export function assertSeedTablesReady(rows: {
  voice_identities: number;
  voice_consent_attestations: number;
  project_voice_bindings: number;
}): void {
  if (
    rows.voice_identities !== 0
    || rows.voice_consent_attestations !== 0
    || rows.project_voice_bindings !== 0
  ) {
    throw new Error("Phase 11C seed preflight: Voice tables are not empty.");
  }
}

export function assertNoVoiceIdInSeedPayload(value: unknown): void {
  const serialized = redactVoiceSecret(JSON.stringify(value));
  if (/voiceId/i.test(serialized) || /ELEVENLABS_[A-Z_]*VOICE_ID\s*=/.test(serialized)) {
    throw new Error("Phase 11C seed preflight: voiceId must not appear in the public payload.");
  }
}

function requireResolution(
  key: VoiceIdentityStableKey,
  resolution: VoiceLocatorResolution,
): VoiceLocatorResolution & { fingerprint: string; fingerprintPrefix: string } {
  if (!resolution.present || !resolution.fingerprint || !resolution.fingerprintPrefix) {
    throw new Error("Phase 11C seed preflight: voice locator is missing.");
  }
  if (resolution.locator !== VOICE_IDENTITY_LOCATORS[key]) {
    throw new Error("Phase 11C seed preflight: locator mismatch.");
  }
  if (resolution.valueExposed) {
    throw new Error("Phase 11C seed preflight: locator value was exposed.");
  }
  return {
    ...resolution,
    fingerprint: resolution.fingerprint,
    fingerprintPrefix: resolution.fingerprintPrefix,
  };
}

export function buildVoiceSeedIdentityPlan(
  key: VoiceIdentityStableKey,
  resolution: VoiceLocatorResolution,
): VoiceSeedIdentityPlan {
  const resolved = requireResolution(key, resolution);
  const kinds = kindsFor(key);
  return {
    id: voiceIdentityDeterministicId(key),
    workspaceId: PHASE_11C_WORKSPACE_ID,
    stableKey: key,
    role: roleFor(key),
    characterId: characterIdFor(key),
    provider: PHASE_11C_PROVIDER,
    modelId: PHASE_11C_MODEL,
    locale: PHASE_11C_SUPPORTED_LANGUAGE,
    secretLocator: VOICE_IDENTITY_LOCATORS[key],
    voiceFingerprint: resolved.fingerprint,
    voiceFingerprintPrefix: resolved.fingerprintPrefix,
    status: "available",
    revocable: true,
    activeForProviderExecution: false,
    allowedContentKinds: kinds,
    idempotencyKey: voiceIdentityIdempotencyKey(key),
    metadata: {
      catalogVersion: PHASE_11C_VOICE_CATALOG_VERSION,
      allowedContentKinds: kinds,
    },
  };
}

export function buildVoiceSeedConsentPlan(
  key: VoiceIdentityStableKey,
  identityId: string,
): VoiceSeedConsentPlan {
  return {
    id: voiceConsentDeterministicId(key),
    workspaceId: PHASE_11C_WORKSPACE_ID,
    voiceIdentityId: identityId,
    voiceIdentityStableKey: key,
    scope: scopeFor(key),
    allowedContentKinds: kindsFor(key),
    allowedProjectId: null,
    allowedLocale: "fr",
    authorizationSource: PHASE_11C_VOICE_SEED_AUTHORIZATION_SOURCE,
    decision: "authorized",
    revocable: true,
    revokedAt: null,
    createdBy: "christian",
    version: PHASE_11C_VOICE_SEED_CONSENT_VERSION,
    idempotencyKey: voiceConsentIdempotencyKey(key),
    globalConsent: false,
    cloningAuthorized: false,
    substitutionAuthorized: false,
    lipsyncAuthorized: false,
    publicationAuthorized: false,
    providerCallAuthorized: false,
    otherWorkspaceAuthorized: false,
  };
}

export function simulateVoiceSeedTransaction(input: {
  existingIdentities: ExistingSeedRow[];
  existingConsents: ExistingSeedRow[];
  existingBindings: number;
  identities: VoiceSeedIdentityPlan[];
  consents: VoiceSeedConsentPlan[];
}): {
  outcome: "created" | "existing" | "rollback";
  identityResults: SeedCasResult[];
  consentResults: SeedCasResult[];
  bindings: 0;
  productionWrites: 0;
} {
  if (input.existingBindings > 0) {
    return { outcome: "rollback", identityResults: [], consentResults: [], bindings: 0, productionWrites: 0 };
  }
  if (input.identities.some((row) => row.activeForProviderExecution)) {
    return { outcome: "rollback", identityResults: [], consentResults: [], bindings: 0, productionWrites: 0 };
  }
  const identityResults = input.identities.map((row) =>
    evaluateSeedCas({
      existing: input.existingIdentities.find((item) => item.idempotencyKey === row.idempotencyKey) ?? null,
      desired: {
        id: row.id,
        idempotencyKey: row.idempotencyKey,
        voiceFingerprint: row.voiceFingerprint,
        secretLocator: row.secretLocator,
      },
    }),
  );
  const consentResults = input.consents.map((row) =>
    evaluateSeedCas({
      existing: input.existingConsents.find((item) => item.idempotencyKey === row.idempotencyKey) ?? null,
      desired: {
        id: row.id,
        idempotencyKey: row.idempotencyKey,
        decision: row.decision,
      },
    }),
  );
  if (identityResults.includes("conflict") || consentResults.includes("conflict")) {
    return { outcome: "rollback", identityResults, consentResults, bindings: 0, productionWrites: 0 };
  }
  const created = identityResults.every((result) => result === "created")
    && consentResults.every((result) => result === "created");
  const existing = identityResults.every((result) => result === "existing")
    && consentResults.every((result) => result === "existing");
  if (created) {
    return { outcome: "created", identityResults, consentResults, bindings: 0, productionWrites: 0 };
  }
  if (existing) {
    return { outcome: "existing", identityResults, consentResults, bindings: 0, productionWrites: 0 };
  }
  return { outcome: "rollback", identityResults, consentResults, bindings: 0, productionWrites: 0 };
}

export type VoiceSeedPreflightDryRun = {
  auth: typeof PHASE_11C_VOICE_SEED_PREFLIGHT_AUTH;
  verdict: typeof PHASE_11C_VOICE_SEED_PREFLIGHT_VERDICT;
  nextAuth: typeof PHASE_11C_VOICE_SEED_PREFLIGHT_NEXT_AUTH;
  stableKeys: typeof VOICE_IDENTITY_STABLE_KEYS;
  identityIdsRedacted: Record<VoiceIdentityStableKey, string>;
  consentIdsRedacted: Record<VoiceIdentityStableKey, string>;
  locators: typeof VOICE_IDENTITY_LOCATORS;
  fingerprintPrefixes: Record<VoiceIdentityStableKey, string>;
  distinctFingerprints: 4;
  consents: 4;
  bindings: 0;
  providerActiveIdentities: 0;
  i2vNarratorSelected: false;
  expectedRowsAfterSeed: typeof PHASE_11C_SEED_EXPECTED_ROWS;
  migrationAlignment: "32/32";
  tablesEmpty: true;
  seedAllowed: false;
  productionWrites: 0;
  providerCalls: 0;
  voiceIdExposed: false;
  budget: typeof PHASE_11C_LIVE_BUDGET;
  fingerprint: string;
};

function redactId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

export function runVoiceSeedPreflightDryRun(input: {
  env?: Record<string, string | undefined>;
  resolutions: Record<VoiceIdentityStableKey, VoiceLocatorResolution>;
  grants?: readonly VoiceTableGrantSnapshot[];
  rowCounts?: typeof PHASE_11C_GRANT_HARDENING_POST_APPLY_VOICE_ROWS;
}): VoiceSeedPreflightDryRun {
  assertPhase11CVoiceFlagsRemainOff(input.env ?? {});
  assertSeedAclHardened(input.grants);
  assertSeedTablesReady(input.rowCounts ?? PHASE_11C_GRANT_HARDENING_POST_APPLY_VOICE_ROWS);
  if (currentI2vProjectHasNarratorSelection()) {
    throw new Error("Phase 11C seed preflight: I2V narrator binding must stay absent.");
  }

  const catalog = buildVoiceIdentityCatalog({
    env: input.env ?? {},
    resolutions: input.resolutions,
  });
  assertDistinctVoiceFingerprints(
    VOICE_IDENTITY_STABLE_KEYS.map((key) => ({
      key,
      fingerprint: catalog.identities[key].voiceFingerprint,
    })),
  );

  const identities = VOICE_IDENTITY_STABLE_KEYS.map((key) =>
    buildVoiceSeedIdentityPlan(key, input.resolutions[key]),
  );
  if (identities.some((row) => row.role === "character" && row.allowedContentKinds[0] !== "dialogue")) {
    throw new Error("Phase 11C seed preflight: character content kind must be dialogue.");
  }
  if (identities.some((row) => row.role === "narrator" && row.allowedContentKinds[0] !== "voice_over")) {
    throw new Error("Phase 11C seed preflight: narrator content kind must be voice_over.");
  }
  const consents = identities.map((row) => buildVoiceSeedConsentPlan(row.stableKey, row.id));
  if (consents.some((row) => row.substitutionAuthorized || row.providerCallAuthorized || row.allowedProjectId)) {
    throw new Error("Phase 11C seed preflight: consent scope is not bounded.");
  }

  const simulated = simulateVoiceSeedTransaction({
    existingIdentities: [],
    existingConsents: [],
    existingBindings: 0,
    identities,
    consents,
  });
  if (simulated.outcome !== "created") {
    throw new Error("Phase 11C seed preflight: empty-table plan must be created.");
  }

  const replay = simulateVoiceSeedTransaction({
    existingIdentities: identities.map((row) => ({
      id: row.id,
      stableKey: row.stableKey,
      secretLocator: row.secretLocator,
      voiceFingerprint: row.voiceFingerprint,
      idempotencyKey: row.idempotencyKey,
    })),
    existingConsents: consents.map((row) => ({
      id: row.id,
      voiceIdentityId: row.voiceIdentityId,
      decision: row.decision,
      idempotencyKey: row.idempotencyKey,
    })),
    existingBindings: 0,
    identities,
    consents,
  });
  if (replay.outcome !== "existing") {
    throw new Error("Phase 11C seed preflight: exact replay must be existing.");
  }

  const payload = {
    identities: identities.map((row) => ({
      id: row.id,
      stableKey: row.stableKey,
      role: row.role,
      characterId: row.characterId,
      locator: row.secretLocator,
      fingerprintPrefix: row.voiceFingerprintPrefix,
      status: row.status,
      activeForProviderExecution: row.activeForProviderExecution,
      idempotencyKey: row.idempotencyKey,
    })),
    consents: consents.map((row) => ({
      id: row.id,
      identityId: row.voiceIdentityId,
      stableKey: row.voiceIdentityStableKey,
      scope: row.scope,
      kinds: row.allowedContentKinds,
      source: row.authorizationSource,
      idempotencyKey: row.idempotencyKey,
    })),
    bindings: 0,
  };
  assertNoVoiceIdInSeedPayload(payload);

  const fingerprintPrefixes = Object.fromEntries(
    identities.map((row) => [row.stableKey, row.voiceFingerprintPrefix]),
  ) as Record<VoiceIdentityStableKey, string>;
  const identityIdsRedacted = Object.fromEntries(
    identities.map((row) => [row.stableKey, redactId(row.id)]),
  ) as Record<VoiceIdentityStableKey, string>;
  const consentIdsRedacted = Object.fromEntries(
    consents.map((row) => [row.voiceIdentityStableKey, redactId(row.id)]),
  ) as Record<VoiceIdentityStableKey, string>;

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        v: "voice-seed-preflight-1.0.0",
        catalogVersion: PHASE_11C_VOICE_CATALOG_VERSION,
        workspaceId: PHASE_11C_WORKSPACE_ID,
        identityIds: identities.map((row) => row.id),
        consentIds: consents.map((row) => row.id),
        locators: VOICE_IDENTITY_LOCATORS,
        prefixes: fingerprintPrefixes,
        scopes: consents.map((row) => row.scope),
        bindings: 0,
        seedAllowed: false,
      }),
    )
    .digest("hex");

  return {
    auth: PHASE_11C_VOICE_SEED_PREFLIGHT_AUTH,
    verdict: PHASE_11C_VOICE_SEED_PREFLIGHT_VERDICT,
    nextAuth: PHASE_11C_VOICE_SEED_PREFLIGHT_NEXT_AUTH,
    stableKeys: VOICE_IDENTITY_STABLE_KEYS,
    identityIdsRedacted,
    consentIdsRedacted,
    locators: VOICE_IDENTITY_LOCATORS,
    fingerprintPrefixes,
    distinctFingerprints: 4,
    consents: 4,
    bindings: 0,
    providerActiveIdentities: 0,
    i2vNarratorSelected: false,
    expectedRowsAfterSeed: PHASE_11C_SEED_EXPECTED_ROWS,
    migrationAlignment: `${PHASE_11C_GRANT_HARDENING_POST_APPLY_MIGRATION_COUNT}/${PHASE_11C_GRANT_HARDENING_POST_APPLY_MIGRATION_COUNT}`,
    tablesEmpty: true,
    seedAllowed: false,
    productionWrites: 0,
    providerCalls: 0,
    voiceIdExposed: false,
    budget: PHASE_11C_LIVE_BUDGET,
    fingerprint,
  };
}

export function resolveLiveSeedLocatorsRedacted(input: {
  repoRoot: string;
  env: Record<string, string | undefined>;
}): Record<VoiceIdentityStableKey, { locator: string; present: boolean; fingerprintPrefix: string | null; valueExposed: false }> {
  const out = {} as Record<
    VoiceIdentityStableKey,
    { locator: string; present: boolean; fingerprintPrefix: string | null; valueExposed: false }
  >;
  for (const key of VOICE_IDENTITY_STABLE_KEYS) {
    const resolved = resolveVoiceIdentityLocator({
      locator: VOICE_IDENTITY_LOCATORS[key],
      env: input.env,
      repoRoot: input.repoRoot,
    });
    out[key] = {
      locator: resolved.locator,
      present: resolved.present,
      fingerprintPrefix: resolved.fingerprintPrefix,
      valueExposed: false,
    };
  }
  return out;
}

export function assertLiveCharacterPrefixes(repoRoot: string): void {
  const live = resolveLiveSeedLocatorsRedacted({ repoRoot, env: {} });
  if (live.character_mei.fingerprintPrefix !== PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES.character_mei) {
    throw new Error("Phase 11C seed preflight: Mei fingerprint prefix diverged.");
  }
  if (live.character_tom.fingerprintPrefix !== PHASE_11C_LOCAL_VOICE_FINGERPRINT_PREFIXES.character_tom) {
    throw new Error("Phase 11C seed preflight: Tom fingerprint prefix diverged.");
  }
}
