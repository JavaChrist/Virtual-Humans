import { test, expect } from "@playwright/test";
import { logoutViaUi } from "../helpers/auth";
import { loadE2eRuntime } from "../helpers/runtime";
import { installNetworkBarrier } from "../helpers/network-barrier";

test.describe("Auth + bouton œil", () => {
  test("non authentifié → redirect login ; API 401 JSON", async ({ page, request }) => {
    const barrier = await installNetworkBarrier(page);
    await page.goto("/director");
    await expect(page).toHaveURL(/\/login/);

    const api = await request.get("/api/director/projects");
    expect(api.status()).toBe(401);
    expect(api.headers()["content-type"] ?? "").toMatch(/json/i);
    const body = await api.text();
    expect(body).not.toMatch(/<!DOCTYPE html/i);
    barrier.assertClean();
  });

  test("mot de passe faux → erreur générique ; correct → session httpOnly", async ({
    page,
    context,
  }) => {
    const barrier = await installNetworkBarrier(page);
    const runtime = loadE2eRuntime();
    await page.goto("/login");
    const pw = page.getByRole("textbox", { name: "Mot de passe" });
    await pw.fill("wrong-password-xx");
    await page.getByRole("button", { name: "Entrer" }).click();
    await expect(page.getByText("Connexion refusée.")).toBeVisible();

    await pw.fill(runtime.appPassword);
    await page.getByRole("button", { name: "Entrer" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));

    const cookies = await context.cookies();
    const auth = cookies.find((c) => c.name === "vh_auth");
    expect(auth).toBeTruthy();
    expect(auth!.httpOnly).toBe(true);

    const jsReadable = await page.evaluate(() => document.cookie);
    expect(jsReadable).not.toMatch(/vh_auth=/);

    await logoutViaUi(page);
    await expect(page).toHaveURL(/\/login/);
    barrier.assertClean();
  });

  test("bouton œil accessible", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await page.goto("/login");
    const input = page.getByRole("textbox", { name: "Mot de passe" });
    await input.fill("synthetic-value");
    await expect(input).toHaveAttribute("type", "password");

    const toggle = page.getByRole("button", { name: "Afficher le mot de passe" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(input).toHaveAttribute("type", "text");
    await expect(input).toHaveValue("synthetic-value");
    const hide = page.getByRole("button", { name: "Masquer le mot de passe" });
    await expect(hide).toHaveAttribute("aria-pressed", "true");

    // Keyboard activation of type=button (must not navigate away)
    await hide.focus();
    await page.keyboard.press(" ");
    await expect(input).toHaveAttribute("type", "password");
    await expect(page).toHaveURL(/\/login/);

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Mot de passe" })).toHaveAttribute(
      "type",
      "password",
    );
    barrier.assertClean();
  });
});
