import { test, expect } from "@playwright/test";
import { loginViaUi } from "../helpers/auth";
import { fillSyntheticBrief } from "../helpers/director-flow";
import { installNetworkBarrier } from "../helpers/network-barrier";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("Mobile + clavier", () => {
  test("login, brief, focus et absence de débordement critique", async ({
    page,
  }) => {
    const barrier = await installNetworkBarrier(page);
    await page.goto("/login");

    await page.getByRole("textbox", { name: "Mot de passe" }).focus();
    await expect(page.getByRole("textbox", { name: "Mot de passe" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: /Afficher le mot de passe/ }),
    ).toBeFocused();

    await loginViaUi(page);
    await fillSyntheticBrief(page);

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 8;
    });
    expect(overflow).toBe(false);

    // Escape on confirm if opened
    await page.getByRole("button", { name: "Vérifier le brief" }).click();
    await page.getByRole("button", { name: "Lancer l’analyse marketing" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    // dialog may close via Escape if ConfirmProvider supports it
    barrier.assertClean();
  });
});
