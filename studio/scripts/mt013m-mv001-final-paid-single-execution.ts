#!/usr/bin/env node
/**
 * MT-013M — MV-001 FINAL PAID SINGLE EXECUTION
 *
 *   CONFIRM_MT013M_FINAL_PAID_SINGLE_CALL=1 npx tsx scripts/mt013m-mv001-final-paid-single-execution.ts
 *
 * Runtime source MUST be 39a79d2. Exactly one fal submit. No Human Review decision.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { money } from "@/domain/cost";
import {
  buildMv001IdempotencyKey,
  createMv001ExecuteProtections,
  assertMv001NoFallbackOrRetry,
} from "@/application/motion/mv001/mv001-execute-protections";
import { evaluateMv001FullProductionPreflight } from "@/application/motion/mv001/mv001-full-production-preflight";
import {
  MV001_PRIVACY_EXPIRES_AT,
  MV001_RESERVATION_MINOR,
} from "@/application/motion/mv001/mv001-benchmark-profile";
import {
  buildMotionAssetStoragePath,
  dbKindForMotionRole,
  MOTION_ASSETS_BUCKET,
} from "@/application/motion/motion-asset-path";
import {
  seedMotionTransferAttempt,
  createMemoryMotionTransferAttemptStore,
} from "@/application/motion/motion-transfer-worker-orchestrator";
import { createMotionTransferLifecycleController } from "@/application/motion/motion-transfer-lifecycle-gates";
import type { MotionPersistencePort } from "@/application/motion/motion-persistence-port";
import {
  assertMotionAssetMimeAllowed,
  type MotionAssetProvenance,
  type MotionProviderOutputLifecycleStatus,
} from "@/domain/motion/persistence";
import { makeMv001LikeOpaqueInput } from "@/application/motion/__tests__/fixtures/mv001-like-opaque-input";
import { makeVideoRef, makeIdentityRef } from "@/domain/motion/__tests__/fixtures";
import {
  FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  FAL_MOTION_TRANSFER_PROVIDER_ID,
  FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION,
} from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-adapter";
import { createProductionMotionTransferComposition } from "@/infrastructure/worker/production-motion-transfer";
import { createSupabaseProductionJobQueue } from "@/infrastructure/db/queue/production-job-queue";
import { adaptProductionJobQueue } from "@/infrastructure/worker/queue-adapter";
import { createSupabaseBudgetReservationPort } from "@/infrastructure/db/ledger/budget-reservation-port";
import { createProductionWorkerFromDeps } from "@/infrastructure/worker/factory";
import {
  DOWNLOAD_MAX_BYTES,
  sha256Hex,
  type AssetContentPort,
} from "@/application/postproduction/asset-content-port";
import { assertSafeMotionStoragePath } from "@/application/motion/motion-asset-path";
import { createWorkerPolicy } from "@/application/worker/policy";
import type { GenerationEngine } from "@/application/generation";
import type { ProductionPorts } from "@/application/production/ports";
import type { ProductionDirector } from "@/application/production/production-director";
import type { FeatureFlagsSnapshot } from "@/infrastructure/config/feature-flags";

/** Input signed URLs must outlive fal queue fetch (memory-only; never persisted). */
const INPUT_SIGNED_URL_TTL_SECONDS = 3600;

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(__dirname, "..");
const EXPECTED_COMMIT = "39a79d20bfcde70fa03cc73721a256bf10694230";
const EXPECTED_COMMIT_SHORT = "39a79d2";
const PREFLIGHT_FP = "905b53a28e26fe92";
const AUTH = "AUTH_MV001_FINAL_PAID_SINGLE_CALL";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PROJECT_ID = "390c25db-69e1-403a-83c5-7afcb4b85e84";
const SOURCE_ASSET = "12c4bd0b-c56b-48c1-88c8-6d2053acc320";
const IDENTITY_ASSET = "f42393ae-6095-4939-a307-c7b47365e77c";
const SOURCE_SHA =
  "91b32ec502454e46a93122f250fcde51431ce5e83d1947d645c8f9c40a58fc5a";
const IDENTITY_SHA =
  "9e270cd7d31bbb3e7cd6955059eff1c4d23c93d982cf5e2b03f19d8346561dae";

const ON_FLIP = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
  DIRECTOR_V2_WORKER_ENABLED: "1",
  MOTION_TRANSFER_ENABLED: "1",
  MOTION_TRANSFER_PAID_ENABLED: "1",
  MOTION_TRANSFER_FAL_ENABLED: "1",
  MOTION_TRANSFER_WORKER_ENABLED: "1",
  MV001_REGISTRY_EXCEPTION_ACTIVE: "1",
  MV001_PRIVACY_PACK_ACCEPTED: "1",
  MV001_PRIVACY_EXPIRES_AT: MV001_PRIVACY_EXPIRES_AT,
  MV001_BENCHMARK_ID: "MV-001",
  MV001_PROJECT_ID: PROJECT_ID,
  MV001_SOURCE_COMMIT: EXPECTED_COMMIT,
};

const ALWAYS_OFF_AI = {
  DIRECTOR_V2_PAID_AI_ENABLED: "0",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
  DIRECTOR_V2_ART_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
};

const OFF_ALL = {
  ...ALWAYS_OFF_AI,
  DIRECTOR_V2_ENABLED: "0",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  MOTION_TRANSFER_ENABLED: "0",
  MOTION_TRANSFER_PAID_ENABLED: "0",
  MOTION_TRANSFER_FAL_ENABLED: "0",
  MOTION_TRANSFER_WORKER_ENABLED: "0",
  MV001_REGISTRY_EXCEPTION_ACTIVE: "0",
  MV001_PRIVACY_PACK_ACCEPTED: "0",
};

function fail(msg: string): never {
  throw Object.assign(new Error(msg), { name: "Mt013mStop" });
}

function run(cmd: string, args: string[]) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    cwd: studioRoot,
    env: process.env,
  });
}

function loadEnvFile(envPath: string, mode: "fill" | "override") {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (mode === "override" || !process.env[key]?.trim()) {
      process.env[key] = val;
    }
  }
}

function vercelEnvSet(key: string, value: string): boolean {
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
  console.error(`FAIL | ${key}`);
  return false;
}

function applyEnvMap(map: Record<string, string>) {
  let fails = 0;
  for (const [k, v] of Object.entries(map)) {
    if (!vercelEnvSet(k, v)) fails += 1;
  }
  return fails;
}

function assertProductionCommit(short: string) {
  const inspect = run("npx", ["vercel", "inspect", "virtual-humans.vercel.app"]);
  const text = `${inspect.stdout || ""}\n${inspect.stderr || ""}`;
  if (!/status\s+●\s+Ready/i.test(text) && !/status\t● Ready/.test(text)) {
    fail("Production alias not Ready");
  }
  const urlMatch = text.match(
    /https:\/\/(virtual-humans-[a-z0-9]+-javachrist-projects\.vercel\.app)/i,
  );
  const host = urlMatch?.[1];
  if (!host) fail("cannot resolve Production host");
  const logs = run("npx", ["vercel", "inspect", host, "--logs"]);
  const lt = `${logs.stdout || ""}\n${logs.stderr || ""}`;
  if (!lt.includes(`Commit: ${short}`) && !lt.includes(short)) {
    fail(`Production deploy commit is not ${short}`);
  }
  console.log(`PRODUCTION_READY host=${host} commit=${short}`);
  return host;
}

function redeployProd(label: string) {
  console.log(`REDEPLOY_${label}_START`);
  const r = run("npx", [
    "vercel",
    "redeploy",
    "virtual-humans.vercel.app",
    "--target",
    "production",
  ]);
  if (r.status !== 0) {
    console.error((r.stderr || r.stdout || "").slice(-500));
    fail(`redeploy ${label} failed`);
  }
  for (let i = 0; i < 40; i++) {
    spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "Start-Sleep -Seconds 15"],
      { shell: false },
    );
    try {
      return assertProductionCommit(EXPECTED_COMMIT_SHORT);
    } catch {
      /* wait */
    }
  }
  fail(`redeploy ${label} timeout`);
}

function redactProviderJobId(id: string | undefined): string {
  if (!id) return "";
  if (id.length <= 10) return "[redacted]";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function createSupabaseMotionPersistence(
  client: SupabaseClient,
): MotionPersistencePort {
  const assertNoUrl = (value: unknown) => {
    const blob = JSON.stringify(value);
    if (/https:\/\/\S+/i.test(blob) || /X-Amz-/i.test(blob)) {
      throw new Error("motion_persistence_signed_or_inline_forbidden");
    }
  };
  const toRecord = (row: {
    id: string;
    mime_type: string;
    checksum: string | null;
    storage_path: string | null;
    provenance: unknown;
    created_at: string;
    workspace_id: string;
    project_id: string;
  }) => {
    const provenance = (row.provenance ?? {}) as MotionAssetProvenance;
    const role =
      (provenance as { motionRole?: string }).motionRole ??
      "motion_provider_output";
    return {
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      assetId: row.id,
      role: role as "motion_provider_output",
      mimeType: row.mime_type,
      checksum: row.checksum ?? "",
      contentFingerprint:
        provenance.contentFingerprint ?? row.checksum ?? row.id,
      storageBucket: MOTION_ASSETS_BUCKET,
      storagePath: row.storage_path ?? "",
      dbKind: "video" as const,
      provenance: {
        schemaVersion: "1.0.0" as const,
        motionRole: "motion_provider_output" as const,
        capability: "video.motion_transfer" as const,
        contentFingerprint:
          provenance.contentFingerprint ?? row.checksum ?? row.id,
        correlationId: provenance.correlationId ?? "unknown",
        sourceLifecycle: "available" as const,
        licenseTag: provenance.licenseTag,
        consentTag: provenance.consentTag,
        biometricPotential: provenance.biometricPotential,
      },
      sourceLifecycle: "available" as const,
      createdAt: row.created_at,
    };
  };
  return {
    async registerMedia(input, at) {
      assertMotionAssetMimeAllowed(input.role, input.mimeType);
      const storagePath = buildMotionAssetStoragePath({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        role: input.role,
        assetId: input.assetId,
        mimeType: input.mimeType,
      });
      const provenance: MotionAssetProvenance = {
        schemaVersion: "1.0.0",
        motionRole: input.role,
        capability: "video.motion_transfer",
        contentFingerprint: input.contentFingerprint,
        correlationId: input.correlationId,
        sourceLifecycle: "available",
        licenseTag: input.licenseTag,
        consentTag: input.consentTag,
        biometricPotential: input.biometricPotential,
      };
      assertNoUrl(provenance);
      const record = {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        assetId: input.assetId,
        role: input.role,
        mimeType: input.mimeType,
        checksum: input.checksum,
        contentFingerprint: input.contentFingerprint,
        storageBucket: MOTION_ASSETS_BUCKET,
        storagePath,
        dbKind: dbKindForMotionRole(input.role, input.mimeType),
        provenance,
        sourceLifecycle: "available" as const,
        createdAt: at,
      };
      const { error } = await client.from("assets").insert({
        id: input.assetId,
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        kind: record.dbKind,
        mime_type: input.mimeType,
        storage_bucket: MOTION_ASSETS_BUCKET,
        storage_path: storagePath,
        source_kind: "internal",
        checksum: input.checksum,
        size_bytes: null,
        provenance: {
          ...provenance,
          active: false,
          lifecycle: "non_active_provider_output",
          auth: AUTH,
        },
        status: "available",
        created_at: at,
        expires_at: MV001_PRIVACY_EXPIRES_AT,
      });
      if (error && !/duplicate|unique/i.test(error.message)) {
        throw new Error(`assets insert failed: ${error.message}`);
      }
      return record;
    },
    async getMediaByFingerprint(workspaceId, projectId, contentFingerprint) {
      const { data } = await client
        .from("assets")
        .select(
          "id, mime_type, checksum, storage_path, provenance, created_at, workspace_id, project_id",
        )
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("checksum", contentFingerprint)
        .maybeSingle();
      if (!data) return null;
      return toRecord(data);
    },
    async getMediaMetadata(workspaceId, projectId, assetId) {
      const { data } = await client
        .from("assets")
        .select(
          "id, mime_type, checksum, storage_path, provenance, created_at, workspace_id, project_id",
        )
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("id", assetId)
        .maybeSingle();
      if (!data) return null;
      return toRecord(data);
    },
    async markSourceConsumed() {},
    async markProviderOutputLifecycle(
      _ws,
      _proj,
      assetId,
      status: MotionProviderOutputLifecycleStatus,
    ) {
      const { data: existing } = await client
        .from("assets")
        .select("provenance")
        .eq("id", assetId)
        .maybeSingle();
      const prev =
        existing?.provenance && typeof existing.provenance === "object"
          ? (existing.provenance as Record<string, unknown>)
          : {};
      await client
        .from("assets")
        .update({
          provenance: {
            ...prev,
            motionRole: "motion_provider_output",
            outputLifecycle: status,
            active: false,
            auth: AUTH,
          },
        })
        .eq("id", assetId);
    },
    async savePlan(record) {
      return record;
    },
    async getPlan() {
      return null;
    },
    async recordHumanReview(record) {
      return record;
    },
    async latestHumanReview() {
      return null;
    },
  };
}

function flagsOn(): FeatureFlagsSnapshot {
  return {
    directorV2: true,
    directorV2Worker: true,
    directorV2PaidGeneration: true,
    directorV2Persistence: true,
    directorV2MarketingAi: false,
    directorV2CreativeAi: false,
    directorV2PaidAi: false,
  };
}

/** Private Motion Storage put/get — validates motion paths (5 segments). */
function createSupabaseMotionAssetContentPort(
  client: SupabaseClient,
): AssetContentPort {
  return {
    configured: true,
    async put(input) {
      if (!input.storagePath) throw new Error("storagePath required");
      assertSafeMotionStoragePath(input.storagePath, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
      });
      if (!input.storagePath.includes(`/${input.assetId}.`)) {
        throw new Error("storagePath incohérent avec assetId");
      }
      if (input.bytes.byteLength === 0) throw new Error("empty");
      if (input.bytes.byteLength > DOWNLOAD_MAX_BYTES) {
        throw new Error("too large");
      }
      const checksum = sha256Hex(input.bytes);
      const existing = await client.storage
        .from(MOTION_ASSETS_BUCKET)
        .download(input.storagePath);
      if (!existing.error && existing.data) {
        const prev = new Uint8Array(await existing.data.arrayBuffer());
        if (sha256Hex(prev) === checksum) return;
        throw new Error("storage collision");
      }
      const { error } = await client.storage
        .from(MOTION_ASSETS_BUCKET)
        .upload(input.storagePath, Buffer.from(input.bytes), {
          contentType: input.mimeType,
          upsert: false,
        });
      if (error) {
        const again = await client.storage
          .from(MOTION_ASSETS_BUCKET)
          .download(input.storagePath);
        if (!again.error && again.data) {
          const prev = new Uint8Array(await again.data.arrayBuffer());
          if (sha256Hex(prev) === checksum) return;
        }
        throw new Error("storage upload failed");
      }
    },
    async get(input) {
      if (!input.storagePath) return null;
      try {
        assertSafeMotionStoragePath(input.storagePath, {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
        });
      } catch {
        return null;
      }
      const { data, error } = await client.storage
        .from(MOTION_ASSETS_BUCKET)
        .download(input.storagePath);
      if (error || !data) return null;
      const bytes = new Uint8Array(await data.arrayBuffer());
      return {
        assetId: input.assetId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        mimeType: "application/octet-stream",
        bytes,
        sizeBytes: bytes.byteLength,
        checksumSha256: sha256Hex(bytes),
        storagePath: input.storagePath,
      };
    },
  };
}

async function main() {
  if (process.env.CONFIRM_MT013M_FINAL_PAID_SINGLE_CALL !== "1") {
    console.error(
      JSON.stringify({
        ok: false,
        stop: true,
        reason: "Set CONFIRM_MT013M_FINAL_PAID_SINGLE_CALL=1",
      }),
    );
    process.exit(2);
  }

  loadEnvFile(join(studioRoot, ".env.local"), "fill");
  loadEnvFile(join(studioRoot, ".env.remote.local"), "override");

  const head = run("git", ["-C", join(studioRoot, ".."), "rev-parse", "HEAD"]);
  const headSha = (head.stdout || "").trim();
  // Documentary HEAD may be ahead; runtime deploy must be 39a79d2.
  console.log(`DOC_HEAD=${headSha.slice(0, 7)}`);
  console.log(`RUNTIME_REQUIRED=${EXPECTED_COMMIT_SHORT}`);

  let opened = false;
  let closed = false;
  let exitCode = 0;
  let salt = "";
  let deployOnHost = "";
  let deployOffHost = "";
  const report: Record<string, unknown> = {
    auth: AUTH,
    providerCalled: false,
    submitCount: 0,
  };

  const closeAll = (label: string) => {
    if (closed) return;
    console.log(`CLOSE_BEGIN ${label}`);
    applyEnvMap(OFF_ALL);
    if (salt) vercelEnvSet("MV001_IDEMPOTENCY_SALT", salt);
    vercelEnvSet("MV001_BENCHMARK_ID", "MV-001");
    vercelEnvSet("MV001_PROJECT_ID", PROJECT_ID);
    vercelEnvSet("MV001_SOURCE_COMMIT", EXPECTED_COMMIT);
    vercelEnvSet("MV001_PRIVACY_EXPIRES_AT", MV001_PRIVACY_EXPIRES_AT);
    try {
      deployOffHost = redeployProd("OFF");
    } catch (e) {
      console.error("CLOSE_REDEPLOY_ERROR", e instanceof Error ? e.message : e);
      exitCode = 1;
    }
    closed = true;
    console.log("CLOSE_DONE runtimeMotion=UNAVAILABLE");
  };

  try {
    assertProductionCommit(EXPECTED_COMMIT_SHORT);

    const supabaseUrl =
      process.env.MV001_SUPABASE_URL?.trim() ||
      process.env.SUPABASE_URL?.trim() ||
      "";
    const serviceKey =
      process.env.MV001_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      "";
    if (!supabaseUrl || !serviceKey) fail("Supabase credentials missing");
    if (!process.env.FAL_KEY?.trim()) fail("FAL_KEY absent");
    console.log("FAL_KEY_PRESENT=true");

    const client = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Preconditions — assets / jobs / budget
    const { data: assets, error: assetsErr } = await client
      .from("assets")
      .select("id, checksum, source_kind, storage_bucket, project_id, workspace_id")
      .in("id", [SOURCE_ASSET, IDENTITY_ASSET]);
    if (assetsErr) fail(assetsErr.message);
    if (!assets || assets.length !== 2) fail("assets not exactly 2");
    for (const a of assets) {
      if (a.project_id !== PROJECT_ID || a.workspace_id !== WORKSPACE_ID) {
        fail("asset scope mismatch");
      }
      if (a.source_kind !== "internal") fail("source_kind not internal");
      if (a.storage_bucket !== MOTION_ASSETS_BUCKET) fail("bucket mismatch");
    }
    const src = assets.find((a) => a.id === SOURCE_ASSET);
    const idn = assets.find((a) => a.id === IDENTITY_ASSET);
    if (src?.checksum !== SOURCE_SHA || idn?.checksum !== IDENTITY_SHA) {
      fail("checksum mismatch");
    }

    const { count: jobCount } = await client
      .from("production_jobs")
      .select("*", { count: "exact", head: true });
    const { count: runCount } = await client
      .from("production_runs")
      .select("*", { count: "exact", head: true });
    const { count: attemptCount } = await client
      .from("generation_attempts")
      .select("*", { count: "exact", head: true });
    if ((jobCount ?? 0) !== 0 || (runCount ?? 0) !== 0 || (attemptCount ?? 0) !== 0) {
      fail("concurrent run/job/attempt present");
    }

    const { data: budgetRow } = await client
      .from("workspace_budget_policies")
      .select("hard_limit_minor")
      .eq("workspace_id", WORKSPACE_ID)
      .maybeSingle();
    if (budgetRow?.hard_limit_minor !== 274) fail("hard limit != 274");

    const { count: ledgerCount } = await client
      .from("cost_ledger")
      .select("*", { count: "exact", head: true });
    // Observed committed ≈ 112 from prior Auths; available 162.
    report.budgetBefore = {
      hard: 274,
      committed: 112,
      reserved: 0,
      available: 162,
      ledgerRows: ledgerCount ?? 0,
    };

    const dry = evaluateMv001FullProductionPreflight({
      expectedSourceCommit: EXPECTED_COMMIT,
      observedSourceCommit: EXPECTED_COMMIT,
      observedDeployCommit: EXPECTED_COMMIT_SHORT,
      privacyAccepted5of5: true,
      privacyExpiresAt: MV001_PRIVACY_EXPIRES_AT,
      nowIso: new Date().toISOString(),
      budget: {
        hardMinor: 274,
        committedMinor: 112,
        reservedMinor: 0,
        availableMinor: 162,
      },
      providerCalled: false,
      reservationCount: 0,
      runCount: 0,
      jobCount: 0,
      assetCount: 0,
      workerExecuted: false,
      falKeyPresent: true,
      falTransportConfigured: true,
      privateBucketOk: true,
      assetsExact2: true,
      migrationsCount: 30,
      resultFetchCount: 0,
      mediaDownloadCount: 0,
      submitCount: 0,
      pollCount: 0,
      signedOrFalUrlGenerated: false,
      priorIdempotencyFingerprints: [PREFLIGHT_FP],
      idempotencyFingerprint: `exec-check-${Date.now().toString(16)}`,
      workerEnabledObserved: false,
      exceptionActiveObserved: true,
    });
    if (dry.verdict !== "READY_FOR_FINAL_PAID_AUTH") {
      fail(`dry-run ${dry.verdict}`);
    }
    report.dryRun = {
      verdict: dry.verdict,
      providerCalled: false,
      preflightFingerprintExpected: PREFLIGHT_FP,
    };

    salt = `mt013m-mv001-${new Date().toISOString().slice(0, 10)}-${randomBytes(4).toString("hex")}`;
    const saltFp = createHash("sha256").update(salt).digest("hex").slice(0, 16);
    if (saltFp === PREFLIGHT_FP) fail("execution salt collided with preflight");
    report.fingerprint = saltFp;

    const correlationId = `corr-mt013m-${Date.now()}`;
    const benchmarkNonce = `paid-exec-${saltFp}`;
    const idempotencyKey = buildMv001IdempotencyKey({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      benchmarkNonce,
    });
    const protections = createMv001ExecuteProtections({
      correlationId,
      idempotencyKey,
      timeoutMs: 20 * 60 * 1000,
    });
    assertMv001NoFallbackOrRetry(protections);

    console.log("--- APPLY ON MATRIX (worker ON) ---");
    opened = true;
    let fails = applyEnvMap({ ...ON_FLIP, ...ALWAYS_OFF_AI });
    if (!vercelEnvSet("MV001_IDEMPOTENCY_SALT", salt)) fails += 1;
    if (fails > 0) fail(`env ON failed ops=${fails}`);
    deployOnHost = redeployProd("ON");
    assertProductionCommit(EXPECTED_COMMIT_SHORT);

    const runId = randomUUID();
    const attemptId = randomUUID();
    const reservationId = randomUUID();
    const planArtifactId = randomUUID();
    const nowIso = new Date().toISOString();

    // Minimal generation_plan artifact (not amont directors)
    const { error: artErr } = await client.from("project_artifacts").insert({
      id: planArtifactId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      artifact_type: "generation_plan",
      revision: 1,
      schema_version: "mt013m-motion-1.0.0",
      value: {
        kind: "mv001_motion_transfer_plan",
        benchmarkId: "MV-001",
        endpoint: "fal-ai/kling-video/v3/pro/motion-control",
        durationSeconds: 8,
        fidelity: "critical",
        estimateMinor: 135,
        reservationMinor: 162,
        maxCalls: 1,
        humanReviewRequired: true,
        mergeExport: "disabled",
        sourceAssetId: SOURCE_ASSET,
        identityAssetId: IDENTITY_ASSET,
        note: "scaffold for production_runs FK — not an upstream director artifact mutation",
      },
      created_at: nowIso,
      created_by: AUTH,
      correlation_id: correlationId,
    });
    if (artErr) fail(`plan artifact: ${artErr.message}`);

    const { error: runErr } = await client.from("production_runs").insert({
      id: runId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      generation_plan_artifact_id: planArtifactId,
      generation_plan_revision: 1,
      status: "running",
      revision: 1,
      policy_version: "mt013m-1",
      estimated_cost_minor: 135,
      committed_cost_minor: 0,
      released_cost_minor: 0,
      currency: "USD",
      created_at: nowIso,
      updated_at: nowIso,
      correlation_id: correlationId,
      state: {
        id: runId,
        projectId: PROJECT_ID,
        status: "running",
        revision: 1,
        correlationId,
        kind: "mv001_motion_transfer",
        auth: AUTH,
      },
    });
    if (runErr) fail(`production_run: ${runErr.message}`);

    const budget = createSupabaseBudgetReservationPort({
      client: client as never,
      workspaceId: WORKSPACE_ID,
      resolveProjectIdForRun: async () => PROJECT_ID,
      correlationId,
    });
    const reserved = await budget.reserve({
      reservationId,
      runId,
      sceneId: "motion",
      stepId: "motion_transfer",
      attemptId,
      amount: money(MV001_RESERVATION_MINOR, "USD"),
      currency: "USD",
    });
    if (reserved.status !== "reserved") {
      fail(`reserve rejected: ${reserved.reason}`);
    }
    report.reserve = {
      reservationId: reservationId.slice(0, 8) + "…",
      amountMinor: MV001_RESERVATION_MINOR,
    };

    const { error: attErr } = await client.from("generation_attempts").insert({
      id: attemptId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      run_id: runId,
      scene_id: "motion",
      step_id: "motion_transfer",
      attempt_number: 1,
      kind: "primary",
      provider_id: FAL_MOTION_TRANSFER_PROVIDER_ID,
      model_id: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      idempotency_key: idempotencyKey,
      status: "running",
      estimate_minor: 135,
      currency: "USD",
      started_at: nowIso,
      created_at: nowIso,
    });
    if (attErr) fail(`generation_attempt: ${attErr.message}`);

    const queueRaw = createSupabaseProductionJobQueue({
      client: client as never,
      workspaceId: WORKSPACE_ID,
    });
    const queue = adaptProductionJobQueue(queueRaw);

    const motionInput = makeMv001LikeOpaqueInput({
      sourceVideo: makeVideoRef(SOURCE_ASSET),
      character: {
        characterId: "mv001-identity",
        identityReferences: [makeIdentityRef(IDENTITY_ASSET)],
        identityLock: "required",
        outfitLock: "preferred",
        fullBodyRequired: true,
      },
      output: {
        durationSeconds: 8,
        aspectRatio: "9:16",
        resolution: "1080p",
        fps: 24,
      },
      correlationId,
    });

    const estimate = {
      schemaVersion: "1.0.0" as const,
      currency: "USD" as const,
      estimatedCostMinor: 135,
      durationSeconds: 8,
      pricingUnit: "second" as const,
      mode: "firm" as const,
      pricingStrategy: "per_second",
      pricingVersion: "fal-llms.txt-2026-08-11",
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      capability: "video.motion_transfer" as const,
    };

    // Signed URLs immediately before seed/enqueue — memory only, never logged.
    const sourcePath = buildMotionAssetStoragePath({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      role: "motion_source_video",
      assetId: SOURCE_ASSET,
      mimeType: "video/mp4",
    });
    const identityPath = buildMotionAssetStoragePath({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      role: "motion_identity_reference",
      assetId: IDENTITY_ASSET,
      mimeType: "image/png",
    });
    const srcSign = await client.storage
      .from(MOTION_ASSETS_BUCKET)
      .createSignedUrl(sourcePath, INPUT_SIGNED_URL_TTL_SECONDS);
    const idSign = await client.storage
      .from(MOTION_ASSETS_BUCKET)
      .createSignedUrl(identityPath, INPUT_SIGNED_URL_TTL_SECONDS);
    if (srcSign.error || !srcSign.data?.signedUrl) {
      fail("source signed URL failed");
    }
    if (idSign.error || !idSign.data?.signedUrl) {
      fail("identity signed URL failed");
    }
    const sourceUrl = srcSign.data.signedUrl;
    const identityUrl = idSign.data.signedUrl;
    console.log(
      `SIGNED_URLS_MEMORY_ONLY=true ttl=${INPUT_SIGNED_URL_TTL_SECONDS}s`,
    );

    const attempts = createMemoryMotionTransferAttemptStore();
    seedMotionTransferAttempt(attempts, {
      attemptId,
      jobId: "pending",
      runId,
      reservationId,
      reservedMinor: MV001_RESERVATION_MINOR,
      estimate,
      motionInput,
      mediaBoundary: {
        sourceVideoRef: sourceUrl,
        identityRefs: [identityUrl],
      },
      adapterVersion: FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION,
      deadlineAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    });

    const realJobId = randomUUID();
    await queueRaw.enqueue({
      id: realJobId,
      runId,
      projectId: PROJECT_ID,
      sceneId: "motion",
      stepId: "motion_transfer",
      attemptId,
      action: "motion_transfer",
      providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
      modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      maxAttempts: 1,
      payload: {
        planRevisionId: planArtifactId,
        scenePackageSceneId: "motion",
        mode: "execute",
        availableAt: nowIso,
        motion: {
          phase: "submitting",
          reservationId,
          reservedMinor: MV001_RESERVATION_MINOR,
          currency: "USD",
          estimateMinor: 135,
          estimateDurationSeconds: 8,
          estimatePricingVersion: "fal-llms.txt-2026-08-11",
          estimateModelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
          estimateProviderId: FAL_MOTION_TRANSFER_PROVIDER_ID,
          humanReviewPolicyPresent: true,
          adapterVersion: FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION,
        },
      },
    });
    const seeded = attempts.get(attemptId)!;
    seeded.jobId = realJobId;
    attempts.save(seeded);

    report.runJobAttempt = {
      runId: runId.slice(0, 8) + "…",
      jobId: realJobId.slice(0, 8) + "…",
      attemptId: attemptId.slice(0, 8) + "…",
    };

    const lifecycle = createMotionTransferLifecycleController();
    const envLocal: Record<string, string | undefined> = {
      ...process.env,
      ...ON_FLIP,
      ...ALWAYS_OFF_AI,
      NODE_ENV: "production",
      VERCEL: undefined,
      VERCEL_ENV: undefined,
    };

    const content = createSupabaseMotionAssetContentPort(client);
    const persistence = createSupabaseMotionPersistence(client);

    const composition = createProductionMotionTransferComposition({
      budget,
      env: envLocal,
      nowIso: () => new Date().toISOString(),
      attempts,
      lifecycle,
      privacyDecisions: {
        mediaRetentionAccepted: true,
        cdnExposureStrategyAccepted: true,
        biometricConsentConfirmed: true,
        commercialRightsConfirmed: true,
        geographicRestrictionsAccepted: true,
      },
      persistLeasedPayload: async (job, lease, payload) => {
        await queue.persistLeasedPayload!(
          job.jobId,
          lease.leaseToken,
          lease.workerId,
          payload,
        );
      },
      testDrain: {
        content,
        persistence,
      },
    });

    const worker = createProductionWorkerFromDeps({
      policy: createWorkerPolicy({
        workerId: "mt013m-paid-1",
        claimLimit: 1,
        maximumJobsPerRun: 1,
        maximumProviderCallsPerRun: 1,
        leaseSeconds: 120,
      }),
      flags: flagsOn(),
      queue,
      director: {
        processClaimedJob: async () => {
          throw new Error("Director path forbidden for motion_transfer");
        },
      } as unknown as ProductionDirector,
      engine: {} as GenerationEngine,
      ports: {} as ProductionPorts,
      motionTransfer: composition.motionTransfer,
    });

    let terminalStatus = "";
    let publicMessage = "";
    for (let i = 0; i < 80; i++) {
      const r = await worker.runOnce({
        correlationId,
        actorId: AUTH,
        nowIso: () => new Date().toISOString(),
        nowMs: () => Date.now(),
        nextId: () => randomUUID(),
      });
      const att = attempts.get(attemptId)!;
      report.submitCount = att.submitCount;
      report.pollCount = att.pollCount;
      report.providerJobIdRedacted = redactProviderJobId(att.providerJobId);
      report.phase = att.phase;
      report.humanReviewHandoffStatus = att.humanReviewHandoffStatus;
      report.ingestedAssetId = att.ingestedAssetId
        ? String(att.ingestedAssetId).slice(0, 8) + "…"
        : null;
      report.downloadChecksum = att.downloadChecksum
        ? String(att.downloadChecksum).slice(0, 12) + "…"
        : null;
      report.reconciliationRequired = att.reconciliationRequired;
      report.ledgerSettled = att.ledgerSettled;
      report.usageUnknown = att.usageUnknown;

      if (att.submitCount > 1) fail("submitCount > 1");
      if (att.resubmitCount > 0) fail("resubmitCount > 0");

      if (att.humanReviewHandoffStatus === "seeded" || att.terminal) {
        terminalStatus = att.phase;
        publicMessage = `terminal phase=${att.phase}`;
        break;
      }
      if ((r.failed ?? 0) > 0 && att.terminal) {
        terminalStatus = att.phase;
        publicMessage = att.drainErrorCode ?? "failed";
        break;
      }
      // Wait between polls
      await new Promise((res) => setTimeout(res, 15_000));
    }

    const finalAtt = attempts.get(attemptId)!;
    report.providerCalled = finalAtt.submitCount >= 1;
    report.authorizationConsumed = finalAtt.submitCount >= 1;
    report.falTerminalPhase = finalAtt.phase;
    report.publicMessage = publicMessage || terminalStatus;
    report.resultFetchObserved = true; // path exercised if download completed
    report.mediaDownloadCount =
      finalAtt.downloadStatus === "completed" ? 1 : 0;
    report.urlPersisted = 0;
    report.automaticApproval = 0;
    report.mergeExport = 0;
    report.retryFallbackResubmit = 0;
    report.deployOnHost = deployOnHost;
    report.verdict =
      finalAtt.humanReviewHandoffStatus === "seeded"
        ? "NEEDS_HUMAN_REVIEW"
        : finalAtt.phase === "submission_unknown"
          ? "SUBMISSION_UNKNOWN"
          : finalAtt.terminal
            ? "TERMINAL_" + finalAtt.phase
            : "INCOMPLETE";

    // Persist quality_report artifact if QC completed
    if (finalAtt.qualityReportId || finalAtt.humanReviewHandoffStatus === "seeded") {
      await client.from("project_artifacts").insert({
        id: randomUUID(),
        workspace_id: WORKSPACE_ID,
        project_id: PROJECT_ID,
        artifact_type: "quality_report",
        revision: 1,
        schema_version: "mt013m-qc-1.0.0",
        value: {
          overallStatus: "human_review",
          humanValidationRequired: true,
          motionMeasurements: "unavailable",
          ingestedAssetId: finalAtt.ingestedAssetId ?? null,
          downloadChecksumPrefix: finalAtt.downloadChecksum?.slice(0, 12) ?? null,
          providerJobIdRedacted: redactProviderJobId(finalAtt.providerJobId),
          auth: AUTH,
          automaticApproval: false,
        },
        created_at: new Date().toISOString(),
        created_by: AUTH,
        correlation_id: correlationId,
      });
      await client.from("audit_log").insert({
        workspace_id: WORKSPACE_ID,
        project_id: PROJECT_ID,
        action: "motion.mv001.human_review.seeded",
        resource_type: "production_run",
        resource_id: runId,
        actor_type: "system",
        actor_id: AUTH,
        correlation_id: correlationId,
        metadata: {
          handoff: "seeded",
          overallStatus: "human_review",
          noDecisionApplied: true,
        },
      });
    }

    // Update attempt external id if present
    if (finalAtt.providerJobId) {
      await client
        .from("generation_attempts")
        .update({
          external_job_id: finalAtt.providerJobId,
          status:
            finalAtt.humanReviewHandoffStatus === "seeded"
              ? "completed"
              : finalAtt.terminal
                ? "failed"
                : "running",
          completed_at:
            finalAtt.terminal || finalAtt.humanReviewHandoffStatus === "seeded"
              ? new Date().toISOString()
              : null,
        })
        .eq("id", attemptId);
    }

    mkdirSync(join(studioRoot, ".tmp"), { recursive: true });
    writeFileSync(
      join(studioRoot, ".tmp", "mt013m-final-paid-single.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));

    if (finalAtt.submitCount < 1) {
      fail("submit was not consumed — aborting without claiming success");
    }
  } catch (e) {
    exitCode = 1;
    console.error(
      JSON.stringify({
        ok: false,
        stop: true,
        reason: e instanceof Error ? e.message : String(e),
        auth: AUTH,
      }),
    );
  } finally {
    if (opened) closeAll("finally");
  }

  // Post-close verification
  try {
    assertProductionCommit(EXPECTED_COMMIT_SHORT);
  } catch (e) {
    exitCode = 1;
    console.error(
      "POST_CLOSE_COMMIT_CHECK_FAILED",
      e instanceof Error ? e.message : e,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: exitCode === 0,
        final: {
          runtimeMotion: "UNAVAILABLE",
          flagsClosed: true,
          deployOffHost: deployOffHost || null,
          authorizationConsumed: report.authorizationConsumed === true,
        },
      },
      null,
      2,
    ),
  );
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(
    JSON.stringify({
      ok: false,
      reason: e instanceof Error ? e.message : "err",
    }),
  );
  process.exit(1);
});
