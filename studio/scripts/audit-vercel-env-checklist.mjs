/**
 * Phase 10A-B helper — audit Vercel env pull files WITHOUT printing secrets.
 * Usage: node scripts/audit-vercel-env-checklist.mjs <production.env> <preview.env>
 */
import fs from "node:fs";

const FLAGS = [
  "DIRECTOR_V2_ENABLED",
  "DIRECTOR_V2_PERSISTENCE_ENABLED",
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "DIRECTOR_V2_MARKETING_AI_ENABLED",
  "DIRECTOR_V2_CREATIVE_AI_ENABLED",
  "DIRECTOR_V2_SCRIPT_AI_ENABLED",
  "DIRECTOR_V2_ART_AI_ENABLED",
  "DIRECTOR_V2_STORYBOARD_AI_ENABLED",
  "DIRECTOR_V2_E2E_FAKE_MODE",
  "DIRECTOR_V2_E2E_HARNESS",
  "DIRECTOR_V2_E2E_ASSET_STORAGE",
  "VH_ALLOW_REMOTE_SUPABASE",
];

const SECRETS = [
  "DIRECTOR_V2_WORKER_SECRET",
  "APP_PASSWORD",
  "APP_SESSION_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "FAL_KEY",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "DIRECTOR_V2_WORKSPACE_ID",
  "BUDGET_CAP_USD",
];

function parse(p) {
  const map = new Map();
  if (!fs.existsSync(p)) return map;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    map.set(m[1], v);
  }
  return map;
}

function flagState(v) {
  if (v == null) return "ABSENT";
  const t = String(v).trim().toLowerCase();
  if (t === "") return "EMPTY";
  if (t === "1" || t === "true") return "ON";
  if (t === "0" || t === "false") return "OFF";
  return "OTHER";
}

function presence(v) {
  if (v == null) return "ABSENT";
  if (String(v).trim() === "") return "EMPTY";
  return "PRESENT";
}

function hostOf(v) {
  if (v == null || !String(v).trim()) return "ABSENT";
  try {
    return new URL(String(v).trim()).hostname;
  } catch {
    return "INVALID";
  }
}

/** Checklist: safe expected is OFF or ABSENT for Director kill switches. */
function checklistCell(state) {
  if (state === "OFF" || state === "ABSENT") return "OK";
  if (state === "ON") return "RISK_ON";
  if (state === "EMPTY") return "EMPTY";
  return "REVIEW";
}

function report(label, file) {
  const m = parse(file);
  console.log(`## ${label}`);
  console.log(`file_exists=${fs.existsSync(file)} keys=${m.size}`);
  for (const k of FLAGS) {
    const st = flagState(m.has(k) ? m.get(k) : null);
    console.log(`${k}=${st} checklist=${checklistCell(st)}`);
  }
  for (const k of SECRETS) {
    console.log(`${k}=${presence(m.has(k) ? m.get(k) : null)}`);
  }
  console.log(`SUPABASE_URL_HOST=${hostOf(m.get("SUPABASE_URL"))}`);
  const app = m.get("APP_PASSWORD");
  const sess = m.get("APP_SESSION_SECRET");
  console.log(`APP_PASSWORD_LEN=${app ? String(app).length : "n/a"}`);
  console.log(`APP_SESSION_SECRET_LEN=${sess ? String(sess).length : "n/a"}`);
  console.log("");
}

const [, , prod, prev] = process.argv;
if (!prod || !prev) {
  console.error("Usage: node audit-vercel-env-checklist.mjs <prod.env> <preview.env>");
  process.exit(2);
}
report("PRODUCTION", prod);
report("PREVIEW", prev);
