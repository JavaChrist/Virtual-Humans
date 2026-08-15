import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateArtifactBundleCoherence,
  evaluateNaiveActivePointerSet,
  selectExplicitArtifactBundle,
} from "../artifact-bundle-coherence";
import {
  PHASE_11B_ACTIVE_GENERATION_PLAN_ID,
  PHASE_11B_ACTIVE_GENERATION_PLAN_REVISION,
  PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID,
  PHASE_11B_ACTIVE_PRODUCTION_RESULT_REVISION,
  PHASE_11B_ACTIVE_QUALITY_REPORT_ID,
  PHASE_11B_ACTIVE_QUALITY_REPORT_REVISION,
  PHASE_11B_I2V_GENERATION_PLAN_ID,
  PHASE_11B_I2V_GENERATION_PLAN_REVISION,
  PHASE_11B_NEXT_VOICE_AUTH,
  PHASE_11B_POINTER_COHERENCE_AUTH,
  PHASE_11B_POINTER_COHERENCE_VERDICT,
  PHASE_11B_POINTER_STRATEGY,
  assertPhase11BPointerCoherenceNoSideEffects,
  buildPhase11AExplicitImageBundle,
  buildPhase11BExplicitI2vBundle,
  livePhase11BPointerFacts,
  planPhase11BArtifactPointerCoherence,
} from "../phase-11b-artifact-pointer-coherence";
import {
  PHASE_11B_LIVE_PROJECT_ID,
  PHASE_11B_LIVE_RUN_ID,
  PHASE_11B_LIVE_VIDEO_ASSET_ID,
  PHASE_11B_LIVE_WORKSPACE_ID,
} from "../phase-11b-i2v-attempt-terminal-state";
import { PHASE_11B_I2V_PARENT_ASSET_ID } from "../phase-11b-i2v-human-review-approve";

test("11B-POINTER — auth, stratégie C, next Voice, pas de mutation", () => {
  assert.equal(PHASE_11B_POINTER_COHERENCE_AUTH, "AUTH_11B_ARTIFACT_POINTER_COHERENCE_HARDENING");
  assert.equal(
    PHASE_11B_POINTER_COHERENCE_VERDICT,
    "ARTIFACT_POINTER_COHERENCE_HARDENED_NO_LIVE_MUTATION_REQUIRED",
  );
  assert.equal(PHASE_11B_NEXT_VOICE_AUTH, "AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT");
  assert.equal(PHASE_11B_POINTER_STRATEGY, "C_explicit_run_plan_output");
});

test("11B-POINTER — dry-run live : mixte naïf, I2V explicite cohérent, merge refusé", () => {
  const plan = planPhase11BArtifactPointerCoherence(livePhase11BPointerFacts());
  assert.equal(plan.activeGenerationPlan.idPrefix, "a55bd426");
  assert.equal(plan.activeGenerationPlan.revision, PHASE_11B_ACTIVE_GENERATION_PLAN_REVISION);
  assert.equal(plan.persistedI2vGenerationPlan.idPrefix, "3d1858eb");
  assert.equal(plan.persistedI2vGenerationPlan.revision, PHASE_11B_I2V_GENERATION_PLAN_REVISION);
  assert.equal(plan.persistedI2vGenerationPlan.active, false);
  assert.equal(plan.activeQualityReport.idPrefix, "0da85052");
  assert.equal(plan.activeQualityReport.revision, PHASE_11B_ACTIVE_QUALITY_REPORT_REVISION);
  assert.equal(plan.activeProductionResult.idPrefix, "fa5c42bd");
  assert.equal(plan.activeProductionResult.revision, PHASE_11B_ACTIVE_PRODUCTION_RESULT_REVISION);
  assert.equal(plan.pointerSetCoherent, false);
  assert.equal(plan.explicitI2vBundleCoherent, true);
  assert.equal(plan.explicit11AAccessPreserved, true);
  assert.equal(plan.mergeExportAuthorized, false);
  assert.equal(plan.mergeAllowed, false);
  assert.equal(plan.exportAllowed, false);
  assert.equal(plan.downstreamAllowed, false);
  assert.equal(plan.mutationRequired, false);
  assert.equal(plan.mutationAllowed, false);
  assert.equal(plan.pointerWrites, 0);
  assert.equal(plan.productionWrites, 0);
  assert.equal(plan.providerCalls, 0);
  assert.equal(plan.budgetWrites, 0);
  assert.ok(plan.refuseCodes.includes("merge_ready_without_authorization"));
  assert.ok(plan.refuseCodes.includes("downstream_flag_off"));
  assertPhase11BPointerCoherenceNoSideEffects(plan);
});

test("11B-POINTER — replay déterministe", () => {
  const a = planPhase11BArtifactPointerCoherence(livePhase11BPointerFacts());
  const b = planPhase11BArtifactPointerCoherence(livePhase11BPointerFacts());
  assert.equal(a.fingerprint, b.fingerprint);
  assert.match(a.fingerprint, /^[0-9a-f]{64}$/);
});

test("11B-POINTER — GP I2V rev.3 résolu explicitement sans activation", () => {
  const bundle = buildPhase11BExplicitI2vBundle(livePhase11BPointerFacts());
  assert.equal(bundle.generationPlanId, PHASE_11B_I2V_GENERATION_PLAN_ID);
  assert.notEqual(bundle.generationPlanId, PHASE_11B_ACTIVE_GENERATION_PLAN_ID);
  assert.equal(evaluateArtifactBundleCoherence(bundle).coherent, true);
  const selected = selectExplicitArtifactBundle({
    candidates: [bundle],
    selectedGenerationPlanId: PHASE_11B_I2V_GENERATION_PLAN_ID,
    selectedOutputAssetId: PHASE_11B_LIVE_VIDEO_ASSET_ID,
    selectedRunId: PHASE_11B_LIVE_RUN_ID,
  });
  assert.equal(selected.ok, true);
});

test("11B-POINTER — accès explicite 11A conservé, vidéo non substituée", () => {
  const facts = livePhase11BPointerFacts();
  const image = buildPhase11AExplicitImageBundle(facts);
  const video = buildPhase11BExplicitI2vBundle(facts);
  assert.equal(evaluateArtifactBundleCoherence(image).coherent, true);
  assert.equal(image.outputAssetId, PHASE_11B_I2V_PARENT_ASSET_ID);
  assert.equal(video.outputAssetId, PHASE_11B_LIVE_VIDEO_ASSET_ID);
  assert.notEqual(image.outputAssetId, video.outputAssetId);
  assert.equal(image.output.active, false);
  assert.equal(video.output.active, false);
});

test("11B-POINTER — refuse mauvais workspace / projet / run / output", () => {
  const facts = livePhase11BPointerFacts();
  const wrongWs = buildPhase11BExplicitI2vBundle(facts);
  wrongWs.workspaceId = "00000000-0000-4000-8000-000000000000";
  assert.equal(evaluateArtifactBundleCoherence(wrongWs).coherent, false);

  const wrongProject = buildPhase11BExplicitI2vBundle(facts);
  wrongProject.projectId = "00000000-0000-4000-8000-000000000001";
  assert.equal(evaluateArtifactBundleCoherence(wrongProject).coherent, false);

  const wrongRun = buildPhase11BExplicitI2vBundle(facts);
  wrongRun.runId = "00000000-0000-4000-8000-000000000002";
  assert.equal(evaluateArtifactBundleCoherence(wrongRun).coherent, false);

  const wrongOutput = buildPhase11BExplicitI2vBundle(facts);
  wrongOutput.outputAssetId = PHASE_11B_I2V_PARENT_ASSET_ID;
  assert.equal(evaluateArtifactBundleCoherence(wrongOutput).coherent, false);
});

test("11B-POINTER — refuse QR/PR/HR/checksum/lifecycle contradictoires", () => {
  const facts = livePhase11BPointerFacts();
  const qr = buildPhase11BExplicitI2vBundle(facts);
  qr.qualityReport = { ...qr.qualityReport, outputAssetId: PHASE_11B_I2V_PARENT_ASSET_ID };
  assert.equal(evaluateArtifactBundleCoherence(qr).coherent, false);

  const pr = buildPhase11BExplicitI2vBundle(facts);
  pr.productionResult = { ...pr.productionResult, generationPlanId: PHASE_11B_ACTIVE_GENERATION_PLAN_ID };
  assert.equal(evaluateArtifactBundleCoherence(pr).coherent, false);

  const hr = buildPhase11BExplicitI2vBundle(facts);
  hr.humanReview = { decisionId: "301ee080", decision: "approved", assetId: PHASE_11B_I2V_PARENT_ASSET_ID };
  assert.equal(evaluateArtifactBundleCoherence(hr).coherent, false);

  const checksum = buildPhase11BExplicitI2vBundle(facts);
  checksum.output = { ...checksum.output, checksum: "deadbeef" };
  assert.equal(evaluateArtifactBundleCoherence(checksum).coherent, false);

  const stale = buildPhase11BExplicitI2vBundle(facts);
  stale.output = { ...stale.output, stale: true };
  assert.equal(evaluateArtifactBundleCoherence(stale).coherent, false);
});

test("11B-POINTER — pointeurs ambigus et merge_ready sans autorisation", () => {
  const facts = livePhase11BPointerFacts();
  const ambiguous = selectExplicitArtifactBundle({
    candidates: [buildPhase11AExplicitImageBundle(facts), buildPhase11BExplicitI2vBundle(facts)],
  });
  assert.equal(ambiguous.ok, false);
  if (!ambiguous.ok) assert.equal(ambiguous.code, "ambiguous_bundles");

  const naive = evaluateNaiveActivePointerSet({
    workspaceId: PHASE_11B_LIVE_WORKSPACE_ID,
    projectId: PHASE_11B_LIVE_PROJECT_ID,
    activeGenerationPlan: buildPhase11AExplicitImageBundle(facts).generationPlan,
    activeQualityReport: buildPhase11BExplicitI2vBundle(facts).qualityReport,
    activeProductionResult: buildPhase11BExplicitI2vBundle(facts).productionResult,
  });
  assert.equal(naive.coherent, false);

  const authorized = planPhase11BArtifactPointerCoherence(
    livePhase11BPointerFacts({
      productionResultValue: { delivery: { status: "merge_ready" }, phase11b: { mergeExportAuthorized: true } },
      downstreamEnabled: true,
    }),
  );
  assert.equal(authorized.mergeExportAuthorized, true);
  assert.equal(authorized.mergeAllowed, true);
  assert.equal(authorized.downstreamAllowed, true);
});

test("11B-POINTER — redaction et identifiants live attendus", () => {
  const plan = planPhase11BArtifactPointerCoherence(livePhase11BPointerFacts());
  const dumped = JSON.stringify(plan);
  assert.equal(dumped.includes(PHASE_11B_ACTIVE_GENERATION_PLAN_ID), false);
  assert.equal(dumped.includes(PHASE_11B_I2V_GENERATION_PLAN_ID), false);
  assert.equal(dumped.includes(PHASE_11B_ACTIVE_QUALITY_REPORT_ID), false);
  assert.equal(dumped.includes(PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID), false);
  assert.ok(PHASE_11B_LIVE_WORKSPACE_ID.startsWith("3c308f57"));
  assert.ok(PHASE_11B_LIVE_PROJECT_ID.startsWith("984507af"));
  assert.ok(PHASE_11B_LIVE_VIDEO_ASSET_ID.startsWith("9be6cb0c"));
});
