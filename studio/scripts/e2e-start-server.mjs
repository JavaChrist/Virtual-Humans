/**
 * Start Next (production server) for Playwright with E2E env.
 * Uses `next start` to avoid Next.js single-dev-instance lock.
 * Requires a prior `npm run build`.
 *
 * Usage: node scripts/e2e-start-server.mjs [--off] [--ui-only] [--persistence-only] [--port=3100]
 *
 * --ui-only reads the off env file then forces DIRECTOR_V2_ENABLED=1 in this
 * process only, with every paid / AI / worker / persistence / E2E flag OFF.
 * --persistence-only is the same isolation plus DIRECTOR_V2_PERSISTENCE_ENABLED=1
 * (local Supabase from the off env file; never Production; never Vercel write).
 * Those local values are never written to Vercel or committed.
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const UI_ONLY_FORCE_OFF = [
  "DIRECTOR_V2_PERSISTENCE_ENABLED",
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_MARKETING_AI_ENABLED",
  "DIRECTOR_V2_CREATIVE_AI_ENABLED",
  "DIRECTOR_V2_SCRIPT_AI_ENABLED",
  "DIRECTOR_V2_ART_AI_ENABLED",
  "DIRECTOR_V2_STORYBOARD_AI_ENABLED",
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "DIRECTOR_V2_E2E_HARNESS",
  "DIRECTOR_V2_E2E_FAKE_MODE",
  "DIRECTOR_V2_E2E_ASSET_STORAGE",
  "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
  "VHS11B_I2V_CAPABILITY_ENABLED",
  "VHS11B_I2V_PAID_ENABLED",
  "VHS11B_I2V_FAL_ENABLED",
  "VHS11B_I2V_WORKER_ENABLED",
  "VHS11B_I2V_DOWNSTREAM_ENABLED",
  "VHS11B_FAL_I2V_DIRECTOR_EXCEPTION",
  "VHS11C_VOICE_CAPABILITY_ENABLED",
  "VHS11C_VOICE_PAID_ENABLED",
  "VHS11C_VOICE_ELEVENLABS_ENABLED",
  "VHS11C_VOICE_WORKER_ENABLED",
  "VHS11C_VOICE_DOWNSTREAM_ENABLED",
  "VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION",
  "VHS11D_LIPSYNC_CAPABILITY_ENABLED",
  "VHS11D_LIPSYNC_PAID_ENABLED",
  "VHS11D_LIPSYNC_PROVIDER_ENABLED",
  "VHS11D_LIPSYNC_WORKER_ENABLED",
  "VHS11D_LIPSYNC_DOWNSTREAM_ENABLED",
  "VHS11D_LIPSYNC_DIRECTOR_EXCEPTION",
  "VHS11E_MERGE_CAPABILITY_ENABLED",
  "VHS11E_EXPORT_CAPABILITY_ENABLED",
  "VHS11E_PAID_ENABLED",
  "VHS11E_PROVIDER_ENABLED",
  "VHS11E_WORKER_ENABLED",
  "VHS11E_DIRECTOR_EXCEPTION",
  "VHS11E_PUBLISH_DOWNSTREAM_ENABLED",
  "MOTION_TRANSFER_ENABLED",
  "MOTION_TRANSFER_PAID_ENABLED",
  "MOTION_TRANSFER_FAL_ENABLED",
  "MOTION_TRANSFER_WORKER_ENABLED",
  "MOTION_TRANSFER_FAKE_HARNESS",
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const off = process.argv.includes("--off");
const uiOnly = process.argv.includes("--ui-only");
const persistenceOnly = process.argv.includes("--persistence-only");
const portArg = process.argv.find((a) => a.startsWith("--port="));
const port = portArg
  ? portArg.split("=")[1]
  : persistenceOnly
    ? "3113"
    : uiOnly
      ? "3112"
      : off
        ? "3110"
        : "3100";
const envFile = join(
  root,
  off || uiOnly || persistenceOnly ? ".e2e-server-off.env" : ".e2e-server.env",
);

if (!existsSync(envFile)) {
  console.error("e2e-start-server: run `node scripts/e2e-prepare.mjs` first.");
  process.exit(1);
}
if (!existsSync(join(root, ".next"))) {
  console.error("e2e-start-server: run `npm run build` first.");
  process.exit(1);
}

const fileEnv = {};
for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i <= 0) continue;
  fileEnv[t.slice(0, i)] = t.slice(i + 1);
}

if (uiOnly || persistenceOnly) {
  fileEnv.DIRECTOR_V2_ENABLED = "1";
  for (const name of UI_ONLY_FORCE_OFF) {
    fileEnv[name] = "0";
  }
  if (persistenceOnly) {
    fileEnv.DIRECTOR_V2_PERSISTENCE_ENABLED = "1";
  }
}

const env = {
  ...process.env,
  ...fileEnv,
  PORT: port,
  HOSTNAME: "127.0.0.1",
  OPENAI_API_KEY: "",
  FAL_KEY: "",
  ELEVENLABS_API_KEY: "",
  AICCOS_IMPORT_TOKEN: "",
};

const nextBin = join(
  root,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

const child = spawn(
  process.execPath,
  [nextBin, "start", "-H", "127.0.0.1", "-p", port],
  { cwd: root, env, stdio: "inherit" },
);

child.on("exit", (code) => process.exit(code ?? 1));
