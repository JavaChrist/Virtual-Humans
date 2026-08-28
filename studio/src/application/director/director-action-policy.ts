/**
 * Central Director action policy (phase 187).
 *
 * persistenceEnabled !== executionAuthorized
 *
 * Never infer execution from persistence, readiness, artifacts, completed,
 * approved, merge_ready, credentials, Storage, or NODE_ENV=test.
 * Unknown actions are refused fail-closed.
 */

import {
  canExecuteArtAi,
  canExecuteCreativeAi,
  canExecuteMarketingAi,
  canExecutePaidGeneration,
  canExecuteScriptAi,
  canExecuteStoryboardAi,
  canUseDirectorV2Persistence,
  parseStrictEnabledFlag,
} from "@/infrastructure/config/feature-flags";
import { isDirectorE2eFakeMode } from "@/infrastructure/config/e2e-fake-mode";
import { canUseProcessLocalFakeAssetContent } from "@/infrastructure/config/local-fake-delivery";
import { DIRECTOR_API_ROUTE_FILES } from "./persistence-production-enablement-preflight";

export const DIRECTOR_CAPABILITY_DISABLED_CODE = "director_capability_disabled" as const;
export const DIRECTOR_ROUTE_UNCLASSIFIED_CODE = "director_route_unclassified" as const;
export const DIRECTOR_PERSISTENCE_DISABLED_CODE = "persistence_disabled" as const;

export const DIRECTOR_CAPABILITY_DISABLED_PUBLIC_MESSAGE =
  "Cette action de génération n’est pas disponible." as const;
export const DIRECTOR_MEDIA_UNAVAILABLE_PUBLIC_MESSAGE =
  "Cette ressource n’est pas disponible." as const;
export const DIRECTOR_PERSISTENCE_DISABLED_PUBLIC_MESSAGE =
  "Persistance Director désactivée." as const;

export type DirectorActionCategory =
  | "PERSISTENCE_BASE_READ"
  | "PERSISTENCE_BASE_WRITE"
  | "CAPABILITY_EXECUTION"
  | "MEDIA_DELIVERY";

export type DirectorRouteId =
  | "projects"
  | "project_get"
  | "brief_revisions"
  | "brief_compare"
  | "stale"
  | "text_runs"
  | "marketing"
  | "marketing_retry"
  | "creative"
  | "script"
  | "art"
  | "art_retry"
  | "storyboard"
  | "prompts"
  | "routing"
  | "production"
  | "production_cancel"
  | "merge"
  | "export"
  | "export_manifest"
  | "export_download"
  | "quality"
  | "quality_review"
  | "approvals"
  | "motion_review";

export type DirectorActionMode =
  | "get"
  | "list"
  | "create"
  | "dry-run"
  | "execute"
  | "retry"
  | "prepare"
  | "cancel"
  | "review"
  | "download"
  | "approve_text"
  | "approve_generation_plan";

export const DIRECTOR_ROUTE_CATALOG = [
  {
    id: "projects",
    path: "/api/director/projects",
    file: "src/app/api/director/projects/route.ts",
  },
  {
    id: "project_get",
    path: "/api/director/projects/[projectId]",
    file: "src/app/api/director/projects/[projectId]/route.ts",
  },
  {
    id: "brief_revisions",
    path: "/api/director/projects/[projectId]/brief/revisions",
    file: "src/app/api/director/projects/[projectId]/brief/revisions/route.ts",
  },
  {
    id: "brief_compare",
    path: "/api/director/projects/[projectId]/brief/compare",
    file: "src/app/api/director/projects/[projectId]/brief/compare/route.ts",
  },
  {
    id: "stale",
    path: "/api/director/projects/[projectId]/stale",
    file: "src/app/api/director/projects/[projectId]/stale/route.ts",
  },
  {
    id: "text_runs",
    path: "/api/director/projects/[projectId]/text-runs",
    file: "src/app/api/director/projects/[projectId]/text-runs/route.ts",
  },
  {
    id: "marketing",
    path: "/api/director/projects/[projectId]/marketing",
    file: "src/app/api/director/projects/[projectId]/marketing/route.ts",
  },
  {
    id: "marketing_retry",
    path: "/api/director/projects/[projectId]/marketing/retry",
    file: "src/app/api/director/projects/[projectId]/marketing/retry/route.ts",
  },
  {
    id: "creative",
    path: "/api/director/projects/[projectId]/creative",
    file: "src/app/api/director/projects/[projectId]/creative/route.ts",
  },
  {
    id: "script",
    path: "/api/director/projects/[projectId]/script",
    file: "src/app/api/director/projects/[projectId]/script/route.ts",
  },
  {
    id: "art",
    path: "/api/director/projects/[projectId]/art",
    file: "src/app/api/director/projects/[projectId]/art/route.ts",
  },
  {
    id: "art_retry",
    path: "/api/director/projects/[projectId]/art/retry",
    file: "src/app/api/director/projects/[projectId]/art/retry/route.ts",
  },
  {
    id: "storyboard",
    path: "/api/director/projects/[projectId]/storyboard",
    file: "src/app/api/director/projects/[projectId]/storyboard/route.ts",
  },
  {
    id: "prompts",
    path: "/api/director/projects/[projectId]/prompts",
    file: "src/app/api/director/projects/[projectId]/prompts/route.ts",
  },
  {
    id: "routing",
    path: "/api/director/projects/[projectId]/routing",
    file: "src/app/api/director/projects/[projectId]/routing/route.ts",
  },
  {
    id: "production",
    path: "/api/director/projects/[projectId]/production",
    file: "src/app/api/director/projects/[projectId]/production/route.ts",
  },
  {
    id: "production_cancel",
    path: "/api/director/projects/[projectId]/production/cancel",
    file: "src/app/api/director/projects/[projectId]/production/cancel/route.ts",
  },
  {
    id: "merge",
    path: "/api/director/projects/[projectId]/merge",
    file: "src/app/api/director/projects/[projectId]/merge/route.ts",
  },
  {
    id: "export",
    path: "/api/director/projects/[projectId]/export",
    file: "src/app/api/director/projects/[projectId]/export/route.ts",
  },
  {
    id: "export_manifest",
    path: "/api/director/projects/[projectId]/export/manifest",
    file: "src/app/api/director/projects/[projectId]/export/manifest/route.ts",
  },
  {
    id: "export_download",
    path: "/api/director/projects/[projectId]/export/download",
    file: "src/app/api/director/projects/[projectId]/export/download/route.ts",
  },
  {
    id: "quality",
    path: "/api/director/projects/[projectId]/quality",
    file: "src/app/api/director/projects/[projectId]/quality/route.ts",
  },
  {
    id: "quality_review",
    path: "/api/director/projects/[projectId]/quality/review",
    file: "src/app/api/director/projects/[projectId]/quality/review/route.ts",
  },
  {
    id: "approvals",
    path: "/api/director/projects/[projectId]/approvals",
    file: "src/app/api/director/projects/[projectId]/approvals/route.ts",
  },
  {
    id: "motion_review",
    path: "/api/director/projects/[projectId]/motion/review",
    file: "src/app/api/director/projects/[projectId]/motion/review/route.ts",
  },
] as const satisfies readonly { id: DirectorRouteId; path: string; file: string }[];

export const DIRECTOR_ROUTES_CLASSIFIED = DIRECTOR_ROUTE_CATALOG.length;

type Env = Record<string, string | undefined>;

function normalizeMode(mode?: string): DirectorActionMode | undefined {
  if (!mode) return undefined;
  if (mode === "dry_run") return "dry-run";
  return mode as DirectorActionMode;
}

/**
 * Exhaustive classification. Unknown combinations return null (fail-closed).
 */
export function classifyDirectorAction(
  routeId: string,
  method: string,
  mode?: string,
): DirectorActionCategory | null {
  const m = method.toUpperCase();
  const action = normalizeMode(mode);

  if (routeId === "projects" && m === "GET") return "PERSISTENCE_BASE_READ";
  if (routeId === "projects" && m === "POST") return "PERSISTENCE_BASE_WRITE";
  if (routeId === "project_get" && m === "GET") return "PERSISTENCE_BASE_READ";
  if (routeId === "brief_revisions" && m === "GET") return "PERSISTENCE_BASE_READ";
  if (routeId === "brief_revisions" && m === "POST") return "PERSISTENCE_BASE_WRITE";
  if (routeId === "brief_compare" && m === "GET") return "PERSISTENCE_BASE_READ";
  if (routeId === "stale" && m === "GET") return "PERSISTENCE_BASE_READ";
  if (routeId === "text_runs" && m === "GET") return "PERSISTENCE_BASE_READ";
  if (routeId === "export_manifest" && m === "GET") return "PERSISTENCE_BASE_READ";
  if (routeId === "production_cancel" && m === "POST") return "PERSISTENCE_BASE_WRITE";

  const readLike =
    m === "GET" || action === "get" || action === "list" || action === "dry-run";

  if (
    (routeId === "marketing" ||
      routeId === "creative" ||
      routeId === "script" ||
      routeId === "art" ||
      routeId === "storyboard" ||
      routeId === "prompts" ||
      routeId === "routing" ||
      routeId === "production" ||
      routeId === "merge" ||
      routeId === "export" ||
      routeId === "quality") &&
    readLike
  ) {
    return "PERSISTENCE_BASE_READ";
  }

  if (routeId === "motion_review" && readLike) return "PERSISTENCE_BASE_READ";

  if (routeId === "approvals" && m === "POST") {
    if (action === "approve_generation_plan") return "CAPABILITY_EXECUTION";
    return "PERSISTENCE_BASE_WRITE";
  }

  if (routeId === "export_download" && m === "GET") return "MEDIA_DELIVERY";

  if (
    (routeId === "marketing" ||
      routeId === "creative" ||
      routeId === "script" ||
      routeId === "art" ||
      routeId === "storyboard" ||
      routeId === "prompts" ||
      routeId === "routing" ||
      routeId === "production" ||
      routeId === "merge" ||
      routeId === "export" ||
      routeId === "quality") &&
    m === "POST" &&
    (action === "execute" || action === "prepare")
  ) {
    return "CAPABILITY_EXECUTION";
  }

  if (
    (routeId === "marketing_retry" || routeId === "art_retry") &&
    m === "POST"
  ) {
    return "CAPABILITY_EXECUTION";
  }

  if (routeId === "quality_review" && m === "POST") return "CAPABILITY_EXECUTION";
  if (routeId === "motion_review" && m === "POST") return "CAPABILITY_EXECUTION";

  return null;
}

export function isLocalMotionReviewHarness(env: Env = process.env as Env): boolean {
  if (!parseStrictEnabledFlag(env.MOTION_TRANSFER_FAKE_HARNESS)) return false;
  return canUseProcessLocalFakeAssetContent(env);
}

/** Local E2E harness only — never Production, never persistence alone. */
export function canExecuteSyntheticDirectorPipeline(env: Env = process.env as Env): boolean {
  return isDirectorE2eFakeMode(env);
}

export function canExecuteDirectorProduction(env: Env = process.env as Env): boolean {
  return isDirectorE2eFakeMode(env) || canExecutePaidGeneration(env);
}

export function canExecuteDirectorMergeExport(env: Env = process.env as Env): boolean {
  return isDirectorE2eFakeMode(env);
}

export function canExecuteDirectorQualityOrReview(env: Env = process.env as Env): boolean {
  return isDirectorE2eFakeMode(env);
}

export function canExecuteDirectorMotionReview(env: Env = process.env as Env): boolean {
  return isLocalMotionReviewHarness(env);
}

export function canDeliverDirectorMedia(env: Env = process.env as Env): boolean {
  return isDirectorE2eFakeMode(env);
}

export function canExecuteTextDirector(
  routeId: DirectorRouteId,
  env: Env = process.env as Env,
): boolean {
  if (isDirectorE2eFakeMode(env)) return true;
  if (routeId === "marketing" || routeId === "marketing_retry") {
    return canExecuteMarketingAi(env);
  }
  if (routeId === "creative") return canExecuteCreativeAi(env);
  if (routeId === "script") return canExecuteScriptAi(env);
  if (routeId === "art" || routeId === "art_retry") return canExecuteArtAi(env);
  if (routeId === "storyboard") return canExecuteStoryboardAi(env);
  return false;
}

function capabilityAllowed(routeId: DirectorRouteId, env: Env): boolean {
  if (
    routeId === "marketing" ||
    routeId === "marketing_retry" ||
    routeId === "creative" ||
    routeId === "script" ||
    routeId === "art" ||
    routeId === "art_retry" ||
    routeId === "storyboard"
  ) {
    return canExecuteTextDirector(routeId, env);
  }
  if (routeId === "prompts" || routeId === "routing" || routeId === "approvals") {
    return canExecuteSyntheticDirectorPipeline(env);
  }
  if (routeId === "production") return canExecuteDirectorProduction(env);
  if (routeId === "merge" || routeId === "export") {
    return canExecuteDirectorMergeExport(env);
  }
  if (routeId === "quality" || routeId === "quality_review") {
    return canExecuteDirectorQualityOrReview(env);
  }
  if (routeId === "motion_review") return canExecuteDirectorMotionReview(env);
  return false;
}

export type DirectorActionDecision =
  | { allowed: true; category: DirectorActionCategory }
  | {
      allowed: false;
      category: DirectorActionCategory | "UNCLASSIFIED";
      status: 404 | 503;
      code:
        | typeof DIRECTOR_CAPABILITY_DISABLED_CODE
        | typeof DIRECTOR_ROUTE_UNCLASSIFIED_CODE
        | typeof DIRECTOR_PERSISTENCE_DISABLED_CODE;
      publicMessage: string;
    };

export function authorizeDirectorAction(
  input: { routeId: string; method: string; mode?: string },
  env: Env = process.env as Env,
): DirectorActionDecision {
  const category = classifyDirectorAction(input.routeId, input.method, input.mode);
  if (!category) {
    return {
      allowed: false,
      category: "UNCLASSIFIED",
      status: 503,
      code: DIRECTOR_ROUTE_UNCLASSIFIED_CODE,
      publicMessage: DIRECTOR_CAPABILITY_DISABLED_PUBLIC_MESSAGE,
    };
  }

  const persistenceOn = canUseDirectorV2Persistence(env);

  if (category === "PERSISTENCE_BASE_READ" || category === "PERSISTENCE_BASE_WRITE") {
    if (!persistenceOn) {
      return {
        allowed: false,
        category,
        status: 404,
        code: DIRECTOR_PERSISTENCE_DISABLED_CODE,
        publicMessage: DIRECTOR_PERSISTENCE_DISABLED_PUBLIC_MESSAGE,
      };
    }
    return { allowed: true, category };
  }

  if (category === "MEDIA_DELIVERY") {
    if (!canDeliverDirectorMedia(env)) {
      return {
        allowed: false,
        category,
        status: 404,
        code: DIRECTOR_CAPABILITY_DISABLED_CODE,
        publicMessage: DIRECTOR_MEDIA_UNAVAILABLE_PUBLIC_MESSAGE,
      };
    }
    return { allowed: true, category };
  }

  // CAPABILITY_EXECUTION — persistence is never sufficient.
  if (!capabilityAllowed(input.routeId as DirectorRouteId, env)) {
    return {
      allowed: false,
      category,
      status: 503,
      code: DIRECTOR_CAPABILITY_DISABLED_CODE,
      publicMessage: DIRECTOR_CAPABILITY_DISABLED_PUBLIC_MESSAGE,
    };
  }
  if (!persistenceOn && !isDirectorE2eFakeMode(env) && !isLocalMotionReviewHarness(env)) {
    return {
      allowed: false,
      category,
      status: 404,
      code: DIRECTOR_PERSISTENCE_DISABLED_CODE,
      publicMessage: DIRECTOR_PERSISTENCE_DISABLED_PUBLIC_MESSAGE,
    };
  }
  return { allowed: true, category };
}

export function directorActionHttp(decision: DirectorActionDecision): {
  status: 404 | 503;
  body: { error: string; code: string };
} | null {
  if (decision.allowed) return null;
  return {
    status: decision.status,
    body: { error: decision.publicMessage, code: decision.code },
  };
}

export function assertDirectorRoutesFullyClassified(): {
  classified: number;
  unclassified: number;
  missingFiles: string[];
} {
  const catalogFiles = new Set(DIRECTOR_ROUTE_CATALOG.map((r) => r.file));
  const missingFiles = DIRECTOR_API_ROUTE_FILES.filter((f) => !catalogFiles.has(f));
  return {
    classified: DIRECTOR_ROUTE_CATALOG.length,
    unclassified: missingFiles.length,
    missingFiles: [...missingFiles],
  };
}

/** Isolated local/test env that may execute the synthetic pipeline. Never Production. */
export function directorLocalExecutionEnv(
  extras: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_E2E_FAKE_MODE: "1",
    DIRECTOR_V2_E2E_HARNESS: "1",
    NODE_ENV: "test",
    SUPABASE_URL: "http://127.0.0.1:54321",
    ...extras,
  };
}
