#!/usr/bin/env node
/**
 * Phase 11A corrected overlay recomposition LIVE preflight (245bea2).
 *
 *   CONFIRM_PHASE_11A_CORRECTED_OVERLAY_RECOMPOSITION_PREFLIGHT=1 \
 *   node --import tsx scripts/phase-11a-corrected-overlay-recomposition-preflight-245bea2.mjs
 *
 * Deploys/uses Ready 245bea2, reads the existing provider PNG once via a 60s
 * signed URL, composes twice in memory with compositor 1.1.0, writes a
 * gitignored visual crop, then closes all gates. No Production write.
 *
 * Forbidden: OpenAI, Paid Media, VHS-124, worker, Storage write, asset insert,
 * PHASE_11A_ALLOW_EXECUTE=1, logging signed URLs / base64 / pixels.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const EXPECTED_COMMIT = "245bea2152d29ff158197a946bf5856b3055b929";
const EXPECTED_COMMIT_SHORT = "245bea2";
const KNOWN_READY_HOST =
  "virtual-humans-6ha3r9yfu-javachrist-projects.vercel.app";
const BASE = process.env.PHASE_11A_BASE_URL || "https://virtual-humans.vercel.app";
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const AUTH = "AUTH_11A_CORRECTED_OVERLAY_RECOMPOSITION_PREFLIGHT_NO_PROVIDER";
const CONFIRM_ENV = "CONFIRM_PHASE_11A_CORRECTED_OVERLAY_RECOMPOSITION_PREFLIGHT";
const REJECTED_ASSET_PREFIX = "5d68ef64";
const REJECTED_CHECKSUM_PREFIX = "c508e3e54f2ccac7";
const PROVIDER_ASSET_PREFIX = "7832765d";
const PROVIDER_CHECKSUM_PREFIX = "1ac51f484420ef88";
const COMPOSED_REJECTED_PREFIX = "6a2beca9";
const COMPOSED_REJECTED_CHECKSUM_PREFIX = "d056b85aa4f9452d";
const COMPOSED_DECISION_PREFIX = "f1fcb832";
const EXPECTED_BYTES = 1_131_237;
const EXPECTED_OVERLAY_FP =
  "fdfae63fe1c7d003d9e4190bf0aea904fdab59caa2ddad5c2972cb6c39a423b9";
const EXPECTED_COMPOSITOR = "phase-11a-bitmap-compositor-1.1.0";
const FORBIDDEN_COMPOSITOR = "phase-11a-bitmap-compositor-1.0.0";
const EXPECTED_ATLAS = "vhs-overlay-latin-bitmap-shapes-v1";
const RUN_PREFIX = "39329a01";
const JOB_PREFIX = "edc6e84a";
const BUCKET = "director-final-assets";
const SUPABASE_HOST = "ejdbksxaswhdtsudnmvi.supabase.co";
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const SIGNED_TTL_SEC = 60;
const SALT = `11a-corrected-recomposition-preflight-245bea2-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(4).toString("hex")}`;
const SALT_FP = createHash("sha256").update(SALT).digest("hex").slice(0, 16);

const ON_FLIP = {
  PHASE_11A_SOURCE_COMMIT: EXPECTED_COMMIT,
  PHASE_11A_COMPOSITION_PREFLIGHT: "1",
  PHASE_11A_COMPOSITION_PREFLIGHT_SALT: SALT,
};

const ALWAYS_OFF = {
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
  VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
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
  PHASE_11A_COMPOSITION_PREFLIGHT: "0",
  PHASE_11A_COMPOSITION_PREFLIGHT_SALT: "closed",
  PHASE_11A_SOURCE_COMMIT: "closed",
};

function fail(msg) {
  const err = new Error(msg);
  err.name = "Phase11APreflightStop";
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
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
      `OK | update | ${key} | LAST_EXPLICIT_WRITE=${value === "0" || value === "1" || value === "closed" ? value : "[set]"}`,
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
      `OK | add | ${key} | LAST_EXPLICIT_WRITE=${value === "0" || value === "1" || value === "closed" ? value : "[set]"}`,
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
  const tmp = join(studioRoot, ".tmp", "phase-11a-vercel-env.tmp");
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

function inspectHostCommit(host) {
  const logs = run("npx", ["vercel", "inspect", host, "--logs"]);
  const lt = `${logs.stdout || ""}\n${logs.stderr || ""}`;
  const commitMatch = lt.match(/Commit:\s+([0-9a-f]{7,40})/i);
  return { host, commit: commitMatch?.[1] || "", logs: lt };
}

function hostMatchesSource(found) {
  return (
    found.commit.startsWith(EXPECTED_COMMIT_SHORT) ||
    found.logs.includes(`Commit: ${EXPECTED_COMMIT_SHORT}`) ||
    found.logs.includes(EXPECTED_COMMIT)
  );
}

function inspectAliasCommit() {
  const inspect = run("npx", ["vercel", "inspect", "virtual-humans.vercel.app"]);
  const t = `${inspect.stdout || ""}\n${inspect.stderr || ""}`;
  const urlMatch = t.match(
    /https:\/\/(virtual-humans-[a-z0-9]+-javachrist-projects\.vercel\.app)/i,
  );
  const host = urlMatch?.[1] || "virtual-humans.vercel.app";
  return { host, inspectText: t, found: inspectHostCommit(host) };
}

function resolveSourceHost() {
  const alias = inspectAliasCommit();
  if (hostMatchesSource(alias.found)) {
    console.log(`SOURCE_HOST alias Ready ${EXPECTED_COMMIT_SHORT} host=${alias.host}`);
    return alias.host;
  }
  console.log(
    `ALIAS_NOT_SOURCE host=${alias.host} commit=${alias.found.commit || "unknown"} — checking known Ready`,
  );
  const known = inspectHostCommit(KNOWN_READY_HOST);
  if (hostMatchesSource(known)) {
    console.log(`SOURCE_HOST known Ready ${EXPECTED_COMMIT_SHORT} host=${KNOWN_READY_HOST}`);
    return KNOWN_READY_HOST;
  }
  fail(
    `BLOCKED_DEPLOYMENT: no Ready ${EXPECTED_COMMIT_SHORT} host (alias=${alias.found.commit || "unknown"})`,
  );
}

function redeployProd(label, sourceHost) {
  console.log(`REDEPLOY_${label}_START source=${EXPECTED_COMMIT_SHORT} host=${sourceHost}`);
  const r = run("npx", [
    "vercel",
    "redeploy",
    sourceHost,
    "--target",
    "production",
    "--non-interactive",
  ]);
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  console.log(out.split(/\r?\n/).slice(-20).join("\n"));
  if (r.status !== 0) fail(`redeploy ${label} failed`);
  for (let i = 0; i < 40; i++) {
    spawnSync("powershell", ["-NoProfile", "-Command", "Start-Sleep -Seconds 15"], {
      shell: false,
    });
    const inspect = run("npx", ["vercel", "inspect", "virtual-humans.vercel.app"]);
    const t = `${inspect.stdout || ""}\n${inspect.stderr || ""}`;
    if (/status\s+●\s+Ready/i.test(t) || /status\t● Ready/.test(t)) {
      const urlMatch = t.match(
        /https:\/\/(virtual-humans-[a-z0-9]+-javachrist-projects\.vercel\.app)/i,
      );
      const host = urlMatch?.[1] || "virtual-humans.vercel.app";
      const logs = inspectHostCommit(host);
      if (!hostMatchesSource(logs)) {
        fail(`redeploy ${label} Ready but commit != ${EXPECTED_COMMIT_SHORT}`);
      }
      console.log(`REDEPLOY_${label}_READY host=${host} commit=${EXPECTED_COMMIT_SHORT}`);
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
  const urlHost = new URL(remote.SUPABASE_URL).hostname;
  if (urlHost !== SUPABASE_HOST) fail(`unexpected Supabase host ${urlHost}`);
  return createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function countOrZero(r, label = "counter") {
  if (r.error) {
    const msg = String(r.error.message || r.error.code || "");
    if (!msg || /does not exist|Could not find|schema cache|permission|JWT/i.test(msg)) {
      return { missing: true, count: null, error: msg || "empty_error" };
    }
    fail(`counter query failed (${label}): ${msg}`);
  }
  return { missing: false, count: r.count ?? 0 };
}

async function countStorageObjects(db) {
  const prefixes = [
    `${WORKSPACE_ID}/${PROJECT_ID}/media/image`,
    `${WORKSPACE_ID}/${PROJECT_ID}/media/image/composed`,
  ];
  let total = 0;
  for (const prefix of prefixes) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 100 });
    if (error) {
      const msg = String(error.message || "");
      if (/not found|does not exist/i.test(msg) && prefix.endsWith("/composed")) continue;
      fail(`storage list ${prefix}: ${msg}`);
    }
    total += (data || []).filter((o) => o.name && !String(o.name).endsWith("/")).length;
  }
  return total;
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
    quality,
    migrations,
    policy,
    ledgerCountRes,
  ] = await Promise.all([
    db.from("production_runs").select("id", { count: "exact", head: true }).eq("project_id", PROJECT_ID),
    db.from("production_jobs").select("id", { count: "exact", head: true }).eq("project_id", PROJECT_ID),
    db.from("generation_attempts").select("id", { count: "exact", head: true }).eq("project_id", PROJECT_ID),
    db
      .from("budget_reservations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", WORKSPACE_ID)
      .eq("status", "active"),
    db.from("assets").select("id", { count: "exact", head: true }).eq("project_id", PROJECT_ID),
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
      .from("active_artifact_revisions")
      .select("artifact_id", { count: "exact", head: true })
      .eq("project_id", PROJECT_ID)
      .eq("artifact_type", "quality_report"),
    db.from("schema_migrations").select("version", { count: "exact", head: true }),
    db.from("workspace_budget_policies").select("hard_limit_minor").eq("workspace_id", WORKSPACE_ID).maybeSingle(),
    db.from("cost_ledger").select("id", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID),
  ]);

  const hard = Number(policy.data?.hard_limit_minor ?? NaN);
  const { data: resRows, error: resErr } = await db
    .from("budget_reservations")
    .select("amount_minor,status")
    .eq("workspace_id", WORKSPACE_ID);
  if (resErr) fail(`budget reservations: ${resErr.message}`);
  let reserved = 0;
  for (const row of resRows ?? []) {
    if (String(row.status || "") === "active") reserved += Number(row.amount_minor || 0);
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
    const a = Number(e.amount_minor || 0);
    if (t === "commit") commitSum += a;
    if (t === "refund") refunds += a;
  }
  const committedMinor = Math.max(commitSum - refunds, 0);
  const available = Number.isFinite(hard) ? hard - reserved - committedMinor : null;
  if (policy.error) fail(`budget policy query failed: ${policy.error.message || policy.error.code}`);

  return {
    production_runs: countOrZero(runs, "production_runs"),
    production_jobs: countOrZero(jobs, "production_jobs"),
    generation_attempts: countOrZero(attempts, "generation_attempts"),
    active_reservations: countOrZero(reservations, "reservations"),
    image_assets: countOrZero(assets, "assets"),
    scene_package_set_active: countOrZero(packages, "scene_package_set"),
    generation_plan_active: countOrZero(plans, "generation_plan"),
    human_review_decisions: countOrZero(reviews, "human_review"),
    quality_reports: countOrZero(quality, "quality_report"),
    schema_migrations: countOrZero(migrations, "schema_migrations"),
    ledger_rows: countOrZero(ledgerCountRes, "cost_ledger"),
    storage_objects: { missing: false, count: await countStorageObjects(db) },
    budget: {
      hardMinor: hard,
      reservedMinor: reserved,
      committedMinor,
      availableMinor: available,
    },
  };
}

function assertBudgetExpected(budget) {
  if (budget.hardMinor !== 274) fail(`hard expected 274 got ${budget.hardMinor}`);
  if (budget.committedMinor !== 249) fail(`committed expected 249 got ${budget.committedMinor}`);
  if (budget.reservedMinor !== 0) fail(`reserved expected 0 got ${budget.reservedMinor}`);
  if (budget.availableMinor !== 25) fail(`available expected 25 got ${budget.availableMinor}`);
}

function assertCountersUnchanged(before, after) {
  const keys = [
    "production_runs",
    "production_jobs",
    "generation_attempts",
    "active_reservations",
    "image_assets",
    "scene_package_set_active",
    "generation_plan_active",
    "human_review_decisions",
    "quality_reports",
    "ledger_rows",
    "storage_objects",
  ];
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (b.missing || a.missing) continue;
    if (b.count !== a.count) fail(`counter delta ${key}: ${b.count} -> ${a.count}`);
  }
  if (
    before.budget.hardMinor !== after.budget.hardMinor ||
    before.budget.committedMinor !== after.budget.committedMinor ||
    before.budget.reservedMinor !== after.budget.reservedMinor
  ) {
    fail("budget changed");
  }
}

function flagMatrix(env) {
  const g = (k) => {
    const v = env[k];
    if (v == null || v === "") return "MISSING_OR_REDACTED";
    return v === "1" || v === "true" ? "1" : v === "0" || v === "false" ? "0" : "OTHER";
  };
  return {
    DIRECTOR_V2_PAID_GENERATION_ENABLED: g("DIRECTOR_V2_PAID_GENERATION_ENABLED"),
    DIRECTOR_V2_WORKER_ENABLED: g("DIRECTOR_V2_WORKER_ENABLED"),
    VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: g("VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION"),
    DIRECTOR_V2_PAID_AI_ENABLED: g("DIRECTOR_V2_PAID_AI_ENABLED"),
    MOTION_TRANSFER_ENABLED: g("MOTION_TRANSFER_ENABLED"),
    MOTION_TRANSFER_PAID_ENABLED: g("MOTION_TRANSFER_PAID_ENABLED"),
    MOTION_TRANSFER_WORKER_ENABLED: g("MOTION_TRANSFER_WORKER_ENABLED"),
    PHASE_11A_COMPOSITION_PREFLIGHT: g("PHASE_11A_COMPOSITION_PREFLIGHT"),
  };
}

function assertPaidMediaOff(flags, label) {
  const mustZero = [
    "DIRECTOR_V2_PAID_GENERATION_ENABLED",
    "DIRECTOR_V2_WORKER_ENABLED",
    "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
    "DIRECTOR_V2_PAID_AI_ENABLED",
    "MOTION_TRANSFER_ENABLED",
    "MOTION_TRANSFER_PAID_ENABLED",
    "MOTION_TRANSFER_WORKER_ENABLED",
  ];
  for (const k of mustZero) {
    if (flags[k] === "1") fail(`${label}: ${k} must stay OFF`);
  }
}

async function assertHistoricalTargets(db) {
  const { data: assets, error } = await db
    .from("assets")
    .select(
      "id,status,kind,mime_type,storage_bucket,storage_path,checksum,size_bytes,width,height,provenance,scene_id,source_kind,source_provider,run_id",
    )
    .eq("project_id", PROJECT_ID)
    .eq("kind", "image");
  if (error) fail(`assets: ${error.message}`);

  const rejected = (assets ?? []).find((a) => String(a.id).startsWith(REJECTED_ASSET_PREFIX));
  if (!rejected) fail("rejected asset missing");
  if (String(rejected.status) !== "rejected") fail(`rejected status ${rejected.status}`);
  const rejectedProv = rejected.provenance && typeof rejected.provenance === "object" ? rejected.provenance : {};
  if (rejectedProv.active === true) fail("rejected asset must remain active=false");
  if (String(rejected.checksum || "").slice(0, 16) !== REJECTED_CHECKSUM_PREFIX) {
    fail("rejected checksum changed");
  }

  const { data: reviews, error: rErr } = await db
    .from("human_review_decisions")
    .select("id,decision,reviewed_issue_codes")
    .eq("project_id", PROJECT_ID);
  if (rErr) fail(`human_review_decisions: ${rErr.message}`);
  const rejectedReviews = (reviews ?? []).filter((d) => String(d.decision) === "rejected");
  if (rejectedReviews.length !== 2) fail(`expected exactly 2 REJECT got ${rejectedReviews.length}`);
  const composedDecision = (reviews ?? []).find((d) => String(d.id).startsWith(COMPOSED_DECISION_PREFIX));
  if (!composedDecision) fail("composed HR decision missing");
  if (String(composedDecision.decision) !== "rejected") fail("composed decision mutated");
  const issueCodes = Array.isArray(composedDecision.reviewed_issue_codes)
    ? composedDecision.reviewed_issue_codes
    : [];
  if (!issueCodes.includes("human.corrupted_overlay_glyphs")) {
    fail("composed issue code mutated");
  }

  const provider = (assets ?? []).find((a) => String(a.id).startsWith(PROVIDER_ASSET_PREFIX));
  if (!provider) fail("provider asset missing");
  if (String(provider.checksum || "").slice(0, 16) !== PROVIDER_CHECKSUM_PREFIX) {
    fail("provider checksum mismatch");
  }
  if (String(provider.mime_type) !== "image/png") fail(`provider mime ${provider.mime_type}`);
  if (Number(provider.width) !== 1024 || Number(provider.height) !== 1024) {
    fail(`provider dims ${provider.width}x${provider.height}`);
  }
  if (Number(provider.size_bytes) !== EXPECTED_BYTES) fail(`provider size ${provider.size_bytes}`);
  if (String(provider.storage_bucket) !== BUCKET) fail(`provider bucket ${provider.storage_bucket}`);
  const prov = provider.provenance && typeof provider.provenance === "object" ? provider.provenance : {};
  if (prov.active === true) fail("provider asset must remain active=false");
  if (String(provider.storage_path || "").includes("/composed/")) {
    fail("provider path looks composed");
  }
  const composedRejected = (assets ?? []).find((a) => String(a.id).startsWith(COMPOSED_REJECTED_PREFIX));
  if (!composedRejected) fail("rejected composed asset missing");
  if (String(composedRejected.status) !== "rejected") fail(`composed status ${composedRejected.status}`);
  if (String(composedRejected.checksum || "").slice(0, 16) !== COMPOSED_REJECTED_CHECKSUM_PREFIX) {
    fail("composed rejected checksum changed");
  }
  const composedProv =
    composedRejected.provenance && typeof composedRejected.provenance === "object"
      ? composedRejected.provenance
      : {};
  if (composedProv.active === true) fail("composed rejected must remain active=false");

  const composedChildren = (assets ?? []).filter((a) => {
    const p = a.provenance && typeof a.provenance === "object" ? a.provenance : {};
    return String(p.parentAssetId || "").startsWith(PROVIDER_ASSET_PREFIX);
  });
  if (composedChildren.length !== 1) fail(`expected 1 composed child got ${composedChildren.length}`);
  if (!String(composedChildren[0].id).startsWith(COMPOSED_REJECTED_PREFIX)) {
    fail("unexpected composed child");
  }

  const { data: runs, error: runErr } = await db
    .from("production_runs")
    .select("id,status,state")
    .eq("project_id", PROJECT_ID);
  if (runErr) fail(`run: ${runErr.message}`);
  const run = (runs ?? []).find((r) => String(r.id).startsWith(RUN_PREFIX));
  if (!run) fail("run missing");
  if (String(run.status) !== "completed") fail(`run status ${run.status}`);
  const waiting = run.state && typeof run.state === "object" ? run.state.waitingReason : null;
  if (waiting === "needs_review") fail("waitingReason must stay closed");

  const { data: jobs, error: jobErr } = await db
    .from("production_jobs")
    .select("id,status,provider_id")
    .eq("project_id", PROJECT_ID);
  if (jobErr) fail(`job: ${jobErr.message}`);
  const job = (jobs ?? []).find((j) => String(j.id).startsWith(JOB_PREFIX));
  if (!job) fail("provider job missing");
  if (String(job.status) !== "completed") fail(`job status ${job.status}`);

  return {
    rejectedAssetPrefix: REJECTED_ASSET_PREFIX,
    rejectedStatus: rejected.status,
    rejectedActive: false,
    humanReviewRejectCount: rejectedReviews.length,
    composedRejectedPrefix: COMPOSED_REJECTED_PREFIX,
    composedRejectedChecksumPrefix: COMPOSED_REJECTED_CHECKSUM_PREFIX,
    composedDecisionPrefix: COMPOSED_DECISION_PREFIX,
    composedChildCount: 1,
    providerAssetPrefix: PROVIDER_ASSET_PREFIX,
    providerChecksumPrefix: PROVIDER_CHECKSUM_PREFIX,
    providerMime: provider.mime_type,
    providerWidth: provider.width,
    providerHeight: provider.height,
    providerBytes: provider.size_bytes,
    providerStatus: provider.status,
    providerActive: false,
    providerStoragePathSegments: String(provider.storage_path || "").split("/").length,
    runPrefix: RUN_PREFIX,
    runStatus: run.status,
    waitingReason: waiting,
    jobPrefix: JOB_PREFIX,
    jobStatus: job.status,
    storagePath: provider.storage_path,
    storageBucket: provider.storage_bucket,
    providerChecksum: provider.checksum,
  };
}

async function downloadExistingPngOnce(db, storagePath) {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) fail(`signed url: ${error?.message || "missing"}`);
  let signedUrl = data.signedUrl;
  let parsed;
  try {
    parsed = new URL(signedUrl);
  } catch {
    signedUrl = null;
    fail("signed url parse failed");
  }
  if (parsed.protocol !== "https:") fail("signed url must be https");
  if (parsed.hostname !== SUPABASE_HOST) fail("signed url host unexpected");
  if (parsed.pathname.includes("..")) fail("signed url path hostile");

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  let buf = null;
  try {
    const res = await fetch(signedUrl, {
      method: "GET",
      redirect: "error",
      signal: ac.signal,
    });
    if (!res.ok) fail(`download HTTP ${res.status}`);
    const mime = String(res.headers.get("content-type") || "").split(";")[0].trim();
    if (mime !== "image/png") fail(`download mime ${mime}`);
    const lenHeader = res.headers.get("content-length");
    if (lenHeader) {
      const n = Number(lenHeader);
      if (!Number.isFinite(n) || n <= 0 || n > MAX_DOWNLOAD_BYTES) {
        fail(`content-length out of bounds`);
      }
    }
    const raw = new Uint8Array(await res.arrayBuffer());
    if (raw.byteLength > MAX_DOWNLOAD_BYTES) fail("download exceeds 8 MiB");
    if (raw.byteLength !== EXPECTED_BYTES) fail(`download size ${raw.byteLength}`);
    buf = raw;
  } finally {
    clearTimeout(timer);
    signedUrl = null;
    parsed = null;
  }
  return buf;
}

function writeReport(report) {
  const blob = JSON.stringify(report);
  planMod.assertPhase11ACompositionPreflightReportRedacted(blob);
  const dir = join(studioRoot, ".tmp");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "phase-11a-corrected-overlay-recomposition-preflight.json"), `${blob}\n`);
}

const planMod = await import(
  pathToFileURL(
    join(studioRoot, "src/application/production/phase-11a-existing-provider-composition-preflight.ts"),
  ).href
);
const pngMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-png-rgb.ts")).href
);
const inspectMod = await import(
  pathToFileURL(
    join(studioRoot, "src/application/production/phase-11a-png-scanline-filter-inspect.ts"),
  ).href
);
const composeMod = await import(
  pathToFileURL(
    join(studioRoot, "src/application/production/phase-11a-deterministic-compositor.ts"),
  ).href
);
const overlayMod = await import(
  pathToFileURL(join(studioRoot, "src/domain/production/image-text-overlay.ts")).href
);
const copyMod = await import(
  pathToFileURL(
    join(studioRoot, "src/application/production/phase-11a-strip-overlay-copy-dry-run.ts"),
  ).href
);
const qcMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-typographic-qc.ts")).href
);
const techMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-image-technical-qc.ts")).href
);
const fontMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-overlay-font.ts")).href
);
const atlasMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-overlay-latin-bitmap.ts")).href
);
const ingestMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-composed-ingest.ts")).href
);

async function probeClosed() {
  const res = await fetch(`${BASE}/api/director/projects/${PROJECT_ID}/prompts`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ mode: "dry-run" }),
  });
  if (res.status !== 401 && res.status !== 404) {
    fail(`closed probe expected 401/404 got ${res.status}`);
  }
  return res.status;
}

async function main() {
  if (process.env[CONFIRM_ENV] !== "1") fail(`${CONFIRM_ENV} required`);
  if (process.env.PHASE_11A_ALLOW_EXECUTE === "1") fail("PHASE_11A_ALLOW_EXECUTE is forbidden");
  if (process.argv.includes("--execute")) fail("--execute is forbidden for this preflight");

  const gitHead = run("git", ["rev-parse", "HEAD"], { cwd: resolve(studioRoot, "..") });
  const head = String(gitHead.stdout || "").trim();
  if (head !== EXPECTED_COMMIT) fail(`git HEAD ${head} != ${EXPECTED_COMMIT}`);
  const behind = run("git", ["rev-list", "--count", "HEAD..origin/main"], {
    cwd: resolve(studioRoot, ".."),
  });
  if (String(behind.stdout || "").trim() !== "0") fail("origin/main behind != 0");

  const report = {
    auth: AUTH,
    verdict: null,
    sourceCommit: EXPECTED_COMMIT,
    sourceCommitShort: EXPECTED_COMMIT_SHORT,
    saltFingerprint: SALT_FP,
    providerCalled: false,
    providerAssetRead: false,
    providerAssetChecksumMatch: false,
    pngDecoded: false,
    pngFiltersEncountered: null,
    compositorExecutable: true,
    compositionSucceeded: false,
    overlaySpecValid: false,
    titleExact: false,
    ctaExact: false,
    safeAreasValid: false,
    overflow: false,
    contrastValid: false,
    composedPngValid: false,
    composedDimensions: null,
    composedChecksumPrefix: null,
    ProductionStorageWrite: false,
    composedAssetCreated: false,
    HumanReviewRequired: true,
    signedUrlCount: 0,
    signedUrlTtlSec: SIGNED_TTL_SEC,
    signedUrlPersisted: false,
    storageDownloads: 0,
    storageWrites: 0,
    residualText: "unavailable_humanOnly",
    ocr: "unavailable_humanOnly",
  };

  let sourceHost = null;
  let closed = false;
  let windowOpened = false;
  let providerBuf = null;
  let composedPng = null;

  try {
    sourceHost = resolveSourceHost();
    report.sourceHostBefore = sourceHost;

    const db = remoteDb();
    const before = await captureCounters(db);
    report.countersBefore = before;
    assertBudgetExpected(before.budget);
    if (before.active_reservations.missing === false && before.active_reservations.count !== 0) {
      fail("active reservations must be 0");
    }
    const targets = await assertHistoricalTargets(db);
    report.historical = {
      ...targets,
      storagePath: undefined,
      providerChecksum: undefined,
    };
    const storagePath = targets.storagePath;
    const expectedChecksum = targets.providerChecksum;

    const envBefore = pullProductionEnv();
    const flagsBefore = flagMatrix(envBefore);
    report.flagsBefore = flagsBefore;
    assertPaidMediaOff(flagsBefore, "before");
    console.log("FLAGS_BEFORE", JSON.stringify(flagsBefore));

    console.log("OPEN_WINDOW composition-preflight only");
    const openFails = applyEnvMap({ ...ALWAYS_OFF, ...ON_FLIP });
    if (openFails > 0) fail(`open env writes failed count=${openFails}`);
    windowOpened = true;
    report.deployOnHost = redeployProd("ON", sourceHost);

    const envOn = pullProductionEnv();
    const flagsOn = flagMatrix(envOn);
    report.flagsDuring = flagsOn;
    assertPaidMediaOff(flagsOn, "during");
    if (flagsOn.PHASE_11A_COMPOSITION_PREFLIGHT !== "1") {
      console.log("NOTE composition gate env may be redacted after pull");
    }

    console.log("SIGNED_URL_CREATE ttl=60 in-memory");
    providerBuf = await downloadExistingPngOnce(db, storagePath);
    report.signedUrlCount = 1;
    report.storageDownloads = 1;
    report.providerAssetRead = true;

    const checksum = techMod.checksumSha256Bytes(providerBuf);
    if (checksum !== expectedChecksum) fail("BLOCKED_PROVIDER_ASSET_INTEGRITY checksum");
    if (checksum.slice(0, 16) !== PROVIDER_CHECKSUM_PREFIX) {
      fail("BLOCKED_PROVIDER_ASSET_INTEGRITY prefix");
    }
    report.providerAssetChecksumMatch = true;

    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++) {
      if (providerBuf[i] !== sig[i]) fail("BLOCKED_PROVIDER_ASSET_INTEGRITY signature");
    }
    let ihdr;
    try {
      ihdr = pngMod.readPhase11APngIhdr(providerBuf);
    } catch (e) {
      fail(`BLOCKED_PROVIDER_PNG_FORMAT ihdr: ${e.message || e}`);
    }
    if (ihdr.width !== 1024 || ihdr.height !== 1024) {
      fail(`BLOCKED_PROVIDER_PNG_FORMAT dims ${ihdr.width}x${ihdr.height}`);
    }
    if (ihdr.bitDepth !== 8 || ihdr.colorType !== 2 || ihdr.interlace !== 0) {
      fail("BLOCKED_PROVIDER_PNG_FORMAT ihdr fields");
    }
    report.ihdr = {
      width: ihdr.width,
      height: ihdr.height,
      bitDepth: ihdr.bitDepth,
      colorType: ihdr.colorType,
      interlace: ihdr.interlace,
    };

    let filters;
    try {
      filters = inspectMod.inspectPhase11APngScanlineFilters(providerBuf);
    } catch (e) {
      const code = e.code || "";
      fail(
        code === "unknown_filter" || /unsupported filter|color|interlace|gray|rgba|indexed/i.test(String(e.message || e))
          ? `BLOCKED_PROVIDER_PNG_FORMAT ${e.message || e}`
          : `BLOCKED_PROVIDER_ASSET_INTEGRITY ${e.message || e}`,
      );
    }
    report.pngFiltersEncountered = filters;
    console.log("PNG_FILTERS", JSON.stringify(filters));

    try {
      const decoded = pngMod.decodeRgbPng(providerBuf);
      if (decoded.width !== 1024 || decoded.height !== 1024) {
        fail("BLOCKED_PROVIDER_PNG_FORMAT decoded dims");
      }
      if (decoded.rgb.byteLength !== 1024 * 1024 * 3) fail("BLOCKED_PROVIDER_PNG_FORMAT rgb length");
      report.pngDecoded = true;
    } catch (e) {
      fail(`BLOCKED_PROVIDER_PNG_FORMAT decode: ${e.message || e}`);
    }

    const spec = overlayMod.createDefaultPhase11AOverlaySpec({
      locale: copyMod.PHASE_11A_SCENE2_OVERLAY_LOCALE,
      title: copyMod.PHASE_11A_SCENE2_OVERLAY_TITLE,
      callToAction: copyMod.PHASE_11A_SCENE2_OVERLAY_CTA,
    });
    const overlayFp = overlayMod.fingerprintImageTextOverlaySpec(spec);
    if (overlayFp !== EXPECTED_OVERLAY_FP) fail("overlay fingerprint mismatch");
    if (spec.locale !== "fr") fail("overlay locale");
    if (spec.title !== copyMod.PHASE_11A_SCENE2_OVERLAY_TITLE) fail("title mutated");
    if (spec.callToAction !== copyMod.PHASE_11A_SCENE2_OVERLAY_CTA) fail("cta mutated");
    if (spec.subtitle || spec.legalLine) fail("subtitle/legal must be absent");
    if (spec.fontFamily !== "vhs-overlay-latin-bitmap-v1") fail("font");
    if (spec.fontWeight !== "bold" || spec.fontSize !== 32) fail("font weight/size");
    if (spec.overflowPolicy !== "reject" || spec.contrastRequirement !== 4.5) {
      fail("overflow/contrast contract");
    }
    report.overlaySpecValid = true;
    report.titleExact = true;
    report.ctaExact = true;
    report.overlayFingerprint = overlayFp;

    let composed;
    try {
      composed = composeMod.composePhase11ADeterministicOverlay({
        providerPng: providerBuf,
        spec,
      });
    } catch (e) {
      const msg = String(e.message || e);
      if (/overflow/i.test(msg)) fail(`BLOCKED_TYPOGRAPHIC_QC overflow: ${msg}`);
      fail(`BLOCKED_COMPOSITOR_RUNTIME ${msg}`);
    }
    if (composeMod.PHASE_11A_COMPOSITOR_VERSION !== EXPECTED_COMPOSITOR) {
      fail(`runtime compositor ${composeMod.PHASE_11A_COMPOSITOR_VERSION}`);
    }
    if (atlasMod.PHASE_11A_BITMAP_GLYPH_ATLAS_ID !== EXPECTED_ATLAS) fail("atlas id");
    const requiredCps = atlasMod.overlayCodepoints(`${spec.title}${spec.callToAction}`);
    const uniqueCps = [...new Set(requiredCps)];
    if (uniqueCps.length !== 22) fail(`required codepoints ${uniqueCps.length}`);
    if (!uniqueCps.includes(0x2019)) fail("U+2019 missing from overlay");
    if (!uniqueCps.includes(0x00e9)) fail("U+00E9 missing from overlay");
    if (!uniqueCps.includes(0x00e0)) fail("U+00E0 missing from overlay");
    for (const cp of uniqueCps) {
      if (!fontMod.isPhase11AOverlayCodepointAllowed(cp)) {
        fail(`unsupported required U+${cp.toString(16)}`);
      }
      const rows = fontMod.glyphRowsForCodepoint(cp);
      if (cp !== 0x20 && atlasMod.glyphRowsEqual(rows, atlasMod.legacyHashGlyphRows(cp))) {
        fail(`legacy LCG still selected for U+${cp.toString(16)}`);
      }
    }
    report.atlasId = EXPECTED_ATLAS;
    report.legacyLcgSelected = false;
    report.requiredCodepointCount = uniqueCps.length;
    report.unsupportedFailClosed = true;

    if (composed.compositorVersion !== EXPECTED_COMPOSITOR) fail("compositor version");
    if (composed.compositorVersion === FORBIDDEN_COMPOSITOR) fail("defective compositor selected");
    if (composed.overlayFingerprint !== EXPECTED_OVERLAY_FP) fail("composed overlay fp");
    if (composed.renderedStrings[0] !== spec.title) fail("title mutated at render");
    if (composed.renderedStrings[1] !== spec.callToAction) fail("cta mutated at render");
    const ctaLines = composed.lineBoxes.filter((b) => b.role === "callToAction").map((b) => b.text);
    if (ctaLines[0] !== "Découvrir Virtual Humans" || ctaLines[1] !== "Studio") {
      fail(`cta wrap ${JSON.stringify(ctaLines)}`);
    }
    report.compositionSucceeded = true;
    composedPng = composed.png;

    const composed2 = composeMod.composePhase11ADeterministicOverlay({
      providerPng: providerBuf,
      spec,
    });
    if (composed2.checksumSha256 !== composed.checksumSha256) fail("determinism checksum");
    if (composed2.png.byteLength !== composed.png.byteLength) fail("determinism size");
    for (let i = 0; i < composed.png.byteLength; i++) {
      if (composed.png[i] !== composed2.png[i]) fail("determinism pixels");
    }
    if (JSON.stringify(composed.lineBoxes) !== JSON.stringify(composed2.lineBoxes)) {
      fail("determinism boxes");
    }
    report.deterministicPair = {
      sameChecksum: true,
      sameDimensions: true,
      sameLineBoxes: true,
      sameLines: true,
      secondDownload: false,
    };

    const typo = qcMod.validatePhase11ATypographicQc({ spec, composed });
    if (typo.status !== "accepted") {
      fail(`BLOCKED_TYPOGRAPHIC_QC ${typo.reasons.map((r) => r.code).join(",")}`);
    }
    report.safeAreasValid = true;
    report.overflow = false;
    report.contrastValid = composed.contrastRatio + 1e-9 >= 4.5;
    if (!report.contrastValid) fail("BLOCKED_TYPOGRAPHIC_QC contrast");
    if (Math.abs(composed.contrastRatio - 15.01) > 0.05) fail(`contrast ${composed.contrastRatio}`);

    const composedDims = techMod.readPngDimensions(composed.png);
    if (!composedDims || composedDims.width !== 1024 || composedDims.height !== 1024) {
      fail("BLOCKED_TYPOGRAPHIC_QC composed dims");
    }
    pngMod.decodeRgbPng(composed.png);
    if (composed.checksumSha256.slice(0, 16) === PROVIDER_CHECKSUM_PREFIX) {
      fail("corrected checksum equals parent");
    }
    if (composed.checksumSha256.slice(0, 16) === COMPOSED_REJECTED_CHECKSUM_PREFIX) {
      fail("corrected checksum equals rejected composed");
    }
    report.composedPngValid = true;
    report.composedDimensions = "1024x1024";
    report.composedChecksumSha256 = composed.checksumSha256;
    report.composedChecksumPrefix = planMod.redactChecksumPrefix(composed.checksumSha256);
    report.composedByteLength = composed.png.byteLength;
    report.distinctFromParent = true;
    report.distinctFromRejectedComposed = true;
    report.typographicQc = {
      status: typo.status,
      reasonCount: typo.reasons.length,
      humanOnlyResidual: true,
      locale: composed.locale,
      fontFamily: composed.fontFamily,
      lineCount: composed.lineBoxes.length,
      contrastRatio: composed.contrastRatio,
      title: composed.renderedStrings[0],
      callToAction: composed.renderedStrings[1],
      ctaWrap: ctaLines,
      u2019Present: spec.title.includes("\u2019"),
    };
    report.technicalQc = {
      pngValid: true,
      dimensions: "1024x1024",
      decodable: true,
      byteLength: composed.png.byteLength,
      checksumPrefix: report.composedChecksumPrefix,
      provenanceParentChildComputable: true,
    };

    const futureFp = ingestMod.fingerprintPhase11AComposedAsset({
      parentChecksumSha256: checksum,
      overlay: spec,
      compositorVersion: composed.compositorVersion,
    });
    const futureAssetId = ingestMod.composedAssetIdFromFingerprint(futureFp);
    if (futureAssetId.startsWith(COMPOSED_REJECTED_PREFIX)) {
      fail("future identity collides with rejected composed");
    }
    report.futureRecomposition = {
      compositorVersion: composed.compositorVersion,
      fingerprintPrefix: futureFp.slice(0, 16),
      assetIdPrefix: futureAssetId.slice(0, 8),
      distinctFromRejected: true,
      created: false,
    };

    const previewDir = join(studioRoot, ".tmp", "phase-11a-corrected-recomposition-preflight");
    mkdirSync(previewDir, { recursive: true });
    writeFileSync(join(previewDir, "overlay-full.png"), composed.png);
    const decodedPreview = pngMod.decodeRgbPng(composed.png);
    const titleBox = composed.lineBoxes.find((b) => b.role === "title");
    const maxRight = composed.lineBoxes.reduce((n, b) => Math.max(n, b.x + b.width), 0);
    const cropW = Math.min(1024, Math.max(titleBox.width, maxRight - (titleBox.x - 8)) + 24);
    const cropH = Math.min(
      240,
      composed.lineBoxes.reduce((h, b) => Math.max(h, b.y + b.height), 0) - titleBox.y + 32,
    );
    const crop = new Uint8Array(cropW * cropH * 3);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const sx = titleBox.x - 8 + x;
        const sy = titleBox.y - 8 + y;
        const si = (sy * 1024 + sx) * 3;
        const di = (y * cropW + x) * 3;
        crop[di] = decodedPreview.rgb[si];
        crop[di + 1] = decodedPreview.rgb[si + 1];
        crop[di + 2] = decodedPreview.rgb[si + 2];
      }
    }
    writeFileSync(join(previewDir, "title-cta-crop.png"), pngMod.encodeRgbPng({ width: cropW, height: cropH, rgb: crop }));
    writeFileSync(
      join(previewDir, "summary-redacted.json"),
      `${JSON.stringify(
        {
          compositorVersion: composed.compositorVersion,
          atlasId: EXPECTED_ATLAS,
          overlayFingerprintPrefix: composed.overlayFingerprint.slice(0, 16),
          checksumSha256: composed.checksumSha256,
          renderedStrings: composed.renderedStrings,
          lineCount: composed.lineBoxes.length,
          futureAssetIdPrefix: futureAssetId.slice(0, 8),
          productionMediaWritten: 0,
          providerCalls: 0,
        },
        null,
        2,
      )}\n`,
    );
    report.localPreview = {
      dir: ".tmp/phase-11a-corrected-recomposition-preflight",
      uploaded: false,
      versioned: false,
      signedUrlInName: false,
    };

    const after = await captureCounters(db);
    report.countersAfter = after;
    assertCountersUnchanged(before, after);
    const targetsAfter = await assertHistoricalTargets(db);
    if (targetsAfter.providerChecksum !== expectedChecksum) fail("provider checksum mutated");
    if (targetsAfter.runStatus !== "completed") fail("run mutated");
    if (targetsAfter.waitingReason === "needs_review") fail("waitingReason reopened");
    report.deltasZero = true;
    report.verdict = "READY_FOR_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION";
  } catch (e) {
    const msg = String(e.message || e);
    console.error("PREFLIGHT_STOP", msg.slice(0, 400));
    if (!report.verdict) {
      if (/BLOCKED_/.test(msg)) report.verdict = msg.split(":")[0].split(" ")[0];
      else if (/deploy|Ready|vercel/i.test(msg)) report.verdict = "BLOCKED_DEPLOYMENT";
      else if (/checksum|integrity|signature|size/i.test(msg)) {
        report.verdict = "BLOCKED_PROVIDER_ASSET_INTEGRITY";
      } else if (/png|filter|ihdr|decode/i.test(msg)) {
        report.verdict = "BLOCKED_PROVIDER_PNG_FORMAT";
      } else if (/typo|overflow|contrast|overlay/i.test(msg)) {
        report.verdict = "BLOCKED_TYPOGRAPHIC_QC";
      } else if (/compositor/i.test(msg)) {
        report.verdict = "BLOCKED_COMPOSITOR_RUNTIME";
      } else {
        report.verdict = "BLOCKED_DEPLOYMENT";
      }
    }
    report.error = msg.slice(0, 240);
    throw e;
  } finally {
    try {
      if (providerBuf) providerBuf.fill(0);
      if (composedPng) composedPng.fill(0);
    } catch {
      /* ignore */
    }
    providerBuf = null;
    composedPng = null;
    if (!closed) {
      console.log(windowOpened ? "CLOSE_WINDOW" : "CLOSE_WINDOW_SKIP_REDEPLOY_NEVER_OPENED");
      const closeFails = applyEnvMap(OFF_ALL);
      if (closeFails > 0) {
        console.error(`close env writes failed count=${closeFails}`);
      }
      if (windowOpened) {
        try {
          const host = sourceHost || resolveSourceHost();
          report.deployOffHost = redeployProd("OFF", host);
        } catch (closeErr) {
          console.error("CLOSE_REDEPLOY_FAIL", String(closeErr.message || closeErr).slice(0, 240));
          report.closeRedeployError = true;
        }
      } else {
        report.deployOffHost = report.sourceHostBefore || sourceHost;
        report.closeRedeploySkipped = true;
      }
      closed = true;
    }
    try {
      const envOff = pullProductionEnv();
      report.flagsAfter = flagMatrix(envOff);
      assertPaidMediaOff(report.flagsAfter, "after");
      if (report.flagsAfter.PHASE_11A_COMPOSITION_PREFLIGHT === "1") {
        fail("composition gate still ON after close");
      }
      report.closedProbeStatus = await probeClosed();
      report.runtimePaidMedia = "OFF";
      report.openaiImageRealExecution = "UNAVAILABLE";
      report.deterministicOverlayExecution = "UNAVAILABLE";
      report.motionRuntime = "UNAVAILABLE";
    } catch (probeErr) {
      console.error("CLOSE_VERIFY_FAIL", String(probeErr.message || probeErr).slice(0, 240));
      report.closeVerifyError = String(probeErr.message || probeErr).slice(0, 160);
    }
    try {
      writeReport(report);
    } catch (scanErr) {
      console.error("REPORT_REDACT_FAIL", String(scanErr.message || scanErr).slice(0, 160));
    }
  }

  console.log(
    JSON.stringify(
      {
        verdict: report.verdict,
        sourceCommit: EXPECTED_COMMIT_SHORT,
        saltFp: SALT_FP,
        pngFiltersEncountered: report.pngFiltersEncountered,
        providerCalled: false,
        ProductionStorageWrite: false,
        composedAssetCreated: false,
        HumanReviewRequired: true,
      },
      null,
      2,
    ),
  );
  if (report.verdict !== "READY_FOR_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION") {
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
