/**
 * Phase 10A-B — archive Production Supabase credentials out of .env.local
 * into gitignored `.env.remote.local` (NOT auto-loaded by Next), then repair
 * `.env.local` to Docker defaults via fix-env-local-docker.mjs.
 *
 * Never prints secret values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envLocal = path.join(root, ".env.local");
const envRemote = path.join(root, ".env.remote.local");

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

function stripQuotes(v) {
  return String(v ?? "").replace(/^['"]|['"]$/g, "");
}

if (!fs.existsSync(envLocal)) {
  console.error(".env.local absent — rien à neutraliser.");
  process.exit(1);
}

const map = parseEnv(fs.readFileSync(envLocal, "utf8"));
const url = stripQuotes(map.get("SUPABASE_URL"));
let host = "";
try {
  host = new URL(url).hostname;
} catch {
  host = "";
}

if (host.endsWith(".supabase.co")) {
  const lines = [
    "# Phase 10A-B — credentials Production PRESERVED (gitignored).",
    "# NOT loaded by Next.js automatically. Manual / intentional use only.",
    "# Requires VH_ALLOW_REMOTE_SUPABASE=1 in the process that imports these.",
    `SUPABASE_URL=${map.get("SUPABASE_URL") ?? ""}`,
    `SUPABASE_SERVICE_ROLE_KEY=${map.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
  ];
  if (map.has("DIRECTOR_V2_WORKSPACE_ID")) {
    lines.push(`DIRECTOR_V2_WORKSPACE_ID=${map.get("DIRECTOR_V2_WORKSPACE_ID")}`);
  }
  lines.push("");
  fs.writeFileSync(envRemote, lines.join("\n"), "utf8");
  console.log("WROTE .env.remote.local (gitignored)");
} else {
  console.log("SUPABASE_URL already non-remote — skip writing .env.remote.local");
}

const fix = path.join(__dirname, "fix-env-local-docker.mjs");
const r = spawnSync(process.execPath, [fix], { cwd: root, stdio: "inherit" });
process.exit(r.status ?? 1);
