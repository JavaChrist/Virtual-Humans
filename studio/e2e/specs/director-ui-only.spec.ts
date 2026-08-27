import { test, expect, type Page } from "@playwright/test";
import { loginViaUi } from "../helpers/auth";
import { installNetworkBarrier } from "../helpers/network-barrier";

const PROVIDER_UI_RE = /openai|elevenlabs|fal\.ai|kling|runway/i;

async function fillLocalBrief(page: Page): Promise<void> {
  await page.goto("/director/new", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (/brief|director|vh-/i.test(key)) localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Chargement du brouillon/i)).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: /Nouveau brief/i })).toBeVisible({
    timeout: 30_000,
  });
  await page.locator("#projectName").fill("UI-only local brief");
  await page.locator("#subjectType").selectOption("product");
  await page.getByLabel("Nom du sujet").fill("RideCloud UI-only");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Brief local sans persistence ni provider.");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Objectif").selectOption("conversion");
  await page.getByLabel(/Audience/).fill("Audience locale de preflight.");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Plateforme").selectOption("instagram");
  await page.getByLabel("Durée").selectOption("30");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Ton").selectOption("energetic");
  await page.getByLabel("Langue").fill("fr");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel(/Appel à l.action/).fill("Réserver un trajet de démonstration");
  await page.getByRole("button", { name: "Continuer" }).click();
}

test.describe("Director UI-only production-like local", () => {
  test("non authentifié → login", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    const res = await page.goto("/director", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login/);
    barrier.assertClean();
  });

  test("authentifié : nav + home visibles, dashboard intact, zéro provider", async ({
    page,
  }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await expect(page.getByRole("link", { name: "Réalisateur IA" })).toBeVisible();

    const dash = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(dash?.ok()).toBeTruthy();
    await expect(page.getByRole("link", { name: "Tableau de bord" })).toBeVisible();

    const director = await page.goto("/director", { waitUntil: "domcontentloaded" });
    expect(director?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Réalisateur IA" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer une vidéo" })).toBeVisible();
    await expect(page.getByText(/Aucun fournisseur ni modèle/i)).toBeVisible();
    await expect(page.getByText(PROVIDER_UI_RE)).toHaveCount(0);
    await expect(page.getByText(/Projets récents/i)).toHaveCount(0);

    barrier.assertClean();
    expect(barrier.blockedAttempts).toBe(0);
  });

  test("brief local only — pas de création, pas de download, APIs 404", async ({
    page,
  }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillLocalBrief(page);

    await expect(page.getByRole("button", { name: "Créer le projet" })).toHaveCount(0);
    await page.getByRole("button", { name: "Valider le brief" }).click();
    await expect(page.getByText(/non persisté sur un serveur/i)).toBeVisible();
    const next = page.getByRole("button", { name: /Analyse marketing — prochainement/i });
    await expect(next).toBeDisabled();

    await expect(page.getByRole("button", { name: /Télécharger|Publier/i })).toHaveCount(0);
    await expect(page.getByTestId("director-lipsync-section")).toHaveCount(0);
    await expect(page.getByTestId("director-merge-export-section")).toHaveCount(0);

    const project = await page.goto(
      "/director/11111111-1111-4111-8111-111111111111",
      { waitUntil: "domcontentloaded" },
    );
    expect(project?.status()).toBe(404);

    const apiStatuses = await page.evaluate(async () => {
      const list = await fetch("/api/director/projects", { credentials: "same-origin" });
      const created = await fetch("/api/director/projects", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: "11111111-1111-4111-8111-111111111111" }),
      });
      return { list: list.status, created: created.status };
    });
    expect(apiStatuses.list).toBe(404);
    expect(apiStatuses.created).toBe(404);

    barrier.assertClean();
  });

  test("logout puis reprise login ; mobile utilisable", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await page.goto("/director", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Déconnexion/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    const again = await page.goto("/director", { waitUntil: "domcontentloaded" });
    expect(again?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login/);

    await page.setViewportSize({ width: 390, height: 844 });
    await loginViaUi(page);
    const menu = page.getByRole("button", { name: "Ouvrir le menu" });
    if ((await menu.count()) > 0) {
      await menu.click();
    }
    await expect(page.getByRole("link", { name: "Réalisateur IA" })).toBeVisible();
    await page.goto("/director", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Réalisateur IA" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer une vidéo" })).toBeVisible();

    barrier.assertClean();
  });
});
