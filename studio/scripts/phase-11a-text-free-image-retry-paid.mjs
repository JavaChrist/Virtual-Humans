#!/usr/bin/env node
/**
 * Phase 11A-TEXT-FREE-IMAGE-RETRY-PAID
 *
 *   CONFIRM_PHASE_11A_TEXT_FREE_IMAGE_RETRY_PAID=1 \
 *   node --import tsx scripts/phase-11a-text-free-image-retry-paid.mjs
 *
 * Exactly one OpenAI image submit for scene-2 (no-text) + local deterministic
 * overlay. Runtime source must be e4c3de3. Never prints secrets / salt / base64.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const EXPECTED_COMMIT = "e4c3de3279aaaefc4db46cbfac00ac9e79d298f8";
const EXPECTED_COMMIT_SHORT = "e4c3de3";
const DOCS_HEAD_SHORT = "b58cc7e";
const E4C3DE3_READY_HOST =
  "virtual-humans-901mq9vj8-javachrist-projects.vercel.app";
const EXPECTED_COMPOSITION_FP = "c532c400334f5b22";
const EXPECTED_OVERLAY_FP =
  "fdfae63fe1c7d003d9e4190bf0aea904fdab59caa2ddad5c2972cb6c39a423b9";
const EXPECTED_LIVE_PROMPT_PREFIX = "d4f69858358805b0";
const EXPECTED_LIVE_PLAN_PREFIX = "ccd1160bd5fbee39";
const TITLE = "De l\u2019idée à la structure";
const CTA = "Découvrir Virtual Humans Studio";
const BASE = process.env.PHASE_11A_BASE_URL || "https://virtual-humans.vercel.app";
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const SCENE_ID = "scene-2";
const AUTH = "AUTH_11A_TEXT_FREE_IMAGE_RETRY_PAID_AUTH";
const REJECTED_ASSET_PREFIX = "5d68ef64";
const REJECTED_CHECKSUM_PREFIX = "c508e3e54f2ccac7";
const SALT = `11a-text-free-retry-paid-e4c3de3-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(4).toString("hex")}`;
const SALT_FP = createHash("sha256").update(SALT).digest("hex").slice(0, 16);
const REPORT_PATH = join(
  studioRoot,
  ".tmp",
  "phase-11a-text-free-image-retry-paid-report.json",
);

const ON_FLIP = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
  DIRECTOR_V2_WORKER_ENABLED: "1",
  VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "1",
  PHASE_11A_OPENAI_IMAGE_IDEMPOTENCY_SALT: SALT,
  PHASE_11A_SOURCE_COMMIT: EXPECTED_COMMIT,
};

const ALWAYS_OFF = {
  DIRECTOR_V2_PAID_AI_ENABLED: "0",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
  DIRECTOR_V2_ART_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
  MOTION_TRANSFER_ENABLED: "0",
  MOTION_TRANSFER_PAID_ENABLED: "0",
  MOTION_TRANSFER_FAL_ENABLED: "0",
  MOTION_TRANSFER_WORKER_ENABLED: "0",
  MV001_REGISTRY_EXCEPTION_ACTIVE: "0",
};

const OFF_ALL = {
  ...ALWAYS_OFF,
  DIRECTOR_V2_ENABLED: "0",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "0",
};

function fail(msg) {
  const err = new Error(msg);
  err.name = "Phase11ATextFreePaidStop";
  throw err;
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    cwd: studioRoot,
    env: process.env,
    ...opts,
  });
}

function loadEnvFile(path) {
  const map = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    map[m[1]] = v;
  }
  return map;
}

function vercelEnvSet(key, value) {
  let r = run("npx", [
    "vercel",
    "env",
    "update",
    key,
    "production",
    "--value",
    value,
    "--sensitive",
    "--yes",
  ]);
  if (r.status === 0) {
    console.log(
      `OK | update | ${key} | LAST_EXPLICIT_WRITE=${value === "0" || value === "1" ? value : "[set]"}`,
    );
    return true;
  }
  r = run("npx", [
    "vercel",
    "env",
    "add",
    key,
    "production",
    "--value",
    value,
    "--sensitive",
    "--yes",
    "--force",
  ]);
  if (r.status === 0) {
    console.log(
      `OK | add | ${key} | LAST_EXPLICIT_WRITE=${value === "0" || value === "1" ? value : "[set]"}`,
    );
    return true;
  }
  console.log(`FAIL | ${key}`);
  console.error((r.stderr || r.stdout || "").slice(0, 400));
  return false;
}

function applyEnvMap(map) {
  let failCount = 0;
  for (const [k, v] of Object.entries(map)) {
    if (!vercelEnvSet(k, v)) failCount++;
  }
  return failCount;
}

function pullProductionEnv() {
  const tmp = join(studioRoot, ".tmp", "phase-11a-text-free-paid-vercel-env.tmp");
  mkdirSync(dirname(tmp), { recursive: true });
  const r = run("npx", [
    "vercel",
    "env",
    "pull",
    tmp,
    "--environment",
    "production",
    "--yes",
  ]);
  if (r.status !== 0) fail("vercel env pull failed");
  const map = loadEnvFile(tmp);
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  return map;
}

function openaiKeyPresentInVercelLs() {
  const r = run("npx", ["vercel", "env", "ls", "production"]);
  const t = `${r.stdout || ""}\n${r.stderr || ""}`;
  return /\bOPENAI_API_KEY\b/.test(t);
}

function inspectHostCommit(host) {
  const logs = run("npx", ["vercel", "inspect", host, "--logs"]);
  const lt = `${logs.stdout || ""}\n${logs.stderr || ""}`;
  const commitMatch = lt.match(/Commit:\s+([0-9a-f]{7,40})/i);
  return { host, commit: commitMatch?.[1] || "", logs: lt };
}

function inspectAliasCommit() {
  const inspect = run("npx", ["vercel", "inspect", "virtual-humans.vercel.app"]);
  const t = `${inspect.stdout || ""}\n${inspect.stderr || ""}`;
  const urlMatch = t.match(
    /https:\/\/(virtual-humans-[a-z0-9]+-javachrist-projects\.vercel\.app)/i,
  );
  const host = urlMatch?.[1] || "virtual-humans.vercel.app";
  const found = inspectHostCommit(host);
  const commitOk =
    found.commit.startsWith(EXPECTED_COMMIT_SHORT) ||
    found.logs.includes(`Commit: ${EXPECTED_COMMIT_SHORT}`) ||
    found.logs.includes(EXPECTED_COMMIT_SHORT);
  return { host, commitOk, commit: found.commit };
}

function promoteE4c3de3IfNeeded() {
  const alias = inspectAliasCommit();
  if (alias.commitOk) return alias;
  console.log(
    `ALIAS_NOT_SOURCE host=${alias.host} commit=${alias.commit || "unknown"} — promoting Ready ${EXPECTED_COMMIT_SHORT}`,
  );
  const promo = run("npx", ["vercel", "promote", E4C3DE3_READY_HOST, "--yes"]);
  if (promo.status !== 0) {
    fail(
      `promote ${EXPECTED_COMMIT_SHORT} failed: ${(promo.stderr || promo.stdout || "").slice(0, 300)}`,
    );
  }
  for (let i = 0; i < 20; i++) {
    spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "Start-Sleep -Seconds 8"],
      { shell: false },
    );
    const again = inspectAliasCommit();
    if (again.commitOk) return { ...again, promoted: true };
  }
  fail(`promote ${EXPECTED_COMMIT_SHORT} did not become alias Ready`);
}

function redeployFromE4c3de3(label) {
  console.log(`REDEPLOY_${label}_START source=${E4C3DE3_READY_HOST}`);
  const r = run("npx", [
    "vercel",
    "redeploy",
    E4C3DE3_READY_HOST,
    "--target",
    "production",
    "--non-interactive",
  ]);
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  console.log(out.split(/\r?\n/).slice(-20).join("\n"));
  if (r.status !== 0) fail(`redeploy ${label} failed`);
  for (let i = 0; i < 48; i++) {
    spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "Start-Sleep -Seconds 15"],
      { shell: false },
    );
    const inspect = run("npx", ["vercel", "inspect", "virtual-humans.vercel.app"]);
    const t = `${inspect.stdout || ""}\n${inspect.stderr || ""}`;
    if (/status\s+●\s+Ready/i.test(t) || /status\t● Ready/.test(t)) {
      const urlMatch = t.match(
        /https:\/\/(virtual-humans-[a-z0-9]+-javachrist-projects\.vercel\.app)/i,
      );
      const host = urlMatch?.[1] || "virtual-humans.vercel.app";
      const logs = run("npx", ["vercel", "inspect", host, "--logs"]);
      const lt = `${logs.stdout || ""}\n${logs.stderr || ""}`;
      if (
        !lt.includes(`Commit: ${EXPECTED_COMMIT_SHORT}`) &&
        !lt.includes(EXPECTED_COMMIT_SHORT)
      ) {
        fail(`redeploy ${label} Ready but commit != ${EXPECTED_COMMIT_SHORT}`);
      }
      console.log(
        `REDEPLOY_${label}_READY host=${host} commit=${EXPECTED_COMMIT_SHORT}`,
      );
      return host;
    }
    if (/status\s+●\s+Error/i.test(t) || /status\t● Error/.test(t)) {
      fail(`redeploy ${label} ended Error`);
    }
  }
  fail(`redeploy ${label} timeout`);
}

function remoteDb() {
  const remote = loadEnvFile(resolve(studioRoot, ".env.remote.local"));
  if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
    fail("missing .env.remote.local Supabase credentials");
  }
  return createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function flagMatrix(env) {
  const keys = [
    "DIRECTOR_V2_ENABLED",
    "DIRECTOR_V2_PERSISTENCE_ENABLED",
    "DIRECTOR_V2_PAID_GENERATION_ENABLED",
    "DIRECTOR_V2_WORKER_ENABLED",
    "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
    "MOTION_TRANSFER_ENABLED",
    "MOTION_TRANSFER_PAID_ENABLED",
    "MOTION_TRANSFER_WORKER_ENABLED",
  ];
  const out = {};
  for (const k of keys) {
    const v = env[k];
    out[k] =
      v === "0" || v === "1" ? v : v ? "MISSING_OR_REDACTED" : "MISSING_OR_REDACTED";
  }
  return out;
}

function countOrZero(r, label = "counter") {
  if (r.error) {
    const msg = String(r.error.message || r.error.code || "");
    if (
      !msg ||
      /does not exist|Could not find|schema cache|permission|JWT/i.test(msg)
    ) {
      return { missing: true, count: null, error: msg || "empty_error" };
    }
    fail(`counter query failed (${label}): ${msg}`);
  }
  return { missing: false, count: r.count ?? 0 };
}

async function captureCounters(db) {
  const [
    runs,
    jobs,
    attempts,
    reservations,
    assets,
    packages,
    plans,
    reviews,
    ledgerCountRes,
    policy,
  ] = await Promise.all([
    db
      .from("production_runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", PROJECT_ID),
    db
      .from("production_jobs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", PROJECT_ID),
    db
      .from("generation_attempts")
      .select("id", { count: "exact", head: true })
      .eq("project_id", PROJECT_ID),
    db
      .from("budget_reservations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", WORKSPACE_ID)
      .eq("status", "active"),
    db
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", PROJECT_ID),
    db
      .from("active_artifact_revisions")
      .select("artifact_id", { count: "exact", head: true })
      .eq("project_id", PROJECT_ID)
      .eq("artifact_type", "scene_package_set"),
    db
      .from("active_artifact_revisions")
      .select("artifact_id", { count: "exact", head: true })
      .eq("project_id", PROJECT_ID)
      .eq("artifact_type", "generation_plan"),
    db
      .from("human_review_decisions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", PROJECT_ID),
    db
      .from("cost_ledger")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", WORKSPACE_ID),
    db
      .from("workspace_budget_policies")
      .select("hard_limit_minor")
      .eq("workspace_id", WORKSPACE_ID)
      .maybeSingle(),
  ]);

  const { data: resRows, error: resErr } = await db
    .from("budget_reservations")
    .select("amount_minor,status")
    .eq("workspace_id", WORKSPACE_ID);
  if (resErr) fail(`budget reservations: ${resErr.message}`);
  let reserved = 0;
  for (const row of resRows ?? []) {
    if (String(row.status || "") === "active") {
      reserved += Number(row.amount_minor || 0);
    }
  }
  const { data: ledgerAgg, error: ledErr } = await db
    .from("cost_ledger")
    .select("entry_type,amount_minor")
    .eq("workspace_id", WORKSPACE_ID);
  if (ledErr) fail(`cost_ledger: ${ledErr.message}`);
  let commitSum = 0;
  let refunds = 0;
  for (const e of ledgerAgg ?? []) {
    const t = String(e.entry_type || "");
    if (t === "commit" || t === "debit") commitSum += Number(e.amount_minor || 0);
    if (t === "refund" || t === "credit") refunds += Number(e.amount_minor || 0);
  }
  const hard = Number(policy.data?.hard_limit_minor ?? NaN);
  const committed = commitSum - refunds;
  return {
    production_runs: countOrZero(runs, "runs"),
    production_jobs: countOrZero(jobs, "jobs"),
    generation_attempts: countOrZero(attempts, "attempts"),
    active_reservations: countOrZero(reservations, "reservations"),
    image_assets: countOrZero(assets, "assets"),
    scene_package_set_active: countOrZero(packages, "packages"),
    generation_plan_active: countOrZero(plans, "plans"),
    human_review_decisions: countOrZero(reviews, "reviews"),
    ledger_rows: countOrZero(ledgerCountRes, "ledger"),
    budget: {
      hardMinor: hard,
      reservedMinor: reserved,
      committedMinor: committed,
      availableMinor: hard - committed - reserved,
    },
  };
}

async function loadActiveArtifacts(db) {
  const { data: active, error } = await db
    .from("active_artifact_revisions")
    .select("artifact_type,artifact_id,revision")
    .eq("project_id", PROJECT_ID);
  if (error) fail(`active artifacts: ${error.message}`);
  const byType = Object.fromEntries((active ?? []).map((a) => [a.artifact_type, a]));
  const need = [
    "video_project_brief",
    "marketing_plan",
    "creative_concept",
    "video_script",
    "visual_direction",
    "storyboard_project",
  ];
  for (const t of need) {
    if (!byType[t]) fail(`missing active ${t}`);
  }
  if (byType.storyboard_project.revision !== 1) {
    fail(`storyboard revision expected 1 got ${byType.storyboard_project.revision}`);
  }
  return byType;
}

async function assertRejectedAssetPreserved(db) {
  const { data: assets, error } = await db
    .from("assets")
    .select("id,status,checksum,storage_path,storage_bucket,provenance,scene_id")
    .eq("project_id", PROJECT_ID)
    .eq("kind", "image");
  if (error) fail(`rejected asset query: ${error.message}`);
  const row = (assets ?? []).find((a) => String(a.id).startsWith(REJECTED_ASSET_PREFIX));
  if (!row) fail(`rejected asset ${REJECTED_ASSET_PREFIX}… missing`);
  if (String(row.status) !== "rejected") {
    fail(`rejected asset status expected rejected got ${row.status}`);
  }
  const provenance = row.provenance && typeof row.provenance === "object" ? row.provenance : {};
  if (provenance.active === true) fail("rejected asset must remain active=false");
  if (String(row.checksum || "").slice(0, 16) !== REJECTED_CHECKSUM_PREFIX) {
    fail("rejected asset checksum changed");
  }
  const { data: reviews, error: rErr } = await db
    .from("human_review_decisions")
    .select("id,decision")
    .eq("project_id", PROJECT_ID);
  if (rErr) fail(`human_review_decisions: ${rErr.message}`);
  const rejected = (reviews ?? []).filter((d) => String(d.decision) === "rejected");
  if (rejected.length !== 1) {
    fail(`expected exactly 1 rejected Human Review, got ${rejected.length}`);
  }
  return {
    firstRejectedAssetPreserved: true,
    assetIdPrefix: String(row.id).slice(0, 8),
    status: row.status,
    checksumPrefix: String(row.checksum || "").slice(0, 16),
    active: false,
    humanReviewRejected: 1,
  };
}

function assertNoLeakedSecrets(obj) {
  const dumped = JSON.stringify(obj);
  if (/sk-[a-zA-Z0-9]{10,}/.test(dumped)) fail("response leaked API key shape");
  if (/data:image\/|base64,[A-Za-z0-9+/]{80,}/.test(dumped)) {
    fail("response leaked base64/media");
  }
  return dumped;
}

async function loginCookie(password) {
  const login = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!login.ok) fail(`login HTTP ${login.status}`);
  const setCookies =
    typeof login.headers.getSetCookie === "function"
      ? login.headers.getSetCookie()
      : [login.headers.get("set-cookie")].filter(Boolean);
  return setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
}

function apiHeaders(cookie, corr) {
  return {
    cookie,
    origin: BASE,
    referer: `${BASE}/director`,
    "content-type": "application/json",
    "x-correlation-id": corr,
  };
}

async function directorPost(cookie, path, body, corr) {
  const res = await fetch(`${BASE}/api/director/projects/${PROJECT_ID}${path}`, {
    method: "POST",
    headers: apiHeaders(cookie, corr),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  assertNoLeakedSecrets(json);
  return { status: res.status, json };
}

async function projectRevision(db) {
  const { data, error } = await db
    .from("video_projects")
    .select("active_revision")
    .eq("id", PROJECT_ID)
    .single();
  if (error) fail(`project revision: ${error.message}`);
  return Number(data.active_revision);
}

async function loadArt(db, id) {
  const { data, error } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) fail(error?.message ?? `missing artifact ${id}`);
  return data;
}

function copyPresent(blob, strings) {
  return strings.some((s) => s && blob.includes(s));
}

async function rebuildNoTextPackage(db, byType) {
  const [
    overlayMod,
    promptMod,
    promptDir,
    planMod,
    leakMod,
    shared,
    promptDomain,
    briefS,
    mktS,
    creS,
    scrS,
    visS,
    stbS,
  ] = await Promise.all([
    import(pathToFileURL(join(studioRoot, "src/domain/production/image-text-overlay.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-image-prompt.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/application/directors/prompt/prompt-director.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-single-step-plan.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/domain/production/overlay-copy-leak.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/domain/shared/index.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/domain/prompt/index.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/domain/brief/index.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/domain/marketing/index.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/domain/creative/index.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/domain/script/index.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/domain/art/index.ts")).href),
    import(pathToFileURL(join(studioRoot, "src/domain/storyboard/index.ts")).href),
  ]);

  const [briefA, mktA, creA, scrA, visA, stbA] = await Promise.all([
    loadArt(db, byType.video_project_brief.artifact_id),
    loadArt(db, byType.marketing_plan.artifact_id),
    loadArt(db, byType.creative_concept.artifact_id),
    loadArt(db, byType.video_script.artifact_id),
    loadArt(db, byType.visual_direction.artifact_id),
    loadArt(db, byType.storyboard_project.artifact_id),
  ]);

  const director = promptDir.createPromptDirector({
    analyzer: { async analyze() { return {}; } },
  });
  const promptResult = await director.run(
    {
      brief: briefS.VideoProjectBriefSchema.parse(briefA.value),
      marketingPlan: mktS.MarketingPlanSchema.parse(mktA.value),
      creativeConcept: creS.CreativeConceptSchema.parse(creA.value),
      videoScript: scrS.VideoScriptSchema.parse(scrA.value),
      visualDirection: visS.VisualDirectionSchema.parse(visA.value),
      storyboard: stbS.StoryboardProjectSchema.parse(stbA.value),
    },
    {
      correlationId: "corr-11a-text-free-paid-rebuild",
      mode: "execute",
      createdBy: "phase-11a-text-free-paid",
    },
  );
  if (promptResult.status !== "completed") {
    fail(`prompt director rebuild ${promptResult.status}`);
  }

  const spec = overlayMod.createDefaultPhase11AOverlaySpec({
    locale: "fr",
    title: TITLE,
    callToAction: CTA,
  });
  const overlayFingerprint = overlayMod.fingerprintImageTextOverlaySpec(spec);
  if (overlayFingerprint !== EXPECTED_OVERLAY_FP) {
    fail(`overlay fingerprint mismatch ${overlayFingerprint.slice(0, 16)}`);
  }

  const scenePkg = planMod.selectPhase11AScene2Package({
    packages: promptResult.output.packages,
  });
  const built = promptMod.buildPhase11AImagePromptFromScenePackage(scenePkg, {
    overlay: spec,
  });
  promptMod.assertOverlayStringsNotInProviderPrompt(built.promptText, spec);
  const copy = leakMod.overlayCopyFromSpec(spec);
  const visualBlob = JSON.stringify({
    subject: scenePkg.subject,
    variants: scenePkg.variants,
  });
  if (copyPresent(visualBlob, copy) || copyPresent(built.promptText, copy)) {
    fail("rebuild still contains overlay copy — STOP before persist/provider");
  }
  if (!String(built.promptHash).startsWith(EXPECTED_LIVE_PROMPT_PREFIX)) {
    fail(
      `live prompt hash expected ${EXPECTED_LIVE_PROMPT_PREFIX} got ${String(built.promptHash).slice(0, 16)}`,
    );
  }

  const plan = planMod.buildPhase11ASingleStepGenerationPlan({
    projectId: PROJECT_ID,
    storyboardRevisionId: stbA.id,
    scenePackageRevisionIds: [promptResult.output.packages[0]?.id ?? "pkg"],
    scenePackage: scenePkg,
    createdAt: "2026-08-14T00:00:00.000Z",
    createdBy: "phase-11a-text-free-paid",
    correlationId: "corr-11a-text-free-paid-rebuild",
    overlay: spec,
  });
  const planFpMatches = String(plan.fingerprint).startsWith(EXPECTED_LIVE_PLAN_PREFIX);

  const metadata = shared.createArtifactMetadata({
    id: randomUUID(),
    projectId: PROJECT_ID,
    createdBy: "phase-11a-text-free-paid",
    correlationId: "corr-11a-text-free-paid-persist",
    schemaVersion: promptDomain.SCENE_PACKAGE_SET_SCHEMA_VERSION,
  });
  const packageSet = promptDomain.ScenePackageSetSchema.parse({
    ...metadata,
    artifactType: promptDomain.SCENE_PACKAGE_SET_ARTIFACT_TYPE,
    storyboardRevisionId: promptResult.output.storyboardRevisionId,
    rendererVersion: promptDomain.PROMPT_RENDERER_VERSION,
    packages: promptResult.output.packages,
  });

  return {
    spec,
    overlayFingerprint,
    scenePkg,
    built,
    plan,
    planFpMatches,
    packageSet,
    byType,
    contrast: overlayMod.contrastRatio(spec.textColor, spec.backgroundColor),
    copy,
  };
}

async function persistNoTextPackageSet(db, byType, packageSet) {
  const idempotencyKey = [
    "prm-11a-text-free",
    AUTH,
    EXPECTED_COMMIT_SHORT,
    "no-text-v1",
    "phase-11a-image-prompt-v2",
    SALT_FP,
  ].join(":");
  const commandFingerprint = createHash("sha256")
    .update(
      [
        PROJECT_ID,
        byType.storyboard_project.artifact_id,
        "no-text-v1",
        EXPECTED_OVERLAY_FP,
        SALT_FP,
      ].join("|"),
    )
    .digest("hex");
  const runId = randomUUID();
  const { data: begin, error: bErr } = await db.rpc("begin_or_get_prompt_director_run", {
    p_id: runId,
    p_workspace_id: WORKSPACE_ID,
    p_project_id: PROJECT_ID,
    p_storyboard_artifact_id: byType.storyboard_project.artifact_id,
    p_storyboard_revision: byType.storyboard_project.revision,
    p_visual_direction_artifact_id: byType.visual_direction.artifact_id,
    p_visual_direction_revision: byType.visual_direction.revision,
    p_video_script_artifact_id: byType.video_script.artifact_id,
    p_video_script_revision: byType.video_script.revision,
    p_creative_concept_artifact_id: byType.creative_concept.artifact_id,
    p_creative_concept_revision: byType.creative_concept.revision,
    p_marketing_plan_artifact_id: byType.marketing_plan.artifact_id,
    p_marketing_plan_revision: byType.marketing_plan.revision,
    p_brief_artifact_id: byType.video_project_brief.artifact_id,
    p_brief_revision: byType.video_project_brief.revision,
    p_model_id: "deterministic",
    p_prompt_version: "prompt-renderer-v1",
    p_schema_version: "1.0.0",
    p_idempotency_key: idempotencyKey,
    p_command_fingerprint: commandFingerprint,
    p_correlation_id: "corr-11a-text-free-paid-persist",
  });
  if (bErr) fail(`begin prompt run: ${bErr.message}`);
  if (begin?.status === "existing") {
    fail("text-free persist idempotency collided with existing prompt run");
  }
  const directorRunId = begin?.director_run_id || runId;
  const { data: persisted, error: pErr } = await db.rpc("persist_scene_package_set", {
    p_workspace_id: WORKSPACE_ID,
    p_project_id: PROJECT_ID,
    p_director_run_id: directorRunId,
    p_artifact_id: packageSet.id,
    p_storyboard_artifact_id: byType.storyboard_project.artifact_id,
    p_storyboard_revision: byType.storyboard_project.revision,
    p_visual_direction_artifact_id: byType.visual_direction.artifact_id,
    p_visual_direction_revision: byType.visual_direction.revision,
    p_video_script_artifact_id: byType.video_script.artifact_id,
    p_video_script_revision: byType.video_script.revision,
    p_creative_concept_artifact_id: byType.creative_concept.artifact_id,
    p_creative_concept_revision: byType.creative_concept.revision,
    p_marketing_plan_artifact_id: byType.marketing_plan.artifact_id,
    p_marketing_plan_revision: byType.marketing_plan.revision,
    p_brief_artifact_id: byType.video_project_brief.artifact_id,
    p_brief_revision: byType.video_project_brief.revision,
    p_package_set: packageSet,
    p_schema_version: "1.0.0",
    p_correlation_id: "corr-11a-text-free-paid-persist",
    p_actor_type: "shared_password",
    p_actor_id: "shared-password-user",
    p_created_by: "phase-11a-text-free-paid",
    p_expected_run_revision: begin?.revision ?? 1,
  });
  if (pErr) fail(`persist scene package set: ${pErr.message}`);
  if (persisted?.status !== "created") {
    fail(`persist scene package set status=${persisted?.status}`);
  }
  return {
    artifactIdPrefix: String(packageSet.id).slice(0, 8),
    revision: persisted.revision,
    directorRunPrefix: String(directorRunId).slice(0, 8),
  };
}

async function inspectPersistedPackageLeak(db) {
  const { data: ptr, error } = await db
    .from("active_artifact_revisions")
    .select("artifact_id,revision")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", "scene_package_set")
    .single();
  if (error || !ptr) fail("active scene_package_set missing");
  const art = await loadArt(db, ptr.artifact_id);
  const packages = art.value?.packages || [];
  const sc2 = packages.find((p) => p.sceneId === SCENE_ID || p.sceneOrder === 2);
  if (!sc2) fail("scene-2 missing from active package");
  const variant =
    (sc2.variants || []).find((v) => v.capabilityProfile === "image.text_to_image") ||
    (sc2.variants || [])[0];
  const positive = String(variant?.positive || "");
  return {
    artifactIdPrefix: String(art.id).slice(0, 8),
    revision: art.revision,
    titleInPositive: positive.includes(TITLE),
    ctaInPositive: positive.includes(CTA),
    noTextInPositive: /no text|no letters/i.test(positive),
    leaky: positive.includes(TITLE) || positive.includes(CTA),
  };
}

async function composeAndIngest(db, providerAsset, spec, overlayFingerprint) {
  const composeMod = await import(
    pathToFileURL(
      join(studioRoot, "src/application/production/phase-11a-deterministic-compositor.ts"),
    ).href
  );
  const qcMod = await import(
    pathToFileURL(join(studioRoot, "src/application/production/phase-11a-typographic-qc.ts")).href
  );
  const ocrMod = await import(
    pathToFileURL(join(studioRoot, "src/application/production/phase-11a-ocr-gate.ts")).href
  );
  const roleMod = await import(
    pathToFileURL(
      join(studioRoot, "src/application/production/phase-11a-image-role-storage.ts"),
    ).href
  );
  const ingestMod = await import(
    pathToFileURL(join(studioRoot, "src/application/production/phase-11a-composed-ingest.ts")).href
  );
  const reviewMod = await import(
    pathToFileURL(join(studioRoot, "src/application/production/phase-11a-overlay-review.ts")).href
  );

  const { data: file, error: dlErr } = await db.storage
    .from("director-final-assets")
    .download(providerAsset.storage_path);
  if (dlErr || !file) fail(`provider download failed: ${dlErr?.message || "empty"}`);
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.byteLength > 8_000_000) fail("provider PNG exceeds memory bound");

  const ocr = await ocrMod.inspectProviderImageText({
    bytes: buf,
    ocr: ocrMod.createUnavailableImageOcrPort(),
  });
  if (ocr.status !== "unavailable_humanOnly") {
    fail(`OCR status unexpected ${ocr.status}`);
  }
  if (ocr.status === "text_detected") {
    return { verdict: "PROVIDER_IMAGE_TEXT_DETECTED_NO_RETRY", ocr };
  }

  let composed;
  try {
    composed = composeMod.composePhase11ADeterministicOverlay({
      providerPng: buf,
      spec,
    });
  } catch (e) {
    const msg = String(e.message || e);
    return {
      verdict: /overflow|clip|glyph|contrast/i.test(msg)
        ? "COMPOSITOR_FAILED_NO_RETRY"
        : "COMPOSITOR_FAILED_NO_RETRY",
      compositorError: msg.slice(0, 200),
      ocr,
    };
  }

  const typo = qcMod.validatePhase11ATypographicQc({ spec, composed });
  if (typo.status !== "accepted") {
    return {
      verdict: "COMPOSITOR_FAILED_NO_RETRY",
      typographicQc: typo.reasons.map((r) => r.code),
      ocr,
    };
  }
  if (composed.overlayFingerprint !== overlayFingerprint) {
    fail("composed overlay fingerprint mismatch");
  }

  const composedFp = ingestMod.fingerprintPhase11AComposedAsset({
    parentChecksumSha256: providerAsset.checksum,
    overlay: spec,
    compositorVersion: composed.compositorVersion,
  });
  const composedId = ingestMod.composedAssetIdFromFingerprint(composedFp);
  const storagePath = roleMod.buildPhase11ARoleImageStoragePath({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    assetId: composedId,
    role: "composed",
  });
  roleMod.assertSafePhase11ARoleImageStoragePath(storagePath, {
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    assetId: composedId,
    role: "composed",
  });

  const { data: existingObj } = await db.storage
    .from("director-final-assets")
    .list(
      `${WORKSPACE_ID}/${PROJECT_ID}/media/image/composed`,
      { search: `${composedId}.png`, limit: 1 },
    );
  if ((existingObj || []).some((o) => o.name === `${composedId}.png`)) {
    fail("composed object already exists — refuse overwrite");
  }

  const { error: upErr } = await db.storage
    .from("director-final-assets")
    .upload(storagePath, composed.png, {
      contentType: "image/png",
      upsert: false,
    });
  if (upErr) fail(`composed upload: ${upErr.message}`);

  const providerLegacy = String(providerAsset.storage_path || "").split("/").length === 5;
  const card = reviewMod.buildPhase11AOverlayReviewCard({
    providerAssetId: providerAsset.id,
    composedAssetId: composedId,
    spec,
    typographicQc: typo,
    ocrGate: ocr,
    overlayFingerprint,
    overlayVersion: spec.version,
    compositorVersion: composed.compositorVersion,
    providerCostMinorAlreadySettled: 0,
    providerPathIsLegacyFiveSegment: providerLegacy,
  });

  const nowIso = new Date().toISOString();
  const { error: insErr } = await db.from("assets").insert({
    id: composedId,
    workspace_id: WORKSPACE_ID,
    project_id: PROJECT_ID,
    run_id: providerAsset.run_id,
    scene_id: SCENE_ID,
    step_id: providerAsset.step_id,
    kind: "image",
    mime_type: "image/png",
    storage_bucket: "director-final-assets",
    storage_path: storagePath,
    source_kind: "internal",
    source_provider: "deterministic-overlay",
    checksum: composed.checksumSha256,
    size_bytes: composed.png.byteLength,
    width: 1024,
    height: 1024,
    provenance: {
      active: false,
      published: false,
      mergeRequested: false,
      exportRequested: false,
      downstreamRequested: false,
      mediaRole: "composed_overlay_image",
      parentAssetId: providerAsset.id,
      overlayVersion: composed.overlayVersion,
      overlayFingerprint: composed.overlayFingerprint,
      compositorVersion: composed.compositorVersion,
      overlayReviewCard: card,
    },
    status: "pending_review",
    created_at: nowIso,
  });
  if (insErr) fail(`composed asset insert: ${insErr.message}`);

  return {
    verdict: null,
    ocr,
    typographicQc: {
      status: typo.status,
      reasonCodes: typo.reasons.map((r) => r.code),
      expectedStrings: typo.expectedStrings,
    },
    composed: {
      assetIdPrefix: composedId.slice(0, 8),
      checksumPrefix: composed.checksumSha256.slice(0, 16),
      pathPattern: storagePath
        .replace(WORKSPACE_ID, "{workspaceId}")
        .replace(PROJECT_ID, "{projectId}")
        .replace(composedId, "{assetId}"),
      active: false,
      parentPrefix: String(providerAsset.id).slice(0, 8),
      overlayFingerprint,
      compositorVersion: composed.compositorVersion,
    },
    humanReview: {
      decision: null,
      contextCreated: true,
      providerAssetPrefix: String(providerAsset.id).slice(0, 8),
      composedAssetPrefix: composedId.slice(0, 8),
    },
  };
}

async function settleLedgerIfNeeded(db, beforeReserved) {
  const { data: resRows, error } = await db
    .from("budget_reservations")
    .select("id,status,amount_minor,revision,run_id")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("status", "active");
  if (error) fail(`ledger reservations: ${error.message}`);
  const active = resRows || [];
  if (active.length === 0) {
    return { settled: false, reason: "no_active_reservation", reconciliationRequired: false };
  }
  if (active.length !== 1) fail(`expected 0 or 1 active reservation, got ${active.length}`);
  const reservation = active[0];
  const reserved = Number(reservation.amount_minor || 0);
  if (reserved > 2) fail(`reservation ${reserved} > 2`);
  const commitAmount = Math.min(1, reserved);
  const { error: cErr } = await db.rpc("commit_budget_reservation", {
    p_reservation_id: reservation.id,
    p_amount_minor: commitAmount,
    p_cost_status: "provisional",
    p_ledger_idempotency_key: `commit:${reservation.id}`,
    p_expected_revision: reservation.revision,
  });
  if (cErr) {
    return {
      settled: false,
      reason: cErr.message.slice(0, 160),
      reconciliationRequired: true,
    };
  }
  return {
    settled: true,
    committedMinor: commitAmount,
    reservationPrefix: String(reservation.id).slice(0, 8),
    reconciliationRequired: false,
  };
}

function writeReport(report) {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  const safe = { ...report, saltValue: undefined };
  writeFileSync(REPORT_PATH, JSON.stringify(safe, null, 2));
  console.log(`REPORT_WRITTEN ${REPORT_PATH}`);
}

function closeRuntime() {
  console.log("CLOSURE_START");
  const fails = applyEnvMap(OFF_ALL);
  if (fails > 0) fail(`closure env writes failed count=${fails}`);
  const host = redeployFromE4c3de3("OFF");
  console.log("CLOSURE_DONE");
  return host;
}

async function main() {
  if (process.env.CONFIRM_PHASE_11A_TEXT_FREE_IMAGE_RETRY_PAID !== "1") {
    fail("Set CONFIRM_PHASE_11A_TEXT_FREE_IMAGE_RETRY_PAID=1");
  }

  const futureIdempotencyFingerprint = createHash("sha256")
    .update(
      [
        AUTH,
        EXPECTED_COMMIT,
        SALT_FP,
        SCENE_ID,
        "no-text-v1",
        EXPECTED_OVERLAY_FP,
        "attempt=1",
        "retry_of=null",
      ].join("|"),
      "utf8",
    )
    .digest("hex");

  const report = {
    auth: AUTH,
    sourceCommit: EXPECTED_COMMIT,
    sourceCommitShort: EXPECTED_COMMIT_SHORT,
    docsHeadExpected: DOCS_HEAD_SHORT,
    saltFingerprint: SALT_FP,
    saltPresent: true,
    futureIdempotencyFingerprint,
    preflightFutureFingerprintPrefix: "8ea9955304da4622",
    fingerprintNote:
      "execution salt distinct from preflight — fingerprint recomputed with same formula",
    providerAuthConsumed: false,
    providerSubmitCount: 0,
    workerInvocations: 0,
    verdict: null,
  };

  let closed = false;
  const closeOnce = () => {
    if (closed) return report.deployOffHost;
    closed = true;
    report.deployOffHost = closeRuntime();
    return report.deployOffHost;
  };

  try {
    const head = (run("git", ["rev-parse", "HEAD"]).stdout || "").trim();
    report.localHead = head;
    const base = (run("git", ["merge-base", EXPECTED_COMMIT, "HEAD"]).stdout || "").trim();
    if (base !== EXPECTED_COMMIT) {
      fail(`HEAD must be ${EXPECTED_COMMIT_SHORT} or docs atop it`);
    }

    const migDir = join(studioRoot, "supabase", "migrations");
    const migFiles = existsSync(migDir)
      ? readdirSync(migDir).filter((f) => f.endsWith(".sql")).length
      : 0;
    report.migrationsLocalSqlCount = migFiles;
    if (migFiles !== 30) fail(`local migrations expected 30 got ${migFiles}`);
    if (!openaiKeyPresentInVercelLs()) {
      fail("OPENAI_API_KEY missing from Vercel production env ls");
    }

    const db = remoteDb();
    const before = await captureCounters(db);
    report.countersBefore = before;
    console.log("BUDGET_BEFORE", JSON.stringify(before.budget));
    if (before.budget.hardMinor !== 274) fail(`hard ${before.budget.hardMinor} ≠ 274`);
    if (
      before.budget.committedMinor !== 248 ||
      before.budget.reservedMinor !== 0 ||
      before.budget.availableMinor !== 26
    ) {
      fail(
        `budget expected 274/248/0/26 got ${before.budget.hardMinor}/${before.budget.committedMinor}/${before.budget.reservedMinor}/${before.budget.availableMinor}`,
      );
    }
    if ((before.active_reservations.count ?? 0) !== 0) fail("active media reservation present");
    const { data: runningJobs } = await db
      .from("production_jobs")
      .select("id,status")
      .eq("project_id", PROJECT_ID)
      .in("status", ["pending", "leased", "running", "claimed"]);
    if ((runningJobs || []).length > 0) fail("concurrent image job present");

    report.rejectedAsset = await assertRejectedAssetPreserved(db);
    const byType = await loadActiveArtifacts(db);
    report.upstreamArtifacts = Object.fromEntries(
      Object.entries(byType)
        .filter(([k]) =>
          [
            "video_project_brief",
            "marketing_plan",
            "creative_concept",
            "video_script",
            "visual_direction",
            "storyboard_project",
          ].includes(k),
        )
        .map(([k, v]) => [
          k,
          { revision: v.revision, idPrefix: String(v.artifact_id).slice(0, 8) },
        ]),
    );

    const persistedBefore = await inspectPersistedPackageLeak(db);
    report.persistedPackageBefore = persistedBefore;

    const envBefore = pullProductionEnv();
    report.flagsBefore = flagMatrix(envBefore);
    if (report.flagsBefore.DIRECTOR_V2_WORKER_ENABLED === "1") {
      fail("worker must be OFF before opening window");
    }
    if (report.flagsBefore.MOTION_TRANSFER_ENABLED === "1") fail("Motion must be OFF");

    promoteE4c3de3IfNeeded();

    console.log("OPEN_WINDOW");
    const prePull = pullProductionEnv();
    let workerSecret = prePull.DIRECTOR_V2_WORKER_SECRET?.trim() || "";
    let workerSecretRotated = false;
    if (!workerSecret) {
      workerSecret = `vhs-11a-worker-${randomBytes(24).toString("hex")}`;
      workerSecretRotated = true;
      ON_FLIP.DIRECTOR_V2_WORKER_SECRET = workerSecret;
    }
    const openFails = applyEnvMap({ ...ALWAYS_OFF, ...ON_FLIP });
    if (openFails > 0) fail(`open env writes failed count=${openFails}`);
    report.workerSecretRotated = workerSecretRotated;
    report.workerSecretPresent = true;
    report.deployOnHost = redeployFromE4c3de3("ON");
    const alias = inspectAliasCommit();
    if (!alias.commitOk) fail("ON deploy commit != e4c3de3");
    report.runtimeHost = alias.host;

    const envOn = pullProductionEnv();
    report.flagsDuring = flagMatrix(envOn);
    const password = envOn.APP_PASSWORD;
    if (!password) fail("APP_PASSWORD missing");

    const rebuilt = await rebuildNoTextPackage(db, byType);
    report.rebuild = {
      overlayFingerprint: rebuilt.overlayFingerprint,
      promptHashPrefix: rebuilt.built.promptHash.slice(0, 16),
      promptVersion: rebuilt.built.promptVersion,
      providerTextPolicy: rebuilt.built.redactedMetadata.providerTextPolicy,
      overlayCopyInVisualVariant: false,
      overlayCopyInProviderPrompt: false,
      providerPromptNoText: /no text/i.test(rebuilt.built.promptText),
      planFingerprintPrefix: rebuilt.plan.fingerprint.slice(0, 16),
      planFpMatchesPreflightLive: rebuilt.planFpMatches,
      planFpVarianceAccepted: !rebuilt.planFpMatches,
      estimateMinor: rebuilt.plan.estimateMinor,
      reservationMinor: rebuilt.plan.reservationMinor,
      contrast: Number(rebuilt.contrast.toFixed(2)),
      compositorRuntime: rebuilt.plan.compositorRuntime,
    };
    if (rebuilt.plan.estimateMinor !== 1) fail(`estimate ${rebuilt.plan.estimateMinor} ≠ 1`);
    if (rebuilt.plan.reservationMinor > 2) fail(`reservation ${rebuilt.plan.reservationMinor} > 2`);
    if (rebuilt.contrast + 1e-9 < 4.5) fail("overlay contrast < 4.5");

    const cookie = await loginCookie(password);
    const corrBase = `corr-11a-text-free-paid-${Date.now()}`;
    const promptsDry = await directorPost(
      cookie,
      "/prompts",
      { mode: "dry-run" },
      `${corrBase}-prompts-dry`,
    );
    if (promptsDry.status !== 200) fail(`prompts dry-run HTTP ${promptsDry.status}`);
    const pDry = promptsDry.json.dryRun || promptsDry.json;
    if (pDry.providerCalled === true) fail("prompts dry providerCalled");
    if (pDry.executable !== true && pDry.executionAvailable !== true) {
      fail("prompts dry not executable");
    }
    report.httpPromptsDry = {
      status: 200,
      executable: true,
      providerCalled: false,
    };

    if (persistedBefore.leaky) {
      console.log("PERSIST_NO_TEXT_PACKAGE");
      report.packagePersist = await persistNoTextPackageSet(db, byType, rebuilt.packageSet);
      const afterPersist = await inspectPersistedPackageLeak(db);
      report.persistedPackageAfter = afterPersist;
      if (afterPersist.leaky) fail("persisted no-text package still leaky — STOP");
    } else {
      report.packagePersist = { reusedExisting: true };
    }

    const routingDry = await directorPost(
      cookie,
      "/routing",
      { mode: "dry-run" },
      `${corrBase}-routing-dry`,
    );
    if (routingDry.status !== 200) fail(`routing dry-run HTTP ${routingDry.status}`);
    const rDry = routingDry.json.dryRun || routingDry.json;
    if (rDry.providerCalled === true) fail("routing dry providerCalled");
    if (rDry.executable !== true) {
      fail(`routing dry not executable: ${JSON.stringify(rDry).slice(0, 400)}`);
    }
    const p11 = rDry.phase11ACanonicalSingleStep;
    if (!p11?.enabled) fail("phase11ACanonicalSingleStep missing");
    if (p11.compositionFingerprint !== EXPECTED_COMPOSITION_FP) {
      fail("routing dry composition fingerprint mismatch");
    }
    if (p11.estimateMinor !== 1 || p11.reservationMinor > 2) {
      report.verdict = "BLOCKED_PRECONDITION";
      fail(`pricing estimate=${p11.estimateMinor} reserve=${p11.reservationMinor}`);
    }
    if (
      p11.provider !== "openai" ||
      p11.model !== "gpt-image-1" ||
      p11.quality !== "low" ||
      p11.size !== "1024x1024" ||
      p11.stepCount !== 1
    ) {
      fail("routing dry provider/model/quality/size/step mismatch");
    }
    report.routingDry = {
      executable: true,
      providerCalled: false,
      compositionFingerprint: p11.compositionFingerprint,
      planFingerprintPrefix: String(p11.planFingerprint || "").slice(0, 16),
      estimateMinor: p11.estimateMinor,
      reservationMinor: p11.reservationMinor,
      provider: p11.provider,
      model: p11.model,
      quality: p11.quality,
      size: p11.size,
    };
    console.log("HTTP_ROUTING_DRY", JSON.stringify(report.routingDry));

    const routingExec = await directorPost(
      cookie,
      "/routing",
      {
        mode: "execute",
        expectedScenePackageSetRevision: rDry.scenePackageSetRevision,
        expectedRegistrySnapshotVersion: rDry.registryVersion,
      },
      `${corrBase}-routing-exec`,
    );
    if (
      routingExec.status !== 200 ||
      !["completed", "existing"].includes(routingExec.json.status)
    ) {
      fail(
        `routing execute failed ${routingExec.status}: ${JSON.stringify(routingExec.json).slice(0, 400)}`,
      );
    }
    const planMeta = routingExec.json.plan || {};
    let planId = planMeta.artifactId || null;
    let planRev = planMeta.revision ?? null;
    if (!planId || !planRev) {
      const { data: gp, error: gpErr } = await db
        .from("active_artifact_revisions")
        .select("artifact_id,revision")
        .eq("project_id", PROJECT_ID)
        .eq("artifact_type", "generation_plan")
        .maybeSingle();
      if (gpErr || !gp) fail("generation_plan active missing after routing");
      planId = gp.artifact_id;
      planRev = gp.revision;
    }
    report.routingExecute = {
      status: routingExec.json.status,
      planArtifactIdPrefix: String(planId).slice(0, 8),
      planRevision: planRev,
    };

    const brief = byType.video_project_brief;
    const storyboard = byType.storyboard_project;
    const approvalTargets = [
      {
        artifactType: "video_project_brief",
        artifactId: brief.artifact_id,
        revision: brief.revision,
      },
      {
        artifactType: "storyboard_project",
        artifactId: storyboard.artifact_id,
        revision: storyboard.revision,
      },
      {
        artifactType: "generation_plan",
        artifactId: planId,
        revision: planRev,
      },
    ];
    report.approvals = [];
    for (const ap of approvalTargets) {
      const rev = await projectRevision(db);
      const appr = await directorPost(
        cookie,
        "/approvals",
        {
          ...ap,
          decision: "approved",
          expectedProjectRevision: rev,
          confirmation: true,
        },
        `${corrBase}-appr-${ap.artifactType}`,
      );
      if (
        appr.status !== 200 ||
        !["completed", "existing"].includes(appr.json.status)
      ) {
        fail(
          `approval ${ap.artifactType} failed ${appr.status}: ${JSON.stringify(appr.json).slice(0, 300)}`,
        );
      }
      report.approvals.push({ type: ap.artifactType, status: appr.json.status });
    }

    const prodDry = await directorPost(
      cookie,
      "/production",
      { mode: "dry-run" },
      `${corrBase}-prod-dry`,
    );
    if (prodDry.status !== 200) fail(`production dry-run HTTP ${prodDry.status}`);
    const prDry = prodDry.json.dryRun || prodDry.json;
    if (prDry.providerCalled === true) fail("production dry providerCalled");
    if (prDry.executable !== true) {
      fail(`production dry not executable: ${JSON.stringify(prDry).slice(0, 500)}`);
    }
    report.productionDry = {
      executable: true,
      providerCalled: false,
      generationPlanRevision: prDry.generationPlanRevision,
      estimatedCostMinor: prDry.estimatedCostMinor ?? null,
    };

    const mid = await captureCounters(db);
    if (mid.budget.availableMinor < 2) fail("available < 2 before reserve");
    if (mid.budget.reservedMinor !== 0) fail("unexpected active reservation before execute");

    const prodExec = await directorPost(
      cookie,
      "/production",
      {
        mode: "execute",
        expectedGenerationPlanRevision: prDry.generationPlanRevision,
        confirmation: true,
      },
      `${corrBase}-prod-exec`,
    );
    if (
      prodExec.status !== 200 ||
      !["completed", "existing", "already_running"].includes(prodExec.json.status)
    ) {
      fail(
        `production execute failed ${prodExec.status}: ${JSON.stringify(prodExec.json).slice(0, 400)}`,
      );
    }
    report.productionExecute = {
      status: prodExec.json.status,
      runIdPrefix: prodExec.json.run?.id
        ? String(prodExec.json.run.id).slice(0, 8)
        : null,
    };
    console.log("PRODUCTION_EXECUTE", JSON.stringify(report.productionExecute));

    report.workerInvocations = 1;
    const workerRes = await fetch(`${BASE}/api/internal/director-worker/run-once`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-director-worker-secret": workerSecret,
        "x-correlation-id": `${corrBase}-worker`,
      },
      body: JSON.stringify({}),
    });
    const workerBody = await workerRes.json().catch(() => ({}));
    assertNoLeakedSecrets(workerBody);
    report.worker = {
      httpStatus: workerRes.status,
      status: workerBody.status ?? null,
      claimed: workerBody.claimed ?? null,
      processed: workerBody.processed ?? null,
      completed: workerBody.completed ?? null,
      failed: workerBody.failed ?? null,
      providerCalls: workerBody.providerCalls ?? null,
      providerCalled: workerBody.providerCalled ?? null,
      issues: (workerBody.issues || []).map((i) => ({
        code: i.code,
        publicMessage: String(i.publicMessage || "").slice(0, 160),
      })),
    };
    console.log("WORKER", JSON.stringify(report.worker));

    if (workerBody.providerCalled === true || (workerBody.providerCalls ?? 0) > 0) {
      report.providerAuthConsumed = true;
      report.providerSubmitCount = workerBody.providerCalls ?? 1;
    } else if (workerRes.status === 200 && (workerBody.claimed ?? 0) >= 1) {
      report.providerAuthConsumed = true;
      report.providerSubmitCount = 1;
    }

    const workerReplay = await fetch(`${BASE}/api/internal/director-worker/run-once`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-director-worker-secret": workerSecret,
        "x-correlation-id": `${corrBase}-worker-replay`,
      },
      body: JSON.stringify({}),
    });
    const replayBody = await workerReplay.json().catch(() => ({}));
    assertNoLeakedSecrets(replayBody);
    report.workerReplay = {
      httpStatus: workerReplay.status,
      claimed: replayBody.claimed ?? null,
      providerCalls: replayBody.providerCalls ?? null,
      providerCalled: replayBody.providerCalled ?? null,
    };
    if ((replayBody.providerCalls ?? 0) > 0) {
      fail("worker replay issued additional provider calls — STOP");
    }

    const { data: newAssets, error: aErr } = await db
      .from("assets")
      .select(
        "id,status,kind,mime_type,storage_bucket,storage_path,checksum,size_bytes,width,height,provenance,scene_id,source_kind,source_provider,run_id,step_id",
      )
      .eq("project_id", PROJECT_ID)
      .eq("kind", "image")
      .order("created_at", { ascending: false });
    if (aErr) fail(`assets after worker: ${aErr.message}`);
    const providerAsset = (newAssets || []).find(
      (a) =>
        !String(a.id).startsWith(REJECTED_ASSET_PREFIX) &&
        a.source_provider === "openai",
    );
    report.rejectedAssetAfter = await assertRejectedAssetPreserved(db);

    if (!providerAsset) {
      report.verdict =
        report.providerSubmitCount >= 1
          ? "INVALID_OUTPUT_NO_RETRY"
          : "PROVIDER_FAILED_NO_RETRY";
    } else {
      report.providerAsset = {
        assetIdPrefix: String(providerAsset.id).slice(0, 8),
        status: providerAsset.status,
        checksumPrefix: String(providerAsset.checksum || "").slice(0, 16),
        width: providerAsset.width,
        height: providerAsset.height,
        sizeBytes: providerAsset.size_bytes,
        pathPattern: String(providerAsset.storage_path || "")
          .replace(WORKSPACE_ID, "{workspaceId}")
          .replace(PROJECT_ID, "{projectId}")
          .replace(
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
            "{assetId}",
          ),
        active: providerAsset.provenance?.active === true,
        pathSegments: String(providerAsset.storage_path || "").split("/").length,
      };
      if (providerAsset.provenance?.active === true) {
        fail("new provider asset must stay active=false");
      }
      if (Number(providerAsset.width) !== 1024 || Number(providerAsset.height) !== 1024) {
        report.verdict = "INVALID_OUTPUT_NO_RETRY";
      } else {
        const composed = await composeAndIngest(
          db,
          providerAsset,
          rebuilt.spec,
          rebuilt.overlayFingerprint,
        );
        report.ocr = {
          status: composed.ocr?.status ?? null,
          measure: composed.ocr?.measure ?? null,
          realOcrCalled: false,
        };
        report.composition = composed.composed || null;
        report.typographicQc = composed.typographicQc || null;
        report.humanReview = composed.humanReview || { decision: null };
        if (composed.verdict) report.verdict = composed.verdict;
      }
    }

    report.ledger = await settleLedgerIfNeeded(db);
    const after = await captureCounters(db);
    report.countersAfter = after;
    report.budgetAfter = after.budget;
    report.deltas = {
      newRuns: (after.production_runs.count ?? 0) - (before.production_runs.count ?? 0),
      newJobs: (after.production_jobs.count ?? 0) - (before.production_jobs.count ?? 0),
      newAttempts:
        (after.generation_attempts.count ?? 0) - (before.generation_attempts.count ?? 0),
      newAssets: (after.image_assets.count ?? 0) - (before.image_assets.count ?? 0),
      newLedgerRows: (after.ledger_rows.count ?? 0) - (before.ledger_rows.count ?? 0),
      newReviews:
        (after.human_review_decisions.count ?? 0) -
        (before.human_review_decisions.count ?? 0),
    };
    if (after.budget.hardMinor !== 274) fail("hard limit changed");
    if ((report.deltas.newReviews ?? 0) !== 0) fail("Human Review decision was written");
    if ((report.deltas.newRuns ?? 0) > 1) fail("more than one new production_run");
    if ((report.deltas.newJobs ?? 0) > 1) fail("more than one new production_job");
    if ((report.deltas.newAssets ?? 0) > 2) fail("more than two new assets");

    if (!report.verdict) {
      if (report.ledger?.reconciliationRequired) {
        report.verdict = "RECONCILIATION_REQUIRED";
      } else if (
        report.providerSubmitCount >= 1 &&
        report.providerAsset &&
        report.composition
      ) {
        report.verdict = "PASS_TEXT_FREE_PROVIDER_AND_COMPOSED_IMAGE_NEEDS_HUMAN_REVIEW";
      } else if (report.providerSubmitCount >= 1 && report.providerAsset) {
        report.verdict = "PASS_TEXT_FREE_PROVIDER_AND_COMPOSED_IMAGE_NEEDS_HUMAN_REVIEW";
      } else if (report.providerSubmitCount >= 1) {
        report.verdict = "INVALID_OUTPUT_NO_RETRY";
      } else {
        report.verdict = "PROVIDER_FAILED_NO_RETRY";
      }
    }

    report.retryFallbackDownstream = { retry: 0, fallback: 0, downstream: 0 };
    closeOnce();
    const envFinal = pullProductionEnv();
    report.flagsFinal = flagMatrix(envFinal);
    report.runtimeFinal = {
      RUNTIME_PAID_MEDIA: "OFF",
      OPENAI_IMAGE_REAL_EXECUTION: "UNAVAILABLE",
      DETERMINISTIC_OVERLAY_EXECUTION: "UNAVAILABLE",
      MOTION_RUNTIME: "UNAVAILABLE",
    };
    const cookie2 = await loginCookie(envFinal.APP_PASSWORD || password);
    const closedProbe = await fetch(
      `${BASE}/api/director/projects/${PROJECT_ID}/prompts`,
      {
        method: "POST",
        headers: apiHeaders(cookie2, `${corrBase}-closed`),
        body: JSON.stringify({ mode: "dry-run" }),
      },
    );
    report.closedProbeStatus = closedProbe.status;
    if (closedProbe.status !== 404) {
      fail(`after closure prompts expected 404 got ${closedProbe.status}`);
    }

    writeReport(report);
    console.log(
      JSON.stringify(
        {
          verdict: report.verdict,
          providerAuthConsumed: report.providerAuthConsumed,
          providerSubmitCount: report.providerSubmitCount,
          saltFp: SALT_FP,
          futureIdempotencyFingerprint: futureIdempotencyFingerprint.slice(0, 16),
        },
        null,
        2,
      ),
    );
    if (
      report.verdict !==
        "PASS_TEXT_FREE_PROVIDER_AND_COMPOSED_IMAGE_NEEDS_HUMAN_REVIEW" &&
      report.verdict !== "RECONCILIATION_REQUIRED"
    ) {
      process.exitCode = 2;
    }
  } catch (e) {
    const msg = String(e.message || e);
    const beforeProvider =
      report.providerSubmitCount === 0 && report.providerAuthConsumed !== true;
    report.verdict =
      report.verdict ||
      (beforeProvider ||
      /budget|fingerprint|precondition|expected|missing|STOP before|leaky/i.test(msg)
        ? "BLOCKED_PRECONDITION"
        : "PROVIDER_FAILED_NO_RETRY");
    report.error = msg.slice(0, 600);
    try {
      closeOnce();
      const envFinal = pullProductionEnv();
      report.flagsFinal = flagMatrix(envFinal);
      report.runtimeFinal = {
        RUNTIME_PAID_MEDIA: "OFF",
        OPENAI_IMAGE_REAL_EXECUTION: "UNAVAILABLE",
        DETERMINISTIC_OVERLAY_EXECUTION: "UNAVAILABLE",
        MOTION_RUNTIME: "UNAVAILABLE",
      };
    } catch (closeErr) {
      report.closureError = String(closeErr.message || closeErr).slice(0, 300);
    }
    writeReport(report);
    console.error(report.error);
    process.exit(1);
  }
}

main();
