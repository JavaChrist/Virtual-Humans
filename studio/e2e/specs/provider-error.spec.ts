import { test, expect } from "@playwright/test";
import { loginViaUi } from "../helpers/auth";
import { fillSyntheticBrief } from "../helpers/director-flow";
import { installNetworkBarrier } from "../helpers/network-barrier";

/**
 * Controlled fake failure — requires DIRECTOR_V2_E2E_FAKE_FAIL=marketing on a
 * dedicated server. When unset, this test verifies dry-run still reports
 * providerCalled:false and skips the destructive path.
 */
test.describe("Erreur provider fake", () => {
  test("dry-run marketing n'appelle aucun provider", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);
    const projectId = page.url().match(/\/director\/([0-9a-f-]{36})/i)?.[1];
    expect(projectId).toBeTruthy();
    const origin = new URL(page.url()).origin;

    // page.request — même jar de cookies que le login UI (pas le fixture `request`).
    const res = await page.request.post(
      `/api/director/projects/${projectId}/marketing`,
      {
        data: { mode: "dry-run" },
        headers: {
          "content-type": "application/json",
          Origin: origin,
          Referer: page.url(),
        },
      },
    );
    expect(res.ok(), `marketing dry-run HTTP ${res.status()}`).toBeTruthy();
    const json = (await res.json()) as {
      dryRun?: { providerCalled?: boolean; executionAvailable?: boolean };
    };
    expect(json.dryRun?.providerCalled).toBe(false);
    expect(json.dryRun?.executionAvailable).toBe(true);
    barrier.assertClean();
  });
});
