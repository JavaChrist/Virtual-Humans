import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { loadE2eRuntime } from "./runtime";

export async function fillSyntheticBrief(page: Page): Promise<string> {
  const name = `E2E RideCloud ${Date.now()}`;
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
  // Ne pas cliquer « Effacer le brouillon » : ouvre une modale de confirmation.
  // localStorage a déjà été vidé + reload.
  const subjectType = page.locator("#subjectType");
  await expect(subjectType).toBeVisible({ timeout: 30_000 });
  await page.locator("#projectName").fill(name);
  await subjectType.selectOption("product");
  await page.getByLabel("Nom du sujet").fill("RideCloud E2E");
  await page
    .getByLabel("Description", { exact: true })
    .fill(
      "Application de mobilité partagée synthétique pour parcours E2E local sans provider.",
    );
  await page.getByRole("button", { name: "Continuer" }).click();

  await page.getByLabel("Objectif").selectOption("conversion");
  await page
    .getByLabel(/Audience/)
    .fill("Navetteurs urbains synthétiques E2E.");
  await page.getByRole("button", { name: "Continuer" }).click();

  await page.getByLabel("Plateforme").selectOption("instagram");
  await page.getByLabel("Durée").selectOption("30");
  await page.getByRole("button", { name: "Continuer" }).click();

  await page.getByLabel("Ton").selectOption("energetic");
  await page.getByLabel("Langue").fill("fr");
  await page.getByRole("button", { name: "Continuer" }).click();

  await page
    .getByLabel(/Appel à l.action/)
    .fill("Téléchargez l'app et réservez votre premier trajet");
  await page.getByRole("button", { name: "Continuer" }).click();

  await page.getByRole("button", { name: "Créer le projet" }).click();
  await page.waitForURL(/\/director\/[0-9a-f-]{36}/i, { timeout: 60_000 });
  return name;
}

async function confirmDialog(page: Page, confirmLabel: string | RegExp) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole("button", { name: confirmLabel }).click();
}

export async function dryAndExecute(
  page: Page,
  opts: {
    sectionHeading: string | RegExp;
    dryLabel: string | RegExp;
    executeLabel: string | RegExp;
    confirmLabel: string | RegExp;
    successText: RegExp;
  },
) {
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: opts.sectionHeading }),
  });
  await section.getByRole("button", { name: opts.dryLabel }).click();
  await expect(
    section.getByText(/exécution (autorisable|disponible)/i),
  ).toBeVisible({ timeout: 30_000 });
  const exec = section.getByRole("button", { name: opts.executeLabel, exact: true });
  await expect(exec).toBeEnabled({ timeout: 15_000 });
  await exec.click();
  await confirmDialog(page, opts.confirmLabel);
  await expect(section.getByText(opts.successText).first()).toBeVisible({
    timeout: 60_000,
  });
}

async function dryAndExecuteExactHeading(
  page: Page,
  opts: {
    heading: string;
    dryLabel: string | RegExp;
    executeLabel: string | RegExp;
    confirmLabel: string | RegExp;
    successText: RegExp;
  },
) {
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: opts.heading, exact: true }),
  });
  await section.getByRole("button", { name: opts.dryLabel }).click();
  await expect(
    section.getByText(/exécution (autorisable|disponible)/i),
  ).toBeVisible({ timeout: 30_000 });
  const exec = section.getByRole("button", { name: opts.executeLabel, exact: true });
  await expect(exec).toBeEnabled({ timeout: 15_000 });
  await exec.click();
  await confirmDialog(page, opts.confirmLabel);
  await expect(section.getByText(opts.successText).first()).toBeVisible({
    timeout: 60_000,
  });
}

export async function runTextDirectors(page: Page) {
  await dryAndExecute(page, {
    sectionHeading: /Stratégie marketing/i,
    dryLabel: "Vérifier le brief",
    executeLabel: "Lancer l’analyse marketing",
    confirmLabel: "Lancer l’analyse",
    successText: /Objectif|USP|Bénéfice|Audience/i,
  });

  await dryAndExecuteExactHeading(page, {
    heading: "Direction créative",
    dryLabel: "Vérifier les prérequis",
    executeLabel: "Lancer l’analyse créative",
    confirmLabel: "Lancer l’analyse",
    successText: /Big idea|Logline|Concept créatif enregistré/i,
  });

  await dryAndExecuteExactHeading(page, {
    heading: "Script",
    dryLabel: "Vérifier les prérequis",
    executeLabel: "Rédiger le script",
    confirmLabel: "Rédiger le script",
    successText: /segment|timing|hook|CTA/i,
  });

  await dryAndExecuteExactHeading(page, {
    heading: "Direction art",
    dryLabel: "Vérifier les prérequis",
    executeLabel: "Produire la direction art",
    confirmLabel: "Produire la direction art",
    successText: /palette|location|segment/i,
  });

  await dryAndExecuteExactHeading(page, {
    heading: "Storyboard",
    dryLabel: "Vérifier les prérequis",
    executeLabel: "Produire le storyboard",
    confirmLabel: "Produire le storyboard",
    // Ne pas matcher « Scène sc-N … » des erreurs dry-run — exiger le plan persisté.
    successText: /^Révision$|Scènes\s*\d|Plan/i,
  });

  const prompts = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Packages scènes", exact: true }),
  });
  await prompts.getByRole("button", { name: "Vérifier les prérequis" }).click();
  await expect(
    prompts.getByText(/exécution (autorisable|disponible)/i),
  ).toBeVisible({ timeout: 30_000 });
  const build = prompts.getByRole("button", { name: "Construire les packages", exact: true });
  await expect(build).toBeEnabled({ timeout: 30_000 });
  const buildRespPromise = page.waitForResponse(
    (r) =>
      r.url().includes("/prompts") &&
      r.request().method() === "POST" &&
      r.request().postDataJSON()?.mode === "execute",
    { timeout: 60_000 },
  );
  await build.click();
  const buildResp = await buildRespPromise;
  expect(buildResp.ok(), `prompts execute HTTP ${buildResp.status()}`).toBeTruthy();
  // Ne pas matcher le titre « Packages scènes » — attendre le lot persisté.
  await expect(prompts.getByText("Révision du lot")).toBeVisible({ timeout: 30_000 });
  await expect(prompts.getByText(/Scènes couvertes/i)).toBeVisible({ timeout: 15_000 });
}

function pageOrigin(page: Page): string {
  return new URL(page.url()).origin;
}

export async function runRoutingAndApprove(page: Page) {
  const routing = page.locator("section").filter({
    has: page.getByRole("heading", { name: /Routing|GenerationPlan/i }),
  });
  const projectId = page.url().match(/\/director\/([0-9a-f-]{36})/i)?.[1];
  expect(projectId).toBeTruthy();
  const origin = pageOrigin(page);

  // Prefer API dry-run (stable) then drive UI — CSRF exige Origin.
  const apiDry = await page.request.post(
    `/api/director/projects/${projectId}/routing`,
    {
      data: { mode: "dry_run" },
      headers: {
        Origin: origin,
        Referer: page.url(),
        "Content-Type": "application/json",
      },
    },
  );
  const apiBody = (await apiDry.json().catch(() => ({}))) as {
    dryRun?: {
      executionAvailable?: boolean;
      missingInformation?: Array<{ code: string; message: string }>;
      registryVersion?: string;
      validations?: Array<{ code: string; message: string }>;
    };
    error?: string;
  };
  if (!apiDry.ok()) {
    throw new Error(
      `routing dry-run HTTP ${apiDry.status()}: ${JSON.stringify(apiBody)}`,
    );
  }
  if (!apiBody.dryRun?.executionAvailable) {
    throw new Error(
      `Routing non exécutable: ${JSON.stringify({
        missing: apiBody.dryRun?.missingInformation,
        validations: apiBody.dryRun?.validations,
        registry: apiBody.dryRun?.registryVersion,
      })}`,
    );
  }

  await routing.getByRole("button", { name: /Vérifier le routage/ }).click();
  await expect(
    routing.getByText(/exécution (autorisable|disponible)/i),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    routing.getByRole("button", { name: /Créer le GenerationPlan/ }),
  ).toBeEnabled({ timeout: 30_000 });
  await routing.getByRole("button", { name: /Créer le GenerationPlan/ }).click();
  await confirmDialog(page, /Créer le plan/);
  await expect(routing.getByText(/stratégie|coût|estimation/i).first()).toBeVisible({
    timeout: 60_000,
  });
  await routing.getByRole("button", { name: /Approuver le plan/ }).click();
  await confirmDialog(page, /^Approuver$/);
  await expect(routing.getByText(/approuv/i).first()).toBeVisible({ timeout: 30_000 });
}

export async function runProductionWithWorker(page: Page) {
  const runtime = loadE2eRuntime();
  const production = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Production", exact: true }),
  });

  // Toujours rafraîchir le dry-run après routing (l'état monté est obsolète).
  await production.getByRole("button", { name: /Vérifier la production/ }).click();
  await expect(
    production.getByText(/Dry-run ·/i),
  ).toBeVisible({ timeout: 30_000 });

  for (const label of ["Approuver le Brief", "Approuver le Storyboard"]) {
    const btn = production.getByRole("button", { name: label });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await confirmDialog(page, /^Approuver$/);
      const type = label.includes("Brief")
        ? "video_project_brief"
        : "storyboard_project";
      await expect(
        production.getByText(new RegExp(`${type}:\\s*approved`, "i")),
      ).toBeVisible({ timeout: 30_000 });
    }
  }

  // Re-vérifier après approbations.
  await production.getByRole("button", { name: /Vérifier la production/ }).click();
  await expect(
    production.getByText(/exécution (autorisable|disponible)/i),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    production.getByRole("button", { name: /Démarrer la production/ }),
  ).toBeEnabled({ timeout: 30_000 });
  const startRespPromise = page.waitForResponse(
    (r) =>
      r.url().includes("/production") &&
      r.request().method() === "POST" &&
      r.request().postDataJSON()?.mode === "execute",
    { timeout: 60_000 },
  );
  await production.getByRole("button", { name: /Démarrer la production/ }).click();
  await confirmDialog(page, /^Démarrer$/);
  const startResp = await startRespPromise;
  const startText = await startResp.text();
  expect(
    startResp.ok(),
    `production execute HTTP ${startResp.status()}: ${startText}`,
  ).toBeTruthy();
  const startJson = JSON.parse(startText) as {
    run?: { runId?: string; status?: string };
  };
  expect(startJson.run?.runId).toBeTruthy();
  await expect(production.getByText(/Statut du run|running|completed|partial/i).first()).toBeVisible({
    timeout: 30_000,
  });

  // Drive fake worker until production run is terminal.
  // Note: GET /production only exposes *active* (non-terminal) runs — once
  // finalized, existingRun disappears; that absence after start ⇒ terminal.
  const projectId = page.url().match(/\/director\/([0-9a-f-]{36})/i)?.[1];
  expect(projectId).toBeTruthy();
  const origin = pageOrigin(page);
  await expect
    .poll(
      async () => {
        const res = await page.request.post(
          "/api/internal/director-worker/run-once",
          {
            headers: {
              "x-director-worker-secret": runtime.workerSecret,
              "content-type": "application/json",
              Origin: origin,
              Referer: page.url(),
            },
            data: {},
          },
        );
        if (res.status() >= 500) return `worker_error_${res.status()}`;
        if (res.status() === 401 || res.status() === 403) {
          return `worker_auth_${res.status()}`;
        }
        const workerBody = (await res.json().catch(() => ({}))) as {
          status?: string;
          claimed?: number;
          processed?: number;
          completed?: number;
          failed?: number;
          publicMessage?: string;
          issues?: Array<{ code: string; publicMessage: string }>;
        };
        if (workerBody.status === "disabled") {
          return `worker_disabled:${workerBody.publicMessage ?? ""}`;
        }
        const statusRes = await page.request.get(
          `/api/director/projects/${projectId}/production`,
        );
        if (!statusRes.ok()) return `status_error_${statusRes.status()}`;
        const body = (await statusRes.json()) as {
          run?: { status?: string } | null;
          dryRun?: { existingRun?: { status?: string } | null };
        };
        const st =
          body.run?.status ?? body.dryRun?.existingRun?.status ?? "unknown";
        if (["completed", "partial", "failed", "cancelled"].includes(st)) {
          return "terminal";
        }
        return [
          st,
          `w=${workerBody.status ?? "?"}`,
          `c=${workerBody.claimed ?? 0}`,
          `p=${workerBody.processed ?? 0}`,
          `done=${workerBody.completed ?? 0}`,
          `fail=${workerBody.failed ?? 0}`,
          workerBody.issues?.[0]
            ? `issue=${workerBody.issues[0].code}:${workerBody.issues[0].publicMessage}`
            : "",
        ]
          .filter(Boolean)
          .join(":");
      },
      { timeout: 240_000, intervals: [500, 1_000, 2_000] },
    )
    .toBe("terminal");
  await page.reload({ waitUntil: "domcontentloaded" });
}

export async function runDelivery(page: Page) {
  const delivery = page.locator("section").filter({
    has: page.getByRole("heading", { name: /Livraison|QC|Qualité|Export/i }),
  });
  const projectId = page.url().match(/\/director\/([0-9a-f-]{36})/i)?.[1];
  expect(projectId).toBeTruthy();
  const origin = pageOrigin(page);
  const qcApi = await page.request.post(`/api/director/projects/${projectId}/quality`, {
    data: { mode: "dry_run" },
    headers: {
      Origin: origin,
      Referer: page.url(),
      "Content-Type": "application/json",
    },
  });
  const qcBody = await qcApi.json();
  if (!qcApi.ok() || !qcBody?.dryRun?.executable) {
    throw new Error(
      `QC dry-run API: HTTP ${qcApi.status()} ${JSON.stringify(qcBody).slice(0, 800)}`,
    );
  }

  await delivery.getByRole("button", { name: /Dry-run QC/ }).click();
  await expect(delivery.getByText(/Dry-run QC · prêt/i)).toBeVisible({
    timeout: 30_000,
  });
  const execQc = delivery.getByRole("button", { name: /Exécuter QC/ });
  await expect(execQc).toBeEnabled({ timeout: 30_000 });
  await execQc.click();
  await confirmDialog(page, /Exécuter QC/);

  // needs_review : commentaire obligatoire + modale (unknown ≠ pass).
  const reviewComment = delivery.locator("#review-comment");
  if (await reviewComment.isVisible().catch(() => false)) {
    await reviewComment.fill("Revue E2E synthétique — unknowns techniques acceptés.");
    const accept = delivery.getByRole("button", { name: /^Accepter$/ });
    await expect(accept).toBeEnabled({ timeout: 10_000 });
    await accept.click();
    await confirmDialog(page, /^Accepter$/);
    await expect(delivery.getByText(/quality_review|accepted|approved|Merge · readiness OK/i).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  const prepareMerge = delivery.getByRole("button", { name: /Préparer merge/ });
  await expect(prepareMerge).toBeEnabled({ timeout: 30_000 });
  await prepareMerge.click();
  await expect(delivery.getByText(/Merge · readiness OK/i)).toBeVisible({ timeout: 30_000 });

  const runMerge = delivery.getByRole("button", { name: /Lancer merge fake/ });
  await expect(runMerge).toBeEnabled({ timeout: 30_000 });
  await runMerge.click();
  await confirmDialog(page, /Merger \(fake\)/);
  await expect(delivery.getByText(/Asset final|merged|completed/i).first()).toBeVisible({
    timeout: 60_000,
  });

  const prepareExport = delivery.getByRole("button", { name: /Préparer export/ });
  await expect(prepareExport).toBeEnabled({ timeout: 30_000 });
  await prepareExport.click();
  await confirmDialog(page, /Préparer l'export/);
  // readiness dry-run ≠ paquet persisté — attendre le manifeste / id de paquet.
  await expect(delivery.getByText(/Manifeste sûr|paquet [0-9a-f]/i).first()).toBeVisible({
    timeout: 60_000,
  });

  // L'UI fetch + blob (pas toujours un événement download navigateur) — vérifier via API.
  const dl = await page.request.get(
    `/api/director/projects/${projectId}/export/download`,
  );
  const dlBytes = Buffer.from(await dl.body());
  expect(
    dl.ok(),
    `download HTTP ${dl.status()}: ${dlBytes.subarray(0, 200).toString("utf8")}`,
  ).toBeTruthy();
  expect(dl.headers()["content-type"] ?? "").toMatch(/video\/mp4|application\/octet-stream/i);
  expect(dl.headers()["cache-control"] ?? "").toMatch(/no-store/i);
  expect(dlBytes.toString("utf8")).toContain("VH-FAKE-MP4-V1");

  const downloadBtn = delivery.getByRole("button", { name: /Télécharger le média final/ });
  await expect(downloadBtn).toBeEnabled({ timeout: 15_000 });
  await downloadBtn.click();
  await expect(delivery.getByText(/Contenu de l'asset final introuvable/i)).toHaveCount(0, {
    timeout: 10_000,
  });

  const manifest = await page.request.get(
    `/api/director/projects/${projectId}/export/manifest`,
  );
  expect(manifest.ok()).toBeTruthy();
  const manifestJson = await manifest.json();
  expect(JSON.stringify(manifestJson)).not.toMatch(/https?:\/\/(?!127\.0\.0\.1|localhost)/i);
}
