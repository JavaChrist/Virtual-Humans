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
import {
  DIRECTOR_UI_ONLY_AUDIENCE,
  PHASE_184_NEXT_AUTH,
  STRICT_FLAG_FAIL_CLOSED_VALUES,
  STRICT_FLAG_ON_VALUES,
  UI_ONLY_ISOLATED_FLAG,
  UI_ONLY_MUST_STAY_OFF_FLAGS,
  UI_ONLY_SOURCE_GUARDS,
  UI_ONLY_SURFACE_MATRIX,
  UI_ONLY_VERDICT,
  UI_ONLY_WRITE_INVENTORY,
  buildIsolatedUiOnlyEnv,
  evaluateDirectorAudience,
  evaluateUiOnlyPreflight,
} from "../ui-only-production-enablement-preflight";

const here = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(here, "..", "..", "..", "..");

function readStudio(rel: string): string {
  return readFileSync(join(studioRoot, rel), "utf8");
}

test("parseur réel — seul 1/true allume un flag ; le reste est fail-closed", () => {
  for (const raw of STRICT_FLAG_FAIL_CLOSED_VALUES) {
    assert.equal(parseStrictEnabledFlag(raw), false, String(raw));
  }
  for (const raw of STRICT_FLAG_ON_VALUES) {
    assert.equal(parseStrictEnabledFlag(raw), true, raw);
  }
});

test("Director OFF aujourd’hui — route/nav masquées par le même parseur", () => {
  assert.equal(isDirectorV2Enabled({}), false);
  assert.equal(isDirectorV2Enabled({ DIRECTOR_V2_ENABLED: "0" }), false);
  assert.equal(canUseDirectorV2Persistence({ DIRECTOR_V2_ENABLED: "1" }), false);
});

test("UI-only isolé — DIRECTOR_V2_ENABLED seul ; persistence et paid restent OFF", () => {
  const env = buildIsolatedUiOnlyEnv();
  assert.equal(env[UI_ONLY_ISOLATED_FLAG], "1");
  assert.equal(isDirectorV2Enabled(env), true);
  assert.equal(canUseDirectorV2Persistence(env), false);
  assert.equal(canExecutePaidGeneration(env), false);
  assert.equal(canExecuteMarketingAi(env), false);
  assert.equal(canExecuteCreativeAi(env), false);
  assert.equal(canExecuteScriptAi(env), false);
  assert.equal(canExecuteArtAi(env), false);
  assert.equal(canExecuteStoryboardAi(env), false);
  const evaled = evaluateUiOnlyPreflight(env);
  assert.equal(evaled.verdict, UI_ONLY_VERDICT.readyForFlagAuth);
  assert.deepEqual(evaled.flagsOnThatMustStayOff, []);
  assert.equal(evaled.mergeExportAuthorized, false);
});

test("refus si un flag payant/média/persistence/E2E manque à l’inventaire OFF", () => {
  for (const name of UI_ONLY_MUST_STAY_OFF_FLAGS) {
    const evaled = evaluateUiOnlyPreflight(buildIsolatedUiOnlyEnv({ [name]: "1" }));
    assert.equal(evaled.verdict, UI_ONLY_VERDICT.blockedHardening, name);
    assert.ok(evaled.flagsOnThatMustStayOff.includes(name), name);
  }
});

test("audience réelle — session studio partagée ; aucun rôle admin/opérateur", () => {
  const audience = evaluateDirectorAudience();
  assert.equal(audience.unauthenticated, "redirect_login");
  assert.equal(audience.authenticatedStandard, "shared_studio_session");
  assert.equal(audience.adminOperatorRole, "does_not_exist");
  assert.equal(audience.otherCodedAudience, "none");
  assert.equal(audience.sameAsCharactersSettingsBudget, true);
  assert.deepEqual(audience, DIRECTOR_UI_ONLY_AUDIENCE);
  const proxy = readStudio("src/proxy.ts");
  assert.match(proxy, /Fail-closed shared-password gate/);
  assert.doesNotMatch(proxy, /isAdmin|role === ["']admin["']|operatorRole/);
  assert.equal(isPublicPath("/director", "GET"), false);
  assert.equal(isPublicPath("/login", "GET"), true);
});

test("guards sources — layout, nav, settings, persistence, proxy", () => {
  const layout = readStudio("src/app/director/layout.tsx");
  assert.match(layout, new RegExp(UI_ONLY_SOURCE_GUARDS.layoutGate.replace(/[()!]/g, "\\$&")));
  const nav = readStudio("src/components/nav.tsx");
  assert.match(nav, /s\.features\?\.directorV2/);
  const settings = readStudio("src/app/api/settings/route.ts");
  assert.match(settings, /features: getFeatureFlags\(\)/);
  const flags = readStudio("src/infrastructure/config/feature-flags.ts");
  assert.match(flags, /isDirectorV2Enabled\(env\) && isDirectorV2PersistenceEnabled\(env\)/);
  const proxy = readStudio("src/proxy.ts");
  assert.doesNotMatch(proxy, /pathname === ["']\/director["']/);
  const worker = readStudio("src/infrastructure/worker/index.ts");
  assert.match(worker, /No auto-start\. No HTTP\. No cron\./);
});

test("projet et APIs inaccessibles sans persistence — sources", () => {
  const projectPage = readStudio("src/app/director/[projectId]/page.tsx");
  assert.match(projectPage, /canUseDirectorV2Persistence/);
  assert.match(projectPage, /notFound\(\)/);
  const projectsApi = readStudio("src/app/api/director/projects/route.ts");
  assert.match(projectsApi, /canUseDirectorV2Persistence/);
  const home = readStudio("src/app/director/page.tsx");
  assert.match(home, /if \(persistenceEnabled\)/);
  const wizard = readStudio("src/app/director/_components/brief-wizard.tsx");
  assert.match(wizard, /Créer le projet/);
  assert.match(wizard, /!persistenceEnabled && finalBrief/);
  assert.match(wizard, /Analyse marketing — prochainement/);
});

test("Lipsync et Merge/Export restent prepared_disabled · mergeExportAuthorized=false", () => {
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
  assert.equal(lipsync.readiness, "prepared_disabled");
  assert.equal(lipsync.providerExposed, false);
  assert.equal(lipsync.mergeExportAuthorized, false);
  assert.equal(merge.mergeReadiness, "prepared_disabled");
  assert.equal(merge.exportReadiness, "prepared_disabled");
  assert.equal(merge.engineExposed, false);
  assert.equal(merge.mergeExportAuthorized, false);
  assert.equal(merge.publicationAllowed, false);
});

test("matrice surfaces — aucune action réelle ni provider", () => {
  assert.ok(UI_ONLY_SURFACE_MATRIX.length >= 8);
  for (const row of UI_ONLY_SURFACE_MATRIX) {
    assert.equal(row.providerPossible, false, row.surface);
    assert.equal(row.costPossible, false, row.surface);
    assert.equal(row.mediaPossible, false, row.surface);
    assert.notEqual(row.effectiveGuard, "", row.surface);
  }
  const writes = UI_ONLY_WRITE_INVENTORY.filter((w) => w.authorizedInIsolatedUiOnly);
  assert.deepEqual(
    writes.map((w) => w.write),
    ["Brouillon brief"],
  );
  assert.ok(
    UI_ONLY_WRITE_INVENTORY.some(
      (w) => w.write === "Création projet Director" && w.authorizedInIsolatedUiOnly === false,
    ),
  );
});

test("future Auth flag nommée — pas exécutée ici", () => {
  assert.match(PHASE_184_NEXT_AUTH, /FLAG_WRITE_ONCE/);
  assert.match(PHASE_184_NEXT_AUTH, /NO_PROVIDER/);
  assert.match(PHASE_184_NEXT_AUTH, /NO_PERSISTENCE/);
  assert.match(PHASE_184_NEXT_AUTH, /NO_RUNTIME/);
});

test("refus si un guard source manque", () => {
  const layout = readStudio("src/app/director/layout.tsx");
  if (!layout.includes("isDirectorV2Enabled")) {
    assert.equal(evaluateUiOnlyPreflight(buildIsolatedUiOnlyEnv()).verdict, UI_ONLY_VERDICT.blockedHardening);
  }
  assert.match(layout, /isDirectorV2Enabled/);
});
