/**
 * CTA ↔ objective matrix (VHS-130 / Porte 7G-A).
 * Synthetic redacted fixtures only — no provider payloads.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MarketingObjectiveValues,
  ctaGuidanceForObjective,
  ctaTokensForObjective,
  isCtaCompatibleWithObjective,
  finalizeMarketingPlan,
  type MarketingObjective,
} from "@/domain/marketing";
import { MarketingDomainError } from "../errors";
import { makeBrief, makeValidCandidate } from "./fixtures";

const COMPATIBLE: Record<MarketingObjective, string> = {
  awareness: "Découvrez notre solution",
  traffic: "Cliquez pour visiter le site",
  lead_generation: "Inscrivez-vous pour une démo",
  conversion: "Téléchargez l'app et réservez",
  education: "Validez votre compréhension",
  engagement: "Partagez votre avis en commentaire",
};

const INCOMPATIBLE: Record<MarketingObjective, string> = {
  awareness: "Achetez dès aujourd'hui",
  traffic: "Bonne journée à tous",
  lead_generation: "Likez et commentez seulement",
  conversion: "Bonne journée à tous",
  education: "Achetez maintenant",
  engagement: "Achetez dès aujourd'hui",
};

test("chaque objectif a une guidance CTA non vide alignée sur ses tokens", () => {
  for (const objective of MarketingObjectiveValues) {
    const tokens = ctaTokensForObjective(objective);
    assert.ok(tokens.length >= 3, objective);
    const guidance = ctaGuidanceForObjective(objective);
    assert.ok(guidance.length > 10, objective);
  }
});

test("matrice — CTA compatible par objectif", () => {
  for (const objective of MarketingObjectiveValues) {
    assert.equal(
      isCtaCompatibleWithObjective(COMPATIBLE[objective], objective),
      true,
      `expected compatible for ${objective}`,
    );
  }
});

test("matrice — CTA incompatible par objectif", () => {
  for (const objective of MarketingObjectiveValues) {
    assert.equal(
      isCtaCompatibleWithObjective(INCOMPATIBLE[objective], objective),
      false,
      `expected incompatible for ${objective}`,
    );
  }
});

test("education — confirmation / validation interne acceptées", () => {
  assert.equal(
    isCtaCompatibleWithObjective("Validez votre compréhension", "education"),
    true,
  );
  assert.equal(isCtaCompatibleWithObjective("Confirmez ce que vous retenez", "education"), true);
  assert.equal(isCtaCompatibleWithObjective("Passez le quiz", "education"), true);
  assert.equal(isCtaCompatibleWithObjective("Testez vos connaissances", "education"), true);
});

test("education — CTA conversion toujours rejeté", () => {
  assert.equal(isCtaCompatibleWithObjective("Achetez maintenant", "education"), false);
  assert.equal(isCtaCompatibleWithObjective("Buy now", "education"), false);
});

test("finalize — Brief CTA compatible gagne avant le hard gate", () => {
  const brief = makeBrief({
    objective: "education",
    callToAction: "Validez votre compréhension",
  });
  const candidate = makeValidCandidate({
    marketingObjective: "education",
    callToAction: "Bonne journée à tous",
    videoStyle: "educational",
    successMetric: { kind: "completion", description: "Complétion de la vidéo" },
  });
  const plan = finalizeMarketingPlan({
    brief,
    candidate,
    metadata: { id: "plan-cta-brief-wins", createdBy: "t", correlationId: "c-cta" },
  });
  assert.equal(plan.callToAction, "Validez votre compréhension");
  assert.equal(plan.marketingObjective, "education");
  assert.ok(
    plan.assumptions.some((a) => a.id === "assumption-cta-brief-authoritative"),
    "provenance: Brief CTA override must be explicit",
  );
});

test("finalize — sans Brief CTA, candidat incompatible reste rejeté", () => {
  const brief = makeBrief({
    objective: "education",
    callToAction: undefined,
  });
  const candidate = makeValidCandidate({
    marketingObjective: "education",
    callToAction: "Achetez maintenant",
    videoStyle: "educational",
    successMetric: { kind: "completion", description: "Complétion de la vidéo" },
  });
  assert.throws(
    () =>
      finalizeMarketingPlan({
        brief,
        candidate,
        metadata: { id: "plan-cta-reject", createdBy: "t", correlationId: "c-cta-r" },
      }),
    (err: unknown) =>
      err instanceof MarketingDomainError &&
      err.code === "invalid_candidate" &&
      /CTA/.test(err.message),
  );
});
