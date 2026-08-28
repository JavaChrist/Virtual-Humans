/**
 * Print local Supabase identity without secrets, JWTs, or connection strings.
 */
import { spawnSync } from "node:child_process";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const status = spawnSync(npx, ["supabase", "status", "-o", "env"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (status.status !== 0) {
  console.error("identify-local-supabase: stack locale indisponible.");
  process.exit(1);
}

const map = {};
for (const line of status.stdout.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) map[match[1]] = match[2].replace(/^"|"$/g, "");
}

let url = map.API_URL || map.SUPABASE_URL || "";
if (!url && map.STORAGE_S3_URL) {
  try {
    url = new URL(map.STORAGE_S3_URL).origin;
  } catch {
    url = "";
  }
}

let host = "";
let port = "";
try {
  const parsed = new URL(url);
  host = parsed.hostname;
  port = parsed.port;
} catch {
  console.error("identify-local-supabase: URL locale invalide.");
  process.exit(1);
}

if (host !== "127.0.0.1" && host !== "localhost") {
  console.error(`identify-local-supabase: hôte non local (${host}).`);
  process.exit(1);
}

console.log(`API_HOST=${host}`);
console.log(`API_PORT=${port || "54321"}`);
console.log(`HAS_SERVICE_ROLE=${map.SERVICE_ROLE_KEY || map.SECRET_KEY ? "yes" : "no"}`);
console.log(`HAS_ANON=${map.ANON_KEY || map.PUBLISHABLE_KEY ? "yes" : "no"}`);
console.log(
  `REMOTE_SUPABASE_CO_IN_STATUS=${status.stdout.includes("supabase.co") ? "yes" : "no"}`,
);
