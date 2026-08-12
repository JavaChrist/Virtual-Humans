#!/usr/bin/env node
/**
 * MT-013M resume — poll/drain ONLY for the already-submitted providerJobId.
 * No second fal submit. No new reserve/run/job/attempt.
 *
 *   CONFIRM_MT013M_RESUME_POLL_DRAIN=1 npx tsx scripts/mt013m-resume-poll-drain.ts
 */
import { randomUUID } from "node:crypto";
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
import { MV001_PRIVACY_EXPIRES_AT } from "@/application/motion/mv001/mv001-benchmark-profile";
import {
  buildMotionAssetStoragePath,
  dbKindForMotionRole,
  MOTION_ASSETS_BUCKET,
  assertSafeMotionStoragePath,
} from "@/application/motion/motion-asset-path";
import {
  createMemoryMotionTransferAttemptStore,
} from "@/application/motion/motion-transfer-worker-orchestrator";
import { createMotionTransferLifecycleController } from "@/application/motion/motion-transfer-lifecycle-gates";
import type { MotionPersistencePort } from "@/application/motion/motion-persistence-port";
import {
  assertMotionAssetMimeAllowed,
  type MotionAssetProvenance,
  type MotionProviderOutputLifecycleStatus,
} from "@/domain/motion/persistence";
import {
  DOWNLOAD_MAX_BYTES,
  sha256Hex,
  type AssetContentPort,
} from "@/application/postproduction/asset-content-port";
import { createProductionMotionTransferComposition } from "@/infrastructure/worker/production-motion-transfer";
import { createSupabaseProductionJobQueue } from "@/infrastructure/db/queue/production-job-queue";
import { adaptProductionJobQueue } from "@/infrastructure/worker/queue-adapter";
import { createSupabaseBudgetReservationPort } from "@/infrastructure/db/ledger/budget-reservation-port";
import { createProductionWorkerFromDeps } from "@/infrastructure/worker/factory";
import { createWorkerPolicy } from "@/application/worker/policy";
import type { GenerationEngine } from "@/application/generation";
import type { ProductionPorts } from "@/application/production/ports";
import type { ProductionDirector } from "@/application/production/production-director";
import type { FeatureFlagsSnapshot } from "@/infrastructure/config/feature-flags";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(__dirname, "..");
const EXPECTED_COMMIT = "39a79d20bfcde70fa03cc73721a256bf10694230";
const EXPECTED_COMMIT_SHORT = "39a79d2";
const AUTH = "AUTH_MV001_FINAL_PAID_SINGLE_CALL";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PROJECT_ID = "390c25db-69e1-403a-83c5-7afcb4b85e84";

/**
 * Vercel workers MUST stay OFF — local in-process worker claims the single job.
 * Motion/fal flags ON so local resolver + download gates can run.
 */
const ON_POLL = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  MOTION_TRANSFER_ENABLED: "1",
  MOTION_TRANSFER_PAID_ENABLED: "1",
  MOTION_TRANSFER_FAL_ENABLED: "1",
  MOTION_TRANSFER_WORKER_ENABLED: "0",
  MV001_REGISTRY_EXCEPTION_ACTIVE: "1",
  MV001_PRIVACY_PACK_ACCEPTED: "1",
  MV001_PRIVACY_EXPIRES_AT,
  MV001_BENCHMARK_ID: "MV-001",
  MV001_PROJECT_ID: PROJECT_ID,
  MV001_SOURCE_COMMIT: EXPECTED_COMMIT,
};

const OFF_ALL = {
  DIRECTOR_V2_PAID_AI_ENABLED: "0",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
  DIRECTOR_V2_ART_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
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
  throw Object.assign(new Error(msg), { name: "Mt013mResumeStop" });
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
  if (r.status === 0) return true;
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
  return r.status === 0;
}

function applyEnvMap(map: Record<string, string>) {
  let fails = 0;
  for (const [k, v] of Object.entries(map)) {
    if (!vercelEnvSet(k, v)) fails += 1;
    else console.log(`OK | ${k}=${v === "0" || v === "1" ? v : "[set]"}`);
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
  if (r.status !== 0) fail(`redeploy ${label} failed`);
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
    return {
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      assetId: row.id,
      role: "motion_provider_output" as const,
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
      return data ? toRecord(data) : null;
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
      return data ? toRecord(data) : null;
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
      if (input.bytes.byteLength === 0 || input.bytes.byteLength > DOWNLOAD_MAX_BYTES) {
        throw new Error("bytes invalid");
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

async function main() {
  if (process.env.CONFIRM_MT013M_RESUME_POLL_DRAIN !== "1") {
    console.error(
      JSON.stringify({
        ok: false,
        stop: true,
        reason: "Set CONFIRM_MT013M_RESUME_POLL_DRAIN=1",
      }),
    );
    process.exit(2);
  }

  loadEnvFile(join(studioRoot, ".env.local"), "fill");
  loadEnvFile(join(studioRoot, ".env.remote.local"), "override");

  let opened = false;
  let closed = false;
  let exitCode = 0;
  let deployOffHost = "";
  const report: Record<string, unknown> = {
    auth: AUTH,
    resume: true,
    newSubmitForbidden: true,
  };

  const closeAll = () => {
    if (closed) return;
    console.log("CLOSE_BEGIN resume-finally");
    applyEnvMap(OFF_ALL);
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
    if (!process.env.FAL_KEY?.trim()) fail("FAL_KEY absent");

    const client = createClient(
      process.env.MV001_SUPABASE_URL || process.env.SUPABASE_URL || "",
      process.env.MV001_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: jobs, error: jobsErr } = await client
      .from("production_jobs")
      .select("id, run_id, attempt_id, status, payload")
      .eq("project_id", PROJECT_ID);
    if (jobsErr) fail(jobsErr.message);
    if (!jobs || jobs.length !== 1) fail(`expected exactly 1 job, got ${jobs?.length ?? 0}`);
    const job = jobs[0]!;
    const motion = (job.payload as { motion?: Record<string, unknown>; externalJobId?: string; mode?: string })
      ?.motion;
    const externalJobId =
      (job.payload as { externalJobId?: string })?.externalJobId ||
      (motion?.providerJobId as string | undefined);
    const submitCount = Number(motion?.submitCount ?? 0);
    if (submitCount !== 1 || !externalJobId) {
      fail("resume requires durable submitCount=1 + providerJobId");
    }
    if ((job.payload as { mode?: string }).mode === "execute" && submitCount < 1) {
      fail("execute without submit — refuse");
    }
    report.providerJobIdRedacted = redactProviderJobId(externalJobId);
    report.jobId = String(job.id).slice(0, 8) + "…";
    report.phaseBefore = motion?.phase;
    report.submitCountBefore = submitCount;

    // Queue attempt_count/max_attempts = lease reclaim capacity, NOT generation_attempts.
    const { data: jobMeta } = await client
      .from("production_jobs")
      .select("attempt_count, max_attempts, status, error")
      .eq("id", job.id)
      .maybeSingle();
    const attemptsUsed = Number(jobMeta?.attempt_count ?? 1);
    const maxAttemptsNeeded = Math.max(attemptsUsed + 120, 200);
    report.queueAttemptsUsed = attemptsUsed;
    report.queueMaxAttempts = maxAttemptsNeeded;
    report.jobStatusBefore = jobMeta?.status;
    report.jobErrorBefore = (jobMeta?.error as { code?: string } | null)?.code ?? null;

    // Extend process deadline for same providerJobId (poll/drain only — no resubmit).
    const resumeDeadlineAt = new Date(Date.now() + 45 * 60 * 1000).toISOString();
    report.resumeDeadlineAt = resumeDeadlineAt;

    // Re-queue poll-only (even from failed) — never clears providerJobId / submitCount.
    const { error: unlockErr } = await client
      .from("production_jobs")
      .update({
        status: "queued",
        available_at: new Date().toISOString(),
        lease_token: null,
        leased_by: null,
        lease_expires_at: null,
        leased_at: null,
        heartbeat_at: null,
        completed_at: null,
        error: null,
        max_attempts: maxAttemptsNeeded,
        // Keep durable authority in payload; ensure mode remains poll.
        payload: {
          ...(job.payload as object),
          mode: "poll",
          externalJobId,
          motion: {
            ...(motion as object),
            submitCount: 1,
            phase: "polling",
            terminal: false,
            deadlineAt: resumeDeadlineAt,
            // Clear prior false terminal timeout latch for resume of same job.
            usageUnknown: false,
            reconciliationRequired: false,
            ledgerSettled: false,
          },
        },
      })
      .eq("id", job.id);
    if (unlockErr) fail(`job unlock failed: ${unlockErr.message}`);

    console.log("--- OPEN POLL/DRAIN WINDOW (local worker only, no new submit) ---");
    opened = true;
    const skipVercelOn = process.env.MT013M_SKIP_VERCEL_ON === "1";
    if (!skipVercelOn) {
      if (applyEnvMap(ON_POLL) > 0) fail("env ON failed");
      // Redeploy only for audit of Vercel flags; local executor uses envLocal.
      // Keep Vercel workers OFF so Production cannot steal the claim.
      redeployProd("ON");
      assertProductionCommit(EXPECTED_COMMIT_SHORT);
    } else {
      console.log("SKIP_VERCEL_ON=1 — local envLocal only; will still close OFF at end");
    }

    const queueRaw = createSupabaseProductionJobQueue({
      client: client as never,
      workspaceId: WORKSPACE_ID,
    });
    const queue = adaptProductionJobQueue(queueRaw);
    const budget = createSupabaseBudgetReservationPort({
      client: client as never,
      workspaceId: WORKSPACE_ID,
      resolveProjectIdForRun: async () => PROJECT_ID,
      correlationId: `corr-mt013m-resume-${Date.now()}`,
    });

    // Seed budget meta revision from active reservation (for commit/release).
    const { data: reservation } = await client
      .from("budget_reservations")
      .select("id, revision, status, amount_minor")
      .eq("project_id", PROJECT_ID)
      .eq("status", "active")
      .maybeSingle();
    if (reservation?.id) {
      budget._meta.set(reservation.id, {
        revision: reservation.revision ?? 1,
        projectId: PROJECT_ID,
      });
    }

    const attempts = createMemoryMotionTransferAttemptStore();
    const lifecycle = createMotionTransferLifecycleController();
    // Latch closed — poll only for existing job.
    lifecycle.onSubmitPersisted(job.attempt_id);

    const envLocal: Record<string, string | undefined> = {
      ...process.env,
      ...ON_POLL,
      DIRECTOR_V2_PAID_AI_ENABLED: "0",
      DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
      DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
      DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
      DIRECTOR_V2_ART_AI_ENABLED: "0",
      DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
      NODE_ENV: "production",
      VERCEL: undefined,
      VERCEL_ENV: undefined,
    };

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
      persistLeasedPayload: async (claimed, lease, payload) => {
        await queue.persistLeasedPayload!(
          claimed.jobId,
          lease.leaseToken,
          lease.workerId,
          payload,
        );
      },
      testDrain: {
        content: createSupabaseMotionAssetContentPort(client),
        persistence: createSupabaseMotionPersistence(client),
      },
    });

    const worker = createProductionWorkerFromDeps({
      policy: createWorkerPolicy({
        workerId: "mt013m-resume-1",
        claimLimit: 1,
        maximumJobsPerRun: 1,
        maximumProviderCallsPerRun: 2,
        leaseSeconds: 180,
        pollingDelayMs: 5_000,
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

    const correlationId = `corr-mt013m-resume-${Date.now()}`;
    let lastPhase = "";
    for (let i = 0; i < 120; i++) {
      const r = await worker.runOnce({
        correlationId,
        actorId: `${AUTH}-resume`,
        nowIso: () => new Date().toISOString(),
        nowMs: () => Date.now(),
        nextId: () => randomUUID(),
      });

      const { data: jobNow } = await client
        .from("production_jobs")
        .select("status, payload")
        .eq("id", job.id)
        .maybeSingle();
      const m = (jobNow?.payload as { motion?: Record<string, unknown> } | null)
        ?.motion;
      const att = attempts.get(job.attempt_id);
      const submitNow = Number(m?.submitCount ?? att?.submitCount ?? 0);
      if (submitNow > 1) fail("submitCount > 1 during resume — abort");
      if ((att?.resubmitCount ?? 0) > 0) fail("resubmit during resume");

      lastPhase = String(m?.phase ?? att?.phase ?? "");
      report.pollCount = m?.pollCount ?? att?.pollCount;
      report.phase = lastPhase;
      report.humanReviewHandoffStatus =
        m?.humanReviewHandoffStatus ?? att?.humanReviewHandoffStatus;
      report.ingestedAssetId = att?.ingestedAssetId
        ? String(att.ingestedAssetId).slice(0, 8) + "…"
        : m?.ingestedAssetId
          ? String(m.ingestedAssetId).slice(0, 8) + "…"
          : null;
      report.downloadChecksum = att?.downloadChecksum
        ? String(att.downloadChecksum).slice(0, 12) + "…"
        : null;
      report.ledgerSettled = m?.ledgerSettled ?? att?.ledgerSettled;
      report.reconciliationRequired =
        m?.reconciliationRequired ?? att?.reconciliationRequired;
      report.claimed = r.claimed;
      report.processed = r.processed;

      const hr =
        m?.humanReviewHandoffStatus === "seeded" ||
        att?.humanReviewHandoffStatus === "seeded";
      const terminal = m?.terminal === true || att?.terminal === true;
      if (hr || (terminal && lastPhase !== "polling" && lastPhase !== "submitted")) {
        break;
      }

      // Keep available_at near-now if still queued/polling (avoid stuck delay).
      if (jobNow?.status === "queued" && (lastPhase === "polling" || lastPhase === "provider_completed" || lastPhase === "qc_pending")) {
        await client
          .from("production_jobs")
          .update({ available_at: new Date().toISOString() })
          .eq("id", job.id);
      }

      await new Promise((res) => setTimeout(res, 10_000));
    }

    const { data: finalJob } = await client
      .from("production_jobs")
      .select("status, payload")
      .eq("id", job.id)
      .maybeSingle();
    const fm = (finalJob?.payload as { motion?: Record<string, unknown> })?.motion;
    report.submitCountAfter = fm?.submitCount ?? 1;
    report.jobStatus = finalJob?.status;
    report.verdict =
      fm?.humanReviewHandoffStatus === "seeded"
        ? "NEEDS_HUMAN_REVIEW"
        : fm?.terminal
          ? `TERMINAL_${fm.phase}`
          : "INCOMPLETE";

    if (fm?.humanReviewHandoffStatus === "seeded") {
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
          ingestedAssetId: fm.ingestedAssetId ?? null,
          providerJobIdRedacted: redactProviderJobId(externalJobId),
          auth: AUTH,
          automaticApproval: false,
          resume: true,
        },
        created_at: new Date().toISOString(),
        created_by: `${AUTH}-resume`,
        correlation_id: correlationId,
      });
    }

    mkdirSync(join(studioRoot, ".tmp"), { recursive: true });
    writeFileSync(
      join(studioRoot, ".tmp", "mt013m-resume-poll-drain.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    exitCode = 1;
    console.error(
      JSON.stringify({
        ok: false,
        stop: true,
        reason: e instanceof Error ? e.message : String(e),
      }),
    );
  } finally {
    if (opened) closeAll();
  }

  console.log(
    JSON.stringify(
      {
        ok: exitCode === 0,
        final: {
          runtimeMotion: "UNAVAILABLE",
          deployOffHost: deployOffHost || null,
          verdict: report.verdict,
        },
      },
      null,
      2,
    ),
  );
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, reason: String(e) }));
  process.exit(1);
});
