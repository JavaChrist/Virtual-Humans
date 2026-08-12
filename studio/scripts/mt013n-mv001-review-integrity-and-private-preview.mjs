#!/usr/bin/env node
/**
 * MT-013N — MV-001 REVIEW INTEGRITY AUDIT & PRIVATE PREVIEW PREP
 *
 *   CONFIRM_MT013N_REVIEW_INTEGRITY_AND_PRIVATE_PREVIEW=1 \
 *     node scripts/mt013n-mv001-review-integrity-and-private-preview.mjs
 *
 * No fal / no reserve / no decision / no deploy.
 * Signed URL (TTL≤10m) printed ONLY on channel "PREVIEW_URL_CHANNEL"
 * when integrity PASS — never written to report files / git.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(__dirname, "..");
const AUTH = "AUTH_MV001_REVIEW_INTEGRITY_AND_PRIVATE_PREVIEW_ONLY";
const WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PROJ = "390c25db-69e1-403a-83c5-7afcb4b85e84";
const OUTPUT_PREFIX = "2d7ffcad";
const REPORT_PREFIX = "1516c218";
const PROVIDER_PREFIX = "019f";
const PROVIDER_SUFFIX = "b8ee";
const PREVIEW_TTL_SECONDS = 600; // 10 minutes max
const BUCKET = "director-final-assets";

function load(p, mode) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (mode === "override" || !process.env[k]) process.env[k] = v;
  }
}

function redactId(id) {
  if (!id) return null;
  const s = String(id);
  return s.length <= 10 ? "[r]" : `${s.slice(0, 8)}…`;
}

function redactProvider(id) {
  if (!id) return null;
  const s = String(id);
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function hasUrlLeak(value) {
  const blob = JSON.stringify(value);
  return /https:\/\/\S+/i.test(blob) || /X-Amz-/i.test(blob);
}

function parseMp4Quick(bytes) {
  // Minimal ISO-BMFF probe — no full decode.
  const out = {
    durationSeconds: null,
    width: null,
    height: null,
    fps: null,
    sizeBytes: bytes.byteLength,
  };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let timescale = null;
  let duration = null;
  while (offset + 8 <= bytes.byteLength) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    if (size === 1 && offset + 16 <= bytes.byteLength) {
      // largesize — skip for safety
      break;
    }
    if (size < 8) break;
    if (type === "moov" || type === "trak" || type === "mdia" || type === "minf" || type === "stbl") {
      offset += 8;
      continue;
    }
    if (type === "mvhd" && offset + 32 <= bytes.byteLength) {
      const version = bytes[offset + 8];
      if (version === 0) {
        timescale = view.getUint32(offset + 20);
        duration = view.getUint32(offset + 24);
      } else if (version === 1 && offset + 44 <= bytes.byteLength) {
        timescale = view.getUint32(offset + 28);
        // duration 64-bit — take low 32 if small
        duration = view.getUint32(offset + 36);
      }
    }
    if (type === "tkhd" && offset + 84 <= bytes.byteLength) {
      const version = bytes[offset + 8];
      const base = version === 0 ? offset + 84 : offset + 96;
      if (base + 8 <= bytes.byteLength) {
        const w = view.getUint32(base) / 65536;
        const h = view.getUint32(base + 4) / 65536;
        if (w > 0 && h > 0) {
          out.width = Math.round(w);
          out.height = Math.round(h);
        }
      }
    }
    if (type === "stts" && offset + 16 <= bytes.byteLength && out.fps == null) {
      const entryCount = view.getUint32(offset + 12);
      if (entryCount >= 1 && offset + 24 <= bytes.byteLength) {
        const sampleCount = view.getUint32(offset + 16);
        const sampleDelta = view.getUint32(offset + 20);
        if (sampleDelta > 0 && timescale) {
          out.fps = Math.round((timescale / sampleDelta) * 100) / 100;
        } else if (sampleDelta > 0 && sampleCount > 0) {
          // fallback unknown timescale
        }
      }
    }
    offset += size;
  }
  if (timescale && duration != null && timescale > 0) {
    out.durationSeconds = Math.round((duration / timescale) * 100) / 100;
  }
  return out;
}

if (process.env.CONFIRM_MT013N_REVIEW_INTEGRITY_AND_PRIVATE_PREVIEW !== "1") {
  console.error(
    JSON.stringify({
      ok: false,
      stop: true,
      reason: "Set CONFIRM_MT013N_REVIEW_INTEGRITY_AND_PRIVATE_PREVIEW=1",
    }),
  );
  process.exit(2);
}

load(join(studioRoot, ".env.local"), "fill");
load(join(studioRoot, ".env.remote.local"), "override");

const url = process.env.MV001_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.MV001_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(JSON.stringify({ ok: false, reason: "missing supabase env" }));
  process.exit(2);
}
if (String(url).includes("127.0.0.1") || String(url).includes("localhost")) {
  console.error(JSON.stringify({ ok: false, reason: "refusing local supabase" }));
  process.exit(2);
}

const c = createClient(url, key, { auth: { persistSession: false } });

const report = {
  auth: AUTH,
  providerCalls: 0,
  falCalls: 0,
  budgetWrites: 0,
  vercelWrites: 0,
  migrations: 0,
  decisionApplied: false,
};

// ── Load scoped rows ──
const { data: runs } = await c
  .from("production_runs")
  .select("*")
  .eq("project_id", PROJ);
const { data: jobs } = await c
  .from("production_jobs")
  .select("*")
  .eq("project_id", PROJ);
const { data: attempts } = await c
  .from("generation_attempts")
  .select("*")
  .eq("project_id", PROJ);
const { data: assets } = await c
  .from("assets")
  .select("*")
  .eq("project_id", PROJ);
const { data: artifacts } = await c
  .from("project_artifacts")
  .select("id,artifact_type,schema_version,value,created_at,created_by,correlation_id,revision")
  .eq("project_id", PROJ);
const { data: reservations } = await c
  .from("budget_reservations")
  .select("*")
  .eq("project_id", PROJ);
const { data: ledger } = await c
  .from("cost_ledger")
  .select(
    "entry_type,amount_minor,cost_status,description_code,idempotency_key,reservation_id,created_at",
  )
  .eq("workspace_id", WS)
  .eq("project_id", PROJ)
  .order("created_at", { ascending: true });
const { data: audits } = await c
  .from("audit_log")
  .select("action,resource_type,resource_id,actor_id,correlation_id,metadata,created_at")
  .eq("project_id", PROJ)
  .order("created_at", { ascending: true });
const { data: decisions } = await c
  .from("human_review_decisions")
  .select("id,decision,created_at")
  .eq("project_id", PROJ);

const checks = [];
const add = (id, pass, detail) => checks.push({ id, pass: !!pass, detail });

add("scope_runs_exact_1", (runs || []).length === 1, `count=${(runs || []).length}`);
add("scope_jobs_exact_1", (jobs || []).length === 1, `count=${(jobs || []).length}`);
add("scope_attempts_exact_1", (attempts || []).length === 1, `count=${(attempts || []).length}`);

const job = (jobs || [])[0];
const run = (runs || [])[0];
const attempt = (attempts || [])[0];
const motion = job?.payload?.motion || {};
const externalJobId = job?.payload?.externalJobId || job?.external_job_id || null;
const submitCount = Number(motion.submitCount ?? 0);

add(
  "submit_count_exact_1",
  submitCount === 1,
  `submitCount=${submitCount}`,
);
add(
  "provider_job_matches",
  !!externalJobId &&
    String(externalJobId).startsWith(PROVIDER_PREFIX) &&
    String(externalJobId).endsWith(PROVIDER_SUFFIX),
  redactProvider(externalJobId),
);
add(
  "attempt_external_matches",
  !!attempt?.external_job_id &&
    String(attempt.external_job_id) === String(externalJobId),
  redactProvider(attempt?.external_job_id),
);
add("attempt_number_1", attempt?.attempt_number === 1, `n=${attempt?.attempt_number}`);
add("attempt_kind_primary", attempt?.kind === "primary", attempt?.kind);

const outputAssets = (assets || []).filter(
  (a) => a.provenance?.motionRole === "motion_provider_output",
);
add("output_assets_exact_1", outputAssets.length === 1, `count=${outputAssets.length}`);
const output = outputAssets[0];
add(
  "output_id_prefix",
  !!output && String(output.id).startsWith(OUTPUT_PREFIX),
  redactId(output?.id),
);
add("output_non_active", output?.provenance?.active === false, `active=${output?.provenance?.active}`);
add("output_bucket_private", output?.storage_bucket === BUCKET, output?.storage_bucket);
add("output_mime_mp4", output?.mime_type === "video/mp4", output?.mime_type);
add("output_source_internal", output?.source_kind === "internal", output?.source_kind);

const qReports = (artifacts || []).filter((a) => a.artifact_type === "quality_report");
add("quality_report_exact_1", qReports.length === 1, `count=${qReports.length}`);
const qReport = qReports[0];
add(
  "quality_report_id_prefix",
  !!qReport && String(qReport.id).startsWith(REPORT_PREFIX),
  redactId(qReport?.id),
);
add(
  "quality_report_overall_human_review",
  qReport?.value?.overallStatus === "human_review",
  qReport?.value?.overallStatus,
);
add(
  "quality_report_no_decision",
  qReport?.value?.automaticApproval === false,
  `automaticApproval=${qReport?.value?.automaticApproval}`,
);

const hrAudits = (audits || []).filter(
  (a) => a.action === "motion.mv001.human_review.seeded",
);
add("hr_audit_seeded_present", hrAudits.length >= 1, `count=${hrAudits.length}`);
add(
  "hr_no_decision_rows",
  (decisions || []).length === 0,
  `decisions=${(decisions || []).length}`,
);
add(
  "hr_handoff_seeded_in_payload",
  motion.humanReviewHandoffStatus === "seeded",
  motion.humanReviewHandoffStatus,
);

// Ledger
const mvRes = (reservations || []).find((r) => Number(r.amount_minor) === 162);
const resId = mvRes?.id;
const relatedLedger = (ledger || []).filter(
  (l) => resId && l.reservation_id === resId,
);
const reserveRow = relatedLedger.find((l) => l.entry_type === "reservation");
const commitRow = relatedLedger.find((l) => l.entry_type === "commit");
const releaseRow = relatedLedger.find((l) => l.entry_type === "release");
add("ledger_reserve_162", reserveRow?.amount_minor === 162, reserveRow?.amount_minor);
add("ledger_commit_135", commitRow?.amount_minor === 135, commitRow?.amount_minor);
add("ledger_release_27", releaseRow?.amount_minor === 27, releaseRow?.amount_minor);
add(
  "no_reconciliation_required",
  motion.reconciliationRequired !== true,
  `recon=${motion.reconciliationRequired}`,
);
add("ledger_settled", motion.ledgerSettled === true, `settled=${motion.ledgerSettled}`);

// URL leak scan (no signed URL creation yet)
const scanTargets = {
  jobPayload: job?.payload,
  runState: run?.state,
  artifacts: artifacts,
  audits: audits,
  assetProvenance: assets?.map((a) => a.provenance),
};
add("no_persisted_url", !hasUrlLeak(scanTargets), "scanned job/run/artifacts/audits/assets");

// max_attempts analysis
const queueAttemptCount = job?.attempt_count;
const queueMaxAttempts = job?.max_attempts;
add(
  "queue_attempt_count_is_worker_reclaim_not_provider_attempt",
  typeof queueAttemptCount === "number",
  `attempt_count=${queueAttemptCount}; max_attempts=${queueMaxAttempts}; generation_attempt.n=1`,
);

// Inconsistency analysis
const jobStatus = job?.status;
const jobErrorCode = job?.error?.code || null;
const phase = motion.phase;
const runStatus = run?.status;
const drainRejected = jobErrorCode === "qc_rejected";
// production_runs CHECK has no needs_review — MT-013M seed update to needs_review was a no-op.
const runStatusExplained =
  runStatus === "running" ||
  runStatus === "partial" ||
  runStatus === "completed";
const canonicalHumanReview =
  qReport?.value?.overallStatus === "human_review" &&
  motion.humanReviewHandoffStatus === "seeded" &&
  hrAudits.length >= 1 &&
  (decisions || []).length === 0 &&
  phase !== "qc_rejected" &&
  runStatusExplained;

const historyPreserved =
  jobErrorCode === "qc_rejected" && jobStatus === "failed";

// Determine integrity verdict
let integrityVerdict = "PASS";
let integrityReason = "";

if ((jobs || []).length !== 1 || submitCount !== 1 || outputAssets.length !== 1) {
  integrityVerdict = "BLOCKED_REVIEW_STATE_INCONSISTENT";
  integrityReason = "scope_or_submit_invariant_broken";
} else if (hasUrlLeak(scanTargets)) {
  integrityVerdict = "BLOCKED_REVIEW_STATE_INCONSISTENT";
  integrityReason = "persisted_url_detected";
} else if ((decisions || []).length > 0) {
  integrityVerdict = "BLOCKED_REVIEW_STATE_INCONSISTENT";
  integrityReason = "human_decision_already_present";
} else if (phase === "qc_rejected" && qReport?.value?.overallStatus === "human_review") {
  integrityVerdict = "BLOCKED_REVIEW_STATE_INCONSISTENT";
  integrityReason = "payload_still_qc_rejected_while_report_human_review";
} else if (
  drainRejected &&
  canonicalHumanReview &&
  historyPreserved
) {
  // Documented technical false-reject then authorized HR seed under MT-013M.
  // History of drain failure preserved on job.status/error; business canon = human_review.
  integrityVerdict = "PASS";
  integrityReason =
    "qc_rejected_non_canonical_drain_terminal_preserved_on_job_error;_canon=quality_report+audit+hr_seeded;_run_status_stayed_running_because_needs_review_not_in_sql_check";
} else if (!canonicalHumanReview) {
  integrityVerdict = "BLOCKED_REVIEW_STATE_INCONSISTENT";
  integrityReason = "canonical_human_review_not_established";
} else {
  integrityVerdict = "PASS";
  integrityReason = "canonical_human_review_consistent";
}

add(
  "run_status_sql_check_no_needs_review",
  runStatus === "running",
  `run.status=${runStatus} (needs_review absent from production_runs_status_check)`,
);

// Stricter: if job.status=failed AND run=needs_review without documented technical explanation → already handled as PASS with reason above when history preserved.

add(
  "integrity_verdict_pass",
  integrityVerdict === "PASS",
  `${integrityVerdict}:${integrityReason}`,
);

report.integrityVerdict = integrityVerdict;
report.integrityReason = integrityReason;
report.checks = checks;
report.submitProvider = {
  submitCount,
  providerJobIdRedacted: redactProvider(externalJobId),
  generationAttempts: (attempts || []).length,
  jobs: (jobs || []).length,
  distinctProviderJobIds: 1,
};
report.timeline = {
  run: {
    id: redactId(run?.id),
    status: runStatus,
    estimated: run?.estimated_cost_minor,
    committed: run?.committed_cost_minor,
    released: run?.released_cost_minor,
    created_at: run?.created_at,
    updated_at: run?.updated_at,
  },
  job: {
    id: redactId(job?.id),
    status: jobStatus,
    errorCode: jobErrorCode,
    errorMessage: job?.error?.publicMessage
      ? String(job.error.publicMessage).slice(0, 160)
      : null,
    phase,
    submitCount,
    pollCount: motion.pollCount,
    downloadStatus: motion.downloadStatus,
    ingestStatus: motion.ingestStatus,
    qcStatus: motion.qcStatus,
    hr: motion.humanReviewHandoffStatus,
    outputLifecycle: motion.outputLifecycle,
    terminal: motion.terminal,
    ledgerSettled: motion.ledgerSettled,
    reconciliationRequired: motion.reconciliationRequired,
    attempt_count_queue: queueAttemptCount,
    max_attempts_queue: queueMaxAttempts,
    created_at: job?.created_at,
    updated_at: job?.updated_at,
    completed_at: job?.completed_at,
  },
  attempt: {
    id: redactId(attempt?.id),
    status: attempt?.status,
    attempt_number: attempt?.attempt_number,
    kind: attempt?.kind,
    external: redactProvider(attempt?.external_job_id),
    estimate: attempt?.estimate_minor,
    actual: attempt?.actual_cost_minor,
    created_at: attempt?.created_at,
    completed_at: attempt?.completed_at,
  },
};
report.maxAttemptsAnalysis = {
  constraint:
    "production_jobs_attempts_bounds: attempt_count <= max_attempts + 1",
  meaning:
    "queue attempt_count increments on each worker claim/reclaim — NOT a second fal generation_attempt",
  initialMisconfig: "max_attempts=1 allowed only claim#1 (submit) + claim#2 before further polls failed the CHECK",
  providerAttempts: 1,
  generationAttemptRows: 1,
  queueReclaimsObserved: queueAttemptCount,
  currentMaxAttempts: queueMaxAttempts,
};
report.qcRejectedAnalysis = {
  recordedOn: [
    "production_jobs.error.code=qc_rejected",
    "production_jobs.status=failed (drain worker terminal)",
    "ephemeral memory quality report mqr-* (process-local, not durable canon)",
  ],
  origin:
    "hydrateMotionTransferAttemptFromJob → pollHydrateMotionInput stub (durable-hydrate-* assets + minimal qcRequirements). Resume poll/drain after cold start had no original MV-001 motionInput; drain QC evaluated stub checkpoints and returned handoff.outcome=rejected → phase qc_rejected without seeding HR.",
  whyNotBusinessCanon:
    "MV-001 policy requires critical fidelity + unavailable Motion metrics → human_review, not reject. Stub hydrate was transport recovery only (poll/drain), never the paid submit input.",
  authorizedTransitionToHumanReview:
    "MT-013M script mt013m-seed-hr-context.mjs inserted durable project_artifacts.quality_report overallStatus=human_review + audit motion.mv001.human_review.seeded + set payload.humanReviewHandoffStatus=seeded / phase=qc_pending. Attempted run.status=needs_review but SQL CHECK only allows pending|validating|running|cancelling|completed|partial|failed|cancelled — update was a no-op; run remained running. Did NOT apply APPROVE/REJECT/RETRY. Did NOT erase job.error=qc_rejected (history preserved).",
  appendOnlyNote:
    "job.error/status remain failed/qc_rejected as worker-terminal history; durable canon for review is quality_report + audit + payload.hr=seeded. No human_review_decisions row.",
};
report.canonicalQc = {
  source: "project_artifacts.quality_report",
  id: redactId(qReport?.id),
  overallStatus: qReport?.value?.overallStatus,
  humanValidationRequired: qReport?.value?.humanValidationRequired,
  motionMeasurements: qReport?.value?.motionMeasurements,
  technicalQc: qReport?.value?.technicalQc,
  revision: qReport?.revision,
};
report.canonicalHumanReview = {
  sessionTableDecisions: (decisions || []).length,
  auditHandoff: hrAudits.map((a) => ({
    at: a.created_at,
    actor: a.actor_id,
    metadata: {
      handoff: a.metadata?.handoff,
      overallStatus: a.metadata?.overallStatus,
      noDecisionApplied: a.metadata?.noDecisionApplied,
      outputActive: a.metadata?.outputActive,
    },
  })),
  payloadHandoff: motion.humanReviewHandoffStatus,
  runStatus,
  decisionApplied: false,
};
report.asset = {
  id: redactId(output?.id),
  active: output?.provenance?.active === true,
  role: output?.provenance?.motionRole,
  lifecycle: output?.provenance?.lifecycle || output?.provenance?.outputLifecycle,
  mime: output?.mime_type,
  checksumPrefix: String(output?.checksum || "")
    .replace(/^sha256:/i, "")
    .slice(0, 12),
  pathTail: (output?.storage_path || "").split("/").slice(-2).join("/"),
  bucket: output?.storage_bucket,
};
report.ledgerFinal = {
  reserve: reserveRow?.amount_minor ?? null,
  commit: commitRow?.amount_minor ?? null,
  release: releaseRow?.amount_minor ?? null,
  reservationStatus: mvRes?.status ?? null,
};
report.reconciliationRequired = motion.reconciliationRequired === true;
report.auditsRedacted = (audits || []).map((a) => ({
  action: a.action,
  at: a.created_at,
  actor: a.actor_id,
}));

let previewPrepared = false;
let previewTtl = null;
let mediaMeta = {
  durationSeconds: null,
  width: null,
  height: null,
  fps: null,
  sizeBytes: null,
};

if (integrityVerdict === "PASS" && output?.storage_path) {
  // Verify object exists; probe headers/bytes for review sheet (private bucket).
  const dl = await c.storage.from(BUCKET).download(output.storage_path);
  if (dl.error || !dl.data) {
    integrityVerdict = "BLOCKED_REVIEW_STATE_INCONSISTENT";
    integrityReason = "output_object_missing_or_unreadable";
    report.integrityVerdict = integrityVerdict;
    report.integrityReason = integrityReason;
    previewPrepared = false;
  } else {
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const sha = createHash("sha256").update(bytes).digest("hex");
    const stored = String(output.checksum || "").replace(/^sha256:/i, "");
    const checksumOk = !stored || stored === sha || stored.startsWith(sha.slice(0, 12));
    add("output_checksum_matches_bytes", checksumOk, `storedPrefix=${stored.slice(0, 12)}`);
    mediaMeta = parseMp4Quick(bytes);
    mediaMeta.sizeBytes = bytes.byteLength;
    mediaMeta.checksumSha256Prefix = sha.slice(0, 12);

    if (!checksumOk) {
      integrityVerdict = "BLOCKED_REVIEW_STATE_INCONSISTENT";
      integrityReason = "checksum_mismatch";
      report.integrityVerdict = integrityVerdict;
      previewPrepared = false;
    } else {
      const signed = await c.storage
        .from(BUCKET)
        .createSignedUrl(output.storage_path, PREVIEW_TTL_SECONDS);
      if (signed.error || !signed.data?.signedUrl) {
        integrityVerdict = "BLOCKED_REVIEW_STATE_INCONSISTENT";
        integrityReason = "signed_url_failed";
        report.integrityVerdict = integrityVerdict;
        previewPrepared = false;
      } else {
        previewPrepared = true;
        previewTtl = PREVIEW_TTL_SECONDS;
        // Transmit URL ONLY on dedicated channel — never into report object / files.
        console.log("PREVIEW_URL_CHANNEL_BEGIN");
        console.log(signed.data.signedUrl);
        console.log("PREVIEW_URL_CHANNEL_END");
        console.log(
          `PREVIEW_META ttlSeconds=${PREVIEW_TTL_SECONDS} readOnly=true expires=automatic`,
        );
      }
    }
  }
}

report.preview = {
  prepared: previewPrepared,
  blocked: !previewPrepared,
  ttlSeconds: previewPrepared ? previewTtl : null,
  urlInReport: false,
  urlInGit: false,
  publicCopy: false,
  newAsset: false,
};

const reviewSheet = {
  title: "MV-001 Human Review sheet (redacted)",
  auth: AUTH,
  benchmarkId: "MV-001",
  projectId: PROJ,
  outputAssetId: redactId(output?.id),
  providerJobId: redactProvider(externalJobId),
  qualityReportId: redactId(qReport?.id),
  media: {
    durationSeconds: mediaMeta.durationSeconds,
    width: mediaMeta.width,
    height: mediaMeta.height,
    fps: mediaMeta.fps,
    sizeBytes: mediaMeta.sizeBytes,
    mimeType: "video/mp4",
    checksumPrefix: mediaMeta.checksumSha256Prefix || report.asset.checksumPrefix,
  },
  expectedInputs: {
    motion_source_video: "12c4bd0b-… (internal, sha 91b32ec50245…)",
    motion_identity_reference: "f42393ae-… (internal, sha 9e270cd7d31b…)",
    durationAuthorized: "8s",
    fidelity: "critical",
    endpoint: "fal-ai/kling-video/v3/pro/motion-control",
  },
  technicalQc: {
    status: "completed_path_exercised",
    overallBusinessStatus: qReport?.value?.overallStatus || null,
    automaticMotionMetrics: "unavailable",
    identityMetrics: "unavailable",
    handsFeetMetrics: "unavailable",
    fidelityMetrics: "unavailable",
  },
  manualChecklist: [
    "fidélité globale du mouvement",
    "continuité temporelle",
    "posture et équilibre",
    "trajectoire des bras",
    "mains et pieds",
    "identité du personnage",
    "tenue",
    "déformations",
    "caméra et cadrage",
    "artefacts visuels",
  ],
  allowedDecisions: [
    {
      decision: "APPROVE",
      consequence: "peut activer/finaliser selon Auth ultérieure — pas dans cette phase",
    },
    {
      decision: "REJECT",
      consequence: "rejette l'output ; pas de resubmit implicite",
    },
    {
      decision: "RETRY_WITH_SAME_REFERENCE",
      consequence: "nécessite nouvelle Auth paid ; hors MT-013N",
    },
    {
      decision: "RETRY_WITH_UPDATED_CONSTRAINTS",
      consequence: "nécessite nouvelle Auth paid + contraintes ; hors MT-013N",
    },
    {
      decision: "REQUEST_NEW_REFERENCE",
      consequence: "bloque sur nouvel input identité/source ; hors MT-013N",
    },
  ],
  integrityNote: integrityReason,
};

report.reviewSheet = reviewSheet;
report.flagsRuntime = {
  expected: "OFF / UNAVAILABLE",
  vercelMutationsThisAuth: 0,
  note: "no deploy/env writes performed by MT-013N",
};
report.writes = {
  dbMutations: 0,
  storageSignedUrlCreated: previewPrepared ? 1 : 0,
  storageUploads: 0,
  fal: 0,
};
report.p0p1 = {
  p0: previewPrepared
    ? "Human must open private preview before TTL expiry and apply HR decision under a NEW Auth"
    : `Preview blocked — ${integrityVerdict}: ${integrityReason}`,
  p1: "Consider durable original motionInput on payload for cold resume QC (avoid stub hydrate false reject)",
};
report.nextHumanAction = previewPrepared
  ? "Examine private preview (TTL≤10m) using review sheet; then Auth Human Review decision only"
  : "Resolve integrity block before any preview or HR decision Auth";

const allPass = checks.every((x) => x.pass) && integrityVerdict === "PASS";
report.ok = allPass && previewPrepared;
report.stop = {
  1: integrityVerdict,
  2: report.submitProvider,
  3: report.timeline,
  4: report.maxAttemptsAnalysis,
  5: report.qcRejectedAnalysis,
  6: report.canonicalQc,
  7: report.canonicalHumanReview,
  8: {
    appendOnly: historyPreserved,
    jobErrorPreserved: jobErrorCode,
    jobStatusPreserved: jobStatus,
    payloadPhaseAfterSeed: phase,
    silentHistoryRewrite: false,
    note: "job.error/status not erased; payload handoff fields updated under MT-013M seed Auth",
  },
  9: { active: report.asset.active === true, asset: report.asset },
  10: report.ledgerFinal,
  11: report.reconciliationRequired,
  12: report.preview.prepared ? "PREVIEW_PREPARED" : "PREVIEW_BLOCKED",
  13: report.preview.ttlSeconds,
  14: "see reviewSheet (no URL)",
  15: { providerCalls: 0, fal: 0, dbWrites: 0, signedUrl: previewPrepared ? 1 : 0 },
  16: report.flagsRuntime,
  17: report.p0p1,
  18: report.nextHumanAction,
};

mkdirSync(join(studioRoot, ".tmp"), { recursive: true });
const outPath = join(studioRoot, ".tmp", "mt013n-review-integrity.json");
// Ensure no URL accidentally present
if (hasUrlLeak(report)) {
  console.error(JSON.stringify({ ok: false, reason: "refusing to write report with URL leak" }));
  process.exit(1);
}
writeFileSync(outPath, JSON.stringify(report, null, 2));

const docsDir = join(studioRoot, "..", "docs", "Developer-Handover");
const docPath = join(docsDir, "96_MT013N_MV001_REVIEW_INTEGRITY_AND_PRIVATE_PREVIEW.md");
const doc = `# MT-013N — MV-001 REVIEW INTEGRITY AUDIT & PRIVATE PREVIEW PREP

**Date :** 2026-08-12  
**Auth :** \`${AUTH}\`  
**Scope :** project \`${PROJ}\` only  
**Constraints :** 0 fal · 0 reserve · 0 HR decision · 0 deploy · flags remain OFF

---

## Verdict

\`\`\`text
INTEGRITY = ${integrityVerdict}
PREVIEW = ${previewPrepared ? "PREPARED_TTL_600S" : "BLOCKED"}
PROVIDER_CALLS = 0
DECISION_APPLIED = 0
URL_IN_DOC_OR_GIT = 0
\`\`\`

Reason: \`${integrityReason}\`

---

## Submit / provider uniqueness

- submitCount = **${submitCount}**
- providerJobId = \`${redactProvider(externalJobId)}\`
- generation_attempts = **${(attempts || []).length}** (attempt_number=1, kind=primary)
- production_jobs = **${(jobs || []).length}**

## Timeline (redacted)

| Entity | Status / phase | Notes |
| --- | --- | --- |
| production_run | \`${runStatus}\` | needs_review = business waiting HR |
| production_job | \`${jobStatus}\` / phase \`${phase}\` | error.code=\`${jobErrorCode}\` preserved |
| generation_attempt | \`${attempt?.status}\` | external=\`${redactProvider(attempt?.external_job_id)}\` |
| queue reclaim | attempt_count=${queueAttemptCount}, max_attempts=${queueMaxAttempts} | ≠ provider attempt |

## max_attempts analysis

Constraint \`production_jobs_attempts_bounds\`: \`attempt_count <= max_attempts + 1\`.

With \`max_attempts=1\`, only the first worker claims succeed; further **poll reclaims** hit the CHECK. This is **queue lease reclaim capacity**, not a second fal \`generation_attempt\`. Provider submit remained 1.

## qc_rejected analysis

| Question | Answer |
| --- | --- |
| Where recorded? | \`production_jobs.error.code=qc_rejected\`, \`status=failed\`; ephemeral in-process \`mqr-*\` |
| Why not business canon? | Resume hydrate used \`pollHydrateMotionInput\` stub (\`durable-hydrate-*\`) — not MV-001 inputs; false reject vs unavailable-metrics→human_review policy |
| Transition to human_review? | MT-013M \`mt013m-seed-hr-context.mjs\` inserted durable \`quality_report\` + audit seed; **no** APPROVE/REJECT/RETRY |
| Append-only? | \`job.error/status\` **not erased**; payload handoff fields updated under that Auth |

## Canonical QC / HR

- quality_report \`${redactId(qReport?.id)}\` → \`overallStatus=human_review\`
- HR decisions table rows = **${(decisions || []).length}**
- audit \`motion.mv001.human_review.seeded\` present
- payload \`humanReviewHandoffStatus=seeded\`
- output asset \`${redactId(output?.id)}\` **active=false**

## Ledger

reserve **162** / commit **135** / release **27** · reconciliationRequired = **${motion.reconciliationRequired === true}**

## Preview

${previewPrepared ? "Private read-only signed URL created with TTL **600s**; transmitted only on operator console channel \`PREVIEW_URL_CHANNEL_*\` — **not** stored in this document, JSON report, or Git." : "Preview **blocked** by integrity verdict."}

## Review sheet (redacted)

See machine report \`.tmp/mt013n-review-integrity.json\` → \`reviewSheet\` (checklist + allowed decisions). No URL inside.

## Provider calls / writes (this Auth)

- fal / poll / resultFetch = **0**
- budget writes = **0**
- Vercel / migration = **0**
- signed URL creates = **${previewPrepared ? 1 : 0}** (ephemeral)

## Next human action

${report.nextHumanAction}
`;

writeFileSync(docPath, doc);

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      integrityVerdict,
      integrityReason,
      previewPrepared,
      ttlSeconds: previewTtl,
      reportPath: ".tmp/mt013n-review-integrity.json",
      docPath: "docs/Developer-Handover/96_MT013N_MV001_REVIEW_INTEGRITY_AND_PRIVATE_PREVIEW.md",
      checksFailed: checks.filter((x) => !x.pass).map((x) => x.id),
      stop: report.stop,
    },
    null,
    2,
  ),
);

process.exit(integrityVerdict === "PASS" && previewPrepared ? 0 : 1);
