/**
 * Phase 186 — local read-only preflight for a future Director persistence opening.
 * DIRECTOR_V2_ENABLED + DIRECTOR_V2_PERSISTENCE_ENABLED may be ON in a local test
 * process only. Every paid / AI / provider / worker / media / E2E / downstream
 * flag stays OFF. No Vercel write. No Production mutation. No provider.
 */

import {
  canExecuteArtAi,
  canExecuteCreativeAi,
  canExecuteMarketingAi,
  canExecutePaidGeneration,
  canExecuteScriptAi,
  canExecuteStoryboardAi,
  canUseDirectorV2Persistence,
  isDirectorV2Enabled,
  parseStrictEnabledFlag,
} from "@/infrastructure/config/feature-flags";
import {
  DIRECTOR_UI_ONLY_AUDIENCE,
  STRICT_FLAG_FAIL_CLOSED_VALUES,
  STRICT_FLAG_ON_VALUES,
  type DirectorAudienceModel,
} from "./ui-only-production-enablement-preflight";

export const PHASE_186_AUTH =
  "AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER_NO_PRODUCTION_WRITE" as const;

export const PHASE_186_NEXT_AUTH =
  "AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENING_IMPLEMENT_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER" as const;

export const PERSISTENCE_ISOLATED_FLAGS = [
  "DIRECTOR_V2_ENABLED",
  "DIRECTOR_V2_PERSISTENCE_ENABLED",
] as const;

export const PERSISTENCE_VERDICT = {
  readyForFlagAndWriteAuth:
    "VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_READY_FOR_FLAG_AND_WRITE_AUTH",
  blockedHardening:
    "VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_BLOCKED_HARDENING_REQUIRED",
  blockedSchema:
    "VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_BLOCKED_SCHEMA_HARDENING_REQUIRED",
  blockedSecurity:
    "VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_BLOCKED_SECURITY_REQUIRED",
} as const;

export type PersistencePreflightVerdict =
  (typeof PERSISTENCE_VERDICT)[keyof typeof PERSISTENCE_VERDICT];

export const PERSISTENCE_MUST_STAY_OFF_FLAGS = [
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_MARKETING_AI_ENABLED",
  "DIRECTOR_V2_CREATIVE_AI_ENABLED",
  "DIRECTOR_V2_SCRIPT_AI_ENABLED",
  "DIRECTOR_V2_ART_AI_ENABLED",
  "DIRECTOR_V2_STORYBOARD_AI_ENABLED",
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "DIRECTOR_V2_E2E_HARNESS",
  "DIRECTOR_V2_E2E_FAKE_MODE",
  "DIRECTOR_V2_E2E_ASSET_STORAGE",
  "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
  "VHS11B_I2V_CAPABILITY_ENABLED",
  "VHS11B_I2V_PAID_ENABLED",
  "VHS11B_I2V_FAL_ENABLED",
  "VHS11B_I2V_WORKER_ENABLED",
  "VHS11B_I2V_DOWNSTREAM_ENABLED",
  "VHS11B_FAL_I2V_DIRECTOR_EXCEPTION",
  "VHS11C_VOICE_CAPABILITY_ENABLED",
  "VHS11C_VOICE_PAID_ENABLED",
  "VHS11C_VOICE_ELEVENLABS_ENABLED",
  "VHS11C_VOICE_WORKER_ENABLED",
  "VHS11C_VOICE_DOWNSTREAM_ENABLED",
  "VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION",
  "VHS11D_LIPSYNC_CAPABILITY_ENABLED",
  "VHS11D_LIPSYNC_PAID_ENABLED",
  "VHS11D_LIPSYNC_PROVIDER_ENABLED",
  "VHS11D_LIPSYNC_WORKER_ENABLED",
  "VHS11D_LIPSYNC_DOWNSTREAM_ENABLED",
  "VHS11D_LIPSYNC_DIRECTOR_EXCEPTION",
  "VHS11E_MERGE_CAPABILITY_ENABLED",
  "VHS11E_EXPORT_CAPABILITY_ENABLED",
  "VHS11E_PAID_ENABLED",
  "VHS11E_PROVIDER_ENABLED",
  "VHS11E_WORKER_ENABLED",
  "VHS11E_DIRECTOR_EXCEPTION",
  "VHS11E_PUBLISH_DOWNSTREAM_ENABLED",
  "MOTION_TRANSFER_ENABLED",
  "MOTION_TRANSFER_PAID_ENABLED",
  "MOTION_TRANSFER_FAL_ENABLED",
  "MOTION_TRANSFER_WORKER_ENABLED",
  "MOTION_TRANSFER_FAKE_HARNESS",
] as const;

export type PersistenceMustStayOffFlag =
  (typeof PERSISTENCE_MUST_STAY_OFF_FLAGS)[number];

export const PERSISTENCE_HARDENING_GAPS = [
  "prompt_routing_execute_ungated_by_ai_or_worker_flags",
  "production_execute_can_reserve_budget_without_worker_paid",
  "merge_execute_can_write_asset_content_when_persistence_on",
  "export_download_serves_bytes_without_11e",
  "quality_export_execute_writable_when_artifacts_exist",
  "quality_review_writes_human_review",
  "existing_production_projects_become_listable_and_pipeline_reachable",
  "motion_review_can_bypass_persistence_via_harness",
  "no_create_quota_beyond_ip_mutation_rate_limit",
] as const;

export type PersistenceHardeningGap = (typeof PERSISTENCE_HARDENING_GAPS)[number];

export type PersistenceWriteCategory =
  | "base_persistence"
  | "fake_pipeline"
  | "forbidden";

export type PersistenceRouteVerdict =
  | "ALLOW_BASE"
  | "ALLOW_FAKE_PIPELINE"
  | "FORBIDDEN_ISOLATED"
  | "HARDENING_REQUIRED";

export type PersistenceRouteRow = {
  route: string;
  methods: string;
  category: PersistenceWriteCategory;
  persistenceGuard: true;
  providerPossibleIfIsolated: false;
  verdict: PersistenceRouteVerdict;
};

export const DIRECTOR_PERSISTENCE_ROUTES: readonly PersistenceRouteRow[] = [
  { route: "/api/director/projects", methods: "GET,POST", category: "base_persistence", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "ALLOW_BASE" },
  { route: "/api/director/projects/[projectId]", methods: "GET", category: "base_persistence", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "ALLOW_BASE" },
  { route: "/api/director/projects/[projectId]/brief/revisions", methods: "GET,POST", category: "base_persistence", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "ALLOW_BASE" },
  { route: "/api/director/projects/[projectId]/brief/compare", methods: "GET", category: "base_persistence", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "ALLOW_BASE" },
  { route: "/api/director/projects/[projectId]/stale", methods: "GET", category: "base_persistence", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "ALLOW_BASE" },
  { route: "/api/director/projects/[projectId]/text-runs", methods: "GET", category: "base_persistence", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "ALLOW_BASE" },
  { route: "/api/director/projects/[projectId]/marketing", methods: "GET,POST", category: "forbidden", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "FORBIDDEN_ISOLATED" },
  { route: "/api/director/projects/[projectId]/marketing/retry", methods: "POST", category: "forbidden", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "FORBIDDEN_ISOLATED" },
  { route: "/api/director/projects/[projectId]/creative", methods: "GET,POST", category: "forbidden", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "FORBIDDEN_ISOLATED" },
  { route: "/api/director/projects/[projectId]/script", methods: "GET,POST", category: "forbidden", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "FORBIDDEN_ISOLATED" },
  { route: "/api/director/projects/[projectId]/art", methods: "GET,POST", category: "forbidden", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "FORBIDDEN_ISOLATED" },
  { route: "/api/director/projects/[projectId]/art/retry", methods: "POST", category: "forbidden", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "FORBIDDEN_ISOLATED" },
  { route: "/api/director/projects/[projectId]/storyboard", methods: "GET,POST", category: "forbidden", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "FORBIDDEN_ISOLATED" },
  { route: "/api/director/projects/[projectId]/prompts", methods: "GET,POST", category: "fake_pipeline", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "HARDENING_REQUIRED" },
  { route: "/api/director/projects/[projectId]/routing", methods: "GET,POST", category: "fake_pipeline", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "HARDENING_REQUIRED" },
  { route: "/api/director/projects/[projectId]/production", methods: "GET,POST", category: "fake_pipeline", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "HARDENING_REQUIRED" },
  { route: "/api/director/projects/[projectId]/production/cancel", methods: "POST", category: "base_persistence", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "ALLOW_BASE" },
  { route: "/api/director/projects/[projectId]/merge", methods: "GET,POST", category: "fake_pipeline", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "HARDENING_REQUIRED" },
  { route: "/api/director/projects/[projectId]/export", methods: "GET,POST", category: "fake_pipeline", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "HARDENING_REQUIRED" },
  { route: "/api/director/projects/[projectId]/export/manifest", methods: "GET", category: "base_persistence", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "ALLOW_BASE" },
  { route: "/api/director/projects/[projectId]/export/download", methods: "GET", category: "forbidden", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "HARDENING_REQUIRED" },
  { route: "/api/director/projects/[projectId]/quality", methods: "GET,POST", category: "fake_pipeline", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "HARDENING_REQUIRED" },
  { route: "/api/director/projects/[projectId]/quality/review", methods: "POST", category: "forbidden", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "HARDENING_REQUIRED" },
  { route: "/api/director/projects/[projectId]/approvals", methods: "POST", category: "base_persistence", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "ALLOW_BASE" },
  { route: "/api/director/projects/[projectId]/motion/review", methods: "GET,POST", category: "forbidden", persistenceGuard: true, providerPossibleIfIsolated: false, verdict: "HARDENING_REQUIRED" },
] as const;

export const DIRECTOR_API_ROUTE_FILES = [
  "src/app/api/director/projects/route.ts",
  "src/app/api/director/projects/[projectId]/route.ts",
  "src/app/api/director/projects/[projectId]/brief/revisions/route.ts",
  "src/app/api/director/projects/[projectId]/brief/compare/route.ts",
  "src/app/api/director/projects/[projectId]/stale/route.ts",
  "src/app/api/director/projects/[projectId]/text-runs/route.ts",
  "src/app/api/director/projects/[projectId]/marketing/route.ts",
  "src/app/api/director/projects/[projectId]/marketing/retry/route.ts",
  "src/app/api/director/projects/[projectId]/creative/route.ts",
  "src/app/api/director/projects/[projectId]/script/route.ts",
  "src/app/api/director/projects/[projectId]/art/route.ts",
  "src/app/api/director/projects/[projectId]/art/retry/route.ts",
  "src/app/api/director/projects/[projectId]/storyboard/route.ts",
  "src/app/api/director/projects/[projectId]/prompts/route.ts",
  "src/app/api/director/projects/[projectId]/routing/route.ts",
  "src/app/api/director/projects/[projectId]/production/route.ts",
  "src/app/api/director/projects/[projectId]/production/cancel/route.ts",
  "src/app/api/director/projects/[projectId]/merge/route.ts",
  "src/app/api/director/projects/[projectId]/export/route.ts",
  "src/app/api/director/projects/[projectId]/export/manifest/route.ts",
  "src/app/api/director/projects/[projectId]/export/download/route.ts",
  "src/app/api/director/projects/[projectId]/quality/route.ts",
  "src/app/api/director/projects/[projectId]/quality/review/route.ts",
  "src/app/api/director/projects/[projectId]/approvals/route.ts",
  "src/app/api/director/projects/[projectId]/motion/review/route.ts",
] as const;

export type PersistenceWriteRow = {
  write: string;
  route: string;
  table: string;
  category: PersistenceWriteCategory;
  authorizedInFuturePersistenceOnly: boolean;
  providerPossible: false;
  mediaPossible: boolean;
  budgetPossible: boolean;
};

export const PERSISTENCE_WRITE_MATRIX: readonly PersistenceWriteRow[] = [
  {
    write: "Création projet + brief rev.1",
    route: "POST /api/director/projects",
    table: "video_projects + project_artifacts",
    category: "base_persistence",
    authorizedInFuturePersistenceOnly: true,
    providerPossible: false,
    mediaPossible: false,
    budgetPossible: false,
  },
  {
    write: "Révision brief CAS",
    route: "POST /api/director/projects/:id/brief/revisions",
    table: "project_artifacts + active_artifact_revisions",
    category: "base_persistence",
    authorizedInFuturePersistenceOnly: true,
    providerPossible: false,
    mediaPossible: false,
    budgetPossible: false,
  },
  {
    write: "Approval artifact texte",
    route: "POST /api/director/projects/:id/approvals",
    table: "artifact_approvals",
    category: "base_persistence",
    authorizedInFuturePersistenceOnly: true,
    providerPossible: false,
    mediaPossible: false,
    budgetPossible: false,
  },
  {
    write: "Cancel production run",
    route: "POST /api/director/projects/:id/production/cancel",
    table: "production_runs",
    category: "base_persistence",
    authorizedInFuturePersistenceOnly: true,
    providerPossible: false,
    mediaPossible: false,
    budgetPossible: false,
  },
  {
    write: "Prompt / routing / production / merge / quality / export execute",
    route: "POST /api/director/projects/:id/{prompts|routing|production|merge|quality|export}",
    table: "director_runs + artifacts + jobs + ledger/storage",
    category: "fake_pipeline",
    authorizedInFuturePersistenceOnly: false,
    providerPossible: false,
    mediaPossible: true,
    budgetPossible: true,
  },
  {
    write: "Directors texte execute / retry",
    route: "POST /api/director/projects/:id/{marketing|creative|script|art|storyboard}",
    table: "director_runs + artifacts",
    category: "forbidden",
    authorizedInFuturePersistenceOnly: false,
    providerPossible: false,
    mediaPossible: false,
    budgetPossible: true,
  },
  {
    write: "Human Review quality / motion",
    route: "POST …/quality/review · POST …/motion/review",
    table: "human_review_decisions",
    category: "forbidden",
    authorizedInFuturePersistenceOnly: false,
    providerPossible: false,
    mediaPossible: false,
    budgetPossible: false,
  },
] as const;

export const PERSISTENCE_ROLLBACK = {
  flag: "DIRECTOR_V2_PERSISTENCE_ENABLED=0",
  redeployRequired: true,
  uiReturnsLocalStorageOnly: true,
  existingProjectsPreserved: true,
  noAutomaticDeletion: true,
  noDestructiveMigrationRollback: true,
  persistenceRoutesReturn404: true,
  directorUiOnlyRemainsOn: true,
  providersRemainOff: true,
} as const;

export const PERSISTENCE_SCHEMA = {
  localMigrations: 33,
  remoteMigrationsExpected: 32,
  ridecloudLocalOnly: "20260827133000_vhs_ridecloud_bind_artifact_kinds",
  ridecloudApply: "SUSPENDED_NOT_CONSUMED",
  newMigrationRequired: false,
  coreTables: [
    "video_projects",
    "project_artifacts",
    "active_artifact_revisions",
    "director_runs",
    "audit_log",
    "domain_events",
  ] as const,
  createRpc: "create_director_project_with_brief",
  reviseRpc: "revise_project_brief",
  rls: "on_no_policies_service_role_bypass",
  grantsAnonAuthenticated: "none",
} as const;

export const PERSISTENCE_QUOTA = {
  directorMutationsPerIp: 120,
  directorWindowMs: 60_000,
  createQuota: "none",
  getRateLimited: false,
  listCap: 20,
  sufficientForSharedPasswordAbuse: false,
} as const;

export function listPersistenceFlagsOnThatMustStayOff(
  env: Record<string, string | undefined>,
): PersistenceMustStayOffFlag[] {
  return PERSISTENCE_MUST_STAY_OFF_FLAGS.filter((name) =>
    parseStrictEnabledFlag(env[name]),
  );
}

export function buildIsolatedPersistenceEnv(
  extras: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  };
  for (const name of PERSISTENCE_MUST_STAY_OFF_FLAGS) {
    env[name] = "0";
  }
  return { ...env, ...extras };
}

export function evaluateDirectorAudience(): DirectorAudienceModel {
  return DIRECTOR_UI_ONLY_AUDIENCE;
}

export type PersistencePreflightEvaluation = {
  verdict: PersistencePreflightVerdict;
  uiFlagOn: boolean;
  persistenceReachable: boolean;
  paidGenerationReachable: boolean;
  textAiReachable: boolean;
  flagsOnThatMustStayOff: readonly string[];
  hardeningGaps: readonly PersistenceHardeningGap[];
  schemaReady: boolean;
  mergeExportAuthorized: false;
  audience: DirectorAudienceModel;
  reasons: string[];
};

export function evaluatePersistencePreflight(
  env: Record<string, string | undefined>,
): PersistencePreflightEvaluation {
  const uiFlagOn = isDirectorV2Enabled(env);
  const persistenceReachable = canUseDirectorV2Persistence(env);
  const flagsOnThatMustStayOff = listPersistenceFlagsOnThatMustStayOff(env);
  const paidGenerationReachable = canExecutePaidGeneration(env);
  const textAiReachable =
    canExecuteMarketingAi(env) ||
    canExecuteCreativeAi(env) ||
    canExecuteScriptAi(env) ||
    canExecuteArtAi(env) ||
    canExecuteStoryboardAi(env);
  const hardeningGaps = [...PERSISTENCE_HARDENING_GAPS];
  const reasons: string[] = [];

  if (!uiFlagOn) {
    reasons.push("DIRECTOR_V2_ENABLED is OFF — persistence conjunction unreachable.");
  }
  if (!persistenceReachable) {
    reasons.push("canUseDirectorV2Persistence is false — isolated persistence scenario not active.");
  }
  if (flagsOnThatMustStayOff.length > 0) {
    reasons.push(
      `Flags that must stay OFF are ON: ${flagsOnThatMustStayOff.join(", ")}.`,
    );
  }
  if (paidGenerationReachable) {
    reasons.push("canExecutePaidGeneration is true — paid runtime reachable.");
  }
  if (textAiReachable) {
    reasons.push("A text AI execute path is reachable.");
  }
  if (hardeningGaps.length > 0) {
    reasons.push(
      `Persistence ON would also open unguarded fake-pipeline / existing-project writes: ${hardeningGaps.join(", ")}.`,
    );
  }

  let verdict: PersistencePreflightVerdict =
    PERSISTENCE_VERDICT.blockedHardening;
  const isolatedReady =
    uiFlagOn &&
    persistenceReachable &&
    flagsOnThatMustStayOff.length === 0 &&
    !paidGenerationReachable &&
    !textAiReachable;
  if (isolatedReady && hardeningGaps.length === 0 && PERSISTENCE_SCHEMA.newMigrationRequired) {
    verdict = PERSISTENCE_VERDICT.blockedSchema;
  } else if (isolatedReady && hardeningGaps.length === 0) {
    verdict = PERSISTENCE_VERDICT.readyForFlagAndWriteAuth;
  }

  return {
    verdict,
    uiFlagOn,
    persistenceReachable,
    paidGenerationReachable,
    textAiReachable,
    flagsOnThatMustStayOff,
    hardeningGaps,
    schemaReady: !PERSISTENCE_SCHEMA.newMigrationRequired,
    mergeExportAuthorized: false,
    audience: DIRECTOR_UI_ONLY_AUDIENCE,
    reasons,
  };
}

export {
  DIRECTOR_UI_ONLY_AUDIENCE,
  STRICT_FLAG_FAIL_CLOSED_VALUES,
  STRICT_FLAG_ON_VALUES,
};
