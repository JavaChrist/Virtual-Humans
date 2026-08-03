import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type E2eRuntime = {
  workspaceId: string;
  workspaceSlug: string;
  supabaseUrl: string;
  appPassword: string;
  sessionSecret: string;
  workerSecret: string;
  serviceRoleKey: string;
  baseURL: string;
  directorOffURL: string;
};

export function loadE2eRuntime(): E2eRuntime {
  const path = join(process.cwd(), ".e2e-runtime.json");
  if (!existsSync(path)) {
    throw new Error(
      "Missing .e2e-runtime.json — run `node scripts/e2e-prepare.mjs` first.",
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as E2eRuntime;
}

export const E2E_SLUG_PREFIX = "e2e-";
