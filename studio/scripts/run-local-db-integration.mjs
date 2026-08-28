/**
 * Run DB integration tests against the currently running local Supabase stack.
 * Reads credentials from `supabase status -o env`, validates localhost, and
 * passes them only to the child test process. Never falls back to remote env.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

const dockerUserBin = join(
  process.env.LOCALAPPDATA ?? "",
  "Programs",
  "DockerDesktop",
  "resources",
  "bin"
);
if (existsSync(join(dockerUserBin, "docker.exe"))) {
  process.env.PATH = `${dockerUserBin}${delimiter}${process.env.PATH ?? ""}`;
}

function fail(message) {
  console.error(`test:integration:db: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    ...options,
  });
}

const preflight = run(process.execPath, ["scripts/check-local-supabase.mjs"], {
  stdio: "inherit",
});
if (preflight.status !== 0) process.exit(preflight.status ?? 1);

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const status = run(npxCommand, ["supabase", "status", "-o", "env"], {
  // Windows batch launchers require cmd.exe; Node itself is still spawned
  // directly above/below so paths such as C:\Program Files remain safe.
  shell: process.platform === "win32",
});
if (status.status !== 0) {
  fail("Supabase local n'est pas démarré. Exécutez `npx supabase start`, puis relancez.");
}

const local = {};
for (const line of status.stdout.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) local[match[1]] = match[2].replace(/^"|"$/g, "");
}

// Newer CLI builds may omit API_URL; derive from STORAGE_S3_URL origin when needed.
let url = local.API_URL || local.SUPABASE_URL || "";
if (!url && local.STORAGE_S3_URL) {
  try {
    url = new URL(local.STORAGE_S3_URL).origin;
  } catch {
    url = "";
  }
}
const serviceRoleKey = local.SERVICE_ROLE_KEY || local.SECRET_KEY;
if (!url || !serviceRoleKey) {
  fail("`supabase status` n'a pas fourni l'URL et la clé service_role locales.");
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  fail("L'URL retournée par Supabase local est invalide.");
}
if (host !== "127.0.0.1" && host !== "localhost") {
  fail(`Hôte non local refusé (${host}). Aucun fallback distant.`);
}

const tests = run(
  process.execPath,
  ["--import", "tsx", "--test", "src/**/*.integration.test.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SUPABASE_LOCAL_INTEGRATION: "1",
      SUPABASE_LOCAL_URL: url,
      SUPABASE_LOCAL_SERVICE_ROLE_KEY: serviceRoleKey,
      SUPABASE_LOCAL_ANON_KEY: local.ANON_KEY ?? local.PUBLISHABLE_KEY ?? "",
      // Force any accidental fallback onto the already-validated local stack.
      SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    },
  }
);

process.exit(tests.status ?? 1);
