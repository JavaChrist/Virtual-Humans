import { test, expect } from "@playwright/test";
import { loginViaUi } from "../helpers/auth";
import { installNetworkBarrier } from "../helpers/network-barrier";

test.describe("Director flag off", () => {
  test("/director → 404 et pas de lien nav", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    const res = await page.goto("/director");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Réalisateur IA" })).toHaveCount(0);
    barrier.assertClean();
  });
});
