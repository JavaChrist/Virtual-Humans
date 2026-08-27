import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateArtifactBundleCoherence,
  evaluateMergeExportAuthorization,
  evaluateNaiveActivePointerSet,
  fingerprintCoherenceDecision,
  readMergeExportAuthorized,
  redactCoherenceError,
  selectExplicitArtifactBundle,
  type ArtifactBundle,
  type ArtifactBundleMember,
} from "../artifact-bundle-coherence";

const WS = "11111111-1111-4111-8111-111111111111";
const PROJ = "22222222-2222-4222-8222-222222222222";
const OTHER_WS = "99999999-9999-4999-8999-999999999999";
const OTHER_PROJ = "88888888-8888-4888-8888-888888888888";
const PLAN_IMAGE = "33333333-3333-4333-8333-333333333333";
const PLAN_I2V = "44444444-4444-4444-8444-444444444444";
const QR_IMAGE = "55555555-5555-4555-8555-555555555555";
const QR_I2V = "66666666-6666-4666-8666-666666666666";
const PR_IMAGE = "77777777-7777-4777-8777-777777777777";
const PR_I2V = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RUN_IMAGE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RUN_I2V = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const IMAGE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const VIDEO = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function member(over: Partial<ArtifactBundleMember> & Pick<ArtifactBundleMember, "artifactId" | "artifactType">): ArtifactBundleMember {
  return {
    workspaceId: WS,
    projectId: PROJ,
    revision: 1,
    stale: false,
    quarantined: false,
    ...over,
  };
}

function imageBundle(over: Partial<ArtifactBundle> = {}): ArtifactBundle {
  return {
    workspaceId: WS,
    projectId: PROJ,
    runId: RUN_IMAGE,
    generationPlanId: PLAN_IMAGE,
    planFingerprint: "image-fp",
    sourceAssetId: IMAGE,
    outputAssetId: IMAGE,
    capability: "image.text_to_image",
    action: "text_to_image",
    generationPlan: member({
      artifactId: PLAN_IMAGE,
      artifactType: "generation_plan",
      generationPlanId: PLAN_IMAGE,
      outputAssetId: IMAGE,
      capability: "image.text_to_image",
      action: "text_to_image",
      planFingerprint: "image-fp",
    }),
    qualityReport: member({
      artifactId: QR_IMAGE,
      artifactType: "quality_report",
      generationPlanId: PLAN_IMAGE,
      runId: RUN_IMAGE,
      outputAssetId: IMAGE,
      capability: "image.text_to_image",
      checksum: "img-sum",
    }),
    productionResult: member({
      artifactId: PR_IMAGE,
      artifactType: "production_result",
      generationPlanId: PLAN_IMAGE,
      runId: RUN_IMAGE,
      outputAssetId: IMAGE,
      capability: "image.text_to_image",
      checksum: "img-sum",
    }),
    humanReview: { decisionId: "hr-image", decision: "approved", assetId: IMAGE },
    output: {
      assetId: IMAGE,
      checksum: "img-sum",
      lifecycle: "approved",
      active: false,
      published: false,
    },
    ...over,
  };
}

function i2vBundle(over: Partial<ArtifactBundle> = {}): ArtifactBundle {
  return {
    workspaceId: WS,
    projectId: PROJ,
    runId: RUN_I2V,
    generationPlanId: PLAN_I2V,
    planFingerprint: "i2v-fp",
    sourceAssetId: IMAGE,
    outputAssetId: VIDEO,
    capability: "video.image_to_video",
    action: "image_to_video",
    generationPlan: member({
      artifactId: PLAN_I2V,
      artifactType: "generation_plan",
      generationPlanId: PLAN_I2V,
      sourceAssetId: IMAGE,
      capability: "video.image_to_video",
      action: "image_to_video",
      planFingerprint: "i2v-fp",
    }),
    qualityReport: member({
      artifactId: QR_I2V,
      artifactType: "quality_report",
      generationPlanId: PLAN_I2V,
      runId: RUN_I2V,
      outputAssetId: VIDEO,
      capability: "video.image_to_video",
      checksum: "vid-sum",
    }),
    productionResult: member({
      artifactId: PR_I2V,
      artifactType: "production_result",
      generationPlanId: PLAN_I2V,
      runId: RUN_I2V,
      sourceAssetId: IMAGE,
      outputAssetId: VIDEO,
      capability: "video.image_to_video",
      checksum: "vid-sum",
    }),
    humanReview: { decisionId: "hr-i2v", decision: "approved", assetId: VIDEO },
    output: {
      assetId: VIDEO,
      checksum: "vid-sum",
      lifecycle: "approved",
      active: false,
      published: false,
    },
    ...over,
  };
}

test("1 — bundle 11A cohérent", () => {
  const result = evaluateArtifactBundleCoherence(imageBundle());
  assert.equal(result.coherent, true, JSON.stringify(result.issues));
});

test("2 — bundle I2V cohérent", () => {
  const result = evaluateArtifactBundleCoherence(i2vBundle());
  assert.equal(result.coherent, true, JSON.stringify(result.issues));
});

test("3 — mélange GP 11A + QR/PR I2V détecté", () => {
  const naive = evaluateNaiveActivePointerSet({
    workspaceId: WS,
    projectId: PROJ,
    activeGenerationPlan: imageBundle().generationPlan,
    activeQualityReport: i2vBundle().qualityReport,
    activeProductionResult: i2vBundle().productionResult,
  });
  assert.equal(naive.coherent, false);
  assert.ok(naive.issues.some((item) => item.code.includes("naive_")));
});

test("4 — résolution explicite du GP I2V hors pointeur actif", () => {
  const selected = selectExplicitArtifactBundle({
    candidates: [i2vBundle()],
    selectedGenerationPlanId: PLAN_I2V,
    selectedOutputAssetId: VIDEO,
    selectedRunId: RUN_I2V,
  });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(selected.bundle.generationPlanId, PLAN_I2V);
  assert.equal(evaluateArtifactBundleCoherence(selected.bundle).coherent, true);
});

test("5 — mauvais workspace refusé", () => {
  const result = evaluateArtifactBundleCoherence(i2vBundle({ workspaceId: OTHER_WS }));
  assert.equal(result.coherent, false);
  assert.ok(result.issues.some((item) => item.code === "workspace_mismatch"));
});

test("6 — mauvais projet refusé", () => {
  const result = evaluateArtifactBundleCoherence(i2vBundle({ projectId: OTHER_PROJ }));
  assert.equal(result.coherent, false);
  assert.ok(result.issues.some((item) => item.code === "project_mismatch"));
});

test("7 — mauvais run refusé", () => {
  const result = evaluateArtifactBundleCoherence(i2vBundle({ runId: RUN_IMAGE }));
  assert.equal(result.coherent, false);
  assert.ok(result.issues.some((item) => item.code === "run_mismatch"));
});

test("8 — mauvais output refusé", () => {
  const result = evaluateArtifactBundleCoherence(i2vBundle({ outputAssetId: IMAGE }));
  assert.equal(result.coherent, false);
  assert.ok(result.issues.some((item) => item.code === "output_mismatch" || item.code === "quality_report_asset_mismatch"));
});

test("9 — QR d'un autre asset refusé", () => {
  const bundle = i2vBundle();
  bundle.qualityReport = { ...bundle.qualityReport, outputAssetId: IMAGE };
  const result = evaluateArtifactBundleCoherence(bundle);
  assert.equal(result.coherent, false);
  assert.ok(result.issues.some((item) => item.code === "quality_report_asset_mismatch"));
});

test("10 — PR d'un autre plan refusé", () => {
  const bundle = i2vBundle();
  bundle.productionResult = { ...bundle.productionResult, generationPlanId: PLAN_IMAGE };
  const result = evaluateArtifactBundleCoherence(bundle);
  assert.equal(result.coherent, false);
  assert.ok(result.issues.some((item) => item.code === "production_result_plan_mismatch"));
});

test("11 — HR d'un autre asset refusée", () => {
  const result = evaluateArtifactBundleCoherence(
    i2vBundle({ humanReview: { decisionId: "hr-x", decision: "approved", assetId: IMAGE } }),
  );
  assert.equal(result.coherent, false);
  assert.ok(result.issues.some((item) => item.code === "human_review_asset_mismatch"));
});

test("12 — checksum contradictoire refusé", () => {
  const bundle = i2vBundle();
  bundle.output = { ...bundle.output, checksum: "other-sum" };
  const result = evaluateArtifactBundleCoherence(bundle);
  assert.equal(result.coherent, false);
  assert.ok(result.issues.some((item) => item.code === "checksum_mismatch"));
});

test("13 — lifecycle stale/quarantine refusé", () => {
  const stale = evaluateArtifactBundleCoherence(
    i2vBundle({ output: { assetId: VIDEO, lifecycle: "approved", active: false, published: false, stale: true } }),
  );
  assert.equal(stale.coherent, false);
  const quarantined = evaluateArtifactBundleCoherence(
    i2vBundle({ output: { assetId: VIDEO, lifecycle: "quarantined", active: false, published: false } }),
  );
  assert.equal(quarantined.coherent, false);
});

test("14 — merge_ready seul refusé", () => {
  const decision = evaluateMergeExportAuthorization({
    deliveryStatus: "merge_ready",
    mergeExportAuthorized: false,
    outputApproved: true,
    outputSelected: true,
    humanReviewApproved: true,
    bundleCoherent: true,
    downstreamEnabled: false,
  });
  assert.equal(decision.mergeAllowed, false);
  assert.ok(decision.reasons.includes("merge_ready_without_authorization"));
});

test("15 — mergeExportAuthorized=false refusé", () => {
  assert.equal(readMergeExportAuthorized({ delivery: { status: "merge_ready" }, phase11b: { mergeExportAuthorized: false } }), false);
  const decision = evaluateMergeExportAuthorization({
    deliveryStatus: "merge_ready",
    mergeExportAuthorized: false,
    outputApproved: true,
    outputSelected: true,
    humanReviewApproved: true,
    bundleCoherent: true,
    downstreamEnabled: false,
  });
  assert.equal(decision.exportAllowed, false);
});

test("16 — downstream flag OFF refusé", () => {
  const decision = evaluateMergeExportAuthorization({
    deliveryStatus: "merge_ready",
    mergeExportAuthorized: true,
    outputApproved: true,
    outputSelected: true,
    humanReviewApproved: true,
    bundleCoherent: true,
    downstreamEnabled: false,
  });
  assert.equal(decision.mergeAllowed, true);
  assert.equal(decision.downstreamAllowed, false);
  assert.ok(decision.reasons.includes("downstream_flag_off"));
});

test("17 — bundle ambigu refusé", () => {
  const selected = selectExplicitArtifactBundle({
    candidates: [imageBundle(), i2vBundle()],
  });
  assert.equal(selected.ok, false);
  if (selected.ok) return;
  assert.equal(selected.code, "ambiguous_bundles");
});

test("18 — replay déterministe", () => {
  const a = fingerprintCoherenceDecision(["merge_ready", "false", "C"]);
  const b = fingerprintCoherenceDecision(["merge_ready", "false", "C"]);
  assert.equal(a, b);
  assert.notEqual(a, fingerprintCoherenceDecision(["merge_ready", "true", "C"]));
});

test("19-22 — aucune mutation / activation / provider / budget write dans le contrat", () => {
  const decision = evaluateMergeExportAuthorization({
    deliveryStatus: "merge_ready",
    mergeExportAuthorized: false,
    outputApproved: true,
    outputSelected: true,
    outputActive: false,
    humanReviewApproved: true,
    bundleCoherent: true,
    downstreamEnabled: false,
    requireActivation: false,
  });
  assert.equal(decision.mergeAllowed, false);
  assert.equal(decision.exportAllowed, false);
  assert.equal(decision.downstreamAllowed, false);
});

test("23 — redaction des erreurs", () => {
  const redacted = redactCoherenceError(
    `bundle ${VIDEO} url https://example.invalid/secret data:image/png;base64,AAAA`,
  );
  assert.equal(redacted.includes(VIDEO), false);
  assert.ok(redacted.includes("eeeeeeee…"));
  assert.ok(redacted.includes("[redacted-url]"));
  assert.ok(redacted.includes("[redacted-data]"));
});

test("24 — compatibilité historique 11A", () => {
  const result = evaluateArtifactBundleCoherence(imageBundle());
  assert.equal(result.coherent, true);
  const selected = selectExplicitArtifactBundle({
    candidates: [imageBundle(), i2vBundle()],
    selectedGenerationPlanId: PLAN_IMAGE,
    selectedOutputAssetId: IMAGE,
  });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(selected.bundle.outputAssetId, IMAGE);
  assert.notEqual(selected.bundle.outputAssetId, VIDEO);
});

test("fail-closed : mergeExportAuthorized absent est false", () => {
  assert.equal(readMergeExportAuthorized({ delivery: { status: "merge_ready" } }), false);
  assert.equal(readMergeExportAuthorized({ phase11a: { mergeExportAuthorized: true }, phase11b: { mergeExportAuthorized: false } }), false);
  assert.equal(readMergeExportAuthorized({ phase11d: { mergeExportAuthorized: false } }), false);
  assert.equal(readMergeExportAuthorized({ delivery: { mergeExportAuthorized: true }, phase11d: { mergeExportAuthorized: false } }), false);
  assert.equal(readMergeExportAuthorized({ phase11e: { mergeExportAuthorized: false } }), false);
  assert.equal(readMergeExportAuthorized({ delivery: { mergeExportAuthorized: true }, phase11e: { mergeExportAuthorized: false } }), false);
  assert.equal(readMergeExportAuthorized({ delivery: { mergeExportAuthorized: true } }), true);
});
