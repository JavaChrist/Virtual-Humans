/**
 * Prints only hosts / flags / presence — never secret values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const envLocal = path.join(root, ".env.local");
const envRemote = path.join(root, ".env.remote.local");
const map = parseEnv(fs.readFileSync(envLocal, "utf8"));

const urlRaw = stripQuotes(map.get("SUPABASE_URL"));
if (!urlRaw) {
  console.log("SUPABASE_URL=MISSING");
} else {
  try {
    const u = new URL(urlRaw);
    console.log(`SUPABASE_URL_HOST=${u.hostname}`);
    console.log(`SUPABASE_URL_PORT=${u.port || "(default)"}`);
  } catch {
    console.log("SUPABASE_URL=INVALID");
  }
}

for (const k of [
  "DIRECTOR_V2_ENABLED",
  "DIRECTOR_V2_PERSISTENCE_ENABLED",
  "VH_ALLOW_REMOTE_SUPABASE",
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_PAID_AI_ENABLED",
]) {
  console.log(`${k}=${map.has(k) ? map.get(k) : "MISSING"}`);
}

for (const k of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "FAL_KEY",
  "APP_PASSWORD",
  "APP_SESSION_SECRET",
]) {
  const v = stripQuotes(map.get(k));
  console.log(`${k}=${v ? "PRESENT" : "MISSING"}`);
}

console.log(`remote_file_exists=${fs.existsSync(envRemote)}`);
if (fs.existsSync(envRemote)) {
  const remote = parseEnv(fs.readFileSync(envRemote, "utf8"));
  for (const k of remote.keys()) console.log(`REMOTE_KEY=${k}`);
  const rUrl = stripQuotes(remote.get("SUPABASE_URL"));
  try {
    console.log(`REMOTE_SUPABASE_HOST=${new URL(rUrl).hostname}`);
  } catch {
    console.log("REMOTE_SUPABASE_HOST=INVALID_OR_MISSING");
  }
}
