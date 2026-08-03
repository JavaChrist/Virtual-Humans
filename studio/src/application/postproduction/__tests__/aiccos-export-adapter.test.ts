/**
 * AICCOS export adapter + mapping — fakes only (VHS-111C).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AT,
  EXPIRES,
  makeVideoAsset,
} from "@/domain/postproduction/__tests__/fixtures";
import type { ExportPackage } from "@/domain/postproduction";
import type {
  AiccosExportPipeline,
  AiccosExportRequest,
} from "@/infrastructure/export/aiccos";
import {
  createAiccosExportAdapter,
  createUnavailableAiccosExportAdapter,
  createUnavailableMergeEngine,
  dryCheckAiccosFinalAsset,
  mapExportPackageToAiccosRequest,
  runPostProductionDryRun,
} from "../index";
import {
  makePackages,
  makeProductionResultV1,
  makeStoryboard,
} from "@/domain/postproduction/__tests__/fixtures";

function makePackage(over: Partial<ExportPackage> = {}): ExportPackage {
  const asset = makeVideoAsset("final-1");
  return {
    id: "ex-1",
    projectId: "proj-1",
    productionResultRevisionId: "pr-1",
    finalAsset: asset,
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
      finalAssetId: asset.id,
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
    ...over,
  };
}

function fakePipeline(handler?: {
  send?: (
    req: AiccosExportRequest
  ) => Promise<Awaited<ReturnType<AiccosExportPipeline["send"]>>>;
}): AiccosExportPipeline & { calls: AiccosExportRequest[] } {
  const calls: AiccosExportRequest[] = [];
  return {
    calls,
    async send(req) {
      calls.push(req);
      if (handler?.send) return handler.send(req);
      return {
        status: "delivered",
        destinationId: "aiccos",
        externalId: "clip-99",
        publicUrl: "https://aiccos.test/public/clip-99.mp4",
        title: req.title,
        deliveredAt: AT,
      };
    },
  };
}

test("mapExportPackage — valide / productSlug / expired / non mutation", () => {
  const pkg = makePackage();
  const snap = JSON.stringify(pkg);
  const req = mapExportPackageToAiccosRequest(pkg, {
    title: "Titre OK",
    productSlug: "slug-a",
    at: AT,
  });
  assert.equal(req.title, "Titre OK");
  assert.equal(req.productSlug, "slug-a");
  assert.ok(req.videoUrl.startsWith("https://"));
  assert.equal(JSON.stringify(pkg), snap);
  assert.ok(!JSON.stringify(req).includes("manifest"));

  const noSlug = mapExportPackageToAiccosRequest(pkg, { title: "T", at: AT });
  assert.equal(noSlug.productSlug, undefined);

  const expired = makePackage({
    finalAsset: makeVideoAsset("e", {
      source: {
        kind: "temporary_external",
        url: "https://secret.example/leak.mp4",
        expiresAt: "2020-01-01T00:00:00.000Z",
      },
    }),
  });
  try {
    mapExportPackageToAiccosRequest(expired, { title: "T", at: AT });
    assert.fail("expected");
  } catch (e) {
    assert.ok(e instanceof Error);
    assert.ok(!e.message.includes("secret.example"));
  }
});

test("adapter — validate / delivered / destinationId / pipeline once", async () => {
  const pipe = fakePipeline();
  const adapter = createAiccosExportAdapter({
    pipeline: pipe,
    resolveTitle: () => "Clip final",
    resolveProductSlug: () => "prod",
  });
  assert.equal(adapter.destinationId, "aiccos");

  const pkg = makePackage();
  const v = await adapter.validate(pkg, { correlationId: "c", requestedAt: AT });
  assert.equal(v.valid, true);

  const detailed = await adapter.sendDetailed(pkg, {
    correlationId: "c",
    requestedAt: AT,
  });
  assert.equal(detailed.status, "delivered");
  if (detailed.status === "delivered") {
    assert.equal(detailed.externalId, "clip-99");
    assert.equal(detailed.publicUrl, "https://aiccos.test/public/clip-99.mp4");
    assert.ok(!JSON.stringify(detailed).includes("upload"));
    assert.ok(!JSON.stringify(detailed).includes("Bearer"));
  }
  assert.equal(pipe.calls.length, 1);
  assert.equal(pipe.calls[0]!.title, "Clip final");
  assert.equal(pipe.calls[0]!.productSlug, "prod");

  const sent = await adapter.send(pkg, { correlationId: "c", requestedAt: AT });
  assert.equal(sent.status, "completed");
  if (sent.status === "completed") {
    assert.equal(sent.remoteRef, "clip-99");
    assert.equal(sent.destinationId, "aiccos");
  }
  assert.equal(pipe.calls.length, 2);
});

test("adapter — failed pipeline / token absent surface", async () => {
  const pipe = fakePipeline({
    send: async () => ({
      status: "failed",
      failedAt: AT,
      error: {
        code: "upload_failed",
        retryable: false,
        publicMessage: "L'upload du clip a échoué.",
      },
    }),
  });
  const adapter = createAiccosExportAdapter({
    pipeline: pipe,
    resolveTitle: () => "T",
  });
  const r = await adapter.send(makePackage(), {
    correlationId: "c",
    requestedAt: AT,
  });
  assert.equal(r.status, "failed");
  if (r.status === "failed") {
    assert.equal(r.error.code, "upload_failed");
    assert.ok(!r.error.publicMessage.includes("https://storage"));
  }
});

test("dry-run — aiccos absent / configuré / providerCalled false", () => {
  const base = {
    productionResult: makeProductionResultV1(),
    storyboard: makeStoryboard(),
    scenePackages: makePackages(),
    aspectRatio: "9:16" as const,
    mergeEngine: createUnavailableMergeEngine(),
    at: AT,
  };

  const absent = runPostProductionDryRun({ ...base, aiccosExport: null });
  assert.equal(absent.providerCalled, false);
  assert.ok(absent.validations.some((v) => v.code === "aiccos_adapter_absent" && !v.passed));

  const pipe = fakePipeline();
  const adapter = createAiccosExportAdapter({
    pipeline: pipe,
    resolveTitle: () => "T",
  });
  const configured = runPostProductionDryRun({ ...base, aiccosExport: adapter });
  assert.equal(configured.providerCalled, false);
  assert.equal(pipe.calls.length, 0);
  assert.ok(
    configured.validations.some((v) => v.code === "aiccos_adapter_configured" && v.passed)
  );

  const stub = createUnavailableAiccosExportAdapter();
  // stub has destinationId aiccos — treated as configured destination object; send never called
  const withStub = runPostProductionDryRun({ ...base, aiccosExport: stub });
  assert.equal(withStub.providerCalled, false);

  const sizeChecks = dryCheckAiccosFinalAsset({
    sizeBytes: 60 * 1024 * 1024,
    mimeType: "video/mp4",
    expiresAt: EXPIRES,
    at: AT,
  });
  assert.ok(sizeChecks.some((v) => v.code === "aiccos_size" && !v.passed));

  const unknown = dryCheckAiccosFinalAsset({ at: AT, mimeType: "video/mp4" });
  assert.ok(unknown.some((v) => v.code === "aiccos_size_unknown"));
});
