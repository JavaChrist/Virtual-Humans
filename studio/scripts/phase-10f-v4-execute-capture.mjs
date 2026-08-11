/**
 * Phase 10F-V4-EXECUTE — capture redacted evidence for a Storyboard run (read-only).
 * Requires: CONFIRM_PHASE_10F_REMOTE_READ=1
 * Env: PHASE_10F_RUN_ID, PHASE_10F_CORR
 * Never prints storyboard body.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inventoryRequiredContinuity,
  mandatoryContinuityKeysByVisualSegmentId,
} from "../src/domain/storyboard/continuity.ts";
import { VisualDirectionSchema } from "../src/domain/art/index.ts";
import { StoryboardProjectSchema } from "../src/domain/storyboard/schemas.ts";

if (process.env.CONFIRM_PHASE_10F_REMOTE_READ !== "1") {
  console.error("Refused: CONFIRM_PHASE_10F_REMOTE_READ=1");
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const RUN_ID = process.env.PHASE_10F_RUN_ID;
const CORR = process.env.PHASE_10F_CORR;
const VISUAL_ID = "49481462-6444-41f9-8c48-7e7d32c09f1b";
const UPSTREAM = [
  "199284d6-7126-4383-b85f-1ecd74d9528e",
  "11f8f8e0-a280-43aa-a7ea-5e6b0401b72a",
  "349e2792-3235-4c00-a1da-9e087b0b4d1c",
  VISUAL_ID,
];
const PRIOR = [
  "b446a0ed-0005-40ed-b134-b7ab769bd819",
  "f5b75018-5aa1-4a16-97e1-7e515f94f106",
  "4914c203-3be0-4f62-8529-a9b3db25448e",
  "60a1d9c6-17a7-4c31-a838-495bf07b4289",
];
const EXPECT_FP = "9d34b42ddc3bb85c";
const EXPECT_KEY_FP = "801c34a1080bbcf0";
const EXPECT_UPSTREAM_SHA = {
  "199284d6-7126-4383-b85f-1ecd74d9528e": "fa0097b80e1b662d",
  "11f8f8e0-a280-43aa-a7ea-5e6b0401b72a": "c7cb65fda9f51182",
  "349e2792-3235-4c00-a1da-9e087b0b4d1c": "6650d46ad6fee581",
  "49481462-6444-41f9-8c48-7e7d32c09f1b": "0763ee2771c408c3",
};

function loadEnv(path) {
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

function sha16(v) {
  return createHash("sha256")
    .update(JSON.stringify(v))
    .digest("hex")
    .slice(0, 16);
}

const remote = loadEnv(resolve(studioRoot, ".env.remote.local"));
const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: proj } = await db
  .from("video_projects")
  .select("workspace_id")
  .eq("id", PROJECT_ID)
  .maybeSingle();
const ws = proj.workspace_id;

const RUN_COLS =
  "id, director_type, status, error_code, attempt_number, retry_of_run_id, prompt_version, schema_version, model_id, idempotency_key, estimated_cost_minor, actual_cost_minor, cost_status, output_artifact_id, correlation_id, usage, created_at, completed_at";

const { data: run, error: runErr } = await db
  .from("director_runs")
  .select(RUN_COLS)
  .eq("id", RUN_ID)
  .maybeSingle();
const { data: byCorr, error: corrErr } = await db
  .from("director_runs")
  .select(RUN_COLS)
  .eq("correlation_id", CORR);
const chosen = run ?? byCorr?.[0] ?? null;
if (!chosen) {
  console.error(
    JSON.stringify({
      runLookupFailed: true,
      runErr: runErr?.message ?? null,
      corrErr: corrErr?.message ?? null,
      RUN_ID,
      CORR,
    }),
  );
}

const { data: ledger } = await db
  .from("cost_ledger")
  .select("entry_type,amount_minor,correlation_id,created_at")
  .eq("workspace_id", ws)
  .eq("correlation_id", CORR)
  .order("created_at", { ascending: true });

const { data: policy } = await db
  .from("workspace_budget_policies")
  .select("hard_limit_minor")
  .eq("workspace_id", ws)
  .maybeSingle();
const hard = Number(policy.hard_limit_minor);
const { data: commits } = await db
  .from("cost_ledger")
  .select("amount_minor")
  .eq("workspace_id", ws)
  .eq("entry_type", "commit");
const exposure = (commits ?? []).reduce((s, e) => s + Number(e.amount_minor), 0);
const { count: activeHeld } = await db
  .from("budget_reservations")
  .select("id", { count: "exact", head: true })
  .eq("workspace_id", ws)
  .eq("status", "active");

const { data: activeSb } = await db
  .from("active_artifact_revisions")
  .select("artifact_id,revision")
  .eq("project_id", PROJECT_ID)
  .eq("artifact_type", "storyboard_project")
  .maybeSingle();

let sbArt = null;
const artId = activeSb?.artifact_id || chosen?.output_artifact_id;
if (artId) {
  const { data } = await db
    .from("project_artifacts")
    .select("id,revision,schema_version,created_by,correlation_id,value")
    .eq("id", artId)
    .maybeSingle();
  sbArt = data;
}

const { data: prior } = await db
  .from("director_runs")
  .select("id,status,error_code")
  .in("id", PRIOR);

const { data: upstreamRows } = await db
  .from("project_artifacts")
  .select("id,artifact_type,revision,value")
  .in("id", UPSTREAM);

const { data: activeUp } = await db
  .from("active_artifact_revisions")
  .select("artifact_type,artifact_id,revision")
  .eq("project_id", PROJECT_ID)
  .in("artifact_type", [
    "marketing_plan",
    "creative_concept",
    "video_script",
    "visual_direction",
  ]);

let mediaJobsSinceRun = null;
try {
  const { count } = await db
    .from("production_jobs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", PROJECT_ID)
    .gte("created_at", chosen?.created_at ?? "1970-01-01");
  mediaJobsSinceRun = count ?? 0;
} catch {
  mediaJobsSinceRun = "table_unavailable";
}

const keyFp = chosen?.idempotency_key
  ? createHash("sha256")
      .update(chosen.idempotency_key)
      .digest("hex")
      .slice(0, 16)
  : null;

const byType = {};
for (const e of ledger ?? []) {
  byType[e.entry_type] = (byType[e.entry_type] ?? 0) + Number(e.amount_minor);
}

const visualRow = (upstreamRows ?? []).find((r) => r.id === VISUAL_ID);
const visual = VisualDirectionSchema.parse(visualRow.value);
const inv = inventoryRequiredContinuity(visual);
const map = mandatoryContinuityKeysByVisualSegmentId(visual);

let validations = null;
if (sbArt?.value) {
  const zodProject = StoryboardProjectSchema.safeParse(sbArt.value);
  const scenes = zodProject.success ? zodProject.data.scenes : [];
  let slotsCovered = 0;
  let invented = 0;
  let wrongSegment = 0;
  const opaqueExact = [];
  const missing = [];
  const allMandatory = new Set(Object.values(map).flat());
  const MANDATORY_SCOPES = new Set([
    "location",
    "lighting",
    "palette",
    "product",
    "screen_direction",
  ]);

  for (const [segId, required] of Object.entries(map)) {
    const scene = scenes.find(
      (s) =>
        s.visualDirectionSegmentId === segId || s.scriptSegmentId === segId,
    );
    const keys = scene?.continuityKeys ?? [];
    const keySet = new Set(keys);
    for (const tok of required) {
      if (keySet.has(tok)) {
        slotsCovered++;
        if (tok.includes("|")) opaqueExact.push(tok);
      } else missing.push(`${segId}|${tok}`);
    }
    for (const k of keys) {
      const scope = k.split(":")[0] ?? "";
      if (!MANDATORY_SCOPES.has(scope)) continue;
      if (required.includes(k)) continue;
      const elsewhere = Object.entries(map).some(
        ([otherId, toks]) => otherId !== segId && toks.includes(k),
      );
      if (elsewhere) wrongSegment++;
      else if (!allMandatory.has(k)) invented++;
    }
  }

  const uniqueObserved = new Set(
    scenes.flatMap((s) => s.continuityKeys ?? []).filter((k) => {
      const scope = k.split(":")[0];
      return MANDATORY_SCOPES.has(scope);
    }),
  );
  const uniqueMandatoryObserved = [...uniqueObserved].filter((k) =>
    allMandatory.has(k),
  );

  const meta = sbArt.value?.metadata ?? sbArt.value?.provenance ?? {};
  const timingStatus = sbArt.value?.timing?.status ?? null;
  validations = {
    serverCompleted: chosen?.status === "completed",
    structuredOutput: chosen?.status === "completed" ? "PASS" : "UNKNOWN",
    zod: zodProject.success ? "PASS" : "FAIL",
    zodIssueCount: zodProject.success ? 0 : zodProject.error.issues.length,
    coverage:
      zodProject.success && scenes.length === visual.segments.length
        ? "PASS"
        : "FAIL",
    continuity:
      slotsCovered === inv.mandatoryContinuityTokenCount &&
      missing.length === 0 &&
      invented === 0 &&
      wrongSegment === 0
        ? "PASS"
        : "FAIL",
    references: chosen?.status === "completed" ? "PASS_SERVER" : "UNKNOWN",
    spokenContent: chosen?.status === "completed" ? "PASS_SERVER" : "UNKNOWN",
    timing:
      timingStatus === "exact"
        ? "PASS"
        : chosen?.status === "completed"
          ? "PASS_SERVER"
          : "UNKNOWN",
    timingStatus,
    continuityDetail: {
      slotsCovered,
      slotsExpected: inv.mandatoryContinuityTokenCount,
      uniqueMandatoryObserved: uniqueMandatoryObserved.length,
      uniqueExpected: inv.mandatoryContinuityUniqueTokenCount,
      scopes: inv.scopes,
      fingerprintMatrix: inv.mandatoryContinuityTokensFingerprint,
      fingerprintExpected: EXPECT_FP,
      opaqueTokensExact: opaqueExact,
      missingCount: missing.length,
      invented,
      wrongSegment,
    },
    storyboard: {
      artifactId: sbArt.id,
      revision: sbArt.revision,
      schemaVersion: sbArt.schema_version,
      valueSha16: sha16(sbArt.value),
      createdBy: sbArt.created_by,
      correlationId: sbArt.correlation_id,
      sceneCount: scenes.length,
      metadataKeys: Object.keys(meta || {}).slice(0, 24),
      createdByDirector: sbArt.value?.createdBy ?? null,
      promptVersionInArtifact:
        sbArt.value?.promptVersion ??
        meta?.promptVersion ??
        meta?.prompt_version ??
        null,
    },
  };
}

const upstreamHashes = (upstreamRows ?? []).map((r) => ({
  id: r.id,
  type: r.artifact_type,
  revision: r.revision,
  sha16: sha16(r.value),
  unchanged: sha16(r.value) === EXPECT_UPSTREAM_SHA[r.id],
}));

const out = {
  run: chosen
    ? {
        id: chosen.id,
        status: chosen.status,
        errorCode: chosen.error_code,
        attemptNumber: chosen.attempt_number,
        retryOfRunId: chosen.retry_of_run_id,
        promptVersion: chosen.prompt_version,
        schemaVersion: chosen.schema_version,
        modelId: chosen.model_id,
        idempotencyKeyFingerprint: keyFp,
        estimatedCostMinor: chosen.estimated_cost_minor,
        actualCostMinor: chosen.actual_cost_minor,
        costStatus: chosen.cost_status,
        outputArtifactId: chosen.output_artifact_id,
        correlationId: chosen.correlation_id,
        usage: chosen.usage ?? null,
        createdAt: chosen.created_at,
        completedAt: chosen.completed_at,
      }
    : null,
  keyFingerprintExpected: EXPECT_KEY_FP,
  keyFingerprintMatch: keyFp === EXPECT_KEY_FP,
  ledgerByType: byType,
  ledgerEntries: (ledger ?? []).map((e) => ({
    type: e.entry_type,
    amount: Number(e.amount_minor),
  })),
  budgetAfter: {
    hard,
    committed: exposure,
    reserved: activeHeld ?? 0,
    available: hard - (activeHeld ?? 0) - exposure,
  },
  activeStoryboard: activeSb
    ? { artifactId: activeSb.artifact_id, revision: activeSb.revision }
    : null,
  validations,
  priorImmutable: (prior ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    errorCode: r.error_code,
  })),
  upstreamActive: activeUp ?? [],
  upstreamHashes,
  mediaJobsSinceRun,
  bodyPrinted: false,
};

mkdirSync(resolve(studioRoot, ".tmp"), { recursive: true });
const path = resolve(studioRoot, ".tmp/phase-10f-v4-execute-capture.json");
writeFileSync(path, JSON.stringify(out, null, 2), "utf8");
console.log(JSON.stringify({ ...out, evidencePath: path }, null, 2));
process.exit(chosen ? 0 : 2);
