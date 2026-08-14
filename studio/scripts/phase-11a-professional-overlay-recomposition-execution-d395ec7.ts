#!/usr/bin/env node
/**
 * Phase 11A professional overlay recomposition EXECUTION (d395ec7).
 *
 *   CONFIRM_PHASE_11A_PROFESSIONAL_OVERLAY_RECOMPOSITION_EXECUTION=1 \
 *     npx tsx scripts/phase-11a-professional-overlay-recomposition-execution-d395ec7.ts
 *
 * Local/admin only. Compositor 1.2.0 from d395ec7. No OpenAI. No Vercel flags.
 * e94850c is docs-only and is not applicative proof.
 */
import { randomUUID } from "node:crypto";
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
import { checksumSha256Bytes } from "@/application/production/phase-11a-image-technical-qc";
import { decodeRgbPng } from "@/application/production/phase-11a-png-rgb";
import { inspectPhase11APngScanlineFilters } from "@/application/production/phase-11a-png-scanline-filter-inspect";
import {
  composedAssetIdFromFingerprint,
  fingerprintPhase11AComposedAsset,
} from "@/application/production/phase-11a-composed-ingest";
import {
  assertSafePhase11ARoleImageStoragePath,
  buildPhase11ARoleImageStoragePath,
} from "@/application/production/phase-11a-image-role-storage";
import { buildPhase11AOverlayReviewCard } from "@/application/production/phase-11a-overlay-review";
import { evaluateProviderImageTextGate } from "@/application/production/phase-11a-ocr-gate";
import {
  buildPhase11AComposedProductionResult,
  buildPhase11AComposedQualityReport,
  buildPhase11AComposedReviewRequestId,
  PHASE_11A_COMPOSED_QUALITY_REPORT_KIND,
} from "@/application/production/phase-11a-composed-execution-scaffold";
import { assertPhase11APayloadHasNoMediaLeak } from "@/application/production/phase-11a-human-review-reject";
import {
  PHASE_11A_PARENT_EXPECTED_BYTES,
  PHASE_11A_PROFESSIONAL_COMPOSED_100_CHECKSUM_PREFIX,
  PHASE_11A_PROFESSIONAL_COMPOSED_100_DECISION_PREFIX,
  PHASE_11A_PROFESSIONAL_COMPOSED_100_PREFIX,
  PHASE_11A_PROFESSIONAL_COMPOSED_110_CHECKSUM_PREFIX,
  PHASE_11A_PROFESSIONAL_COMPOSED_110_DECISION_PREFIX,
  PHASE_11A_PROFESSIONAL_COMPOSED_110_PREFIX,
  PHASE_11A_PROFESSIONAL_PARENT_CHECKSUM_PREFIX,
  PHASE_11A_PROFESSIONAL_PARENT_PREFIX,
  PHASE_11A_PROFESSIONAL_SMOKE_PREFIX,
  PHASE_11A_SIGNED_URL_MAX_BYTES,
  PHASE_11A_SIGNED_URL_TTL_SEC,
} from "@/application/production/phase-11a-professional-overlay-real-parent-preflight";
import {
  assertPhase11AProfessionalExecutionReportRedacted,
  assertPhase11AProfessionalExpectedRender,
  assertPhase11AProfessionalRecompositionConfirm,
  assertPhase11AProfessionalRuntimeVersions,
  PHASE_11A_PROFESSIONAL_APPLICATIVE_COMMIT,
  PHASE_11A_PROFESSIONAL_APPLICATIVE_COMMIT_SHORT,
  PHASE_11A_PROFESSIONAL_APPLICATIVE_FILES,
  PHASE_11A_PROFESSIONAL_EXPECTED_ASSET_PREFIX,
  PHASE_11A_PROFESSIONAL_EXPECTED_BYTES,
  PHASE_11A_PROFESSIONAL_EXPECTED_CHECKSUM,
  PHASE_11A_PROFESSIONAL_PREFLIGHT_VISUAL_DECISION,
  PHASE_11A_PROFESSIONAL_RECOMPOSITION_AUTH,
} from "@/application/production/phase-11a-professional-overlay-recomposition-execution";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(studioRoot, "..");
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const SCENE_ID = "scene-2";
const RUN_PREFIX = "39329a01";
const JOB_PREFIX = "edc6e84a";
const BUCKET = "director-final-assets";
const SUPABASE_HOST = "ejdbksxaswhdtsudnmvi.supabase.co";
const ACTOR = "phase-11a-professional-recomposition";
const CORRELATION = "corr-11a-professional-recomposition";

function fail(msg: string): never {
  const err = new Error(msg);
  err.name = "Phase11AProfessionalExecutionStop";
  throw err;
}

function run(cmd: string, args: string[], cwd = repoRoot) {
  return spawnSync(cmd, args, { encoding: "utf8", shell: true, cwd, env: process.env });
}

function loadEnvFile(path: string): Record<string, string> {
  const map: Record<string, string> = {};
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

function remoteDb(): SupabaseClient {
  const remote = loadEnvFile(resolve(studioRoot, ".env.remote.local"));
  if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
    fail("missing .env.remote.local Supabase credentials");
  }
  const urlHost = new URL(remote.SUPABASE_URL).hostname;
  if (urlHost !== SUPABASE_HOST) fail("unexpected Supabase host");
  return createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function countOrZero(r: { error?: { message?: string; code?: string } | null; count?: number | null }, label: string) {
  if (r.error) {
    const msg = String(r.error.message || r.error.code || "");
    if (!msg || /does not exist|Could not find|schema cache/i.test(msg)) {
      return { missing: true, count: null as number | null };
    }
    fail(`counter ${label}: ${msg}`);
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
      fail(`storage list: ${msg}`);
    }
    total += (data || []).filter((o) => o.name && String(o.name).endsWith(".png")).length;
  }
  return total;
}

async function captureCounters(db: SupabaseClient) {
  const [runs, jobs, attempts, reservations, assets, reviews, quality, results, ledgerCountRes, policy] =
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
        .from("project_artifacts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", PROJECT_ID)
        .eq("artifact_type", "quality_report"),
      db
        .from("project_artifacts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", PROJECT_ID)
        .eq("artifact_type", "production_result"),
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

function assertBudget(budget: { hardMinor: number; committedMinor: number; reservedMinor: number }) {
  if (budget.hardMinor !== 274 || budget.committedMinor !== 249 || budget.reservedMinor !== 0) {
    fail(`budget drifted ${budget.hardMinor}/${budget.committedMinor}/${budget.reservedMinor}`);
  }
}

function redactPath(path: string, assetId: string): string {
  return String(path || "")
    .replace(WORKSPACE_ID, "{workspaceId}")
    .replace(PROJECT_ID, "{projectId}")
    .replace(assetId, "{assetId}");
}

function assertApplicativeSource(): void {
  for (const file of PHASE_11A_PROFESSIONAL_APPLICATIVE_FILES) {
    const diff = run("git", ["diff", PHASE_11A_PROFESSIONAL_APPLICATIVE_COMMIT_SHORT, "--", file]);
    if (String(diff.stdout || "").trim()) fail(`applicative drift ${file}`);
  }
  const vectorSrc = readFileSync(join(studioRoot, "src/application/production/phase-11a-vector-compositor.ts"), "utf8");
  const fontSrc = readFileSync(join(studioRoot, "src/application/production/phase-11a-overlay-latin-vector.ts"), "utf8");
  const layoutSrc = readFileSync(join(studioRoot, "src/application/production/phase-11a-overlay-layout-1-2.ts"), "utf8");
  const bitmapSrc = readFileSync(
    join(studioRoot, "src/application/production/phase-11a-deterministic-compositor.ts"),
    "utf8",
  );
  if (!vectorSrc.includes(`PHASE_11A_VECTOR_COMPOSITOR_VERSION = "${PHASE_11A_VECTOR_COMPOSITOR_VERSION}"`)) {
    fail("STOP: vector compositor 1.2.0 missing");
  }
  if (!fontSrc.includes(`PHASE_11A_VECTOR_FONT_FAMILY = "${PHASE_11A_VECTOR_FONT_FAMILY}"`)) {
    fail("STOP: vector font missing");
  }
  if (!fontSrc.includes(`PHASE_11A_VECTOR_FONT_ID = "${PHASE_11A_VECTOR_FONT_ID}"`)) {
    fail("STOP: vector outlines missing");
  }
  if (fontSrc.includes("legacyHashGlyphRows")) fail("STOP: vector font selects legacyHashGlyphRows");
  if (vectorSrc.includes("legacyHashGlyphRows")) fail("STOP: vector compositor selects legacy");
  if (!layoutSrc.includes(`PHASE_11A_LAYOUT_VERSION = "${PHASE_11A_LAYOUT_VERSION}"`)) {
    fail("STOP: layout 1.2.0 missing");
  }
  if (!layoutSrc.includes(`PHASE_11A_CONTRAST_PANEL_VERSION = "${PHASE_11A_CONTRAST_PANEL_VERSION}"`)) {
    fail("STOP: panel 1.2.0 missing");
  }
  if (!bitmapSrc.includes(`PHASE_11A_COMPOSITOR_VERSION = "${PHASE_11A_COMPOSITOR_VERSION}"`)) {
    fail("STOP: 1.1.0 compositor mutated");
  }
}

type AssetRow = {
  id: string;
  status: string;
  mime_type: string | null;
  storage_path: string | null;
  checksum: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  provenance: Record<string, unknown> | null;
  run_id: string | null;
  step_id: string | null;
};

async function loadTargets(db: SupabaseClient) {
  const { data: assets, error } = await db
    .from("assets")
    .select(
      "id,status,kind,mime_type,storage_bucket,storage_path,checksum,size_bytes,width,height,provenance,scene_id,source_provider,run_id,step_id",
    )
    .eq("project_id", PROJECT_ID)
    .eq("kind", "image");
  if (error) fail(`assets: ${error.message}`);
  const find = (prefix: string) => (assets ?? []).find((a) => String(a.id).startsWith(prefix)) as AssetRow | undefined;
  const provider = find(PHASE_11A_PROFESSIONAL_PARENT_PREFIX);
  if (!provider) fail("provider asset missing");
  if (String(provider.status) !== "pending_review") fail("provider status");
  if (String(provider.checksum || "").slice(0, 16) !== PHASE_11A_PROFESSIONAL_PARENT_CHECKSUM_PREFIX) {
    fail("provider checksum");
  }
  if (provider.mime_type !== "image/png" || Number(provider.size_bytes) !== PHASE_11A_PARENT_EXPECTED_BYTES) {
    fail("provider format/size");
  }
  if (Number(provider.width) !== 1024 || Number(provider.height) !== 1024) fail("provider dims");
  if (provider.provenance?.active === true) fail("provider active");
  if (String(provider.storage_path || "").includes("/composed/")) fail("parent path looks composed");

  const composed110 = find(PHASE_11A_PROFESSIONAL_COMPOSED_110_PREFIX);
  if (!composed110 || String(composed110.status) !== "rejected") fail("composed 1.1.0 drifted");
  if (String(composed110.checksum || "").slice(0, 16) !== PHASE_11A_PROFESSIONAL_COMPOSED_110_CHECKSUM_PREFIX) {
    fail("composed 1.1.0 checksum");
  }
  if (composed110.provenance?.active === true) fail("composed 1.1.0 active");

  const composed100 = find(PHASE_11A_PROFESSIONAL_COMPOSED_100_PREFIX);
  if (!composed100 || String(composed100.status) !== "rejected") fail("composed 1.0.0 drifted");
  if (String(composed100.checksum || "").slice(0, 16) !== PHASE_11A_PROFESSIONAL_COMPOSED_100_CHECKSUM_PREFIX) {
    fail("composed 1.0.0 checksum");
  }
  if (composed100.provenance?.active === true) fail("composed 1.0.0 active");

  const smoke = find(PHASE_11A_PROFESSIONAL_SMOKE_PREFIX);
  if (!smoke || String(smoke.status) !== "rejected") fail("smoke drifted");
  if (smoke.provenance?.active === true) fail("smoke active");

  const { data: reviews, error: rErr } = await db
    .from("human_review_decisions")
    .select("id,decision")
    .eq("project_id", PROJECT_ID);
  if (rErr) fail(`hr: ${rErr.message}`);
  const rejectedReviews = (reviews ?? []).filter((d) => d.decision === "rejected");
  if (rejectedReviews.length !== 3) fail(`HR reject count ${rejectedReviews.length}`);
  if (!(reviews ?? []).some((d) => String(d.id).startsWith(PHASE_11A_PROFESSIONAL_COMPOSED_110_DECISION_PREFIX))) {
    fail("1.1.0 HR decision missing");
  }
  if (!(reviews ?? []).some((d) => String(d.id).startsWith(PHASE_11A_PROFESSIONAL_COMPOSED_100_DECISION_PREFIX))) {
    fail("1.0.0 HR decision missing");
  }

  const { data: runs, error: runErr } = await db
    .from("production_runs")
    .select("id,status,state,revision,generation_plan_artifact_id,estimated_cost_minor,committed_cost_minor")
    .eq("project_id", PROJECT_ID);
  if (runErr) fail(`runs: ${runErr.message}`);
  const runRow = (runs ?? []).find((r) => String(r.id).startsWith(RUN_PREFIX));
  if (!runRow) fail("run missing");
  if (String(runRow.status) !== "completed") fail(`run status ${runRow.status}`);

  const { data: jobs, error: jobErr } = await db.from("production_jobs").select("id,status").eq("project_id", PROJECT_ID);
  if (jobErr) fail(`jobs: ${jobErr.message}`);
  const job = (jobs ?? []).find((j) => String(j.id).startsWith(JOB_PREFIX));
  if (!job || job.status !== "completed") fail("job not completed");

  return { provider, composed110, composed100, smoke, runRow, job, reviews: reviews ?? [] };
}

async function downloadOnce(db: SupabaseClient, storagePath: string): Promise<Uint8Array> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(storagePath, PHASE_11A_SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) fail(`signed url: ${error?.message || "missing"}`);
  let signedUrl: string | null = data.signedUrl;
  try {
    const parsed = new URL(signedUrl);
    if (parsed.protocol !== "https:" || parsed.hostname !== SUPABASE_HOST) fail("signed url host");
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20_000);
    try {
      const res = await fetch(signedUrl, { method: "GET", redirect: "error", signal: ac.signal });
      if (!res.ok) fail(`download HTTP ${res.status}`);
      const mime = String(res.headers.get("content-type") || "").split(";")[0].trim();
      if (mime !== "image/png") fail(`download mime ${mime}`);
      const raw = new Uint8Array(await res.arrayBuffer());
      if (raw.byteLength > PHASE_11A_SIGNED_URL_MAX_BYTES || raw.byteLength !== PHASE_11A_PARENT_EXPECTED_BYTES) {
        fail(`download size ${raw.byteLength}`);
      }
      return raw;
    } finally {
      clearTimeout(timer);
    }
  } finally {
    signedUrl = null;
  }
}

async function nextRevision(db: SupabaseClient, artifactType: string): Promise<number> {
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

async function persistScaffold(
  db: SupabaseClient,
  facts: Parameters<typeof buildPhase11AComposedQualityReport>[0],
  existingQr: { id: string; revision?: number } | undefined,
  existingPr: { id: string; revision?: number } | undefined,
) {
  if (existingQr && existingPr) {
    return { qualityReportId: existingQr.id, productionResultId: existingPr.id, wrote: false };
  }
  const qrValue = buildPhase11AComposedQualityReport(facts);
  const prValue = buildPhase11AComposedProductionResult(facts);
  assertPhase11APayloadHasNoMediaLeak(qrValue);
  assertPhase11APayloadHasNoMediaLeak(prValue);
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
  return { qualityReportId: qrId as string, productionResultId: prId as string, wrote: !existingQr || !existingPr };
}

async function main(): Promise<void> {
  assertPhase11AProfessionalRecompositionConfirm(process.env);
  if (process.argv.includes("--execute")) fail("--execute is forbidden");
  assertApplicativeSource();
  assertPhase11AProfessionalRuntimeVersions({
    fontFamily: PHASE_11A_VECTOR_FONT_FAMILY,
    fontId: PHASE_11A_VECTOR_FONT_ID,
    fontLicense: PHASE_11A_VECTOR_FONT_LICENSE,
    compositorVersion: PHASE_11A_VECTOR_COMPOSITOR_VERSION,
    layoutVersion: PHASE_11A_LAYOUT_VERSION,
    panelVersion: PHASE_11A_CONTRAST_PANEL_VERSION,
    bitmapCompositorVersion: PHASE_11A_COMPOSITOR_VERSION,
  });

  const report: Record<string, unknown> = {
    auth: PHASE_11A_PROFESSIONAL_RECOMPOSITION_AUTH,
    applicativeSource: PHASE_11A_PROFESSIONAL_APPLICATIVE_COMMIT,
    preflightVisualDecision: PHASE_11A_PROFESSIONAL_PREFLIGHT_VISUAL_DECISION,
    providerCalled: false,
    ProductionStorageWrite: false,
    composedAssetCreated: false,
    HumanReviewDecision: null,
    HumanReviewSeeded: false,
    signedUrlCount: 0,
    signedUrlPersisted: false,
    storageDownloads: 0,
    storageWrites: 0,
    noVercelDeploy: true,
    localCompositionNoVercelFlags: true,
  };

  let providerBuf: Uint8Array | null = null;
  let composedPng: Uint8Array | null = null;
  try {
    const db = remoteDb();
    const before = await captureCounters(db);
    report.countersBefore = before;
    assertBudget(before.budget);
    const targets = await loadTargets(db);

    const spec = createPhase11AProfessionalOverlaySpec({
      locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
      title: PHASE_11A_SCENE2_OVERLAY_TITLE,
      callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
    });
    if (spec.title !== PHASE_11A_SCENE2_OVERLAY_TITLE) fail("title mutated");
    if (spec.callToAction !== PHASE_11A_SCENE2_OVERLAY_CTA) fail("cta mutated");
    if (spec.subtitle || spec.legalLine) fail("subtitle/legal must be absent");
    if (spec.fontFamily !== PHASE_11A_VECTOR_FONT_FAMILY) fail("font");
    if (JSON.stringify(spec.safeArea) !== JSON.stringify(PHASE_11A_LAYOUT_12_SAFE_AREA)) fail("safe area");
    const cps = [...new Set(overlayCodepoints(`${spec.title}${spec.callToAction}`))];
    if (!cps.includes(0x2019) || !cps.includes(0xe9) || !cps.includes(0xe0)) fail("required accents");
    for (const cp of cps) {
      if (!hasPhase11AVectorGlyph(cp)) fail(`unsupported U+${cp.toString(16)}`);
    }

    providerBuf = await downloadOnce(db, String(targets.provider.storage_path));
    report.signedUrlCount = 1;
    report.storageDownloads = 1;
    const parentChecksum = checksumSha256Bytes(providerBuf);
    if (parentChecksum !== targets.provider.checksum) fail("parent checksum mismatch");
    const filters = inspectPhase11APngScanlineFilters(providerBuf);
    decodeRgbPng(providerBuf);

    const planned = planPhase11ALayout12({
      title: spec.title,
      callToAction: spec.callToAction,
      canvas: 1024,
      safe: spec.safeArea,
    });
    const titlePlan = planned.find((l) => l.role === "title");
    const ctaPlan = planned.find((l) => l.role === "callToAction");
    const composed = composePhase11AVectorOverlay({ providerPng: providerBuf, spec });
    const composed2 = composePhase11AVectorOverlay({ providerPng: providerBuf, spec });
    composedPng = composed.png;
    if (composed.checksumSha256 !== composed2.checksumSha256) fail("determinism checksum");
    if (composed.png.byteLength !== composed2.png.byteLength) fail("determinism size");
    for (let i = 0; i < composed.png.byteLength; i++) {
      if (composed.png[i] !== composed2.png[i]) fail("determinism pixels");
    }
    if (JSON.stringify(composed.lineBoxes) !== JSON.stringify(composed2.lineBoxes)) fail("determinism boxes");
    if (composed.contrastRatio !== composed2.contrastRatio) fail("determinism contrast");
    if (composed.compositorVersion !== PHASE_11A_VECTOR_COMPOSITOR_VERSION) fail("compositor version");
    if (composed.fontFamily !== PHASE_11A_VECTOR_FONT_FAMILY) fail("font family");
    if (composed.renderedStrings[0] !== spec.title) fail("title mutated at render");
    if (composed.renderedStrings[1] !== spec.callToAction) fail("cta mutated at render");

    const titleLines = composed.lineBoxes.filter((b) => b.role === "title");
    const ctaLines = composed.lineBoxes.filter((b) => b.role === "callToAction");
    if (titleLines.length !== 1) fail(`title lines ${titleLines.length}`);
    if (ctaLines.length !== 1) fail(`cta lines ${ctaLines.length}`);
    if (ctaLines[0]?.text !== spec.callToAction) fail("cta wrap unexpected");
    if (/\bStudio\b/.test(ctaLines[0]?.text ?? "") === false) fail("Studio missing");
    const typo = validatePhase11ATypographicQc({ spec, composed });
    if (typo.status !== "accepted") fail(`typo ${typo.reasons.map((r) => r.code).join(",")}`);
    decodeRgbPng(composed.png);

    const composedFp = fingerprintPhase11AComposedAsset({
      parentChecksumSha256: parentChecksum,
      overlay: spec,
      compositorVersion: composed.compositorVersion,
    });
    const composedId = composedAssetIdFromFingerprint(composedFp);
    assertPhase11AProfessionalExpectedRender({
      checksumSha256: composed.checksumSha256,
      byteLength: composed.png.byteLength,
      width: composed.width,
      height: composed.height,
      fingerprint: composedFp,
      assetId: composedId,
      overlayFingerprint: composed.overlayFingerprint,
      contrastRatio: composed.contrastRatio,
      titleFontSize: titlePlan?.fontSize ?? 0,
      ctaFontSize: ctaPlan?.fontSize ?? 0,
      titleLineCount: titleLines.length,
      ctaLineCount: ctaLines.length,
    });
    if (composedId.startsWith(PHASE_11A_PROFESSIONAL_PARENT_PREFIX)) fail("id collides parent");
    if (composedId.startsWith(PHASE_11A_PROFESSIONAL_COMPOSED_100_PREFIX)) fail("id collides 1.0.0");
    if (composedId.startsWith(PHASE_11A_PROFESSIONAL_COMPOSED_110_PREFIX)) fail("id collides 1.1.0");
    if (composedId.startsWith(PHASE_11A_PROFESSIONAL_SMOKE_PREFIX)) fail("id collides smoke");

    const storagePath = buildPhase11ARoleImageStoragePath({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      assetId: composedId,
      role: "composed",
    });
    assertSafePhase11ARoleImageStoragePath(storagePath, {
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      assetId: composedId,
      role: "composed",
    });

    const ocr = evaluateProviderImageTextGate({
      available: false,
      detected: false,
      score: 0,
      snippets: [],
    });
    const card = buildPhase11AOverlayReviewCard({
      providerAssetId: targets.provider.id,
      composedAssetId: composedId,
      spec,
      typographicQc: typo,
      ocrGate: ocr,
      overlayFingerprint: composed.overlayFingerprint,
      overlayVersion: spec.version,
      compositorVersion: composed.compositorVersion,
      providerCostMinorAlreadySettled: 0,
      providerPathIsLegacyFiveSegment: String(targets.provider.storage_path).split("/").length === 5,
    });
    assertPhase11APayloadHasNoMediaLeak(card);

    const { data: existingObj } = await db.storage.from(BUCKET).list(`${WORKSPACE_ID}/${PROJECT_ID}/media/image/composed`, {
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
      let replayUrl: string | null = signed.signedUrl;
      try {
        const res = await fetch(replayUrl, { redirect: "error" });
        const bytes = new Uint8Array(await res.arrayBuffer());
        const existingSum = checksumSha256Bytes(bytes);
        bytes.fill(0);
        if (existingSum !== composed.checksumSha256) fail("collision divergent object");
      } finally {
        replayUrl = null;
      }
    }

    const { data: existingAsset } = await db
      .from("assets")
      .select("id,checksum,provenance,status")
      .eq("id", composedId)
      .maybeSingle();
    let assetWrote = false;
    const nowIso = new Date().toISOString();
    if (!existingAsset) {
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
          fontFamily: PHASE_11A_VECTOR_FONT_FAMILY,
          fontId: PHASE_11A_VECTOR_FONT_ID,
          layoutVersion: PHASE_11A_LAYOUT_VERSION,
          panelVersion: PHASE_11A_CONTRAST_PANEL_VERSION,
          preflightVisualDecision: PHASE_11A_PROFESSIONAL_PREFLIGHT_VISUAL_DECISION,
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
      const v = row.value && typeof row.value === "object" ? (row.value as { kind?: string; asset?: { id?: string } }) : {};
      return v.kind === PHASE_11A_COMPOSED_QUALITY_REPORT_KIND && v.asset?.id === composedId;
    });
    const { data: prRows } = await db
      .from("project_artifacts")
      .select("id,revision,value")
      .eq("project_id", PROJECT_ID)
      .eq("artifact_type", "production_result");
    const existingPr = (prRows || []).find((row) => {
      const v =
        row.value && typeof row.value === "object"
          ? (row.value as { phase11a?: { parentAssetId?: string }; delivery?: { finalAssetId?: string } })
          : {};
      return v.phase11a?.parentAssetId === targets.provider.id && v.delivery?.finalAssetId === composedId;
    });

    const facts = {
      qualityReportId: existingQr?.id || randomUUID(),
      productionResultId: existingPr?.id || randomUUID(),
      projectId: PROJECT_ID,
      createdBy: ACTOR,
      correlationId: CORRELATION,
      nowIso,
      runId: String(targets.runRow.id),
      jobId: String(targets.job.id),
      parentAssetId: targets.provider.id,
      composedAssetId: composedId,
      composedChecksumSha256: composed.checksumSha256,
      composedByteLength: composed.png.byteLength,
      overlayFingerprint: composed.overlayFingerprint,
      compositorVersion: composed.compositorVersion,
      generationPlanArtifactId: String(targets.runRow.generation_plan_artifact_id),
      estimatedCostMinor: Number(targets.runRow.estimated_cost_minor || 0),
      committedCostMinor: Number(targets.runRow.committed_cost_minor || 0),
      typographicStatus: "accepted" as const,
      contrastRatio: composed.contrastRatio,
      fontFamily: PHASE_11A_VECTOR_FONT_FAMILY,
      fontId: PHASE_11A_VECTOR_FONT_ID,
      layoutVersion: PHASE_11A_LAYOUT_VERSION,
      panelVersion: PHASE_11A_CONTRAST_PANEL_VERSION,
      titleFontSize: titlePlan?.fontSize ?? 40,
      ctaFontSize: ctaPlan?.fontSize ?? 22,
      titleLineCount: titleLines.length,
      ctaLineCount: ctaLines.length,
      preflightVisualDecision: PHASE_11A_PROFESSIONAL_PREFLIGHT_VISUAL_DECISION,
      reviewAuth: PHASE_11A_PROFESSIONAL_RECOMPOSITION_AUTH,
    };
    const scaffold = await persistScaffold(db, facts, existingQr, existingPr);
    report.HumanReviewSeeded = true;
    report.qualityReportPrefix = String(scaffold.qualityReportId).slice(0, 8);
    report.productionResultPrefix = String(scaffold.productionResultId).slice(0, 8);
    report.reviewRequestId = buildPhase11AComposedReviewRequestId({
      projectId: PROJECT_ID,
      composedAssetId: composedId,
      auth: PHASE_11A_PROFESSIONAL_RECOMPOSITION_AUTH,
    });

    const runState =
      targets.runRow.state && typeof targets.runRow.state === "object"
        ? (targets.runRow.state as Record<string, unknown>)
        : {};
    const alreadyWaiting =
      runState.waitingReason === "needs_review" &&
      (runState.composedOverlay as { assetIdPrefix?: string } | undefined)?.assetIdPrefix === composedId.slice(0, 8);
    if (!alreadyWaiting) {
      const nextState = {
        ...runState,
        waitingReason: "needs_review",
        updatedAt: nowIso,
        composedOverlay: {
          assetIdPrefix: composedId.slice(0, 8),
          parentAssetIdPrefix: String(targets.provider.id).slice(0, 8),
          humanReviewDecision: null,
          preflightVisualDecision: PHASE_11A_PROFESSIONAL_PREFLIGHT_VISUAL_DECISION,
          auth: PHASE_11A_PROFESSIONAL_RECOMPOSITION_AUTH,
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
    } else {
      report.runUpdated = false;
    }
    report.runStatusUnchanged = "completed";

    const replayObj = await db.storage.from(BUCKET).list(`${WORKSPACE_ID}/${PROJECT_ID}/media/image/composed`, {
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
    if (after.human_review_decisions.count !== before.human_review_decisions.count) fail("HR decision created");
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
    const expectedQrDelta = existingQr ? 0 : 1;
    const expectedPrDelta = existingPr ? 0 : 1;
    const beforeAssets = before.image_assets.count ?? 0;
    const afterAssets = after.image_assets.count ?? 0;
    const beforeStorage = before.storage_objects.count ?? 0;
    const afterStorage = after.storage_objects.count ?? 0;
    const beforeQr = before.quality_reports.count ?? 0;
    const afterQr = after.quality_reports.count ?? 0;
    const beforePr = before.production_results.count ?? 0;
    const afterPr = after.production_results.count ?? 0;
    if (afterAssets !== beforeAssets + expectedAssetDelta) {
      fail(`asset delta ${beforeAssets}->${afterAssets}`);
    }
    if (afterStorage !== beforeStorage + expectedStorageDelta) {
      fail(`storage delta ${beforeStorage}->${afterStorage}`);
    }
    if (afterQr !== beforeQr + expectedQrDelta) {
      fail(`qr delta ${beforeQr}->${afterQr}`);
    }
    if (afterPr !== beforePr + expectedPrDelta) {
      fail(`pr delta ${beforePr}->${afterPr}`);
    }

    const afterTargets = await loadTargets(db);
    if (String(afterTargets.provider.checksum).slice(0, 16) !== PHASE_11A_PROFESSIONAL_PARENT_CHECKSUM_PREFIX) {
      fail("provider mutated");
    }
    if (String(afterTargets.composed110.checksum).slice(0, 16) !== PHASE_11A_PROFESSIONAL_COMPOSED_110_CHECKSUM_PREFIX) {
      fail("1.1.0 mutated");
    }
    if (String(afterTargets.composed100.checksum).slice(0, 16) !== PHASE_11A_PROFESSIONAL_COMPOSED_100_CHECKSUM_PREFIX) {
      fail("1.0.0 mutated");
    }
    if (afterTargets.job.status !== "completed") fail("job drifted");
    if (afterTargets.runRow.status !== "completed") fail("run status drifted");
    const afterWaiting =
      afterTargets.runRow.state && typeof afterTargets.runRow.state === "object"
        ? (afterTargets.runRow.state as { waitingReason?: string }).waitingReason
        : null;
    if (afterWaiting !== "needs_review") fail(`run waitingReason ${afterWaiting}`);

    const { data: composedRow } = await db
      .from("assets")
      .select("id,status,provenance,checksum,size_bytes,mime_type,width,height")
      .eq("id", composedId)
      .maybeSingle();
    const composedProv =
      composedRow?.provenance && typeof composedRow.provenance === "object"
        ? (composedRow.provenance as Record<string, unknown>)
        : {};
    if (composedProv.active === true || composedRow?.status !== "pending_review") {
      fail("composed must stay pending inactive");
    }
    if (composedProv.parentAssetId !== targets.provider.id) fail("parent/child link");
    if (composedProv.compositorVersion !== PHASE_11A_VECTOR_COMPOSITOR_VERSION) fail("composed compositor");
    if (composedProv.fontFamily !== PHASE_11A_VECTOR_FONT_FAMILY) fail("composed font");
    if (composedProv.layoutVersion !== PHASE_11A_LAYOUT_VERSION) fail("composed layout");
    if (composedProv.panelVersion !== PHASE_11A_CONTRAST_PANEL_VERSION) fail("composed panel");
    if (composedRow?.checksum !== PHASE_11A_PROFESSIONAL_EXPECTED_CHECKSUM) fail("persisted checksum");
    if (Number(composedRow?.size_bytes) !== PHASE_11A_PROFESSIONAL_EXPECTED_BYTES) fail("persisted size");
    if (composedRow?.mime_type !== "image/png") fail("persisted mime");

    const replay2 = await persistScaffold(
      db,
      facts,
      { id: scaffold.qualityReportId, revision: existingQr?.revision || 1 },
      { id: scaffold.productionResultId, revision: existingPr?.revision || 1 },
    );
    if (replay2.wrote) fail("scaffold replay wrote again");

    report.verdict = "PROFESSIONAL_COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING";
    report.parentAssetPrefix = PHASE_11A_PROFESSIONAL_PARENT_PREFIX;
    report.parentChecksumPrefix = PHASE_11A_PROFESSIONAL_PARENT_CHECKSUM_PREFIX;
    report.composedAssetPrefix = composedId.slice(0, 8);
    report.composedAssetId = composedId;
    report.composedChecksumPrefix = composed.checksumSha256.slice(0, 16);
    report.composedChecksumExact = composed.checksumSha256;
    report.composedBytes = composed.png.byteLength;
    report.compositorVersion = PHASE_11A_VECTOR_COMPOSITOR_VERSION;
    report.fontFamily = PHASE_11A_VECTOR_FONT_FAMILY;
    report.fontId = PHASE_11A_VECTOR_FONT_ID;
    report.layoutVersion = PHASE_11A_LAYOUT_VERSION;
    report.panelVersion = PHASE_11A_CONTRAST_PANEL_VERSION;
    report.storagePathRedacted = redactPath(storagePath, composedId);
    report.parentChild = { parent: PHASE_11A_PROFESSIONAL_PARENT_PREFIX, child: composedId.slice(0, 8) };
    report.technicalQc = "PASS";
    report.typographicQc = "PASS";
    report.ocr = "unavailable_humanOnly";
    report.visual = "humanOnly";
    report.pngFiltersEncountered = filters;
    report.replayIdempotent = true;
    report.firstWrite = { storageWrote, assetWrote, scaffoldWrote: scaffold.wrote };
    report.runFinal = { status: "completed", waitingReason: "needs_review" };
    report.jobFinal = { status: "completed" };
    report.providerCalls = 0;
    report.runtimePaidMedia = "OFF";
    report.openaiImageRealExecution = "UNAVAILABLE";
    report.deterministicOverlayExecution = "UNAVAILABLE";
    report.motionRuntime = "UNAVAILABLE";
    report.fiveAssets = {
      parent: { prefix: PHASE_11A_PROFESSIONAL_PARENT_PREFIX, status: "pending_review", active: false },
      composed100: { prefix: PHASE_11A_PROFESSIONAL_COMPOSED_100_PREFIX, status: "rejected", active: false },
      composed110: { prefix: PHASE_11A_PROFESSIONAL_COMPOSED_110_PREFIX, status: "rejected", active: false },
      smoke: { prefix: PHASE_11A_PROFESSIONAL_SMOKE_PREFIX, status: "rejected", active: false },
      professional: { prefix: composedId.slice(0, 8), status: "pending_review", active: false },
    };
    if (composedId.slice(0, 8) !== PHASE_11A_PROFESSIONAL_EXPECTED_ASSET_PREFIX) {
      fail("asset prefix drifted after persist");
    }
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    console.error("EXECUTION_STOP", msg.slice(0, 400));
    report.verdict = report.verdict || "BLOCKED_PROFESSIONAL_OVERLAY_RECOMPOSITION_EXECUTION";
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
      const blob = JSON.stringify(report);
      assertPhase11AProfessionalExecutionReportRedacted(blob);
      mkdirSync(join(studioRoot, ".tmp"), { recursive: true });
      writeFileSync(join(studioRoot, ".tmp", "phase-11a-professional-overlay-recomposition-execution.json"), `${blob}\n`);
    } catch (scanErr) {
      console.error("REPORT_REDACT_FAIL", String(scanErr instanceof Error ? scanErr.message : scanErr).slice(0, 160));
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        verdict: report.verdict,
        applicativeSource: PHASE_11A_PROFESSIONAL_APPLICATIVE_COMMIT_SHORT,
        composedAssetPrefix: report.composedAssetPrefix,
        composedChecksumPrefix: report.composedChecksumPrefix,
        providerCalled: false,
        HumanReviewDecision: null,
        replayIdempotent: report.replayIdempotent,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
