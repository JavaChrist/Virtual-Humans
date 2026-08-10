/**
 * One-shot: rewrite studio/.env.local without duplicates.
 * Preserves secret values. Never prints them.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = resolve(__dirname, "../.env.local");

function load(file) {
  const map = {};
  if (!existsSync(file)) return map;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    map[m[1]] = v; // last wins
  }
  return map;
}

function q(v) {
  if (v == null) return "";
  if (/[\s#"']/.test(v)) return JSON.stringify(v);
  return v;
}

const e = load(path);
const out = `# Virtual Humans Studio — local environment (gitignored)
# Docker Supabase only. Production credentials → .env.remote.local (not auto-loaded).

# --- Providers --------------------------------------------------------------
OPENAI_API_KEY=${q(e.OPENAI_API_KEY || "")}
ELEVENLABS_API_KEY=${q(e.ELEVENLABS_API_KEY || "")}
ELEVENLABS_VOICE_ID=${q(e.ELEVENLABS_VOICE_ID || "")}
FAL_KEY=${q(e.FAL_KEY || "")}

# --- Pricing overrides (optional, USD) --------------------------------------
ELEVENLABS_USD_PER_1K_CHARS=${q(e.ELEVENLABS_USD_PER_1K_CHARS || "0.15")}
FAL_KLING_USD_PER_SEC=${q(e.FAL_KLING_USD_PER_SEC || "0.28")}
FAL_MINIMAX_USD_PER_SEC=${q(e.FAL_MINIMAX_USD_PER_SEC || "0.05")}
FAL_VEO_USD_PER_SEC=${q(e.FAL_VEO_USD_PER_SEC || "0.4")}
FAL_RUNWAY_USD_PER_SEC=${q(e.FAL_RUNWAY_USD_PER_SEC || "0.05")}

# --- Supabase local (Docker — API 54321) ------------------------------------
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=${q(e.SUPABASE_SERVICE_ROLE_KEY || "")}
VH_ALLOW_REMOTE_SUPABASE=0

# --- Access (local) ---------------------------------------------------------
APP_PASSWORD=${q(e.APP_PASSWORD || "")}
APP_SESSION_SECRET=${q(e.APP_SESSION_SECRET || "")}
BUDGET_CAP_USD=${q(e.BUDGET_CAP_USD || "")}

# --- AICCOS -----------------------------------------------------------------
AICCOS_URL=${q(e.AICCOS_URL || "https://aicommandcenteros.app")}
AICCOS_IMPORT_TOKEN=${q(e.AICCOS_IMPORT_TOKEN || "")}

# --- Director UI (local preview) --------------------------------------------
# Menu « Réalisateur IA » : ENABLED + PERSISTENCE.
# Paid AI / worker / media stay OFF unless you intentionally enable them.
DIRECTOR_V2_ENABLED=1
DIRECTOR_V2_PERSISTENCE_ENABLED=1
DIRECTOR_V2_WORKER_ENABLED=0
DIRECTOR_V2_PAID_GENERATION_ENABLED=0
DIRECTOR_V2_PAID_AI_ENABLED=0
DIRECTOR_V2_MARKETING_AI_ENABLED=0
DIRECTOR_V2_CREATIVE_AI_ENABLED=0
DIRECTOR_V2_SCRIPT_AI_ENABLED=0
DIRECTOR_V2_ART_AI_ENABLED=0
DIRECTOR_V2_STORYBOARD_AI_ENABLED=0
${e.DIRECTOR_V2_WORKSPACE_ID ? `DIRECTOR_V2_WORKSPACE_ID=${q(e.DIRECTOR_V2_WORKSPACE_ID)}\n` : ""}# --- SDK (optional) ---------------------------------------------------------
${e.SDK_ROOT ? `SDK_ROOT=${q(e.SDK_ROOT)}\n` : ""}${e.CHARACTER_DIR_NAME ? `CHARACTER_DIR_NAME=${q(e.CHARACTER_DIR_NAME)}\n` : ""}`;

writeFileSync(path, out.replace(/\n{3,}/g, "\n\n"), "utf8");

const verify = load(path);
const keys = Object.keys(verify);
const dups = keys.filter((k, i) => keys.indexOf(k) !== i);
console.log("CLEANED=.env.local");
console.log(`KEYS=${keys.length}`);
console.log(`DUPLICATES=${dups.length}`);
console.log(`SUPABASE_URL=${verify.SUPABASE_URL}`);
console.log(`DIRECTOR_V2_ENABLED=${verify.DIRECTOR_V2_ENABLED}`);
console.log(`DIRECTOR_V2_PERSISTENCE_ENABLED=${verify.DIRECTOR_V2_PERSISTENCE_ENABLED}`);
console.log(`PAID_AI=${verify.DIRECTOR_V2_PAID_AI_ENABLED}`);
console.log(`VH_ALLOW_REMOTE=${verify.VH_ALLOW_REMOTE_SUPABASE}`);
