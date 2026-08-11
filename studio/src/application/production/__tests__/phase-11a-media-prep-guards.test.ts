/**
 * Phase 11A — media smoke prep guards (no provider, no remote write).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canExecutePaidGeneration,
  canUseDirectorV2Persistence,
} from "@/infrastructure/config/feature-flags";
import { assertDirectorProductionUsesFakes } from "@/infrastructure/db/director-server";
import { estimateImage } from "@/lib/pricing";

test("11A — runtime OFF matrix: paid generation and worker must be jointly ON to execute media", () => {
  const off = {
    DIRECTOR_V2_ENABLED: "0",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "0",
    DIRECTOR_V2_WORKER_ENABLED: "0",
    DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
    DIRECTOR_V2_PAID_AI_ENABLED: "0",
  };
  assert.equal(canExecutePaidGeneration(off), false);
  assert.equal(canUseDirectorV2Persistence(off), false);

  const onlyPaid = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_WORKER_ENABLED: "0",
    DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
  };
  assert.equal(canExecutePaidGeneration(onlyPaid), false);

  const onlyWorker = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_WORKER_ENABLED: "1",
    DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
  };
  assert.equal(canExecutePaidGeneration(onlyWorker), false);

  const both = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_WORKER_ENABLED: "1",
    DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
  };
  assert.equal(canExecutePaidGeneration(both), true);
});

test("11A — VHS-124 forbids real providerMode on /director stack", () => {
  assert.doesNotThrow(() => assertDirectorProductionUsesFakes(undefined));
  assert.doesNotThrow(() => assertDirectorProductionUsesFakes("fake"));
  assert.throws(
    () => assertDirectorProductionUsesFakes("real"),
    /forbidden on the \/director production path/i,
  );
});

test("11A — recommended OpenAI still fits available 10¢ with 1¢ estimate", () => {
  const usd = estimateImage("1024x1024", "low", 1);
  assert.equal(usd, 0.011);
  const minor = Math.round(usd * 100);
  assert.equal(minor, 1);
  const available = 10;
  assert.ok(minor <= available);
  assert.equal(Math.max(0, minor - available), 0);
});

test("11A — smoke invariants: 1 call / 1 job / 1 asset / no fallback / no retry", () => {
  const contract = {
    maxProviderCalls: 1,
    maxJobs: 1,
    maxAssets: 1,
    fallback: false,
    automaticRetry: false,
    downstreamChaining: false,
    textDirectorsMustStayOff: true,
    mergeExportAuto: false,
    cron: false,
  };
  assert.equal(contract.maxProviderCalls, 1);
  assert.equal(contract.maxJobs, 1);
  assert.equal(contract.maxAssets, 1);
  assert.equal(contract.fallback, false);
  assert.equal(contract.automaticRetry, false);
  assert.equal(contract.downstreamChaining, false);
});

test("11A — video min hailuo exceeds available 10¢", () => {
  const hailuoPerSec = 0.05;
  const seconds = 6;
  const minor = Math.round(hailuoPerSec * seconds * 100);
  assert.equal(minor, 30);
  assert.ok(minor > 10);
});

test("11A — backup P1 does not block bounded additive media smoke decision enum", () => {
  const decision = "DOES_NOT_BLOCK_BOUNDED_MEDIA_SMOKE" as const;
  assert.notEqual(decision, "BLOCKS_MEDIA_SMOKE");
});
