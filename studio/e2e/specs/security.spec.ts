import { test, expect } from "@playwright/test";
import { loginViaApi, loginViaUi } from "../helpers/auth";
import { loadE2eRuntime } from "../helpers/runtime";
import { installNetworkBarrier } from "../helpers/network-barrier";

test.describe("Sécurité navigateur", () => {
  test("open redirect refusée", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await page.goto("/login?next=https://evil.example/phish");
    await loginViaUi(page);
    await expect(page).not.toHaveURL(/evil\.example/);
    barrier.assertClean();
  });

  test("CSRF Origin étrangère refusée", async ({ request }) => {
    await loginViaApi(request);
    const res = await request.post("/api/logout", {
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      data: {},
    });
    expect(res.status()).toBe(403);
  });

  test("GET worker 405 ; cookie seul insuffisant ; route interne inconnue", async ({
    request,
  }) => {
    const runtime = loadE2eRuntime();
    await loginViaApi(request);

    const get = await request.get("/api/internal/director-worker/run-once");
    expect(get.status()).toBe(405);

    const cookieOnly = await request.post(
      "/api/internal/director-worker/run-once",
      { data: {} },
    );
    expect(cookieOnly.status()).toBe(401);

    const badSecret = await request.post(
      "/api/internal/director-worker/run-once",
      {
        headers: { "x-director-worker-secret": "wrong-secret-value" },
        data: {},
      },
    );
    expect(badSecret.status()).toBe(401);
    const badBody = await badSecret.text();
    expect(badBody).not.toContain(runtime.workerSecret);

    const unknown = await request.post("/api/internal/unknown-route", {
      data: {},
    });
    expect([401, 403, 404, 405]).toContain(unknown.status());

    const ok = await request.post("/api/internal/director-worker/run-once", {
      headers: { "x-director-worker-secret": runtime.workerSecret },
      data: {},
    });
    expect([200, 202]).toContain(ok.status());
    const okJson = await ok.json();
    expect(JSON.stringify(okJson)).not.toContain(runtime.workerSecret);
  });

  test("aucune clé/secret dans HTML login", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    const runtime = loadE2eRuntime();
    await page.goto("/login");
    const html = await page.content();
    expect(html).not.toContain(runtime.appPassword);
    expect(html).not.toContain(runtime.sessionSecret);
    expect(html).not.toContain(runtime.workerSecret);
    expect(html).not.toMatch(/OPENAI_API_KEY|FAL_KEY|sk-[a-zA-Z0-9]{10,}/);
    barrier.assertClean();
  });
});
