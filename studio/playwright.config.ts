import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Phase 8 — Chromium only (stability). Firefox/WebKit intentionally omitted.
 * Requires: `node scripts/e2e-prepare.mjs` then `npm run test:e2e`.
 */

const runtimePath = join(__dirname, ".e2e-runtime.json");
const baseURL = existsSync(runtimePath)
  ? (JSON.parse(readFileSync(runtimePath, "utf8")) as { baseURL: string }).baseURL
  : "http://127.0.0.1:3100";

/** Use system Chrome when PW_CHANNEL=chrome or PLAYWRIGHT_BROWSERS are missing. */
const chromeChannel =
  process.env.PW_CHANNEL === "chrome" || process.env.PW_CHANNEL === "msedge"
    ? process.env.PW_CHANNEL
    : process.platform === "win32"
      ? "chrome"
      : undefined;

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 20_000 },
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    // Empêche un SW résiduel de casser les navigations sous barrière réseau.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium",
      // Prefer system Google Chrome when Playwright browser download is unavailable.
      use: {
        ...devices["Desktop Chrome"],
        ...(chromeChannel ? { channel: chromeChannel } : {}),
      },
      testIgnore: [/director-off\.spec\.ts/],
    },
    {
      name: "chromium-director-off",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:3110",
        ...(chromeChannel ? { channel: chromeChannel } : {}),
      },
      testMatch: /director-off\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: "node scripts/e2e-start-server.mjs --port=3100",
      url: "http://127.0.0.1:3100/login",
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: "node scripts/e2e-start-server.mjs --off --port=3110",
      url: "http://127.0.0.1:3110/login",
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
});
