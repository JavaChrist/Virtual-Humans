import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildIsolatedPersistenceEnv } from "../persistence-production-enablement-preflight";
import {
  DIRECTOR_CAPABILITY_DISABLED_CODE,
  DIRECTOR_ROUTE_CATALOG,
  DIRECTOR_ROUTES_CLASSIFIED,
  assertDirectorRoutesFullyClassified,
  authorizeDirectorAction,
  classifyDirectorAction,
  directorLocalExecutionEnv,
  isLocalMotionReviewHarness,
} from "../director-action-policy";
import { canUseDurableAssetContent } from "@/infrastructure/config/asset-content-backend";
import { rateLimitPolicyFor } from "@/proxy";
import { RATE_LIMITS } from "@/lib/rate-limit";

const here = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(here, "..", "..", "..", "..");

test("catalogue — 25 routes classées, 0 non classée", () => {
  const audit = assertDirectorRoutesFullyClassified();
  assert.equal(DIRECTOR_ROUTES_CLASSIFIED, 25);
  assert.equal(DIRECTOR_ROUTE_CATALOG.length, 25);
  assert.equal(audit.classified, 25);
  assert.equal(audit.unclassified, 0);
  assert.deepEqual(audit.missingFiles, []);
});

test("route inconnue refusée fail-closed", () => {
  const isolated = buildIsolatedPersistenceEnv();
  const denied = authorizeDirectorAction(
    { routeId: "unknown_route", method: "POST", mode: "execute" },
    isolated,
  );
  assert.equal(denied.allowed, false);
  if (denied.allowed) return;
  assert.equal(denied.category, "UNCLASSIFIED");
  assert.equal(denied.status, 503);
});

test("base read/write autorisées avec persistence seule", () => {
  const isolated = buildIsolatedPersistenceEnv();
  const reads = [
    { routeId: "projects", method: "GET" },
    { routeId: "project_get", method: "GET" },
    { routeId: "brief_revisions", method: "GET" },
    { routeId: "brief_compare", method: "GET" },
    { routeId: "stale", method: "GET" },
    { routeId: "text_runs", method: "GET" },
    { routeId: "marketing", method: "GET" },
    { routeId: "prompts", method: "POST", mode: "dry-run" },
    { routeId: "routing", method: "GET" },
    { routeId: "production", method: "GET" },
    { routeId: "merge", method: "GET" },
    { routeId: "export", method: "GET" },
    { routeId: "export_manifest", method: "GET" },
    { routeId: "quality", method: "GET" },
    { routeId: "motion_review", method: "GET" },
  ];
  for (const row of reads) {
    const d = authorizeDirectorAction(row, isolated);
    assert.equal(d.allowed, true, JSON.stringify(row));
    if (d.allowed) assert.equal(d.category, "PERSISTENCE_BASE_READ");
  }
  const writes = [
    { routeId: "projects", method: "POST" },
    { routeId: "brief_revisions", method: "POST" },
    { routeId: "production_cancel", method: "POST" },
    { routeId: "approvals", method: "POST", mode: "approve_text" },
  ];
  for (const row of writes) {
    const d = authorizeDirectorAction(row, isolated);
    assert.equal(d.allowed, true, JSON.stringify(row));
    if (d.allowed) assert.equal(d.category, "PERSISTENCE_BASE_WRITE");
  }
});

test("capability execution refusée avec persistence seule", () => {
  const isolated = buildIsolatedPersistenceEnv();
  const executions = [
    { routeId: "marketing", method: "POST", mode: "execute" },
    { routeId: "marketing_retry", method: "POST" },
    { routeId: "creative", method: "POST", mode: "execute" },
    { routeId: "script", method: "POST", mode: "execute" },
    { routeId: "art", method: "POST", mode: "execute" },
    { routeId: "art_retry", method: "POST" },
    { routeId: "storyboard", method: "POST", mode: "execute" },
    { routeId: "prompts", method: "POST", mode: "execute" },
    { routeId: "routing", method: "POST", mode: "execute" },
    { routeId: "production", method: "POST", mode: "execute" },
    { routeId: "merge", method: "POST", mode: "execute" },
    { routeId: "export", method: "POST", mode: "execute" },
    { routeId: "quality", method: "POST", mode: "execute" },
    { routeId: "quality_review", method: "POST", mode: "review" },
    { routeId: "motion_review", method: "POST", mode: "review" },
    { routeId: "approvals", method: "POST", mode: "approve_generation_plan" },
  ];
  for (const row of executions) {
    const d = authorizeDirectorAction(row, isolated);
    assert.equal(d.allowed, false, JSON.stringify(row));
    if (d.allowed) continue;
    assert.equal(d.category, "CAPABILITY_EXECUTION");
    assert.equal(d.status, 503);
    assert.equal(d.code, DIRECTOR_CAPABILITY_DISABLED_CODE);
    assert.doesNotMatch(d.publicMessage, /DIRECTOR_|VHS11|flag|OpenAI|fal/i);
  }
});

test("media delivery refusée avec persistence seule", () => {
  const isolated = buildIsolatedPersistenceEnv();
  const d = authorizeDirectorAction(
    { routeId: "export_download", method: "GET", mode: "download" },
    isolated,
  );
  assert.equal(d.allowed, false);
  if (d.allowed) return;
  assert.equal(d.category, "MEDIA_DELIVERY");
  assert.equal(d.status, 404);
});

test("readiness / artifacts / NODE_ENV=test / credentials n’autorisent pas l’exécution", () => {
  const hostile = buildIsolatedPersistenceEnv({
    NODE_ENV: "test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-real",
  });
  assert.equal(
    authorizeDirectorAction(
      { routeId: "prompts", method: "POST", mode: "execute" },
      hostile,
    ).allowed,
    false,
  );
  assert.equal(
    authorizeDirectorAction(
      { routeId: "production", method: "POST", mode: "execute" },
      hostile,
    ).allowed,
    false,
  );
  assert.equal(canUseDurableAssetContent(hostile), false);
  assert.equal(isLocalMotionReviewHarness(hostile), false);
  assert.equal(
    isLocalMotionReviewHarness({
      NODE_ENV: "test",
      MOTION_TRANSFER_FAKE_HARNESS: "0",
    }),
    false,
  );
});

test("local execution env autorise le pipeline synthétique, pas le média Production", () => {
  const local = directorLocalExecutionEnv();
  assert.equal(
    authorizeDirectorAction(
      { routeId: "prompts", method: "POST", mode: "execute" },
      local,
    ).allowed,
    true,
  );
  assert.equal(
    authorizeDirectorAction(
      { routeId: "export_download", method: "GET" },
      local,
    ).allowed,
    true,
  );
  assert.equal(
    authorizeDirectorAction(
      { routeId: "export_download", method: "GET" },
      { ...local, VERCEL: "1", VERCEL_ENV: "production" },
    ).allowed,
    false,
  );
});

test("classify — chaque fichier route du catalogue existe", () => {
  for (const row of DIRECTOR_ROUTE_CATALOG) {
    const abs = join(studioRoot, row.file);
    const src = readFileSync(abs, "utf8");
    assert.ok(src.includes("export async function"), row.file);
    assert.ok(
      classifyDirectorAction(row.id, "GET") !== null ||
        classifyDirectorAction(row.id, "POST") !== null ||
        classifyDirectorAction(row.id, "POST", "execute") !== null,
      row.id,
    );
  }
});

test("rate limit create plus strict, GET non impacté", () => {
  const create = rateLimitPolicyFor("/api/director/projects", "POST");
  assert.ok(create);
  assert.equal(create?.keyPrefix, "director-create");
  assert.equal(create?.policy.limit, 20);
  const other = rateLimitPolicyFor("/api/director/projects/x/brief/revisions", "POST");
  assert.equal(other?.keyPrefix, "director");
  assert.equal(other?.policy.limit, RATE_LIMITS.director.limit);
  const get = rateLimitPolicyFor("/api/director/projects", "GET");
  assert.equal(get?.keyPrefix, "director");
});

test("copies home — pas de Directeurs actifs / absents", () => {
  const src = readFileSync(
    join(studioRoot, "src/app/director/_components/director-home.tsx"),
    "utf8",
  );
  assert.doesNotMatch(src, /Directeurs métier ne sont pas encore actifs/);
  assert.match(src, /peuvent être enregistrés/);
  assert.match(src, /génération restent indisponibles/);
  assert.match(src, /Consultable · génération indisponible/);
});
