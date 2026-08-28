import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildLipsyncSectionView } from "@/app/director/_components/lipsync-section-view";
import { buildMergeExportSectionView } from "@/app/director/_components/merge-export-section-view";
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
import { isPublicPath } from "@/proxy";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  DIRECTOR_API_ROUTE_FILES,
  DIRECTOR_PERSISTENCE_ROUTES,
  DIRECTOR_UI_ONLY_AUDIENCE,
  PERSISTENCE_HARDENING_GAPS,
  PERSISTENCE_ISOLATED_FLAGS,
  PERSISTENCE_MUST_STAY_OFF_FLAGS,
  PERSISTENCE_QUOTA,
  PERSISTENCE_ROLLBACK,
  PERSISTENCE_SCHEMA,
  PERSISTENCE_VERDICT,
  PERSISTENCE_WRITE_MATRIX,
  PHASE_186_AUTH,
  PHASE_186_NEXT_AUTH,
  STRICT_FLAG_FAIL_CLOSED_VALUES,
  STRICT_FLAG_ON_VALUES,
  buildIsolatedPersistenceEnv,
  evaluateDirectorAudience,
  evaluatePersistencePreflight,
} from "../persistence-production-enablement-preflight";

const here = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(here, "..", "..", "..", "..");

function readStudio(rel: string): string {
  return readFileSync(join(studioRoot, rel), "utf8");
}

test("parseur réel — seul 1/true allume un flag", () => {
  for (const raw of STRICT_FLAG_FAIL_CLOSED_VALUES) {
    assert.equal(parseStrictEnabledFlag(raw), false, String(raw));
  }
  for (const raw of STRICT_FLAG_ON_VALUES) {
    assert.equal(parseStrictEnabledFlag(raw), true, raw);
  }
});

test("persistence isolée — UI + persistence ON ; paid / AI / worker OFF", () => {
  const env = buildIsolatedPersistenceEnv();
  assert.equal(env[PERSISTENCE_ISOLATED_FLAGS[0]], "1");
  assert.equal(env[PERSISTENCE_ISOLATED_FLAGS[1]], "1");
  assert.equal(isDirectorV2Enabled(env), true);
  assert.equal(canUseDirectorV2Persistence(env), true);
  assert.equal(canExecutePaidGeneration(env), false);
  assert.equal(canExecuteMarketingAi(env), false);
  assert.equal(canExecuteCreativeAi(env), false);
  assert.equal(canExecuteScriptAi(env), false);
  assert.equal(canExecuteArtAi(env), false);
  assert.equal(canExecuteStoryboardAi(env), false);
  const evaled = evaluatePersistencePreflight(env);
  assert.equal(evaled.verdict, PERSISTENCE_VERDICT.blockedHardening);
  assert.equal(evaled.schemaReady, true);
  assert.equal(evaled.mergeExportAuthorized, false);
  assert.deepEqual(evaled.flagsOnThatMustStayOff, []);
  assert.ok(evaled.hardeningGaps.length >= 8);
});

test("refus si un flag payant/média/E2E manque à l’inventaire OFF", () => {
  for (const name of PERSISTENCE_MUST_STAY_OFF_FLAGS) {
    const evaled = evaluatePersistencePreflight(
      buildIsolatedPersistenceEnv({ [name]: "1" }),
    );
    assert.equal(evaled.verdict, PERSISTENCE_VERDICT.blockedHardening, name);
    assert.ok(evaled.flagsOnThatMustStayOff.includes(name), name);
  }
});

test("audience — session studio partagée ; aucun rôle admin", () => {
  const audience = evaluateDirectorAudience();
  assert.deepEqual(audience, DIRECTOR_UI_ONLY_AUDIENCE);
  const proxy = readStudio("src/proxy.ts");
  assert.match(proxy, /Fail-closed shared-password gate/);
  assert.doesNotMatch(proxy, /isAdmin|role === ["']admin["']|operatorRole/);
  assert.equal(isPublicPath("/director", "GET"), false);
  assert.equal(isPublicPath("/api/director/projects", "GET"), false);
});

test("25 routes Director ont le guard canUseDirectorV2Persistence", () => {
  assert.equal(DIRECTOR_API_ROUTE_FILES.length, 25);
  assert.equal(DIRECTOR_PERSISTENCE_ROUTES.length, 25);
  for (const rel of DIRECTOR_API_ROUTE_FILES) {
    const src = readStudio(rel);
    assert.match(src, /canUseDirectorV2Persistence/, rel);
  }
});

test("helper canonique — conjonction UI ∧ persistence", () => {
  const flags = readStudio("src/infrastructure/config/feature-flags.ts");
  assert.match(
    flags,
    /isDirectorV2Enabled\(env\) && isDirectorV2PersistenceEnabled\(env\)/,
  );
  assert.equal(canUseDirectorV2Persistence({ DIRECTOR_V2_ENABLED: "1" }), false);
  assert.equal(
    canUseDirectorV2Persistence({ DIRECTOR_V2_PERSISTENCE_ENABLED: "1" }),
    false,
  );
});

test("pages — create / list / :id uniquement si persistence", () => {
  const home = readStudio("src/app/director/page.tsx");
  assert.match(home, /canUseDirectorV2Persistence/);
  const wizard = readStudio("src/app/director/_components/brief-wizard.tsx");
  assert.match(wizard, /Créer le projet/);
  assert.match(wizard, /createIdsRef/);
  const projectPage = readStudio("src/app/director/[projectId]/page.tsx");
  assert.match(projectPage, /canUseDirectorV2Persistence/);
  assert.match(projectPage, /notFound\(\)/);
});

test("hardening — production execute n’est pas gated worker/paid", () => {
  const start = readStudio("src/application/directors/production/start-for-project.ts");
  assert.doesNotMatch(start, /canExecutePaidGeneration/);
  assert.doesNotMatch(start, /isDirectorV2WorkerEnabled/);
  const route = readStudio("src/app/api/director/projects/[projectId]/production/route.ts");
  assert.doesNotMatch(route, /canExecutePaidGeneration/);
  assert.match(route, /canUseDirectorV2Persistence/);
});

test("hardening 187 — prompt/routing execute n’est plus readiness seule", () => {
  const prompt = readStudio("src/application/directors/prompt/build-for-project.ts");
  assert.match(prompt, /authorizeDirectorAction/);
  assert.match(prompt, /canExecuteSyntheticDirectorPipeline/);
  const routing = readStudio("src/application/directors/routing/route-for-project.ts");
  assert.match(routing, /authorizeDirectorAction/);
  assert.match(routing, /canExecuteSyntheticDirectorPipeline/);
});

test("hardening 187 — download et motion sont gardés", () => {
  const download = readStudio(
    "src/app/api/director/projects/[projectId]/export/download/route.ts",
  );
  assert.match(download, /authorizeDirectorAction/);
  const motion = readStudio(
    "src/app/api/director/projects/[projectId]/motion/review/route.ts",
  );
  assert.match(motion, /isLocalMotionReviewHarness/);
  assert.doesNotMatch(motion, /NODE_ENV === ["']test["']/);
});

test("hardening 187 — Storage durable n’est plus allumé par persistence seule", () => {
  const backend = readStudio("src/infrastructure/config/asset-content-backend.ts");
  assert.doesNotMatch(backend, /if \(canUseDirectorV2Persistence\(env\)\) return true;/);
  assert.match(backend, /DIRECTOR_V2_E2E_ASSET_STORAGE/);
});

test("création — Zod strict, expectedBriefRevision=1, IDs UUID", () => {
  const route = readStudio("src/app/api/director/projects/route.ts");
  assert.match(route, /expectedBriefRevision: z\.literal\(1\)/);
  assert.match(route, /projectId: z\.string\(\)\.uuid\(\)/);
  assert.match(route, /actor: \{ type: "shared_password"/);
});

test("lifecycle client — pas de DELETE projet ; blockers create/revise", () => {
  const files = DIRECTOR_API_ROUTE_FILES.map((rel) => readStudio(rel)).join("\n");
  assert.doesNotMatch(files, /export async function DELETE/);
  const wizard = readStudio("src/app/director/_components/brief-wizard.tsx");
  assert.match(wizard, /directorProjectCreate/);
  const brief = readStudio("src/app/director/_components/brief-section.tsx");
  assert.match(brief, /directorBriefRevision/);
});

test("idempotence / CAS — create replay + revise expected revisions", () => {
  const create = readStudio("src/application/projects/create-director-project.ts");
  assert.match(create, /existing|created/);
  const reviseRoute = readStudio(
    "src/app/api/director/projects/[projectId]/brief/revisions/route.ts",
  );
  assert.match(reviseRoute, /expectedBriefRevision/);
  assert.match(reviseRoute, /expectedProjectRevision/);
});

test("Lipsync / Merge restent prepared_disabled · authorized=false", () => {
  const lipsync = buildLipsyncSectionView({
    videoResolved: true,
    audioResolved: true,
    runtimeOff: true,
  });
  const merge = buildMergeExportSectionView({
    videoResolved: true,
    audioResolved: true,
    lipsyncResolved: true,
    runtimeOff: true,
  });
  assert.equal(lipsync.mergeExportAuthorized, false);
  assert.equal(merge.mergeExportAuthorized, false);
  assert.equal(merge.publicationAllowed, false);
});

test("matrice écritures — seule la base persistence est autorisable", () => {
  const allowed = PERSISTENCE_WRITE_MATRIX.filter(
    (w) => w.authorizedInFuturePersistenceOnly,
  );
  assert.ok(allowed.every((w) => w.category === "base_persistence"));
  assert.ok(
    PERSISTENCE_WRITE_MATRIX.some(
      (w) => w.category === "fake_pipeline" && w.authorizedInFuturePersistenceOnly === false,
    ),
  );
  for (const row of DIRECTOR_PERSISTENCE_ROUTES) {
    assert.equal(row.persistenceGuard, true, row.route);
    assert.equal(row.providerPossibleIfIsolated, false, row.route);
  }
});

test("quotas — 120 mutations/IP ; GET non limité ; pas de quota create", () => {
  assert.equal(RATE_LIMITS.director.limit, PERSISTENCE_QUOTA.directorMutationsPerIp);
  assert.equal(RATE_LIMITS.director.windowMs, PERSISTENCE_QUOTA.directorWindowMs);
  assert.equal(PERSISTENCE_QUOTA.createQuota, "none");
  assert.equal(PERSISTENCE_QUOTA.sufficientForSharedPasswordAbuse, false);
});

test("schéma — pas de nouvelle migration ; RideCloud non requise", () => {
  assert.equal(PERSISTENCE_SCHEMA.localMigrations, 33);
  assert.equal(PERSISTENCE_SCHEMA.remoteMigrationsExpected, 32);
  assert.equal(PERSISTENCE_SCHEMA.newMigrationRequired, false);
  assert.match(PERSISTENCE_SCHEMA.ridecloudLocalOnly, /ridecloud_bind_artifact_kinds/);
  const staticMigrations = readStudio("src/infrastructure/db/__tests__/migrations-static.test.ts");
  assert.match(staticMigrations, /33 versions local/);
});

test("rollback logique — flag OFF · projets conservés · UI-only reste", () => {
  assert.equal(PERSISTENCE_ROLLBACK.existingProjectsPreserved, true);
  assert.equal(PERSISTENCE_ROLLBACK.noAutomaticDeletion, true);
  assert.equal(PERSISTENCE_ROLLBACK.directorUiOnlyRemainsOn, true);
  assert.equal(PERSISTENCE_ROLLBACK.providersRemainOff, true);
});

test("Auth 186 consommée — prochaine porte = hardening, pas flag write", () => {
  assert.match(PHASE_186_AUTH, /NO_FLAG_WRITE/);
  assert.match(PHASE_186_AUTH, /NO_PRODUCTION_WRITE/);
  assert.match(PHASE_186_NEXT_AUTH, /HARDENING_IMPLEMENT/);
  assert.match(PHASE_186_NEXT_AUTH, /NO_FLAG_WRITE/);
});

test("gaps de hardening sont nommés et non vides", () => {
  assert.ok(PERSISTENCE_HARDENING_GAPS.includes("production_execute_can_reserve_budget_without_worker_paid"));
  assert.ok(PERSISTENCE_HARDENING_GAPS.includes("existing_production_projects_become_listable_and_pipeline_reachable"));
});
