import { test, expect } from "@playwright/test";
import { loginViaUi } from "../helpers/auth";
import { installNetworkBarrier } from "../helpers/network-barrier";
import {
  fillSyntheticBrief,
  runDelivery,
  runProductionWithWorker,
  runRoutingAndApprove,
  runTextDirectors,
} from "../helpers/director-flow";
const SYNTHETIC_FAKE_MP4_MARKER = "VH-FAKE-MP4-V1";

test.describe.serial("Parcours /director E2E fake", () => {
  test("création → directeurs → routing → production → livraison", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);

    const name = await fillSyntheticBrief(page);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/révision\s*1|Rev\.?\s*1/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });

    await runTextDirectors(page);
    await runRoutingAndApprove(page);
    await runProductionWithWorker(page);
    await runDelivery(page);

    const projectId = page.url().match(/\/director\/([0-9a-f-]{36})/i)?.[1];
    expect(projectId).toBeTruthy();

    // Manifeste séparé (via API — le lien <a> navigue et invalide Response.body).
    const manifest = await page.request.get(
      `/api/director/projects/${projectId}/export/manifest`,
    );
    expect(manifest.status()).toBe(200);
    const manifestJson = await manifest.json();
    expect(JSON.stringify(manifestJson)).not.toMatch(/signed|Bearer |sk-/i);

    // Octets fake déjà vérifiés dans runDelivery — recontrôle cache/no-store.
    const dl = await page.request.get(
      `/api/director/projects/${projectId}/export/download`,
    );
    expect(dl.status()).toBe(200);
    expect(dl.headers()["cache-control"] ?? "").toMatch(/no-store/i);
    const buf = Buffer.from(await dl.body());
    expect(buf.includes(Buffer.from(SYNTHETIC_FAKE_MP4_MARKER))).toBe(true);

    // Storyboard historique toujours accessible
    const hist = await page.goto("/storyboard");
    expect(hist?.ok() || hist?.status() === 200).toBeTruthy();

    barrier.assertClean();
  });
});
