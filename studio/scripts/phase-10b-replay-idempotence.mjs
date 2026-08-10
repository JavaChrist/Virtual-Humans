/**
 * Phase 10B — idempotent replay of Marketing execute (must not call provider).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const BASE = process.env.PHASE_10B_BASE_URL || "https://virtual-humans.vercel.app";
const projectId =
  process.argv[2] || "984507af-a89e-4644-8ea3-344797baa974";

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

const tmp = resolve(studioRoot, ".env.vercel.10b.replay.tmp");
const pull = spawnSync(
  "npx",
  ["vercel", "env", "pull", tmp, "--environment", "production", "--yes"],
  { encoding: "utf8", shell: true, cwd: studioRoot }
);
if (pull.status !== 0) {
  console.error("FAIL: vercel env pull");
  process.exit(1);
}
const env = loadEnv(tmp);
try {
  unlinkSync(tmp);
} catch {
  /* ignore */
}

const login = await fetch(`${BASE}/api/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: env.APP_PASSWORD }),
});
if (!login.ok) {
  console.error(`FAIL: login ${login.status}`);
  process.exit(1);
}
const setCookies =
  typeof login.headers.getSetCookie === "function"
    ? login.headers.getSetCookie()
    : [login.headers.get("set-cookie")].filter(Boolean);
const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");

const t0 = Date.now();
const res = await fetch(`${BASE}/api/director/projects/${projectId}/marketing`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    cookie,
    origin: BASE,
    referer: `${BASE}/director`,
    "x-correlation-id": "corr-10b-replay-idem",
  },
  body: JSON.stringify({ mode: "execute", expectedBriefRevision: 1 }),
});
const body = await res.json();
const durationMs = Date.now() - t0;
console.log(
  JSON.stringify(
    {
      http: res.status,
      status: body.status,
      directorRunId: body.directorRunId,
      durationMs,
      hasPlan: Boolean(body.plan),
      providerCalledHint:
        durationMs < 3000 && body.status === "existing"
          ? "likely_no_provider"
          : "inspect",
    },
    null,
    2
  )
);
process.exit(body.status === "existing" ? 0 : 2);
