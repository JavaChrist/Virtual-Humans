import assert from "node:assert/strict";
import { test } from "node:test";
import { money } from "@/domain/cost";
import {
  DEFAULT_PRODUCTION_POLICY,
  decideFallback,
  evaluateStructuredQuality,
  validateProductionPolicy,
} from "../index";
import { makeStep } from "./fixtures";

test("fallback — retryable technique autorisé", () => {
  const step = makeStep();
  const d = decideFallback({
    step,
    attempts: [
      {
        id: "a1",
        stepId: step.id,
        attemptNumber: 1,
        kind: "primary",
        providerId: step.providerId,
        modelId: step.modelId,
        idempotencyKey: "k1",
        status: "failed",
        estimate: step.estimate,
        error: {
          code: "timeout",
          message: "timeout",
          retryable: true,
          category: "technical",
        },
      },
    ],
    lastError: {
      code: "timeout",
      message: "timeout",
      retryable: true,
      category: "technical",
    },
    policy: DEFAULT_PRODUCTION_POLICY,
    cancelled: false,
  });
  assert.equal(d.allowed, true);
});

test("fallback — content_rejected / unauthorized / unknown refusés", () => {
  const step = makeStep();
  for (const category of ["content_rejected", "unauthorized", "unknown"] as const) {
    const d = decideFallback({
      step,
      attempts: [],
      lastError: { code: category, message: category, retryable: true, category },
      policy: DEFAULT_PRODUCTION_POLICY,
      cancelled: false,
    });
    assert.equal(d.allowed, false, category);
  }
});

test("fallback — qualité selon politique", () => {
  const step = makeStep();
  const denied = decideFallback({
    step,
    attempts: [],
    lastError: { code: "quality", message: "q", retryable: true, category: "quality" },
    qualityRejected: true,
    policy: DEFAULT_PRODUCTION_POLICY,
    cancelled: false,
  });
  assert.equal(denied.allowed, false);

  const allowed = decideFallback({
    step,
    attempts: [],
    lastError: { code: "quality", message: "q", retryable: true, category: "quality" },
    qualityRejected: true,
    policy: validateProductionPolicy({
      ...DEFAULT_PRODUCTION_POLICY,
      qualityFailureAllowsFallback: true,
    }),
    cancelled: false,
  });
  assert.equal(allowed.allowed, true);
});

test("qualité — accepté / rejeté MIME / needs_review durée", () => {
  const step = makeStep({
    action: "video",
    expectedOutput: { mediaType: "video", durationSeconds: 5 },
  });
  const accepted = evaluateStructuredQuality({
    step,
    asset: {
      id: "out-1",
      kind: "video",
      mimeType: "video/mp4",
      source: {
        kind: "temporary_external",
        url: "https://cdn.example.com/v.mp4",
        expiresAt: "2026-12-01T00:00:00.000Z",
      },
      durationSeconds: 5,
      width: 1080,
      height: 1920,
    },
    nowIso: "2026-08-02T12:00:00.000Z",
  });
  assert.equal(accepted.status, "accepted");

  const badMime = evaluateStructuredQuality({
    step,
    asset: {
      id: "out-2",
      kind: "video",
      mimeType: "not-a-mime",
      source: {
        kind: "temporary_external",
        url: "https://cdn.example.com/v.mp4",
        expiresAt: "2026-12-01T00:00:00.000Z",
      },
    },
    nowIso: "2026-08-02T12:00:00.000Z",
  });
  assert.equal(badMime.status, "rejected");

  const review = evaluateStructuredQuality({
    step,
    asset: {
      id: "out-3",
      kind: "video",
      mimeType: "video/mp4",
      source: {
        kind: "temporary_external",
        url: "https://cdn.example.com/v.mp4",
        expiresAt: "2026-12-01T00:00:00.000Z",
      },
      width: 1080,
      height: 1920,
      // duration missing → needs_review, never silent accept
    },
    nowIso: "2026-08-02T12:00:00.000Z",
  });
  assert.equal(review.status, "needs_review");
  void money;
});
