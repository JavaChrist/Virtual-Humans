import assert from "node:assert/strict";
import { test } from "node:test";
import { makeBrief } from "@/domain/marketing/__tests__/fixtures";
import { runMarketingDryRun } from "../dry-run";

test("brief complet exécutable", () => {
  const result = runMarketingDryRun(makeBrief());
  assert.equal(result.providerCalled, false);
  assert.equal(result.executable, true);
  assert.ok(result.validations.every((v) => v.passed || v.code === "brand_constraints"));
});

test("CTA manquant pour conversion", () => {
  const brief = makeBrief({ callToAction: undefined, objective: "conversion" });
  const result = runMarketingDryRun(brief);
  assert.equal(result.providerCalled, false);
  assert.equal(result.executable, false);
  assert.ok(result.missingInformation.some((m) => m.code === "cta_missing" && m.required));
});

test("audience insuffisante", () => {
  const result = runMarketingDryRun(makeBrief({ audienceDescription: "ok" }));
  assert.equal(result.executable, false);
  assert.ok(result.missingInformation.some((m) => m.code === "audience_missing"));
});

test("description trop vague", () => {
  const base = makeBrief();
  const result = runMarketingDryRun({
    ...base,
    subjectDescription: "Produit test todo",
  });
  assert.equal(result.executable, false);
  assert.ok(result.missingInformation.some((m) => m.code === "subject_vague"));
});

test("langue plateforme durée valides", () => {
  const result = runMarketingDryRun(makeBrief());
  for (const code of ["language_ok", "platform_ok", "duration_ok", "tone_ok"]) {
    assert.ok(result.validations.some((v) => v.code === code && v.passed));
  }
});

test("référence média invalide", () => {
  const base = makeBrief();
  const result = runMarketingDryRun({
    ...base,
    mediaReferences: [
      {
        id: "m1",
        kind: "logo",
        label: "Logo",
        uri: "data:image/png;base64,AAAA",
      },
    ],
  });
  assert.equal(result.executable, false);
  // Rejected at brief schema boundary and/or readiness media check
  assert.ok(
    result.missingInformation.some(
      (m) => m.code === "media_invalid" || m.code === "brief_invalid",
    ),
  );
});

test("providerCalled littéralement false et aucun plan inventé", () => {
  const result = runMarketingDryRun(makeBrief());
  assert.equal(result.providerCalled, false);
  assert.equal("plan" in result, false);
  const keys = Object.keys(result);
  assert.ok(!keys.includes("plan"));
});
