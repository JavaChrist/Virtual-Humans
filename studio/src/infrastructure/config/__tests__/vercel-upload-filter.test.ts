/**
 * Guards Vercel upload exclusions so runtime e2e infrastructure is never ignored.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import {
  FORBIDDEN_VERCELIGNORE_RULES,
  REQUIRED_RUNTIME_E2E_MODULES,
  assertRequiredUploadFilesKept,
  assertVercelIgnoreRulesSafe,
  cleanupStaging,
  readVercelIgnoreRules,
  simulateVercelUpload,
  stageSimulatedUpload,
} from "../vercel-upload-filter";

const studioRoot = process.cwd();

test("vercelignore — règle ancrée /e2e/ et aucune règle ambiguë e2e", () => {
  const rules = readVercelIgnoreRules(studioRoot);
  assertVercelIgnoreRulesSafe(rules);
  assert.ok(rules.includes("/e2e/"));
  for (const bad of FORBIDDEN_VERCELIGNORE_RULES) {
    assert.ok(!rules.includes(bad), `règle interdite présente: ${bad}`);
  }
  const raw = readFileSync(join(studioRoot, ".vercelignore"), "utf8");
  assert.ok(!/^\s*e2e\s*$/m.test(raw), "règle nue e2e réintroduite");
  assert.ok(!/^\s*e2e\/\s*$/m.test(raw), "règle e2e/ non ancrée réintroduite");
});

test("simulation upload — modules runtime infrastructure/e2e conservés", () => {
  const sim = simulateVercelUpload(studioRoot);
  assertRequiredUploadFilesKept(sim);

  for (const rel of REQUIRED_RUNTIME_E2E_MODULES) {
    assert.ok(sim.kept.includes(rel), rel);
    assert.ok(existsSync(join(studioRoot, rel)), `fichier local manquant: ${rel}`);
  }

  // Imports ayant cassé dpl_6xEp…
  const directorServer = readFileSync(
    join(studioRoot, "src/infrastructure/db/director-server.ts"),
    "utf8",
  );
  assert.match(directorServer, /e2e-capability-registry/);
  assert.match(directorServer, /fake-director-analyzers/);
  assert.ok(sim.kept.includes("src/infrastructure/db/director-server.ts"));
});

test("simulation upload — suite Playwright racine et artefacts exclus", () => {
  const sim = simulateVercelUpload(studioRoot);
  assert.ok(sim.excluded.some((p) => p.startsWith("e2e/")), "e2e/ Playwright exclu");
  assert.ok(!sim.kept.some((p) => p.startsWith("e2e/")));

  // Paths that may not exist locally but rules must ignore them if present
  for (const prefix of ["playwright-report/", "test-results/", "coverage/"]) {
    assert.ok(
      !sim.kept.some((p) => p.startsWith(prefix)),
      `${prefix} ne doit pas être conservé`,
    );
  }

  // Runtime e2e must NOT be under excluded
  assert.ok(
    !sim.excluded.some((p) => p.startsWith("src/infrastructure/e2e/")),
    "src/infrastructure/e2e ne doit pas être exclu",
  );
});

test("simulation upload — configs et migrations conservées", () => {
  const sim = simulateVercelUpload(studioRoot);
  for (const rel of [
    "next.config.ts",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "file-tracing.ts",
  ]) {
    assert.ok(sim.kept.includes(rel), rel);
  }
  const migrations = sim.kept.filter((p) =>
    p.startsWith("supabase/migrations/"),
  );
  assert.ok(migrations.length >= 20, `migrations conservées: ${migrations.length}`);
});

test("staging temporaire — modules requis présents, Playwright absent", () => {
  const sim = simulateVercelUpload(studioRoot);
  const { stagingRoot, fileCount } = stageSimulatedUpload(sim);
  try {
    const absStaging = resolve(stagingRoot);
    const absTmp = resolve(tmpdir());
    assert.ok(absStaging.startsWith(absTmp));
    assert.ok(absStaging.includes("vh-vercel-upload-"));
    assert.ok(!absStaging.startsWith(resolve(studioRoot)));
    assert.ok(!absStaging.startsWith(resolve(studioRoot, "..")));
    assert.ok(fileCount > 100);

    for (const rel of REQUIRED_RUNTIME_E2E_MODULES) {
      assert.ok(
        existsSync(join(absStaging, rel)),
        `staging manque ${rel}`,
      );
    }
    assert.ok(existsSync(join(absStaging, "next.config.ts")));
    assert.ok(existsSync(join(absStaging, "package.json")));
    assert.ok(!existsSync(join(absStaging, "e2e")));
  } finally {
    cleanupStaging(stagingRoot);
    assert.ok(!existsSync(stagingRoot));
  }
});

test("règle ambiguë e2e — assertVercelIgnoreRulesSafe échoue", () => {
  assert.throws(
    () => assertVercelIgnoreRulesSafe(["e2e", "/playwright-report/"]),
    /interdite|non ancrée|trop large/i,
  );
  assert.throws(
    () => assertVercelIgnoreRulesSafe(["/playwright-report/"]),
    /\/e2e\//,
  );
});
