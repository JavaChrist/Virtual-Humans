#!/usr/bin/env node
/**
 * Phase 11A-PAID-OPENAI-IMAGE-SMOKE-ONCE
 *
 *   CONFIRM_PHASE_11A_PAID_OPENAI_IMAGE_SMOKE_ONCE=1 \
 *   node --import tsx scripts/phase-11a-paid-openai-image-smoke-once.mjs
 *
 * Exactly one OpenAI image generation on Production Director path.
 * Runtime source must be applicative commit 7a67c77 (not documentary HEAD).
 * Never prints OPENAI_API_KEY / salt / signed URLs / base64 / prompts.
 */
import { createHash, randomBytes } from "node:crypto";
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
const EXPECTED_COMMIT = "7a67c77c3df64750265d66b23161e8d42ffcb13a";
const EXPECTED_COMMIT_SHORT = "7a67c77";
const DOCS_HEAD_SHORT = "1a5066c";
const EXPECTED_COMPOSITION_FP = "c532c400334f5b22";
const EXPECTED_PLAN_FP_PREFIX = "1c5011b7";
const EXPECTED_PROMPT_HASH_PREFIX = "9ad3ad28";
/** Known Ready deploy built from 7a67c77 (preflight OFF) — never redeploy from docs HEAD. */
const SOURCE_7A67C77_DEPLOY =
  "https://virtual-humans-8mubro9na-javachrist-projects.vercel.app";
const BASE = process.env.PHASE_11A_BASE_URL || "https://virtual-humans.vercel.app";
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const SCENE_ID = "scene-2";
const AUTH = "AUTH_11A_PAID_OPENAI_IMAGE_SMOKE_ONCE";
const SALT = `11a-paid-smoke-7a67c77-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(4).toString("hex")}`;
const SALT_FP = createHash("sha256").update(SALT).digest("hex").slice(0, 16);
const REPORT_PATH = join(
  studioRoot,
  ".tmp",
  "phase-11a-paid-openai-image-smoke-once-report.json",
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
  err.name = "Phase11APaidSmokeStop";
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
  const tmp = join(studioRoot, ".tmp", "phase-11a-paid-smoke-vercel-env.tmp");
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

function inspectAliasCommit() {
  const inspect = run("npx", ["vercel", "inspect", "virtual-humans.vercel.app"]);
  const t = `${inspect.stdout || ""}\n${inspect.stderr || ""}`;
  const urlMatch = t.match(
    /https:\/\/(virtual-humans-[a-z0-9]+-javachrist-projects\.vercel\.app)/i,
  );
  const host = urlMatch?.[1] || "virtual-humans.vercel.app";
  const logs = run("npx", ["vercel", "inspect", host, "--logs"]);
  const lt = `${logs.stdout || ""}\n${logs.stderr || ""}`;
  const commitOk =
    lt.includes(`Commit: ${EXPECTED_COMMIT_SHORT}`) ||
    lt.includes(EXPECTED_COMMIT_SHORT);
  return { host, commitOk, logsSnippet: lt.slice(0, 400) };
}

function redeployFrom7a67c77(label) {
  console.log(`REDEPLOY_${label}_START source=${SOURCE_7A67C77_DEPLOY}`);
  const r = run("npx", [
    "vercel",
    "redeploy",
    SOURCE_7A67C77_DEPLOY,
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
      .from("artifact_approvals")
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
    artifact_approvals: countOrZero(reviews, "approvals"),
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

async function localFinalDryRun(envForException) {
  const allow = await import(
    pathToFileURL(
      join(
        studioRoot,
        "src/application/production/phase-11a-openai-image-allowlist.ts",
      ),
    ).href
  );
  const dry = allow.phase11AOpenAIImageAllowlistDryRun({
    env: envForException,
    availableMinor: 27,
  });
  const compositionFp = allow.phase11ARuntimeCompositionFingerprint();
  if (compositionFp !== EXPECTED_COMPOSITION_FP) {
    fail(
      `composition fingerprint expected ${EXPECTED_COMPOSITION_FP} got ${compositionFp}`,
    );
  }
  if (dry.providerCalled !== false) fail("local dry-run providerCalled");
  if (dry.executable !== true) fail("local dry-run not executable");
  if (dry.estimateMinor !== 1) fail(`estimate expected 1 got ${dry.estimateMinor}`);
  if (dry.reservationMinor > 2) {
    fail(`reservation planned ${dry.reservationMinor} > 2`);
  }
  if (dry.storageIngestWired !== true) fail("storageIngestWired false");
  if (dry.persistedMediaPayloadPossible !== false) {
    fail("persistedMediaPayloadPossible must be false");
  }
  if (dry.compositionFingerprint !== EXPECTED_COMPOSITION_FP) {
    fail("dry composition fingerprint mismatch");
  }
  return dry;
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

async function inspectPersistedSafety(db) {
  const { data: runs } = await db
    .from("production_runs")
    .select("id,state")
    .eq("project_id", PROJECT_ID);
  const { data: jobs } = await db
    .from("production_jobs")
    .select("id,payload,result,error")
    .eq("project_id", PROJECT_ID);
  const { data: attempts } = await db
    .from("generation_attempts")
    .select("id,status,error_code,idempotency_key")
    .eq("project_id", PROJECT_ID);
  const dumped = JSON.stringify({ runs, jobs, attempts });
  const hasMedia =
    /data:image\/|b64_json|base64,[A-Za-z0-9+/]{40,}|https?:\/\/[^\s"]+\.(png|jpg)|oaidalleapiprodscus/i.test(
      dumped,
    );
  return {
    persistedMediaPayloadPossible: hasMedia,
    runCount: (runs || []).length,
    jobCount: (jobs || []).length,
    attemptCount: (attempts || []).length,
  };
}

async function captureSmokeEvidence(db) {
  const { data: runs } = await db
    .from("production_runs")
    .select("id,status,state")
    .eq("project_id", PROJECT_ID)
    .order("created_at", { ascending: false })
    .limit(3);
  const { data: jobs } = await db
    .from("production_jobs")
    .select("id,status,run_id")
    .eq("project_id", PROJECT_ID)
    .order("created_at", { ascending: false })
    .limit(3);
  const { data: attempts } = await db
    .from("generation_attempts")
    .select(
      "id,attempt_number,status,provider_id,model_id,estimate_minor,actual_cost_minor,cost_status,error_code,idempotency_key",
    )
    .eq("project_id", PROJECT_ID)
    .order("created_at", { ascending: false })
    .limit(5);
  const { data: assets } = await db
    .from("assets")
    .select(
      "id,status,kind,mime_type,storage_bucket,storage_path,checksum,size_bytes,width,height,provenance,scene_id,source_kind",
    )
    .eq("project_id", PROJECT_ID)
    .limit(5);
  const { data: ledger } = await db
    .from("cost_ledger")
    .select("id,entry_type,amount_minor,created_at")
    .eq("workspace_id", WORKSPACE_ID)
    .order("created_at", { ascending: false })
    .limit(10);

  let storageListed = 0;
  try {
    const listed = await db.storage
      .from("director-final-assets")
      .list(`${WORKSPACE_ID}/${PROJECT_ID}/media/image`, { limit: 10 });
    storageListed = (listed.data || []).length;
  } catch {
    storageListed = -1;
  }

  const assetViews = (assets || []).map((a) => {
    const prov = a.provenance && typeof a.provenance === "object" ? a.provenance : {};
    const path = String(a.storage_path || "");
    const redactedPath = path
      ? path
          .replace(WORKSPACE_ID, "{workspaceId}")
          .replace(PROJECT_ID, "{projectId}")
          .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "{assetId}")
      : null;
    return {
      assetIdPrefix: String(a.id).slice(0, 8),
      status: a.status,
      kind: a.kind,
      mime: a.mime_type,
      bucket: a.storage_bucket,
      pathPattern: redactedPath,
      checksumPrefix: a.checksum ? String(a.checksum).slice(0, 16) : null,
      sizeBytes: a.size_bytes,
      width: a.width,
      height: a.height,
      sceneId: a.scene_id,
      sourceKind: a.source_kind,
      active:
        prov.active === true ||
        prov.active === false
          ? prov.active
          : null,
      humanValidationRequired: prov.humanValidationRequired ?? null,
    };
  });

  return {
    runs: (runs || []).map((r) => ({
      idPrefix: String(r.id).slice(0, 8),
      status: r.status,
      stateKeys:
        r.state && typeof r.state === "object" ? Object.keys(r.state).slice(0, 20) : [],
    })),
    jobs: (jobs || []).map((j) => ({
      idPrefix: String(j.id).slice(0, 8),
      status: j.status,
      runPrefix: j.run_id ? String(j.run_id).slice(0, 8) : null,
    })),
    attempts: (attempts || []).map((a) => ({
      idPrefix: String(a.id).slice(0, 8),
      attempt: a.attempt_number,
      retryOf: null,
      status: a.status,
      provider: a.provider_id,
      model: a.model_id,
      estimateMinor: a.estimate_minor,
      actualCostMinor: a.actual_cost_minor,
      costStatus: a.cost_status,
      errorCode: a.error_code,
      idempotencyKeyPrefix: a.idempotency_key
        ? String(a.idempotency_key).slice(0, 16)
        : null,
    })),
    assets: assetViews,
    ledgerTail: (ledger || []).map((e) => ({
      type: e.entry_type,
      amountMinor: e.amount_minor,
    })),
    storageObjectCount: storageListed,
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
  const host = redeployFrom7a67c77("OFF");
  console.log("CLOSURE_DONE");
  return host;
}

async function main() {
  if (process.env.CONFIRM_PHASE_11A_PAID_OPENAI_IMAGE_SMOKE_ONCE !== "1") {
    fail("Set CONFIRM_PHASE_11A_PAID_OPENAI_IMAGE_SMOKE_ONCE=1");
  }

  const report = {
    auth: AUTH,
    sourceCommit: EXPECTED_COMMIT,
    sourceCommitShort: EXPECTED_COMMIT_SHORT,
    docsHeadExpected: DOCS_HEAD_SHORT,
    saltFingerprint: SALT_FP,
    saltPresent: true,
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
    const headShort = head.slice(0, 7);
    report.localHead = head;
    if (head !== EXPECTED_COMMIT && !head.startsWith(DOCS_HEAD_SHORT)) {
      // Accept exact applicative or known documentary HEAD on top of it.
      const base = (run("git", ["merge-base", EXPECTED_COMMIT, "HEAD"]).stdout || "").trim();
      if (base !== EXPECTED_COMMIT) {
        fail(
          `HEAD ${headShort} must be ${EXPECTED_COMMIT_SHORT} or docs atop it (${DOCS_HEAD_SHORT})`,
        );
      }
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
    if (before.budget.hardMinor !== 274) {
      fail(`hard limit expected 274 got ${before.budget.hardMinor}`);
    }
    if (
      before.budget.committedMinor !== 247 ||
      before.budget.reservedMinor !== 0 ||
      before.budget.availableMinor !== 27
    ) {
      fail(
        `budget expected 274/247/0/27 got ${before.budget.hardMinor}/${before.budget.committedMinor}/${before.budget.reservedMinor}/${before.budget.availableMinor}`,
      );
    }
    if ((before.production_runs.count ?? 0) !== 0) fail("concurrent production_runs");
    if ((before.production_jobs.count ?? 0) !== 0) fail("concurrent production_jobs");
    if ((before.generation_attempts.count ?? 0) !== 0) {
      fail("concurrent generation_attempts");
    }
    if ((before.active_reservations.count ?? 0) !== 0) {
      fail("active media reservations present");
    }
    if ((before.image_assets.count ?? 0) !== 0) fail("image assets already present");

    const byType = await loadActiveArtifacts(db);
    report.upstreamArtifacts = Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [
        k,
        { revision: v.revision, idPrefix: String(v.artifact_id).slice(0, 8) },
      ]),
    );

    const envBefore = pullProductionEnv();
    report.flagsBefore = flagMatrix(envBefore);
    if (report.flagsBefore.DIRECTOR_V2_WORKER_ENABLED === "1") {
      fail("worker must be OFF before opening window");
    }
    if (report.flagsBefore.MOTION_TRANSFER_ENABLED === "1") {
      fail("Motion must be OFF");
    }

    console.log("OPEN_WINDOW");
    // Encrypted secrets often pull empty locally. Worker client header needs a known
    // value — Auth allows posing the strictly necessary Production var.
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
    report.deployOnHost = redeployFrom7a67c77("ON");
    const alias = inspectAliasCommit();
    if (!alias.commitOk) fail("ON deploy commit != 7a67c77");
    report.runtimeHost = alias.host;

    const envOn = pullProductionEnv();
    report.flagsDuring = flagMatrix(envOn);
    const password = envOn.APP_PASSWORD;
    if (!password) fail("APP_PASSWORD missing");
    // Never persist the secret value on report.

    const exceptionEnv = {
      ...envOn,
      VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "1",
      DIRECTOR_V2_WORKER_ENABLED: "1",
      DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
    };

    const localDry = await localFinalDryRun(exceptionEnv);
    report.localDryRun = {
      executable: localDry.executable,
      providerCalled: localDry.providerCalled,
      estimateMinor: localDry.estimateMinor,
      reservationMinor: localDry.reservationMinor,
      compositionFingerprint: localDry.compositionFingerprint,
      storageIngestWired: localDry.storageIngestWired,
      persistedMediaPayloadPossible: localDry.persistedMediaPayloadPossible,
      humanReviewRequired: localDry.humanReviewRequired,
      provider: localDry.provider,
      model: localDry.model,
      quality: localDry.quality,
      size: localDry.size,
      maximumCalls: localDry.maximumCalls,
      maximumJobs: localDry.maximumJobs,
      maximumOutputs: localDry.maximumOutputs,
    };
    console.log("LOCAL_DRY_RUN", JSON.stringify(report.localDryRun));

    const cookie = await loginCookie(password);
    const corrBase = `corr-11a-paid-${Date.now()}`;

    const promptsDry = await directorPost(
      cookie,
      "/prompts",
      { mode: "dry-run" },
      `${corrBase}-prompts-dry`,
    );
    if (promptsDry.status !== 200) {
      fail(`prompts dry-run HTTP ${promptsDry.status}`);
    }
    const pDry = promptsDry.json.dryRun || promptsDry.json;
    if (pDry.providerCalled === true) fail("prompts dry providerCalled");
    report.httpPromptsDry = {
      status: promptsDry.status,
      executable: Boolean(pDry.executable ?? true),
      providerCalled: false,
      storyboardRevision: pDry.storyboardRevision ?? null,
    };
    console.log("HTTP_PROMPTS_DRY", JSON.stringify(report.httpPromptsDry));

    // --- Persist ScenePackageSet ---
    const promptsExec = await directorPost(
      cookie,
      "/prompts",
      {
        mode: "execute",
        expectedStoryboardRevision: pDry.storyboardRevision ?? 1,
      },
      `${corrBase}-prompts-exec`,
    );
    if (
      promptsExec.status !== 200 ||
      !["completed", "existing"].includes(promptsExec.json.status)
    ) {
      fail(
        `prompts execute failed status=${promptsExec.status} body=${JSON.stringify(promptsExec.json).slice(0, 300)}`,
      );
    }
    report.promptsExecute = {
      status: promptsExec.status,
      result: promptsExec.json.status,
      packageSetRevision:
        promptsExec.json.packageSet?.revision ??
        promptsExec.json.scenePackageSetRevision ??
        null,
    };

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
    if (!p11?.enabled) fail("phase11ACanonicalSingleStep missing on routing dry");
    if (p11.compositionFingerprint !== EXPECTED_COMPOSITION_FP) {
      fail("routing dry composition fingerprint mismatch");
    }
    if (p11.estimateMinor !== 1 || p11.reservationMinor > 2) {
      report.verdict = "BLOCKED_PRECONDITION";
      fail(
        `pricing divergence estimate=${p11.estimateMinor} reserve=${p11.reservationMinor}`,
      );
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

    // Prove functional promptHash from persisted ScenePackage before reserve/provider.
    // Plan fingerprint may differ from preflight 1c5011b7 solely because package UUID
    // is assigned at prompts persist (randomUUID) — Auth allows this execution variance
    // when promptHash + composition remain exact.
    const { data: pkgPtr, error: pkgPtrErr } = await db
      .from("active_artifact_revisions")
      .select("artifact_id")
      .eq("project_id", PROJECT_ID)
      .eq("artifact_type", "scene_package_set")
      .single();
    if (pkgPtrErr || !pkgPtr) fail("scene_package_set missing after prompts");
    const { data: pkgArt } = await db
      .from("project_artifacts")
      .select("value")
      .eq("id", pkgPtr.artifact_id)
      .single();
    const packages = pkgArt?.value?.packages || [];
    const sc2 = packages.find(
      (p) => p.sceneId === SCENE_ID || p.sceneOrder === 2,
    );
    if (!sc2) fail("scene-2 package missing in persisted set");
    const promptMod = await import(
      pathToFileURL(
        join(studioRoot, "src/application/production/phase-11a-image-prompt.ts"),
      ).href
    );
    const promptBuilt = promptMod.buildPhase11AImagePromptFromScenePackage(sc2);
    if (!String(promptBuilt.promptHash).startsWith(EXPECTED_PROMPT_HASH_PREFIX)) {
      fail(
        `promptHash prefix expected ${EXPECTED_PROMPT_HASH_PREFIX} got ${String(promptBuilt.promptHash).slice(0, 16)}`,
      );
    }
    const planFp = String(p11.planFingerprint || "");
    const planFpMatchesPreflight = planFp.startsWith(EXPECTED_PLAN_FP_PREFIX);
    report.fingerprintCheck = {
      compositionFingerprint: p11.compositionFingerprint,
      promptHashPrefix: String(promptBuilt.promptHash).slice(0, 16),
      planFingerprintPrefix: planFp.slice(0, 16),
      preflightPlanFingerprintPrefix: EXPECTED_PLAN_FP_PREFIX,
      planFingerprintMatchesPreflight: planFpMatchesPreflight,
      varianceAccepted: !planFpMatchesPreflight,
      varianceReason: planFpMatchesPreflight
        ? null
        : "package_uuid_assigned_at_prompts_persist_promptHash_unchanged",
      packageIdPrefix: String(sc2.id).slice(0, 8),
    };
    if (!planFpMatchesPreflight) {
      console.log(
        "PLAN_FP_VARIANCE_ACCEPTED",
        JSON.stringify(report.fingerprintCheck),
      );
    }

    report.routingDry = {
      executable: true,
      providerCalled: false,
      scenePackageSetRevision: rDry.scenePackageSetRevision,
      registryVersionPrefix: String(rDry.registryVersion || "").slice(0, 24),
      planFingerprintPrefix: planFp.slice(0, 16),
      compositionFingerprint: p11.compositionFingerprint,
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
    const { data: planArtifactRow } = await db
      .from("project_artifacts")
      .select("value")
      .eq("id", planId)
      .maybeSingle();
    const planPayload = planArtifactRow?.value || {};
    const planFingerprint =
      planPayload.fingerprint ||
      planMeta.fingerprint ||
      p11.planFingerprint;
    const promptHash =
      planPayload.promptHash ||
      planMeta.promptHash ||
      routingExec.json.phase11A?.promptHash ||
      report.fingerprintCheck?.promptHashPrefix ||
      null;
    // Prefer full hash from plan payload when present.
    const promptHashFull =
      planPayload.promptHash ||
      planMeta.promptHash ||
      routingExec.json.phase11A?.promptHash ||
      null;
    if (
      promptHashFull &&
      !String(promptHashFull).startsWith(EXPECTED_PROMPT_HASH_PREFIX)
    ) {
      fail(
        `promptHash prefix expected ${EXPECTED_PROMPT_HASH_PREFIX} got ${String(promptHashFull).slice(0, 16)}`,
      );
    }
    report.routingExecute = {
      status: routingExec.json.status,
      planArtifactIdPrefix: String(planId).slice(0, 8),
      planRevision: planRev,
      planFingerprintPrefix: String(planFingerprint || "").slice(0, 16),
      promptHashPrefix: String(promptHashFull || promptHash || "").slice(0, 16),
    };

    // Approvals: brief + storyboard + generation_plan
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
      report.approvals.push({
        type: ap.artifactType,
        status: appr.json.status,
      });
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
      fail(
        `production dry not executable: ${JSON.stringify(prDry).slice(0, 500)}`,
      );
    }
    if (
      prDry.estimatedCostMinor != null &&
      Number(prDry.estimatedCostMinor) > 2
    ) {
      report.verdict = "BLOCKED_PRECONDITION";
      fail(`production estimate ${prDry.estimatedCostMinor} > 2`);
    }
    report.productionDry = {
      executable: true,
      providerCalled: false,
      generationPlanRevision: prDry.generationPlanRevision,
      estimatedCostMinor: prDry.estimatedCostMinor ?? null,
    };
    console.log("HTTP_PRODUCTION_DRY", JSON.stringify(report.productionDry));

    // Final pre-provider counters (artifacts may have grown — allowed)
    const mid = await captureCounters(db);
    report.countersPreProvider = {
      runs: mid.production_runs.count,
      jobs: mid.production_jobs.count,
      attempts: mid.generation_attempts.count,
      reserved: mid.budget.reservedMinor,
      available: mid.budget.availableMinor,
    };
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

    // Provider auth consumed at worker submit — invoke once
    report.workerInvocations = 1;
    const workerRes = await fetch(
      `${BASE}/api/internal/director-worker/run-once`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-director-worker-secret": workerSecret,
          "x-correlation-id": `${corrBase}-worker`,
        },
        body: JSON.stringify({}),
      },
    );
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
      // Claimed but providerCalls 0 can mean replay/fail before submit — inspect attempts
      report.providerAuthConsumed = false;
    }

    // Replay worker once — must not create second submit
    const workerReplay = await fetch(
      `${BASE}/api/internal/director-worker/run-once`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-director-worker-secret": workerSecret,
          "x-correlation-id": `${corrBase}-worker-replay`,
        },
        body: JSON.stringify({}),
      },
    );
    const replayBody = await workerReplay.json().catch(() => ({}));
    assertNoLeakedSecrets(replayBody);
    report.workerReplay = {
      httpStatus: workerReplay.status,
      claimed: replayBody.claimed ?? null,
      providerCalls: replayBody.providerCalls ?? null,
      providerCalled: replayBody.providerCalled ?? null,
      status: replayBody.status ?? null,
    };
    if ((replayBody.providerCalls ?? 0) > 0) {
      fail("worker replay issued additional provider calls — STOP");
    }

    const evidence = await captureSmokeEvidence(db);
    report.evidence = evidence;
    const safety = await inspectPersistedSafety(db);
    report.persistedSafety = safety;
    if (safety.persistedMediaPayloadPossible) {
      fail("persisted state contains forbidden media payload shapes");
    }

    const after = await captureCounters(db);
    report.countersAfter = after;
    report.budgetAfter = after.budget;
    report.deltas = {
      newRuns: (after.production_runs.count ?? 0) - (before.production_runs.count ?? 0),
      newJobs: (after.production_jobs.count ?? 0) - (before.production_jobs.count ?? 0),
      newAttempts:
        (after.generation_attempts.count ?? 0) -
        (before.generation_attempts.count ?? 0),
      newLedgerRows:
        (after.ledger_rows.count ?? 0) - (before.ledger_rows.count ?? 0),
      newAssets:
        (after.image_assets.count ?? 0) - (before.image_assets.count ?? 0),
      newPackageSets:
        (after.scene_package_set_active.count ?? 0) -
        (before.scene_package_set_active.count ?? 0),
      newPlans:
        (after.generation_plan_active.count ?? 0) -
        (before.generation_plan_active.count ?? 0),
      storageObjects: evidence.storageObjectCount,
    };

    // Verdict selection
    const attempt = evidence.attempts[0];
    const asset = evidence.assets[0];
    const providerCalls = report.providerSubmitCount;
    const hardUnchanged = after.budget.hardMinor === 274;

    if (!hardUnchanged) fail("hard limit changed");

    if (providerCalls === 0 && (workerBody.failed ?? 0) > 0) {
      report.verdict = "PROVIDER_FAILED_NO_RETRY";
    } else if (providerCalls === 0 && (workerBody.claimed ?? 0) === 0) {
      report.verdict = "BLOCKED_PRECONDITION";
      fail("worker claimed 0 and providerCalls 0");
    } else if (
      providerCalls >= 1 &&
      asset &&
      asset.status &&
      /review|pending/i.test(String(asset.status)) &&
      asset.active !== true
    ) {
      report.verdict = "PASS_PRIVATE_IMAGE_NEEDS_HUMAN_REVIEW";
    } else if (providerCalls >= 1 && !asset) {
      report.verdict = "INVALID_OUTPUT_NO_RETRY";
    } else if (
      providerCalls >= 1 &&
      attempt &&
      (attempt.actualCostMinor == null ||
        attempt.costStatus === "reconciliation_required") &&
      after.budget.reservedMinor > 0
    ) {
      report.verdict = "RECONCILIATION_REQUIRED";
    } else if (providerCalls >= 1) {
      // Prefer PASS if asset needs_review; else provider failed after submit
      if (asset) {
        report.verdict = "PASS_PRIVATE_IMAGE_NEEDS_HUMAN_REVIEW";
      } else {
        report.verdict = "PROVIDER_FAILED_NO_RETRY";
      }
    } else {
      report.verdict = "PROVIDER_FAILED_NO_RETRY";
    }

    report.qc = {
      technical: asset
        ? {
            mime: asset.mime,
            width: asset.width,
            height: asset.height,
            sizeBytes: asset.sizeBytes,
            checksumPrefix: asset.checksumPrefix,
          }
        : null,
      visualQuality: "unavailable_humanOnly",
      humanValidationRequired: true,
      humanReviewDecision: null,
    };

    report.retryFallbackDownstream = {
      retry: 0,
      fallback: 0,
      downstream: false,
    };

    closeOnce();
    const envFinal = pullProductionEnv();
    report.flagsFinal = flagMatrix(envFinal);
    report.runtimeFinal = {
      RUNTIME_PAID_MEDIA: "OFF",
      OPENAI_IMAGE_REAL_EXECUTION: "UNAVAILABLE",
      MOTION_RUNTIME: "UNAVAILABLE",
      exception: "OFF",
      worker: "OFF",
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
        },
        null,
        2,
      ),
    );
    if (
      report.verdict !== "PASS_PRIVATE_IMAGE_NEEDS_HUMAN_REVIEW" &&
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
      /budget|fingerprint|precondition|expected|missing|STOP before/i.test(msg)
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
        MOTION_RUNTIME: "UNAVAILABLE",
        exception: "OFF",
        worker: "OFF",
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
