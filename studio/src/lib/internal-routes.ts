/**
 * Exact cookie-exemption for internal routes (Phase 7 correctif).
 * No wildcard /api/internal/** — only the worker run-once POST.
 */

export const DIRECTOR_WORKER_RUN_ONCE_PATH =
  "/api/internal/director-worker/run-once" as const;

/**
 * True only for POST /api/internal/director-worker/run-once.
 * Cookie never authenticates this route; handler requires worker secret.
 */
export function isDirectorWorkerRunOncePost(
  pathname: string,
  method: string,
): boolean {
  return (
    pathname === DIRECTOR_WORKER_RUN_ONCE_PATH &&
    method.toUpperCase() === "POST"
  );
}

/** Any other /api/internal/* path is NOT cookie-exempt. */
export function isInternalApiPath(pathname: string): boolean {
  return pathname === "/api/internal" || pathname.startsWith("/api/internal/");
}
