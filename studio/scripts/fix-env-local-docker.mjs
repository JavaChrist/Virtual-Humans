/**
 * Repair .env.local after a partial neutralize: ensure Docker Supabase
 * target + safe Director defaults. Preserves other keys. Never prints secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocal = path.join(root, ".env.local");

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5OX0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const REQUIRED = {
  SUPABASE_URL: LOCAL_URL,
  SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE,
  DIRECTOR_V2_ENABLED: "0",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
  DIRECTOR_V2_PAID_AI_ENABLED: "0",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
  DIRECTOR_V2_ART_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
  VH_ALLOW_REMOTE_SUPABASE: "0",
};

const raw = fs.existsSync(envLocal) ? fs.readFileSync(envLocal, "utf8") : "";
const lines = raw.length ? raw.split(/\r?\n/) : [];
const seen = new Set();
const out = [];

if (!lines.some((l) => l.includes("Phase 10A-B — Local Docker"))) {
  out.push(
    "# Phase 10A-B — Local Docker Supabase (API 54921). Production creds in .env.remote.local (not auto-loaded).",
  );
}

for (const line of lines) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
  if (m && Object.prototype.hasOwnProperty.call(REQUIRED, m[1])) {
    out.push(`${m[1]}=${REQUIRED[m[1]]}`);
    seen.add(m[1]);
  } else if (m && m[1] === "SUPABASE_URL") {
    out.push(`SUPABASE_URL=${LOCAL_URL}`);
    seen.add("SUPABASE_URL");
  } else if (m && m[1] === "SUPABASE_SERVICE_ROLE_KEY") {
    out.push(`SUPABASE_SERVICE_ROLE_KEY=${LOCAL_SERVICE_ROLE}`);
    seen.add("SUPABASE_SERVICE_ROLE_KEY");
  } else {
    out.push(line);
  }
}

for (const [k, v] of Object.entries(REQUIRED)) {
  if (!seen.has(k)) out.push(`${k}=${v}`);
}

// Drop trailing empty spam but keep final newline
while (out.length && out[out.length - 1] === "") out.pop();
out.push("");
fs.writeFileSync(envLocal, out.join("\n"), "utf8");
console.log("REPAIRED .env.local for Docker local target");
