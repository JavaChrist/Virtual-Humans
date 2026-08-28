/**
 * Phase 189 — logical rollback: keep local Supabase, start a persistence-OFF
 * UI-only app process, prove routes 404 and the fixture row remains.
 * Never prints secrets. Never stops Docker / volumes.
 */
import { createClient } from "@supabase/supabase-js";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const port = "3114";
const origin = `http://127.0.0.1:${port}`;
const PHASE = "vhs-persistence-recheck-189-rollback";

function fail(message) {
  console.error(`189-rollback: ${message}`);
  process.exit(1);
}

function readLocalStatus() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const status = spawnSync(npx, ["supabase", "status", "-o", "env"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (status.status !== 0) fail("Supabase local indisponible.");
  const map = {};
  for (const line of status.stdout.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) map[match[1]] = match[2].replace(/^"|"$/g, "");
  }
  return map;
}

const runtimePath = join(root, ".e2e-runtime.json");
if (!existsSync(join(root, ".next"))) fail("Build local manquant (`npm run build`).");
if (!existsSync(join(root, ".e2e-server-off.env"))) fail("e2e-prepare manquant.");
if (!existsSync(runtimePath)) fail(".e2e-runtime.json manquant.");

const runtime = JSON.parse(readFileSync(runtimePath, "utf8"));
const local = readLocalStatus();
let url = local.API_URL || local.SUPABASE_URL || "";
if (!url && local.STORAGE_S3_URL) {
  try {
    url = new URL(local.STORAGE_S3_URL).origin;
  } catch {
    url = "";
  }
}
const serviceRoleKey = local.SERVICE_ROLE_KEY || local.SECRET_KEY;
if (!url || !serviceRoleKey) fail("status local incomplet.");
const host = new URL(url).hostname;
if (host !== "127.0.0.1" && host !== "localhost") fail(`hôte non local (${host}).`);

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const workspaceId = randomUUID();
const projectId = randomUUID();
const artifactId = randomUUID();
const now = "2026-08-28T09:20:00.000Z";

const { error: wsErr } = await client.from("workspaces").insert({
  id: workspaceId,
  slug: `${PHASE}-${workspaceId.slice(0, 8)}`,
  name: PHASE,
  mode: "single_workspace",
});
if (wsErr) fail(`workspace: ${wsErr.message}`);
await client.from("workspace_budget_policies").insert({
  workspace_id: workspaceId,
  hard_limit_minor: 50_000,
  currency: "USD",
});

const created = await client.rpc("create_director_project_with_brief", {
  p_workspace_id: workspaceId,
  p_project_id: projectId,
  p_artifact_id: artifactId,
  p_project_name: "Rollback 189",
  p_brief: {
    id: artifactId,
    projectId,
    projectName: "Rollback 189",
    subjectType: "product",
    subjectName: "Widget rollback",
    subjectDescription: "Fixture rollback logique 189.",
    objective: "awareness",
    platform: "instagram",
    durationSeconds: 30,
    aspectRatio: "9:16",
    language: "fr",
    tone: "warm",
    mediaReferences: [],
    schemaVersion: "1.0.0",
    revision: 1,
    createdAt: now,
    createdBy: "tester-189",
    correlationId: PHASE,
  },
  p_schema_version: "1.0.0",
  p_correlation_id: PHASE,
  p_actor_type: "shared_password",
  p_actor_id: "tester-189",
  p_created_by: "tester-189",
});
if (created.error) fail(`RPC create: ${created.error.message}`);

const child = spawn(process.execPath, ["scripts/e2e-start-server.mjs", "--ui-only", `--port=${port}`], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env },
});

let ready = false;
const started = Date.now();
while (Date.now() - started < 60_000) {
  try {
    const res = await fetch(`${origin}/login`, { redirect: "manual" });
    if (res.status > 0 && res.status < 500) {
      ready = true;
      break;
    }
  } catch {
    /* keep waiting */
  }
  await delay(1000);
}
if (!ready) {
  child.kill();
  fail("serveur ui-only 3114 non prêt.");
}

try {
  const login = await fetch(`${origin}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ password: runtime.appPassword }),
    redirect: "manual",
  });
  if (login.status !== 200) fail(`login ui-only=${login.status}`);
  const cookie = login.headers.get("set-cookie") ?? "";
  if (!cookie) fail("cookie session absent.");

  const list = await fetch(`${origin}/api/director/projects`, {
    headers: { cookie, origin },
  });
  if (list.status !== 404) fail(`list persistence OFF attendu 404, obtenu ${list.status}`);

  const get = await fetch(`${origin}/api/director/projects/${projectId}`, {
    headers: { cookie, origin },
  });
  if (get.status !== 404) fail(`get persistence OFF attendu 404, obtenu ${get.status}`);

  const wizard = await fetch(`${origin}/director/new`, {
    headers: { cookie, origin },
    redirect: "manual",
  });
  const html = await wizard.text();
  if (!/Valider le brief|Nouveau brief|Créer une vidéo/i.test(html)) {
    fail("wizard persistence OFF introuvable.");
  }
  if (/openai|elevenlabs|fal\.ai|kling|runway/i.test(html)) {
    fail("provider visible en persistence OFF.");
  }

  const { data, error } = await client
    .from("video_projects")
    .select("id, workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) fail(`select after rollback: ${error.message}`);
  if (!data || data.workspace_id !== workspaceId) fail("projet local perdu après rollback logique.");

  console.log(
    JSON.stringify({
      PHASE,
      LOCAL_ROLLBACK_PROCESS: "ui-only-3114",
      PERSISTENCE_ROUTES: 404,
      PROJECT_PRESERVED: 1,
      PROJECT_DELETED: 0,
      PROVIDERS_VISIBLE: 0,
    }),
  );
} finally {
  child.kill();
  const tables = [
    "project_artifacts",
    "active_artifact_revisions",
    "video_projects",
    "workspace_budget_policies",
    "workspaces",
  ];
  for (const t of tables) {
    await client.from(t).delete().eq(t === "workspaces" ? "id" : "workspace_id", workspaceId);
  }
}
