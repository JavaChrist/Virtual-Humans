/**
 * Diagnose GET /api/director/projects on local Next.
 * Never prints secrets.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

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

const env = loadEnv(envPath);
const base = process.env.DIAG_BASE || "http://localhost:3000";

const login = await fetch(`${base}/api/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: env.APP_PASSWORD }),
});
console.log(`login=${login.status}`);
const setCookies =
  typeof login.headers.getSetCookie === "function"
    ? login.headers.getSetCookie()
    : [login.headers.get("set-cookie")].filter(Boolean);
const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");

const settings = await fetch(`${base}/api/settings`, {
  headers: { cookie },
});
const s = await settings.json().catch(() => ({}));
console.log(
  `settings=${settings.status} directorV2=${Boolean(s.features?.directorV2)} persistence=${Boolean(s.features?.directorV2Persistence)}`
);

const projects = await fetch(`${base}/api/director/projects`, {
  headers: { cookie, origin: base },
});
const body = await projects.json().catch(() => ({}));
console.log(`projects=${projects.status}`);
console.log(
  JSON.stringify({
    error: body.error || null,
    code: body.code || null,
    itemCount: Array.isArray(body.items) ? body.items.length : null,
  })
);

// Direct Supabase check
const { createClient } = await import("@supabase/supabase-js");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ws = env.DIRECTOR_V2_WORKSPACE_ID;
const { data: workspace, error: wErr } = await db
  .from("workspaces")
  .select("id,slug,name")
  .eq("id", ws)
  .maybeSingle();
console.log(
  JSON.stringify({
    workspaceIdPresent: Boolean(ws),
    workspaceFound: Boolean(workspace),
    workspaceError: wErr?.message || null,
    slug: workspace?.slug || null,
  })
);
const { count, error: pErr } = await db
  .from("video_projects")
  .select("id", { count: "exact", head: true })
  .eq("workspace_id", ws);
console.log(
  JSON.stringify({
    projectCount: count,
    projectError: pErr?.message || null,
  })
);
