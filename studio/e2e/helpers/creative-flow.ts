import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Must match `E2E_FAKE_FAIL_HEADER` in e2e-request-context.ts */
const E2E_FAKE_FAIL_HEADER = "x-vh-e2e-fake-fail";

export async function runMarketingPrereq(page: Page): Promise<void> {
  const mkt = page.locator("section").filter({
    has: page.getByRole("heading", { name: /Stratégie marketing/i }),
  });
  await mkt.getByRole("button", { name: "Vérifier le brief" }).click();
  const exec = mkt.getByRole("button", {
    name: "Lancer l’analyse marketing",
    exact: true,
  });
  await expect(exec).toBeEnabled({ timeout: 30_000 });
  await exec.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole("button", { name: "Lancer l’analyse" }).click();
  // Must not match the section heading alone.
  await expect(
    mkt.getByText(/Stratégie marketing enregistrée|Objectif/i).first(),
  ).toBeVisible({ timeout: 60_000 });
  await expect(mkt.getByText(/^Révision$/i).first()).toBeVisible({
    timeout: 15_000,
  });
}

export function creativeSection(page: Page) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: "Direction créative", exact: true }),
  });
}

export async function creativeDryRunReady(page: Page): Promise<void> {
  const section = creativeSection(page);
  await section.getByRole("button", { name: "Vérifier les prérequis" }).click();
  await expect(
    section.getByText(/Dry-run · prêt · exécution autorisable/i),
  ).toBeVisible({ timeout: 30_000 });
  await expect(section.getByText(/Marketing Plan rev\.\s*[1-9]/i)).toBeVisible();
  await expect(
    section.getByRole("button", {
      name: "Lancer l’analyse créative",
      exact: true,
    }),
  ).toBeEnabled({ timeout: 10_000 });
}

export async function openCreativeConfirmModal(page: Page) {
  const section = creativeSection(page);
  const exec = section.getByRole("button", {
    name: "Lancer l’analyse créative",
    exact: true,
  });
  await exec.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(
    dialog.getByRole("heading", { name: /analyse créative/i }),
  ).toBeVisible();
  await expect(dialog.getByText(/payant/i)).toBeVisible();
  await expect(dialog.getByText(/Modèle\s*:/i)).toBeVisible();
  await expect(dialog.getByText(/Reasoning\s*:/i)).toBeVisible();
  await expect(dialog.getByText(/max_output_tokens\s*:/i)).toBeVisible();
  await expect(dialog.getByText(/Aucun retry automatique/i)).toBeVisible();
  await expect(dialog.getByText(/Brief rev\./i)).toBeVisible();
  await expect(dialog.getByText(/Marketing Plan rev\./i)).toBeVisible();
  await expect(dialog.getByText(/creative-analyzer-v4/i)).toBeVisible();
  return dialog;
}

/** Installs a one-shot header on Creative execute POSTs only. */
export async function withCreativeFakeFail(
  page: Page,
  mode: string,
  fn: () => Promise<void>,
): Promise<void> {
  const headerValue = mode.startsWith("creative:") ? mode : `creative:${mode}`;
  await page.route("**/api/director/projects/*/creative", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      const body = req.postDataJSON() as { mode?: string } | null;
      if (body?.mode === "execute") {
        const headers = {
          ...req.headers(),
          [E2E_FAKE_FAIL_HEADER]: headerValue,
        };
        await route.continue({ headers });
        return;
      }
    }
    await route.continue();
  });
  try {
    await fn();
  } finally {
    await page.unroute("**/api/director/projects/*/creative");
  }
}

export async function executeCreativeExpectError(
  page: Page,
  opts: {
    failMode: string;
    expectedCode: string;
    messageRe: RegExp;
  },
): Promise<void> {
  await creativeDryRunReady(page);
  await withCreativeFakeFail(page, opts.failMode, async () => {
    const dialog = await openCreativeConfirmModal(page);
    const respPromise = page.waitForResponse(
      (r) =>
        r.url().includes("/creative") &&
        r.request().method() === "POST" &&
        (r.request().postDataJSON() as { mode?: string })?.mode === "execute",
      { timeout: 60_000 },
    );
    await dialog.getByRole("button", { name: "Lancer l’analyse" }).click();
    const resp = await respPromise;
    expect(resp.ok(), `creative execute should fail HTTP ${resp.status()}`).toBeFalsy();
    const json = (await resp.json()) as {
      error?: { code?: string; message?: string; retryable?: boolean };
    };
    expect(json.error?.code).toBe(opts.expectedCode);
    expect(json.error?.retryable).toBe(false);
    expect(json.error?.message ?? "").toMatch(opts.messageRe);
    expect(json.error?.message ?? "").not.toMatch(/marketing/i);

    const section = creativeSection(page);
    await expect(section.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    const alertText = await section.getByRole("alert").innerText();
    expect(alertText).toMatch(opts.messageRe);
    expect(alertText).not.toMatch(/marketing/i);
    // Prefer Creative wording; domain hard-gate may use IP/imitation copy.
    expect(alertText).toMatch(
      /créative|créatif|candidat créatif|artiste|imitation|IP non autorisée/i,
    );
  });
}
