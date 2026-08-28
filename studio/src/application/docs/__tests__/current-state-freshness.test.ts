/**
 * Living handover freshness checker — no provider, no Production.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..", "..");
const scriptUrl = pathToFileURL(
  join(repoRoot, "studio", "scripts", "check-current-state-freshness.mjs"),
).href;

async function loadMod() {
  return import(scriptUrl);
}

const MINIMAL = `<!-- CURRENT_STATE_MARKERS
verifiedAt=2026-08-14T11:50:00+02:00
documentedHead=e4c3de3
headStatus=pending commit
lastPhaseReport=113_PHASE_11A_STRIP_OVERLAY_COPY_FROM_IMAGE_VARIANT.md
nextPhase=AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT
budgetHard=274
budgetCommitted=248
budgetReserved=0
budgetAvailable=26
runtimePaidMedia=OFF
unitTests=1572/1572
globalStatus=READY_FOR_NEW_TEXT_FREE_IMAGE_RETRY_PREFLIGHT
-->

# Virtual Humans Studio V2 — Current State and Resume
`;

test("freshness — living file parses and required markers present", async () => {
  const mod = await loadMod();
  const markdown = readFileSync(
    join(repoRoot, "docs", "Developer-Handover", "CURRENT_STATE_AND_RESUME.md"),
    "utf8",
  );
  const markers = mod.parseCurrentStateMarkers(markdown);
  assert.equal(
    markers.nextPhase,
    "AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_RECHECK_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER",
  );
  assert.equal(markers.budgetHard, "437");
  assert.equal(markers.runtimePaidMedia, "OFF");
  assert.match(markers.unitTests, /^\d+\/\d+$/);
});

test("freshness — pending commit accepts documented HEAD or parent", async () => {
  const mod = await loadMod();
  const result = mod.evaluateFreshness({
    markdown: MINIMAL,
    repoRoot,
    gitHead: "aaaaaaaaaaaaaaaa",
    gitParent: "e4c3de3279aaaefc4db46cbfac00ac9e79d298f8",
    readme: "see CURRENT_STATE_AND_RESUME.md",
  });
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("freshness — synced HEAD mismatch fails", async () => {
  const mod = await loadMod();
  const markdown = MINIMAL.replace("pending commit", "synced");
  const result = mod.evaluateFreshness({
    markdown,
    repoRoot,
    gitHead: "deadbeefdeadbeef",
    gitParent: "e4c3de3",
    readme: "CURRENT_STATE_AND_RESUME.md",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e: string) => /documentedHead/.test(e)));
});

test("freshness — missing nextPhase and secret-like prompt URL fail", async () => {
  const mod = await loadMod();
  const markdown = MINIMAL.replace(
    "nextPhase=AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT",
    "nextPhase=",
  ).concat("\nhttps://example.com/file?token=supersecrettokenvalue\n");
  const result = mod.evaluateFreshness({
    markdown,
    repoRoot,
    gitHead: "e4c3de3",
    readme: "CURRENT_STATE_AND_RESUME.md",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e: string) => /nextPhase|marker missing/.test(e)));
  assert.ok(result.errors.some((e: string) => /secret-like/.test(e)));
});

test("freshness — 00_README must index the living file", async () => {
  const mod = await loadMod();
  const result = mod.evaluateFreshness({
    markdown: MINIMAL,
    repoRoot,
    gitHead: "e4c3de3",
    readme: "# no index here",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e: string) => /00_README/.test(e)));
});

test("freshness — living file has no secret-like hits", async () => {
  const mod = await loadMod();
  const markdown = readFileSync(
    join(repoRoot, "docs", "Developer-Handover", "CURRENT_STATE_AND_RESUME.md"),
    "utf8",
  );
  assert.deepEqual(mod.findSecretHits(markdown), []);
});
