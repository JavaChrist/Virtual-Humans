#!/usr/bin/env node
/**
 * Phase 11A corrected recomposition EXECUTION (local/admin, 245bea2).
 *
 *   CONFIRM_PHASE_11A_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION=1 \
 *   node --import tsx scripts/phase-11a-corrected-recomposition-execution-245bea2.mjs
 *
 * Uses compositor 1.1.0 / atlas shapes-v1 from 245bea2. No OpenAI. No Vercel flags.
 * PHASE_11A_ALLOW_EXECUTE=1 is forbidden. Docs commit a0db8c7 is not applicative proof.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const repoRoot = resolve(studioRoot, "..");
const EXPECTED_COMMIT = "245bea2152d29ff158197a946bf5856b3055b929";
const EXPECTED_COMMIT_SHORT = "245bea2";
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const SCENE_ID = "scene-2";
const AUTH = "AUTH_11A_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION";
const CONFIRM_ENV = "CONFIRM_PHASE_11A_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION";
const REJECTED_ASSET_PREFIX = "5d68ef64";
const REJECTED_CHECKSUM_PREFIX = "c508e3e54f2ccac7";
const PROVIDER_ASSET_PREFIX = "7832765d";
const PROVIDER_CHECKSUM_PREFIX = "1ac51f484420ef88";
const REJECTED_COMPOSED_PREFIX = "6a2beca9";
const REJECTED_COMPOSED_CHECKSUM_PREFIX = "d056b85aa4f9452d";
const COMPOSED_DECISION_PREFIX = "f1fcb832";
const EXPECTED_BYTES = 1_131_237;
const EXPECTED_COMPOSED_CHECKSUM =
  "b284e877e5a80e7af19a84fdce9db79f0ab1e31298b6f9b43fcb9e18a7921fe5";
const EXPECTED_COMPOSED_BYTES = 1_309_704;
const EXPECTED_ASSET_PREFIX = "4429654f";
const EXPECTED_FINGERPRINT_PREFIX = "4429654f9bf92525";
const EXPECTED_COMPOSITOR = "phase-11a-bitmap-compositor-1.1.0";
const EXPECTED_ATLAS = "vhs-overlay-latin-bitmap-shapes-v1";
const EXPECTED_OVERLAY_FP =
  "fdfae63fe1c7d003d9e4190bf0aea904fdab59caa2ddad5c2972cb6c39a423b9";
const RUN_PREFIX = "39329a01";
const JOB_PREFIX = "edc6e84a";
const BUCKET = "director-final-assets";
const SUPABASE_HOST = "ejdbksxaswhdtsudnmvi.supabase.co";
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const SIGNED_TTL_SEC = 60;
const ACTOR = "phase-11a-corrected-recomposition";
const CORRELATION = "corr-11a-corrected-recomposition";
const APPLICATIVE_FILES = [
  "studio/src/application/production/phase-11a-png-rgb.ts",
  "studio/src/application/production/phase-11a-deterministic-compositor.ts",
  "studio/src/application/production/phase-11a-overlay-font.ts",
  "studio/src/application/production/phase-11a-overlay-latin-bitmap.ts",
  "studio/src/domain/production/image-text-overlay.ts",
  "studio/src/application/production/phase-11a-typographic-qc.ts",
  "studio/src/application/production/phase-11a-composed-ingest.ts",
  "studio/src/application/production/phase-11a-image-role-storage.ts",
];

function fail(msg) {
  const err = new Error(msg);
  err.name = "Phase11AExecutionStop";
  throw err;
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    cwd: opts.cwd || studioRoot,
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

function remoteDb() {
  const remote = loadEnvFile(resolve(studioRoot, ".env.remote.local"));
  if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
    fail("missing .env.remote.local Supabase credentials");
  }
  const urlHost = new URL(remote.SUPABASE_URL).hostname;
  if (urlHost !== SUPABASE_HOST) fail(`unexpected Supabase host`);
  return createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function countOrZero(r, label) {
  if (r.error) {
    const msg = String(r.error.message || r.error.code || "");
    if (!msg || /does not exist|Could not find|schema cache/i.test(msg)) {
      return { missing: true, count: null };
    }
    fail(`counter ${label}: ${msg}`);
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
      fail(`storage list: ${msg}`);
    }
    total += (data || []).filter((o) => o.name && String(o.name).endsWith(".png")).length;
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
    reviews,
    quality,
    results,
    ledgerCountRes,
    policy,
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
    db.from("human_review_decisions").select("id", { count: "exact", head: true }).eq("project_id", PROJECT_ID),
    db.from("project_artifacts").select("id", { count: "exact", head: true }).eq("project_id", PROJECT_ID).eq("artifact_type", "quality_report"),
    db.from("project_artifacts").select("id", { count: "exact", head: true }).eq("project_id", PROJECT_ID).eq("artifact_type", "production_result"),
    db.from("cost_ledger").select("id", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID),
    db.from("workspace_budget_policies").select("hard_limit_minor").eq("workspace_id", WORKSPACE_ID).maybeSingle(),
  ]);
  const hard = Number(policy.data?.hard_limit_minor ?? NaN);
  const { data: resRows, error: resErr } = await db
    .from("budget_reservations")
    .select("amount_minor,status")
    .eq("workspace_id", WORKSPACE_ID);
  if (resErr) fail(`reservations: ${resErr.message}`);
  let reserved = 0;
  for (const row of resRows ?? []) {
    if (String(row.status || "") === "active") reserved += Number(row.amount_minor || 0);
  }
  const { data: ledgerAgg, error: ledErr } = await db
    .from("cost_ledger")
    .select("entry_type,amount_minor")
    .eq("workspace_id", WORKSPACE_ID);
  if (ledErr) fail(`ledger: ${ledErr.message}`);
  let commitSum = 0;
  let refunds = 0;
  for (const e of ledgerAgg ?? []) {
    if (String(e.entry_type) === "commit") commitSum += Number(e.amount_minor || 0);
    if (String(e.entry_type) === "refund") refunds += Number(e.amount_minor || 0);
  }
  const committedMinor = Math.max(commitSum - refunds, 0);
  return {
    production_runs: countOrZero(runs, "runs"),
    production_jobs: countOrZero(jobs, "jobs"),
    generation_attempts: countOrZero(attempts, "attempts"),
    active_reservations: countOrZero(reservations, "reservations"),
    image_assets: countOrZero(assets, "assets"),
    human_review_decisions: countOrZero(reviews, "hr"),
    quality_reports: countOrZero(quality, "qr"),
    production_results: countOrZero(results, "pr"),
    ledger_rows: countOrZero(ledgerCountRes, "ledger"),
    storage_objects: { missing: false, count: await countStorageObjects(db) },
    budget: {
      hardMinor: hard,
      reservedMinor: reserved,
      committedMinor,
      availableMinor: Number.isFinite(hard) ? hard - reserved - committedMinor : null,
    },
  };
}

function assertBudget(budget) {
  if (budget.hardMinor !== 274 || budget.committedMinor !== 249 || budget.reservedMinor !== 0) {
    fail(`budget drifted ${budget.hardMinor}/${budget.committedMinor}/${budget.reservedMinor}`);
  }
}

function redactPath(path, assetId) {
  return String(path || "")
    .replace(WORKSPACE_ID, "{workspaceId}")
    .replace(PROJECT_ID, "{projectId}")
    .replace(assetId, "{assetId}");
}

async function loadTargets(db) {
  const { data: assets, error } = await db
    .from("assets")
    .select(
      "id,status,kind,mime_type,storage_bucket,storage_path,checksum,size_bytes,width,height,provenance,scene_id,source_provider,run_id,step_id",
    )
    .eq("project_id", PROJECT_ID)
    .eq("kind", "image");
  if (error) fail(`assets: ${error.message}`);
  const rejected = (assets ?? []).find((a) => String(a.id).startsWith(REJECTED_ASSET_PREFIX));
  const provider = (assets ?? []).find((a) => String(a.id).startsWith(PROVIDER_ASSET_PREFIX));
  if (!rejected || String(rejected.status) !== "rejected") fail("rejected asset drifted");
  const rejectedProv = rejected.provenance && typeof rejected.provenance === "object" ? rejected.provenance : {};
  if (rejectedProv.active === true) fail("rejected asset active");
  if (String(rejected.checksum || "").slice(0, 16) !== REJECTED_CHECKSUM_PREFIX) fail("rejected checksum");
  if (!provider) fail("provider asset missing");
  if (String(provider.status) !== "pending_review") fail("provider status");
  if (String(provider.checksum || "").slice(0, 16) !== PROVIDER_CHECKSUM_PREFIX) fail("provider checksum");
  if (provider.mime_type !== "image/png" || Number(provider.size_bytes) !== EXPECTED_BYTES) {
    fail("provider format/size");
  }
  if (Number(provider.width) !== 1024 || Number(provider.height) !== 1024) fail("provider dims");
  const prov = provider.provenance && typeof provider.provenance === "object" ? provider.provenance : {};
  if (prov.active === true) fail("provider active");
  const { data: reviews, error: rErr } = await db
    .from("human_review_decisions")
    .select("id,decision")
    .eq("project_id", PROJECT_ID);
  if (rErr) fail(`hr: ${rErr.message}`);
  const rejectedReviews = (reviews ?? []).filter((d) => d.decision === "rejected");
  if (rejectedReviews.length !== 2) fail(`HR reject count ${rejectedReviews.length}`);
  if (!(reviews ?? []).some((d) => String(d.id).startsWith(COMPOSED_DECISION_PREFIX))) {
    fail("composed HR decision missing");
  }
  const rejectedComposed = (assets ?? []).find((a) => String(a.id).startsWith(REJECTED_COMPOSED_PREFIX));
  if (!rejectedComposed || String(rejectedComposed.status) !== "rejected") fail("rejected composed drifted");
  if (String(rejectedComposed.checksum || "").slice(0, 16) !== REJECTED_COMPOSED_CHECKSUM_PREFIX) {
    fail("rejected composed checksum");
  }
  const rcProv =
    rejectedComposed.provenance && typeof rejectedComposed.provenance === "object"
      ? rejectedComposed.provenance
      : {};
  if (rcProv.active === true) fail("rejected composed active");
  const { data: runs, error: runErr } = await db
    .from("production_runs")
    .select("id,status,state,revision,generation_plan_artifact_id,estimated_cost_minor,committed_cost_minor")
    .eq("project_id", PROJECT_ID);
  if (runErr) fail(`runs: ${runErr.message}`);
  const runRow = (runs ?? []).find((r) => String(r.id).startsWith(RUN_PREFIX));
  if (!runRow) fail("run missing");
  const { data: jobs, error: jobErr } = await db
    .from("production_jobs")
    .select("id,status")
    .eq("project_id", PROJECT_ID);
  if (jobErr) fail(`jobs: ${jobErr.message}`);
  const job = (jobs ?? []).find((j) => String(j.id).startsWith(JOB_PREFIX));
  if (!job || job.status !== "completed") fail("job not completed");
  return { rejected, provider, rejectedComposed, runRow, job, reviews: reviews ?? [] };
}

async function downloadOnce(db, storagePath) {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) fail(`signed url: ${error?.message || "missing"}`);
  let signedUrl = data.signedUrl;
  let parsed;
  try {
    parsed = new URL(signedUrl);
  } catch {
    signedUrl = null;
    fail("signed url parse");
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== SUPABASE_HOST) fail("signed url host");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  try {
    const res = await fetch(signedUrl, { method: "GET", redirect: "error", signal: ac.signal });
    if (!res.ok) fail(`download HTTP ${res.status}`);
    const mime = String(res.headers.get("content-type") || "").split(";")[0].trim();
    if (mime !== "image/png") fail(`download mime ${mime}`);
    const raw = new Uint8Array(await res.arrayBuffer());
    if (raw.byteLength > MAX_DOWNLOAD_BYTES || raw.byteLength !== EXPECTED_BYTES) {
      fail(`download size ${raw.byteLength}`);
    }
    return raw;
  } finally {
    clearTimeout(timer);
    signedUrl = null;
    parsed = null;
  }
}

function assertApplicativeSource() {
  for (const file of APPLICATIVE_FILES) {
    const diff = run("git", ["diff", EXPECTED_COMMIT_SHORT, "--", file], { cwd: repoRoot });
    if (String(diff.stdout || "").trim()) fail(`applicative drift ${file}`);
  }
  const compositorSrc = readFileSync(
    join(studioRoot, "src/application/production/phase-11a-deterministic-compositor.ts"),
    "utf8",
  );
  const fontSrc = readFileSync(join(studioRoot, "src/application/production/phase-11a-overlay-font.ts"), "utf8");
  const atlasSrc = readFileSync(
    join(studioRoot, "src/application/production/phase-11a-overlay-latin-bitmap.ts"),
    "utf8",
  );
  if (!atlasSrc.includes(`PHASE_11A_BITMAP_GLYPH_ATLAS_ID = "${EXPECTED_ATLAS}"`)) {
    fail("STOP: atlas id missing from executed source");
  }
  if (!compositorSrc.includes(`PHASE_11A_COMPOSITOR_VERSION = "${EXPECTED_COMPOSITOR}"`)) {
    fail("STOP: compositor 1.1.0 missing from executed source");
  }
  if (!fontSrc.includes("return bitmapGlyphRows(cp)")) {
    fail("STOP: glyph lookup does not use atlas");
  }
  if (fontSrc.includes("legacyHashGlyphRows")) {
    fail("STOP: overlay-font selects legacyHashGlyphRows");
  }
  if (compositorSrc.includes("legacyHashGlyphRows")) {
    fail("STOP: compositor selects legacyHashGlyphRows");
  }
  if (!atlasSrc.includes("overlay_glyph_unsupported")) {
    fail("STOP: Unicode lookup is not fail-closed");
  }
}

const planMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-existing-provider-composition-preflight.ts")).href
);
const pngMod = await import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-png-rgb.ts")).href);
const inspectMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-png-scanline-filter-inspect.ts")).href
);
const composeMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-deterministic-compositor.ts")).href
);
const overlayMod = await import(pathToFileURL(join(studioRoot, "src/domain/production/image-text-overlay.ts")).href);
const copyMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-strip-overlay-copy-dry-run.ts")).href
);
const qcMod = await import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-typographic-qc.ts")).href);
const techMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-image-technical-qc.ts")).href
);
const ingestMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-composed-ingest.ts")).href
);
const roleMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-image-role-storage.ts")).href
);
const reviewMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-overlay-review.ts")).href
);
const ocrMod = await import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-ocr-gate.ts")).href);
const scaffoldMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-composed-execution-scaffold.ts")).href
);
const leakMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-human-review-reject.ts")).href
);
const atlasMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-overlay-latin-bitmap.ts")).href
);
const fontMod = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-overlay-font.ts")).href
);

function writeReport(report) {
  const blob = JSON.stringify(report);
  planMod.assertPhase11ACompositionPreflightReportRedacted(blob);
  mkdirSync(join(studioRoot, ".tmp"), { recursive: true });
  writeFileSync(join(studioRoot, ".tmp", "phase-11a-corrected-recomposition-execution.json"), `${blob}\n`);
}

async function nextRevision(db, artifactType) {
  const { data, error } = await db
    .from("project_artifacts")
    .select("revision")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", artifactType)
    .order("revision", { ascending: false })
    .limit(1);
  if (error) fail(`revision ${artifactType}: ${error.message}`);
  return Number(data?.[0]?.revision || 0) + 1;
}

async function persistScaffold(db, facts, existingQr, existingPr) {
  if (existingQr && existingPr) {
    return {
      qualityReportId: existingQr.id,
      productionResultId: existingPr.id,
      wrote: false,
    };
  }
  const qrValue = scaffoldMod.buildPhase11AComposedQualityReport(facts);
  const prValue = scaffoldMod.buildPhase11AComposedProductionResult(facts);
  leakMod.assertPhase11APayloadHasNoMediaLeak(qrValue);
  leakMod.assertPhase11APayloadHasNoMediaLeak(prValue);
  const nowIso = facts.nowIso;
  let qrId = existingQr?.id;
  let qrRev = existingQr?.revision || 1;
  let prId = existingPr?.id;
  let prRev = existingPr?.revision || 1;
  if (!existingQr) {
    qrRev = await nextRevision(db, "quality_report");
    qrId = facts.qualityReportId;
    const { error } = await db.from("project_artifacts").insert({
      id: qrId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      artifact_type: "quality_report",
      revision: qrRev,
      schema_version: "1.0.0",
      value: qrValue,
      created_at: nowIso,
      created_by: ACTOR,
      correlation_id: CORRELATION,
    });
    if (error) fail(`quality_report insert: ${error.message}`);
  }
  if (!existingPr) {
    prRev = await nextRevision(db, "production_result");
    prId = facts.productionResultId;
    const { error } = await db.from("project_artifacts").insert({
      id: prId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      artifact_type: "production_result",
      revision: prRev,
      schema_version: "1.1.0",
      value: prValue,
      created_at: nowIso,
      created_by: ACTOR,
      correlation_id: CORRELATION,
    });
    if (error) fail(`production_result insert: ${error.message}`);
  }
  const { error: actQr } = await db.from("active_artifact_revisions").upsert(
    {
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      artifact_type: "quality_report",
      artifact_id: qrId,
      revision: qrRev,
      updated_at: nowIso,
      updated_by: ACTOR,
    },
    { onConflict: "project_id,artifact_type" },
  );
  if (actQr) fail(`activate qr: ${actQr.message}`);
  const { error: actPr } = await db.from("active_artifact_revisions").upsert(
    {
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      artifact_type: "production_result",
      artifact_id: prId,
      revision: prRev,
      updated_at: nowIso,
      updated_by: ACTOR,
    },
    { onConflict: "project_id,artifact_type" },
  );
  if (actPr) fail(`activate pr: ${actPr.message}`);
  return { qualityReportId: qrId, productionResultId: prId, wrote: !existingQr || !existingPr };
}

async function main() {
  if (process.env[CONFIRM_ENV] !== "1") fail(`${CONFIRM_ENV} required`);
  if (process.env.PHASE_11A_ALLOW_EXECUTE === "1") fail("PHASE_11A_ALLOW_EXECUTE forbidden");
  assertApplicativeSource();

  const report = {
    auth: AUTH,
    verdict: null,
    applicativeSource: EXPECTED_COMMIT,
    providerCalled: false,
    ProductionStorageWrite: false,
    composedAssetCreated: false,
    HumanReviewDecision: null,
    HumanReviewSeeded: false,
    signedUrlCount: 0,
    signedUrlPersisted: false,
    storageDownloads: 0,
    storageWrites: 0,
  };

  let providerBuf = null;
  let composedPng = null;
  try {
    report.localCompositionNoVercelFlags = true;
    report.noVercelDeploy = true;

    const db = remoteDb();
    const before = await captureCounters(db);
    report.countersBefore = before;
    assertBudget(before.budget);
    const targets = await loadTargets(db);
    if (targets.runRow.status !== "completed") fail(`run status ${targets.runRow.status}`);
    if (targets.job.status !== "completed") fail("job not completed");
    if (composeMod.PHASE_11A_COMPOSITOR_VERSION !== EXPECTED_COMPOSITOR) {
      fail(`runtime compositor ${composeMod.PHASE_11A_COMPOSITOR_VERSION}`);
    }
    if (atlasMod.PHASE_11A_BITMAP_GLYPH_ATLAS_ID !== EXPECTED_ATLAS) fail("atlas id");
    if (typeof fontMod.glyphRowsForCodepoint !== "function") fail("glyph lookup missing");
    if (fontMod.glyphRowsForCodepoint === atlasMod.legacyHashGlyphRows) {
      fail("STOP: runtime selected legacyHashGlyphRows");
    }

    const spec = overlayMod.createDefaultPhase11AOverlaySpec({
      locale: copyMod.PHASE_11A_SCENE2_OVERLAY_LOCALE,
      title: copyMod.PHASE_11A_SCENE2_OVERLAY_TITLE,
      callToAction: copyMod.PHASE_11A_SCENE2_OVERLAY_CTA,
    });
    const overlayFp = overlayMod.fingerprintImageTextOverlaySpec(spec);
    if (overlayFp !== EXPECTED_OVERLAY_FP) fail("overlay fingerprint");
    if (spec.locale !== "fr") fail("overlay locale");
    if (spec.title !== copyMod.PHASE_11A_SCENE2_OVERLAY_TITLE) fail("title mutated");
    if (spec.callToAction !== copyMod.PHASE_11A_SCENE2_OVERLAY_CTA) fail("cta mutated");
    if (spec.subtitle || spec.legalLine) fail("subtitle/legal must be absent");
    if (spec.fontFamily !== "vhs-overlay-latin-bitmap-v1") fail("font");
    if (spec.fontWeight !== "bold" || spec.fontSize !== 32) fail("font weight/size");
    if (spec.overflowPolicy !== "reject") fail("overflow policy");
    const requiredCps = atlasMod.overlayCodepoints(`${spec.title}${spec.callToAction}`);
    const uniqueCps = [...new Set(requiredCps)];
    if (uniqueCps.length !== 22) fail(`required codepoints ${uniqueCps.length}`);
    if (!uniqueCps.includes(0x2019) || !uniqueCps.includes(0x00e9) || !uniqueCps.includes(0x00e0)) {
      fail("required accent/apostrophe missing");
    }
    for (const cp of uniqueCps) {
      if (!fontMod.isPhase11AOverlayCodepointAllowed(cp)) {
        fail(`unsupported required U+${cp.toString(16)}`);
      }
      const rows = fontMod.glyphRowsForCodepoint(cp);
      if (cp !== 0x20 && atlasMod.glyphRowsEqual(rows, atlasMod.legacyHashGlyphRows(cp))) {
        fail(`legacy LCG still selected for U+${cp.toString(16)}`);
      }
    }

    providerBuf = await downloadOnce(db, targets.provider.storage_path);
    report.signedUrlCount = 1;
    report.storageDownloads = 1;
    const parentChecksum = techMod.checksumSha256Bytes(providerBuf);
    if (parentChecksum !== targets.provider.checksum) fail("parent checksum mismatch");
    const filters = inspectMod.inspectPhase11APngScanlineFilters(providerBuf);
    if (JSON.stringify(filters) !== JSON.stringify([1, 2, 3, 4])) fail(`unexpected filters ${filters}`);
    pngMod.decodeRgbPng(providerBuf);

    const composed = composeMod.composePhase11ADeterministicOverlay({
      providerPng: providerBuf,
      spec,
    });
    composedPng = composed.png;
    if (composed.compositorVersion !== EXPECTED_COMPOSITOR) fail("compositor version");
    if (composed.checksumSha256 !== EXPECTED_COMPOSED_CHECKSUM) {
      fail(`STOP checksum ${composed.checksumSha256}`);
    }
    if (composed.png.byteLength !== EXPECTED_COMPOSED_BYTES) {
      fail(`STOP size ${composed.png.byteLength}`);
    }
    if (composed.width !== 1024 || composed.height !== 1024) fail("STOP dimensions");
    if (composed.overlayFingerprint !== EXPECTED_OVERLAY_FP) fail("composed overlay fp");
    if (composed.renderedStrings[0] !== spec.title) fail("title mutated at render");
    if (composed.renderedStrings[1] !== spec.callToAction) fail("cta mutated at render");
    const ctaLines = composed.lineBoxes.filter((b) => b.role === "callToAction").map((b) => b.text);
    if (ctaLines[0] !== "Découvrir Virtual Humans" || ctaLines[1] !== "Studio") {
      fail(`cta wrap ${JSON.stringify(ctaLines)}`);
    }
    const typo = qcMod.validatePhase11ATypographicQc({ spec, composed });
    if (typo.status !== "accepted") fail(`typo ${typo.reasons.map((r) => r.code).join(",")}`);
    if (Math.abs(composed.contrastRatio - 15.01) > 0.02) fail(`contrast ${composed.contrastRatio}`);
    pngMod.decodeRgbPng(composed.png);

    const composedFp = ingestMod.fingerprintPhase11AComposedAsset({
      parentChecksumSha256: parentChecksum,
      overlay: spec,
      compositorVersion: composed.compositorVersion,
    });
    if (!composedFp.startsWith(EXPECTED_FINGERPRINT_PREFIX)) {
      fail(`STOP fingerprint ${composedFp.slice(0, 16)}`);
    }
    const composedId = ingestMod.composedAssetIdFromFingerprint(composedFp);
    if (!composedId.startsWith(EXPECTED_ASSET_PREFIX)) fail(`STOP assetId ${composedId.slice(0, 8)}`);
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

    const ocr = ocrMod.evaluateProviderImageTextGate({
      available: false,
      detected: false,
      score: 0,
      snippets: [],
    });
    const card = reviewMod.buildPhase11AOverlayReviewCard({
      providerAssetId: targets.provider.id,
      composedAssetId: composedId,
      spec,
      typographicQc: typo,
      ocrGate: ocr,
      overlayFingerprint: overlayFp,
      overlayVersion: spec.version,
      compositorVersion: composed.compositorVersion,
      providerCostMinorAlreadySettled: 0,
      providerPathIsLegacyFiveSegment: String(targets.provider.storage_path).split("/").length === 5,
    });
    leakMod.assertPhase11APayloadHasNoMediaLeak(card);

    const { data: existingObj } = await db.storage
      .from(BUCKET)
      .list(`${WORKSPACE_ID}/${PROJECT_ID}/media/image/composed`, {
        search: `${composedId}.png`,
        limit: 5,
      });
    const objectExists = (existingObj || []).some((o) => o.name === `${composedId}.png`);
    let storageWrote = false;
    if (!objectExists) {
      const { error: upErr } = await db.storage.from(BUCKET).upload(storagePath, composed.png, {
        contentType: "image/png",
        upsert: false,
      });
      if (upErr) fail(`upload: ${upErr.message}`);
      storageWrote = true;
      report.storageWrites = 1;
      report.ProductionStorageWrite = true;
    } else {
      const { data: signed, error: sErr } = await db.storage.from(BUCKET).createSignedUrl(storagePath, 30);
      if (sErr || !signed?.signedUrl) fail("replay checksum url");
      let replayUrl = signed.signedUrl;
      try {
        const res = await fetch(replayUrl, { redirect: "error" });
        const bytes = new Uint8Array(await res.arrayBuffer());
        const existingSum = techMod.checksumSha256Bytes(bytes);
        bytes.fill(0);
        if (existingSum !== composed.checksumSha256) fail("collision divergent object");
      } finally {
        replayUrl = null;
      }
    }

    const { data: existingAsset } = await db.from("assets").select("id,checksum,provenance,status").eq("id", composedId).maybeSingle();
    let assetWrote = false;
    if (!existingAsset) {
      const nowIso = new Date().toISOString();
      const { error: insErr } = await db.from("assets").insert({
        id: composedId,
        workspace_id: WORKSPACE_ID,
        project_id: PROJECT_ID,
        run_id: targets.provider.run_id,
        scene_id: SCENE_ID,
        step_id: targets.provider.step_id,
        kind: "image",
        mime_type: "image/png",
        storage_bucket: BUCKET,
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
          parentAssetId: targets.provider.id,
          overlayVersion: composed.overlayVersion,
          overlayFingerprint: composed.overlayFingerprint,
          compositorVersion: composed.compositorVersion,
          atlasVersion: EXPECTED_ATLAS,
          overlayReviewCard: card,
        },
        status: "pending_review",
        created_at: nowIso,
      });
      if (insErr) fail(`asset insert: ${insErr.message}`);
      assetWrote = true;
      report.composedAssetCreated = true;
    } else if (existingAsset.checksum !== composed.checksumSha256) {
      fail("existing composed asset checksum collision");
    }

    const { data: qrRows } = await db
      .from("project_artifacts")
      .select("id,revision,value")
      .eq("project_id", PROJECT_ID)
      .eq("artifact_type", "quality_report");
    const existingQr = (qrRows || []).find((row) => {
      const v = row.value && typeof row.value === "object" ? row.value : {};
      return v.kind === scaffoldMod.PHASE_11A_COMPOSED_QUALITY_REPORT_KIND && v.asset?.id === composedId;
    });
    const { data: prRows } = await db
      .from("project_artifacts")
      .select("id,revision,value")
      .eq("project_id", PROJECT_ID)
      .eq("artifact_type", "production_result");
    const existingPr = (prRows || []).find((row) => {
      const v = row.value && typeof row.value === "object" ? row.value : {};
      return v.phase11a?.parentAssetId === targets.provider.id && v.delivery?.finalAssetId === composedId;
    });

    const nowIso = new Date().toISOString();
    const facts = {
      qualityReportId: existingQr?.id || randomUUID(),
      productionResultId: existingPr?.id || randomUUID(),
      projectId: PROJECT_ID,
      createdBy: ACTOR,
      correlationId: CORRELATION,
      nowIso,
      runId: targets.runRow.id,
      jobId: targets.job.id,
      parentAssetId: targets.provider.id,
      composedAssetId: composedId,
      composedChecksumSha256: composed.checksumSha256,
      composedByteLength: composed.png.byteLength,
      overlayFingerprint: overlayFp,
      compositorVersion: composed.compositorVersion,
      generationPlanArtifactId: targets.runRow.generation_plan_artifact_id,
      estimatedCostMinor: Number(targets.runRow.estimated_cost_minor || 0),
      committedCostMinor: Number(targets.runRow.committed_cost_minor || 0),
      typographicStatus: "accepted",
      contrastRatio: composed.contrastRatio,
    };
    const scaffold = await persistScaffold(db, facts, existingQr, existingPr);
    report.HumanReviewSeeded = true;
    report.qualityReportPrefix = String(scaffold.qualityReportId).slice(0, 8);
    report.productionResultPrefix = String(scaffold.productionResultId).slice(0, 8);
    report.reviewRequestId = scaffoldMod.buildPhase11AComposedReviewRequestId({
      projectId: PROJECT_ID,
      composedAssetId: composedId,
    });

    const nextState = {
      ...(targets.runRow.state && typeof targets.runRow.state === "object" ? targets.runRow.state : {}),
      waitingReason: "needs_review",
      updatedAt: nowIso,
      composedOverlay: {
        assetIdPrefix: composedId.slice(0, 8),
        parentAssetIdPrefix: String(targets.provider.id).slice(0, 8),
        humanReviewDecision: null,
        auth: AUTH,
      },
    };
    const { error: runErr } = await db
      .from("production_runs")
      .update({
        state: nextState,
        updated_at: nowIso,
        revision: Number(targets.runRow.revision || 1) + 1,
      })
      .eq("id", targets.runRow.id)
      .eq("revision", targets.runRow.revision)
      .eq("status", "completed");
    if (runErr) fail(`run update: ${runErr.message}`);
    report.runUpdated = true;
    report.runStatusUnchanged = "completed";

    const replayObj = await db.storage
      .from(BUCKET)
      .list(`${WORKSPACE_ID}/${PROJECT_ID}/media/image/composed`, {
        search: `${composedId}.png`,
        limit: 5,
      });
    const replayCount = (replayObj.data || []).filter((o) => o.name === `${composedId}.png`).length;
    if (replayCount !== 1) fail(`composed objects ${replayCount}`);
    const { count: assetCount } = await db.from("assets").select("id", { count: "exact", head: true }).eq("id", composedId);
    if (assetCount !== 1) fail("composed asset not unique");

    const after = await captureCounters(db);
    report.countersAfter = after;
    assertBudget(after.budget);
    if (after.human_review_decisions.count !== before.human_review_decisions.count) {
      fail("HR decision created");
    }
    if (after.production_runs.count !== before.production_runs.count) fail("run count changed");
    if (after.production_jobs.count !== before.production_jobs.count) fail("job count changed");
    if (
      before.generation_attempts.missing === false &&
      after.generation_attempts.missing === false &&
      after.generation_attempts.count !== before.generation_attempts.count
    ) {
      fail("attempt count changed");
    }
    if (after.ledger_rows.count !== before.ledger_rows.count) fail("ledger changed");
    const expectedAssetDelta = existingAsset ? 0 : 1;
    const expectedStorageDelta = objectExists ? 0 : 1;
    if (after.image_assets.count !== before.image_assets.count + expectedAssetDelta) {
      fail(`asset delta ${before.image_assets.count}->${after.image_assets.count}`);
    }
    if (after.storage_objects.count !== before.storage_objects.count + expectedStorageDelta) {
      fail(`storage delta ${before.storage_objects.count}->${after.storage_objects.count}`);
    }

    const afterTargets = await loadTargets(db);
    if (String(afterTargets.rejected.checksum).slice(0, 16) !== REJECTED_CHECKSUM_PREFIX) {
      fail("rejected smoke mutated");
    }
    if (String(afterTargets.provider.checksum).slice(0, 16) !== PROVIDER_CHECKSUM_PREFIX) {
      fail("provider mutated");
    }
    if (String(afterTargets.provider.status) !== "pending_review") fail("parent status drifted");
    if (String(afterTargets.rejectedComposed.checksum).slice(0, 16) !== REJECTED_COMPOSED_CHECKSUM_PREFIX) {
      fail("rejected composed mutated");
    }
    if (String(afterTargets.rejectedComposed.status) !== "rejected") fail("rejected composed status");
    if (afterTargets.job.status !== "completed") fail("job drifted");
    if (afterTargets.runRow.status !== "completed") fail("run status drifted");
    const afterWaiting =
      afterTargets.runRow.state && typeof afterTargets.runRow.state === "object"
        ? afterTargets.runRow.state.waitingReason
        : null;
    if (afterWaiting !== "needs_review") fail(`run waitingReason ${afterWaiting}`);
    const { data: composedRow } = await db.from("assets").select("id,status,provenance,checksum,size_bytes,mime_type,width,height").eq("id", composedId).maybeSingle();
    const composedProv = composedRow?.provenance && typeof composedRow.provenance === "object" ? composedRow.provenance : {};
    if (composedProv.active === true || composedRow.status !== "pending_review") fail("composed must stay pending inactive");
    if (composedProv.parentAssetId !== targets.provider.id) fail("parent/child link");
    if (composedProv.compositorVersion !== EXPECTED_COMPOSITOR) fail("composed compositor");
    if (composedProv.atlasVersion !== EXPECTED_ATLAS) fail("composed atlas");
    if (composedRow.checksum !== EXPECTED_COMPOSED_CHECKSUM) fail("persisted checksum");
    if (Number(composedRow.size_bytes) !== EXPECTED_COMPOSED_BYTES) fail("persisted size");
    if (composedRow.mime_type !== "image/png") fail("persisted mime");

    report.verdict = "CORRECTED_COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING";
    report.parentAssetPrefix = PROVIDER_ASSET_PREFIX;
    report.parentChecksumPrefix = PROVIDER_CHECKSUM_PREFIX;
    report.composedAssetPrefix = composedId.slice(0, 8);
    report.composedChecksumPrefix = composed.checksumSha256.slice(0, 16);
    report.composedChecksumExact = composed.checksumSha256;
    report.composedBytes = composed.png.byteLength;
    report.compositorVersion = EXPECTED_COMPOSITOR;
    report.atlasVersion = EXPECTED_ATLAS;
    report.requiredCodepointCount = uniqueCps.length;
    report.legacyLcgSelected = false;
    report.fourAssets = {
      parent: { prefix: PROVIDER_ASSET_PREFIX, status: "pending_review", active: false },
      rejectedComposed: { prefix: REJECTED_COMPOSED_PREFIX, status: "rejected", active: false },
      smoke: { prefix: REJECTED_ASSET_PREFIX, status: "rejected", active: false },
      corrected: { prefix: composedId.slice(0, 8), status: "pending_review", active: false },
    };
    report.storagePathRedacted = redactPath(storagePath, composedId);
    report.parentChild = { parent: PROVIDER_ASSET_PREFIX, child: composedId.slice(0, 8) };
    report.technicalQc = "PASS";
    report.typographicQc = "PASS";
    report.ocr = "unavailable_humanOnly";
    report.visual = "humanOnly";
    report.pngFiltersEncountered = filters;
    report.replayIdempotent = !storageWrote && !assetWrote ? true : replayCount === 1;
    report.firstWrite = { storageWrote, assetWrote, scaffoldWrote: scaffold.wrote };
    report.runFinal = { status: "completed", waitingReason: "needs_review" };
    report.jobFinal = { status: "completed" };
    report.providerCalls = 0;
    report.runtimePaidMedia = "OFF";
    report.openaiImageRealExecution = "UNAVAILABLE";
    report.deterministicOverlayExecution = "UNAVAILABLE";
    report.motionRuntime = "UNAVAILABLE";

    const replay2 = await persistScaffold(db, facts, {
      id: scaffold.qualityReportId,
      revision: existingQr?.revision || 1,
    }, {
      id: scaffold.productionResultId,
      revision: existingPr?.revision || 1,
    });
    if (replay2.wrote) fail("scaffold replay wrote again");
    report.replayIdempotent = true;
  } catch (e) {
    const msg = String(e.message || e);
    console.error("EXECUTION_STOP", msg.slice(0, 400));
    report.verdict = report.verdict || (/checksum|integrity/i.test(msg) ? "BLOCKED_PROVIDER_ASSET_INTEGRITY" : "BLOCKED_COMPOSITION_EXECUTION");
    report.error = msg.slice(0, 240);
    throw e;
  } finally {
    try {
      if (providerBuf) providerBuf.fill(0);
      if (composedPng) composedPng.fill(0);
    } catch {
      /* ignore */
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
        applicativeSource: EXPECTED_COMMIT_SHORT,
        composedAssetPrefix: report.composedAssetPrefix,
        composedChecksumPrefix: report.composedChecksumPrefix,
        providerCalled: false,
        HumanReviewDecision: null,
        replayIdempotent: report.replayIdempotent,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
