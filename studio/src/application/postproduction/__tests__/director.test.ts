import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AT,
  makePackages,
  makeProductionResultV1,
  makeStoryboard,
  makeVideoAsset,
} from "@/domain/postproduction/__tests__/fixtures";
import { migrateProductionResultToV11 } from "@/domain/production";
import {
  createDownloadExportAdapter,
  createPostProductionDirector,
  createUnavailableAiccosExportAdapter,
  createUnavailableMergeEngine,
  runPostProductionDryRun,
} from "../index";

function ctx() {
  let n = 0;
  let t = Date.parse(AT);
  return {
    correlationId: "corr-1",
    actorId: "tester",
    nowIso: () => new Date(t++).toISOString(),
    nextId: () => `id-${++n}`,
  };
}

test("dry-run — providerCalled false / merge stub / pas d'asset fictif", () => {
  const engine = createUnavailableMergeEngine();
  const dry = runPostProductionDryRun({
    productionResult: makeProductionResultV1(),
    storyboard: makeStoryboard(),
    scenePackages: makePackages(),
    aspectRatio: "9:16",
    mergeEngine: engine,
    at: AT,
  });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.exportReady, false);
  assert.ok(dry.mergePlan);
  assert.ok(
    dry.validations.some(
      (v) =>
        v.code === "merge_adapter_absent" ||
        v.code === "merge_execution" ||
        v.code === "merge_execution_unavailable"
    )
  );
  assert.ok(!("finalAsset" in dry));
});

test("dry-run — overlay postproduction bloque exportReady", () => {
  const dry = runPostProductionDryRun({
    productionResult: makeProductionResultV1(),
    storyboard: makeStoryboard(),
    scenePackages: makePackages(true),
    aspectRatio: "9:16",
    mergeEngine: createUnavailableMergeEngine(),
    at: AT,
  });
  assert.equal(dry.exportReady, false);
  assert.ok(dry.warnings.some((w) => w.code === "overlay_unsupported"));
  assert.ok(dry.mergePlan?.overlays.length);
});

test("dry-run — source expirée", () => {
  const expired = makeVideoAsset("e", {
    source: {
      kind: "temporary_external",
      url: "https://cdn.example.com/e.mp4",
      expiresAt: "2020-01-01T00:00:00.000Z",
    },
  });
  const pr = makeProductionResultV1({
    scenes: makeProductionResultV1().scenes.map((s, i) =>
      i === 0
        ? {
            ...s,
            outputAssets: [expired],
            steps: s.steps.map((st) => ({ ...st, outputAssets: [expired] })),
          }
        : s
    ),
  });
  const dry = runPostProductionDryRun({
    productionResult: pr,
    storyboard: makeStoryboard(),
    scenePackages: makePackages(),
    aspectRatio: "9:16",
    mergeEngine: createUnavailableMergeEngine(),
    at: AT,
  });
  assert.equal(dry.exportReady, false);
  assert.ok(
    dry.quality.blockingIssues.some((i) => i.code === "source_expired") ||
      dry.validations.some((v) => v.code === "expired_asset")
  );
});

test("MergeEngine stub — execute refuse sans faux asset", async () => {
  const engine = createUnavailableMergeEngine();
  assert.equal(engine.capabilities.executionEnabled, false);
  const dry = runPostProductionDryRun({
    productionResult: makeProductionResultV1(),
    storyboard: makeStoryboard(),
    scenePackages: makePackages(),
    aspectRatio: "9:16",
    mergeEngine: engine,
    at: AT,
  });
  assert.ok(dry.mergePlan);
  const result = await engine.execute(dry.mergePlan!, {
    correlationId: "c",
    requestedAt: AT,
  });
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.error.code, "merge_adapter_not_configured");
  }
  assert.equal(engine.poll, undefined);
  assert.equal(engine.cancel, undefined);
});

test("PostProductionDirector — prepare needs_review puis revue", async () => {
  const director = createPostProductionDirector({
    mergeEngine: createUnavailableMergeEngine(),
    destinations: [createDownloadExportAdapter(), createUnavailableAiccosExportAdapter()],
  });
  const prepared = await director.prepare(
    {
      productionResult: makeProductionResultV1(),
      storyboard: makeStoryboard(),
      scenePackages: makePackages(),
      aspectRatio: "9:16",
    },
    ctx()
  );
  // unknown visual checks → needs_review
  assert.equal(prepared.status, "needs_review");
  if (prepared.status !== "needs_review") return;

  const reviewed = await director.recordHumanReview(
    {
      productionResult: prepared.productionResult,
      quality: prepared.quality,
      status: "approved",
      reviewedIssueCodes: ["visual_identity", "lip_sync_quality"],
    },
    ctx()
  );
  assert.equal(reviewed.status, "review_recorded");
  if (reviewed.status === "review_recorded") {
    assert.equal(reviewed.humanReview.status, "approved");
    assert.equal(reviewed.productionResult.delivery?.status, "merge_ready");
  }
});

test("PostProductionDirector — merge stub unavailable", async () => {
  const director = createPostProductionDirector({
    mergeEngine: createUnavailableMergeEngine(),
  });
  const pr = migrateProductionResultToV11(makeProductionResultV1(), AT);
  // Force merge_ready delivery for merge path
  const withDelivery = {
    ...pr,
    delivery: { status: "merge_ready" as const, updatedAt: AT, mergePlanId: "mp" },
  };
  const dry = runPostProductionDryRun({
    productionResult: withDelivery,
    storyboard: makeStoryboard(),
    scenePackages: makePackages(),
    aspectRatio: "9:16",
    mergeEngine: createUnavailableMergeEngine(),
    at: AT,
  });
  assert.ok(dry.mergePlan);
  const merged = await director.merge(
    {
      productionResult: withDelivery,
      mergePlan: dry.mergePlan!,
      quality: { ...dry.quality, status: "accepted", blockingIssues: [] },
    },
    ctx()
  );
  assert.equal(merged.status, "merge_unavailable");
  if (merged.status === "merge_unavailable") {
    assert.ok(
      merged.reason.includes("merge") ||
        merged.reason === "merge_adapter_not_configured" ||
        merged.reason === "merge_execution_unavailable"
    );
    assert.equal(merged.exportReady, false);
  }
});

test("prepareExport — refuse sans asset final (pas de fiction)", async () => {
  const director = createPostProductionDirector({
    mergeEngine: createUnavailableMergeEngine(),
    destinations: [createDownloadExportAdapter()],
  });
  const dry = runPostProductionDryRun({
    productionResult: makeProductionResultV1(),
    storyboard: makeStoryboard(),
    scenePackages: makePackages(),
    aspectRatio: "9:16",
    mergeEngine: createUnavailableMergeEngine(),
    at: AT,
  });
  const exp = await director.prepareExport(
    {
      productionResult: migrateProductionResultToV11(makeProductionResultV1(), AT),
      mergePlan: dry.mergePlan!,
      quality: { ...dry.quality, status: "accepted", blockingIssues: [] },
    },
    ctx()
  );
  assert.equal(exp.status, "failed");
});

test("AICCOS stub — destination_not_configured", async () => {
  const aiccos = createUnavailableAiccosExportAdapter();
  const v = await aiccos.validate(
    {
      id: "ex-1",
      projectId: "proj-1",
      productionResultRevisionId: "pr-1",
      finalAsset: makeVideoAsset("f"),
      qualityReport: {
        status: "accepted",
        technicalChecks: [],
        contractualChecks: [],
        editorialChecks: [],
        blockingIssues: [],
        warnings: [],
        reviewedAt: AT,
        validatorVersion: "final-quality.v1",
      },
      manifest: {
        schemaVersion: "1.0.0",
        projectId: "proj-1",
        productionRunId: "run-1",
        generationPlanRevisionId: "plan-1",
        storyboardRevisionId: "sb-1",
        finalAssetId: "f",
        sceneAssets: [],
        providers: [],
        costs: {
          estimatedAmountMinor: 0,
          committedAmountMinor: 0,
          releasedAmountMinor: 0,
          currency: "USD",
        },
        quality: {
          status: "accepted",
          validatorVersion: "final-quality.v1",
          blockingCount: 0,
          warningCount: 0,
        },
        generatedAt: AT,
      },
      createdAt: AT,
    },
    { correlationId: "c", requestedAt: AT }
  );
  assert.equal(v.valid, false);
  assert.equal(v.issues[0]?.code, "destination_not_configured");
  const sent = await aiccos.send(
    {
      id: "ex-1",
      projectId: "proj-1",
      productionResultRevisionId: "pr-1",
      finalAsset: makeVideoAsset("f"),
      qualityReport: {
        status: "accepted",
        technicalChecks: [],
        contractualChecks: [],
        editorialChecks: [],
        blockingIssues: [],
        warnings: [],
        reviewedAt: AT,
        validatorVersion: "final-quality.v1",
      },
      manifest: {
        schemaVersion: "1.0.0",
        projectId: "proj-1",
        productionRunId: "run-1",
        generationPlanRevisionId: "plan-1",
        storyboardRevisionId: "sb-1",
        finalAssetId: "f",
        sceneAssets: [],
        providers: [],
        costs: {
          estimatedAmountMinor: 0,
          committedAmountMinor: 0,
          releasedAmountMinor: 0,
          currency: "USD",
        },
        quality: {
          status: "accepted",
          validatorVersion: "final-quality.v1",
          blockingCount: 0,
          warningCount: 0,
        },
        generatedAt: AT,
      },
      createdAt: AT,
    },
    { correlationId: "c", requestedAt: AT }
  );
  assert.equal(sent.status, "failed");
});
