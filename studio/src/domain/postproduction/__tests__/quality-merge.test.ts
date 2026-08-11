import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertDeliveryTransition,
  canTransitionDelivery,
  migrateProductionResultToV11,
  PRODUCTION_RESULT_SCHEMA_VERSION,
  PRODUCTION_RESULT_SCHEMA_VERSION_V1,
} from "@/domain/production";
import {
  buildMergePlan,
  createHumanReviewDecision,
  evaluateFinalQuality,
  MAX_HUMAN_REVIEW_COMMENT_LENGTH,
} from "../index";
import {
  AT,
  makePackages,
  makeProductionResultV1,
  makeSceneResult,
  makeStoryboard,
  makeVideoAsset,
} from "./fixtures";

test("compat — lecture v1 + migration pure 1.1.0", () => {
  const v1 = makeProductionResultV1();
  assert.equal(v1.schemaVersion, PRODUCTION_RESULT_SCHEMA_VERSION_V1);
  assert.equal("delivery" in v1 && v1.delivery != null, false);
  const v11 = migrateProductionResultToV11(v1, AT);
  assert.equal(v11.schemaVersion, PRODUCTION_RESULT_SCHEMA_VERSION);
  assert.equal(v11.delivery?.status, "not_started");
  assert.equal(v11.status, "completed");
  assert.equal(v1.schemaVersion, PRODUCTION_RESULT_SCHEMA_VERSION_V1);
});

test("delivery — transitions valides / interdites", () => {
  assert.equal(canTransitionDelivery("not_started", "merge_ready"), true);
  assert.equal(canTransitionDelivery("not_started", "delivered"), false);
  assert.throws(() => assertDeliveryTransition("delivered", "merging"));
  assert.equal(canTransitionDelivery("quality_review", "quality_review"), true);
});

test("qualité — asset valide / absent / source expirée / MIME", () => {
  const sb = makeStoryboard();
  const pkgs = makePackages();
  const ok = evaluateFinalQuality({
    productionResult: migrateProductionResultToV11(makeProductionResultV1(), AT),
    storyboard: sb,
    scenePackages: pkgs,
    nowIso: AT,
    allowPartial: false,
  });
  assert.ok(ok.technicalChecks.some((c) => c.code === "asset_present" && c.outcome === "pass"));

  const missing = makeProductionResultV1({
    scenes: [
      makeSceneResult("sc-hook", 1, { outputAssets: [], steps: [] }),
      makeSceneResult("sc-problem", 2),
      makeSceneResult("sc-proof", 3),
      makeSceneResult("sc-cta", 4),
    ],
  });
  const bad = evaluateFinalQuality({
    productionResult: migrateProductionResultToV11(missing, AT),
    storyboard: sb,
    scenePackages: pkgs,
    nowIso: AT,
    allowPartial: false,
  });
  assert.equal(bad.status, "rejected");
  assert.ok(bad.blockingIssues.some((i) => i.code === "asset_absent"));

  const expiredAsset = makeVideoAsset("x", {
    source: {
      kind: "temporary_external",
      url: "https://cdn.example.com/x.mp4",
      expiresAt: "2020-01-01T00:00:00.000Z",
    },
  });
  const expired = makeProductionResultV1({
    scenes: [
      makeSceneResult("sc-hook", 1, {
        outputAssets: [expiredAsset],
        steps: [
          {
            ...makeSceneResult("sc-hook", 1).steps[0]!,
            outputAssets: [expiredAsset],
          },
        ],
      }),
      makeSceneResult("sc-problem", 2),
      makeSceneResult("sc-proof", 3),
      makeSceneResult("sc-cta", 4),
    ],
  });
  const expQ = evaluateFinalQuality({
    productionResult: migrateProductionResultToV11(expired, AT),
    storyboard: sb,
    scenePackages: pkgs,
    nowIso: AT,
    allowPartial: false,
  });
  assert.ok(expQ.blockingIssues.some((i) => i.code === "source_expired"));

  const badMime = makeVideoAsset("m", { mimeType: "not-mime" });
  const mimePr = makeProductionResultV1({
    scenes: [
      makeSceneResult("sc-hook", 1, { outputAssets: [badMime] }),
      makeSceneResult("sc-problem", 2),
      makeSceneResult("sc-proof", 3),
      makeSceneResult("sc-cta", 4),
    ],
  });
  const mimeQ = evaluateFinalQuality({
    productionResult: migrateProductionResultToV11(mimePr, AT),
    storyboard: sb,
    scenePackages: pkgs,
    nowIso: AT,
    allowPartial: false,
  });
  assert.ok(mimeQ.blockingIssues.some((i) => i.code === "invalid_mime"));
});

test("qualité — unknown n'est pas accepted", () => {
  const sb = makeStoryboard();
  const q = evaluateFinalQuality({
    productionResult: migrateProductionResultToV11(makeProductionResultV1(), AT),
    storyboard: sb,
    scenePackages: makePackages(),
    nowIso: AT,
    allowPartial: false,
  });
  assert.ok(q.technicalChecks.some((c) => c.outcome === "unknown"));
  assert.ok(q.editorialChecks.some((c) => c.code === "visual_identity" && c.outcome === "unknown"));
  assert.notEqual(q.status, "accepted");
  assert.equal(q.status, "needs_review");
});

test("qualité contractuelle — CTA manquant / scène étrangère", () => {
  const sb = makeStoryboard({
    scenes: makeStoryboard().scenes.filter((s) => s.purpose !== "cta"),
    durationSeconds: 15,
  });
  // fix duration sum for 3 scenes
  sb.scenes = sb.scenes.map((s) => ({ ...s, durationSeconds: 5 }));
  sb.durationSeconds = 15;
  sb.timing = {
    ...sb.timing,
    targetDurationSeconds: 15,
    totalSceneDurationSeconds: 15,
  };

  const pr = makeProductionResultV1({
    scenes: [
      makeSceneResult("sc-hook", 1),
      makeSceneResult("sc-problem", 2),
      makeSceneResult("sc-proof", 3),
      makeSceneResult("sc-foreign", 4),
    ],
  });
  const q = evaluateFinalQuality({
    productionResult: migrateProductionResultToV11(pr, AT),
    storyboard: sb,
    scenePackages: makePackages(),
    nowIso: AT,
    allowPartial: false,
  });
  assert.ok(q.blockingIssues.some((i) => i.code === "cta_missing"));
  assert.ok(q.blockingIssues.some((i) => i.code === "foreign_scene"));
});

test("revue humaine — append-only / non waivable / commentaire", () => {
  const ok = createHumanReviewDecision({
    id: "hr-1",
    productionRunId: "run-1",
    productionResultRevisionId: "pr-1",
    productionResultRevision: 1,
    status: "approved",
    decidedAt: AT,
    decidedBy: "u1",
    reviewedIssueCodes: ["visual_identity"],
    remainingBlockingTechnicalCodes: [],
  });
  assert.equal(ok.status, "approved");
  assert.ok(Object.isFrozen(ok));

  assert.throws(() =>
    createHumanReviewDecision({
      id: "hr-2",
      productionRunId: "run-1",
      productionResultRevisionId: "pr-1",
      productionResultRevision: 1,
      status: "approved",
      decidedAt: AT,
      decidedBy: "u1",
      reviewedIssueCodes: ["asset_absent"],
      remainingBlockingTechnicalCodes: ["asset_absent"],
    })
  );

  assert.throws(() =>
    createHumanReviewDecision({
      id: "hr-3",
      productionRunId: "run-1",
      productionResultRevisionId: "pr-1",
      productionResultRevision: 1,
      status: "rejected",
      decidedAt: AT,
      decidedBy: "u1",
      reviewedIssueCodes: [],
      comment: "x".repeat(MAX_HUMAN_REVIEW_COMMENT_LENGTH + 1),
    })
  );

  const retry = createHumanReviewDecision({
    id: "hr-4",
    productionRunId: "run-1",
    productionResultRevisionId: "pr-1",
    productionResultRevision: 1,
    status: "retry_same_reference",
    decidedAt: AT,
    decidedBy: "u1",
    reviewedIssueCodes: ["identity_drift"],
  });
  assert.equal(retry.status, "retry_same_reference");
});

test("MergePlan — timeline déterministe / transition unsupported", () => {
  const pr = migrateProductionResultToV11(makeProductionResultV1(), AT);
  const built = buildMergePlan({
    id: "mp-1",
    productionResult: pr,
    storyboard: makeStoryboard(),
    scenePackages: makePackages(),
    aspectRatio: "9:16",
    createdAt: AT,
    nowIso: AT,
  });
  assert.equal(built.ok, true);
  if (built.ok) {
    assert.equal(built.plan.timeline[0]!.startSeconds, 0);
    assert.equal(built.plan.estimatedDurationSeconds, 20);
    assert.ok(Object.isFrozen(built.plan));
  }

  const sbFade = makeStoryboard();
  sbFade.scenes[0]!.transition = { type: "fade", durationSeconds: 0.5 };
  const fade = buildMergePlan({
    id: "mp-2",
    productionResult: pr,
    storyboard: sbFade,
    scenePackages: makePackages(),
    aspectRatio: "9:16",
    createdAt: AT,
    nowIso: AT,
  });
  assert.equal(fade.ok, false);
  if (!fade.ok) {
    assert.ok(fade.errors.some((e) => e.code === "unsupported_transition"));
  }
});

test("overlays — projetés + warning unsupported", () => {
  const pr = migrateProductionResultToV11(makeProductionResultV1(), AT);
  const built = buildMergePlan({
    id: "mp-ov",
    productionResult: pr,
    storyboard: makeStoryboard(),
    scenePackages: makePackages(true),
    aspectRatio: "9:16",
    createdAt: AT,
    nowIso: AT,
  });
  assert.equal(built.ok, true);
  if (built.ok) {
    assert.ok(built.plan.overlays.some((o) => o.kind === "text"));
    assert.ok(built.warnings.some((w) => w.startsWith("overlay_unsupported:")));
    const text = built.plan.overlays.find((o) => o.kind === "text");
    if (text && text.kind === "text") {
      assert.equal(text.text, "Achetez maintenant");
    }
  }
});
