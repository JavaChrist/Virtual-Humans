/** Confirm Production Director persistence is OFF after 10B close-out. */
import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const BASE = "https://virtual-humans.vercel.app";

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

const tmp = resolve(studioRoot, ".env.vercel.10b.off.tmp");
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
console.log(
  JSON.stringify(
    {
      http: res.status,
      error: body.error || null,
      expected: "404 Persistance Director désactivée",
      CURRENT_RUNTIME_REAL_AI:
        res.status === 404 ? "OFF" : "UNKNOWN_OR_STILL_ON",
    },
    null,
    2
  )
);
process.exit(res.status === 404 ? 0 : 2);
