/**
 * Next.js production file-tracing bounds (Porte 4B / ENOSPC).
 *
 * Characters SDK lives at `<repo>/characters` (one level above `studio/`).
 * We must include those assets for character/media API routes only — never for
 * every `/api/**` route (that duplicated ~250 MiB per function and exhausted
 * Vercel packaging disk).
 */

/** App Router route globs that may read `<repo>/characters` at runtime. */
export const CHARACTER_FS_ROUTE_GLOBS = [
  "/api/v1/characters/**",
  "/api/characters/**",
  "/api/character/**",
  "/api/asset/**",
  "/api/assets/**",
  "/api/outfits/**",
  "/api/template/**",
  "/api/generate/scene-image/**",
  "/api/generate/video/**",
  "/api/generate/duo-frame/**",
  "/api/generate/voice/**",
  "/api/generate/carousel/**",
  "/api/generate/image/**",
  "/api/generate/lipsync/**",
] as const;

/** Paths always included for the character-fs routes (relative to studio cwd). */
export const CHARACTER_FS_INCLUDE_GLOBS = ["../characters/**"] as const;

/**
 * Exclusions relative to `outputFileTracingRoot` (repo root when set to `..`).
 * Prevents NFT from packing git history, docs, tests, and local Supabase junk.
 */
export const FILE_TRACING_EXCLUDE_GLOBS = [
  "../.git/**",
  "../docs/**",
  "../studio/e2e/**",
  "../studio/playwright-report/**",
  "../studio/test-results/**",
  "../studio/coverage/**",
  "../studio/supabase/.temp/**",
  "../studio/supabase/.branches/**",
  "../studio/.next/**",
  "../studio/.vercel/**",
  // Config / agent docs must not ride along character NFT graphs.
  "../studio/next.config.ts",
  "../studio/file-tracing.ts",
  "../studio/AGENTS.md",
  "../studio/CLAUDE.md",
  "../studio/README.md",
  "../studio/eslint.config.mjs",
] as const;

export function characterFsTracingIncludes(): Record<string, string[]> {
  const includes = [...CHARACTER_FS_INCLUDE_GLOBS];
  return Object.fromEntries(
    CHARACTER_FS_ROUTE_GLOBS.map((route) => [route, includes]),
  );
}

export function fileTracingExcludes(): Record<string, string[]> {
  return {
    "/**": [...FILE_TRACING_EXCLUDE_GLOBS],
  };
}

/** Guard helpers for unit tests — keep packaging bounds explicit. */
export function assertTracingBoundsSafe(config: {
  includes: Record<string, string[]>;
  excludes: Record<string, string[]>;
}): void {
  for (const [route, globs] of Object.entries(config.includes)) {
    if (route === "/api/**" || route === "/**") {
      throw new Error(
        `Tracing include trop large: ${route} — limiter aux routes character/media`,
      );
    }
    if (!route.startsWith("/api/")) {
      throw new Error(`Tracing include hors API: ${route}`);
    }
    for (const g of globs) {
      if (g === "../**" || g === "../*" || g.includes("../**")) {
        throw new Error(`Tracing include parent trop large: ${g}`);
      }
      if (!g.startsWith("../characters")) {
        throw new Error(`Tracing include inattendu: ${g}`);
      }
    }
  }
  const excludes = config.excludes["/**"] ?? [];
  for (const required of ["../.git/**", "../docs/**", "../studio/e2e/**"]) {
    if (!excludes.includes(required)) {
      throw new Error(`Tracing exclude manquant: ${required}`);
    }
  }
}
