/**
 * Phase 10F — idempotent replay of Storyboard execute (must not call provider).
 * Refused during PREP. Post-success only.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CONFIRM_PHASE_10F_PREP === "1") {
  console.error(
    "Refused during PREP: replay is for post-execute idempotence only."
  );
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const BASE =
  process.env.PHASE_10F_BASE_URL || "https://virtual-humans.vercel.app";
const projectId =
  process.argv[2] ||
  process.env.PHASE_10F_PROJECT_ID ||
  "984507af-a89e-4644-8ea3-344797baa974";

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

const tmp = resolve(studioRoot, ".env.vercel.10f.replay.tmp");
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
const getBefore = await fetch(
  `${BASE}/api/director/projects/${projectId}/storyboard`,
  { headers: { cookie, origin: BASE } }
);
const before = await getBefore.json().catch(() => ({}));
const expectedRev =
  before?.dryRun?.visualDirectionRevision ??
  before?.storyboard?.revision ??
  null;

const res = await fetch(
  `${BASE}/api/director/projects/${projectId}/storyboard`,
  {
    method: "POST",
    headers: {
      cookie,
      origin: BASE,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mode: "execute",
      expectedVisualDirectionRevision: expectedRev ?? 1,
      expectedVideoScriptRevision: before?.dryRun?.videoScriptRevision ?? 1,
      expectedCreativeConceptRevision:
        before?.dryRun?.creativeConceptRevision ?? 1,
      expectedMarketingPlanRevision:
        before?.dryRun?.marketingPlanRevision ?? 1,
    }),
  }
);
const body = await res.json().catch(() => ({}));
const elapsedMs = Date.now() - t0;

const out = {
  phase: "10F-REPLAY",
  http: res.status,
  status: body.status ?? null,
  directorRunId: body.directorRunId ?? null,
  providerCalledExpected: false,
  elapsedMs,
  note:
    body.status === "existing"
      ? "idempotent existing — no second provider call expected"
      : "unexpected replay status",
};
console.log(JSON.stringify(out, null, 2));
process.exit(body.status === "existing" && res.ok ? 0 : 1);
