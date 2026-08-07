/**
 * Guards against unbounded Next.js file-tracing that caused Vercel ENOSPC.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  CHARACTER_FS_INCLUDE_GLOBS,
  CHARACTER_FS_ROUTE_GLOBS,
  assertTracingBoundsSafe,
  characterFsTracingIncludes,
  fileTracingExcludes,
} from "../../../../file-tracing";

test("file-tracing — includes bornés aux routes character/media", () => {
  const includes = characterFsTracingIncludes();
  assertTracingBoundsSafe({
    includes,
    excludes: fileTracingExcludes(),
  });
  assert.ok(CHARACTER_FS_ROUTE_GLOBS.length >= 8);
  assert.deepEqual([...CHARACTER_FS_INCLUDE_GLOBS], ["../characters/**"]);
  assert.equal(includes["/api/**"], undefined);
  assert.ok(includes["/api/v1/characters/**"]?.includes("../characters/**"));
  assert.ok(includes["/api/asset/**"]?.includes("../characters/**"));
  assert.ok(
    includes["/api/director/projects/[projectId]/art/**"]?.includes("../characters/**"),
    "Art Director must receive characters SDK for capability snapshots",
  );
  assert.ok(!("/api/director/**" in includes), "never widen director wildcard");
  assert.ok(!("/api/budget/**" in includes));
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
  assert.match(cfg, /characterFsTracingIncludes/);
  assert.match(cfg, /fileTracingExcludes/);
  assert.ok(!/["']\/api\/\*\*["']\s*:\s*\[\s*["']\.\.\/characters/.test(cfg));
});

test("sdk — REPO_ROOT / CHARACTERS_ROOT portent turbopackIgnore", () => {
  const sdk = readFileSync(join(process.cwd(), "src/lib/sdk.ts"), "utf8");
  assert.match(sdk, /turbopackIgnore:\s*true/);
  assert.match(sdk, /characters/);
});
