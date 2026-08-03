/**
 * Start Next (production server) for Playwright with E2E env.
 * Uses `next start` to avoid Next.js single-dev-instance lock.
 * Requires a prior `npm run build`.
 *
 * Usage: node scripts/e2e-start-server.mjs [--off] [--port=3100]
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const off = process.argv.includes("--off");
const portArg = process.argv.find((a) => a.startsWith("--port="));
const port = portArg ? portArg.split("=")[1] : off ? "3110" : "3100";
const envFile = join(root, off ? ".e2e-server-off.env" : ".e2e-server.env");

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
