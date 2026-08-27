import { test, expect } from "@playwright/test";
import { loginViaUi } from "../helpers/auth";
import { fillSyntheticBrief } from "../helpers/director-flow";
import { installNetworkBarrier } from "../helpers/network-barrier";

test.describe("Opérabilité /director fake", () => {
  test("prérequis manquant : lipsync et assemblage bloqués", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    const lipsync = page.getByTestId("director-lipsync-section");
    await expect(lipsync.getByRole("button", { name: /Préparer le fake local/ })).toBeDisabled();
    await expect(lipsync.getByRole("button", { name: /Exécution réelle indisponible/ })).toBeDisabled();

    const merge = page.getByTestId("director-merge-export-section");
    await expect(
      merge.getByRole("button", { name: /Préparer le manifeste synthétique/ }),
    ).toBeDisabled();
    await expect(merge.getByRole("button", { name: /Merge réel indisponible/ })).toBeDisabled();
    await expect(merge.getByText(/Référence vidéo|Référence audio|Output lipsync/i).first()).toBeVisible();

    expect(barrier.blockedAttempts).toBe(0);
    barrier.assertClean();
  });

  test("erreur synthétique à marketing puis reprise", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    let failedOnce = false;
    await page.route("**/api/director/projects/*/marketing", async (route) => {
      const body = route.request().postDataJSON() as { mode?: string } | null;
      if (route.request().method() === "POST" && body?.mode === "execute" && !failedOnce) {
        failedOnce = true;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Erreur synthétique E2E. Relancez un dry-run avant une nouvelle tentative.",
          }),
        });
        return;
      }
      await route.continue();
    });

    const marketing = page.locator("section").filter({
      has: page.getByRole("heading", { name: /Stratégie marketing/i }),
    });
    await marketing.getByRole("button", { name: "Vérifier le brief" }).click();
    const exec = marketing.getByRole("button", { name: "Lancer l’analyse marketing", exact: true });
    await expect(exec).toBeEnabled({ timeout: 20_000 });
    await exec.click();
    await page.getByRole("dialog").getByRole("button", { name: "Lancer l’analyse" }).click();
    await expect(marketing.getByRole("alert").or(marketing.getByText(/Erreur synthétique|impossible/i))).toBeVisible({
      timeout: 20_000,
    });

    await marketing.getByRole("button", { name: "Vérifier le brief" }).click();
    const retry = marketing.getByRole("button", { name: "Lancer l’analyse marketing", exact: true });
    await expect(retry).toBeEnabled({ timeout: 20_000 });
    await retry.click();
    await page.getByRole("dialog").getByRole("button", { name: "Lancer l’analyse" }).click();
    await expect(marketing.getByText(/Objectif|USP|Bénéfice|Audience|enregistrée/i).first()).toBeVisible({
      timeout: 60_000,
    });

    expect(barrier.blockedAttempts).toBe(0);
    barrier.assertClean();
    await page.unroute("**/api/director/projects/*/marketing");
  });

  test("annulation + double clic sans double dialogue", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    const marketing = page.locator("section").filter({
      has: page.getByRole("heading", { name: /Stratégie marketing/i }),
    });
    await marketing.getByRole("button", { name: "Vérifier le brief" }).click();
    const exec = marketing.getByRole("button", { name: "Lancer l’analyse marketing", exact: true });
    await expect(exec).toBeEnabled({ timeout: 20_000 });
    await exec.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^Annuler$/i }).click();
    await expect(dialog).toHaveCount(0);

    await exec.click();
    await exec.click({ force: true }).catch(() => undefined);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.getByRole("dialog").getByRole("button", { name: "Lancer l’analyse" }).click();
    await expect(marketing.getByText(/Objectif|USP|Bénéfice|Audience/i).first()).toBeVisible({
      timeout: 60_000,
    });

    expect(barrier.blockedAttempts).toBe(0);
    barrier.assertClean();
  });

  test("refresh conserve le brief et n’ouvre aucun provider", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    const name = await fillSyntheticBrief(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
    expect(barrier.blockedAttempts).toBe(0);
    barrier.assertClean();
  });

  test("lipsync et merge/export : fake only, pas de sélecteur provider", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    await expect(page.getByTestId("director-lipsync-section")).toBeVisible();
    await expect(page.getByTestId("director-merge-export-section")).toBeVisible();
    await expect(page.getByTestId("director-export-status")).toContainText(/Export réel non autorisé/);
    await expect(page.locator("#section-lipsync select")).toHaveCount(0);
    await expect(page.locator("#section-merge-export select")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Télécharger le média final/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /publier/i })).toHaveCount(0);

    expect(barrier.blockedAttempts).toBe(0);
    barrier.assertClean();
  });

  test("clavier : progression accessible et focus visible", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    const nav = page.getByTestId("director-pipeline-progress");
    const first = nav.getByRole("link").first();
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link").nth(1)).toBeFocused();

    expect(barrier.blockedAttempts).toBe(0);
    barrier.assertClean();
  });

  test("blocker visible pendant execute marketing, cleanup ensuite", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    const marketing = page.locator("section").filter({
      has: page.getByRole("heading", { name: /Stratégie marketing/i }),
    });
    await marketing.getByRole("button", { name: "Vérifier le brief" }).click();
    const exec = marketing.getByRole("button", { name: "Lancer l’analyse marketing", exact: true });
    await expect(exec).toBeEnabled({ timeout: 20_000 });

    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/director/projects/*/marketing", async (route) => {
      const body = route.request().postDataJSON() as { mode?: string } | null;
      if (route.request().method() === "POST" && body?.mode === "execute") {
        await held;
      }
      await route.continue();
    });

    await exec.click();
    await page.getByRole("dialog").getByRole("button", { name: "Lancer l’analyse" }).click();
    await expect(page.getByTestId("director-update-blockers")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("director-update-blockers")).toContainText(/génération|enregistrement/i);

    release();
    await expect(marketing.getByText(/Objectif|USP|Bénéfice|Audience/i).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId("director-update-blockers")).toHaveCount(0, { timeout: 15_000 });

    expect(barrier.blockedAttempts).toBe(0);
    barrier.assertClean();
    await page.unroute("**/api/director/projects/*/marketing");
  });
});

test.describe("Opérabilité mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("actions essentielles visibles sans débordement", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    await expect(page.getByTestId("director-pipeline-progress")).toBeVisible();
    await expect(page.getByRole("button", { name: "Vérifier le brief" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 8,
    );
    expect(overflow).toBe(false);

    expect(barrier.blockedAttempts).toBe(0);
    barrier.assertClean();
  });
});
