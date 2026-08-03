/**
 * Seed a local V2 workspace for Director persistence (VHS-116).
 *
 * Local only — refuses non-localhost URLs. Never prints secrets.
 *
 * Usage (from studio/):
 *   $env:CONFIRM_SEED_WORKSPACE="1"
 *   npm run supabase:seed-workspace
 *
 * Optional:
 *   DIRECTOR_V2_WORKSPACE_ID=<uuid>  — reuse a fixed id (idempotent)
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

function fail(msg) {
  console.error(`seed-local-workspace: ${msg}`);
  process.exit(1);
}

if (process.env.CONFIRM_SEED_WORKSPACE !== "1") {
  fail(
    'Confirmation requise. Définissez CONFIRM_SEED_WORKSPACE=1 puis relancez.'
  );
}

function readLocalStatus() {
  let raw;
  try {
    raw = execSync("npx supabase status -o env", {
      encoding: "utf8",
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

const status = readLocalStatus();
const url = process.env.SUPABASE_LOCAL_URL || status.API_URL;
const serviceKey =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY || status.SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  fail("URL ou SERVICE_ROLE_KEY local introuvable.");
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  fail("URL Supabase invalide.");
}
if (host !== "127.0.0.1" && host !== "localhost") {
  fail(`URL non locale refusée (host=${host}). Aucun fallback distant.`);
}

const workspaceId =
  process.env.DIRECTOR_V2_WORKSPACE_ID?.trim() || randomUUID();
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    workspaceId
  )
) {
  fail("DIRECTOR_V2_WORKSPACE_ID invalide (UUID attendu).");
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing, error: loadErr } = await client
  .from("workspaces")
  .select("id, slug, name")
  .eq("id", workspaceId)
  .maybeSingle();

if (loadErr) fail(`lecture workspace: ${loadErr.message}`);

if (existing) {
  console.log("Workspace local déjà présent (idempotent).");
  console.log(`DIRECTOR_V2_WORKSPACE_ID=${existing.id}`);
  console.log(`slug=${existing.slug}`);
  process.exit(0);
}

const slug = `dev-${workspaceId.slice(0, 8)}`;
const { error: insertErr } = await client.from("workspaces").insert({
  id: workspaceId,
  slug,
  name: "Director V2 Dev",
  mode: "single_workspace",
});
if (insertErr) fail(`insert workspace: ${insertErr.message}`);

const { error: budgetErr } = await client.from("workspace_budget_policies").insert({
  workspace_id: workspaceId,
  hard_limit_minor: 100_000,
  currency: "USD",
});
if (budgetErr) fail(`insert budget policy: ${budgetErr.message}`);

console.log("Workspace local créé.");
console.log(`DIRECTOR_V2_WORKSPACE_ID=${workspaceId}`);
console.log("Ajoutez cet UUID dans studio/.env.local (ne pas committer).");
console.log("Activez DIRECTOR_V2_ENABLED=1 et DIRECTOR_V2_PERSISTENCE_ENABLED=1 pour tester.");
