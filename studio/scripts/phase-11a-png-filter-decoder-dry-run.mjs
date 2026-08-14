#!/usr/bin/env node
/**
 * Local synthetic dry-run for the hardened PNG filter decoder.
 * No provider, no Production media, no Storage write.
 */
import { pathToFileURL } from "node:url";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dry = await import(
  pathToFileURL(join(studioRoot, "src/application/production/phase-11a-png-filter-decoder-dry-run.ts")).href
);
const report = await dry.runPhase11APngFilterDecoderDryRun();
const blob = JSON.stringify(report);
if (/sk-|data:image\/|base64,|https?:\/\//i.test(blob)) {
  throw new Error("dry-run leak");
}
console.log(blob);
