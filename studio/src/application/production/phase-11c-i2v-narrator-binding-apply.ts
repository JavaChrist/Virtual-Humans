/**
 * Phase 11C — bounded I2V narrator_female binding apply.
 * One authorized INSERT. No identity/consent mutation, no provider.
 */
import {
  PHASE_11C_I2V_CHOSEN_NARRATOR,
  PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_NEXT_AUTH,
  PHASE_11C_I2V_NARRATOR_DECISION_SOURCE,
  assertChosenNarratorIsFemale,
  assertI2vBundleResolvedExplicitly,
  assertNoVoiceIdInBindingPayload,
  buildI2vNarratorFemaleBindingPlan,
  evaluateBindingCas,
  resolveI2vVoiceOverFromPreparedBinding,
  runI2vNarratorBindingPreflightDryRun,
  simulateI2vNarratorBindingTransaction,
  type ExistingBindingRow,
  type I2vNarratorBindingPlan,
} from "./phase-11c-i2v-narrator-binding-preflight";
import { PHASE_11C_CANONICAL_SCRIPT_ID } from "./phase-11c-spoken-segment";
import {
  PHASE_11C_LIVE_BUDGET,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_WORKSPACE_ID,
  assertPhase11CVoiceFlagsRemainOff,
} from "./phase-11c-voice-allowlist";
import { VOICE_IDENTITY_LOCATORS } from "./phase-11c-voice-identity-catalog";
import { PHASE_11C_VOICE_BINDING_VERSION } from "./phase-11c-voice-identity-binding";
import {
  PHASE_11C_SEEDED_CONSENT_IDS,
  PHASE_11C_SEEDED_IDENTITY_IDS,
} from "./phase-11c-voice-identity-seed-apply";
import { redactVoiceSecret } from "./phase-11c-voice-secret-locator";

export const PHASE_11C_I2V_NARRATOR_BINDING_APPLY_AUTH =
  "AUTH_11C_I2V_NARRATOR_BINDING_SINGLE_WRITE" as const;
export const PHASE_11C_I2V_NARRATOR_BINDING_APPLY_VERDICT =
  "I2V_NARRATOR_FEMALE_BOUND_PRIVATE_RUNTIME_OFF" as const;
export const PHASE_11C_I2V_NARRATOR_BINDING_APPLY_NEXT_AUTH =
  "AUTH_11C_VOICE_TTS_LIVE_PREFLIGHT_NO_PROVIDER" as const;

export const PHASE_11C_I2V_NARRATOR_BINDING_PLAN_FINGERPRINT =
  "44abf77978409c501507fc2d236d027e923aac6c54254151a5c0a0becb1b85cf" as const;

export const PHASE_11C_I2V_NARRATOR_BINDING_APPLY_INVOCATIONS = 1 as const;
export const PHASE_11C_I2V_NARRATOR_BINDING_APPLY_INSERTS = 1 as const;
export const PHASE_11C_I2V_NARRATOR_BINDING_APPLY_UPDATES = 0 as const;
export const PHASE_11C_I2V_NARRATOR_BINDING_APPLY_DELETES = 0 as const;

export const PHASE_11C_BOUND_NARRATOR_BINDING_ID =
  "e3a1cc87-7bb0-5935-b5ee-34832c51f9eb" as const;

export const PHASE_11C_POST_BINDING_VOICE_ROWS = {
  voice_identities: 4,
  voice_consent_attestations: 4,
  project_voice_bindings: 1,
  providerActiveIdentities: 0,
} as const;

export const PHASE_11C_PRE_BINDING_VOICE_ROWS = {
  voice_identities: 4,
  voice_consent_attestations: 4,
  project_voice_bindings: 0,
  providerActiveIdentities: 0,
} as const;

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function assertI2vNarratorBindingPlanFingerprint(fingerprint: string): void {
  if (fingerprint !== PHASE_11C_I2V_NARRATOR_BINDING_PLAN_FINGERPRINT) {
    throw new Error("Phase 11C binding apply: plan fingerprint diverged.");
  }
}

export function assertBoundNarratorIdentityIsFemale(plan: I2vNarratorBindingPlan): void {
  assertChosenNarratorIsFemale(plan.voiceIdentityStableKey);
  if (plan.id !== PHASE_11C_BOUND_NARRATOR_BINDING_ID) {
    throw new Error("Phase 11C binding apply: deterministic binding id diverged.");
  }
  if (plan.voiceIdentityId !== PHASE_11C_SEEDED_IDENTITY_IDS.narrator_female) {
    throw new Error("Phase 11C binding apply: narrator_female identity id diverged.");
  }
  if (plan.consentId !== PHASE_11C_SEEDED_CONSENT_IDS.narrator_female) {
    throw new Error("Phase 11C binding apply: narrator_female consent id diverged.");
  }
  if (plan.projectId !== PHASE_11C_PROJECT_ID || plan.workspaceId !== PHASE_11C_WORKSPACE_ID) {
    throw new Error("Phase 11C binding apply: workspace/project diverged.");
  }
  if (plan.scriptArtifactId !== PHASE_11C_CANONICAL_SCRIPT_ID || plan.scriptRevision !== 1) {
    throw new Error("Phase 11C binding apply: script pointer diverged.");
  }
  if (
    plan.allowedContentKind !== "voice_over"
    || plan.bindingRole !== "narrator"
    || plan.activeForProviderExecution
    || plan.providerCallAuthorized
    || plan.fallbackAuthorized
    || plan.narratorMaleSelected
    || plan.meiSubstituted
    || plan.tomSubstituted
  ) {
    throw new Error("Phase 11C binding apply: usage or substitution guards diverged.");
  }
}

export function simulateI2vNarratorBindingApplyTransaction(input: {
  existingBindings: ExistingBindingRow[];
  desired: I2vNarratorBindingPlan;
}): {
  outcome: "created" | "existing" | "rollback";
  cas: ReturnType<typeof evaluateBindingCas> | null;
  productionWrites: 0 | 1;
  projectBindingsCreated: 0 | 1;
  inserts: 0 | 1;
  updates: 0;
  deletes: 0;
} {
  if (input.desired.activeForProviderExecution || input.desired.providerCallAuthorized) {
    return {
      outcome: "rollback",
      cas: null,
      productionWrites: 0,
      projectBindingsCreated: 0,
      inserts: 0,
      updates: 0,
      deletes: 0,
    };
  }
  const preview = simulateI2vNarratorBindingTransaction(input);
  if (preview.outcome === "created") {
    return {
      outcome: "created",
      cas: "created",
      productionWrites: 1,
      projectBindingsCreated: 1,
      inserts: 1,
      updates: 0,
      deletes: 0,
    };
  }
  return {
    outcome: preview.outcome,
    cas: preview.cas,
    productionWrites: 0,
    projectBindingsCreated: 0,
    inserts: 0,
    updates: 0,
    deletes: 0,
  };
}

export function renderI2vNarratorBindingTransactionSql(plan: I2vNarratorBindingPlan): string {
  assertBoundNarratorIdentityIsFemale(plan);
  assertNoVoiceIdInBindingPayload({
    id: plan.id,
    projectId: plan.projectId,
    identityId: plan.voiceIdentityId,
    locator: plan.secretLocator,
    prefix: plan.voiceFingerprintPrefix,
    source: plan.decisionSource,
    version: plan.version,
  });

  return [
    "DO $vhs_11c_bind$",
    "DECLARE",
    "  ident_count integer;",
    "  consent_count integer;",
    "  binding_count integer;",
    "  active_count integer;",
    "  female_ok boolean;",
    "  consent_ok boolean;",
    "  project_ok boolean;",
    "BEGIN",
    "  SELECT count(*) INTO ident_count FROM public.voice_identities;",
    "  SELECT count(*) INTO consent_count FROM public.voice_consent_attestations;",
    "  SELECT count(*) INTO binding_count FROM public.project_voice_bindings;",
    "  SELECT count(*) INTO active_count FROM public.voice_identities WHERE active_for_provider_execution;",
    "  IF ident_count <> 4 OR consent_count <> 4 OR binding_count <> 0 OR active_count <> 0 THEN",
    "    RAISE EXCEPTION 'Phase 11C binding: Voice row preconditions diverged';",
    "  END IF;",
    "  SELECT EXISTS (",
    "    SELECT 1 FROM public.video_projects",
    `    WHERE id = ${sqlLiteral(plan.projectId)}`,
    `      AND workspace_id = ${sqlLiteral(plan.workspaceId)}`,
    "  ) INTO project_ok;",
    "  IF NOT project_ok THEN",
    "    RAISE EXCEPTION 'Phase 11C binding: I2V project missing';",
    "  END IF;",
    "  SELECT EXISTS (",
    "    SELECT 1 FROM public.voice_identities",
    `    WHERE id = ${sqlLiteral(plan.voiceIdentityId)}`,
    `      AND workspace_id = ${sqlLiteral(plan.workspaceId)}`,
    "      AND stable_key = 'narrator_female'",
    "      AND role = 'narrator'",
    "      AND locale = 'fr'",
    "      AND provider = 'elevenlabs'",
    "      AND model_id = 'eleven_multilingual_v2'",
    "      AND status = 'available'",
    "      AND revocable IS TRUE",
    "      AND active_for_provider_execution IS FALSE",
    `      AND secret_locator = ${sqlLiteral(VOICE_IDENTITY_LOCATORS.narrator_female)}`,
    "      AND left(voice_fingerprint, 12) = '99db51be34bc'",
    "  ) INTO female_ok;",
    "  IF NOT female_ok THEN",
    "    RAISE EXCEPTION 'Phase 11C binding: narrator_female identity diverged';",
    "  END IF;",
    "  SELECT EXISTS (",
    "    SELECT 1 FROM public.voice_consent_attestations",
    `    WHERE id = ${sqlLiteral(plan.consentId)}`,
    `      AND workspace_id = ${sqlLiteral(plan.workspaceId)}`,
    `      AND voice_identity_id = ${sqlLiteral(plan.voiceIdentityId)}`,
    "      AND decision = 'authorized'",
    "      AND scope = 'workspace_voice_over'",
    "      AND 'voice_over' = ANY (allowed_content_kinds)",
    "      AND revoked_at IS NULL",
    "      AND authorization_source = 'christian_explicit_workspace_voice_authorization'",
    "  ) INTO consent_ok;",
    "  IF NOT consent_ok THEN",
    "    RAISE EXCEPTION 'Phase 11C binding: narrator_female consent diverged';",
    "  END IF;",
    "  INSERT INTO public.project_voice_bindings (",
    "    id, workspace_id, project_id, script_artifact_id, script_revision,",
    "    binding_role, voice_identity_id, allowed_content_kind, locale,",
    "    status, selected_by, idempotency_key, revision",
    "  ) VALUES (",
    `    ${sqlLiteral(plan.id)},`,
    `    ${sqlLiteral(plan.workspaceId)},`,
    `    ${sqlLiteral(plan.projectId)},`,
    `    ${sqlLiteral(plan.scriptArtifactId)},`,
    "    1,",
    "    'narrator',",
    `    ${sqlLiteral(plan.voiceIdentityId)},`,
    "    'voice_over',",
    "    'fr',",
    "    'prepared',",
    "    'christian',",
    `    ${sqlLiteral(plan.idempotencyKey)},`,
    "    1",
    "  );",
    "  SELECT count(*) INTO ident_count FROM public.voice_identities;",
    "  SELECT count(*) INTO consent_count FROM public.voice_consent_attestations;",
    "  SELECT count(*) INTO binding_count FROM public.project_voice_bindings;",
    "  SELECT count(*) INTO active_count FROM public.voice_identities WHERE active_for_provider_execution;",
    "  IF ident_count <> 4 OR consent_count <> 4 OR binding_count <> 1 OR active_count <> 0 THEN",
    "    RAISE EXCEPTION 'Phase 11C binding: post-insert invariants diverged';",
    "  END IF;",
    "  IF NOT EXISTS (",
    "    SELECT 1 FROM public.project_voice_bindings",
    `    WHERE id = ${sqlLiteral(plan.id)}`,
    `      AND workspace_id = ${sqlLiteral(plan.workspaceId)}`,
    `      AND project_id = ${sqlLiteral(plan.projectId)}`,
    `      AND voice_identity_id = ${sqlLiteral(plan.voiceIdentityId)}`,
    "      AND binding_role = 'narrator'",
    "      AND allowed_content_kind = 'voice_over'",
    "      AND locale = 'fr'",
    "      AND status = 'prepared'",
    "      AND selected_by = 'christian'",
    `      AND idempotency_key = ${sqlLiteral(plan.idempotencyKey)}`,
    "      AND revision = 1",
    "  ) THEN",
    "    RAISE EXCEPTION 'Phase 11C binding: inserted row diverged';",
    "  END IF;",
    "END",
    "$vhs_11c_bind$;",
  ].join("\n");
}

export function inspectI2vNarratorBindingTransactionSql(sql: string): {
  bindingInserts: number;
  identityInserts: number;
  consentInserts: number;
  hasUpdate: boolean;
  hasUpsert: boolean;
  hasDelete: boolean;
  containsVoiceId: boolean;
} {
  return {
    bindingInserts: (sql.match(/INSERT INTO public\.project_voice_bindings/g) ?? []).length,
    identityInserts: (sql.match(/INSERT INTO public\.voice_identities/g) ?? []).length,
    consentInserts: (sql.match(/INSERT INTO public\.voice_consent_attestations/g) ?? []).length,
    hasUpdate: /^\s*UPDATE\b/im.test(sql),
    hasUpsert: /ON CONFLICT/i.test(sql),
    hasDelete: /^\s*DELETE\b/im.test(sql),
    containsVoiceId:
      /"voiceId"\s*:/i.test(redactVoiceSecret(sql))
      || /ELEVENLABS_[A-Z_]*VOICE_ID\s*=/.test(sql),
  };
}

export function assertI2vNarratorBindingTransactionSqlAdmissible(sql: string): void {
  const inspected = inspectI2vNarratorBindingTransactionSql(sql);
  if (
    inspected.bindingInserts !== 1
    || inspected.identityInserts !== 0
    || inspected.consentInserts !== 0
    || inspected.hasUpdate
    || inspected.hasUpsert
    || inspected.hasDelete
    || inspected.containsVoiceId
  ) {
    throw new Error("Phase 11C binding apply: SQL is not the authorized bounded INSERT.");
  }
  if (!sql.includes(PHASE_11C_I2V_CHOSEN_NARRATOR)) {
    throw new Error("Phase 11C binding apply: narrator_female missing from SQL.");
  }
  if (!sql.includes(PHASE_11C_SEEDED_IDENTITY_IDS.narrator_female)) {
    throw new Error("Phase 11C binding apply: identity id missing from SQL.");
  }
  if (sql.includes(PHASE_11C_SEEDED_IDENTITY_IDS.narrator_male)) {
    throw new Error("Phase 11C binding apply: narrator_male must not be bound.");
  }
  if (sql.includes("character_mei") || sql.includes("character_tom")) {
    throw new Error("Phase 11C binding apply: character substitution is forbidden.");
  }
}

export function assertI2vNarratorBindingApplyNoSecondWrite(alreadyBound: boolean): void {
  if (alreadyBound) return;
  throw new Error("Phase 11C binding apply: remote binding missing; do not guess a second write.");
}

export function assertI2vNarratorBindingReplayExisting(plan: I2vNarratorBindingPlan): void {
  const replay = simulateI2vNarratorBindingApplyTransaction({
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
  if (
    replay.outcome !== "existing"
    || replay.productionWrites !== 0
    || replay.inserts !== 0
    || replay.updates !== 0
    || replay.deletes !== 0
  ) {
    throw new Error("Phase 11C binding apply: replay must be existing with 0 writes.");
  }
}

export function liveI2vProjectHasPersistedNarratorFemaleBinding(): true {
  return true;
}

export function i2vNarratorBindingApplyChecksums(): {
  auth: typeof PHASE_11C_I2V_NARRATOR_BINDING_APPLY_AUTH;
  verdict: typeof PHASE_11C_I2V_NARRATOR_BINDING_APPLY_VERDICT;
  nextAuth: typeof PHASE_11C_I2V_NARRATOR_BINDING_APPLY_NEXT_AUTH;
  preflightNext: typeof PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_NEXT_AUTH;
  planFingerprint: typeof PHASE_11C_I2V_NARRATOR_BINDING_PLAN_FINGERPRINT;
  decisionSource: typeof PHASE_11C_I2V_NARRATOR_DECISION_SOURCE;
  bindingVersion: typeof PHASE_11C_VOICE_BINDING_VERSION;
  budget: typeof PHASE_11C_LIVE_BUDGET;
} {
  assertPhase11CVoiceFlagsRemainOff({});
  const dry = runI2vNarratorBindingPreflightDryRun();
  assertI2vNarratorBindingPlanFingerprint(dry.fingerprint);
  const plan = buildI2vNarratorFemaleBindingPlan();
  assertBoundNarratorIdentityIsFemale(plan);
  assertI2vBundleResolvedExplicitly();
  return {
    auth: PHASE_11C_I2V_NARRATOR_BINDING_APPLY_AUTH,
    verdict: PHASE_11C_I2V_NARRATOR_BINDING_APPLY_VERDICT,
    nextAuth: PHASE_11C_I2V_NARRATOR_BINDING_APPLY_NEXT_AUTH,
    preflightNext: PHASE_11C_I2V_NARRATOR_BINDING_PREFLIGHT_NEXT_AUTH,
    planFingerprint: PHASE_11C_I2V_NARRATOR_BINDING_PLAN_FINGERPRINT,
    decisionSource: PHASE_11C_I2V_NARRATOR_DECISION_SOURCE,
    bindingVersion: PHASE_11C_VOICE_BINDING_VERSION,
    budget: PHASE_11C_LIVE_BUDGET,
  };
}

export function redactBindingApplyText(value: string): string {
  return redactVoiceSecret(value);
}

export {
  evaluateBindingCas,
  resolveI2vVoiceOverFromPreparedBinding,
};
