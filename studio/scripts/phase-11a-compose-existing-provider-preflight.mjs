#!/usr/bin/env node
/**
 * PREPARED ONLY — future composition preflight for provider asset 7832765d.
 * This phase must not execute the Production read/compose path.
 *
 * Next authorization required: AUTH_11A_COMPOSE_EXISTING_PROVIDER_PNG_FILTERS
 */
import { pathToFileURL } from "node:url";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const planMod = await import(
  pathToFileURL(
    join(studioRoot, "src/application/production/phase-11a-existing-provider-composition-preflight.ts"),
  ).href
);

const executeRequested = process.argv.includes("--execute");
const plan = planMod.describePhase11AExistingProviderCompositionPreflight();
if (executeRequested) {
  planMod.assertPhase11AExistingProviderCompositionPreflightNotAuthorized();
}
const out = {
  ...plan,
  executeRequested,
  note: "Prepared only. Do not download or compose the Production provider PNG in this phase.",
};
const blob = JSON.stringify(out);
if (/sk-|data:image\/|base64,|https?:\/\//i.test(blob)) {
  throw new Error("preflight plan leak");
}
console.log(JSON.stringify(out, null, 2));
if (executeRequested) process.exit(2);
