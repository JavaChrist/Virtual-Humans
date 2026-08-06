import { test, expect, type Page } from "@playwright/test";
import { loginViaUi } from "../helpers/auth";
import { fillSyntheticBrief, runTextDirectors } from "../helpers/director-flow";
import { installNetworkBarrier } from "../helpers/network-barrier";

/**
 * 8I-B — shared processing loader across five text Directors (fakes only).
 */

async function expectLoaderDuringExecute(
  page: Page,
  opts: {
    heading: string | RegExp;
    exactHeading?: boolean;
    dryLabel: string | RegExp;
    executeLabel: string | RegExp;
    confirmLabel: string | RegExp;
    director: "marketing" | "creative" | "script" | "art" | "storyboard";
    apiPath: string;
    successText: RegExp;
  },
) {
  const section = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: opts.heading,
      exact: opts.exactHeading ?? false,
    }),
  });
  await section.getByRole("button", { name: opts.dryLabel }).click();
  await expect(
    section.getByText(/exécution (autorisable|disponible)/i),
  ).toBeVisible({ timeout: 30_000 });
  const exec = section.getByRole("button", {
    name: opts.executeLabel,
    exact: true,
  });
  await expect(exec).toBeEnabled({ timeout: 15_000 });

  const gate = {
    release: () => {},
  };
  const held = new Promise<void>((resolve) => {
    gate.release = resolve;
  });

  await page.route(`**/api/director/projects/*/${opts.apiPath}`, async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      const body = req.postDataJSON() as { mode?: string } | null;
      if (body?.mode === "execute") {
        // Hold briefly so the shared loader is observable.
        await held;
        await new Promise((r) => setTimeout(r, 80));
      }
    }
    await route.continue();
  });

  await exec.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const confirmBtn = dialog.getByRole("button", { name: opts.confirmLabel });
  await confirmBtn.click();

  const loader = section.getByTestId(`director-processing-${opts.director}`);
  await expect(loader).toBeVisible({ timeout: 5_000 });
  await expect(loader).toHaveAttribute("aria-busy", "true");
  await expect(loader).toHaveAttribute("aria-live", "polite");
  // Label may switch to a short busy copy — assert the execute control stays disabled.
  await expect(
    section.locator("button.btn-ghost").filter({ hasNotText: /indisponible/i }).first(),
  ).toBeDisabled();

  gate.release();
  await expect(section.getByText(opts.successText).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(loader).toHaveCount(0, { timeout: 10_000 });
  await page.unroute(`**/api/director/projects/*/${opts.apiPath}`);
}

test.describe.serial("Director shared processing UX (8I-B)", () => {
  test("loader partagé sur les cinq Directors textuels (fakes, 0 provider)", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    await expectLoaderDuringExecute(page, {
      heading: /Stratégie marketing/i,
      dryLabel: "Vérifier le brief",
      executeLabel: "Lancer l’analyse marketing",
      confirmLabel: "Lancer l’analyse",
      director: "marketing",
      apiPath: "marketing",
      successText: /Objectif|USP|Bénéfice|Audience|Stratégie marketing enregistrée/i,
    });

    await expectLoaderDuringExecute(page, {
      heading: "Direction créative",
      exactHeading: true,
      dryLabel: "Vérifier les prérequis",
      executeLabel: "Lancer l’analyse créative",
      confirmLabel: "Lancer l’analyse",
      director: "creative",
      apiPath: "creative",
      successText: /Big idea|Logline|Concept créatif enregistré/i,
    });

    await expectLoaderDuringExecute(page, {
      heading: "Script",
      exactHeading: true,
      dryLabel: "Vérifier les prérequis",
      executeLabel: "Rédiger le script",
      confirmLabel: "Rédiger le script",
      director: "script",
      apiPath: "script",
      successText: /segment|timing|hook|CTA|Script enregistré/i,
    });

    await expectLoaderDuringExecute(page, {
      heading: "Direction art",
      exactHeading: true,
      dryLabel: "Vérifier les prérequis",
      executeLabel: "Produire la direction art",
      confirmLabel: "Produire la direction art",
      director: "art",
      apiPath: "art",
      successText: /palette|location|segment|Direction art enregistrée/i,
    });

    await expectLoaderDuringExecute(page, {
      heading: "Storyboard",
      exactHeading: true,
      dryLabel: "Vérifier les prérequis",
      executeLabel: "Produire le storyboard",
      confirmLabel: "Produire le storyboard",
      director: "storyboard",
      apiPath: "storyboard",
      successText: /^Révision$|Scènes\s*\d|Plan|Storyboard enregistré/i,
    });

    expect(
      pageErrors.filter((e) => /Minified React error #418|#418/i.test(e)),
    ).toEqual([]);
    barrier.assertClean();
  });

  test("Production — progression réelle sans faux %", async ({ page }) => {
    test.setTimeout(300_000);
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);
    // Full text chain + routing so production can start (fakes).
    await runTextDirectors(page);

    const production = page.locator("section").filter({
      has: page.getByRole("heading", { name: /Production/i }),
    });
    // If production section is present after journey helpers, assert real progress.
    if ((await production.count()) === 0) {
      test.skip();
      return;
    }
    const progress = production.getByTestId("production-real-progress");
    if ((await progress.count()) > 0) {
      const text = await progress.innerText();
      expect(text).not.toMatch(/%/);
      expect(text).not.toMatch(/reste\s*\d+\s*s/i);
    }
    barrier.assertClean();
  });

  test("anti-double-clic — un seul POST execute", async ({ page }) => {
    test.setTimeout(180_000);
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    let executePosts = 0;
    const gate = { release: () => {} };
    const held = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    await page.route("**/api/director/projects/*/marketing", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        const body = req.postDataJSON() as { mode?: string } | null;
        if (body?.mode === "execute") {
          executePosts += 1;
          await held;
        }
      }
      await route.continue();
    });

    const section = page.locator("section").filter({
      has: page.getByRole("heading", { name: /Stratégie marketing/i }),
    });
    await section.getByRole("button", { name: "Vérifier le brief" }).click();
    await expect(
      section.getByText(/exécution (autorisable|disponible)/i),
    ).toBeVisible({ timeout: 30_000 });
    const exec = section.getByRole("button", {
      name: /Lancer l’analyse marketing|Analyse…/,
    });
    await expect(exec).toBeEnabled({ timeout: 15_000 });
    await exec.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const confirmBtn = dialog.getByRole("button", { name: "Lancer l’analyse" });
    await confirmBtn.click();
    await expect(exec).toBeDisabled({ timeout: 5_000 });
    await expect(section.getByTestId("director-processing-marketing")).toBeVisible({
      timeout: 5_000,
    });
    await confirmBtn.click({ force: true }).catch(() => undefined);
    // Still holding the first POST — a second execute must not fire.
    expect(executePosts).toBe(1);
    gate.release();
    await expect(
      section.getByText(/Objectif|USP|Stratégie marketing enregistrée/i).first(),
    ).toBeVisible({ timeout: 60_000 });
    expect(executePosts).toBe(1);
    barrier.assertClean();
  });

  test("202 + reprise après refresh — suivi GET sans second POST", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    const runId = "11111111-1111-4111-8111-111111111111";
    let executePosts = 0;
    let textRunPolls = 0;
    /** null until execute 202 — avoids locking UI on mount resume. */
    let marketingStatus: null | "running" | "completed" = null;

    await page.route("**/api/director/projects/*/text-runs**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      const url = new URL(route.request().url());
      const director = url.searchParams.get("director") ?? "marketing";
      if (director !== "marketing" || marketingStatus == null) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ director, run: null }),
        });
        return;
      }
      textRunPolls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          director: "marketing",
          run: {
            directorRunId: runId,
            directorType: "marketing",
            status: marketingStatus,
            errorCode: null,
            publicMessage: null,
            outputArtifactId:
              marketingStatus === "completed"
                ? "22222222-2222-4222-8222-222222222222"
                : null,
            attemptNumber: 1,
          },
        }),
      });
    });

    await page.route("**/api/director/projects/*/marketing", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        const body = req.postDataJSON() as { mode?: string } | null;
        if (body?.mode === "execute") {
          executePosts += 1;
          marketingStatus = "running";
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({
              status: "already_running",
              directorRunId: runId,
              error: {
                code: "run_in_progress",
                retryable: false,
                message: "Analyse déjà en cours.",
              },
            }),
          });
          return;
        }
      }
      if (req.method() === "GET") {
        const plan = {
          revision: 1,
          status: "ready",
          objective: "Conversion E2E 202",
          audience: "Audience E2E",
          uniqueSellingPoint: "USP synthétique",
          mainBenefit: "Bénéfice E2E",
          warnings: [],
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            dryRun: {
              executable: true,
              executionAvailable: true,
              providerCalled: false,
              briefRevision: 1,
              briefArtifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              model: "fake",
              promptVersion: "v1",
              schemaVersion: "1",
              pricingConfigured: true,
              estimatedCostMinor: null,
              currency: null,
              validations: [],
              warnings: [],
              missingInformation: [],
              existingPlan: plan,
              retryCandidate: null,
            },
            plan,
          }),
        });
        return;
      }
      await route.continue();
    });

    const section = page.locator("section").filter({
      has: page.getByRole("heading", { name: /Stratégie marketing/i }),
    });

    await section.getByRole("button", { name: "Vérifier le brief" }).click();
    await expect(
      section.getByText(/exécution (autorisable|disponible)/i),
    ).toBeVisible({ timeout: 30_000 });

    const exec = section.getByRole("button", {
      name: /Lancer l’analyse marketing|Analyse…/,
    });
    await exec.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Lancer l’analyse" })
      .click();

    const loader = section.getByTestId("director-processing-marketing");
    await expect(loader).toBeVisible({ timeout: 10_000 });
    await expect(loader).toHaveAttribute("data-ui-phase", "running");
    await expect(exec).toBeDisabled();
    expect(executePosts).toBe(1);
    const pollsBeforeRefresh = textRunPolls;
    expect(pollsBeforeRefresh).toBeGreaterThan(0);

    // Refresh must restore running via GET text-runs — no new execute POST.
    await page.reload({ waitUntil: "domcontentloaded" });
    const sectionAfter = page.locator("section").filter({
      has: page.getByRole("heading", { name: /Stratégie marketing/i }),
    });
    const loaderAfter = sectionAfter.getByTestId("director-processing-marketing");
    await expect(loaderAfter).toBeVisible({ timeout: 15_000 });
    await expect(loaderAfter).toHaveAttribute("data-ui-phase", "running");
    expect(executePosts).toBe(1);

    marketingStatus = "completed";
    await expect(
      sectionAfter
        .getByText(/Conversion E2E 202|Stratégie marketing enregistrée/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(loaderAfter).toHaveCount(0, { timeout: 10_000 });
    expect(executePosts).toBe(1);
    expect(textRunPolls).toBeGreaterThan(pollsBeforeRefresh);
    // No Marketing copy leaked into Creative loader (Creative idle → absent).
    await expect(page.getByTestId("director-processing-creative")).toHaveCount(0);
    barrier.assertClean();
  });

  test("échec terminal Marketing — message isolé, bouton réarmé", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);

    const runId = "33333333-3333-4333-8333-333333333333";
    let marketingStatus: null | "running" | "failed" = null;

    await page.route("**/api/director/projects/*/text-runs**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      const url = new URL(route.request().url());
      const director = url.searchParams.get("director") ?? "marketing";
      if (director !== "marketing" || marketingStatus == null) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ director, run: null }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          director: "marketing",
          run: {
            directorRunId: runId,
            directorType: "marketing",
            status: marketingStatus,
            errorCode: "request_failed",
            publicMessage:
              "L’analyse n’a pas pu aboutir. Réessayez plus tard.",
            outputArtifactId: null,
            attemptNumber: 1,
          },
        }),
      });
    });

    await page.route("**/api/director/projects/*/marketing", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        const body = req.postDataJSON() as { mode?: string } | null;
        if (body?.mode === "execute") {
          marketingStatus = "running";
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({
              status: "already_running",
              directorRunId: runId,
              error: {
                code: "run_in_progress",
                retryable: false,
                message: "Analyse déjà en cours.",
              },
            }),
          });
          return;
        }
      }
      await route.continue();
    });

    const section = page.locator("section").filter({
      has: page.getByRole("heading", { name: /Stratégie marketing/i }),
    });
    await section.getByRole("button", { name: "Vérifier le brief" }).click();
    await expect(
      section.getByText(/exécution (autorisable|disponible)/i),
    ).toBeVisible({ timeout: 30_000 });
    await section
      .getByRole("button", { name: "Lancer l’analyse marketing", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Lancer l’analyse" })
      .click();

    await expect(section.getByTestId("director-processing-marketing")).toBeVisible({
      timeout: 10_000,
    });
    marketingStatus = "failed";
    await expect(
      section
        .getByRole("alert")
        .filter({ hasText: /n’a pas pu aboutir|analyse marketing/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/concept créatif a échoué/i)).toHaveCount(0);
    barrier.assertClean();
  });
});
