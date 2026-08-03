/**
 * Prepare local E2E env + seed an e2e-* workspace (Phase 8).
 * Local Supabase only. Never prints secrets.
 *
 * Usage (from studio/):
 *   node scripts/e2e-prepare.mjs           # fresh workspace + secrets
 *   node scripts/e2e-prepare.mjs --ensure  # reuse secrets; upsert budget policy
 *
 * Writes studio/.e2e-runtime.json (gitignored).
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(__dirname, "..");
const ensureOnly = process.argv.includes("--ensure");

function fail(msg) {
  console.error(`e2e-prepare: ${msg}`);
  process.exit(1);
}

function readLocalStatus() {
  let raw;
  try {
    raw = execSync("npx supabase status -o env", {
      encoding: "utf8",
      cwd: studioRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail("Impossible de lire `npx supabase status`. Démarrez Supabase local.");
  }
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return map;
}

function writeEnvFiles(runtime) {
  const envLines = [
    `NODE_ENV=production`,
    `DIRECTOR_V2_E2E_HARNESS=1`,
    `APP_PASSWORD=${runtime.appPassword}`,
    `APP_SESSION_SECRET=${runtime.sessionSecret}`,
    `DIRECTOR_V2_ENABLED=1`,
    `DIRECTOR_V2_PERSISTENCE_ENABLED=1`,
    `DIRECTOR_V2_E2E_FAKE_MODE=1`,
    `DIRECTOR_V2_WORKER_ENABLED=1`,
    // Test-only: worker fake path needs generation flag in the E2E process only.
    `DIRECTOR_V2_PAID_GENERATION_ENABLED=1`,
    `DIRECTOR_V2_WORKER_SECRET=${runtime.workerSecret}`,
    `DIRECTOR_V2_WORKSPACE_ID=${runtime.workspaceId}`,
    `SUPABASE_URL=${runtime.supabaseUrl}`,
    `SUPABASE_SERVICE_ROLE_KEY=${runtime.serviceRoleKey}`,
    `OPENAI_API_KEY=`,
    `FAL_KEY=`,
    `ELEVENLABS_API_KEY=`,
    `AICCOS_IMPORT_TOKEN=`,
    `DIRECTOR_V2_MARKETING_AI_ENABLED=0`,
    `DIRECTOR_V2_CREATIVE_AI_ENABLED=0`,
    `DIRECTOR_V2_SCRIPT_AI_ENABLED=0`,
    `DIRECTOR_V2_ART_AI_ENABLED=0`,
    `DIRECTOR_V2_STORYBOARD_AI_ENABLED=0`,
    `DIRECTOR_V2_PAID_AI_ENABLED=0`,
    `OPENAI_MARKETING_MODEL=e2e-fake-deterministic`,
    `OPENAI_CREATIVE_MODEL=e2e-fake-deterministic`,
    `OPENAI_SCRIPT_MODEL=e2e-fake-deterministic`,
    `OPENAI_ART_MODEL=e2e-fake-deterministic`,
    `OPENAI_STORYBOARD_MODEL=e2e-fake-deterministic`,
  ].join("\n");

  writeFileSync(join(studioRoot, ".e2e-server.env"), envLines + "\n", "utf8");

  const offEnv = envLines
    .split("\n")
    .map((l) => (l.startsWith("DIRECTOR_V2_ENABLED=") ? "DIRECTOR_V2_ENABLED=0" : l))
    .map((l) =>
      l.startsWith("DIRECTOR_V2_PERSISTENCE_ENABLED=")
        ? "DIRECTOR_V2_PERSISTENCE_ENABLED=0"
        : l,
    )
    .join("\n");
  writeFileSync(join(studioRoot, ".e2e-server-off.env"), offEnv + "\n", "utf8");
}

const status = readLocalStatus();
const url = process.env.SUPABASE_LOCAL_URL || status.API_URL;
const serviceKey =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY || status.SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("URL ou SERVICE_ROLE_KEY local introuvable.");

let host;
try {
  host = new URL(url).hostname;
} catch {
  fail("URL Supabase invalide.");
}
if (host !== "127.0.0.1" && host !== "localhost") {
  fail(`URL non locale refusée (host=${host}).`);
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runtimePath = join(studioRoot, ".e2e-runtime.json");
let runtime;

if (ensureOnly && existsSync(runtimePath)) {
  runtime = JSON.parse(readFileSync(runtimePath, "utf8"));
  runtime.supabaseUrl = url;
  runtime.serviceRoleKey = serviceKey;
  if (!runtime.workspaceId || !runtime.appPassword || !runtime.sessionSecret) {
    fail("runtime.json incomplet — relancer sans --ensure.");
  }

  const { data: ws } = await client
    .from("workspaces")
    .select("id, slug")
    .eq("id", runtime.workspaceId)
    .maybeSingle();

  if (!ws) {
    const slug = runtime.workspaceSlug?.startsWith("e2e-")
      ? runtime.workspaceSlug
      : `e2e-${runtime.workspaceId.slice(0, 8)}`;
    const { error: wErr } = await client.from("workspaces").insert({
      id: runtime.workspaceId,
      slug,
      name: `E2E ${slug}`,
      mode: "single_workspace",
    });
    if (wErr) fail(`workspace re-insert: ${wErr.message}`);
    runtime.workspaceSlug = slug;
  } else if (!String(ws.slug).startsWith("e2e-")) {
    fail(`workspace slug non E2E refusé: ${ws.slug}`);
  }
} else {
  const workspaceId = randomUUID();
  const slug = `e2e-${workspaceId.slice(0, 8)}`;
  runtime = {
    createdAt: new Date().toISOString(),
    workspaceId,
    workspaceSlug: slug,
    supabaseUrl: url,
    appPassword: `e2e-password-${randomBytes(8).toString("hex")}`,
    sessionSecret: `e2e-session-secret-${randomBytes(24).toString("hex")}`,
    workerSecret: `e2e-worker-secret-${randomBytes(16).toString("hex")}`,
    serviceRoleKey: serviceKey,
    baseURL: "http://127.0.0.1:3100",
    directorOffURL: "http://127.0.0.1:3110",
  };

  const { error: wErr } = await client.from("workspaces").insert({
    id: workspaceId,
    slug,
    name: `E2E ${slug}`,
    mode: "single_workspace",
  });
  if (wErr) fail(`workspace insert: ${wErr.message}`);
}

const { error: bErr } = await client.from("workspace_budget_policies").upsert(
  {
    workspace_id: runtime.workspaceId,
    hard_limit_minor: 1_000_000,
    currency: "USD",
  },
  { onConflict: "workspace_id" },
);
if (bErr) fail(`budget policy: ${bErr.message}`);

// Drain queued/leased jobs on e2e-* workspaces only — claim RPC is global and
// leftover synthetic jobs from prior runs starve the current workspace worker.
{
  const { data: e2eWorkspaces, error: wsListErr } = await client
    .from("workspaces")
    .select("id, slug")
    .like("slug", "e2e-%");
  if (wsListErr) fail(`list e2e workspaces: ${wsListErr.message}`);
  for (const ws of e2eWorkspaces ?? []) {
    if (!String(ws.slug).startsWith("e2e-")) continue;
    const { error: drainErr } = await client
      .from("production_jobs")
      .delete()
      .eq("workspace_id", ws.id)
      .in("status", ["queued", "leased"]);
    if (drainErr) {
      console.warn(
        `e2e-prepare: drain jobs ${ws.slug}: ${drainErr.message}`,
      );
    }
  }
}

writeFileSync(runtimePath, JSON.stringify(runtime, null, 2), "utf8");
writeEnvFiles(runtime);

console.log(
  `e2e-prepare: workspace ${runtime.workspaceSlug} prêt (${ensureOnly ? "ensure" : "fresh"}).`,
);
