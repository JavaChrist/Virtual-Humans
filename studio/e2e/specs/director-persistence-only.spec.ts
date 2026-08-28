import { test, expect, type Page } from "@playwright/test";
import { loginViaUi } from "../helpers/auth";
import { installNetworkBarrier } from "../helpers/network-barrier";

const PROVIDER_UI_RE = /openai|elevenlabs|fal\.ai|kling|runway/i;
const PROJECT_NAME = "186 persistence preflight local";

async function fillPersistenceBrief(page: Page): Promise<void> {
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
  await page.locator("#projectName").fill(PROJECT_NAME);
  await page.locator("#subjectType").selectOption("product");
  await page.getByLabel("Nom du sujet").fill("RideCloud persistence-only");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Brief local isolé pour le preflight persistence 186.");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Objectif").selectOption("conversion");
  await page.getByLabel(/Audience/).fill("Audience locale de preflight persistence.");
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

test.describe("Director persistence-only production-like local", () => {
  test("non authentifié → login ; APIs Director 401", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    const res = await page.goto("/director", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login/);
    const api = await page.request.get("/api/director/projects");
    expect(api.status()).toBe(401);
    barrier.assertClean();
  });

  test("authentifié : create visible, liste, APIs plus en 404, zéro provider", async ({
    page,
  }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await expect(page.getByRole("link", { name: "Réalisateur IA" })).toBeVisible();

    await page.goto("/director", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Réalisateur IA" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer une vidéo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Projets récents" })).toBeVisible();
    await expect(page.getByText(PROVIDER_UI_RE)).toHaveCount(0);

    const flags = await page.evaluate(async () => {
      const res = await fetch("/api/settings", { credentials: "same-origin" });
      const body = (await res.json().catch(() => ({}))) as {
        features?: { directorV2?: boolean; directorV2Persistence?: boolean };
      };
      return { status: res.status, features: body.features };
    });
    expect(flags.status).toBe(200);
    expect(flags.features?.directorV2).toBe(true);
    expect(flags.features?.directorV2Persistence).toBe(true);

    const list = await page.evaluate(async () => {
      const res = await fetch("/api/director/projects", { credentials: "same-origin" });
      return res.status;
    });
    expect(list).not.toBe(404);
    expect([200, 500, 503]).toContain(list);

    await fillPersistenceBrief(page);
    await expect(page.getByRole("button", { name: "Créer le projet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Valider le brief" })).toHaveCount(0);

    barrier.assertClean();
    expect(barrier.blockedAttempts).toBe(0);
  });

  test("création locale, replay, reprise, révision, pipeline réel disabled", async ({
    page,
  }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);

    const listBefore = await page.evaluate(async () => {
      const res = await fetch("/api/director/projects", { credentials: "same-origin" });
      return res.status;
    });
    if (listBefore !== 200) {
      test.info().annotations.push({
        type: "note",
        description: `Supabase local indisponible — durable path skipped (${listBefore}).`,
      });
      const created = await page.evaluate(async () => {
        const res = await fetch("/api/director/projects", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectId: "not-a-uuid" }),
        });
        return res.status;
      });
      expect(created).not.toBe(404);
      barrier.assertClean();
      return;
    }

    await fillPersistenceBrief(page);
    const createBtn = page.getByRole("button", { name: "Créer le projet" });
    await createBtn.click();
    await expect(page).toHaveURL(/\/director\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const projectUrl = page.url();
    const projectId = projectUrl.match(/\/director\/([0-9a-f-]{36})/)?.[1];
    expect(projectId).toBeTruthy();

    await expect(page.getByText(PROJECT_NAME).first()).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: /Lancer l’analyse marketing — indisponible/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Télécharger|Publier/i })).toHaveCount(0);

    const replay = await page.evaluate(async (id) => {
      const first = await fetch("/api/director/projects", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          expectedBriefRevision: 1,
          fields: {
            projectName: "186 persistence preflight local",
            subjectType: "product",
            subjectName: "RideCloud persistence-only",
            subjectDescription: "Brief local isolé pour le preflight persistence 186.",
            objective: "conversion",
            audienceDescription: "Audience locale de preflight persistence.",
            platform: "instagram",
            durationSeconds: 30,
            aspectRatio: "9:16",
            tone: "energetic",
            language: "fr",
            callToAction: "Réserver un trajet de démonstration",
          },
        }),
      });
      return { status: first.status, body: await first.json().catch(() => ({})) };
    }, projectId);
    expect([200, 409]).toContain(replay.status);

    const ghost = await page.evaluate(async () => {
      const res = await fetch(
        "/api/director/projects/11111111-1111-4111-8111-111111111111",
        { credentials: "same-origin" },
      );
      return res.status;
    });
    expect([404, 400]).toContain(ghost);

    const oversized = await page.evaluate(async () => {
      const res = await fetch("/api/director/projects", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          artifactId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          expectedBriefRevision: 1,
          fields: { projectName: "x".repeat(500), extraForbidden: true },
        }),
      });
      return res.status;
    });
    expect([400, 422]).toContain(oversized);

    const media = await page.evaluate(async (id) => {
      const res = await fetch(`/api/director/projects/${id}/export/download`, {
        credentials: "same-origin",
      });
      return res.status;
    }, projectId);
    expect([404, 409, 400, 503]).toContain(media);
    expect(media).not.toBe(200);

    await page.goto("/director", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(PROJECT_NAME).first()).toBeVisible();
    await page.getByRole("link", { name: "Reprendre" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/director/${projectId}`));

    await page.getByRole("button", { name: "Modifier le brief" }).click();
    await page.locator("#brief-edit-subjectName").fill("RideCloud persistence revised");
    await page.getByRole("button", { name: "Prévisualiser" }).click();
    await expect(page.getByText(/champ\(s\) modifié/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Créer la révision" }).click();
    await page.getByRole("button", { name: "Créer la révision" }).last().click();
    await expect(page.getByText(/Révision 2 active/i)).toBeVisible({ timeout: 20_000 });

    const conflict = await page.evaluate(async (id) => {
      const res = await fetch(`/api/director/projects/${id}/brief/revisions`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "execute",
          fields: { subjectName: "stale conflict" },
          expectedBriefRevision: 1,
          expectedProjectRevision: 1,
          confirmation: true,
        }),
      });
      return res.status;
    }, projectId);
    expect(conflict).toBe(409);

    const deleteProbe = await page.evaluate(async (id) => {
      const res = await fetch(`/api/director/projects/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      return res.status;
    }, projectId);
    expect([404, 405]).toContain(deleteProbe);

    barrier.assertClean();
    expect(barrier.blockedAttempts).toBe(0);
  });

  test("logout referme l’accès ; mobile utilisable", async ({ page }) => {
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
    await expect(page.getByRole("heading", { name: "Projets récents" })).toBeVisible();

    barrier.assertClean();
  });
});
