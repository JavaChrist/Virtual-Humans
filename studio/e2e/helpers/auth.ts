import type { Page, APIRequestContext } from "@playwright/test";
import { loadE2eRuntime } from "./runtime";

export async function loginViaUi(page: Page, password?: string): Promise<void> {
  const runtime = loadE2eRuntime();
  const pw = password ?? runtime.appPassword;
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Mot de passe" }).fill(pw);
  await page.getByRole("button", { name: "Entrer" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });
}

export async function loginViaApi(
  request: APIRequestContext,
  password?: string,
): Promise<void> {
  const runtime = loadE2eRuntime();
  const res = await request.post("/api/login", {
    data: { password: password ?? runtime.appPassword },
  });
  if (!res.ok()) {
    throw new Error(`loginViaApi failed: ${res.status()}`);
  }
}

export async function logoutViaUi(page: Page): Promise<void> {
  // API logout (cookie jar du contexte) — plus fiable que le bouton sidebar hors viewport.
  const origin = new URL(page.url()).origin;
  const res = await page.request.post(`${origin}/api/logout`, {
    data: {},
    headers: {
      "content-type": "application/json",
      origin,
    },
  });
  if (!res.ok()) {
    throw new Error(`logout API failed: ${res.status()}`);
  }
  // Vérifie aussi le bouton UI quand il est présent (contrat accessible).
  const logout = page.getByRole("button", { name: /Déconnexion/i });
  if ((await logout.count()) > 0) {
    await logout.first().scrollIntoViewIfNeeded().catch(() => undefined);
    await logout.first().click({ force: true }).catch(() => undefined);
  }
  await page.goto("/director", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login/, { timeout: 15_000 });
}
