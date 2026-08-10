/**
 * Phase 10B — temporarily set minimal Marketing smoke flags on Vercel Production.
 * Does not touch secrets, provider keys, or Supabase vars.
 * Usage: node scripts/phase-10b-set-marketing-flags.mjs on|off
 */
import { spawnSync } from "node:child_process";

const mode = process.argv[2];
if (mode !== "on" && mode !== "off") {
  console.error("Usage: phase-10b-set-marketing-flags.mjs on|off");
  process.exit(2);
}

const value = mode === "on" ? "1" : "0";

/** Flags flipped for 10B Marketing text smoke only. */
const FLIP = [
  "DIRECTOR_V2_ENABLED",
  "DIRECTOR_V2_PERSISTENCE_ENABLED",
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "DIRECTOR_V2_MARKETING_AI_ENABLED",
];

/** Must remain 0 — verified write for safety when mode=off also; when on, rewrite 0. */
const KEEP_OFF = [
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_CREATIVE_AI_ENABLED",
  "DIRECTOR_V2_SCRIPT_AI_ENABLED",
  "DIRECTOR_V2_ART_AI_ENABLED",
  "DIRECTOR_V2_STORYBOARD_AI_ENABLED",
];

function update(key, envName, v) {
  const r = spawnSync(
    "npx",
    ["vercel", "env", "update", key, envName, "--value", v, "--sensitive", "--yes"],
    { encoding: "utf8", shell: true, env: process.env }
  );
  const ok = r.status === 0;
  console.log(`${ok ? "OK" : "FAIL"} | ${key} | ${envName} | LAST_EXPLICIT_WRITE=${v}`);
  return ok;
}

console.log("PHASE=10B");
console.log(`MODE=${mode}`);
console.log("TARGET=production");
console.log("--- MATRIX APPLY ---");

let ok = 0;
let fail = 0;

for (const key of FLIP) {
  if (update(key, "production", value)) ok++;
  else fail++;
}

for (const key of KEEP_OFF) {
  if (update(key, "production", "0")) ok++;
  else fail++;
}

console.log("--- SUMMARY ---");
console.log(`SUCCESS_OPS=${ok}`);
console.log(`FAILED_OPS=${fail}`);
process.exit(fail === 0 ? 0 : 1);
