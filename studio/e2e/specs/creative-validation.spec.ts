import { test, expect } from "@playwright/test";
import { loginViaUi } from "../helpers/auth";
import { fillSyntheticBrief } from "../helpers/director-flow";
import { installNetworkBarrier } from "../helpers/network-barrier";
import {
  creativeDryRunReady,
  creativeSection,
  executeCreativeExpectError,
  openCreativeConfirmModal,
  runMarketingPrereq,
} from "../helpers/creative-flow";

/**
 * 8G-B — Creative informative validation (fakes only, zero provider network).
 * Runs the happy path twice (serial cycles) then taxonomy failure modes.
 */

test.describe.serial("Creative validation E2E (8G-B)", () => {
  test("cycle 1 — dry-run prêt + modale + succès fake + anti double-clic", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);
    await runMarketingPrereq(page);

    await creativeDryRunReady(page);
    const dialog = await openCreativeConfirmModal(page);

    // Cancel first (no execute).
    await dialog.getByRole("button", { name: /^Annuler$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Re-open and confirm once (dblclick must not double-execute).
    await creativeDryRunReady(page);
    const dialog2 = await openCreativeConfirmModal(page);
    const responses: number[] = [];
    page.on("response", (r) => {
      if (
        r.url().includes("/creative") &&
        r.request().method() === "POST" &&
        (r.request().postDataJSON() as { mode?: string } | null)?.mode ===
          "execute"
      ) {
        responses.push(r.status());
      }
    });
    const confirmBtn = dialog2.getByRole("button", { name: "Lancer l’analyse" });
    await confirmBtn.dblclick({ delay: 40 }).catch(async () => {
      await confirmBtn.click();
    });

    const section = creativeSection(page);
    await expect(
      section.getByText(/Concept créatif enregistré|Big idea|Logline/i).first(),
    ).toBeVisible({ timeout: 60_000 });

    // At most one successful execute (200/201); no second paid-path call.
    const okStatuses = responses.filter((s) => s >= 200 && s < 300);
    expect(okStatuses.length).toBeGreaterThanOrEqual(1);
    expect(okStatuses.length).toBeLessThanOrEqual(2); // dblclick may race one 409/existing

    expect(
      pageErrors.filter((e) => /Minified React error #418|#418/i.test(e)),
    ).toEqual([]);
    barrier.assertClean();
  });

  test("cycle 2 — second projet : dry-run + modale + succès fake", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    await fillSyntheticBrief(page);
    await runMarketingPrereq(page);
    await creativeDryRunReady(page);
    const dialog = await openCreativeConfirmModal(page);
    await dialog.getByRole("button", { name: "Lancer l’analyse" }).click();
    const section = creativeSection(page);
    await expect(
      section.getByText(/Concept créatif enregistré|Big idea|Logline/i).first(),
    ).toBeVisible({ timeout: 60_000 });
    // Error/alert path must never show Marketing failure copy.
    await expect(section.getByRole("alert")).toHaveCount(0);
    expect(
      pageErrors.filter((e) => /Minified React error #418|#418/i.test(e)),
    ).toEqual([]);
    barrier.assertClean();
  });

  for (const caseDef of [
    {
      name: "incomplete",
      failMode: "incomplete",
      expectedCode: "incomplete",
      messageRe: /incomplète|analyse créative/i,
    },
    {
      name: "refusal",
      failMode: "refused",
      expectedCode: "refused",
      messageRe: /refusée|analyse créative/i,
    },
    {
      name: "empty output",
      failMode: "empty_response",
      expectedCode: "empty_response",
      messageRe: /Aucune analyse créative|analyse créative/i,
    },
    {
      name: "invalid_structured_output",
      failMode: "invalid_structured_output",
      expectedCode: "invalid_structured_output",
      messageRe: /sortie d’analyse créative|invalide/i,
    },
    {
      name: "invalid_candidate",
      failMode: "invalid_candidate",
      expectedCode: "invalid_candidate",
      // Domain hard-gate copy (forbidden ref) — still Creative, never Marketing.
      messageRe: /artiste|imitation|IP non autorisée|candidat créatif|invalide/i,
    },
  ] as const) {
    test(`taxonomie — ${caseDef.name}`, async ({ page }) => {
      test.setTimeout(180_000);
      const barrier = await installNetworkBarrier(page);
      await loginViaUi(page);
      await fillSyntheticBrief(page);
      await runMarketingPrereq(page);
      await executeCreativeExpectError(page, {
        failMode: caseDef.failMode,
        expectedCode: caseDef.expectedCode,
        messageRe: caseDef.messageRe,
      });
      barrier.assertClean();
    });
  }
});
