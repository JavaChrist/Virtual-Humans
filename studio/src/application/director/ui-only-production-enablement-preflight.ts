/**
 * Phase 184 — local read-only preflight for an isolated Director UI-only opening.
 * DIRECTOR_V2_ENABLED may be ON in a local test process only.
 * Every paid / AI / provider / worker / media / persistence / downstream flag stays OFF.
 * No Vercel write. No Production mutation. No provider.
 */

import {
  canExecutePaidGeneration,
  canUseDirectorV2Persistence,
  isDirectorV2Enabled,
  parseStrictEnabledFlag,
} from "@/infrastructure/config/feature-flags";

export const PHASE_184_AUTH =
  "AUTH_VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_PREFLIGHT_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER" as const;

export const PHASE_184_NEXT_AUTH =
  "AUTH_VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_FLAG_WRITE_ONCE_NO_PROVIDER_NO_PERSISTENCE_NO_RUNTIME" as const;

export const UI_ONLY_ISOLATED_FLAG = "DIRECTOR_V2_ENABLED" as const;

export const UI_ONLY_VERDICT = {
  readyForFlagAuth: "VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_PREFLIGHT_READY_FOR_FLAG_AUTH",
  blockedAudience: "VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_PREFLIGHT_BLOCKED_AUDIENCE_DECISION_REQUIRED",
  blockedHardening: "VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_PREFLIGHT_BLOCKED_HARDENING_REQUIRED",
} as const;

export type UiOnlyPreflightVerdict = (typeof UI_ONLY_VERDICT)[keyof typeof UI_ONLY_VERDICT];

/** Fail-closed values accepted by parseStrictEnabledFlag. */
export const STRICT_FLAG_FAIL_CLOSED_VALUES = [
  undefined,
  null,
  "",
  " ",
  "0",
  "false",
  "FALSE",
  "no",
  "off",
  "yes",
  "on",
  "enabled",
  "2",
] as const;

export const STRICT_FLAG_ON_VALUES = ["1", "true", "TRUE", " True "] as const;

/**
 * Flags that must remain OFF for an isolated UI-only opening.
 * Names come from the parsers actually read in code, not documentary aliases.
 */
export const UI_ONLY_MUST_STAY_OFF_FLAGS = [
  "DIRECTOR_V2_PERSISTENCE_ENABLED",
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

export type UiOnlyMustStayOffFlag = (typeof UI_ONLY_MUST_STAY_OFF_FLAGS)[number];

export type DirectorAudienceModel = {
  unauthenticated: "redirect_login";
  authenticatedStandard: "shared_studio_session";
  adminOperatorRole: "does_not_exist";
  otherCodedAudience: "none";
  sameAsCharactersSettingsBudget: true;
  inventedRoleForbidden: true;
};

export const DIRECTOR_UI_ONLY_AUDIENCE: DirectorAudienceModel = {
  unauthenticated: "redirect_login",
  authenticatedStandard: "shared_studio_session",
  adminOperatorRole: "does_not_exist",
  otherCodedAudience: "none",
  sameAsCharactersSettingsBudget: true,
  inventedRoleForbidden: true,
};

export type UiOnlySurfaceRow = {
  surface: string;
  visibleWithUiFlagOnly: boolean;
  actionPossible: string;
  route: string;
  readOrWrite: "none" | "read" | "local_write" | "server_write_if_persistence";
  providerPossible: false;
  costPossible: false;
  mediaPossible: false;
  effectiveGuard: string;
  uiOnlyVerdict: "safe" | "unreachable" | "existing_non_director";
};

export const UI_ONLY_SURFACE_MATRIX: readonly UiOnlySurfaceRow[] = [
  {
    surface: "Nav « Réalisateur IA »",
    visibleWithUiFlagOnly: true,
    actionPossible: "lien /director",
    route: "GET /api/settings → features.directorV2",
    readOrWrite: "read",
    providerPossible: false,
    costPossible: false,
    mediaPossible: false,
    effectiveGuard: "getFeatureFlags().directorV2 = isDirectorV2Enabled()",
    uiOnlyVerdict: "safe",
  },
  {
    surface: "Dashboard /",
    visibleWithUiFlagOnly: false,
    actionPossible: "aucune carte Director",
    route: "GET /",
    readOrWrite: "none",
    providerPossible: false,
    costPossible: false,
    mediaPossible: false,
    effectiveGuard: "page.tsx ne mentionne pas /director",
    uiOnlyVerdict: "safe",
  },
  {
    surface: "/director home",
    visibleWithUiFlagOnly: true,
    actionPossible: "brief local · CTA créer une vidéo",
    route: "GET /director",
    readOrWrite: "none",
    providerPossible: false,
    costPossible: false,
    mediaPossible: false,
    effectiveGuard: "layout isDirectorV2Enabled ; listProjects seulement si persistence",
    uiOnlyVerdict: "safe",
  },
  {
    surface: "/director/new brief",
    visibleWithUiFlagOnly: true,
    actionPossible: "brouillon localStorage · Valider le brief",
    route: "GET /director/new",
    readOrWrite: "local_write",
    providerPossible: false,
    costPossible: false,
    mediaPossible: false,
    effectiveGuard: "Créer le projet absent si !canUseDirectorV2Persistence",
    uiOnlyVerdict: "safe",
  },
  {
    surface: "/director/[projectId]",
    visibleWithUiFlagOnly: false,
    actionPossible: "notFound",
    route: "GET /director/:id",
    readOrWrite: "none",
    providerPossible: false,
    costPossible: false,
    mediaPossible: false,
    effectiveGuard: "page notFound() si persistence OFF",
    uiOnlyVerdict: "unreachable",
  },
  {
    surface: "APIs /api/director/*",
    visibleWithUiFlagOnly: false,
    actionPossible: "404 persistance désactivée",
    route: "/api/director/**",
    readOrWrite: "none",
    providerPossible: false,
    costPossible: false,
    mediaPossible: false,
    effectiveGuard: "canUseDirectorV2Persistence()",
    uiOnlyVerdict: "unreachable",
  },
  {
    surface: "Directors texte",
    visibleWithUiFlagOnly: false,
    actionPossible: "bouton marketing disabled après brief local",
    route: "aucune",
    readOrWrite: "none",
    providerPossible: false,
    costPossible: false,
    mediaPossible: false,
    effectiveGuard: "AI flags OFF + persistence OFF",
    uiOnlyVerdict: "safe",
  },
  {
    surface: "Production / Voice / Lipsync / Merge-Export",
    visibleWithUiFlagOnly: false,
    actionPossible: "sections projet inaccessibles",
    route: "aucune sans persistence",
    readOrWrite: "none",
    providerPossible: false,
    costPossible: false,
    mediaPossible: false,
    effectiveGuard: "projet 404 + gates 11A–11E OFF",
    uiOnlyVerdict: "unreachable",
  },
  {
    surface: "Téléchargement / publication",
    visibleWithUiFlagOnly: false,
    actionPossible: "aucune",
    route: "aucune",
    readOrWrite: "none",
    providerPossible: false,
    costPossible: false,
    mediaPossible: false,
    effectiveGuard: "mergeExportAuthorized=false + delivery hors projet",
    uiOnlyVerdict: "unreachable",
  },
  {
    surface: "Nav budget (hors Director)",
    visibleWithUiFlagOnly: true,
    actionPossible: "GET existant · DELETE déjà exposé hors Director",
    route: "GET|DELETE /api/budget",
    readOrWrite: "read",
    providerPossible: false,
    costPossible: false,
    mediaPossible: false,
    effectiveGuard: "session studio existante — pas une écriture Director",
    uiOnlyVerdict: "existing_non_director",
  },
] as const;

export type UiOnlyWriteRow = {
  write: string;
  route: string;
  target: string;
  environment: "browser" | "local_server" | "production";
  productNeed: string;
  idempotent: boolean;
  risk: string;
  authorizedInIsolatedUiOnly: boolean;
};

export const UI_ONLY_WRITE_INVENTORY: readonly UiOnlyWriteRow[] = [
  {
    write: "Brouillon brief",
    route: "localStorage",
    target: "virtual-humans:director:v2:brief-draft",
    environment: "browser",
    productNeed: "reprise du wizard sans serveur",
    idempotent: true,
    risk: "données locales du navigateur seulement",
    authorizedInIsolatedUiOnly: true,
  },
  {
    write: "Création projet Director",
    route: "POST /api/director/projects",
    target: "tables Director Supabase",
    environment: "production",
    productNeed: "persister un brief",
    idempotent: false,
    risk: "mutation serveur + artifacts",
    authorizedInIsolatedUiOnly: false,
  },
  {
    write: "Révision brief persistée",
    route: "POST /api/director/projects/:id/brief/revise",
    target: "artifacts brief",
    environment: "production",
    productNeed: "réviser un projet",
    idempotent: false,
    risk: "écriture artifact",
    authorizedInIsolatedUiOnly: false,
  },
  {
    write: "Artifacts fake / dry-run",
    route: "POST /api/director/projects/:id/*",
    target: "artifacts Director",
    environment: "production",
    productNeed: "pipeline fake",
    idempotent: false,
    risk: "écritures serveur hors UI-only isolé",
    authorizedInIsolatedUiOnly: false,
  },
  {
    write: "Télémétrie listed/loaded",
    route: "GET /director · GET /director/:id",
    target: "logs applicatifs",
    environment: "local_server",
    productNeed: "observabilité",
    idempotent: true,
    risk: "uniquement si persistence ON",
    authorizedInIsolatedUiOnly: false,
  },
  {
    write: "Reset budget nav",
    route: "DELETE /api/budget",
    target: "cumul budget session",
    environment: "local_server",
    productNeed: "déjà exposé hors Director",
    idempotent: true,
    risk: "hors scope Director — ne pas présenter comme écriture UI-only",
    authorizedInIsolatedUiOnly: false,
  },
] as const;

export function listFlagsOnThatMustStayOff(
  env: Record<string, string | undefined>,
): UiOnlyMustStayOffFlag[] {
  return UI_ONLY_MUST_STAY_OFF_FLAGS.filter((name) => parseStrictEnabledFlag(env[name]));
}

export function buildIsolatedUiOnlyEnv(
  extras: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    DIRECTOR_V2_ENABLED: "1",
  };
  for (const name of UI_ONLY_MUST_STAY_OFF_FLAGS) {
    env[name] = "0";
  }
  return { ...env, ...extras };
}

export function evaluateDirectorAudience(): DirectorAudienceModel {
  return DIRECTOR_UI_ONLY_AUDIENCE;
}

export type UiOnlyPreflightEvaluation = {
  verdict: UiOnlyPreflightVerdict;
  uiFlagOn: boolean;
  persistenceReachable: boolean;
  paidGenerationReachable: boolean;
  flagsOnThatMustStayOff: readonly string[];
  mergeExportAuthorized: false;
  audience: DirectorAudienceModel;
  reasons: string[];
};

export function evaluateUiOnlyPreflight(
  env: Record<string, string | undefined>,
): UiOnlyPreflightEvaluation {
  const uiFlagOn = isDirectorV2Enabled(env);
  const flagsOnThatMustStayOff = listFlagsOnThatMustStayOff(env);
  const persistenceReachable = canUseDirectorV2Persistence(env);
  const paidGenerationReachable = canExecutePaidGeneration(env);
  const reasons: string[] = [];

  if (!uiFlagOn) {
    reasons.push("DIRECTOR_V2_ENABLED is OFF — isolated UI-only scenario not active.");
  }
  if (flagsOnThatMustStayOff.length > 0) {
    reasons.push(
      `Flags that must stay OFF are ON: ${flagsOnThatMustStayOff.join(", ")}.`,
    );
  }
  if (persistenceReachable) {
    reasons.push(
      "DIRECTOR_V2_PERSISTENCE_ENABLED is ON — isolated UI-only forbids project create/load.",
    );
  }
  if (paidGenerationReachable) {
    reasons.push("canExecutePaidGeneration is true — paid runtime reachable.");
  }

  let verdict: UiOnlyPreflightVerdict = UI_ONLY_VERDICT.readyForFlagAuth;
  if (!uiFlagOn || flagsOnThatMustStayOff.length > 0 || persistenceReachable || paidGenerationReachable) {
    verdict = UI_ONLY_VERDICT.blockedHardening;
  } else if (DIRECTOR_UI_ONLY_AUDIENCE.adminOperatorRole !== "does_not_exist") {
    verdict = UI_ONLY_VERDICT.blockedAudience;
  }

  return {
    verdict,
    uiFlagOn,
    persistenceReachable,
    paidGenerationReachable,
    flagsOnThatMustStayOff,
    mergeExportAuthorized: false,
    audience: DIRECTOR_UI_ONLY_AUDIENCE,
    reasons,
  };
}

export const UI_ONLY_SOURCE_GUARDS = {
  layoutGate: 'if (!isDirectorV2Enabled())',
  proxyPublicDirectorAbsent: 'pathname === "/director"',
  persistenceConjunction: "isDirectorV2Enabled(env) && isDirectorV2PersistenceEnabled(env)",
  navFeature: "s.features?.directorV2",
  settingsFeatures: "features: getFeatureFlags()",
} as const;
