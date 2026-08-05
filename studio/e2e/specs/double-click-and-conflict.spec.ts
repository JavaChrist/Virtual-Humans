import { test, expect } from "@playwright/test";
import { loginViaUi } from "../helpers/auth";
import { fillSyntheticBrief } from "../helpers/director-flow";
import { installNetworkBarrier } from "../helpers/network-barrier";

test.describe("Double-clic + conflit révision", () => {
  test("double-clic marketing → un seul artifact durable", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    await page.getByRole("button", { name: "Vérifier le brief" }).click();
    const exec = page.getByRole("button", { name: "Lancer l’analyse marketing" });
    await expect(exec).toBeEnabled({ timeout: 20_000 });

    await exec.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Lancer l’analyse" });
    await confirm.dblclick({ delay: 30 }).catch(async () => {
      await confirm.click();
      await confirm.click({ force: true }).catch(() => undefined);
    });

    await expect(page.getByText(/Stratégie marketing|révision/i).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Vérifier le brief" }).click();
    await expect(page.getByText(/révision|exist/i).first()).toBeVisible({
      timeout: 20_000,
    });
    barrier.assertClean();
  });

  test("hydratation Director — load, refresh, modale Marketing sans #418", async ({
    page,
  }) => {
    const barrier = await installNetworkBarrier(page);
    const hydrationErrors: string[] = [];
    page.on("pageerror", (err) => {
      const msg = String(err?.message ?? err);
      if (/hydrat|Minified React error #418|#418/i.test(msg)) {
        hydrationErrors.push(msg);
      }
    });
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (/hydrat|Minified React error #418|#418|did not match/i.test(text)) {
        hydrationErrors.push(text);
      }
    });

    await loginViaUi(page);
    await fillSyntheticBrief(page);
    const projectUrl = page.url();

    await expect(page.getByRole("heading", { name: /Brief/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: /Brief/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(page.url()).toContain(new URL(projectUrl).pathname);

    await page.getByRole("button", { name: "Vérifier le brief" }).click();
    const exec = page.getByRole("button", { name: "Lancer l’analyse marketing" });
    await expect(exec).toBeEnabled({ timeout: 20_000 });
    await exec.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole("button", { name: /Annuler|Fermer|Cancel/i }).click().catch(async () => {
      await page.keyboard.press("Escape");
    });

    expect(
      hydrationErrors,
      `hydration errors: ${hydrationErrors.join(" | ")}`,
    ).toEqual([]);
    barrier.assertClean();
  });

  test("conflit de révision Brief → 409", async ({ page, context }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);
    const url = page.url();
    const origin = new URL(url).origin;
    const projectId = url.match(/\/director\/([0-9a-f-]{36})/i)?.[1];
    expect(projectId).toBeTruthy();

    // Deux contextes : page2 reste sur la révision 1.
    const page2 = await context.newPage();
    const barrier2 = await installNetworkBarrier(page2);
    await page2.goto(url);
    await expect(page2.getByRole("heading", { name: /Brief/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // page1 : révision brief via API (contrat 409, pas de dépendance au bouton disabled).
    const projectGet = await page.request.get(`/api/director/projects/${projectId}`, {
      headers: { Origin: origin, Referer: page.url() },
    });
    expect(projectGet.ok()).toBeTruthy();
    const projectJson = (await projectGet.json()) as {
      view?: {
        project?: { activeRevision?: number };
        brief?: { revision?: number; projectName?: string };
      };
    };
    const briefRev = projectJson.view?.brief?.revision ?? 1;
    const projectRev = projectJson.view?.project?.activeRevision ?? 1;

    const revise = await page.request.post(
      `/api/director/projects/${projectId}/brief/revisions`,
      {
        data: {
          mode: "execute",
          fields: { projectName: `E2E Revised ${Date.now()}` },
          expectedBriefRevision: briefRev,
          expectedProjectRevision: projectRev,
          confirmation: true,
        },
        headers: {
          "content-type": "application/json",
          Origin: origin,
          Referer: page.url(),
        },
      },
    );
    expect(revise.ok(), `revise HTTP ${revise.status()}: ${await revise.text()}`).toBeTruthy();

    // page2 (et API) : marketing avec ancienne révision → 409, pas d'écrasement.
    const stale = await page2.request.post(
      `/api/director/projects/${projectId}/marketing`,
      {
        data: {
          mode: "execute",
          expectedBriefRevision: briefRev,
        },
        headers: {
          "content-type": "application/json",
          Origin: origin,
          Referer: page2.url(),
        },
      },
    );
    const staleBody = await stale.text();
    expect(stale.status(), staleBody).toBe(409);
    expect(staleBody).toMatch(/changé|conflit|révision/i);

    await page2.close();
    barrier.assertClean();
    barrier2.assertClean();
  });
});
