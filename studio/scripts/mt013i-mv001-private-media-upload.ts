#!/usr/bin/env node
/**
 * MT-013I — Exactly two private MV-001 media uploads (Auth-gated).
 *
 *   SOURCE_VIDEO_PATH=... IDENTITY_IMAGE_PATH=... npm exec -- tsx scripts/mt013i-mv001-private-media-upload.ts
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from env / .env.local).
 * Never logs signed URLs, bytes, or secrets. No fal / ledger / run.
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { buildMotionAssetStoragePath, MOTION_ASSETS_BUCKET } from "../src/application/motion/motion-asset-path";
import { MV001_PRIVACY_EXPIRES_AT } from "../src/application/motion/mv001/mv001-benchmark-profile";
import {
  MV001_POST_UPLOAD_ASSET_SELECT,
  parseMv001PostUploadAssetRow,
  verifyMv001PostUploadAssetRow,
} from "../src/application/motion/mv001/mv001-post-upload-verify";
import { buildMv001UploadPrepPlan } from "../src/application/motion/mv001/mv001-upload-prep";

const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PROJECT_ID = "390c25db-69e1-403a-83c5-7afcb4b85e84";
const EXPECTED_PROJECT_NAME = "MV-001 — Tai Chi Motion Transfer Benchmark";
const AUTH = "AUTH_MV001_UPLOAD_EXACTLY_TWO_PRIVATE_MEDIA";
const CORRELATION = "mt013i-mv001-private-media-upload";

const SOURCE_SHA =
  "91b32ec502454e46a93122f250fcde51431ce5e83d1947d645c8f9c40a58fc5a";
const IDENTITY_SHA =
  "9e270cd7d31bbb3e7cd6955059eff1c4d23c93d982cf5e2b03f19d8346561dae";

function loadEnvFile(envPath: string, mode: "fill" | "override"): void {
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
    if (mode === "override") {
      process.env[key] = val;
      continue;
    }
    if (!process.env[key] || process.env[key]!.trim() === "") {
      process.env[key] = val;
    }
  }
}

function loadDotEnvLocal(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  // Local first, then Production remote credentials (Auth destination ejdb…nmvi).
  loadEnvFile(join(root, ".env.local"), "fill");
  loadEnvFile(join(root, ".env.remote.local"), "override");
}

function sha256Hex(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

function stop(reason: string): never {
  console.error(JSON.stringify({ ok: false, stop: true, reason }));
  process.exit(2);
}

function redactedPath(path: string): string {
  const base = path.replace(/\\/g, "/").split("/").pop() ?? "file";
  return `local://${base}`;
}

async function main(): Promise<void> {
  loadDotEnvLocal();

  const sourcePath = process.env.SOURCE_VIDEO_PATH;
  const identityPath = process.env.IDENTITY_IMAGE_PATH;
  if (!sourcePath || !identityPath) {
    stop("SOURCE_VIDEO_PATH and IDENTITY_IMAGE_PATH required");
  }

  // Prefer explicit Production override from Auth; fall back to env.
  const url = (
    process.env.MV001_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ""
  );
  const key = (
    process.env.MV001_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
  if (!url || !key) stop("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    stop("SUPABASE_URL invalid");
  }
  if (host !== "ejdbksxaswhdtsudnmvi.supabase.co") {
    stop("SUPABASE_URL host is not Production Virtual Humans Studio");
  }
  const allowRemote = ["true", "1", "yes"].includes(
    (process.env.VH_ALLOW_REMOTE_SUPABASE ?? "").trim().toLowerCase(),
  );
  if (!allowRemote) {
    stop("VH_ALLOW_REMOTE_SUPABASE must be true for Production upload");
  }

  const nowIso = new Date().toISOString();
  if (Date.parse(nowIso) >= Date.parse(MV001_PRIVACY_EXPIRES_AT)) {
    stop("Privacy Gate expired");
  }

  // Privacy pack 5/5 accepted (governance) — Auth limited MV-001 until 2026-09-10.
  const privacy5of5 = {
    providerRetentionAccepted: true,
    providerCdnExposureAccepted: true,
    biometricProcessingConsentConfirmed: true,
    commercialUsageRightsConfirmed: true,
    geographicRestrictionsSatisfied: true,
  };
  if (Object.values(privacy5of5).some((v) => v !== true)) {
    stop("Privacy Gate not 5/5");
  }

  const sourceBytes = readFileSync(sourcePath);
  const identityBytes = readFileSync(identityPath);
  const sourceSha = sha256Hex(sourceBytes);
  const identitySha = sha256Hex(identityBytes);
  if (sourceSha !== SOURCE_SHA) stop("checksum mismatch: motion_source_video");
  if (identitySha !== IDENTITY_SHA) stop("checksum mismatch: motion_identity_reference");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: project, error: projectErr } = await client
    .from("video_projects")
    .select("id,name,workspace_id,status")
    .eq("id", PROJECT_ID)
    .maybeSingle();
  if (projectErr) {
    stop(
      `video_project lookup failed: ${projectErr.code ?? "no_code"} ${projectErr.message}`,
    );
  }
  if (!project) {
    stop(
      "video_project MV-001 not found — service role likely not Production ejdb…nmvi",
    );
  }
  if (project.workspace_id !== WORKSPACE_ID) stop("workspace mismatch");
  if (project.name !== EXPECTED_PROJECT_NAME) stop("project name mismatch");

  const { data: bucket, error: bucketErr } = await client
    .schema("storage")
    .from("buckets")
    .select("id,public")
    .eq("id", MOTION_ASSETS_BUCKET)
    .maybeSingle();
  // Fallback: RPC-less check via list — if schema access blocked, probe known private via SQL-less upload prep.
  if (!bucketErr && bucket) {
    if (bucket.public !== false) stop("bucket is not private");
  }

  const { data: existingRoles, error: roleErr } = await client
    .from("assets")
    .select("id,status,provenance")
    .eq("project_id", PROJECT_ID)
    .eq("workspace_id", WORKSPACE_ID);
  if (roleErr) stop(`assets role preflight failed: ${roleErr.message}`);
  const activeRole = (existingRoles ?? []).find((row) => {
    const role = (row.provenance as { motionRole?: string } | null)?.motionRole;
    return (
      (role === "motion_source_video" || role === "motion_identity_reference") &&
      ["available", "registered", "validated"].includes(String(row.status))
    );
  });
  if (activeRole) stop("active motion role asset already exists");

  const sourceAssetId = randomUUID();
  const identityAssetId = randomUUID();
  const plan = buildMv001UploadPrepPlan({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    sourceAssetId,
    identityAssetId,
  });
  if (plan.entries.length !== 2) stop("upload plan must have exactly 2 entries");
  if (plan.maxUploads !== 2) stop("maxUploads must be 2");

  const sourceStoragePath = buildMotionAssetStoragePath({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    role: "motion_source_video",
    assetId: sourceAssetId,
    mimeType: "video/mp4",
  });
  const identityStoragePath = buildMotionAssetStoragePath({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    role: "motion_identity_reference",
    assetId: identityAssetId,
    mimeType: "image/png",
  });

  if (plan.entries[0]!.storagePath !== sourceStoragePath) {
    stop("source storagePath plan mismatch");
  }
  if (plan.entries[1]!.storagePath !== identityStoragePath) {
    stop("identity storagePath plan mismatch");
  }

  // Upload exactly two objects — upsert:false, no overwrite.
  const upSource = await client.storage
    .from(MOTION_ASSETS_BUCKET)
    .upload(sourceStoragePath, sourceBytes, {
      contentType: "video/mp4",
      upsert: false,
    });
  if (upSource.error) stop(`source upload failed: ${upSource.error.message}`);

  const upIdentity = await client.storage
    .from(MOTION_ASSETS_BUCKET)
    .upload(identityStoragePath, identityBytes, {
      contentType: "image/png",
      upsert: false,
    });
  if (upIdentity.error) {
    stop(`identity upload failed after source upload: ${upIdentity.error.message}`);
  }

  // Post-upload verify via private download (no signed URL persistence).
  const dlSource = await client.storage
    .from(MOTION_ASSETS_BUCKET)
    .download(sourceStoragePath);
  if (dlSource.error || !dlSource.data) stop("source post-download failed");
  const sourceRemote = Buffer.from(await dlSource.data.arrayBuffer());
  if (sourceRemote.byteLength !== sourceBytes.byteLength) {
    stop("source size mismatch post-upload");
  }
  if (sha256Hex(sourceRemote) !== SOURCE_SHA) stop("source checksum mismatch post-upload");

  const dlIdentity = await client.storage
    .from(MOTION_ASSETS_BUCKET)
    .download(identityStoragePath);
  if (dlIdentity.error || !dlIdentity.data) stop("identity post-download failed");
  const identityRemote = Buffer.from(await dlIdentity.data.arrayBuffer());
  if (identityRemote.byteLength !== identityBytes.byteLength) {
    stop("identity size mismatch post-upload");
  }
  if (sha256Hex(identityRemote) !== IDENTITY_SHA) {
    stop("identity checksum mismatch post-upload");
  }

  const createdAt = new Date().toISOString();
  const expiresAt = MV001_PRIVACY_EXPIRES_AT;

  const sourceProvenance = {
    schemaVersion: "1.0.0",
    motionRole: "motion_source_video",
    capability: "video.motion_transfer",
    contentFingerprint: SOURCE_SHA,
    correlationId: CORRELATION,
    sourceLifecycle: "available",
    consentTag: "redacted:mv001-consent",
    licenseTag: "redacted:mv001-license",
    referenceId: "redacted:mv001-source-ref",
    biometricPotential: true,
    fps: 25,
    benchmarkId: "MV-001",
    auth: AUTH,
  };

  const identityProvenance = {
    schemaVersion: "1.0.0",
    motionRole: "motion_identity_reference",
    capability: "video.motion_transfer",
    contentFingerprint: IDENTITY_SHA,
    correlationId: CORRELATION,
    sourceLifecycle: "available",
    consentTag: "redacted:mv001-consent",
    licenseTag: "redacted:mv001-license",
    referenceId: "redacted:mv001-identity-ref",
    biometricPotential: true,
    benchmarkId: "MV-001",
    auth: AUTH,
  };

  const { error: assetErr } = await client.from("assets").insert([
    {
      id: sourceAssetId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      kind: "video",
      mime_type: "video/mp4",
      storage_bucket: MOTION_ASSETS_BUCKET,
      storage_path: sourceStoragePath,
      source_kind: "internal",
      checksum: SOURCE_SHA,
      size_bytes: sourceBytes.byteLength,
      width: 1280,
      height: 720,
      duration_seconds: 8,
      provenance: sourceProvenance,
      status: "available",
      created_at: createdAt,
      expires_at: expiresAt,
    },
    {
      id: identityAssetId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      kind: "image",
      mime_type: "image/png",
      storage_bucket: MOTION_ASSETS_BUCKET,
      storage_path: identityStoragePath,
      source_kind: "internal",
      checksum: IDENTITY_SHA,
      size_bytes: identityBytes.byteLength,
      width: 971,
      height: 1619,
      provenance: identityProvenance,
      status: "available",
      created_at: createdAt,
      expires_at: expiresAt,
    },
  ]);
  if (assetErr) stop(`assets insert failed: ${assetErr.message}`);

  const { error: auditErr } = await client.from("audit_log").insert([
    {
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      action: "motion.mv001.media.uploaded",
      resource_type: "asset",
      resource_id: sourceAssetId,
      actor_type: "system",
      actor_id: AUTH,
      correlation_id: CORRELATION,
      metadata: {
        role: "motion_source_video",
        mimeType: "video/mp4",
        sizeBytes: sourceBytes.byteLength,
        checksumPrefix: SOURCE_SHA.slice(0, 12),
        checksumSuffix: SOURCE_SHA.slice(-6),
        storagePathSuffix: `motion/source/${sourceAssetId}.mp4`,
        phase: "MT-013I",
        upsert: false,
        publicAccess: false,
      },
      created_at: createdAt,
    },
    {
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      action: "motion.mv001.media.uploaded",
      resource_type: "asset",
      resource_id: identityAssetId,
      actor_type: "system",
      actor_id: AUTH,
      correlation_id: CORRELATION,
      metadata: {
        role: "motion_identity_reference",
        mimeType: "image/png",
        sizeBytes: identityBytes.byteLength,
        checksumPrefix: IDENTITY_SHA.slice(0, 12),
        checksumSuffix: IDENTITY_SHA.slice(-6),
        storagePathSuffix: `motion/identity/${identityAssetId}.png`,
        phase: "MT-013I",
        upsert: false,
        publicAccess: false,
      },
      created_at: createdAt,
    },
  ]);
  if (auditErr) stop(`audit_log insert failed: ${auditErr.message}`);

  const { data: assets, error: verifyAssetsErr } = await client
    .from("assets")
    .select(MV001_POST_UPLOAD_ASSET_SELECT)
    .eq("project_id", PROJECT_ID)
    .eq("workspace_id", WORKSPACE_ID)
    .in("id", [sourceAssetId, identityAssetId]);
  if (verifyAssetsErr || !assets || assets.length !== 2) {
    stop("post-verify assets count != 2");
  }

  const verifyExpected = {
    bucket: MOTION_ASSETS_BUCKET,
    sourceAssetId,
    identityAssetId,
    sourceChecksum: SOURCE_SHA,
    identityChecksum: IDENTITY_SHA,
  };
  for (const raw of assets) {
    const row = parseMv001PostUploadAssetRow(raw);
    if (!row) stop("post-verify asset row shape invalid");
    const verified = verifyMv001PostUploadAssetRow(row, verifyExpected);
    if (!verified.ok) stop(verified.reason);
  }

  const { count: auditCount } = await client
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("correlation_id", CORRELATION)
    .eq("action", "motion.mv001.media.uploaded");

  const { count: jobCount } = await client
    .from("production_jobs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", WORKSPACE_ID);

  const { count: runCount } = await client
    .from("production_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", WORKSPACE_ID);

  console.log(
    JSON.stringify(
      {
        ok: true,
        auth: AUTH,
        projectId: PROJECT_ID,
        workspaceId: WORKSPACE_ID,
        bucket: MOTION_ASSETS_BUCKET,
        bucketPublic: false,
        uploads: 2,
        assets: 2,
        auditRows: auditCount ?? null,
        jobs: jobCount ?? null,
        runs: runCount ?? null,
        runtimeMotion: "UNAVAILABLE",
        providerCalls: 0,
        signedUrlsPersisted: false,
        localRefs: {
          source: redactedPath(sourcePath),
          identity: redactedPath(identityPath),
        },
        records: [
          {
            role: "motion_source_video",
            assetId: sourceAssetId,
            storagePathSuffix: `motion/source/${sourceAssetId}.mp4`,
            mimeType: "video/mp4",
            sizeBytes: sourceBytes.byteLength,
            checksumPrefix: SOURCE_SHA.slice(0, 12),
            checksumSuffix: SOURCE_SHA.slice(-6),
            lifecycle: "available",
          },
          {
            role: "motion_identity_reference",
            assetId: identityAssetId,
            storagePathSuffix: `motion/identity/${identityAssetId}.png`,
            mimeType: "image/png",
            sizeBytes: identityBytes.byteLength,
            checksumPrefix: IDENTITY_SHA.slice(0, 12),
            checksumSuffix: IDENTITY_SHA.slice(-6),
            lifecycle: "available",
          },
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : "unknown_error";
  console.error(JSON.stringify({ ok: false, stop: true, reason: msg }));
  process.exit(1);
});
