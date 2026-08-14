/**
 * Local dry-run only — no provider, no Production, no Vercel.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const studioRoot = resolve(".");
const outDir = join(studioRoot, ".tmp");
mkdirSync(outDir, { recursive: true });

const { runPhase11AStripOverlayCopyDryRun } = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-strip-overlay-copy-dry-run.ts")).href
);

const report = runPhase11AStripOverlayCopyDryRun();
if (report.providerCalled !== false) throw new Error("providerCalled must be false");
if ("promptText" in report) throw new Error("full provider prompt must not be persisted");
if (JSON.stringify(report).includes("sk-")) throw new Error("secret shape in dry-run report");

const path = join(outDir, "phase-11a-strip-overlay-copy-dry-run.json");
writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, path, verdict: "READY_FOR_NEW_TEXT_FREE_IMAGE_RETRY_PREFLIGHT", ...report }, null, 2));
