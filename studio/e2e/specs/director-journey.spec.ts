import { test, expect } from "@playwright/test";
import { loginViaUi } from "../helpers/auth";
import { installNetworkBarrier } from "../helpers/network-barrier";
import {
  fillSyntheticBrief,
  runDelivery,
  runLipsyncFake,
  runMergeExportFake,
  runProductionWithWorker,
  runRoutingAndApprove,
  runTextDirectors,
  runVoiceFake,
} from "../helpers/director-flow";

async function runHappyPath(page: import("@playwright/test").Page) {
  const barrier = await installNetworkBarrier(page);
  await loginViaUi(page);

  const name = await fillSyntheticBrief(page);
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("director-pipeline-progress")).toBeVisible();

  await page.reload();
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });

  await runTextDirectors(page);
  await runRoutingAndApprove(page);
  await runProductionWithWorker(page);
  await runVoiceFake(page);
  await runLipsyncFake(page);
  await runMergeExportFake(page);
  await runDelivery(page);

  await expect(page.getByTestId("director-export-status")).toContainText(
    /Export réel non autorisé/,
  );
  await expect(page.getByTestId("director-pipeline-summary")).toContainText(
    /Aucun média final/,
  );
  await expect(page.locator("select").filter({ hasText: /openai|fal|elevenlabs|ffmpeg/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Télécharger le média final/ })).toHaveCount(0);

  expect(barrier.blockedAttempts).toBe(0);
  barrier.assertClean();
  await barrier.dispose();
}

test.describe.serial("Parcours /director E2E fake", () => {
  test("happy path 1 — brief → export synthétique", async ({ page }) => {
    test.setTimeout(600_000);
    await runHappyPath(page);
  });

  test("happy path 2 — second passage idempotent", async ({ page }) => {
    test.setTimeout(600_000);
    await runHappyPath(page);
  });
});
