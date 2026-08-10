/**
 * Sync SUPABASE_SERVICE_ROLE_KEY in .env.local from `supabase status`.
 * Local only. Never prints the key.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const envPath = resolve(studioRoot, ".env.local");

function statusEnv() {
  const raw = execSync("npx supabase status -o env", {
    encoding: "utf8",
    cwd: studioRoot,
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

if (!existsSync(envPath)) {
  console.error("FAIL: .env.local missing");
  process.exit(1);
}

const st = statusEnv();
const url = st.API_URL;
const key = st.SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("FAIL: supabase status incomplete");
  process.exit(1);
}
let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error("FAIL: bad API_URL");
  process.exit(1);
}
if (host !== "127.0.0.1" && host !== "localhost") {
  console.error(`FAIL: non-local host ${host}`);
  process.exit(1);
}

let text = readFileSync(envPath, "utf8");
const before = text.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1] ?? "";
const beforeSha = sha(before.replace(/^["']|["']$/g, ""));
const afterSha = sha(key);

if (!/^SUPABASE_SERVICE_ROLE_KEY=/m.test(text)) {
  text += `\nSUPABASE_SERVICE_ROLE_KEY=${key}\n`;
} else {
  text = text.replace(
    /^SUPABASE_SERVICE_ROLE_KEY=.*$/m,
    `SUPABASE_SERVICE_ROLE_KEY=${key}`
  );
}

// Keep URL aligned too
if (/^SUPABASE_URL=/m.test(text)) {
  text = text.replace(/^SUPABASE_URL=.*$/m, `SUPABASE_URL=${url}`);
} else {
  text += `\nSUPABASE_URL=${url}\n`;
}

writeFileSync(envPath, text, "utf8");
console.log("SYNCED=SUPABASE_SERVICE_ROLE_KEY");
console.log(`URL=${url}`);
console.log(`KEY_SHA_BEFORE=${beforeSha}`);
console.log(`KEY_SHA_AFTER=${afterSha}`);
console.log(`CHANGED=${beforeSha !== afterSha}`);
console.log("Restart npm run dev, then refresh /director.");
