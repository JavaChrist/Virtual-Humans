#!/usr/bin/env node
/**
 * MT-013F — Scaffold for post-deploy MV-001 dry-run (no fal, no reserve).
 * Real dry-run evaluation lives in src (evaluateMv001DryRunLivePrep) after deploy Auth.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", ".tmp");
mkdirSync(outDir, { recursive: true });

let head = "unknown";
try {
  head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {
  /* offline / non-git */
}

const scaffold = {
  ticket: "MT-013F",
  script: "mt013f-mv001-dry-run-live-prep",
  preparedOnly: true,
  expectedVerdictAfterDeploy: "READY_FOR_PAID_AUTH",
  expectedSourceCommit: head,
  observedBudgetExpected: {
    hardMinor: 274,
    committedMinor: 112,
    reservedMinor: 0,
    availableMinor: 162,
  },
  estimateMinor: 135,
  reservationMinor: 162,
  absoluteCapMinor: 200,
  shortfallMinor: 0,
  providerCalled: false,
  reservations: 0,
  runs: 0,
  jobs: 0,
  assets: 0,
  workerExecuted: false,
  note: "Do not run paid dry-run until deploy Auth. This file is a prep scaffold only.",
};

const out = join(outDir, "mt013f-dry-run-live-prep.json");
writeFileSync(out, JSON.stringify(scaffold, null, 2));
console.log(JSON.stringify({ ok: true, out, preparedOnly: true }, null, 2));
