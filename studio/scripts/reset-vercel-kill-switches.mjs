/**
 * Phase 10A-C — explicitly set Director kill switches to 0 on Production + Preview.
 * Does not print previous values. Does not touch secrets / Supabase / deploy.
 */
import { spawnSync } from "node:child_process";

const KEYS = [
  "DIRECTOR_V2_ENABLED",
  "DIRECTOR_V2_PERSISTENCE_ENABLED",
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "DIRECTOR_V2_MARKETING_AI_ENABLED",
  "DIRECTOR_V2_CREATIVE_AI_ENABLED",
  "DIRECTOR_V2_SCRIPT_AI_ENABLED",
  "DIRECTOR_V2_ART_AI_ENABLED",
  "DIRECTOR_V2_STORYBOARD_AI_ENABLED",
];

const ENVS = ["production", "preview"];

function runUpdate(key, env) {
  const args = [
    "vercel",
    "env",
    "update",
    key,
    env,
    "--value",
    "0",
    "--sensitive",
    "--yes",
  ];
  const r = spawnSync("npx", args, {
    encoding: "utf8",
    shell: true,
    env: process.env,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  const ok = r.status === 0;
  // Never echo potential secret content — only status lines
  const safeOut = out
    .split(/\r?\n/)
    .filter((l) => !/^(?!\s*$)/.test(l) || /Retriev|Updat|Error|✔|✓|Environment|Production|Preview|sensitive|Updated|Saving|Success|Failed|error/i.test(l))
    .slice(-8)
    .join(" | ");
  return { ok, status: r.status, safeOut };
}

console.log("PROJECT=javachrist-projects/virtual-humans");
console.log("PHASE=10A-C");
console.log("OPERATION=SET_TO_0");
console.log(`KEYS=${KEYS.length}`);
console.log(`ENVS=${ENVS.join(",")}`);
console.log("--- BEFORE APPLY ---");
for (const key of KEYS) {
  for (const env of ENVS) {
    console.log(`${key} | ${env} | SET_TO_0`);
  }
}
console.log("--- APPLY ---");

let okCount = 0;
let failCount = 0;
const failures = [];

for (const key of KEYS) {
  for (const env of ENVS) {
    const r = runUpdate(key, env);
    if (r.ok) {
      okCount++;
      console.log(`OK | ${key} | ${env} | LAST_EXPLICIT_WRITE=0`);
    } else {
      failCount++;
      failures.push(`${key}/${env}`);
      console.log(`FAIL | ${key} | ${env} | status=${r.status} | ${r.safeOut}`);
    }
  }
}

console.log("--- SUMMARY ---");
console.log(`SUCCESS_OPS=${okCount}`);
console.log(`FAILED_OPS=${failCount}`);
console.log(`EXPECTED_OPS=${KEYS.length * ENVS.length}`);
if (failures.length) console.log(`FAILURES=${failures.join(",")}`);
process.exit(failCount === 0 ? 0 : 1);
