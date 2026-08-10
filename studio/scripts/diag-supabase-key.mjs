import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(path) {
  const map = {};
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

function statusEnv() {
  const raw = execSync("npx supabase status -o env", {
    encoding: "utf8",
    cwd: resolve(__dirname, ".."),
  });
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return map;
}

function sha(s) {
  return createHash("sha256").update(s).digest("hex").slice(0, 12);
}

async function probe(label, url, key, ws) {
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .from("workspaces")
    .select("id,slug")
    .eq("id", ws)
    .maybeSingle();
  const all = await db.from("workspaces").select("id,slug").limit(5);
  console.log(
    JSON.stringify({
      label,
      byIdError: error?.message || null,
      found: Boolean(data),
      listError: all.error?.message || null,
      listCount: all.data?.length ?? null,
      slugs: (all.data || []).map((x) => x.slug),
    })
  );
}

const env = loadEnv(resolve(__dirname, "../.env.local"));
const st = statusEnv();
console.log(`KEY_MATCH=${env.SUPABASE_SERVICE_ROLE_KEY === st.SERVICE_ROLE_KEY}`);
console.log(`ENV_SHA=${sha(env.SUPABASE_SERVICE_ROLE_KEY || "")}`);
console.log(`STATUS_SHA=${sha(st.SERVICE_ROLE_KEY || "")}`);
console.log(`URL_ENV=${env.SUPABASE_URL}`);
console.log(`URL_STATUS=${st.API_URL}`);

const ws = env.DIRECTOR_V2_WORKSPACE_ID;
await probe("env-key", env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, ws);
await probe("status-key", st.API_URL, st.SERVICE_ROLE_KEY, ws);
