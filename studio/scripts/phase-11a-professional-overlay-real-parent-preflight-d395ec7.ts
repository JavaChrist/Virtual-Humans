#!/usr/bin/env node
/**
 * Phase 11A professional overlay real-parent preflight (d395ec7).
 *
 *   CONFIRM_PHASE_11A_PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT=1 \
 *     npx tsx scripts/phase-11a-professional-overlay-real-parent-preflight-d395ec7.ts
 *
 * One signed URL (TTL 60s) · one download · compose 1.2.0 twice in memory.
 * No Vercel deploy · no Production write · no OpenAI.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createPhase11AProfessionalOverlaySpec } from "@/domain/production/image-text-overlay";
import {
  PHASE_11A_SCENE2_OVERLAY_CTA,
  PHASE_11A_SCENE2_OVERLAY_LOCALE,
  PHASE_11A_SCENE2_OVERLAY_TITLE,
} from "@/application/production/phase-11a-strip-overlay-copy-dry-run";
import { PHASE_11A_COMPOSITOR_VERSION } from "@/application/production/phase-11a-deterministic-compositor";
import {
  composePhase11AVectorOverlay,
  PHASE_11A_VECTOR_COMPOSITOR_VERSION,
} from "@/application/production/phase-11a-vector-compositor";
import {
  hasPhase11AVectorGlyph,
  overlayCodepoints,
  PHASE_11A_VECTOR_FONT_FAMILY,
  PHASE_11A_VECTOR_FONT_ID,
  PHASE_11A_VECTOR_FONT_LICENSE,
} from "@/application/production/phase-11a-overlay-latin-vector";
import {
  PHASE_11A_CONTRAST_PANEL_VERSION,
  PHASE_11A_LAYOUT_12_SAFE_AREA,
  PHASE_11A_LAYOUT_VERSION,
  planPhase11ALayout12,
} from "@/application/production/phase-11a-overlay-layout-1-2";
import { validatePhase11ATypographicQc } from "@/application/production/phase-11a-typographic-qc";
import { checksumSha256Bytes, readPngDimensions } from "@/application/production/phase-11a-image-technical-qc";
import { decodeRgbPng, readPhase11APngIhdr } from "@/application/production/phase-11a-png-rgb";
import { inspectPhase11APngScanlineFilters } from "@/application/production/phase-11a-png-scanline-filter-inspect";
import {
  composedAssetIdFromFingerprint,
  fingerprintPhase11AComposedAsset,
} from "@/application/production/phase-11a-composed-ingest";
import { cropRgbPng } from "@/application/production/phase-11a-overlay-synthetic-fixtures";
import {
  assertPhase11AProfessionalPreflightConfirm,
  assertPhase11AProfessionalPreflightReportRedacted,
  assertPhase11AProfessionalSourceVersions,
  PHASE_11A_PARENT_EXPECTED_BYTES,
  PHASE_11A_PROFESSIONAL_COMPOSED_100_CHECKSUM_PREFIX,
  PHASE_11A_PROFESSIONAL_COMPOSED_100_DECISION_PREFIX,
  PHASE_11A_PROFESSIONAL_COMPOSED_100_PREFIX,
  PHASE_11A_PROFESSIONAL_COMPOSED_110_CHECKSUM_PREFIX,
  PHASE_11A_PROFESSIONAL_COMPOSED_110_DECISION_PREFIX,
  PHASE_11A_PROFESSIONAL_COMPOSED_110_PREFIX,
  PHASE_11A_PROFESSIONAL_PARENT_CHECKSUM_PREFIX,
  PHASE_11A_PROFESSIONAL_PARENT_PREFIX,
  PHASE_11A_PROFESSIONAL_PREFLIGHT_AUTH,
  PHASE_11A_PROFESSIONAL_PREVIEW_DIR,
  PHASE_11A_PROFESSIONAL_SMOKE_PREFIX,
  PHASE_11A_PROFESSIONAL_SOURCE_COMMIT,
  PHASE_11A_PROFESSIONAL_SOURCE_COMMIT_SHORT,
  PHASE_11A_SIGNED_URL_MAX_BYTES,
  PHASE_11A_SIGNED_URL_TTL_SEC,
  redactChecksumPrefix,
} from "@/application/production/phase-11a-professional-overlay-real-parent-preflight";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(studioRoot, "..");
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const RUN_PREFIX = "39329a01";
const JOB_PREFIX = "edc6e84a";
const BUCKET = "director-final-assets";
const SUPABASE_HOST = "ejdbksxaswhdtsudnmvi.supabase.co";
const PREVIEW_ABS = resolve(repoRoot, PHASE_11A_PROFESSIONAL_PREVIEW_DIR);

function fail(msg: string): never {
  throw new Error(msg);
}

function loadEnvFile(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2] ?? "";
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map[m[1]!] = v;
  }
  return map;
}

function remoteDb(): SupabaseClient {
  const remote = loadEnvFile(resolve(studioRoot, ".env.remote.local"));
  if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
    fail("missing .env.remote.local Supabase credentials");
  }
  const host = new URL(remote.SUPABASE_URL).hostname;
  if (host !== SUPABASE_HOST) fail(`unexpected Supabase host ${host}`);
  return createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function countOrZero(r: { error?: { message?: string; code?: string } | null; count?: number | null }) {
  if (r.error) {
    const msg = String(r.error.message || r.error.code || "");
    if (!msg || /does not exist|Could not find|schema cache|permission|JWT/i.test(msg)) {
      return { missing: true, count: null as number | null };
    }
    fail(`counter query failed: ${msg}`);
  }
  return { missing: false, count: r.count ?? 0 };
}

async function countStorageObjects(db: SupabaseClient): Promise<number> {
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

async function captureCounters(db: SupabaseClient) {
  const [runs, jobs, attempts, reservations, assets, reviews, quality, ledgerCountRes, policy] =
    await Promise.all([
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
      db
        .from("active_artifact_revisions")
        .select("artifact_id", { count: "exact", head: true })
        .eq("project_id", PROJECT_ID)
        .eq("artifact_type", "quality_report"),
      db.from("cost_ledger").select("id", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID),
      db.from("workspace_budget_policies").select("hard_limit_minor").eq("workspace_id", WORKSPACE_ID).maybeSingle(),
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
  return {
    production_runs: countOrZero(runs),
    production_jobs: countOrZero(jobs),
    generation_attempts: countOrZero(attempts),
    active_reservations: countOrZero(reservations),
    image_assets: countOrZero(assets),
    human_review_decisions: countOrZero(reviews),
    quality_reports: countOrZero(quality),
    ledger_rows: countOrZero(ledgerCountRes),
    storage_objects: { missing: false, count: await countStorageObjects(db) },
    budget: {
      hardMinor: hard,
      reservedMinor: reserved,
      committedMinor,
      availableMinor: Number.isFinite(hard) ? hard - reserved - committedMinor : null,
    },
  };
}

function assertBudget(budget: { hardMinor: number; committedMinor: number; reservedMinor: number; availableMinor: number | null }) {
  if (budget.hardMinor !== 274) fail(`hard expected 274 got ${budget.hardMinor}`);
  if (budget.committedMinor !== 249) fail(`committed expected 249 got ${budget.committedMinor}`);
  if (budget.reservedMinor !== 0) fail(`reserved expected 0 got ${budget.reservedMinor}`);
  if (budget.availableMinor !== 25) fail(`available expected 25 got ${budget.availableMinor}`);
}

function assertCountersUnchanged(before: Awaited<ReturnType<typeof captureCounters>>, after: Awaited<ReturnType<typeof captureCounters>>) {
  for (const key of [
    "production_runs",
    "production_jobs",
    "generation_attempts",
    "active_reservations",
    "image_assets",
    "human_review_decisions",
    "quality_reports",
    "ledger_rows",
    "storage_objects",
  ] as const) {
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

async function assertHistoricalTargets(db: SupabaseClient) {
  const { data: assets, error } = await db
    .from("assets")
    .select("id,status,kind,mime_type,storage_bucket,storage_path,checksum,size_bytes,width,height,provenance")
    .eq("project_id", PROJECT_ID)
    .eq("kind", "image");
  if (error) fail(`assets: ${error.message}`);
  const find = (prefix: string) => (assets ?? []).find((a) => String(a.id).startsWith(prefix));
  const parent = find(PHASE_11A_PROFESSIONAL_PARENT_PREFIX);
  if (!parent) fail("parent missing");
  if (String(parent.checksum || "").slice(0, 16) !== PHASE_11A_PROFESSIONAL_PARENT_CHECKSUM_PREFIX) {
    fail("parent checksum mismatch");
  }
  if (String(parent.mime_type) !== "image/png") fail(`parent mime ${parent.mime_type}`);
  if (Number(parent.width) !== 1024 || Number(parent.height) !== 1024) fail("parent dims");
  if (Number(parent.size_bytes) !== PHASE_11A_PARENT_EXPECTED_BYTES) fail("parent size");
  if (String(parent.status) !== "pending_review") fail(`parent status ${parent.status}`);
  const parentProv = parent.provenance && typeof parent.provenance === "object" ? parent.provenance : {};
  if ((parentProv as { active?: boolean }).active === true) fail("parent must stay inactive");
  if (String(parent.storage_path || "").includes("/composed/")) fail("parent path looks composed");

  const composed110 = find(PHASE_11A_PROFESSIONAL_COMPOSED_110_PREFIX);
  if (!composed110) fail("composed 1.1.0 missing");
  if (String(composed110.status) !== "rejected") fail("composed 1.1.0 status");
  if (String(composed110.checksum || "").slice(0, 16) !== PHASE_11A_PROFESSIONAL_COMPOSED_110_CHECKSUM_PREFIX) {
    fail("composed 1.1.0 checksum changed");
  }
  const composed100 = find(PHASE_11A_PROFESSIONAL_COMPOSED_100_PREFIX);
  if (!composed100) fail("composed 1.0.0 missing");
  if (String(composed100.status) !== "rejected") fail("composed 1.0.0 status");
  if (String(composed100.checksum || "").slice(0, 16) !== PHASE_11A_PROFESSIONAL_COMPOSED_100_CHECKSUM_PREFIX) {
    fail("composed 1.0.0 checksum changed");
  }
  const smoke = find(PHASE_11A_PROFESSIONAL_SMOKE_PREFIX);
  if (!smoke) fail("smoke missing");
  if (String(smoke.status) !== "rejected") fail("smoke status");

  const { data: reviews, error: rErr } = await db
    .from("human_review_decisions")
    .select("id,decision")
    .eq("project_id", PROJECT_ID);
  if (rErr) fail(`human_review_decisions: ${rErr.message}`);
  const rejected = (reviews ?? []).filter((d) => String(d.decision) === "rejected");
  if (rejected.length !== 3) fail(`expected 3 REJECT got ${rejected.length}`);
  if (!(reviews ?? []).some((d) => String(d.id).startsWith(PHASE_11A_PROFESSIONAL_COMPOSED_110_DECISION_PREFIX))) {
    fail("1.1.0 decision missing");
  }
  if (!(reviews ?? []).some((d) => String(d.id).startsWith(PHASE_11A_PROFESSIONAL_COMPOSED_100_DECISION_PREFIX))) {
    fail("1.0.0 decision missing");
  }

  const { data: runs, error: runErr } = await db
    .from("production_runs")
    .select("id,status,state")
    .eq("project_id", PROJECT_ID);
  if (runErr) fail(`run: ${runErr.message}`);
  const run = (runs ?? []).find((r) => String(r.id).startsWith(RUN_PREFIX));
  if (!run) fail("run missing");
  if (String(run.status) !== "completed") fail(`run status ${run.status}`);
  const waiting = run.state && typeof run.state === "object" ? (run.state as { waitingReason?: string }).waitingReason : null;
  if (waiting === "needs_review") fail("waitingReason must stay closed");

  const { data: jobs, error: jobErr } = await db
    .from("production_jobs")
    .select("id,status")
    .eq("project_id", PROJECT_ID);
  if (jobErr) fail(`job: ${jobErr.message}`);
  const job = (jobs ?? []).find((j) => String(j.id).startsWith(JOB_PREFIX));
  if (!job) fail("job missing");
  if (String(job.status) !== "completed") fail(`job status ${job.status}`);

  return {
    storagePath: String(parent.storage_path),
    providerChecksum: String(parent.checksum),
    parentStatus: String(parent.status),
  };
}

async function downloadParentOnce(db: SupabaseClient, storagePath: string): Promise<Uint8Array> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(storagePath, PHASE_11A_SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) fail(`signed url: ${error?.message || "missing"}`);
  let signedUrl: string | null = data.signedUrl;
  try {
    const parsed = new URL(signedUrl);
    if (parsed.protocol !== "https:") fail("signed url must be https");
    if (parsed.hostname !== SUPABASE_HOST) fail("signed url host unexpected");
    if (parsed.pathname.includes("..")) fail("signed url path hostile");
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20_000);
    try {
      const res = await fetch(signedUrl, { method: "GET", redirect: "error", signal: ac.signal });
      if (!res.ok) fail(`download HTTP ${res.status}`);
      const mime = String(res.headers.get("content-type") || "").split(";")[0].trim();
      if (mime !== "image/png") fail(`download mime ${mime}`);
      const raw = new Uint8Array(await res.arrayBuffer());
      if (raw.byteLength > PHASE_11A_SIGNED_URL_MAX_BYTES) fail("download exceeds 8 MiB");
      if (raw.byteLength !== PHASE_11A_PARENT_EXPECTED_BYTES) fail(`download size ${raw.byteLength}`);
      return raw;
    } finally {
      clearTimeout(timer);
    }
  } finally {
    signedUrl = null;
  }
}

async function main(): Promise<void> {
  assertPhase11AProfessionalPreflightConfirm(process.env);
  if (process.argv.includes("--execute")) fail("--execute is forbidden");

  const head = String(spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).stdout || "").trim();
  if (head !== PHASE_11A_PROFESSIONAL_SOURCE_COMMIT) {
    fail(`git HEAD ${head} != ${PHASE_11A_PROFESSIONAL_SOURCE_COMMIT}`);
  }
  const behind = String(
    spawnSync("git", ["rev-list", "--count", "HEAD..origin/main"], { cwd: repoRoot, encoding: "utf8" }).stdout || "",
  ).trim();
  if (behind !== "0") fail("origin/main behind != 0");

  assertPhase11AProfessionalSourceVersions({
    fontFamily: PHASE_11A_VECTOR_FONT_FAMILY,
    fontId: PHASE_11A_VECTOR_FONT_ID,
    fontLicense: PHASE_11A_VECTOR_FONT_LICENSE,
    compositorVersion: PHASE_11A_VECTOR_COMPOSITOR_VERSION,
    layoutVersion: PHASE_11A_LAYOUT_VERSION,
    panelVersion: PHASE_11A_CONTRAST_PANEL_VERSION,
    bitmapCompositorVersion: PHASE_11A_COMPOSITOR_VERSION,
  });

  const report: Record<string, unknown> = {
    auth: PHASE_11A_PROFESSIONAL_PREFLIGHT_AUTH,
    sourceCommit: PHASE_11A_PROFESSIONAL_SOURCE_COMMIT,
    sourceCommitShort: PHASE_11A_PROFESSIONAL_SOURCE_COMMIT_SHORT,
    deploy: "none_local_compositor",
    providerCalled: false,
    signedUrlCount: 0,
    signedUrlTtlSec: PHASE_11A_SIGNED_URL_TTL_SEC,
    storageDownloads: 0,
    storageWrites: 0,
    composedAssetCreated: false,
    humanReviewSeeded: false,
    ProductionStorageWrite: false,
  };

  let parentBuf: Uint8Array | null = null;
  try {
    const db = remoteDb();
    const before = await captureCounters(db);
    assertBudget(before.budget);
    report.countersBefore = before;
    const targets = await assertHistoricalTargets(db);
    report.parentVerified = {
      prefix: PHASE_11A_PROFESSIONAL_PARENT_PREFIX,
      checksumPrefix: PHASE_11A_PROFESSIONAL_PARENT_CHECKSUM_PREFIX,
      status: targets.parentStatus,
      bytes: PHASE_11A_PARENT_EXPECTED_BYTES,
    };

    parentBuf = await downloadParentOnce(db, targets.storagePath);
    report.signedUrlCount = 1;
    report.storageDownloads = 1;
    report.providerAssetRead = true;

    const parentChecksum = checksumSha256Bytes(parentBuf);
    if (parentChecksum !== targets.providerChecksum) fail("BLOCKED_PROVIDER_ASSET_INTEGRITY checksum");
    if (parentChecksum.slice(0, 16) !== PHASE_11A_PROFESSIONAL_PARENT_CHECKSUM_PREFIX) {
      fail("BLOCKED_PROVIDER_ASSET_INTEGRITY prefix");
    }
    const ihdr = readPhase11APngIhdr(parentBuf);
    if (ihdr.width !== 1024 || ihdr.height !== 1024) fail("BLOCKED_PROVIDER_PNG_FORMAT dims");
    const filters = inspectPhase11APngScanlineFilters(parentBuf);
    decodeRgbPng(parentBuf);
    report.pngDecoded = true;
    report.pngFiltersEncountered = filters;

    const spec = createPhase11AProfessionalOverlaySpec({
      locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
      title: PHASE_11A_SCENE2_OVERLAY_TITLE,
      callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
    });
    if (spec.title !== PHASE_11A_SCENE2_OVERLAY_TITLE || spec.callToAction !== PHASE_11A_SCENE2_OVERLAY_CTA) {
      fail("copy mutated");
    }
    if (spec.subtitle || spec.legalLine) fail("subtitle/legal must be absent");
    if (JSON.stringify(spec.safeArea) !== JSON.stringify(PHASE_11A_LAYOUT_12_SAFE_AREA)) {
      fail("safe area contract");
    }
    const cps = [...new Set(overlayCodepoints(`${spec.title}${spec.callToAction}`))];
    if (!cps.includes(0x2019) || !cps.includes(0xe9) || !cps.includes(0xe0)) fail("required accents");
    for (const cp of cps) {
      if (!hasPhase11AVectorGlyph(cp)) fail(`unsupported U+${cp.toString(16)}`);
    }

    const planned = planPhase11ALayout12({
      title: spec.title,
      callToAction: spec.callToAction,
      canvas: 1024,
      safe: spec.safeArea,
    });
    const composed = composePhase11AVectorOverlay({ providerPng: parentBuf, spec });
    const composed2 = composePhase11AVectorOverlay({ providerPng: parentBuf, spec });
    if (composed.checksumSha256 !== composed2.checksumSha256) fail("determinism checksum");
    if (composed.png.byteLength !== composed2.png.byteLength) fail("determinism size");
    for (let i = 0; i < composed.png.byteLength; i++) {
      if (composed.png[i] !== composed2.png[i]) fail("determinism pixels");
    }
    if (JSON.stringify(composed.lineBoxes) !== JSON.stringify(composed2.lineBoxes)) fail("determinism boxes");
    if (composed.compositorVersion !== PHASE_11A_VECTOR_COMPOSITOR_VERSION) fail("compositor version");
    if (composed.fontFamily !== PHASE_11A_VECTOR_FONT_FAMILY) fail("font family");

    const qc = validatePhase11ATypographicQc({ spec, composed });
    if (qc.status !== "accepted") fail(`BLOCKED_TYPOGRAPHIC_QC ${qc.reasons.map((r) => r.code).join(",")}`);
    if (composed.contrastRatio + 1e-9 < 4.5) fail("contrast");
    const dims = readPngDimensions(composed.png);
    if (!dims || dims.width !== 1024 || dims.height !== 1024) fail("composed dims");
    if (composed.checksumSha256.slice(0, 16) === PHASE_11A_PROFESSIONAL_PARENT_CHECKSUM_PREFIX) {
      fail("composed equals parent");
    }
    if (composed.checksumSha256.slice(0, 16) === PHASE_11A_PROFESSIONAL_COMPOSED_100_CHECKSUM_PREFIX) {
      fail("composed equals 1.0.0");
    }
    if (composed.checksumSha256.slice(0, 16) === PHASE_11A_PROFESSIONAL_COMPOSED_110_CHECKSUM_PREFIX) {
      fail("composed equals 1.1.0");
    }

    const futureFp = fingerprintPhase11AComposedAsset({
      parentChecksumSha256: parentChecksum,
      overlay: spec,
      compositorVersion: composed.compositorVersion,
    });
    const futureId = composedAssetIdFromFingerprint(futureFp);
    if (futureId.startsWith(PHASE_11A_PROFESSIONAL_COMPOSED_100_PREFIX)) fail("future id collides 1.0.0");
    if (futureId.startsWith(PHASE_11A_PROFESSIONAL_COMPOSED_110_PREFIX)) fail("future id collides 1.1.0");

    mkdirSync(PREVIEW_ABS, { recursive: true });
    writeFileSync(join(PREVIEW_ABS, "overlay-full.png"), composed.png);
    const titleBox = composed.lineBoxes.find((b) => b.role === "title");
    const ctaBox = composed.lineBoxes.find((b) => b.role === "callToAction");
    if (titleBox) {
      writeFileSync(
        join(PREVIEW_ABS, "crop-title.png"),
        cropRgbPng({
          png: composed.png,
          x: Math.max(0, titleBox.x - 12),
          y: Math.max(0, titleBox.y - 12),
          w: Math.min(1024 - titleBox.x + 12, titleBox.width + 24),
          h: Math.min(1024 - titleBox.y + 12, titleBox.height + 24),
        }),
      );
    }
    if (ctaBox) {
      writeFileSync(
        join(PREVIEW_ABS, "crop-cta.png"),
        cropRgbPng({
          png: composed.png,
          x: Math.max(0, ctaBox.x - 12),
          y: Math.max(0, ctaBox.y - 12),
          w: Math.min(1024 - ctaBox.x + 12, ctaBox.width + 24),
          h: Math.min(1024 - ctaBox.y + 12, ctaBox.height + 24),
        }),
      );
    }
    const summary = {
      compositorVersion: composed.compositorVersion,
      fontFamily: composed.fontFamily,
      fontId: PHASE_11A_VECTOR_FONT_ID,
      layoutVersion: PHASE_11A_LAYOUT_VERSION,
      panelVersion: PHASE_11A_CONTRAST_PANEL_VERSION,
      checksumSha256: composed.checksumSha256,
      overlayFingerprintPrefix: composed.overlayFingerprint.slice(0, 16),
      futureFingerprintPrefix: futureFp.slice(0, 16),
      futureAssetIdPrefix: futureId.slice(0, 8),
      renderedStrings: composed.renderedStrings,
      lines: composed.lineBoxes.map((b) => ({ role: b.role, text: b.text, w: b.width, h: b.height })),
      plannedSizes: planned.map((l) => ({ role: l.role, fontSize: l.fontSize })),
      contrastRatio: composed.contrastRatio,
      productionMediaWritten: 0,
      providerCalls: 0,
    };
    const summaryBlob = `${JSON.stringify(summary, null, 2)}\n`;
    assertPhase11AProfessionalPreflightReportRedacted(summaryBlob);
    writeFileSync(join(PREVIEW_ABS, "summary-redacted.json"), summaryBlob);

    const after = await captureCounters(db);
    assertCountersUnchanged(before, after);
    const targetsAfter = await assertHistoricalTargets(db);
    if (targetsAfter.providerChecksum !== targets.providerChecksum) fail("parent mutated");

    report.verdict = "PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT_READY_FOR_HUMAN_VISUAL_DECISION";
    report.composedChecksumSha256 = composed.checksumSha256;
    report.composedChecksumPrefix = redactChecksumPrefix(composed.checksumSha256);
    report.composedByteLength = composed.png.byteLength;
    report.overlayFingerprintPrefix = composed.overlayFingerprint.slice(0, 16);
    report.futureFingerprintPrefix = futureFp.slice(0, 16);
    report.futureAssetIdPrefix = futureId.slice(0, 8);
    report.contrastRatio = composed.contrastRatio;
    report.lineBoxes = summary.lines;
    report.plannedSizes = summary.plannedSizes;
    report.typographicQc = { status: qc.status, humanOnlyResidual: true };
    report.localPreview = {
      dir: PHASE_11A_PROFESSIONAL_PREVIEW_DIR,
      absolute: PREVIEW_ABS,
      uploaded: false,
      versioned: false,
    };
    report.deltasZero = true;
    report.runtimePaidMedia = "OFF";
    report.openaiImageRealExecution = "UNAVAILABLE";
    report.deterministicOverlayExecution = "UNAVAILABLE";
    report.motionRuntime = "UNAVAILABLE";
  } finally {
    if (parentBuf) parentBuf.fill(0);
    parentBuf = null;
  }

  const out = JSON.stringify(report);
  assertPhase11AProfessionalPreflightReportRedacted(out);
  mkdirSync(join(studioRoot, ".tmp"), { recursive: true });
  writeFileSync(join(studioRoot, ".tmp", "phase-11a-professional-overlay-real-parent-preflight.json"), `${out}\n`);
  process.stdout.write(
    `${JSON.stringify(
      {
        verdict: report.verdict,
        sourceCommit: PHASE_11A_PROFESSIONAL_SOURCE_COMMIT_SHORT,
        checksumPrefix: report.composedChecksumPrefix,
        futureAssetIdPrefix: report.futureAssetIdPrefix,
        preview: PREVIEW_ABS,
        providerCalled: false,
        ProductionStorageWrite: false,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(String(error instanceof Error ? error.message : error).slice(0, 400));
  process.exit(1);
});
