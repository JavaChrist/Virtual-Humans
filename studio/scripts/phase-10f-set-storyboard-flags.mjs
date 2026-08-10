/**
 * Phase 10F — temporarily set minimal Storyboard text smoke flags on Vercel Production.
 * PREP must NOT run mode=on.
 *
 * Usage: node scripts/phase-10f-set-storyboard-flags.mjs on|off
 * Requires: CONFIRM_PHASE_10F_VERCEL_FLAGS=1
 *
 * Hard rule: PAID_GENERATION and WORKER always forced 0.
 * Upstream Marketing/Creative/Script/Art AI always forced 0.
 */
import { spawnSync } from "node:child_process";

if (process.env.CONFIRM_PHASE_10F_VERCEL_FLAGS !== "1") {
  console.error(
    "Refused: set CONFIRM_PHASE_10F_VERCEL_FLAGS=1 to run (writes Vercel Production flags)."
  );
  process.exit(2);
}

if (process.env.CONFIRM_PHASE_10F_PREP === "1" && process.argv[2] === "on") {
  console.error(
    "Refused: cannot enable Storyboard flags while CONFIRM_PHASE_10F_PREP=1 (PREP is dry-only)."
  );
  process.exit(2);
}

const mode = process.argv[2];
if (mode !== "on" && mode !== "off") {
  console.error("Usage: phase-10f-set-storyboard-flags.mjs on|off");
  process.exit(2);
}

const value = mode === "on" ? "1" : "0";

/** Flags flipped for 10F Storyboard text smoke only. */
const FLIP = [
  "DIRECTOR_V2_ENABLED",
  "DIRECTOR_V2_PERSISTENCE_ENABLED",
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "DIRECTOR_V2_STORYBOARD_AI_ENABLED",
];

/** Must remain 0 — no upstream replay; no media/worker. */
const KEEP_OFF = [
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_MARKETING_AI_ENABLED",
  "DIRECTOR_V2_CREATIVE_AI_ENABLED",
  "DIRECTOR_V2_SCRIPT_AI_ENABLED",
  "DIRECTOR_V2_ART_AI_ENABLED",
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

console.log("PHASE=10F");
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
    ? "CLOSEOUT: all Storyboard smoke flags forced OFF; Marketing/Creative/Script/Art/worker/media remain OFF."
    : "WARNING: Storyboard text path temporarily enabled — close with mode=off immediately after smoke. PAID_GENERATION=0 WORKER=0."
);
process.exit(fail === 0 ? 0 : 1);
