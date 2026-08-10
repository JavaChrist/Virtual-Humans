/**
 * Phase 10F — confirm Production Director persistence / AI path is OFF after close-out.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const BASE =
  process.env.PHASE_10F_BASE_URL || "https://virtual-humans.vercel.app";

function loadEnv(path) {
  const map = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    map[m[1]] = v;
  }
  return map;
}

const FLAG_KEYS = [
  "DIRECTOR_V2_ENABLED",
  "DIRECTOR_V2_PERSISTENCE_ENABLED",
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "DIRECTOR_V2_MARKETING_AI_ENABLED",
  "DIRECTOR_V2_CREATIVE_AI_ENABLED",
  "DIRECTOR_V2_SCRIPT_AI_ENABLED",
  "DIRECTOR_V2_ART_AI_ENABLED",
  "DIRECTOR_V2_STORYBOARD_AI_ENABLED",
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
];

const tmp = resolve(studioRoot, ".env.vercel.10f.off.tmp");
const pull = spawnSync(
  "npx",
  ["vercel", "env", "pull", tmp, "--environment", "production", "--yes"],
  { encoding: "utf8", shell: true, cwd: studioRoot }
);
if (pull.status !== 0) process.exit(1);
const env = loadEnv(tmp);
try {
  unlinkSync(tmp);
} catch {
  /* ignore */
}

const flagSnapshot = Object.fromEntries(
  FLAG_KEYS.map((k) => [k, env[k] ?? "(unset)"])
);
const allOff = FLAG_KEYS.every((k) => {
  const v = (env[k] ?? "").trim().toLowerCase();
  return v === "" || v === "0" || v === "false";
});

const login = await fetch(`${BASE}/api/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: env.APP_PASSWORD }),
});
const setCookies =
  typeof login.headers.getSetCookie === "function"
    ? login.headers.getSetCookie()
    : [login.headers.get("set-cookie")].filter(Boolean);
const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");

const res = await fetch(`${BASE}/api/director/projects`, {
  headers: { cookie, origin: BASE },
});
const body = await res.json().catch(() => ({}));
const runtimeOff =
  res.status === 404 &&
  String(body.error || "").includes("Persistance Director désactivée");

const out = {
  phase: "10F",
  flagsAllOff: allOff,
  flagSnapshot,
  http: res.status,
  error: body.error ?? null,
  expected: "404 Persistance Director désactivée",
  CURRENT_RUNTIME_REAL_AI: runtimeOff && allOff ? "OFF" : "NOT_PROVEN_OFF",
};
console.log(JSON.stringify(out, null, 2));
process.exit(runtimeOff && allOff ? 0 : 1);
