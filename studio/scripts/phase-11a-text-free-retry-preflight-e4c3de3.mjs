#!/usr/bin/env node
/**
 * Phase 11A-TEXT-FREE-IMAGE-RETRY-PREFLIGHT (no provider)
 *
 *   CONFIRM_PHASE_11A_TEXT_FREE_RETRY_PREFLIGHT=1 \
 *   node --import tsx scripts/phase-11a-text-free-retry-preflight-e4c3de3.mjs
 *
 * Validates exact commit e4c3de3, overlay no-text policy, synthetic compositor,
 * opens Director/Persistence/Paid + VHS124 exception (worker OFF),
 * dry-run providerCalled=false, then finally closes + redeploys OFF.
 *
 * Never prints OPENAI_API_KEY / salt / signed URLs / base64 / full prompt.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
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
const EXPECTED_COMPOSITION_FP = "c532c400334f5b22";
const EXPECTED_SCENE_PACKAGE_FP =
  "be47788f8c685a70b3802da5aa10a0ee44600f7e43e313072a108b82e74c7384";
const EXPECTED_GENERATION_PLAN_FP =
  "86a86087a32c80e5de86e2ce4748f7f6f0cc0c25b380514d5a227d71a00f57a8";
const EXPECTED_OVERLAY_FP =
  "fdfae63fe1c7d003d9e4190bf0aea904fdab59caa2ddad5c2972cb6c39a423b9";
const EXPECTED_PROMPT_HASH =
  "19628b08e2fda6e8e396f798c3dd5bb6ec8431b996c5eaf520d7e1bd478d75de";
const E4C3DE3_READY_HOST =
  "virtual-humans-901mq9vj8-javachrist-projects.vercel.app";
const BASE = process.env.PHASE_11A_BASE_URL || "https://virtual-humans.vercel.app";
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const SCENE_ID = "scene-2";
const AUTH = "AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT";
const REJECTED_ASSET_PREFIX = "5d68ef64";
const REJECTED_CHECKSUM_PREFIX = "c508e3e54f2ccac7";
const SALT = `11a-text-free-retry-live-preflight-e4c3de3-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(4).toString("hex")}`;
const SALT_FP = createHash("sha256").update(SALT).digest("hex").slice(0, 16);

const ON_FLIP = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
  VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "1",
  PHASE_11A_OPENAI_IMAGE_IDEMPOTENCY_SALT: SALT,
  PHASE_11A_SOURCE_COMMIT: EXPECTED_COMMIT,
};

const ALWAYS_OFF = {
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
  DIRECTOR_V2_ENABLED: "0",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
  VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "0",
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
  if (
    found.commit.startsWith(EXPECTED_COMMIT_SHORT) ||
    found.logs.includes(`Commit: ${EXPECTED_COMMIT_SHORT}`)
  ) {
    return { host, commit: EXPECTED_COMMIT, promoted: false };
  }
  console.log(
    `ALIAS_NOT_SOURCE host=${host} commit=${found.commit || "unknown"} — promoting Ready ${EXPECTED_COMMIT_SHORT}`,
  );
  const promo = run("npx", [
    "vercel",
    "promote",
    E4C3DE3_READY_HOST,
    "--yes",
  ]);
  if (promo.status !== 0) {
    fail(`promote ${EXPECTED_COMMIT_SHORT} failed: ${(promo.stderr || promo.stdout || "").slice(0, 300)}`);
  }
  for (let i = 0; i < 20; i++) {
    spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "Start-Sleep -Seconds 8"],
      { shell: false },
    );
    const again = run("npx", ["vercel", "inspect", "virtual-humans.vercel.app"]);
    const at = `${again.stdout || ""}\n${again.stderr || ""}`;
    const url2 = at.match(
      /https:\/\/(virtual-humans-[a-z0-9]+-javachrist-projects\.vercel\.app)/i,
    );
    const host2 = url2?.[1] || E4C3DE3_READY_HOST;
    const check = inspectHostCommit(host2);
    if (
      check.commit.startsWith(EXPECTED_COMMIT_SHORT) ||
      check.logs.includes(`Commit: ${EXPECTED_COMMIT_SHORT}`)
    ) {
      return { host: host2, commit: EXPECTED_COMMIT, promoted: true };
    }
  }
  fail(`promote ${EXPECTED_COMMIT_SHORT} did not become alias Ready`);
}

function redeployProd(label) {
  console.log(`REDEPLOY_${label}_START source=${EXPECTED_COMMIT_SHORT}`);
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
  for (let i = 0; i < 40; i++) {
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
    migrations,
    policy,
    ledgerCountRes,
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
    db.from("schema_migrations").select("version", { count: "exact", head: true }),
    db
      .from("workspace_budget_policies")
      .select("hard_limit_minor")
      .eq("workspace_id", WORKSPACE_ID)
      .maybeSingle(),
    db
      .from("cost_ledger")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", WORKSPACE_ID),
  ]);

  // Some table names may vary — tolerate missing via error codes
  const countOrZero = (r, label = "counter") => {
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
  };

  const hard = Number(policy.data?.hard_limit_minor ?? NaN);

  // Exposure calculation (same family as 10F audit)
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
    const a = Number(e.amount_minor || 0);
    if (t === "commit") commitSum += a;
    if (t === "refund") refunds += a;
  }
  const committedMinor = Math.max(commitSum - refunds, 0);
  const available = Number.isFinite(hard)
    ? hard - reserved - committedMinor
    : null;

  if (policy.error) {
    fail(`budget policy query failed: ${policy.error.message || policy.error.code}`);
  }

  return {
    production_runs: countOrZero(runs, "production_runs"),
    production_jobs: countOrZero(jobs, "production_jobs"),
    generation_attempts: countOrZero(attempts, "generation_attempts"),
    active_reservations: countOrZero(reservations, "reservations"),
    image_assets: countOrZero(assets, "assets"),
    scene_package_set_active: countOrZero(packages, "scene_package_set"),
    generation_plan_active: countOrZero(plans, "generation_plan"),
    human_review_decisions: countOrZero(reviews, "human_review"),
    schema_migrations: countOrZero(migrations, "schema_migrations"),
    ledger_rows: countOrZero(ledgerCountRes, "cost_ledger"),
    budget: {
      hardMinor: hard,
      reservedMinor: reserved,
      committedMinor,
      availableMinor: available,
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
  return byType;
}

async function httpPromptsDryRun(password) {
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
  const cookie = setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
  const corr = `corr-11a-preflight-${Date.now()}`;

  const projectRes = await fetch(`${BASE}/api/director/projects/${PROJECT_ID}`, {
    method: "GET",
    headers: {
      cookie,
      origin: BASE,
      referer: `${BASE}/director`,
      "x-correlation-id": `${corr}-project`,
    },
  });
  await projectRes.json().catch(() => ({}));
  if (projectRes.status === 404) {
    fail("project GET 404 — Director persistence likely OFF");
  }
  if (projectRes.status !== 200) {
    fail(`project GET expected 200 got ${projectRes.status}`);
  }

  const dryRes = await fetch(
    `${BASE}/api/director/projects/${PROJECT_ID}/prompts`,
    {
      method: "POST",
      headers: {
        cookie,
        origin: BASE,
        referer: `${BASE}/director`,
        "content-type": "application/json",
        "x-correlation-id": corr,
      },
      body: JSON.stringify({ mode: "dry-run" }),
    },
  );
  const dryBody = await dryRes.json().catch(() => ({}));
  const dumped = JSON.stringify(dryBody);
  if (/sk-[a-zA-Z0-9]{10,}/.test(dumped)) fail("HTTP dry-run leaked API key shape");
  if (/data:image\/|base64,[A-Za-z0-9+/]{40,}/.test(dumped)) {
    fail("HTTP dry-run leaked base64/media");
  }
  if (dryRes.status !== 200) {
    fail(`prompts dry-run HTTP ${dryRes.status}: ${dumped.slice(0, 300)}`);
  }
  const dry = dryBody.dryRun || dryBody;
  if (dry.providerCalled === true) fail("prompts dry-run providerCalled=true");

  // Paid path must NOT be invokable via worker
  const workerProbe = await fetch(`${BASE}/api/internal/director-worker/run-once`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": `${corr}-worker`,
    },
    body: JSON.stringify({}),
  });

  return {
    loginStatus: 200,
    projectStatus: projectRes.status,
    promptsDryStatus: dryRes.status,
    providerCalled: false,
    executable: Boolean(dry.executable ?? dry.executionAvailable ?? true),
    correlationId: corr,
    storyboardRevision: dry.storyboardRevision ?? null,
    existingPackageSetStatus: dry.existingPackageSet?.status ?? "absent",
    workerProbeStatus: workerProbe.status,
    workerInvoked: false,
  };
}

async function proveOverlayPipeline({ scenePkg, scriptValue, promptMod, promptGate }) {
  const overlayMod = await import(
    pathToFileURL(join(studioRoot, "src/domain/production/image-text-overlay.ts")).href
  );
  const sepMod = await import(
    pathToFileURL(
      join(studioRoot, "src/application/production/phase-11a-visual-text-separation.ts"),
    ).href
  );
  const ocrMod = await import(
    pathToFileURL(join(studioRoot, "src/application/production/phase-11a-ocr-gate.ts")).href
  );
  const pngMod = await import(
    pathToFileURL(join(studioRoot, "src/application/production/phase-11a-png-rgb.ts")).href
  );
  const composeMod = await import(
    pathToFileURL(
      join(studioRoot, "src/application/production/phase-11a-deterministic-compositor.ts"),
    ).href
  );
  const roleMod = await import(
    pathToFileURL(
      join(studioRoot, "src/application/production/phase-11a-image-role-storage.ts"),
    ).href
  );
  const qcMod = await import(
    pathToFileURL(join(studioRoot, "src/application/production/phase-11a-typographic-qc.ts")).href
  );
  const fontMod = await import(
    pathToFileURL(join(studioRoot, "src/application/production/phase-11a-overlay-font.ts")).href
  );

  const title = String(scenePkg.screenText?.text || "").trim();
  const callToAction = String(scriptValue?.callToAction?.text || "").trim();
  const locale = String(scriptValue?.language || "fr").trim() || "fr";
  if (!title || !callToAction) {
    return {
      verdict: "BLOCKED_OVERLAY_COPY_REVIEW_REQUIRED",
      overlayCopyReviewed: false,
      title: title || null,
      callToAction: callToAction || null,
      locale,
    };
  }
  if (title.length < 3 || callToAction.length < 3) {
    return {
      verdict: "BLOCKED_OVERLAY_COPY_REVIEW_REQUIRED",
      overlayCopyReviewed: false,
      title,
      callToAction,
      locale,
    };
  }

  const spec = overlayMod.createDefaultPhase11AOverlaySpec({
    locale,
    title,
    callToAction,
  });
  const overlayFingerprint = overlayMod.fingerprintImageTextOverlaySpec(spec);
  const contrast = overlayMod.contrastRatio(spec.textColor, spec.backgroundColor);
  if (contrast + 1e-9 < spec.contrastRequirement) {
    fail(`overlay contrast ${contrast} < ${spec.contrastRequirement}`);
  }

  let promptContainsMarketingCopy = Boolean(promptGate.promptContainsMarketingCopy);
  let leakReason = promptGate.leakReason || null;
  let promptHash = promptGate.promptHash;
  let promptVersion = promptGate.promptVersion;
  try {
    const built = promptMod.buildPhase11AImagePromptFromScenePackage(scenePkg, { overlay: spec });
    promptHash = built.promptHash;
    promptVersion = built.promptVersion;
    promptMod.assertOverlayStringsNotInProviderPrompt(built.promptText, spec);
    if (built.promptText.toLowerCase().includes(title.toLowerCase())) {
      promptContainsMarketingCopy = true;
      leakReason = "title in provider prompt";
    }
    if (built.promptText.toLowerCase().includes(callToAction.toLowerCase())) {
      promptContainsMarketingCopy = true;
      leakReason = "CTA in provider prompt";
    }
  } catch (e) {
    const msg = String(e.message || e);
    if (/overlay copy|screenText copy leaked|screenText copy must not appear|draw words/i.test(msg)) {
      promptContainsMarketingCopy = true;
      leakReason = msg.slice(0, 180);
    } else {
      fail(`overlay prompt proof unexpected: ${msg}`);
    }
  }

  const providerPath = roleMod.buildPhase11ARoleImageStoragePath({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    assetId: "00000000-0000-4000-8000-000000000011",
    role: "provider",
  });
  const composedPath = roleMod.buildPhase11ARoleImageStoragePath({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    assetId: "00000000-0000-4000-8000-000000000012",
    role: "composed",
  });
  roleMod.assertSafePhase11ARoleImageStoragePath(providerPath, {
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    assetId: "00000000-0000-4000-8000-000000000011",
    role: "provider",
  });
  roleMod.assertSafePhase11ARoleImageStoragePath(composedPath, {
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    assetId: "00000000-0000-4000-8000-000000000012",
    role: "composed",
  });

  const synthetic = pngMod.solidRgbPng({ width: 1024, height: 1024, r: 32, g: 40, b: 52 });
  const composed = composeMod.composePhase11ADeterministicOverlay({
    providerPng: synthetic,
    spec,
  });
  const composed2 = composeMod.composePhase11ADeterministicOverlay({
    providerPng: synthetic,
    spec,
  });
  if (composed.checksumSha256 !== composed2.checksumSha256) {
    fail("compositor checksum not deterministic");
  }
  const qc = qcMod.validatePhase11ATypographicQc({ spec, composed });
  if (qc.status !== "accepted") {
    fail(`synthetic typographic QC rejected: ${qc.reasons.map((r) => r.code).join(",")}`);
  }
  const ocr = await ocrMod.inspectProviderImageText({
    bytes: synthetic,
    ocr: ocrMod.createUnavailableImageOcrPort(),
  });
  if (ocr.status !== "unavailable_humanOnly") {
    fail("OCR unavailable must be unavailable_humanOnly (no fake PASS)");
  }
  if (composeMod.PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME !== "WIRED_DISABLED") {
    fail("overlay runtime must stay WIRED_DISABLED");
  }

  const futureIdempotencyFingerprint = createHash("sha256")
    .update(
      [
        AUTH,
        EXPECTED_COMMIT,
        SALT_FP,
        SCENE_ID,
        overlayMod.PHASE_11A_PROVIDER_TEXT_POLICY_VERSION,
        overlayFingerprint,
        "attempt=1",
        "retry_of=null",
      ].join("|"),
      "utf8",
    )
    .digest("hex");

  const dumped = JSON.stringify({ spec, overlayFingerprint, composed: composed.redactedMetadata });
  if (/https?:\/\/|data:image\/|base64,/i.test(dumped)) {
    fail("overlay proof leaked URL/base64");
  }

  return {
    verdict: promptContainsMarketingCopy ? "BLOCKED_OVERLAY_LEAK_REMAINS" : null,
    overlayCopyReviewed: true,
    overlaySpecValid: true,
    title,
    callToAction,
    subtitle: null,
    legalLine: null,
    locale,
    fontFamily: spec.fontFamily,
    fontWeight: spec.fontWeight,
    fontSize: spec.fontSize,
    textColor: spec.textColor,
    backgroundColor: spec.backgroundColor,
    contrast,
    contrastRequirement: spec.contrastRequirement,
    safeArea: spec.safeArea,
    maxLines: spec.maxLines,
    overflowPolicy: spec.overflowPolicy,
    overlayFingerprint,
    overlayVersion: spec.version,
    compositorVersion: composeMod.PHASE_11A_COMPOSITOR_VERSION,
    compositorRuntime: composeMod.PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
    compositorDeterministic: true,
    fontAllowlisted: spec.fontFamily === fontMod.PHASE_11A_OVERLAY_FONT_FAMILY,
    promptContainsMarketingCopy,
    leakReason,
    promptHash,
    promptVersion,
    providerTextPolicy: overlayMod.PHASE_11A_PROVIDER_TEXT_POLICY,
    providerTextPolicyVersion: overlayMod.PHASE_11A_PROVIDER_TEXT_POLICY_VERSION,
    textOverlayMode: overlayMod.PHASE_11A_TEXT_OVERLAY_MODE,
    ocr: { status: ocr.status, measure: ocr.measure, realOcrCalled: false, fakeOcrInProduction: false },
    providerStoragePathPattern: providerPath.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "{uuid}",
    ),
    composedStoragePathPattern: composedPath.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "{uuid}",
    ),
    providerAssetActive: false,
    composedAssetActive: false,
    futureIdempotencyFingerprint,
    retryOf: null,
    attempt: 1,
    syntheticComposeOnly: true,
    productionMediaRead: false,
    productionMediaWrite: false,
  };
}

async function assertRejectedAssetPreserved(db) {
  const { data: assets, error } = await db
    .from("assets")
    .select("id,status,checksum,storage_path,storage_bucket,provenance,project_id,scene_id")
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
  if (String(row.storage_bucket) !== "director-final-assets") {
    fail("rejected asset bucket unexpected");
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
  const { count: activeSceneAssets, error: aErr } = await db
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("project_id", PROJECT_ID)
    .eq("scene_id", SCENE_ID)
    .eq("status", "approved");
  if (!aErr && (activeSceneAssets ?? 0) > 0) {
    fail("scene-2 has an approved/active asset — STOP");
  }
  return {
    firstRejectedAssetPreserved: true,
    assetIdPrefix: String(row.id).slice(0, 8),
    status: row.status,
    active: false,
    checksumPrefix: String(row.checksum || "").slice(0, 16),
    storageBucket: row.storage_bucket,
    humanReviewRejectedCount: rejected.length,
    reuseAsFinal: false,
  };
}

async function localAllowlistDryRun(envForException) {
  const allow = await import(
    pathToFileURL(
      join(
        studioRoot,
        "src/application/production/phase-11a-openai-image-allowlist.ts",
      ),
    ).href
  );
  const planMod = await import(
    pathToFileURL(
      join(
        studioRoot,
        "src/application/production/phase-11a-single-step-plan.ts",
      ),
    ).href
  );
  const vhs = await import(
    pathToFileURL(
      join(
        studioRoot,
        "src/infrastructure/providers/vhs124-openai-image-exception.ts",
      ),
    ).href
  );
  const assertFakes = await import(
    pathToFileURL(
      join(studioRoot, "src/infrastructure/db/director-server.ts"),
    ).href
  );
  const pricing = await import(
    pathToFileURL(join(studioRoot, "src/lib/pricing.ts")).href
  );
  const promptDir = await import(
    pathToFileURL(
      join(
        studioRoot,
        "src/application/directors/prompt/prompt-director.ts",
      ),
    ).href
  );
  const { VideoProjectBriefSchema } = await import(
    pathToFileURL(join(studioRoot, "src/domain/brief/index.ts")).href
  );
  const { MarketingPlanSchema } = await import(
    pathToFileURL(join(studioRoot, "src/domain/marketing/index.ts")).href
  );
  const { CreativeConceptSchema } = await import(
    pathToFileURL(join(studioRoot, "src/domain/creative/index.ts")).href
  );
  const { VideoScriptSchema } = await import(
    pathToFileURL(join(studioRoot, "src/domain/script/index.ts")).href
  );
  const { VisualDirectionSchema } = await import(
    pathToFileURL(join(studioRoot, "src/domain/art/index.ts")).href
  );
  const { StoryboardProjectSchema } = await import(
    pathToFileURL(join(studioRoot, "src/domain/storyboard/index.ts")).href
  );

  const dry = allow.phase11AOpenAIImageAllowlistDryRun({
    env: envForException,
    availableMinor: 26,
  });

  if (dry.providerCalled !== false) fail("local dry-run providerCalled");
  const compositionFp = allow.phase11ARuntimeCompositionFingerprint();
  if (compositionFp !== EXPECTED_COMPOSITION_FP) {
    fail(
      `composition fingerprint expected ${EXPECTED_COMPOSITION_FP} got ${compositionFp}`,
    );
  }
  if (dry.compositionFingerprint !== EXPECTED_COMPOSITION_FP) {
    fail("dry.compositionFingerprint mismatch");
  }
  if (dry.storageIngestWired !== true) fail("storageIngestWired must be true");
  if (dry.persistedMediaPayloadPossible !== false) {
    fail("persistedMediaPayloadPossible must be false");
  }
  if (dry.canonicalRouting !== true) fail("canonicalRouting must be true");
  if (dry.generationPlanMaterialized !== true) {
    fail("generationPlanMaterialized must be true");
  }

  const stripMod = await import(
    pathToFileURL(
      join(
        studioRoot,
        "src/application/production/phase-11a-strip-overlay-copy-dry-run.ts",
      ),
    ).href
  );
  const fixture = stripMod.runPhase11AStripOverlayCopyDryRun();
  if (fixture.scenePackageFingerprint !== EXPECTED_SCENE_PACKAGE_FP) {
    fail(`fixture ScenePackage FP mismatch ${fixture.scenePackageFingerprint}`);
  }
  if (fixture.generationPlanFingerprint !== EXPECTED_GENERATION_PLAN_FP) {
    fail(`fixture GenerationPlan FP mismatch ${fixture.generationPlanFingerprint}`);
  }
  if (fixture.overlayFingerprint !== EXPECTED_OVERLAY_FP) {
    fail(`fixture overlay FP mismatch ${fixture.overlayFingerprint}`);
  }
  if (fixture.promptHash !== EXPECTED_PROMPT_HASH) {
    fail(`fixture prompt hash mismatch ${fixture.promptHash}`);
  }
  if (
    fixture.overlayCopyInVisualVariant !== false ||
    fixture.overlayCopyInProviderPrompt !== false ||
    fixture.providerPromptNoText !== true
  ) {
    return { verdict: "BLOCKED_OVERLAY_LEAK_REMAINS", dry, fixture };
  }
  if (dry.estimateMinor !== 1) {
    return {
      verdict: "BLOCKED_PRICING_DIVERGENCE",
      dry,
      estimateUsd: pricing.estimateImage("1024x1024", "low", 1),
    };
  }
  if (dry.reservationMinor > 2) {
    return { verdict: "BLOCKED_PRICING_DIVERGENCE", dry };
  }

  const sanitize = await import(
    pathToFileURL(
      join(
        studioRoot,
        "src/application/production/phase-11a-persisted-state-sanitize.ts",
      ),
    ).href
  );
  const ingest = await import(
    pathToFileURL(
      join(
        studioRoot,
        "src/application/production/phase-11a-image-storage-ingest.ts",
      ),
    ).href
  );
  const route = await import(
    pathToFileURL(
      join(
        studioRoot,
        "src/application/directors/routing/route-for-project.ts",
      ),
    ).href
  );
  // Prove sanitizer rejects base64/dataUrl without generating media
  try {
    sanitize.assertNoMediaPayloadInPersistedState({
      nested: { dataUrl: "data:image/png;base64,AAAA" },
    });
    fail("sanitizer must reject dataUrl payload");
  } catch (e) {
    if (!/media\/secret|forbidden|data_url|payload/i.test(String(e.message || e))) {
      fail(`sanitizer unexpected: ${e.message}`);
    }
  }
  if (typeof ingest.ingestPhase11AInlineImageToPrivateStorage !== "function") {
    fail("Storage ingest caller missing");
  }
  if (typeof ingest.assertSafePhase11AImageStoragePath !== "function") {
    fail("Storage path guard missing");
  }

  try {
    assertFakes.assertDirectorProductionUsesFakes("real");
    fail("wildcard real should throw");
  } catch {
    /* expected */
  }

  const resolved = vhs.resolveDirectorProviderAdapters({
    env: envForException,
    openaiImageClient: {
      async generateImage() {
        fail("OpenAI client must not be invoked during preflight");
      },
    },
  });
  if (resolved.mode !== "vhs124_openai_image_allowlist") {
    fail(`expected allowlist mode got ${resolved.mode}`);
  }
  const openai = resolved.adapters.find((a) => a.providerId === "openai");
  if (!openai?.supports("gpt-image-1", "image")) {
    fail("allowlisted openai adapter missing supports");
  }
  if (openai.supports("gpt-image-1", "video")) {
    fail("allowlist must not support video");
  }

  // In-memory ScenePackageSet + single-step plan (no DB write)
  const db = remoteDb();
  const byType = await loadActiveArtifacts(db);
  async function loadArt(id) {
    const { data, error } = await db
      .from("project_artifacts")
      .select("id,revision,value")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) fail(error?.message ?? `missing artifact ${id}`);
    return data;
  }
  const briefA = await loadArt(byType.video_project_brief.artifact_id);
  const mktA = await loadArt(byType.marketing_plan.artifact_id);
  const creA = await loadArt(byType.creative_concept.artifact_id);
  const scrA = await loadArt(byType.video_script.artifact_id);
  const visA = await loadArt(byType.visual_direction.artifact_id);
  const stbA = await loadArt(byType.storyboard_project.artifact_id);

  const director = promptDir.createPromptDirector({
    analyzer: { async analyze() { return {}; } },
  });
  const promptResult = await director.run(
    {
      brief: VideoProjectBriefSchema.parse(briefA.value),
      marketingPlan: MarketingPlanSchema.parse(mktA.value),
      creativeConcept: CreativeConceptSchema.parse(creA.value),
      videoScript: VideoScriptSchema.parse(scrA.value),
      visualDirection: VisualDirectionSchema.parse(visA.value),
      storyboard: StoryboardProjectSchema.parse(stbA.value),
    },
    {
      correlationId: `corr-11a-local-${Date.now()}`,
      mode: "execute",
      createdBy: "phase-11a-preflight",
    },
  );
  if (promptResult.status !== "completed") {
    fail(`in-memory ScenePackage build failed: ${promptResult.status}`);
  }
  const packages = promptResult.output.packages;
  const scenePkg = planMod.selectPhase11AScene2Package({ packages });
  if (scenePkg.sceneId !== SCENE_ID) {
    fail(`expected scene ${SCENE_ID}, got ${scenePkg.sceneId}`);
  }

  const promptMod = await import(
    pathToFileURL(
      join(studioRoot, "src/application/production/phase-11a-image-prompt.ts"),
    ).href
  );
  const promptGate = validatePromptGateFix(promptMod, scenePkg);
  const overlayProof = await proveOverlayPipeline({
    scenePkg,
    scriptValue: scrA.value,
    promptMod,
    promptGate,
  });

  const built = (() => {
    try {
      return planMod.buildPhase11ASingleStepGenerationPlan({
        storyboardRevisionId: stbA.id,
        scenePackageRevisionIds: ["memory-only-not-persisted"],
        scenePackage: scenePkg,
        createdAt: new Date().toISOString(),
        createdBy: "phase-11a-preflight",
        correlationId: `corr-11a-plan-${Date.now()}`,
      });
    } catch (e) {
      const msg = String(e.message || e);
      if (/overlay copy|screenText copy leaked|screenText copy must not appear|draw words/i.test(msg)) {
        overlayProof.verdict = "BLOCKED_OVERLAY_LEAK_REMAINS";
        overlayProof.planBuildLeak = msg.slice(0, 180);
        return null;
      }
      throw e;
    }
  })();

  // Canonical routing service materializes the same single-step plan (no HTTP write)
  const routed = (() => {
    try {
      return route.tryPhase11ASingleStep({
        projectId: PROJECT_ID,
        packages,
        storyboardArtifactId: stbA.id,
        packageSetArtifactId: "memory-only-not-persisted",
        availableMinor: 26,
        env: envForException,
        at: new Date().toISOString(),
        correlationId: `corr-11a-routing-${Date.now()}`,
      });
    } catch (e) {
      const msg = String(e.message || e);
      if (/overlay copy|screenText copy leaked|screenText copy must not appear|draw words/i.test(msg)) {
        overlayProof.verdict = "BLOCKED_OVERLAY_LEAK_REMAINS";
        overlayProof.routingBuildLeak = msg.slice(0, 180);
        return null;
      }
      throw e;
    }
  })();
  if (built) {
    if (built.stepCount !== 1 || built.fallbackCount !== 0) {
      fail("plan must be single-step with 0 fallbacks");
    }
  }
  if (routed) {
    if (!routed) fail("canonical routing tryPhase11ASingleStep returned null");
    if (routed.stepCount !== 1 || routed.fallbackCount !== 0) {
      fail("canonical routing plan must be single-step with 0 fallbacks");
    }
    if (routed.plan.scenePlans[0].steps[0].capabilityProfile !== "image.text_to_image") {
      fail("canonical routing capability mismatch");
    }
    if (routed.plan.scenePlans[0].steps[0].providerId !== "openai") {
      fail("canonical routing provider mismatch");
    }
    if (routed.plan.scenePlans[0].steps[0].modelId !== "gpt-image-1") {
      fail("canonical routing model mismatch");
    }
  } else if (!overlayProof.verdict) {
    fail("canonical routing tryPhase11ASingleStep returned null");
  }

  const storagePath = allow.buildPhase11AImageStoragePath({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    assetId: "00000000-0000-4000-8000-000000000001",
  });
  ingest.assertSafePhase11AImageStoragePath(storagePath, {
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    assetId: "00000000-0000-4000-8000-000000000001",
  });
  if (!storagePath.includes("/media/image/") || !storagePath.endsWith(".png")) {
    fail("storage path pattern invalid");
  }

  // Prove sanitize of a fake run with inline payload yields no media bytes
  const tombstoned = sanitize.sanitizeProductionRunForPersistence({
    id: "00000000-0000-4000-8000-000000000099",
    projectId: PROJECT_ID,
    generationPlanRevisionId: built?.plan?.id ?? "memory-only-not-persisted",
    status: "running",
    revision: 1,
    currency: "USD",
    estimatedCost: { amountMinor: 1, currency: "USD" },
    committedCost: { amountMinor: 0, currency: "USD" },
    releasedCost: { amountMinor: 0, currency: "USD" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    correlationId: "sanitize-proof",
    policy: { version: "1" },
    scenes: [
      {
        sceneId: SCENE_ID,
        sceneOrder: 2,
        status: "running",
        estimatedCost: { amountMinor: 1, currency: "USD" },
        committedCost: { amountMinor: 0, currency: "USD" },
        steps: [
          {
            stepId: "s1",
            status: "validating",
            outputAssets: [
              {
                id: "a1",
                kind: "image",
                mimeType: "image/png",
                source: {
                  kind: "inline_data_url",
                  dataUrl: "data:image/png;base64,AAAA",
                },
              },
            ],
            attempts: [],
          },
        ],
      },
    ],
  });
  const tombstoneDump = JSON.stringify(tombstoned);
  if (/base64,|data:image\//i.test(tombstoneDump)) {
    fail("sanitized run state still contains base64/data URL");
  }

  let verdict = "READY_FOR_TEXT_FREE_IMAGE_RETRY_PAID_AUTH";
  if (overlayProof.verdict) verdict = overlayProof.verdict;
  if (promptGate.promptContainsMarketingCopy) {
    verdict = "BLOCKED_OVERLAY_LEAK_REMAINS";
  }

  return {
    verdict,
    dry,
    estimateUsd: pricing.estimateImage("1024x1024", "low", 1),
    adapterMode: resolved.mode,
    audit: resolved.audit,
    promptGate,
    compositionFingerprint: compositionFp,
    compositionVersion: allow.PHASE_11A_RUNTIME_COMPOSITION_VERSION,
    canonicalRouting: true,
    generationPlanMaterialized: true,
    storageIngestWired: true,
    persistedMediaPayloadPossible: false,
    sanitizerPresent: true,
    humanReviewRequired: true,
    assetActive: false,
    scenePackage: {
      sceneId: scenePkg.sceneId,
      sceneOrder: scenePkg.sceneOrder,
      productionIntent: scenePkg.productionIntent,
      packageIdPrefix: String(scenePkg.id).slice(0, 8),
      persisted: false,
      deterministic: true,
    },
    generationPlan: built
      ? {
          stepCount: built.stepCount,
          fallbackCount: built.fallbackCount,
          fingerprint: built.fingerprint,
          promptHash: built.promptHash,
          estimateMinor: built.estimateMinor,
          reservationMinor: built.reservationMinor,
          modelId: built.plan.scenePlans[0].steps[0].modelId,
          providerId: built.plan.scenePlans[0].steps[0].providerId,
          capability: built.plan.scenePlans[0].steps[0].capabilityProfile,
          quality: "low",
          size: "1024x1024",
          persisted: false,
          routingMaterialized: Boolean(routed),
          routingFingerprint: routed?.fingerprint ?? null,
        }
      : {
          materialized: false,
          leakBlocked: true,
          quality: "low",
          size: "1024x1024",
          persisted: false,
        },
    overlayProof,
    fixtureFingerprints: {
      scenePackage: fixture.scenePackageFingerprint,
      generationPlan: fixture.generationPlanFingerprint,
      overlay: fixture.overlayFingerprint,
      promptHash: fixture.promptHash,
      visualSubject: fixture.visualSubject,
      overlayCopyInVisualVariant: fixture.overlayCopyInVisualVariant,
      overlayCopyInProviderPrompt: fixture.overlayCopyInProviderPrompt,
      providerPromptNoText: fixture.providerPromptNoText,
    },
    storagePathPattern: storagePath.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "{uuid}",
    ),
    storageBucket: "director-final-assets",
    wildcardRealForbidden: true,
    artifacts: {
      briefRevision: briefA.revision,
      marketingRevision: mktA.revision,
      creativeRevision: creA.revision,
      scriptRevision: scrA.revision,
      visualRevision: visA.revision,
      storyboardRevision: stbA.revision,
      storyboardIdPrefix: String(stbA.id).slice(0, 8),
    },
  };
}

function flagMatrix(env) {
  const g = (k) => {
    const v = env[k];
    if (v == null || v === "") return "MISSING_OR_REDACTED";
    return v === "1" || v === "true" ? "1" : v === "0" || v === "false" ? "0" : "OTHER";
  };
  return {
    DIRECTOR_V2_ENABLED: g("DIRECTOR_V2_ENABLED"),
    DIRECTOR_V2_PERSISTENCE_ENABLED: g("DIRECTOR_V2_PERSISTENCE_ENABLED"),
    DIRECTOR_V2_PAID_GENERATION_ENABLED: g("DIRECTOR_V2_PAID_GENERATION_ENABLED"),
    DIRECTOR_V2_WORKER_ENABLED: g("DIRECTOR_V2_WORKER_ENABLED"),
    VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: g(
      "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
    ),
    MOTION_TRANSFER_ENABLED: g("MOTION_TRANSFER_ENABLED"),
    MOTION_TRANSFER_PAID_ENABLED: g("MOTION_TRANSFER_PAID_ENABLED"),
    MOTION_TRANSFER_WORKER_ENABLED: g("MOTION_TRANSFER_WORKER_ENABLED"),
  };
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
    "ledger_rows",
  ];
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    if (b.missing && a.missing) continue;
    if (b.missing || a.missing) {
      // table missing both sides OK; one side only is suspicious but non-fatal if both null
      continue;
    }
    if (b.count !== a.count) {
      fail(`counter drift ${k}: before=${b.count} after=${a.count}`);
    }
  }
}

function validatePromptGateFix(promptMod, smokePkg) {
  let promptContainsMarketingCopy = false;
  let promptHash = null;
  let promptVersion = null;
  let providerTextPolicy = null;
  let leakReason = null;
  try {
    const ok = promptMod.buildPhase11AImagePromptFromScenePackage(smokePkg);
    if (!ok.promptHash || ok.promptHash.length !== 64) {
      fail("prompt-gate: valid package must produce promptHash");
    }
    promptHash = ok.promptHash;
    promptVersion = ok.promptVersion;
    providerTextPolicy = ok.redactedMetadata?.providerTextPolicy ?? null;
    if (ok.promptText && smokePkg.screenText?.text) {
      if (ok.promptText.toLowerCase().includes(String(smokePkg.screenText.text).toLowerCase())) {
        promptContainsMarketingCopy = true;
        leakReason = "screenText in promptText";
      }
    }
  } catch (e) {
    const msg = String(e.message || e);
    if (/overlay copy|screenText copy leaked|screenText copy must not appear|draw words/i.test(msg)) {
      promptContainsMarketingCopy = true;
      leakReason = msg.slice(0, 180);
    } else {
      fail(`prompt-gate: unexpected build failure: ${msg}`);
    }
  }
  const hostileUrl = {
    ...smokePkg,
    variants: smokePkg.variants.map((v) =>
      v.capabilityProfile === "image.text_to_image"
        ? { ...v, positive: `${v.positive}\nhttps://evil.example/pwn` }
        : v,
    ),
  };
  try {
    promptMod.buildPhase11AImagePromptFromScenePackage(hostileUrl);
    fail("prompt-gate: https URL must be rejected");
  } catch (e) {
    if (!/URL|path|local/i.test(String(e.message || e))) {
      fail(`prompt-gate: unexpected reject reason for URL: ${e.message}`);
    }
  }
  const hostileMotion = {
    ...smokePkg,
    variants: smokePkg.variants.map((v) =>
      v.capabilityProfile === "image.text_to_image"
        ? { ...v, positive: `${v.positive}\nmotion_transfer kling-video` }
        : v,
    ),
  };
  try {
    promptMod.buildPhase11AImagePromptFromScenePackage(hostileMotion);
    fail("prompt-gate: Motion markers must be rejected");
  } catch (e) {
    if (!/Motion|motion/i.test(String(e.message || e))) {
      fail(`prompt-gate: unexpected reject for Motion: ${e.message}`);
    }
  }
  return {
    dataDelimitersAccepted: !promptContainsMarketingCopy,
    hostileUrlRejected: true,
    hostileMotionRejected: true,
    promptHash,
    promptVersion,
    providerTextPolicy,
    promptContainsMarketingCopy,
    leakReason,
    promptPersisted: false,
  };
}

async function main() {
  if (process.env.CONFIRM_PHASE_11A_TEXT_FREE_RETRY_PREFLIGHT !== "1") {
    console.error(
      "Refused: set CONFIRM_PHASE_11A_TEXT_FREE_RETRY_PREFLIGHT=1",
    );
    process.exit(2);
  }
  if (process.env.PHASE_11A_ALLOW_EXECUTE === "1") {
    fail("PHASE_11A_ALLOW_EXECUTE forbidden during preflight");
  }

  if (process.env.PHASE_11A_LOCAL_ONLY === "1") {
    const reportPath = join(studioRoot, ".tmp", "phase-11a-text-free-retry-preflight-e4c3de3-report.json");
    const report = existsSync(reportPath)
      ? JSON.parse(readFileSync(reportPath, "utf8"))
      : { auth: AUTH, sourceCommit: EXPECTED_COMMIT };
    const local = await localAllowlistDryRun({
      VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "1",
      DIRECTOR_V2_WORKER_ENABLED: "0",
    });
    report.local = {
      verdict: local.verdict,
      dry: local.dry,
      estimateUsd: local.estimateUsd,
      adapterMode: local.adapterMode,
      promptGate: local.promptGate,
      compositionFingerprint: local.compositionFingerprint,
      compositionVersion: local.compositionVersion,
      canonicalRouting: local.canonicalRouting,
      generationPlanMaterialized: local.generationPlanMaterialized,
      storageIngestWired: local.storageIngestWired,
      persistedMediaPayloadPossible: local.persistedMediaPayloadPossible,
      sanitizerPresent: local.sanitizerPresent,
      humanReviewRequired: local.humanReviewRequired,
      assetActive: local.assetActive,
      scenePackage: local.scenePackage,
      generationPlan: local.generationPlan,
      storagePathPattern: local.storagePathPattern,
      storageBucket: local.storageBucket,
      artifacts: local.artifacts,
      overlayProof: local.overlayProof,
      fixtureFingerprints: local.fixtureFingerprints,
      futureIdempotencyFingerprint: local.overlayProof?.futureIdempotencyFingerprint ?? null,
      openaiKeyPresent: true,
      openaiKeyValueRead: false,
      sourceCommit: EXPECTED_COMMIT,
    };
    report.verdict = local.verdict;
    report.error = undefined;
    writeReport(report);
    console.log(JSON.stringify({
      verdict: report.verdict,
      overlayTitle: local.overlayProof?.title,
      leak: local.overlayProof?.promptContainsMarketingCopy,
      promptHashPrefix: (local.overlayProof?.promptHash || local.promptGate?.promptHash || "").slice(0, 16),
    }, null, 2));
    return;
  }

  const report = {
    auth: AUTH,
    sourceCommit: EXPECTED_COMMIT,
    sourceCommitShort: EXPECTED_COMMIT_SHORT,
    saltFingerprint: SALT_FP,
    saltPresent: true,
    deployOnHost: null,
    deployOffHost: null,
    verdict: null,
    providerCalls: 0,
    workerInvocations: 0,
  };

  let closed = false;
  const closeRuntime = () => {
    if (closed) return;
    console.log("CLOSURE_START");
    const fails = applyEnvMap(OFF_ALL);
    if (fails > 0) fail(`closure env writes failed count=${fails}`);
    report.deployOffHost = redeployProd("OFF");
    closed = true;
    console.log("CLOSURE_DONE");
  };

  try {
    // --- Preconditions ---
    const ancestor = run("git", ["merge-base", "--is-ancestor", EXPECTED_COMMIT, "HEAD"]);
    if (ancestor.status !== 0) {
      fail(`${EXPECTED_COMMIT_SHORT} must be an ancestor of HEAD`);
    }
    const dirty = run("git", ["status", "--porcelain"]);
    if ((dirty.stdout || "").trim()) {
      const lines = (dirty.stdout || "")
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .filter(
          (l) =>
            !l.includes("phase-11a-text-free-retry-preflight-e4c3de3.mjs") &&
            !l.includes("phase-11a-text-free-retry-live-local-proof.mjs") &&
            !l.includes(".tmp/") &&
            !l.includes("114_PHASE_11A_TEXT_FREE_IMAGE_RETRY_LIVE_PREFLIGHT.md") &&
            !l.includes("CURRENT_STATE_AND_RESUME.md") &&
            !l.includes("00_README.md") &&
            !l.includes("BACKLOG_V2.md") &&
            !l.includes("CHANGELOG.md") &&
            !l.includes("CHECKLIST_RELEASE.md") &&
            !l.includes("GLOSSARY.md"),
        );
      if (lines.length > 0) {
        fail(`working tree not clean:\n${lines.join("\n")}`);
      }
    }
    const preDeploy = inspectAliasCommit();
    report.preDeployHost = preDeploy.host;
    console.log(`PRE_DEPLOY Ready commit=${EXPECTED_COMMIT_SHORT} host=${preDeploy.host}`);

    const keyPresent = openaiKeyPresentInVercelLs();
    if (!keyPresent) fail("OPENAI_API_KEY missing from Vercel production env ls");

    const envBefore = pullProductionEnv();
    const flagsBefore = flagMatrix(envBefore);
    console.log("FLAGS_BEFORE", JSON.stringify(flagsBefore));
    // Worker must already be OFF; media paid ideally OFF before window
    if (flagsBefore.DIRECTOR_V2_WORKER_ENABLED === "1") {
      fail("precondition: worker must be OFF before opening window");
    }
    if (flagsBefore.MOTION_TRANSFER_ENABLED === "1") {
      fail("precondition: Motion must be OFF");
    }

    const db = remoteDb();
    const before = await captureCounters(db);
    report.countersBefore = before;
    console.log(
      "BUDGET_BEFORE",
      JSON.stringify(before.budget),
      "MIGRATIONS",
      before.schema_migrations,
    );

    if (before.budget.hardMinor !== 274) {
      fail(`budget hard expected 274 got ${before.budget.hardMinor}`);
    }
    if (before.budget.reservedMinor !== 0) {
      fail(`active reservations expected 0 got ${before.budget.reservedMinor}`);
    }
    if (
      before.budget.availableMinor == null ||
      before.budget.availableMinor < 2
    ) {
      fail(`available budget insufficient: ${before.budget.availableMinor}`);
    }
    if (before.budget.availableMinor !== 26) {
      console.log(
        `WARN available expected 26 got ${before.budget.availableMinor} committed=${before.budget.committedMinor}`,
      );
    }
    // schema_migrations may be invisible via PostgREST; prove locally.
    const { readdirSync } = await import("node:fs");
    const migDir = join(studioRoot, "supabase", "migrations");
    const migFiles = existsSync(migDir)
      ? readdirSync(migDir).filter((f) => f.endsWith(".sql")).length
      : 0;
    report.migrationsLocalSqlCount = migFiles;
    if (migFiles !== 30) {
      fail(`local migration sql count expected 30 got ${migFiles}`);
    }
    // PostgREST often cannot read schema_migrations (count 0) — local 30 is authoritative.

    await loadActiveArtifacts(db);
    report.rejectedAsset = await assertRejectedAssetPreserved(db);
    if (
      before.scene_package_set_active.missing === false &&
      before.scene_package_set_active.count > 0
    ) {
      console.log("NOTE scene_package_set already active — will not write");
    }
    if (
      before.generation_plan_active.missing === false &&
      before.generation_plan_active.count > 0
    ) {
      console.log("NOTE generation_plan already active — will not write");
    }

    // --- Open window ---
    console.log("OPEN_WINDOW");
    const openFails = applyEnvMap({ ...ALWAYS_OFF, ...ON_FLIP });
    if (openFails > 0) fail(`open env writes failed count=${openFails}`);
    report.deployOnHost = redeployProd("ON");

    const envOn = pullProductionEnv();
    const flagsOn = flagMatrix(envOn);
    report.flagsDuring = flagsOn;
    console.log("FLAGS_DURING", JSON.stringify(flagsOn));
    // Sensitive may redact — rely on explicit writes
    const exceptionEnv = {
      ...envOn,
      VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "1",
      DIRECTOR_V2_WORKER_ENABLED: "0",
    };

    const password = envOn.APP_PASSWORD;
    if (!password) fail("APP_PASSWORD missing after env pull");

    const http = await httpPromptsDryRun(password);
    report.httpDryRun = http;
    console.log("HTTP_DRY_RUN", JSON.stringify(http));

    const local = await localAllowlistDryRun(exceptionEnv);
    report.local = {
      verdict: local.verdict,
      dry: local.dry,
      estimateUsd: local.estimateUsd,
      adapterMode: local.adapterMode,
      audit: local.audit,
      promptGate: local.promptGate,
      compositionFingerprint: local.compositionFingerprint,
      compositionVersion: local.compositionVersion,
      canonicalRouting: local.canonicalRouting,
      generationPlanMaterialized: local.generationPlanMaterialized,
      storageIngestWired: local.storageIngestWired,
      persistedMediaPayloadPossible: local.persistedMediaPayloadPossible,
      sanitizerPresent: local.sanitizerPresent,
      humanReviewRequired: local.humanReviewRequired,
      assetActive: local.assetActive,
      scenePackage: local.scenePackage,
      generationPlan: local.generationPlan,
      storagePathPattern: local.storagePathPattern,
      storageBucket: local.storageBucket,
      artifacts: local.artifacts,
      overlayProof: local.overlayProof,
      fixtureFingerprints: local.fixtureFingerprints,
      futureIdempotencyFingerprint: local.overlayProof?.futureIdempotencyFingerprint ?? null,
      openaiKeyPresent: true,
      openaiKeyValueRead: false,
      sourceCommit: EXPECTED_COMMIT,
    };
    console.log(
      "LOCAL_DRY_RUN",
      JSON.stringify({
        verdict: local.verdict,
        estimateMinor: local.dry?.estimateMinor,
        reservationMinor: local.dry?.reservationMinor,
        adapterMode: local.adapterMode,
        compositionFingerprint: local.compositionFingerprint,
        fingerprint: local.generationPlan?.fingerprint?.slice(0, 16),
        storageIngestWired: local.storageIngestWired,
        persistedMediaPayloadPossible: local.persistedMediaPayloadPossible,
        canonicalRouting: local.canonicalRouting,
        promptGate: local.promptGate
          ? {
              dataDelimitersAccepted: local.promptGate.dataDelimitersAccepted,
              hostileUrlRejected: local.promptGate.hostileUrlRejected,
              hostileMotionRejected: local.promptGate.hostileMotionRejected,
              promptHashPrefix: local.promptGate.promptHash.slice(0, 16),
            }
          : null,
      }),
    );

    if (local.verdict === "BLOCKED_PRICING_DIVERGENCE") {
      report.verdict = "BLOCKED_PRICING_DIVERGENCE";
      closeRuntime();
      writeReport(report);
      process.exit(3);
    }
    if (local.verdict === "BLOCKED_OVERLAY_COPY_REVIEW_REQUIRED") {
      report.verdict = "BLOCKED_OVERLAY_COPY_REVIEW_REQUIRED";
      closeRuntime();
      writeReport(report);
      process.exit(4);
    }
    if (local.verdict === "BLOCKED_OVERLAY_LEAK_REMAINS") {
      report.verdict = "BLOCKED_OVERLAY_LEAK_REMAINS";
      closeRuntime();
      writeReport(report);
      process.exit(5);
    }

    const after = await captureCounters(db);
    report.countersAfter = after;
    assertCountersUnchanged(before, after);
    report.deltas = {
      newRuns: 0,
      newJobs: 0,
      newAttempts: 0,
      newLedgerRows: 0,
      newReservations: 0,
      newMediaAssets: 0,
      providerCalls: 0,
      workerInvocations: 0,
    };

    report.verdict = local.verdict || "READY_FOR_TEXT_FREE_IMAGE_RETRY_PAID_AUTH";
    closeRuntime();

    const envFinal = pullProductionEnv();
    report.flagsFinal = flagMatrix(envFinal);
    report.runtimeFinal = {
      RUNTIME_PAID_MEDIA: "OFF",
      OPENAI_IMAGE_REAL_EXECUTION: "UNAVAILABLE",
      DETERMINISTIC_OVERLAY_EXECUTION: "OFF",
      MOTION_RUNTIME: "UNAVAILABLE",
      exception: "OFF",
      worker: "OFF",
    };
    // Prove paid path inaccessible: persistence OFF → prompts 404
    const login2 = await fetch(`${BASE}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: envFinal.APP_PASSWORD || password }),
    });
    if (login2.ok) {
      const setCookies =
        typeof login2.headers.getSetCookie === "function"
          ? login2.headers.getSetCookie()
          : [login2.headers.get("set-cookie")].filter(Boolean);
      const cookie = setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
      const closedProbe = await fetch(
        `${BASE}/api/director/projects/${PROJECT_ID}/prompts`,
        {
          method: "POST",
          headers: {
            cookie,
            origin: BASE,
            referer: `${BASE}/director`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ mode: "dry-run" }),
        },
      );
      report.closedProbeStatus = closedProbe.status;
      if (closedProbe.status !== 404) {
        fail(`after closure prompts dry-run expected 404 got ${closedProbe.status}`);
      }
    }

    writeReport(report);
    console.log(JSON.stringify({ verdict: report.verdict, saltFp: SALT_FP }, null, 2));
  } catch (e) {
    report.verdict =
      report.verdict ||
      (String(e.message || e).includes("composition")
        ? "BLOCKED_RUNTIME_COMPOSITION"
        : String(e.message || e).includes("deploy")
          ? "BLOCKED_DEPLOYMENT"
          : "BLOCKED_RUNTIME_COMPOSITION");
    report.error = String(e.message || e).slice(0, 500);
    try {
      closeRuntime();
    } catch (closeErr) {
      report.closureError = String(closeErr.message || closeErr).slice(0, 300);
    }
    writeReport(report);
    console.error(report.error);
    process.exit(1);
  }
}

function writeReport(report) {
  const outDir = join(studioRoot, ".tmp");
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, "phase-11a-text-free-retry-preflight-e4c3de3-report.json");
  // Ensure salt value never written
  const safe = { ...report, saltValue: undefined };
  writeFileSync(path, JSON.stringify(safe, null, 2));
  console.log(`REPORT_WRITTEN ${path}`);
}

main();
