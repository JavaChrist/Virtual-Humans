/**
 * Guards against unbounded Next.js file-tracing that caused Vercel ENOSPC.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  CHARACTER_FS_INCLUDE_GLOBS,
  CHARACTER_FS_ROUTE_GLOBS,
  SDK_VERSION_INCLUDE_GLOB,
  assertTracingBoundsSafe,
  characterFsTracingIncludes,
  fileTracingExcludes,
  studioTracingIncludes,
  versionApiTracingIncludes,
} from "../../../../file-tracing";

test("file-tracing — includes bornés aux routes character/media", () => {
  const includes = characterFsTracingIncludes();
  assertTracingBoundsSafe({
    includes,
    excludes: fileTracingExcludes(),
  });
  assert.ok(CHARACTER_FS_ROUTE_GLOBS.length >= 8);
  assert.deepEqual(
    [...CHARACTER_FS_INCLUDE_GLOBS],
    ["../characters/**", "../SDK_VERSION"],
  );
  assert.equal(includes["/api/**"], undefined);
  assert.ok(includes["/api/v1/characters/**"]?.includes("../characters/**"));
  assert.ok(includes["/api/asset/**"]?.includes("../characters/**"));
  assert.ok(
    includes["/api/director/projects/*/art/**"]?.includes("../characters/**"),
    "Art Director must receive characters SDK for capability snapshots",
  );
  // [projectId] would be a glob character-class — never use unescaped brackets here.
  assert.ok(!("/api/director/**" in includes), "never widen director wildcard");
  assert.ok(!("/api/budget/**" in includes));
});

test("file-tracing — SDK_VERSION racine est inclus et non exclu", () => {
  const includes = characterFsTracingIncludes();
  const excludes = fileTracingExcludes()["/**"] ?? [];
  const repoFile = resolve(process.cwd(), "..", "SDK_VERSION");
  assert.equal(SDK_VERSION_INCLUDE_GLOB, "../SDK_VERSION");
  assert.ok(CHARACTER_FS_INCLUDE_GLOBS.includes(SDK_VERSION_INCLUDE_GLOB));
  assert.equal(resolve(process.cwd(), SDK_VERSION_INCLUDE_GLOB), repoFile);
  assert.equal(existsSync(repoFile), true);
  assert.match(readFileSync(repoFile, "utf8").trim(), /^\d+\.\d+\.\d+$/);
  assert.ok(includes["/api/character/**"]?.includes(SDK_VERSION_INCLUDE_GLOB));
  assert.ok(includes["/api/v1/characters/**"]?.includes(SDK_VERSION_INCLUDE_GLOB));
  assert.ok(
    !excludes.some(
      (g) =>
        g === "../SDK_VERSION" ||
        g === "../SDK_VERSION/**" ||
        g.startsWith("../SDK_VERSION"),
    ),
    "excludes must not neutralize SDK_VERSION",
  );
  assert.ok(!CHARACTER_FS_INCLUDE_GLOBS.some((g) => g.includes("../**")));
  assert.throws(
    () =>
      assertTracingBoundsSafe({
        includes: { "/api/character/**": ["../**"] },
        excludes: fileTracingExcludes(),
      }),
    /trop large/i,
  );
  assert.throws(
    () =>
      assertTracingBoundsSafe({
        includes: { "/api/character/**": ["../docs/**"] },
        excludes: fileTracingExcludes(),
      }),
    /inattendu/i,
  );
});

test("file-tracing — excludes .git docs e2e et configs", () => {
  const excludes = fileTracingExcludes()["/**"];
  for (const required of [
    "../.git/**",
    "../docs/**",
    "../studio/e2e/**",
    "../studio/playwright-report/**",
    "../studio/next.config.ts",
    "../studio/file-tracing.ts",
  ]) {
    assert.ok(excludes.includes(required), required);
  }
});

test("file-tracing — n'exclut jamais .next (runtime Turbopack serverless)", () => {
  const excludes = fileTracingExcludes()["/**"];
  assert.ok(!excludes.some((g) => g.includes(".next")));
  assert.throws(
    () =>
      assertTracingBoundsSafe({
        includes: characterFsTracingIncludes(),
        excludes: {
          "/**": [
            "../.git/**",
            "../docs/**",
            "../studio/e2e/**",
            "../studio/.next/**",
          ],
        },
      }),
    /interdit|cass/i,
  );
});

test("next.config — utilise file-tracing (pas /api/** glob)", () => {
  const cfg = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  assert.match(cfg, /studioTracingIncludes/);
  assert.match(cfg, /fileTracingExcludes/);
  assert.ok(!/["']\/api\/\*\*["']\s*:\s*\[\s*["']\.\.\/characters/.test(cfg));
});

test("file-tracing — /api/version inclut uniquement SDK_VERSION", () => {
  const versionIncludes = versionApiTracingIncludes();
  const merged = studioTracingIncludes();
  assertTracingBoundsSafe({
    includes: merged,
    excludes: fileTracingExcludes(),
  });
  assert.deepEqual(versionIncludes["/api/version/**"], ["../SDK_VERSION"]);
  assert.deepEqual(merged["/api/version/**"], ["../SDK_VERSION"]);
  assert.ok(!merged["/api/version/**"]?.includes("../characters/**"));
  assert.equal(merged["/api/**"], undefined);
  assert.ok(merged["/api/character/**"]?.includes("../characters/**"));
  assert.ok(merged["/api/character/**"]?.includes("../SDK_VERSION"));
});

test("sdk — REPO_ROOT / CHARACTERS_ROOT portent turbopackIgnore", () => {
  const sdk = readFileSync(join(process.cwd(), "src/lib/sdk.ts"), "utf8");
  assert.match(sdk, /turbopackIgnore:\s*true/);
  assert.match(sdk, /characters/);
  assert.match(sdk, /SDK_VERSION/);
});

test("nft — SDK_VERSION embarqué pour /api/character si build présent", () => {
  const characterNft = join(
    process.cwd(),
    ".next/server/app/api/character/route.js.nft.json",
  );
  const budgetNft = join(
    process.cwd(),
    ".next/server/app/api/budget/route.js.nft.json",
  );
  if (!existsSync(characterNft)) {
    return;
  }
  const character = JSON.parse(readFileSync(characterNft, "utf8")) as {
    files?: string[];
  };
  const files = character.files ?? [];
  assert.ok(
    files.some((f) => /(^|\/|\\)SDK_VERSION$/.test(f)),
    "character NFT must include repo-root SDK_VERSION",
  );
  if (!existsSync(budgetNft)) return;
  const budget = JSON.parse(readFileSync(budgetNft, "utf8")) as {
    files?: string[];
  };
  assert.ok(
    !(budget.files ?? []).some((f) => /(^|\/|\\)SDK_VERSION$/.test(f)),
    "budget NFT must not receive SDK_VERSION",
  );
});

test("nft — SDK_VERSION embarqué pour /api/version si build présent", () => {
  const versionNft = join(
    process.cwd(),
    ".next/server/app/api/version/route.js.nft.json",
  );
  const budgetNft = join(
    process.cwd(),
    ".next/server/app/api/budget/route.js.nft.json",
  );
  if (!existsSync(versionNft)) {
    return;
  }
  const version = JSON.parse(readFileSync(versionNft, "utf8")) as {
    files?: string[];
  };
  assert.ok(
    (version.files ?? []).some((f) => /(^|\/|\\)SDK_VERSION$/.test(f)),
    "version NFT must include repo-root SDK_VERSION",
  );
  if (!existsSync(budgetNft)) return;
  const budget = JSON.parse(readFileSync(budgetNft, "utf8")) as {
    files?: string[];
  };
  assert.ok(
    !(budget.files ?? []).some((f) => /(^|\/|\\)SDK_VERSION$/.test(f)),
    "budget NFT must not receive SDK_VERSION",
  );
});
