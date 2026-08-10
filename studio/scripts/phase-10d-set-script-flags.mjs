/**
 * Phase 10D — temporarily set minimal Script smoke flags on Vercel Production.
 * PREP must NOT run mode=on.
 *
 * Usage: node scripts/phase-10d-set-script-flags.mjs on|off
 * Requires: CONFIRM_PHASE_10D_VERCEL_FLAGS=1
 */
import { spawnSync } from "node:child_process";

if (process.env.CONFIRM_PHASE_10D_VERCEL_FLAGS !== "1") {
  console.error(
    "Refused: set CONFIRM_PHASE_10D_VERCEL_FLAGS=1 to run (writes Vercel Production flags)."
  );
  process.exit(2);
}

if (process.env.CONFIRM_PHASE_10D_PREP === "1" && process.argv[2] === "on") {
  console.error(
    "Refused: cannot enable Script flags while CONFIRM_PHASE_10D_PREP=1 (PREP is dry-only)."
  );
  process.exit(2);
}

const mode = process.argv[2];
if (mode !== "on" && mode !== "off") {
  console.error("Usage: phase-10d-set-script-flags.mjs on|off");
  process.exit(2);
}

const value = mode === "on" ? "1" : "0";

/** Flags flipped for 10D Script text smoke only. */
const FLIP = [
  "DIRECTOR_V2_ENABLED",
  "DIRECTOR_V2_PERSISTENCE_ENABLED",
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "DIRECTOR_V2_SCRIPT_AI_ENABLED",
];

/** Must remain 0 — Marketing/Creative never re-enabled; no Art/Storyboard/media/worker. */
const KEEP_OFF = [
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_MARKETING_AI_ENABLED",
  "DIRECTOR_V2_CREATIVE_AI_ENABLED",
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

console.log("PHASE=10D");
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
console.log(
  mode === "off"
    ? "CLOSEOUT: all Script smoke flags forced OFF; Marketing/Creative/Art/Storyboard/worker/media remain OFF."
    : "WARNING: Script path temporarily enabled — close with mode=off immediately after smoke."
);
process.exit(fail === 0 ? 0 : 1);
