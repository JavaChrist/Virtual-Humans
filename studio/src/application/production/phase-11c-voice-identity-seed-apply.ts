/**
 * Phase 11C — bounded seed/consent transaction facts and SQL renderer.
 * The Production write is a single authorized SQL transaction. No provider.
 */
import {
  PHASE_11C_VOICE_CATALOG_VERSION,
  PHASE_11C_VOICE_SEED_AUTHORIZATION_SOURCE,
  PHASE_11C_VOICE_SEED_CONSENT_VERSION,
  PHASE_11C_VOICE_SEED_PREFLIGHT_NEXT_AUTH,
  assertNoVoiceIdInSeedPayload,
  evaluateSeedCas,
  simulateVoiceSeedTransaction,
  type VoiceSeedConsentPlan,
  type VoiceSeedIdentityPlan,
} from "./phase-11c-voice-identity-seed-preflight";
import { assertPhase11CVoiceFlagsRemainOff } from "./phase-11c-voice-allowlist";
import { redactVoiceSecret } from "./phase-11c-voice-secret-locator";

export const PHASE_11C_VOICE_SEED_APPLY_AUTH =
  "AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_SINGLE_TRANSACTION" as const;
export const PHASE_11C_VOICE_SEED_APPLY_VERDICT =
  "VOICE_IDENTITY_CATALOG_SEEDED_CONSENTED_RUNTIME_OFF_NO_BINDING" as const;
export const PHASE_11C_VOICE_SEED_APPLY_NEXT_AUTH =
  "AUTH_11C_I2V_NARRATOR_BINDING_PREFLIGHT" as const;

export const PHASE_11C_VOICE_SEED_PLAN_FINGERPRINT =
  "f2b738919970ebffde4b8bb9fe0e423ec6da6a37d0d206c4b9a0f44182011696" as const;

export const PHASE_11C_VOICE_SEED_APPLY_INVOCATIONS = 1 as const;
export const PHASE_11C_VOICE_SEED_APPLY_INSERTS = 8 as const;

export const PHASE_11C_SEEDED_IDENTITY_IDS = {
  character_mei: "ddf3f39e-0330-5b15-8666-778216ef3f76",
  character_tom: "0e02c5e1-d096-5e61-9562-2d6391325e77",
  narrator_female: "bc1c8046-4978-56f0-bc2b-62bbc786e4f9",
  narrator_male: "8ba260c6-79e3-5b68-b9ee-64b4adb205bb",
} as const;

export const PHASE_11C_SEEDED_CONSENT_IDS = {
  character_mei: "4c965cca-6d56-5fc8-8c5d-dc7ff3681b89",
  character_tom: "e56a3d23-b087-5306-9f5c-8ed6a09a1bc2",
  narrator_female: "6fd84baf-045f-5d4d-ab93-801a48ff4bb2",
  narrator_male: "0848b2b9-5997-533d-9329-b9052e761087",
} as const;

export const PHASE_11C_POST_SEED_VOICE_ROWS = {
  voice_identities: 4,
  voice_consent_attestations: 4,
  project_voice_bindings: 0,
  providerActiveIdentities: 0,
} as const;

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlTextArray(values: readonly string[]): string {
  return `ARRAY[${values.map(sqlLiteral).join(", ")}]::text[]`;
}

export function renderVoiceSeedTransactionSql(input: {
  identities: VoiceSeedIdentityPlan[];
  consents: VoiceSeedConsentPlan[];
}): string {
  if (input.identities.length !== 4 || input.consents.length !== 4) {
    throw new Error("Phase 11C seed apply: plan must contain 4 identities and 4 consents.");
  }
  if (input.identities.some((row) => row.activeForProviderExecution)) {
    throw new Error("Phase 11C seed apply: provider-active identity is forbidden.");
  }
  assertNoVoiceIdInSeedPayload({
    identities: input.identities.map((row) => ({
      id: row.id,
      locator: row.secretLocator,
      prefix: row.voiceFingerprintPrefix,
    })),
    consents: input.consents.map((row) => ({
      id: row.id,
      scope: row.scope,
      source: row.authorizationSource,
    })),
  });

  const identityValues = input.identities.map((row) => {
    const character = row.characterId === null ? "NULL" : sqlLiteral(row.characterId);
    const metadata = sqlLiteral(JSON.stringify(row.metadata));
    return `(${[
      sqlLiteral(row.id),
      sqlLiteral(row.workspaceId),
      sqlLiteral(row.stableKey),
      sqlLiteral(row.role),
      character,
      sqlLiteral(row.provider),
      sqlLiteral(row.modelId),
      sqlLiteral(row.locale),
      sqlLiteral(row.secretLocator),
      sqlLiteral(row.voiceFingerprint),
      sqlLiteral(row.status),
      "true",
      "false",
      "1",
      `${metadata}::jsonb`,
    ].join(", ")})`;
  });

  const consentValues = input.consents.map((row) => `(${[
    sqlLiteral(row.id),
    sqlLiteral(row.workspaceId),
    sqlLiteral(row.voiceIdentityId),
    sqlLiteral(row.scope),
    sqlTextArray(row.allowedContentKinds),
    "NULL",
    sqlLiteral(row.allowedLocale),
    sqlLiteral(row.authorizationSource),
    sqlLiteral(row.decision),
    "true",
    "NULL",
    sqlLiteral(row.createdBy),
    sqlLiteral(row.idempotencyKey),
    sqlLiteral(row.version),
  ].join(", ")})`);

  return [
    "DO $vhs_11c_seed$",
    "DECLARE",
    "  ident_count integer;",
    "  consent_count integer;",
    "  binding_count integer;",
    "  active_count integer;",
    "BEGIN",
    "  SELECT count(*) INTO ident_count FROM public.voice_identities;",
    "  SELECT count(*) INTO consent_count FROM public.voice_consent_attestations;",
    "  SELECT count(*) INTO binding_count FROM public.project_voice_bindings;",
    "  IF ident_count <> 0 OR consent_count <> 0 OR binding_count <> 0 THEN",
    "    RAISE EXCEPTION 'Phase 11C seed: tables are not empty';",
    "  END IF;",
    "  INSERT INTO public.voice_identities (",
    "    id, workspace_id, stable_key, role, character_id, provider, model_id, locale,",
    "    secret_locator, voice_fingerprint, status, revocable, active_for_provider_execution,",
    "    revision, metadata",
    "  ) VALUES",
    `    ${identityValues.join(",\n    ")};`,
    "  INSERT INTO public.voice_consent_attestations (",
    "    id, workspace_id, voice_identity_id, scope, allowed_content_kinds, allowed_project_id,",
    "    allowed_locale, authorization_source, decision, revocable, revoked_at, created_by,",
    "    idempotency_key, version",
    "  ) VALUES",
    `    ${consentValues.join(",\n    ")};`,
    "  SELECT count(*) INTO ident_count FROM public.voice_identities;",
    "  SELECT count(*) INTO consent_count FROM public.voice_consent_attestations;",
    "  SELECT count(*) INTO binding_count FROM public.project_voice_bindings;",
    "  SELECT count(*) INTO active_count FROM public.voice_identities WHERE active_for_provider_execution;",
    "  IF ident_count <> 4 OR consent_count <> 4 OR binding_count <> 0 OR active_count <> 0 THEN",
    "    RAISE EXCEPTION 'Phase 11C seed: post-insert invariants diverged';",
    "  END IF;",
    "END",
    "$vhs_11c_seed$;",
  ].join("\n");
}

export function inspectVoiceSeedTransactionSql(sql: string): {
  identityInserts: number;
  consentInserts: number;
  bindingInserts: number;
  hasUpdate: boolean;
  hasUpsert: boolean;
  hasDelete: boolean;
  containsVoiceId: boolean;
} {
  const identityInserts = (sql.match(/INSERT INTO public\.voice_identities/g) ?? []).length;
  const consentInserts = (sql.match(/INSERT INTO public\.voice_consent_attestations/g) ?? []).length;
  return {
    identityInserts,
    consentInserts,
    bindingInserts: (sql.match(/INSERT INTO public\.project_voice_bindings/g) ?? []).length,
    hasUpdate: /^\s*UPDATE\b/im.test(sql),
    hasUpsert: /ON CONFLICT/i.test(sql),
    hasDelete: /^\s*DELETE\b/im.test(sql),
    containsVoiceId:
      /voiceId/i.test(redactVoiceSecret(sql))
      || /ELEVENLABS_[A-Z_]*VOICE_ID\s*=/.test(sql),
  };
}

export function assertVoiceSeedTransactionSqlAdmissible(sql: string): void {
  const inspected = inspectVoiceSeedTransactionSql(sql);
  if (
    inspected.identityInserts !== 1
    || inspected.consentInserts !== 1
    || inspected.bindingInserts !== 0
    || inspected.hasUpdate
    || inspected.hasUpsert
    || inspected.hasDelete
    || inspected.containsVoiceId
  ) {
    throw new Error("Phase 11C seed apply: SQL is not the authorized bounded transaction.");
  }
  if (!sql.includes(PHASE_11C_VOICE_SEED_AUTHORIZATION_SOURCE)) {
    throw new Error("Phase 11C seed apply: consent source missing.");
  }
  if (!sql.includes(PHASE_11C_VOICE_CATALOG_VERSION) || !sql.includes(PHASE_11C_VOICE_SEED_CONSENT_VERSION)) {
    throw new Error("Phase 11C seed apply: catalog/consent version missing.");
  }
}

export function assertVoiceSeedApplyNoSecondWrite(alreadySeeded: boolean): void {
  if (alreadySeeded) return;
  throw new Error("Phase 11C seed apply: remote seed missing; do not guess a second write.");
}

export function assertVoiceSeedReplayExisting(input: {
  identities: VoiceSeedIdentityPlan[];
  consents: VoiceSeedConsentPlan[];
}): void {
  const replay = simulateVoiceSeedTransaction({
    existingIdentities: input.identities.map((row) => ({
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      voiceFingerprint: row.voiceFingerprint,
      secretLocator: row.secretLocator,
    })),
    existingConsents: input.consents.map((row) => ({
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      decision: row.decision,
    })),
    existingBindings: 0,
    identities: input.identities,
    consents: input.consents,
  });
  if (replay.outcome !== "existing" || replay.productionWrites !== 0) {
    throw new Error("Phase 11C seed apply: replay must be existing with 0 writes.");
  }
}

export function voiceSeedApplyChecksums(): {
  auth: typeof PHASE_11C_VOICE_SEED_APPLY_AUTH;
  verdict: typeof PHASE_11C_VOICE_SEED_APPLY_VERDICT;
  nextAuth: typeof PHASE_11C_VOICE_SEED_APPLY_NEXT_AUTH;
  preflightNext: typeof PHASE_11C_VOICE_SEED_PREFLIGHT_NEXT_AUTH;
  planFingerprint: typeof PHASE_11C_VOICE_SEED_PLAN_FINGERPRINT;
} {
  assertPhase11CVoiceFlagsRemainOff({});
  return {
    auth: PHASE_11C_VOICE_SEED_APPLY_AUTH,
    verdict: PHASE_11C_VOICE_SEED_APPLY_VERDICT,
    nextAuth: PHASE_11C_VOICE_SEED_APPLY_NEXT_AUTH,
    preflightNext: PHASE_11C_VOICE_SEED_PREFLIGHT_NEXT_AUTH,
    planFingerprint: PHASE_11C_VOICE_SEED_PLAN_FINGERPRINT,
  };
}

export function redactSeedApplyText(value: string): string {
  return redactVoiceSecret(value);
}

export { evaluateSeedCas };
