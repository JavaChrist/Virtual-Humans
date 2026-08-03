import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Ensure (sans rotation de secrets) : budget policy + workspace présents.
 * Les secrets sont créés par `npm run e2e:prepare` / `test:e2e` avant Playwright
 * pour rester alignés avec le webServer.
 */
export default async function globalSetup() {
  execSync("node scripts/e2e-prepare.mjs --ensure", {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  const runtime = join(process.cwd(), ".e2e-runtime.json");
  const envFile = join(process.cwd(), ".e2e-server.env");
  if (!existsSync(runtime) || !existsSync(envFile)) {
    throw new Error(
      "e2e globalSetup: fichiers manquants — lancez `npm run e2e:prepare`.",
    );
  }
}
